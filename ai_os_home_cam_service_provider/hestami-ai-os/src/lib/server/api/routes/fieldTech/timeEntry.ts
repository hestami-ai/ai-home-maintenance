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
import { assertContractorOrg } from '../contractor/utils.js';
import { TimeEntryType } from '../../../../../../generated/prisma/client.js';
import { startTimeEntryWorkflow } from '../../../workflows/timeEntryWorkflow.js';

const timeEntryOutput = z.object({
	id: z.string(),
	organizationId: z.string(),
	jobId: z.string(),
	jobVisitId: z.string().nullable(),
	technicianId: z.string(),
	entryType: z.nativeEnum(TimeEntryType),
	startTime: z.string(),
	endTime: z.string().nullable(),
	durationMinutes: z.number().nullable(),
	notes: z.string().nullable(),
	isBillable: z.boolean(),
	hourlyRate: z.string().nullable(),
	isSynced: z.boolean(),
	syncedAt: z.string().nullable(),
	localId: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string()
});

const formatTimeEntry = (e: any) => ({
	id: e.id,
	organizationId: e.organizationId,
	jobId: e.jobId,
	jobVisitId: e.jobVisitId,
	technicianId: e.technicianId,
	entryType: e.entryType,
	startTime: e.startTime.toISOString(),
	endTime: e.endTime?.toISOString() ?? null,
	durationMinutes: e.durationMinutes,
	notes: e.notes,
	isBillable: e.isBillable,
	hourlyRate: e.hourlyRate?.toString() ?? null,
	isSynced: e.isSynced,
	syncedAt: e.syncedAt?.toISOString() ?? null,
	localId: e.localId,
	createdAt: e.createdAt.toISOString(),
	updatedAt: e.updatedAt.toISOString()
});

export const timeEntryRouter = {
	/**
	 * Start a time entry (clock in)
	 */
	start: orgProcedure
		.input(
			z
				.object({
					jobId: z.string(),
					jobVisitId: z.string().optional(),
					technicianId: z.string(),
					entryType: z.nativeEnum(TimeEntryType),
					startTime: z.string().datetime().optional(), // Defaults to now
					notes: z.string().optional(),
					isBillable: z.boolean().default(true),
					hourlyRate: z.number().nonnegative().optional(),
					localId: z.string().optional() // For offline sync
				})
				.merge(IdempotencyKeySchema)
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Bad request' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ timeEntry: timeEntryOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('create', 'job_time_entry', 'new');

			// Validate job exists
			const job = await prisma.job.findFirst({
				where: { id: input.jobId, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!job) throw errors.NOT_FOUND({ message: 'Job not found' });

			// Validate technician
			const tech = await prisma.technician.findFirst({
				where: { id: input.technicianId, organizationId: context.organization!.id, isActive: true }
			});
			if (!tech) throw errors.NOT_FOUND({ message: 'Technician not found' });

			// Check for open time entry of same type
			const openEntry = await prisma.jobTimeEntry.findFirst({
				where: {
					jobId: input.jobId,
					technicianId: input.technicianId,
					entryType: input.entryType,
					endTime: null
				}
			});
			if (openEntry) {
				throw errors.BAD_REQUEST({ message: `Already have an open ${input.entryType} time entry for this job` });
			}

			// Use DBOS workflow for durable execution
			const result = await startTimeEntryWorkflow(
				{
					action: 'CREATE_ENTRY',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					data: {
						jobId: input.jobId,
						jobVisitId: input.jobVisitId,
						technicianId: input.technicianId,
						entryType: input.entryType,
						startTime: input.startTime,
						notes: input.notes,
						isBillable: input.isBillable,
						hourlyRate: input.hourlyRate,
						localId: input.localId
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to create time entry' });
			}

			const timeEntry = await prisma.jobTimeEntry.findUniqueOrThrow({
				where: { id: result.entityId }
			});

			return successResponse({ timeEntry: formatTimeEntry(timeEntry) }, context);
		}),

	/**
	 * Stop a time entry (clock out)
	 */
	stop: orgProcedure
		.input(
			z
				.object({
					timeEntryId: z.string(),
					endTime: z.string().datetime().optional(), // Defaults to now
					notes: z.string().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Bad request' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ timeEntry: timeEntryOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('edit', 'job_time_entry', input.timeEntryId);

			const existing = await prisma.jobTimeEntry.findFirst({
				where: { id: input.timeEntryId, organizationId: context.organization!.id }
			});
			if (!existing) throw errors.NOT_FOUND({ message: 'Time entry not found' });

			if (existing.endTime) {
				throw errors.BAD_REQUEST({ message: 'Time entry already stopped' });
			}

			const endTime = input.endTime ? new Date(input.endTime) : new Date();
			const durationMinutes = Math.round(
				(endTime.getTime() - existing.startTime.getTime()) / 60000
			);

			// Use DBOS workflow for durable execution
			const result = await startTimeEntryWorkflow(
				{
					action: 'STOP_ENTRY',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					entryId: input.timeEntryId,
					data: {
						endTime: endTime.toISOString(),
						durationMinutes,
						notes: input.notes ?? existing.notes
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to stop time entry' });
			}

			const timeEntry = await prisma.jobTimeEntry.findUniqueOrThrow({
				where: { id: result.entityId }
			});

			return successResponse({ timeEntry: formatTimeEntry(timeEntry) }, context);
		}),

	/**
	 * List time entries for a job
	 */
	listByJob: orgProcedure
		.input(
			z
				.object({
					jobId: z.string(),
					technicianId: z.string().optional(),
					entryType: z.nativeEnum(TimeEntryType).optional()
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
					timeEntries: z.array(timeEntryOutput),
					totalMinutes: z.number(),
					billableMinutes: z.number(),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('view', 'job_time_entry', input.jobId);

			const limit = input.limit ?? 50;
			const cursor = input.cursor;

			const where = {
				organizationId: context.organization!.id,
				jobId: input.jobId,
				...(input.technicianId && { technicianId: input.technicianId }),
				...(input.entryType && { entryType: input.entryType })
			};

			const [entries, aggregates] = await Promise.all([
				prisma.jobTimeEntry.findMany({
					where,
					take: limit + 1,
					...(cursor && { cursor: { id: cursor }, skip: 1 }),
					orderBy: { startTime: 'desc' }
				}),
				prisma.jobTimeEntry.aggregate({
					where: { ...where, durationMinutes: { not: null } },
					_sum: { durationMinutes: true }
				}),
			]);

			// Calculate billable separately
			const billableAgg = await prisma.jobTimeEntry.aggregate({
				where: { ...where, durationMinutes: { not: null }, isBillable: true },
				_sum: { durationMinutes: true }
			});

			const hasMore = entries.length > limit;
			if (hasMore) entries.pop();

			const nextCursor = hasMore ? entries[entries.length - 1]?.id ?? null : null;

			return successResponse(
				{
					timeEntries: entries.map(formatTimeEntry),
					totalMinutes: aggregates._sum.durationMinutes ?? 0,
					billableMinutes: billableAgg._sum.durationMinutes ?? 0,
					pagination: { nextCursor, hasMore }
				},
				context
			);
		}),

	/**
	 * List time entries for a technician
	 */
	listByTechnician: orgProcedure
		.input(
			z
				.object({
					technicianId: z.string(),
					dateFrom: z.string().datetime().optional(),
					dateTo: z.string().datetime().optional()
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
					timeEntries: z.array(timeEntryOutput),
					totalMinutes: z.number(),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('view', 'job_time_entry', input.technicianId);

			const limit = input.limit ?? 50;
			const cursor = input.cursor;

			const where: any = {
				organizationId: context.organization!.id,
				technicianId: input.technicianId
			};

			if (input.dateFrom) {
				where.startTime = { ...(where.startTime || {}), gte: new Date(input.dateFrom) };
			}
			if (input.dateTo) {
				where.startTime = { ...(where.startTime || {}), lte: new Date(input.dateTo) };
			}

			const [entries, aggregates] = await Promise.all([
				prisma.jobTimeEntry.findMany({
					where,
					take: limit + 1,
					...(cursor && { cursor: { id: cursor }, skip: 1 }),
					orderBy: { startTime: 'desc' }
				}),
				prisma.jobTimeEntry.aggregate({
					where: { ...where, durationMinutes: { not: null } },
					_sum: { durationMinutes: true }
				})
			]);

			const hasMore = entries.length > limit;
			if (hasMore) entries.pop();

			const nextCursor = hasMore ? entries[entries.length - 1]?.id ?? null : null;

			return successResponse(
				{
					timeEntries: entries.map(formatTimeEntry),
					totalMinutes: aggregates._sum.durationMinutes ?? 0,
					pagination: { nextCursor, hasMore }
				},
				context
			);
		}),

	/**
	 * Update a time entry
	 */
	update: orgProcedure
		.input(
			z
				.object({
					id: z.string(),
					startTime: z.string().datetime().optional(),
					endTime: z.string().datetime().nullable().optional(),
					notes: z.string().nullable().optional(),
					isBillable: z.boolean().optional(),
					hourlyRate: z.number().nonnegative().nullable().optional()
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
				data: z.object({ timeEntry: timeEntryOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('edit', 'job_time_entry', input.id);

			const existing = await prisma.jobTimeEntry.findFirst({
				where: { id: input.id, organizationId: context.organization!.id }
			});
			if (!existing) throw errors.NOT_FOUND({ message: 'Time entry not found' });

			const startTime = input.startTime ? new Date(input.startTime) : existing.startTime;
			const endTime =
				input.endTime === null
					? null
					: input.endTime
						? new Date(input.endTime)
						: existing.endTime;

			const durationMinutes = endTime
				? Math.round((endTime.getTime() - startTime.getTime()) / 60000)
				: null;

			// Use DBOS workflow for durable execution
			const result = await startTimeEntryWorkflow(
				{
					action: 'UPDATE_ENTRY',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					entryId: input.id,
					data: {
						startTime: startTime.toISOString(),
						endTime: endTime?.toISOString() ?? null,
						durationMinutes,
						notes: input.notes !== undefined ? input.notes : existing.notes,
						isBillable: input.isBillable ?? existing.isBillable,
						hourlyRate: input.hourlyRate !== undefined ? input.hourlyRate : existing.hourlyRate
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to update time entry' });
			}

			const timeEntry = await prisma.jobTimeEntry.findUniqueOrThrow({
				where: { id: result.entityId }
			});

			return successResponse({ timeEntry: formatTimeEntry(timeEntry) }, context);
		}),

	/**
	 * Delete a time entry
	 */
	delete: orgProcedure
		.input(z.object({ id: z.string() }).merge(IdempotencyKeySchema))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ deleted: z.boolean() }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('delete', 'job_time_entry', input.id);

			const existing = await prisma.jobTimeEntry.findFirst({
				where: { id: input.id, organizationId: context.organization!.id }
			});
			if (!existing) throw errors.NOT_FOUND({ message: 'Time entry not found' });

			// Use DBOS workflow for durable execution
			const result = await startTimeEntryWorkflow(
				{
					action: 'DELETE_ENTRY',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					entryId: input.id,
					data: {}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to delete time entry' });
			}

			return successResponse({ deleted: true }, context);
		})
};
