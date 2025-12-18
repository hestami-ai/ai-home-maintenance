import { z } from 'zod';
import { ResponseMetaSchema } from '../../schemas.js';
import {
	orgProcedure,
	successResponse,
	IdempotencyKeySchema,
	PaginationInputSchema,
	PaginationOutputSchema
} from '../../router.js';
import { prisma } from '../../../db.js';
import { withIdempotency } from '../../middleware/idempotency.js';
import { ApiException } from '../../errors.js';
import { assertContractorOrg } from '../contractor/utils.js';

const syncQueueItemOutput = z.object({
	id: z.string(),
	organizationId: z.string(),
	technicianId: z.string(),
	entityType: z.string(),
	entityId: z.string(),
	action: z.string(),
	payload: z.any(),
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
					payload: z.any() // Full record data
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ queueItem: syncQueueItemOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('create', 'offline_sync_queue', 'new');

			// Validate technician
			const tech = await prisma.technician.findFirst({
				where: { id: input.technicianId, organizationId: context.organization!.id }
			});
			if (!tech) throw ApiException.notFound('Technician');

			const queueItem = async () => {
				return prisma.offlineSyncQueue.create({
					data: {
						organizationId: context.organization!.id,
						technicianId: input.technicianId,
						entityType: input.entityType,
						entityId: input.entityId,
						action: input.action,
						payload: input.payload
					}
				});
			};

			const item = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, queueItem)).result
				: await queueItem();

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
							payload: z.any()
						})
					)
				})
				.merge(IdempotencyKeySchema)
		)
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
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('create', 'offline_sync_queue', 'new');

			// Validate technician
			const tech = await prisma.technician.findFirst({
				where: { id: input.technicianId, organizationId: context.organization!.id }
			});
			if (!tech) throw ApiException.notFound('Technician');

			const batchQueue = async () => {
				const created = await prisma.$transaction(
					input.items.map((item) =>
						prisma.offlineSyncQueue.create({
							data: {
								organizationId: context.organization!.id,
								technicianId: input.technicianId,
								entityType: item.entityType,
								entityId: item.entityId,
								action: item.action,
								payload: item.payload
							}
						})
					)
				);
				return created;
			};

			const items = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, batchQueue)).result
				: await batchQueue();

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
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
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
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ queueItem: syncQueueItemOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('sync', 'offline_sync_queue', input.queueItemId);

			const existing = await prisma.offlineSyncQueue.findFirst({
				where: { id: input.queueItemId, organizationId: context.organization!.id }
			});
			if (!existing) throw ApiException.notFound('Queue item');

			const markSynced = async () => {
				return prisma.offlineSyncQueue.update({
					where: { id: input.queueItemId },
					data: {
						isSynced: true,
						syncedAt: new Date(),
						syncedId: input.syncedId
					}
				});
			};

			const item = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, markSynced)).result
				: await markSynced();

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
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ queueItem: syncQueueItemOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);

			const existing = await prisma.offlineSyncQueue.findFirst({
				where: { id: input.queueItemId, organizationId: context.organization!.id }
			});
			if (!existing) throw ApiException.notFound('Queue item');

			const markFailed = async () => {
				return prisma.offlineSyncQueue.update({
					where: { id: input.queueItemId },
					data: {
						attempts: existing.attempts + 1,
						lastAttemptAt: new Date(),
						errorMessage: input.errorMessage
					}
				});
			};

			const item = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, markFailed)).result
				: await markFailed();

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
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ deletedCount: z.number() }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('delete', 'offline_sync_queue', input.technicianId);

			const cutoffDate = new Date();
			cutoffDate.setDate(cutoffDate.getDate() - input.olderThanDays);

			const clearSynced = async () => {
				const result = await prisma.offlineSyncQueue.deleteMany({
					where: {
						organizationId: context.organization!.id,
						technicianId: input.technicianId,
						isSynced: true,
						syncedAt: { lt: cutoffDate }
					}
				});
				return { deletedCount: result.count };
			};

			const result = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, clearSynced)).result
				: await clearSynced();

			return successResponse(result, context);
		})
};
