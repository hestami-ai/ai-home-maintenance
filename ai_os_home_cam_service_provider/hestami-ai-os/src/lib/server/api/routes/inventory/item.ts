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
import { ApiException } from '../../errors.js';
import { assertContractorOrg } from '../contractor/utils.js';
import { UnitOfMeasure } from '../../../../../../generated/prisma/client.js';
import { startInventoryItemWorkflow } from '../../../workflows/inventoryItemWorkflow.js';

const inventoryItemOutput = z.object({
	id: z.string(),
	organizationId: z.string(),
	sku: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	category: z.string().nullable(),
	unitOfMeasure: z.nativeEnum(UnitOfMeasure),
	unitCost: z.string(),
	reorderPoint: z.number(),
	reorderQuantity: z.number(),
	minStockLevel: z.number(),
	maxStockLevel: z.number().nullable(),
	isSerialTracked: z.boolean(),
	isLotTracked: z.boolean(),
	preferredSupplierId: z.string().nullable(),
	pricebookItemId: z.string().nullable(),
	isActive: z.boolean(),
	createdAt: z.string(),
	updatedAt: z.string()
});

const formatInventoryItem = (i: any) => ({
	id: i.id,
	organizationId: i.organizationId,
	sku: i.sku,
	name: i.name,
	description: i.description,
	category: i.category,
	unitOfMeasure: i.unitOfMeasure,
	unitCost: i.unitCost.toString(),
	reorderPoint: i.reorderPoint,
	reorderQuantity: i.reorderQuantity,
	minStockLevel: i.minStockLevel,
	maxStockLevel: i.maxStockLevel,
	isSerialTracked: i.isSerialTracked,
	isLotTracked: i.isLotTracked,
	preferredSupplierId: i.preferredSupplierId,
	pricebookItemId: i.pricebookItemId,
	isActive: i.isActive,
	createdAt: i.createdAt.toISOString(),
	updatedAt: i.updatedAt.toISOString()
});

export const inventoryItemRouter = {
	create: orgProcedure
		.input(
			z
				.object({
					sku: z.string().min(1),
					name: z.string().min(1),
					description: z.string().optional(),
					category: z.string().optional(),
					unitOfMeasure: z.nativeEnum(UnitOfMeasure).default(UnitOfMeasure.EACH),
					unitCost: z.number().nonnegative().default(0),
					reorderPoint: z.number().int().nonnegative().default(0),
					reorderQuantity: z.number().int().nonnegative().default(0),
					minStockLevel: z.number().int().nonnegative().default(0),
					maxStockLevel: z.number().int().positive().optional(),
					isSerialTracked: z.boolean().default(false),
					isLotTracked: z.boolean().default(false),
					preferredSupplierId: z.string().optional(),
					pricebookItemId: z.string().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ item: inventoryItemOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('create', 'inventory_item', 'new');

			// Use DBOS workflow for durable execution
			const result = await startInventoryItemWorkflow(
				{
					action: 'CREATE_ITEM',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					data: {
						sku: input.sku,
						name: input.name,
						description: input.description,
						category: input.category,
						unitOfMeasure: input.unitOfMeasure,
						unitCost: input.unitCost,
						reorderPoint: input.reorderPoint,
						reorderQuantity: input.reorderQuantity,
						minStockLevel: input.minStockLevel,
						maxStockLevel: input.maxStockLevel,
						isSerialTracked: input.isSerialTracked,
						isLotTracked: input.isLotTracked,
						preferredSupplierId: input.preferredSupplierId,
						pricebookItemId: input.pricebookItemId
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw ApiException.internal(result.error || 'Failed to create item');
			}

			const item = await prisma.inventoryItem.findUniqueOrThrow({
				where: { id: result.entityId }
			});

			return successResponse({ item: formatInventoryItem(item) }, context);
		}),

	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ item: inventoryItemOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('view', 'inventory_item', input.id);

			const item = await prisma.inventoryItem.findFirst({
				where: { id: input.id, organizationId: context.organization!.id, deletedAt: null }
			});

			if (!item) throw ApiException.notFound('Inventory item');

			return successResponse({ item: formatInventoryItem(item) }, context);
		}),

	list: orgProcedure
		.input(
			z
				.object({
					category: z.string().optional(),
					isActive: z.boolean().optional(),
					lowStock: z.boolean().optional(),
					search: z.string().optional()
				})
				.merge(PaginationInputSchema)
				.optional()
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					items: z.array(inventoryItemOutput),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('view', 'inventory_item', 'list');

			const limit = input?.limit ?? 20;
			const cursor = input?.cursor;

			const where: any = {
				organizationId: context.organization!.id,
				deletedAt: null,
				...(input?.category && { category: input.category }),
				...(input?.isActive !== undefined && { isActive: input.isActive })
			};

			if (input?.search) {
				where.OR = [
					{ sku: { contains: input.search, mode: 'insensitive' } },
					{ name: { contains: input.search, mode: 'insensitive' } }
				];
			}

			const items = await prisma.inventoryItem.findMany({
				where,
				take: limit + 1,
				...(cursor && { cursor: { id: cursor }, skip: 1 }),
				orderBy: { name: 'asc' }
			});

			const hasMore = items.length > limit;
			if (hasMore) items.pop();

			const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

			return successResponse(
				{
					items: items.map(formatInventoryItem),
					pagination: { nextCursor, hasMore }
				},
				context
			);
		}),

	update: orgProcedure
		.input(
			z
				.object({
					id: z.string(),
					name: z.string().min(1).optional(),
					description: z.string().nullable().optional(),
					category: z.string().nullable().optional(),
					unitOfMeasure: z.nativeEnum(UnitOfMeasure).optional(),
					unitCost: z.number().nonnegative().optional(),
					reorderPoint: z.number().int().nonnegative().optional(),
					reorderQuantity: z.number().int().nonnegative().optional(),
					minStockLevel: z.number().int().nonnegative().optional(),
					maxStockLevel: z.number().int().positive().nullable().optional(),
					isSerialTracked: z.boolean().optional(),
					isLotTracked: z.boolean().optional(),
					preferredSupplierId: z.string().nullable().optional(),
					pricebookItemId: z.string().nullable().optional(),
					isActive: z.boolean().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ item: inventoryItemOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('edit', 'inventory_item', input.id);

			const existing = await prisma.inventoryItem.findFirst({
				where: { id: input.id, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!existing) throw ApiException.notFound('Inventory item');

			const { id, idempotencyKey, ...data } = input;

			// Use DBOS workflow for durable execution
			const result = await startInventoryItemWorkflow(
				{
					action: 'UPDATE_ITEM',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					itemId: input.id,
					data
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw ApiException.internal(result.error || 'Failed to update item');
			}

			const item = await prisma.inventoryItem.findUniqueOrThrow({
				where: { id: result.entityId }
			});

			return successResponse({ item: formatInventoryItem(item) }, context);
		}),

	delete: orgProcedure
		.input(z.object({ id: z.string() }).merge(IdempotencyKeySchema))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ deleted: z.boolean() }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('delete', 'inventory_item', input.id);

			const existing = await prisma.inventoryItem.findFirst({
				where: { id: input.id, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!existing) throw ApiException.notFound('Inventory item');

			// Use DBOS workflow for durable execution
			const result = await startInventoryItemWorkflow(
				{
					action: 'DELETE_ITEM',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					itemId: input.id,
					data: {}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw ApiException.internal(result.error || 'Failed to delete item');
			}

			return successResponse({ deleted: true }, context);
		}),

	getLowStock: orgProcedure
		.input(PaginationInputSchema.optional())
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					items: z.array(
						inventoryItemOutput.extend({
							totalOnHand: z.number(),
							totalAvailable: z.number()
						})
					),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('view', 'inventory_item', 'list');

			const limit = input?.limit ?? 20;

			// Get items with aggregated stock levels below reorder point
			const items = await prisma.$queryRaw<any[]>`
				SELECT 
					i.*,
					COALESCE(SUM(l.quantity_on_hand), 0)::int as total_on_hand,
					COALESCE(SUM(l.quantity_available), 0)::int as total_available
				FROM inventory_items i
				LEFT JOIN inventory_levels l ON l.item_id = i.id
				WHERE i.organization_id = ${context.organization!.id}
					AND i.deleted_at IS NULL
					AND i.is_active = true
				GROUP BY i.id
				HAVING COALESCE(SUM(l.quantity_on_hand), 0) <= i.reorder_point
				ORDER BY (i.reorder_point - COALESCE(SUM(l.quantity_on_hand), 0)) DESC
				LIMIT ${limit}
			`;

			return successResponse(
				{
					items: items.map((i) => ({
						...formatInventoryItem(i),
						totalOnHand: Number(i.total_on_hand),
						totalAvailable: Number(i.total_available)
					})),
					pagination: { nextCursor: null, hasMore: false }
				},
				context
			);
		})
};
