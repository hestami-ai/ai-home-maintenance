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
import { RecurrenceFrequency } from '../../../../../../generated/prisma/client.js';
import { startScheduleWorkflow } from '../../../workflows/scheduleWorkflow.js';

const scheduleOutput = z.object({
	id: z.string(),
	contractId: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	frequency: z.nativeEnum(RecurrenceFrequency),
	isActive: z.boolean(),
	startDate: z.string(),
	endDate: z.string().nullable(),
	preferredDayOfWeek: z.number().nullable(),
	preferredDayOfMonth: z.number().nullable(),
	preferredTimeStart: z.string().nullable(),
	preferredTimeEnd: z.string().nullable(),
	lastGeneratedAt: z.string().nullable(),
	nextGenerateAt: z.string().nullable(),
	technicianId: z.string().nullable(),
	notes: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string()
});

const formatSchedule = (s: any) => ({
	id: s.id,
	contractId: s.contractId,
	name: s.name,
	description: s.description,
	frequency: s.frequency,
	isActive: s.isActive,
	startDate: s.startDate.toISOString().split('T')[0],
	endDate: s.endDate?.toISOString().split('T')[0] ?? null,
	preferredDayOfWeek: s.preferredDayOfWeek,
	preferredDayOfMonth: s.preferredDayOfMonth,
	preferredTimeStart: s.preferredTimeStart,
	preferredTimeEnd: s.preferredTimeEnd,
	lastGeneratedAt: s.lastGeneratedAt?.toISOString() ?? null,
	nextGenerateAt: s.nextGenerateAt?.toISOString() ?? null,
	technicianId: s.technicianId,
	notes: s.notes,
	createdAt: s.createdAt.toISOString(),
	updatedAt: s.updatedAt.toISOString()
});

function calculateNextGenerateDate(
	frequency: RecurrenceFrequency,
	fromDate: Date,
	preferredDayOfWeek?: number | null,
	preferredDayOfMonth?: number | null
): Date {
	const next = new Date(fromDate);

	switch (frequency) {
		case 'DAILY':
			next.setDate(next.getDate() + 1);
			break;
		case 'WEEKLY':
			next.setDate(next.getDate() + 7);
			if (preferredDayOfWeek !== null && preferredDayOfWeek !== undefined) {
				const currentDay = next.getDay();
				const daysUntil = (preferredDayOfWeek - currentDay + 7) % 7;
				next.setDate(next.getDate() + daysUntil);
			}
			break;
		case 'BIWEEKLY':
			next.setDate(next.getDate() + 14);
			break;
		case 'MONTHLY':
			next.setMonth(next.getMonth() + 1);
			if (preferredDayOfMonth !== null && preferredDayOfMonth !== undefined) {
				next.setDate(Math.min(preferredDayOfMonth, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
			}
			break;
		case 'QUARTERLY':
			next.setMonth(next.getMonth() + 3);
			break;
		case 'SEMI_ANNUAL':
			next.setMonth(next.getMonth() + 6);
			break;
		case 'ANNUAL':
			next.setFullYear(next.getFullYear() + 1);
			break;
	}

	return next;
}

export const contractScheduleRouter = {
	create: orgProcedure
		.input(
			z
				.object({
					contractId: z.string(),
					name: z.string().min(1),
					description: z.string().optional(),
					frequency: z.nativeEnum(RecurrenceFrequency),
					startDate: z.string(),
					endDate: z.string().optional(),
					preferredDayOfWeek: z.number().int().min(0).max(6).optional(),
					preferredDayOfMonth: z.number().int().min(1).max(31).optional(),
					preferredTimeStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
					preferredTimeEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
					technicianId: z.string().optional(),
					notes: z.string().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ schedule: scheduleOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('create', 'contract_schedule', 'new');

			// Verify contract
			const contract = await prisma.serviceContract.findFirst({
				where: { id: input.contractId, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!contract) throw ApiException.notFound('Service contract');

			if (!['DRAFT', 'ACTIVE'].includes(contract.status)) {
				throw ApiException.badRequest('Can only add schedules to DRAFT or ACTIVE contracts');
			}

			const createSchedule = async () => {
				const startDate = new Date(input.startDate);
				const nextGenerateAt = calculateNextGenerateDate(
					input.frequency,
					startDate,
					input.preferredDayOfWeek,
					input.preferredDayOfMonth
				);

				// Use DBOS workflow for durable execution
				const result = await startScheduleWorkflow(
					{
						action: 'CREATE_SCHEDULE',
						organizationId: context.organization!.id,
						userId: context.user!.id,
						data: {
							contractId: input.contractId,
							name: input.name,
							description: input.description,
							frequency: input.frequency,
							startDate: startDate.toISOString(),
							endDate: input.endDate,
							dayOfWeek: input.preferredDayOfWeek,
							dayOfMonth: input.preferredDayOfMonth,
							preferredStartTime: input.preferredTimeStart,
							preferredEndTime: input.preferredTimeEnd,
							isActive: true
						}
					},
					input.idempotencyKey
				);

				if (!result.success) {
					throw ApiException.internal(result.error || 'Failed to create schedule');
				}

				return prisma.contractSchedule.findUniqueOrThrow({
					where: { id: result.entityId }
				});
			};

			const schedule = input.idempotencyKey
				? await createSchedule()
				: await createSchedule();

			return successResponse({ schedule: formatSchedule(schedule) }, context);
		}),

	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ schedule: scheduleOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('view', 'contract_schedule', input.id);

			const schedule = await prisma.contractSchedule.findUnique({
				where: { id: input.id },
				include: { contract: true }
			});

			if (!schedule || schedule.contract.organizationId !== context.organization!.id) {
				throw ApiException.notFound('Contract schedule');
			}

			return successResponse({ schedule: formatSchedule(schedule) }, context);
		}),

	list: orgProcedure
		.input(
			z
				.object({
					contractId: z.string().optional(),
					isActive: z.boolean().optional()
				})
				.merge(PaginationInputSchema)
				.optional()
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					schedules: z.array(scheduleOutput),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('view', 'contract_schedule', 'list');

			const limit = input?.limit ?? 20;
			const cursor = input?.cursor;

			const where: any = {
				contract: { organizationId: context.organization!.id, deletedAt: null },
				...(input?.contractId && { contractId: input.contractId }),
				...(input?.isActive !== undefined && { isActive: input.isActive })
			};

			const schedules = await prisma.contractSchedule.findMany({
				where,
				take: limit + 1,
				...(cursor && { cursor: { id: cursor }, skip: 1 }),
				orderBy: { createdAt: 'desc' }
			});

			const hasMore = schedules.length > limit;
			if (hasMore) schedules.pop();

			const nextCursor = hasMore ? schedules[schedules.length - 1]?.id ?? null : null;

			return successResponse(
				{
					schedules: schedules.map(formatSchedule),
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
					endDate: z.string().nullable().optional(),
					preferredDayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
					preferredDayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
					preferredTimeStart: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
					preferredTimeEnd: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
					technicianId: z.string().nullable().optional(),
					isActive: z.boolean().optional(),
					notes: z.string().nullable().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ schedule: scheduleOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('edit', 'contract_schedule', input.id);

			const existing = await prisma.contractSchedule.findUnique({
				where: { id: input.id },
				include: { contract: true }
			});
			if (!existing || existing.contract.organizationId !== context.organization!.id) {
				throw ApiException.notFound('Contract schedule');
			}

			// Use DBOS workflow for durable execution
			const result = await startScheduleWorkflow(
				{
					action: 'UPDATE_SCHEDULE',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					scheduleId: input.id,
					data: {
						name: input.name,
						description: input.description,
						endDate: input.endDate,
						dayOfWeek: input.preferredDayOfWeek,
						dayOfMonth: input.preferredDayOfMonth,
						preferredStartTime: input.preferredTimeStart,
						preferredEndTime: input.preferredTimeEnd,
						isActive: input.isActive
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw ApiException.internal(result.error || 'Failed to update schedule');
			}

			const schedule = await prisma.contractSchedule.findUniqueOrThrow({
				where: { id: result.entityId }
			});

			return successResponse({ schedule: formatSchedule(schedule) }, context);
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
			await context.cerbos.authorize('delete', 'contract_schedule', input.id);

			const existing = await prisma.contractSchedule.findUnique({
				where: { id: input.id },
				include: { contract: true }
			});
			if (!existing || existing.contract.organizationId !== context.organization!.id) {
				throw ApiException.notFound('Contract schedule');
			}

			// Use DBOS workflow for durable execution
			const result = await startScheduleWorkflow(
				{
					action: 'DELETE_SCHEDULE',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					scheduleId: input.id,
					data: {}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw ApiException.internal(result.error || 'Failed to delete schedule');
			}

			return successResponse({ deleted: true }, context);
		}),

	generateVisits: orgProcedure
		.input(
			z
				.object({
					scheduleId: z.string(),
					throughDate: z.string()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ visitsCreated: z.number() }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('edit', 'contract_schedule', input.scheduleId);

			const schedule = await prisma.contractSchedule.findUnique({
				where: { id: input.scheduleId },
				include: { contract: true }
			});
			if (!schedule || schedule.contract.organizationId !== context.organization!.id) {
				throw ApiException.notFound('Contract schedule');
			}

			if (!schedule.isActive) {
				throw ApiException.badRequest('Schedule is not active');
			}

			// Get current max visit number
			const maxVisit = await prisma.scheduledVisit.findFirst({
				where: { contractId: schedule.contractId },
				orderBy: { visitNumber: 'desc' }
			});

			// Use DBOS workflow for durable execution
			const result = await startScheduleWorkflow(
				{
					action: 'GENERATE_VISITS',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					scheduleId: input.scheduleId,
					data: {
						startDate: (schedule.nextGenerateAt ?? schedule.startDate).toISOString(),
						endDate: input.throughDate,
						startingVisitNumber: (maxVisit?.visitNumber ?? 0) + 1
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw ApiException.internal(result.error || 'Failed to generate visits');
			}

			return successResponse({ visitsCreated: result.generatedCount ?? 0 }, context);
		})
};
