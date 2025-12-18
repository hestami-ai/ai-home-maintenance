import { z } from 'zod';
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
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('create', 'contract_sla_record', 'new');

			const contract = await prisma.serviceContract.findFirst({
				where: { id: input.contractId, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!contract) throw ApiException.notFound('Service contract');

			const createRecord = async () => {
				// Calculate compliance percentages
				const responseCompliancePercent = input.totalRequests > 0
					? (input.onTimeResponses / input.totalRequests) * 100
					: null;
				const resolutionCompliancePercent = input.totalRequests > 0
					? (input.onTimeResolutions / input.totalRequests) * 100
					: null;
				const visitCompliancePercent = input.scheduledVisits > 0
					? (input.completedVisits / input.scheduledVisits) * 100
					: null;

				return prisma.contractSLARecord.create({
					data: {
						contractId: input.contractId,
						periodStart: new Date(input.periodStart),
						periodEnd: new Date(input.periodEnd),
						totalRequests: input.totalRequests,
						onTimeResponses: input.onTimeResponses,
						onTimeResolutions: input.onTimeResolutions,
						missedSLAs: input.missedSLAs,
						responseCompliancePercent,
						resolutionCompliancePercent,
						avgResponseTimeMinutes: input.avgResponseTimeMinutes,
						avgResolutionTimeMinutes: input.avgResolutionTimeMinutes,
						scheduledVisits: input.scheduledVisits,
						completedVisits: input.completedVisits,
						missedVisits: input.missedVisits,
						visitCompliancePercent,
						notes: input.notes
					}
				});
			};

			const slaRecord = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, createRecord)).result
				: await createRecord();

			return successResponse({ slaRecord: formatSLARecord(slaRecord) }, context);
		}),

	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ slaRecord: slaRecordOutput }),
				meta: z.any()
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
				meta: z.any()
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
				meta: z.any()
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

			const updateRecord = async () => {
				const totalRequests = input.totalRequests ?? existing.totalRequests;
				const onTimeResponses = input.onTimeResponses ?? existing.onTimeResponses;
				const onTimeResolutions = input.onTimeResolutions ?? existing.onTimeResolutions;
				const scheduledVisits = input.scheduledVisits ?? existing.scheduledVisits;
				const completedVisits = input.completedVisits ?? existing.completedVisits;

				const responseCompliancePercent = totalRequests > 0
					? (onTimeResponses / totalRequests) * 100
					: null;
				const resolutionCompliancePercent = totalRequests > 0
					? (onTimeResolutions / totalRequests) * 100
					: null;
				const visitCompliancePercent = scheduledVisits > 0
					? (completedVisits / scheduledVisits) * 100
					: null;

				const { id, idempotencyKey, ...data } = input;
				return prisma.contractSLARecord.update({
					where: { id: input.id },
					data: {
						...data,
						responseCompliancePercent,
						resolutionCompliancePercent,
						visitCompliancePercent
					}
				});
			};

			const slaRecord = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, updateRecord)).result
				: await updateRecord();

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
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('create', 'contract_sla_record', 'new');

			const contract = await prisma.serviceContract.findFirst({
				where: { id: input.contractId, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!contract) throw ApiException.notFound('Service contract');

			const calculateSLA = async () => {
				const periodStart = new Date(input.periodStart);
				const periodEnd = new Date(input.periodEnd);

				// Get visits in period
				const visits = await prisma.scheduledVisit.findMany({
					where: {
						contractId: input.contractId,
						scheduledDate: { gte: periodStart, lte: periodEnd }
					}
				});

				const scheduledVisits = visits.length;
				const completedVisits = visits.filter(v => v.status === 'COMPLETED').length;
				const missedVisits = visits.filter(v => v.status === 'MISSED').length;

				const visitCompliancePercent = scheduledVisits > 0
					? (completedVisits / scheduledVisits) * 100
					: null;

				// Upsert the record
				return prisma.contractSLARecord.upsert({
					where: {
						contractId_periodStart_periodEnd: {
							contractId: input.contractId,
							periodStart,
							periodEnd
						}
					},
					create: {
						contractId: input.contractId,
						periodStart,
						periodEnd,
						scheduledVisits,
						completedVisits,
						missedVisits,
						visitCompliancePercent
					},
					update: {
						scheduledVisits,
						completedVisits,
						missedVisits,
						visitCompliancePercent
					}
				});
			};

			const slaRecord = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, calculateSLA)).result
				: await calculateSLA();

			return successResponse({ slaRecord: formatSLARecord(slaRecord) }, context);
		})
};
