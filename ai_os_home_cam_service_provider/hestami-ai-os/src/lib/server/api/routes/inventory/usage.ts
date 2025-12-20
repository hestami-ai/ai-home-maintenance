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
import { startUsageWorkflow } from '../../../workflows/usageWorkflow.js';

const materialUsageOutput = z.object({
	id: z.string(),
	organizationId: z.string(),
	jobId: z.string(),
	jobVisitId: z.string().nullable(),
	itemId: z.string(),
	locationId: z.string(),
	quantity: z.number(),
	unitCost: z.string(),
	totalCost: z.string(),
	lotNumber: z.string().nullable(),
	serialNumber: z.string().nullable(),
	usedAt: z.string(),
	usedBy: z.string(),
	notes: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string()
});

const formatMaterialUsage = (u: any) => ({
	id: u.id,
	organizationId: u.organizationId,
	jobId: u.jobId,
	jobVisitId: u.jobVisitId,
	itemId: u.itemId,
	locationId: u.locationId,
	quantity: u.quantity,
	unitCost: u.unitCost.toString(),
	totalCost: u.totalCost.toString(),
	lotNumber: u.lotNumber,
	serialNumber: u.serialNumber,
	usedAt: u.usedAt.toISOString(),
	usedBy: u.usedBy,
	notes: u.notes,
	createdAt: u.createdAt.toISOString(),
	updatedAt: u.updatedAt.toISOString()
});

export const usageRouter = {
	/**
	 * Record material usage on a job
	 */
	record: orgProcedure
		.input(
			z
				.object({
					jobId: z.string(),
					jobVisitId: z.string().optional(),
					itemId: z.string(),
					locationId: z.string(),
					quantity: z.number().int().positive(),
					lotNumber: z.string().optional(),
					serialNumber: z.string().optional(),
					notes: z.string().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ usage: materialUsageOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('create', 'material_usage', 'new');

			// Validate job
			const job = await prisma.job.findFirst({
				where: { id: input.jobId, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!job) throw ApiException.notFound('Job');

			// Validate item
			const item = await prisma.inventoryItem.findFirst({
				where: { id: input.itemId, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!item) throw ApiException.notFound('Inventory item');

			// Validate location
			const location = await prisma.inventoryLocation.findFirst({
				where: { id: input.locationId, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!location) throw ApiException.notFound('Inventory location');

			// Use DBOS workflow for durable execution
			const result = await startUsageWorkflow(
				{
					action: 'RECORD_USAGE',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					data: {
						itemId: input.itemId,
						locationId: input.locationId,
						quantity: input.quantity,
						jobId: input.jobId,
						jobVisitId: input.jobVisitId,
						lotNumber: input.lotNumber,
						serialNumber: input.serialNumber,
						unitCost: Number(item.unitCost),
						notes: input.notes
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw ApiException.internal(result.error || 'Failed to record usage');
			}

			const usage = await prisma.materialUsage.findUniqueOrThrow({
				where: { id: result.entityId }
			});

			return successResponse({ usage: formatMaterialUsage(usage) }, context);
		}),

	/**
	 * Get usage by ID
	 */
	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ usage: materialUsageOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('view', 'material_usage', input.id);

			const usage = await prisma.materialUsage.findFirst({
				where: { id: input.id, organizationId: context.organization!.id }
			});

			if (!usage) throw ApiException.notFound('Material usage');

			return successResponse({ usage: formatMaterialUsage(usage) }, context);
		}),

	/**
	 * List usage records
	 */
	list: orgProcedure
		.input(
			z
				.object({
					jobId: z.string().optional(),
					jobVisitId: z.string().optional(),
					itemId: z.string().optional(),
					locationId: z.string().optional(),
					startDate: z.string().datetime().optional(),
					endDate: z.string().datetime().optional()
				})
				.merge(PaginationInputSchema)
				.optional()
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					usages: z.array(materialUsageOutput),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('view', 'material_usage', 'list');

			const limit = input?.limit ?? 20;
			const cursor = input?.cursor;

			const where: any = {
				organizationId: context.organization!.id,
				...(input?.jobId && { jobId: input.jobId }),
				...(input?.jobVisitId && { jobVisitId: input.jobVisitId }),
				...(input?.itemId && { itemId: input.itemId }),
				...(input?.locationId && { locationId: input.locationId })
			};

			if (input?.startDate || input?.endDate) {
				where.usedAt = {};
				if (input.startDate) where.usedAt.gte = new Date(input.startDate);
				if (input.endDate) where.usedAt.lte = new Date(input.endDate);
			}

			const usages = await prisma.materialUsage.findMany({
				where,
				take: limit + 1,
				...(cursor && { cursor: { id: cursor }, skip: 1 }),
				orderBy: { usedAt: 'desc' }
			});

			const hasMore = usages.length > limit;
			if (hasMore) usages.pop();

			const nextCursor = hasMore ? usages[usages.length - 1]?.id ?? null : null;

			return successResponse(
				{
					usages: usages.map(formatMaterialUsage),
					pagination: { nextCursor, hasMore }
				},
				context
			);
		}),

	/**
	 * Get job material cost summary
	 */
	getJobSummary: orgProcedure
		.input(z.object({ jobId: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					usages: z.array(materialUsageOutput),
					totalCost: z.string(),
					itemCount: z.number()
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('view', 'material_usage', 'list');

			// Verify job
			const job = await prisma.job.findFirst({
				where: { id: input.jobId, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!job) throw ApiException.notFound('Job');

			const usages = await prisma.materialUsage.findMany({
				where: { jobId: input.jobId },
				orderBy: { usedAt: 'desc' }
			});

			const totalCost = usages.reduce((sum, u) => sum + Number(u.totalCost), 0);

			return successResponse(
				{
					usages: usages.map(formatMaterialUsage),
					totalCost: totalCost.toFixed(2),
					itemCount: usages.length
				},
				context
			);
		}),

	/**
	 * Reverse/undo a usage record (return to stock)
	 */
	reverse: orgProcedure
		.input(z.object({ id: z.string(), reason: z.string().optional() }).merge(IdempotencyKeySchema))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ reversed: z.boolean() }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('delete', 'material_usage', input.id);

			const existing = await prisma.materialUsage.findFirst({
				where: { id: input.id, organizationId: context.organization!.id }
			});
			if (!existing) throw ApiException.notFound('Material usage');

			// Use DBOS workflow for durable execution
			const result = await startUsageWorkflow(
				{
					action: 'REVERSE_USAGE',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					usageId: input.id,
					data: {}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw ApiException.internal(result.error || 'Failed to reverse usage');
			}

			return successResponse({ reversed: true }, context);
		})
};
