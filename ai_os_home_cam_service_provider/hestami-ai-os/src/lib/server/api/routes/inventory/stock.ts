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
import { startStockWorkflow } from '../../../workflows/stockWorkflow.js';

const inventoryLevelOutput = z.object({
	id: z.string(),
	itemId: z.string(),
	locationId: z.string(),
	quantityOnHand: z.number(),
	quantityReserved: z.number(),
	quantityAvailable: z.number(),
	lotNumber: z.string().nullable(),
	serialNumber: z.string().nullable(),
	expirationDate: z.string().nullable(),
	lastCountedAt: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string()
});

const formatInventoryLevel = (l: any) => ({
	id: l.id,
	itemId: l.itemId,
	locationId: l.locationId,
	quantityOnHand: l.quantityOnHand,
	quantityReserved: l.quantityReserved,
	quantityAvailable: l.quantityAvailable,
	lotNumber: l.lotNumber,
	serialNumber: l.serialNumber,
	expirationDate: l.expirationDate?.toISOString() ?? null,
	lastCountedAt: l.lastCountedAt?.toISOString() ?? null,
	createdAt: l.createdAt.toISOString(),
	updatedAt: l.updatedAt.toISOString()
});

export const stockRouter = {
	/**
	 * Get stock levels for an item across all locations
	 */
	getItemStock: orgProcedure
		.input(z.object({ itemId: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					levels: z.array(inventoryLevelOutput),
					totalOnHand: z.number(),
					totalReserved: z.number(),
					totalAvailable: z.number()
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('view', 'inventory_level', 'list');

			// Verify item belongs to org
			const item = await prisma.inventoryItem.findFirst({
				where: { id: input.itemId, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!item) throw ApiException.notFound('Inventory item');

			const levels = await prisma.inventoryLevel.findMany({
				where: { itemId: input.itemId },
				orderBy: { locationId: 'asc' }
			});

			const totals = levels.reduce(
				(acc, l) => ({
					totalOnHand: acc.totalOnHand + l.quantityOnHand,
					totalReserved: acc.totalReserved + l.quantityReserved,
					totalAvailable: acc.totalAvailable + l.quantityAvailable
				}),
				{ totalOnHand: 0, totalReserved: 0, totalAvailable: 0 }
			);

			return successResponse(
				{
					levels: levels.map(formatInventoryLevel),
					...totals
				},
				context
			);
		}),

	/**
	 * Get stock levels at a location
	 */
	getLocationStock: orgProcedure
		.input(
			z
				.object({
					locationId: z.string(),
					lowStockOnly: z.boolean().optional()
				})
				.merge(PaginationInputSchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					levels: z.array(inventoryLevelOutput),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('view', 'inventory_level', 'list');

			// Verify location belongs to org
			const location = await prisma.inventoryLocation.findFirst({
				where: { id: input.locationId, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!location) throw ApiException.notFound('Inventory location');

			const limit = input.limit ?? 20;
			const cursor = input.cursor;

			const levels = await prisma.inventoryLevel.findMany({
				where: { locationId: input.locationId },
				take: limit + 1,
				...(cursor && { cursor: { id: cursor }, skip: 1 }),
				orderBy: { itemId: 'asc' }
			});

			const hasMore = levels.length > limit;
			if (hasMore) levels.pop();

			const nextCursor = hasMore ? levels[levels.length - 1]?.id ?? null : null;

			return successResponse(
				{
					levels: levels.map(formatInventoryLevel),
					pagination: { nextCursor, hasMore }
				},
				context
			);
		}),

	/**
	 * Adjust stock (add/remove inventory)
	 */
	adjust: orgProcedure
		.input(
			z
				.object({
					itemId: z.string(),
					locationId: z.string(),
					adjustment: z.number().int(), // Positive to add, negative to remove
					reason: z.string().optional(),
					lotNumber: z.string().optional(),
					serialNumber: z.string().optional(),
					expirationDate: z.string().datetime().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ level: inventoryLevelOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('adjust', 'inventory_level', 'new');

			// Verify item and location belong to org
			const [item, location] = await Promise.all([
				prisma.inventoryItem.findFirst({
					where: { id: input.itemId, organizationId: context.organization!.id, deletedAt: null }
				}),
				prisma.inventoryLocation.findFirst({
					where: { id: input.locationId, organizationId: context.organization!.id, deletedAt: null }
				})
			]);
			if (!item) throw ApiException.notFound('Inventory item');
			if (!location) throw ApiException.notFound('Inventory location');

			// Use DBOS workflow for durable execution
			const result = await startStockWorkflow(
				{
					action: 'ADJUST_STOCK',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					itemId: input.itemId,
					data: {
						itemId: input.itemId,
						locationId: input.locationId,
						adjustment: input.adjustment,
						lotNumber: input.lotNumber,
						serialNumber: input.serialNumber,
						expirationDate: input.expirationDate
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw ApiException.internal(result.error || 'Failed to adjust stock');
			}

			const level = await prisma.inventoryLevel.findUniqueOrThrow({
				where: { id: result.entityId }
			});

			return successResponse({ level: formatInventoryLevel(level) }, context);
		}),

	/**
	 * Reserve stock for a job
	 */
	reserve: orgProcedure
		.input(
			z
				.object({
					itemId: z.string(),
					locationId: z.string(),
					quantity: z.number().int().positive(),
					jobId: z.string().optional(),
					lotNumber: z.string().optional(),
					serialNumber: z.string().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ level: inventoryLevelOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('adjust', 'inventory_level', 'new');

			// Use DBOS workflow for durable execution
			const result = await startStockWorkflow(
				{
					action: 'RESERVE_STOCK',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					itemId: input.itemId,
					data: {
						itemId: input.itemId,
						locationId: input.locationId,
						quantity: input.quantity,
						lotNumber: input.lotNumber,
						serialNumber: input.serialNumber
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw ApiException.internal(result.error || 'Failed to reserve stock');
			}

			const level = await prisma.inventoryLevel.findUniqueOrThrow({
				where: { id: result.entityId }
			});

			return successResponse({ level: formatInventoryLevel(level) }, context);
		}),

	/**
	 * Release reserved stock
	 */
	release: orgProcedure
		.input(
			z
				.object({
					itemId: z.string(),
					locationId: z.string(),
					quantity: z.number().int().positive(),
					lotNumber: z.string().optional(),
					serialNumber: z.string().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ level: inventoryLevelOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('adjust', 'inventory_level', 'new');

			// Use DBOS workflow for durable execution
			const result = await startStockWorkflow(
				{
					action: 'RELEASE_STOCK',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					itemId: input.itemId,
					data: {
						itemId: input.itemId,
						locationId: input.locationId,
						quantity: input.quantity,
						lotNumber: input.lotNumber,
						serialNumber: input.serialNumber
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw ApiException.internal(result.error || 'Failed to release stock');
			}

			const level = await prisma.inventoryLevel.findUniqueOrThrow({
				where: { id: result.entityId }
			});

			return successResponse({ level: formatInventoryLevel(level) }, context);
		}),

	/**
	 * Record physical count
	 */
	recordCount: orgProcedure
		.input(
			z
				.object({
					itemId: z.string(),
					locationId: z.string(),
					countedQuantity: z.number().int().nonnegative(),
					lotNumber: z.string().optional(),
					serialNumber: z.string().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					level: inventoryLevelOutput,
					variance: z.number()
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('adjust', 'inventory_level', 'new');

			// Get existing level to calculate variance
			const existingLevel = await prisma.inventoryLevel.findFirst({
				where: {
					itemId: input.itemId,
					locationId: input.locationId,
					lotNumber: input.lotNumber ?? null,
					serialNumber: input.serialNumber ?? null
				}
			});
			const previousOnHand = existingLevel?.quantityOnHand ?? 0;
			const variance = input.countedQuantity - previousOnHand;

			// Use DBOS workflow for durable execution
			const result = await startStockWorkflow(
				{
					action: 'RECORD_COUNT',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					itemId: input.itemId,
					levelId: existingLevel?.id,
					data: {
						itemId: input.itemId,
						locationId: input.locationId,
						countedQuantity: input.countedQuantity,
						lotNumber: input.lotNumber,
						serialNumber: input.serialNumber
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw ApiException.internal(result.error || 'Failed to record count');
			}

			const level = await prisma.inventoryLevel.findUniqueOrThrow({
				where: { id: result.entityId }
			});

			return successResponse(
				{
					level: formatInventoryLevel(level),
					variance
				},
				context
			);
		})
};
