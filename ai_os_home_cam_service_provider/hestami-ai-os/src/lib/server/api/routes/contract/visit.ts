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
import { ScheduledVisitStatus } from '../../../../../../generated/prisma/client.js';

const visitOutput = z.object({
	id: z.string(),
	contractId: z.string(),
	scheduleId: z.string().nullable(),
	visitNumber: z.number(),
	status: z.nativeEnum(ScheduledVisitStatus),
	scheduledDate: z.string(),
	scheduledStart: z.string().nullable(),
	scheduledEnd: z.string().nullable(),
	confirmedAt: z.string().nullable(),
	actualStart: z.string().nullable(),
	actualEnd: z.string().nullable(),
	completedAt: z.string().nullable(),
	technicianId: z.string().nullable(),
	assignedAt: z.string().nullable(),
	jobId: z.string().nullable(),
	serviceNotes: z.string().nullable(),
	customerNotes: z.string().nullable(),
	completionNotes: z.string().nullable(),
	rescheduledFrom: z.string().nullable(),
	rescheduleReason: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string()
});

const formatVisit = (v: any) => ({
	id: v.id,
	contractId: v.contractId,
	scheduleId: v.scheduleId,
	visitNumber: v.visitNumber,
	status: v.status,
	scheduledDate: v.scheduledDate.toISOString().split('T')[0],
	scheduledStart: v.scheduledStart?.toISOString() ?? null,
	scheduledEnd: v.scheduledEnd?.toISOString() ?? null,
	confirmedAt: v.confirmedAt?.toISOString() ?? null,
	actualStart: v.actualStart?.toISOString() ?? null,
	actualEnd: v.actualEnd?.toISOString() ?? null,
	completedAt: v.completedAt?.toISOString() ?? null,
	technicianId: v.technicianId,
	assignedAt: v.assignedAt?.toISOString() ?? null,
	jobId: v.jobId,
	serviceNotes: v.serviceNotes,
	customerNotes: v.customerNotes,
	completionNotes: v.completionNotes,
	rescheduledFrom: v.rescheduledFrom,
	rescheduleReason: v.rescheduleReason,
	createdAt: v.createdAt.toISOString(),
	updatedAt: v.updatedAt.toISOString()
});

export const scheduledVisitRouter = {
	create: orgProcedure
		.input(
			z
				.object({
					contractId: z.string(),
					scheduledDate: z.string(),
					scheduledStart: z.string().datetime().optional(),
					scheduledEnd: z.string().datetime().optional(),
					technicianId: z.string().optional(),
					serviceNotes: z.string().optional(),
					customerNotes: z.string().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ visit: visitOutput }),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('create', 'scheduled_visit', 'new');

			const contract = await prisma.serviceContract.findFirst({
				where: { id: input.contractId, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!contract) throw ApiException.notFound('Service contract');

			const createVisit = async () => {
				const maxVisit = await prisma.scheduledVisit.findFirst({
					where: { contractId: input.contractId },
					orderBy: { visitNumber: 'desc' }
				});

				return prisma.scheduledVisit.create({
					data: {
						contractId: input.contractId,
						visitNumber: (maxVisit?.visitNumber ?? 0) + 1,
						scheduledDate: new Date(input.scheduledDate),
						scheduledStart: input.scheduledStart ? new Date(input.scheduledStart) : null,
						scheduledEnd: input.scheduledEnd ? new Date(input.scheduledEnd) : null,
						technicianId: input.technicianId,
						assignedAt: input.technicianId ? new Date() : null,
						serviceNotes: input.serviceNotes,
						customerNotes: input.customerNotes
					}
				});
			};

			const visit = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, createVisit)).result
				: await createVisit();

			return successResponse({ visit: formatVisit(visit) }, context);
		}),

	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ visit: visitOutput }),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('view', 'scheduled_visit', input.id);

			const visit = await prisma.scheduledVisit.findUnique({
				where: { id: input.id },
				include: { contract: true }
			});

			if (!visit || visit.contract.organizationId !== context.organization!.id) {
				throw ApiException.notFound('Scheduled visit');
			}

			return successResponse({ visit: formatVisit(visit) }, context);
		}),

	list: orgProcedure
		.input(
			z
				.object({
					contractId: z.string().optional(),
					technicianId: z.string().optional(),
					status: z.nativeEnum(ScheduledVisitStatus).optional(),
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
					visits: z.array(visitOutput),
					pagination: PaginationOutputSchema
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('view', 'scheduled_visit', 'list');

			const limit = input?.limit ?? 20;
			const cursor = input?.cursor;

			const where: any = {
				contract: { organizationId: context.organization!.id, deletedAt: null },
				...(input?.contractId && { contractId: input.contractId }),
				...(input?.technicianId && { technicianId: input.technicianId }),
				...(input?.status && { status: input.status })
			};

			if (input?.startDate || input?.endDate) {
				where.scheduledDate = {};
				if (input.startDate) where.scheduledDate.gte = new Date(input.startDate);
				if (input.endDate) where.scheduledDate.lte = new Date(input.endDate);
			}

			const visits = await prisma.scheduledVisit.findMany({
				where,
				take: limit + 1,
				...(cursor && { cursor: { id: cursor }, skip: 1 }),
				orderBy: { scheduledDate: 'asc' }
			});

			const hasMore = visits.length > limit;
			if (hasMore) visits.pop();

			const nextCursor = hasMore ? visits[visits.length - 1]?.id ?? null : null;

			return successResponse(
				{
					visits: visits.map(formatVisit),
					pagination: { nextCursor, hasMore }
				},
				context
			);
		}),

	assign: orgProcedure
		.input(
			z
				.object({
					id: z.string(),
					technicianId: z.string()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ visit: visitOutput }),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('edit', 'scheduled_visit', input.id);

			const visit = await prisma.scheduledVisit.findUnique({
				where: { id: input.id },
				include: { contract: true }
			});
			if (!visit || visit.contract.organizationId !== context.organization!.id) {
				throw ApiException.notFound('Scheduled visit');
			}

			// Verify technician
			const tech = await prisma.technician.findFirst({
				where: { id: input.technicianId, organizationId: context.organization!.id, isActive: true }
			});
			if (!tech) throw ApiException.notFound('Technician');

			const assignVisit = async () => {
				return prisma.scheduledVisit.update({
					where: { id: input.id },
					data: {
						technicianId: input.technicianId,
						assignedAt: new Date()
					}
				});
			};

			const updated = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, assignVisit)).result
				: await assignVisit();

			return successResponse({ visit: formatVisit(updated) }, context);
		}),

	confirm: orgProcedure
		.input(z.object({ id: z.string() }).merge(IdempotencyKeySchema))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ visit: visitOutput }),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('confirm', 'scheduled_visit', input.id);

			const visit = await prisma.scheduledVisit.findUnique({
				where: { id: input.id },
				include: { contract: true }
			});
			if (!visit || visit.contract.organizationId !== context.organization!.id) {
				throw ApiException.notFound('Scheduled visit');
			}

			if (visit.status !== 'SCHEDULED') {
				throw ApiException.badRequest('Can only confirm SCHEDULED visits');
			}

			const confirmVisit = async () => {
				return prisma.scheduledVisit.update({
					where: { id: input.id },
					data: {
						status: 'CONFIRMED',
						confirmedAt: new Date()
					}
				});
			};

			const updated = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, confirmVisit)).result
				: await confirmVisit();

			return successResponse({ visit: formatVisit(updated) }, context);
		}),

	start: orgProcedure
		.input(z.object({ id: z.string() }).merge(IdempotencyKeySchema))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ visit: visitOutput }),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('start', 'scheduled_visit', input.id);

			const visit = await prisma.scheduledVisit.findUnique({
				where: { id: input.id },
				include: { contract: true }
			});
			if (!visit || visit.contract.organizationId !== context.organization!.id) {
				throw ApiException.notFound('Scheduled visit');
			}

			if (!['SCHEDULED', 'CONFIRMED'].includes(visit.status)) {
				throw ApiException.badRequest('Can only start SCHEDULED or CONFIRMED visits');
			}

			const startVisit = async () => {
				return prisma.scheduledVisit.update({
					where: { id: input.id },
					data: {
						status: 'IN_PROGRESS',
						actualStart: new Date()
					}
				});
			};

			const updated = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, startVisit)).result
				: await startVisit();

			return successResponse({ visit: formatVisit(updated) }, context);
		}),

	complete: orgProcedure
		.input(
			z
				.object({
					id: z.string(),
					completionNotes: z.string().optional(),
					createJob: z.boolean().default(false)
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ visit: visitOutput }),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('complete', 'scheduled_visit', input.id);

			const visit = await prisma.scheduledVisit.findUnique({
				where: { id: input.id },
				include: { contract: true }
			});
			if (!visit || visit.contract.organizationId !== context.organization!.id) {
				throw ApiException.notFound('Scheduled visit');
			}

			if (visit.status !== 'IN_PROGRESS') {
				throw ApiException.badRequest('Can only complete IN_PROGRESS visits');
			}

			const completeVisit = async () => {
				return prisma.$transaction(async (tx) => {
					let jobId = visit.jobId;

					if (input.createJob && !jobId) {
						// Generate job number
						const year = new Date().getFullYear();
						const count = await tx.job.count({
							where: {
								organizationId: context.organization!.id,
								jobNumber: { startsWith: `JOB-${year}-` }
							}
						});
						const jobNumber = `JOB-${year}-${String(count + 1).padStart(6, '0')}`;

						const job = await tx.job.create({
							data: {
								organizationId: context.organization!.id,
								jobNumber,
								title: `Contract Visit #${visit.visitNumber}`,
								description: visit.serviceNotes,
								sourceType: 'RECURRING',
								status: 'COMPLETED',
								customerId: visit.contract.customerId,
								associationId: visit.contract.associationId,
								propertyId: visit.contract.propertyId,
								unitId: visit.contract.unitId,
								assignedTechnicianId: visit.technicianId,
								scheduledStart: visit.scheduledStart,
								scheduledEnd: visit.scheduledEnd,
								startedAt: visit.actualStart,
								completedAt: new Date(),
								resolutionNotes: input.completionNotes
							}
						});
						jobId = job.id;
					}

					return tx.scheduledVisit.update({
						where: { id: input.id },
						data: {
							status: 'COMPLETED',
							actualEnd: new Date(),
							completedAt: new Date(),
							completionNotes: input.completionNotes,
							jobId
						}
					});
				});
			};

			const updated = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, completeVisit)).result
				: await completeVisit();

			return successResponse({ visit: formatVisit(updated) }, context);
		}),

	cancel: orgProcedure
		.input(z.object({ id: z.string(), reason: z.string().optional() }).merge(IdempotencyKeySchema))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ visit: visitOutput }),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('cancel', 'scheduled_visit', input.id);

			const visit = await prisma.scheduledVisit.findUnique({
				where: { id: input.id },
				include: { contract: true }
			});
			if (!visit || visit.contract.organizationId !== context.organization!.id) {
				throw ApiException.notFound('Scheduled visit');
			}

			if (['COMPLETED', 'CANCELLED'].includes(visit.status)) {
				throw ApiException.badRequest('Cannot cancel completed or already cancelled visits');
			}

			const cancelVisit = async () => {
				return prisma.scheduledVisit.update({
					where: { id: input.id },
					data: {
						status: 'CANCELLED',
						completionNotes: input.reason
							? `Cancelled: ${input.reason}`
							: visit.completionNotes
					}
				});
			};

			const updated = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, cancelVisit)).result
				: await cancelVisit();

			return successResponse({ visit: formatVisit(updated) }, context);
		}),

	reschedule: orgProcedure
		.input(
			z
				.object({
					id: z.string(),
					newDate: z.string(),
					newStart: z.string().datetime().optional(),
					newEnd: z.string().datetime().optional(),
					reason: z.string().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ visit: visitOutput }),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('reschedule', 'scheduled_visit', input.id);

			const visit = await prisma.scheduledVisit.findUnique({
				where: { id: input.id },
				include: { contract: true }
			});
			if (!visit || visit.contract.organizationId !== context.organization!.id) {
				throw ApiException.notFound('Scheduled visit');
			}

			if (!['SCHEDULED', 'CONFIRMED'].includes(visit.status)) {
				throw ApiException.badRequest('Can only reschedule SCHEDULED or CONFIRMED visits');
			}

			const rescheduleVisit = async () => {
				return prisma.$transaction(async (tx) => {
					// Mark original as rescheduled
					await tx.scheduledVisit.update({
						where: { id: input.id },
						data: { status: 'RESCHEDULED' }
					});

					// Get next visit number
					const maxVisit = await tx.scheduledVisit.findFirst({
						where: { contractId: visit.contractId },
						orderBy: { visitNumber: 'desc' }
					});

					// Create new visit
					return tx.scheduledVisit.create({
						data: {
							contractId: visit.contractId,
							scheduleId: visit.scheduleId,
							visitNumber: (maxVisit?.visitNumber ?? 0) + 1,
							scheduledDate: new Date(input.newDate),
							scheduledStart: input.newStart ? new Date(input.newStart) : null,
							scheduledEnd: input.newEnd ? new Date(input.newEnd) : null,
							technicianId: visit.technicianId,
							assignedAt: visit.technicianId ? new Date() : null,
							serviceNotes: visit.serviceNotes,
							customerNotes: visit.customerNotes,
							rescheduledFrom: input.id,
							rescheduleReason: input.reason
						}
					});
				});
			};

			const newVisit = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, rescheduleVisit)).result
				: await rescheduleVisit();

			return successResponse({ visit: formatVisit(newVisit) }, context);
		}),

	getUpcoming: orgProcedure
		.input(
			z
				.object({
					days: z.number().int().positive().default(7),
					technicianId: z.string().optional()
				})
				.optional()
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ visits: z.array(visitOutput) }),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('view', 'scheduled_visit', 'list');

			const days = input?.days ?? 7;
			const endDate = new Date();
			endDate.setDate(endDate.getDate() + days);

			const visits = await prisma.scheduledVisit.findMany({
				where: {
					contract: { organizationId: context.organization!.id, deletedAt: null },
					status: { in: ['SCHEDULED', 'CONFIRMED'] },
					scheduledDate: { gte: new Date(), lte: endDate },
					...(input?.technicianId && { technicianId: input.technicianId })
				},
				orderBy: { scheduledDate: 'asc' },
				take: 50
			});

			return successResponse({ visits: visits.map(formatVisit) }, context);
		})
};
