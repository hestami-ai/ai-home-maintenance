import { z } from 'zod';
import { authedProcedure, successResponse, PaginationInputSchema } from '../router.js';
import { prisma } from '../../db.js';
import { createModuleLogger } from '../../logger.js';
import { buildPrincipal, requireAuthorization, createResource } from '../../cerbos/index.js';
import { DocumentStatusSchema } from '$lib/schemas/index.js';
import { DocumentStatus } from '../../../../../generated/prisma/enums.js';
import { startSystemSettingsWorkflow, SystemSettingsAction } from '../../workflows/systemSettingsWorkflow.js';

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
                    metric_value: z.union([z.number(), z.bigint()]).transform((v) => Number(v))
                })),
                meta: z.any()
            })
        )
        .errors({
            FORBIDDEN: { message: 'Access denied' },
            INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
        })
        .handler(async ({ context, errors }) => {
            log.debug('getQueueStats: Starting');
            await requireStaffPermission(context, 'view_stats', errors);

            log.debug('getQueueStats: Executing SQL query');
            const stats = await prisma.$queryRaw<any[]>`
				SELECT * FROM get_processing_queue_stats()
			`;
            log.debug('getQueueStats: Query complete', { count: stats.length });

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
        .errors({
            FORBIDDEN: { message: 'Access denied' },
            INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
        })
        .handler(async ({ input, context, errors }) => {
            log.debug('listQueue: Starting', { view: input.view });
            await requireStaffPermission(context, 'view_queue', errors);

            const limit = input.limit ?? 50;
            const offset = 0;

            // Map view to SQL filters
            let status = input.status || null;
            let errorTypeFilter: string | null = null;

            if (input.view === 'processing') status = DocumentStatus.PROCESSING;
            if (input.view === 'infected') status = DocumentStatus.INFECTED;
            if (input.view === 'history') status = DocumentStatus.ACTIVE;

            // For needs-attention and auto-retry, we use the same status but different logic in SQL
            // However, the current list_documents_admin is simple.
            // We'll pass the view to a new SQL function or handle it with more complex where clause.

            log.debug('listQueue: Executing SQL query', { status, view: input.view, limit });
            const documents = await prisma.$queryRaw<any[]>`
				SELECT * FROM list_documents_admin_v2(
					${status},
					${input.view || null},
					${input.organizationId || null},
					${limit},
					${offset}
				)
			`;
            log.debug('listQueue: Query complete', { count: documents.length });

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
        .errors({
            FORBIDDEN: { message: 'Access denied' },
            INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
        })
        .handler(async ({ context, errors }) => {
            log.debug('getSettings: Starting');
            await requireStaffPermission(context, 'view_settings', errors);

            log.debug('getSettings: Executing Prisma query');
            const setting = await prisma.systemSetting.findUnique({
                where: { key: 'dpq_settings' }
            });
            log.debug('getSettings: Query complete', { found: !!setting });

            return successResponse(setting?.value || {}, context);
        }),

    /**
     * Update DPQ global settings
     */
    updateSettings: authedProcedure
        .input(z.object({
            idempotencyKey: z.string().uuid(),
            autoRetryEnabled: z.boolean(),
            maxRetryAttempts: z.number().int().min(0),
            retryIntervalSeconds: z.number().int().min(30),
            retryBackoffMultiplier: z.number().min(1),
            infectedRetentionDays: z.number().int().min(1)
        }))
        .errors({
            FORBIDDEN: { message: 'Access denied' },
            INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
        })
        .handler(async ({ input, context, errors }) => {
            await requireStaffPermission(context, 'update_settings', errors);

            const { idempotencyKey, ...settingsData } = input;
            const result = await startSystemSettingsWorkflow(
                {
                    action: SystemSettingsAction.UPSERT_SETTING,
                    organizationId: context.organization!.id,
                    userId: context.user!.id,
                    data: {
                        key: 'dpq_settings',
                        value: settingsData as Record<string, unknown>
                    }
                },
                idempotencyKey
            );

            if (!result.success) {
                throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to update settings' });
            }

            log.info('DPQ settings updated', { userId: context.user!.id, settings: settingsData });

            return successResponse(settingsData, context);
        }),

    /**
     * Manually retry a failed document
     */
    retryDocument: authedProcedure
        .input(z.object({
            documentId: z.string()
        }))
        .errors({
            FORBIDDEN: { message: 'Access denied' },
            NOT_FOUND: { message: 'Document not found' },
            INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
        })
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
