import { z } from 'zod';
import { ResponseMetaSchema, JsonSchema } from '$lib/schemas/index.js';
import {
	orgProcedure,
	successResponse,
	IdempotencyKeySchema,
	PaginationInputSchema,
	PaginationOutputSchema
} from '../../router.js';
import { prisma } from '../../../db.js';
import { assertContractorOrg } from '../contractor/utils.js';
import { startOfflineSyncWorkflow } from '../../../workflows/offlineSyncWorkflow.js';

const syncQueueItemOutput = z.object({
	id: z.string(),
	organizationId: z.string(),
	technicianId: z.string(),
	entityType: z.string(),
	entityId: z.string(),
	action: z.string(),
	payload: JsonSchema,
	attempts: z.number(),
	lastAttemptAt: z.string().nullable(),
	errorMessage: z.string().nullable(),
	isSynced: z.boolean(),
	syncedAt: z.string().nullable(),
	syncedId: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string()
});

const formatSyncQueueItem = (q: any) => ({
	id: q.id,
	organizationId: q.organizationId,
	technicianId: q.technicianId,
	entityType: q.entityType,
	entityId: q.entityId,
	action: q.action,
	payload: q.payload,
	attempts: q.attempts,
	lastAttemptAt: q.lastAttemptAt?.toISOString() ?? null,
	errorMessage: q.errorMessage,
	isSynced: q.isSynced,
	syncedAt: q.syncedAt?.toISOString() ?? null,
	syncedId: q.syncedId,
	createdAt: q.createdAt.toISOString(),
	updatedAt: q.updatedAt.toISOString()
});

export const offlineSyncRouter = {
	/**
	 * Queue an offline record for sync
	 */
	queue: orgProcedure
		.input(
			z
				.object({
					technicianId: z.string(),
					entityType: z.string(), // JobTimeEntry, JobMedia, JobStep, etc.
					entityId: z.string(), // Local/client-side ID
					action: z.enum(['CREATE', 'UPDATE', 'DELETE']),
					payload: JsonSchema // Full record data
				})
				.merge(IdempotencyKeySchema)
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ queueItem: syncQueueItemOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('create', 'offline_sync_queue', 'new');

			// Validate technician
			const tech = await prisma.technician.findFirst({
				where: { id: input.technicianId, organizationId: context.organization!.id }
			});
			if (!tech) throw errors.NOT_FOUND({ message: 'Technician not found' });

			// Use DBOS workflow for durable execution
			const result = await startOfflineSyncWorkflow(
				{
					action: 'QUEUE_ITEM',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					data: {
						technicianId: input.technicianId,
						entityType: input.entityType,
						entityId: input.entityId,
						action: input.action,
						payload: input.payload
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to queue item' });
			}

			const item = await prisma.offlineSyncQueue.findFirstOrThrow({
				where: { id: result.entityId, organizationId: context.organization.id }
			});

			return successResponse({ queueItem: formatSyncQueueItem(item) }, context);
		}),

	/**
	 * Batch queue multiple offline records
	 */
	batchQueue: orgProcedure
		.input(
			z
				.object({
					technicianId: z.string(),
					items: z.array(
						z.object({
							entityType: z.string(),
							entityId: z.string(),
							action: z.enum(['CREATE', 'UPDATE', 'DELETE']),
							payload: JsonSchema
						})
					)
				})
				.merge(IdempotencyKeySchema)
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					queuedCount: z.number(),
					queueItems: z.array(syncQueueItemOutput)
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('create', 'offline_sync_queue', 'new');

			// Validate technician
			const tech = await prisma.technician.findFirst({
				where: { id: input.technicianId, organizationId: context.organization!.id }
			});
			if (!tech) throw errors.NOT_FOUND({ message: 'Technician not found' });

			// Use DBOS workflow for durable execution
			const result = await startOfflineSyncWorkflow(
				{
					action: 'BATCH_QUEUE',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					data: {
						technicianId: input.technicianId,
						items: input.items
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to batch queue items' });
			}

			const items = await prisma.offlineSyncQueue.findMany({
				where: { id: { in: result.entityIds } }
			});

			return successResponse(
				{
					queuedCount: items.length,
					queueItems: items.map(formatSyncQueueItem)
				},
				context
			);
		}),

	/**
	 * Get pending sync items for a technician
	 */
	getPending: orgProcedure
		.input(
			z
				.object({
					technicianId: z.string(),
					entityType: z.string().optional()
				})
				.merge(PaginationInputSchema)
		)
		.errors({
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					queueItems: z.array(syncQueueItemOutput),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('view', 'offline_sync_queue', input.technicianId);

			const limit = input.limit ?? 100;
			const cursor = input.cursor;

			const where = {
				organizationId: context.organization!.id,
				technicianId: input.technicianId,
				isSynced: false,
				...(input.entityType && { entityType: input.entityType })
			};

			const items = await prisma.offlineSyncQueue.findMany({
				where,
				take: limit + 1,
				...(cursor && { cursor: { id: cursor }, skip: 1 }),
				orderBy: { createdAt: 'asc' }
			});

			const hasMore = items.length > limit;
			if (hasMore) items.pop();

			const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

			return successResponse(
				{
					queueItems: items.map(formatSyncQueueItem),
					pagination: { nextCursor, hasMore }
				},
				context
			);
		}),

	/**
	 * Process/sync a queued item (mark as synced with server ID)
	 */
	markSynced: orgProcedure
		.input(
			z
				.object({
					queueItemId: z.string(),
					syncedId: z.string() // Server-side ID of the created/updated record
				})
				.merge(IdempotencyKeySchema)
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ queueItem: syncQueueItemOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('sync', 'offline_sync_queue', input.queueItemId);

			const existing = await prisma.offlineSyncQueue.findFirst({
				where: { id: input.queueItemId, organizationId: context.organization!.id }
			});
			if (!existing) throw errors.NOT_FOUND({ message: 'Queue item not found' });

			// Use DBOS workflow for durable execution
			const result = await startOfflineSyncWorkflow(
				{
					action: 'MARK_SYNCED',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					queueItemId: input.queueItemId,
					data: { syncedId: input.syncedId }
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to mark item as synced' });
			}

			const item = await prisma.offlineSyncQueue.findFirstOrThrow({
				where: { id: result.entityId, organizationId: context.organization.id }
			});

			return successResponse({ queueItem: formatSyncQueueItem(item) }, context);
		}),

	/**
	 * Mark sync attempt failed
	 */
	markFailed: orgProcedure
		.input(
			z
				.object({
					queueItemId: z.string(),
					errorMessage: z.string()
				})
				.merge(IdempotencyKeySchema)
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ queueItem: syncQueueItemOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('sync', 'offline_sync_queue', input.queueItemId);

			const existing = await prisma.offlineSyncQueue.findFirst({
				where: { id: input.queueItemId, organizationId: context.organization!.id }
			});
			if (!existing) throw errors.NOT_FOUND({ message: 'Queue item not found' });

			// Use DBOS workflow for durable execution
			const result = await startOfflineSyncWorkflow(
				{
					action: 'MARK_FAILED',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					queueItemId: input.queueItemId,
					data: {
						existingAttempts: existing.attempts,
						errorMessage: input.errorMessage
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to mark item as failed' });
			}

			const item = await prisma.offlineSyncQueue.findFirstOrThrow({
				where: { id: result.entityId, organizationId: context.organization.id }
			});

			return successResponse({ queueItem: formatSyncQueueItem(item) }, context);
		}),

	/**
	 * Clear synced items (cleanup)
	 */
	clearSynced: orgProcedure
		.input(
			z
				.object({
					technicianId: z.string(),
					olderThanDays: z.number().int().positive().default(7)
				})
				.merge(IdempotencyKeySchema)
		)
		.errors({
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ deletedCount: z.number() }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('delete', 'offline_sync_queue', input.technicianId);

			const cutoffDate = new Date();
			cutoffDate.setDate(cutoffDate.getDate() - input.olderThanDays);

			// Use DBOS workflow for durable execution
			const result = await startOfflineSyncWorkflow(
				{
					action: 'CLEAR_SYNCED',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					data: {
						technicianId: input.technicianId,
						cutoffDate: cutoffDate.toISOString()
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to clear synced items' });
			}

			return successResponse({ deletedCount: result.deletedCount ?? 0 }, context);
		})
};
