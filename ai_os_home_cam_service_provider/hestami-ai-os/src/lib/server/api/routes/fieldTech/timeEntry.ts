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
import { TimeEntryType } from '../../../../../../generated/prisma/client.js';

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
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ timeEntry: timeEntryOutput }),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('create', 'job_time_entry', 'new');

			// Validate job exists
			const job = await prisma.job.findFirst({
				where: { id: input.jobId, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!job) throw ApiException.notFound('Job');

			// Validate technician
			const tech = await prisma.technician.findFirst({
				where: { id: input.technicianId, organizationId: context.organization!.id, isActive: true }
			});
			if (!tech) throw ApiException.notFound('Technician');

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
				throw ApiException.badRequest(`Already have an open ${input.entryType} time entry for this job`);
			}

			const createEntry = async () => {
				return prisma.jobTimeEntry.create({
					data: {
						organizationId: context.organization!.id,
						jobId: input.jobId,
						jobVisitId: input.jobVisitId,
						technicianId: input.technicianId,
						entryType: input.entryType,
						startTime: input.startTime ? new Date(input.startTime) : new Date(),
						notes: input.notes,
						isBillable: input.isBillable,
						hourlyRate: input.hourlyRate,
						localId: input.localId,
						isSynced: !input.localId, // If has localId, it's from offline
						syncedAt: input.localId ? new Date() : null
					}
				});
			};

			const timeEntry = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, createEntry)).result
				: await createEntry();

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
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ timeEntry: timeEntryOutput }),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('edit', 'job_time_entry', input.timeEntryId);

			const existing = await prisma.jobTimeEntry.findFirst({
				where: { id: input.timeEntryId, organizationId: context.organization!.id }
			});
			if (!existing) throw ApiException.notFound('Time entry');

			if (existing.endTime) {
				throw ApiException.badRequest('Time entry already stopped');
			}

			const endTime = input.endTime ? new Date(input.endTime) : new Date();
			const durationMinutes = Math.round(
				(endTime.getTime() - existing.startTime.getTime()) / 60000
			);

			const stopEntry = async () => {
				return prisma.jobTimeEntry.update({
					where: { id: input.timeEntryId },
					data: {
						endTime,
						durationMinutes,
						notes: input.notes ?? existing.notes
					}
				});
			};

			const timeEntry = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, stopEntry)).result
				: await stopEntry();

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
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					timeEntries: z.array(timeEntryOutput),
					totalMinutes: z.number(),
					billableMinutes: z.number(),
					pagination: PaginationOutputSchema
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
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
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					timeEntries: z.array(timeEntryOutput),
					totalMinutes: z.number(),
					pagination: PaginationOutputSchema
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
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
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ timeEntry: timeEntryOutput }),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('edit', 'job_time_entry', input.id);

			const existing = await prisma.jobTimeEntry.findFirst({
				where: { id: input.id, organizationId: context.organization!.id }
			});
			if (!existing) throw ApiException.notFound('Time entry');

			const updateEntry = async () => {
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

				return prisma.jobTimeEntry.update({
					where: { id: input.id },
					data: {
						startTime,
						endTime,
						durationMinutes,
						notes: input.notes !== undefined ? input.notes : existing.notes,
						isBillable: input.isBillable ?? existing.isBillable,
						hourlyRate: input.hourlyRate !== undefined ? input.hourlyRate : existing.hourlyRate
					}
				});
			};

			const timeEntry = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, updateEntry)).result
				: await updateEntry();

			return successResponse({ timeEntry: formatTimeEntry(timeEntry) }, context);
		}),

	/**
	 * Delete a time entry
	 */
	delete: orgProcedure
		.input(z.object({ id: z.string() }).merge(IdempotencyKeySchema))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ deleted: z.boolean() }),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('delete', 'job_time_entry', input.id);

			const existing = await prisma.jobTimeEntry.findFirst({
				where: { id: input.id, organizationId: context.organization!.id }
			});
			if (!existing) throw ApiException.notFound('Time entry');

			const deleteEntry = async () => {
				await prisma.jobTimeEntry.delete({ where: { id: input.id } });
				return { deleted: true };
			};

			const result = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, deleteEntry)).result
				: await deleteEntry();

			return successResponse(result, context);
		})
};
