import { z } from 'zod';
import { authedProcedure, successResponse, PaginationInputSchema } from '../router.js';
import { prisma } from '../../db.js';
import { createModuleLogger } from '../../logger.js';
import { buildPrincipal, requireAuthorization, createResource } from '../../cerbos/index.js';
import { DocumentStatusSchema } from '$lib/schemas/index.js';

const log = createModuleLogger('DocumentProcessingRoute');

/**
 * Helper to check staff permissions via Cerbos
 */
async function requireStaffPermission(context: any, action: string, errors: any) {
    const principal = buildPrincipal(
        context.user!,
        context.orgRoles ?? {},
        undefined,
        undefined,
        undefined,
        context.staffRoles,
        context.pillarAccess
    );
    const resource = createResource('document_processing', 'global', 'global');
    try {
        await requireAuthorization(principal, resource, action);
    } catch (error) {
        throw errors.FORBIDDEN({
            message: error instanceof Error ? error.message : 'Staff permission denied'
        });
    }
}

export const documentProcessingRouter = {
    /**
     * Get DPQ statistics and metrics
     */
    getQueueStats: authedProcedure
        .output(
            z.object({
                ok: z.literal(true),
                data: z.array(z.object({
                    metric_name: z.string(),
                    metric_value: z.string().transform((v) => parseInt(v, 10))
                })),
                meta: z.any()
            })
        )
        .handler(async ({ context, errors }) => {
            await requireStaffPermission(context, 'view_stats', errors);

            const stats = await prisma.$queryRaw<any[]>`
				SELECT * FROM get_processing_queue_stats()
			`;

            return successResponse(stats, context);
        }),

    /**
     * List documents in the queue with various filters
     */
    listQueue: authedProcedure
        .input(
            PaginationInputSchema.extend({
                status: DocumentStatusSchema.optional(),
                view: z.enum(['processing', 'auto-retry', 'needs-attention', 'infected', 'history']).optional(),
                organizationId: z.string().optional()
            })
        )
        .handler(async ({ input, context, errors }) => {
            await requireStaffPermission(context, 'view_queue', errors);

            const limit = input.limit ?? 50;
            const offset = 0;

            // Map view to SQL filters
            let status = input.status || null;
            let errorTypeFilter: string | null = null;

            if (input.view === 'processing') status = 'PROCESSING';
            if (input.view === 'infected') status = 'INFECTED';
            if (input.view === 'history') status = 'ACTIVE';

            // For needs-attention and auto-retry, we use the same status but different logic in SQL
            // However, the current list_documents_admin is simple. 
            // We'll pass the view to a new SQL function or handle it with more complex where clause.

            const documents = await prisma.$queryRaw<any[]>`
				SELECT * FROM list_documents_admin_v2(
					${status},
					${input.view || null},
					${input.organizationId || null},
					${limit},
					${offset}
				)
			`;

            return successResponse({
                documents,
                pagination: {
                    nextCursor: null,
                    hasMore: documents.length >= limit
                }
            }, context);
        }),

    /**
     * Get DPQ global settings
     */
    getSettings: authedProcedure
        .handler(async ({ context, errors }) => {
            await requireStaffPermission(context, 'view_settings', errors);

            const setting = await prisma.systemSetting.findUnique({
                where: { key: 'dpq_settings' }
            });

            return successResponse(setting?.value || {}, context);
        }),

    /**
     * Update DPQ global settings
     */
    updateSettings: authedProcedure
        .input(z.object({
            autoRetryEnabled: z.boolean(),
            maxRetryAttempts: z.number().int().min(0),
            retryIntervalSeconds: z.number().int().min(30),
            retryBackoffMultiplier: z.number().min(1),
            infectedRetentionDays: z.number().int().min(1)
        }))
        .handler(async ({ input, context, errors }) => {
            await requireStaffPermission(context, 'update_settings', errors);

            const setting = await prisma.systemSetting.upsert({
                where: { key: 'dpq_settings' },
                create: {
                    key: 'dpq_settings',
                    value: input as any,
                    updatedBy: context.user!.id
                },
                update: {
                    value: input as any,
                    updatedBy: context.user!.id
                }
            });

            log.info('DPQ settings updated', { userId: context.user!.id, settings: input });

            return successResponse(setting.value, context);
        }),

    /**
     * Manually retry a failed document
     */
    retryDocument: authedProcedure
        .input(z.object({
            documentId: z.string()
        }))
        .handler(async ({ input, context, errors }) => {
            await requireStaffPermission(context, 'retry', errors);

            // Logic to reset status and trigger workflow would go here
            // For now, just update the status via the SECURITY DEFINER function
            const result = await prisma.$queryRaw<any[]>`
				SELECT update_document_processing_status(
					${input.documentId},
					'PENDING_UPLOAD',
					NULL,
					NULL,
					NULL,
					NOW()
				)
			`;

            log.info('Document manually queued for retry', { documentId: input.documentId, userId: context.user!.id });

            return successResponse({ success: !!result[0] }, context);
        })
};
