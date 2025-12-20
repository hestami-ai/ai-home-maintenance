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
import { startContractSLAWorkflow } from '../../../workflows/contractSLAWorkflow.js';
import { ApiException } from '../../errors.js';
import { assertContractorOrg } from '../contractor/utils.js';

const slaRecordOutput = z.object({
	id: z.string(),
	contractId: z.string(),
	periodStart: z.string(),
	periodEnd: z.string(),
	totalRequests: z.number(),
	onTimeResponses: z.number(),
	onTimeResolutions: z.number(),
	missedSLAs: z.number(),
	responseCompliancePercent: z.string().nullable(),
	resolutionCompliancePercent: z.string().nullable(),
	avgResponseTimeMinutes: z.number().nullable(),
	avgResolutionTimeMinutes: z.number().nullable(),
	scheduledVisits: z.number(),
	completedVisits: z.number(),
	missedVisits: z.number(),
	visitCompliancePercent: z.string().nullable(),
	notes: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string()
});

const formatSLARecord = (r: any) => ({
	id: r.id,
	contractId: r.contractId,
	periodStart: r.periodStart.toISOString().split('T')[0],
	periodEnd: r.periodEnd.toISOString().split('T')[0],
	totalRequests: r.totalRequests,
	onTimeResponses: r.onTimeResponses,
	onTimeResolutions: r.onTimeResolutions,
	missedSLAs: r.missedSLAs,
	responseCompliancePercent: r.responseCompliancePercent?.toString() ?? null,
	resolutionCompliancePercent: r.resolutionCompliancePercent?.toString() ?? null,
	avgResponseTimeMinutes: r.avgResponseTimeMinutes,
	avgResolutionTimeMinutes: r.avgResolutionTimeMinutes,
	scheduledVisits: r.scheduledVisits,
	completedVisits: r.completedVisits,
	missedVisits: r.missedVisits,
	visitCompliancePercent: r.visitCompliancePercent?.toString() ?? null,
	notes: r.notes,
	createdAt: r.createdAt.toISOString(),
	updatedAt: r.updatedAt.toISOString()
});

export const contractSLARouter = {
	create: orgProcedure
		.input(
			z
				.object({
					contractId: z.string(),
					periodStart: z.string(),
					periodEnd: z.string(),
					totalRequests: z.number().int().nonnegative().default(0),
					onTimeResponses: z.number().int().nonnegative().default(0),
					onTimeResolutions: z.number().int().nonnegative().default(0),
					missedSLAs: z.number().int().nonnegative().default(0),
					avgResponseTimeMinutes: z.number().int().nonnegative().optional(),
					avgResolutionTimeMinutes: z.number().int().nonnegative().optional(),
					scheduledVisits: z.number().int().nonnegative().default(0),
					completedVisits: z.number().int().nonnegative().default(0),
					missedVisits: z.number().int().nonnegative().default(0),
					notes: z.string().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ slaRecord: slaRecordOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('create', 'contract_sla_record', 'new');

			const contract = await prisma.serviceContract.findFirst({
				where: { id: input.contractId, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!contract) throw ApiException.notFound('Service contract');

			// Use DBOS workflow for durable execution
			const result = await startContractSLAWorkflow(
				{
					action: 'CREATE_SLA',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					data: {
						contractId: input.contractId,
						periodStart: input.periodStart,
						periodEnd: input.periodEnd,
						totalRequests: input.totalRequests,
						onTimeResponses: input.onTimeResponses,
						onTimeResolutions: input.onTimeResolutions,
						missedSLAs: input.missedSLAs,
						avgResponseTimeMinutes: input.avgResponseTimeMinutes,
						avgResolutionTimeMinutes: input.avgResolutionTimeMinutes,
						scheduledVisits: input.scheduledVisits,
						completedVisits: input.completedVisits,
						missedVisits: input.missedVisits,
						notes: input.notes
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw ApiException.internal(result.error || 'Failed to create SLA record');
			}

			const slaRecord = await prisma.contractSLARecord.findUniqueOrThrow({ where: { id: result.entityId } });

			return successResponse({ slaRecord: formatSLARecord(slaRecord) }, context);
		}),

	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ slaRecord: slaRecordOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('view', 'contract_sla_record', input.id);

			const record = await prisma.contractSLARecord.findUnique({
				where: { id: input.id },
				include: { contract: true }
			});

			if (!record || record.contract.organizationId !== context.organization!.id) {
				throw ApiException.notFound('SLA record');
			}

			return successResponse({ slaRecord: formatSLARecord(record) }, context);
		}),

	list: orgProcedure
		.input(
			z
				.object({
					contractId: z.string().optional(),
					startDate: z.string().optional(),
					endDate: z.string().optional()
				})
				.merge(PaginationInputSchema)
				.optional()
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					slaRecords: z.array(slaRecordOutput),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('view', 'contract_sla_record', 'list');

			const limit = input?.limit ?? 20;
			const cursor = input?.cursor;

			const where: any = {
				contract: { organizationId: context.organization!.id, deletedAt: null },
				...(input?.contractId && { contractId: input.contractId })
			};

			if (input?.startDate || input?.endDate) {
				where.periodStart = {};
				if (input.startDate) where.periodStart.gte = new Date(input.startDate);
				if (input.endDate) where.periodStart.lte = new Date(input.endDate);
			}

			const records = await prisma.contractSLARecord.findMany({
				where,
				take: limit + 1,
				...(cursor && { cursor: { id: cursor }, skip: 1 }),
				orderBy: { periodStart: 'desc' }
			});

			const hasMore = records.length > limit;
			if (hasMore) records.pop();

			const nextCursor = hasMore ? records[records.length - 1]?.id ?? null : null;

			return successResponse(
				{
					slaRecords: records.map(formatSLARecord),
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
					totalRequests: z.number().int().nonnegative().optional(),
					onTimeResponses: z.number().int().nonnegative().optional(),
					onTimeResolutions: z.number().int().nonnegative().optional(),
					missedSLAs: z.number().int().nonnegative().optional(),
					avgResponseTimeMinutes: z.number().int().nonnegative().nullable().optional(),
					avgResolutionTimeMinutes: z.number().int().nonnegative().nullable().optional(),
					scheduledVisits: z.number().int().nonnegative().optional(),
					completedVisits: z.number().int().nonnegative().optional(),
					missedVisits: z.number().int().nonnegative().optional(),
					notes: z.string().nullable().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ slaRecord: slaRecordOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('edit', 'contract_sla_record', input.id);

			const existing = await prisma.contractSLARecord.findUnique({
				where: { id: input.id },
				include: { contract: true }
			});
			if (!existing || existing.contract.organizationId !== context.organization!.id) {
				throw ApiException.notFound('SLA record');
			}

			// Use DBOS workflow for durable execution
			const result = await startContractSLAWorkflow(
				{
					action: 'UPDATE_SLA',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					slaRecordId: input.id,
					data: {
						totalRequests: input.totalRequests,
						onTimeResponses: input.onTimeResponses,
						onTimeResolutions: input.onTimeResolutions,
						missedSLAs: input.missedSLAs,
						avgResponseTimeMinutes: input.avgResponseTimeMinutes,
						avgResolutionTimeMinutes: input.avgResolutionTimeMinutes,
						scheduledVisits: input.scheduledVisits,
						completedVisits: input.completedVisits,
						missedVisits: input.missedVisits,
						notes: input.notes
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw ApiException.internal(result.error || 'Failed to update SLA record');
			}

			const slaRecord = await prisma.contractSLARecord.findUniqueOrThrow({ where: { id: result.entityId } });

			return successResponse({ slaRecord: formatSLARecord(slaRecord) }, context);
		}),

	calculateForPeriod: orgProcedure
		.input(
			z
				.object({
					contractId: z.string(),
					periodStart: z.string(),
					periodEnd: z.string()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ slaRecord: slaRecordOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('create', 'contract_sla_record', 'new');

			const contract = await prisma.serviceContract.findFirst({
				where: { id: input.contractId, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!contract) throw ApiException.notFound('Service contract');

			// Use DBOS workflow for durable execution
			const result = await startContractSLAWorkflow(
				{
					action: 'CALCULATE_SLA',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					data: {
						contractId: input.contractId,
						periodStart: input.periodStart,
						periodEnd: input.periodEnd
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw ApiException.internal(result.error || 'Failed to calculate SLA');
			}

			const slaRecord = await prisma.contractSLARecord.findUniqueOrThrow({ where: { id: result.entityId } });

			return successResponse({ slaRecord: formatSLARecord(slaRecord) }, context);
		})
};
