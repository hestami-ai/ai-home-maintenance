import { z } from 'zod';
import { ResponseMetaSchema } from '../../schemas.js';
import { orgProcedure, successResponse, PaginationInputSchema } from '../../router.js';
import { prisma } from '../../../db.js';
import { ApiException } from '../../errors.js';
import { withIdempotency } from '../../middleware/idempotency.js';

const reportFormatEnum = z.enum(['PDF', 'EXCEL', 'CSV', 'JSON', 'HTML']);
const scheduleFrequencyEnum = z.enum(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY', 'CUSTOM']);
const deliveryMethodEnum = z.enum(['EMAIL', 'PORTAL', 'BOTH']);

const getAssociationOrThrow = async (organizationId: string) => {
	const association = await prisma.association.findFirst({
		where: { organizationId, deletedAt: null }
	});
	if (!association) throw ApiException.notFound('Association');
	return association;
};

// Calculate next run date based on frequency
const calculateNextRun = (frequency: string, cronExpression?: string | null): Date => {
	const now = new Date();
	switch (frequency) {
		case 'DAILY':
			return new Date(now.getTime() + 24 * 60 * 60 * 1000);
		case 'WEEKLY':
			return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
		case 'BIWEEKLY':
			return new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
		case 'MONTHLY':
			const nextMonth = new Date(now);
			nextMonth.setMonth(nextMonth.getMonth() + 1);
			return nextMonth;
		case 'QUARTERLY':
			const nextQuarter = new Date(now);
			nextQuarter.setMonth(nextQuarter.getMonth() + 3);
			return nextQuarter;
		case 'ANNUALLY':
			const nextYear = new Date(now);
			nextYear.setFullYear(nextYear.getFullYear() + 1);
			return nextYear;
		default:
			// For CUSTOM, would parse cron expression - stub returns tomorrow
			return new Date(now.getTime() + 24 * 60 * 60 * 1000);
	}
};

export const reportScheduleRouter = {
	/**
	 * Create a report schedule
	 */
	create: orgProcedure
		.input(z.object({
			reportId: z.string(),
			name: z.string().min(1).max(100),
			frequency: scheduleFrequencyEnum,
			cronExpression: z.string().optional(),
			parametersJson: z.string().optional(),
			format: reportFormatEnum.optional(),
			deliveryMethod: deliveryMethodEnum.optional(),
			recipientsJson: z.string().optional(),
			idempotencyKey: z.string().optional()
		}))
		.output(z.object({
			ok: z.literal(true),
			data: z.object({
				schedule: z.object({
					id: z.string(),
					name: z.string(),
					frequency: z.string(),
					nextRunAt: z.string().nullable()
				})
			}),
			meta: ResponseMetaSchema
		}))
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('create', 'report_schedule', 'new');
			const association = await getAssociationOrThrow(context.organization!.id);

			const createSchedule = async () => {
				// Verify report exists
				const report = await prisma.reportDefinition.findFirst({
					where: {
						id: input.reportId,
						isActive: true,
						OR: [
							{ associationId: association.id },
							{ isSystemReport: true, associationId: null }
						]
					}
				});

				if (!report) throw ApiException.notFound('Report definition');

				const format = input.format || report.defaultFormat;
				const nextRunAt = calculateNextRun(input.frequency, input.cronExpression);

				return prisma.reportSchedule.create({
					data: {
						reportId: input.reportId,
						associationId: association.id,
						name: input.name,
						frequency: input.frequency,
						cronExpression: input.cronExpression,
						parametersJson: input.parametersJson,
						format,
						deliveryMethod: input.deliveryMethod || 'EMAIL',
						recipientsJson: input.recipientsJson,
						nextRunAt,
						createdBy: context.user!.id
					}
				});
			};

			const schedule = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, createSchedule)).result
				: await createSchedule();

			return successResponse({
				schedule: {
					id: schedule.id,
					name: schedule.name,
					frequency: schedule.frequency,
					nextRunAt: schedule.nextRunAt?.toISOString() ?? null
				}
			}, context);
		}),

	/**
	 * List report schedules
	 */
	list: orgProcedure
		.input(z.object({
			reportId: z.string().optional(),
			isActive: z.boolean().optional(),
			pagination: PaginationInputSchema.optional()
		}).optional())
		.output(z.object({
			ok: z.literal(true),
			data: z.object({
				schedules: z.array(z.object({
					id: z.string(),
					reportId: z.string(),
					reportName: z.string(),
					name: z.string(),
					frequency: z.string(),
					format: z.string(),
					deliveryMethod: z.string(),
					isActive: z.boolean(),
					lastRunAt: z.string().nullable(),
					nextRunAt: z.string().nullable()
				})),
				pagination: z.object({
					hasMore: z.boolean(),
					nextCursor: z.string().nullable()
				})
			}),
			meta: ResponseMetaSchema
		}))
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'report_schedule', '*');
			const association = await getAssociationOrThrow(context.organization!.id);

			const where: Record<string, unknown> = { associationId: association.id };
			if (input?.reportId) where.reportId = input.reportId;
			if (input?.isActive !== undefined) where.isActive = input.isActive;

			const limit = input?.pagination?.limit ?? 50;
			const cursor = input?.pagination?.cursor;

			const schedules = await prisma.reportSchedule.findMany({
				where,
				include: { report: { select: { name: true } } },
				orderBy: { name: 'asc' },
				take: limit + 1,
				...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
			});

			const hasMore = schedules.length > limit;
			const results = hasMore ? schedules.slice(0, limit) : schedules;

			return successResponse({
				schedules: results.map(s => ({
					id: s.id,
					reportId: s.reportId,
					reportName: s.report.name,
					name: s.name,
					frequency: s.frequency,
					format: s.format,
					deliveryMethod: s.deliveryMethod,
					isActive: s.isActive,
					lastRunAt: s.lastRunAt?.toISOString() ?? null,
					nextRunAt: s.nextRunAt?.toISOString() ?? null
				})),
				pagination: {
					hasMore,
					nextCursor: hasMore ? results[results.length - 1].id : null
				}
			}, context);
		}),

	/**
	 * Get schedule details
	 */
	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(z.object({
			ok: z.literal(true),
			data: z.object({
				schedule: z.object({
					id: z.string(),
					reportId: z.string(),
					reportName: z.string(),
					name: z.string(),
					frequency: z.string(),
					cronExpression: z.string().nullable(),
					parametersJson: z.string().nullable(),
					format: z.string(),
					deliveryMethod: z.string(),
					recipientsJson: z.string().nullable(),
					isActive: z.boolean(),
					lastRunAt: z.string().nullable(),
					nextRunAt: z.string().nullable(),
					createdBy: z.string()
				})
			}),
			meta: ResponseMetaSchema
		}))
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'report_schedule', input.id);
			const association = await getAssociationOrThrow(context.organization!.id);

			const schedule = await prisma.reportSchedule.findFirst({
				where: { id: input.id, associationId: association.id },
				include: { report: { select: { name: true } } }
			});

			if (!schedule) throw ApiException.notFound('Report schedule');

			return successResponse({
				schedule: {
					id: schedule.id,
					reportId: schedule.reportId,
					reportName: schedule.report.name,
					name: schedule.name,
					frequency: schedule.frequency,
					cronExpression: schedule.cronExpression,
					parametersJson: schedule.parametersJson,
					format: schedule.format,
					deliveryMethod: schedule.deliveryMethod,
					recipientsJson: schedule.recipientsJson,
					isActive: schedule.isActive,
					lastRunAt: schedule.lastRunAt?.toISOString() ?? null,
					nextRunAt: schedule.nextRunAt?.toISOString() ?? null,
					createdBy: schedule.createdBy
				}
			}, context);
		}),

	/**
	 * Update a schedule
	 */
	update: orgProcedure
		.input(z.object({
			id: z.string(),
			name: z.string().min(1).max(100).optional(),
			frequency: scheduleFrequencyEnum.optional(),
			cronExpression: z.string().nullable().optional(),
			parametersJson: z.string().nullable().optional(),
			format: reportFormatEnum.optional(),
			deliveryMethod: deliveryMethodEnum.optional(),
			recipientsJson: z.string().nullable().optional(),
			isActive: z.boolean().optional(),
			idempotencyKey: z.string().optional()
		}))
		.output(z.object({
			ok: z.literal(true),
			data: z.object({
				schedule: z.object({
					id: z.string(),
					name: z.string(),
					isActive: z.boolean(),
					nextRunAt: z.string().nullable()
				})
			}),
			meta: ResponseMetaSchema
		}))
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'report_schedule', input.id);
			const association = await getAssociationOrThrow(context.organization!.id);

			const updateSchedule = async () => {
				const existing = await prisma.reportSchedule.findFirst({
					where: { id: input.id, associationId: association.id }
				});
				if (!existing) throw ApiException.notFound('Report schedule');

				// Recalculate next run if frequency changed
				let nextRunAt = existing.nextRunAt;
				if (input.frequency && input.frequency !== existing.frequency) {
					nextRunAt = calculateNextRun(input.frequency, input.cronExpression);
				}

				return prisma.reportSchedule.update({
					where: { id: input.id },
					data: {
						name: input.name,
						frequency: input.frequency,
						cronExpression: input.cronExpression,
						parametersJson: input.parametersJson,
						format: input.format,
						deliveryMethod: input.deliveryMethod,
						recipientsJson: input.recipientsJson,
						isActive: input.isActive,
						nextRunAt
					}
				});
			};

			const schedule = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, updateSchedule)).result
				: await updateSchedule();

			return successResponse({
				schedule: {
					id: schedule.id,
					name: schedule.name,
					isActive: schedule.isActive,
					nextRunAt: schedule.nextRunAt?.toISOString() ?? null
				}
			}, context);
		}),

	/**
	 * Delete a schedule
	 */
	delete: orgProcedure
		.input(z.object({
			id: z.string(),
			idempotencyKey: z.string().optional()
		}))
		.output(z.object({
			ok: z.literal(true),
			data: z.object({ deleted: z.boolean() }),
			meta: ResponseMetaSchema
		}))
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('delete', 'report_schedule', input.id);
			const association = await getAssociationOrThrow(context.organization!.id);

			const deleteSchedule = async () => {
				const existing = await prisma.reportSchedule.findFirst({
					where: { id: input.id, associationId: association.id }
				});
				if (!existing) throw ApiException.notFound('Report schedule');

				await prisma.reportSchedule.delete({ where: { id: input.id } });
				return true;
			};

			input.idempotencyKey
				? await withIdempotency(input.idempotencyKey, context, deleteSchedule)
				: await deleteSchedule();

			return successResponse({ deleted: true }, context);
		}),

	/**
	 * Run a schedule immediately (ad-hoc execution)
	 */
	runNow: orgProcedure
		.input(z.object({
			id: z.string(),
			idempotencyKey: z.string().optional()
		}))
		.output(z.object({
			ok: z.literal(true),
			data: z.object({
				execution: z.object({
					id: z.string(),
					status: z.string()
				})
			}),
			meta: ResponseMetaSchema
		}))
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'report_schedule', input.id);
			const association = await getAssociationOrThrow(context.organization!.id);

			const runSchedule = async () => {
				const schedule = await prisma.reportSchedule.findFirst({
					where: { id: input.id, associationId: association.id }
				});
				if (!schedule) throw ApiException.notFound('Report schedule');

				// Create execution from schedule
				const execution = await prisma.reportExecution.create({
					data: {
						reportId: schedule.reportId,
						scheduleId: schedule.id,
						associationId: association.id,
						status: 'PENDING',
						parametersJson: schedule.parametersJson,
						format: schedule.format,
						executedBy: context.user!.id
					}
				});

				// Update schedule last run
				await prisma.reportSchedule.update({
					where: { id: input.id },
					data: {
						lastRunAt: new Date(),
						nextRunAt: calculateNextRun(schedule.frequency, schedule.cronExpression)
					}
				});

				return execution;
			};

			const execution = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, runSchedule)).result
				: await runSchedule();

			return successResponse({
				execution: {
					id: execution.id,
					status: execution.status
				}
			}, context);
		})
};
