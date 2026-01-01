import { z } from 'zod';
import { ResponseMetaSchema } from '$lib/schemas/index.js';
import {
	orgProcedure,
	successResponse,
	IdempotencyKeySchema,
	PaginationInputSchema,
	PaginationOutputSchema
} from '../../router.js';
import { prisma } from '../../../db.js';
import { assertContractorOrg } from '../contractor/utils.js';
import { ScheduledVisitStatus } from '../../../../../../generated/prisma/client.js';
import { startVisitWorkflow } from '../../../workflows/visitWorkflow.js';

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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ visit: visitOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('create', 'scheduled_visit', 'new');

			const contract = await prisma.serviceContract.findFirst({
				where: { id: input.contractId, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!contract) throw errors.NOT_FOUND({ message: 'Service contract not found' });

			const maxVisit = await prisma.scheduledVisit.findFirst({
				where: { contractId: input.contractId },
				orderBy: { visitNumber: 'desc' }
			});

			// Use DBOS workflow for durable execution
			const result = await startVisitWorkflow(
				{
					action: 'CREATE_VISIT',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					data: {
						contractId: input.contractId,
						visitNumber: (maxVisit?.visitNumber ?? 0) + 1,
						scheduledDate: input.scheduledDate,
						scheduledStart: input.scheduledStart,
						scheduledEnd: input.scheduledEnd,
						technicianId: input.technicianId,
						notes: input.serviceNotes
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to create visit' });
			}

			const visit = await prisma.scheduledVisit.findUniqueOrThrow({
				where: { id: result.entityId }
			});

			return successResponse({ visit: formatVisit(visit) }, context);
		}),

	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ visit: visitOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('view', 'scheduled_visit', input.id);

			const visit = await prisma.scheduledVisit.findUnique({
				where: { id: input.id },
				include: { contract: true }
			});

			if (!visit || visit.contract.organizationId !== context.organization!.id) {
				throw errors.NOT_FOUND({ message: 'Scheduled visit not found' });
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
		.errors({
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					visits: z.array(visitOutput),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ visit: visitOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('edit', 'scheduled_visit', input.id);

			const visit = await prisma.scheduledVisit.findUnique({
				where: { id: input.id },
				include: { contract: true }
			});
			if (!visit || visit.contract.organizationId !== context.organization!.id) {
				throw errors.NOT_FOUND({ message: 'Scheduled visit not found' });
			}

			// Verify technician
			const tech = await prisma.technician.findFirst({
				where: { id: input.technicianId, organizationId: context.organization!.id, isActive: true }
			});
			if (!tech) throw errors.NOT_FOUND({ message: 'Technician not found' });

			// Use DBOS workflow for durable execution
			const result = await startVisitWorkflow(
				{
					action: 'ASSIGN_VISIT',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					visitId: input.id,
					data: { technicianId: input.technicianId }
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to assign visit' });
			}

			const updated = await prisma.scheduledVisit.findUniqueOrThrow({
				where: { id: result.entityId }
			});

			return successResponse({ visit: formatVisit(updated) }, context);
		}),

	confirm: orgProcedure
		.input(z.object({ id: z.string() }).merge(IdempotencyKeySchema))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Bad request' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ visit: visitOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('confirm', 'scheduled_visit', input.id);

			const visit = await prisma.scheduledVisit.findUnique({
				where: { id: input.id },
				include: { contract: true }
			});
			if (!visit || visit.contract.organizationId !== context.organization!.id) {
				throw errors.NOT_FOUND({ message: 'Scheduled visit not found' });
			}

			if (visit.status !== 'SCHEDULED') {
				throw errors.BAD_REQUEST({ message: 'Can only confirm SCHEDULED visits' });
			}

			// Use DBOS workflow for durable execution
			const result = await startVisitWorkflow(
				{
					action: 'CONFIRM_VISIT',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					visitId: input.id,
					data: {}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to confirm visit' });
			}

			const updated = await prisma.scheduledVisit.findUniqueOrThrow({
				where: { id: result.entityId }
			});

			return successResponse({ visit: formatVisit(updated) }, context);
		}),

	start: orgProcedure
		.input(z.object({ id: z.string() }).merge(IdempotencyKeySchema))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Bad request' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ visit: visitOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('start', 'scheduled_visit', input.id);

			const visit = await prisma.scheduledVisit.findUnique({
				where: { id: input.id },
				include: { contract: true }
			});
			if (!visit || visit.contract.organizationId !== context.organization!.id) {
				throw errors.NOT_FOUND({ message: 'Scheduled visit not found' });
			}

			if (!['SCHEDULED', 'CONFIRMED'].includes(visit.status)) {
				throw errors.BAD_REQUEST({ message: 'Can only start SCHEDULED or CONFIRMED visits' });
			}

			// Use DBOS workflow for durable execution
			const result = await startVisitWorkflow(
				{
					action: 'START_VISIT',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					visitId: input.id,
					data: {}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to start visit' });
			}

			const updated = await prisma.scheduledVisit.findUniqueOrThrow({
				where: { id: result.entityId }
			});

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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Bad request' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ visit: visitOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('complete', 'scheduled_visit', input.id);

			const visit = await prisma.scheduledVisit.findUnique({
				where: { id: input.id },
				include: { contract: true }
			});
			if (!visit || visit.contract.organizationId !== context.organization!.id) {
				throw errors.NOT_FOUND({ message: 'Scheduled visit not found' });
			}

			if (visit.status !== 'IN_PROGRESS') {
				throw errors.BAD_REQUEST({ message: 'Can only complete IN_PROGRESS visits' });
			}

			// Use DBOS workflow for durable execution
			const result = await startVisitWorkflow(
				{
					action: 'COMPLETE_VISIT',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					visitId: input.id,
					data: { completionNotes: input.completionNotes }
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to complete visit' });
			}

			const updated = await prisma.scheduledVisit.findUniqueOrThrow({
				where: { id: result.entityId }
			});

			return successResponse({ visit: formatVisit(updated) }, context);
		}),

	cancel: orgProcedure
		.input(z.object({ id: z.string(), reason: z.string().optional() }).merge(IdempotencyKeySchema))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Bad request' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ visit: visitOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('cancel', 'scheduled_visit', input.id);

			const visit = await prisma.scheduledVisit.findUnique({
				where: { id: input.id },
				include: { contract: true }
			});
			if (!visit || visit.contract.organizationId !== context.organization!.id) {
				throw errors.NOT_FOUND({ message: 'Scheduled visit not found' });
			}

			if (['COMPLETED', 'CANCELLED'].includes(visit.status)) {
				throw errors.BAD_REQUEST({ message: 'Cannot cancel completed or already cancelled visits' });
			}

			// Use DBOS workflow for durable execution
			const result = await startVisitWorkflow(
				{
					action: 'CANCEL_VISIT',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					visitId: input.id,
					data: { reason: input.reason }
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to cancel visit' });
			}

			const updated = await prisma.scheduledVisit.findUniqueOrThrow({
				where: { id: result.entityId }
			});

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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Bad request' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ visit: visitOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('reschedule', 'scheduled_visit', input.id);

			const visit = await prisma.scheduledVisit.findUnique({
				where: { id: input.id },
				include: { contract: true }
			});
			if (!visit || visit.contract.organizationId !== context.organization!.id) {
				throw errors.NOT_FOUND({ message: 'Scheduled visit not found' });
			}

			if (!['SCHEDULED', 'CONFIRMED'].includes(visit.status)) {
				throw errors.BAD_REQUEST({ message: 'Can only reschedule SCHEDULED or CONFIRMED visits' });
			}

			// Get next visit number
			const maxVisit = await prisma.scheduledVisit.findFirst({
				where: { contractId: visit.contractId },
				orderBy: { visitNumber: 'desc' }
			});

			// Use DBOS workflow for durable execution
			const result = await startVisitWorkflow(
				{
					action: 'RESCHEDULE_VISIT',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					visitId: input.id,
					data: {
						contractId: visit.contractId,
						scheduleId: visit.scheduleId,
						visitNumber: (maxVisit?.visitNumber ?? 0) + 1,
						newScheduledDate: input.newDate,
						newScheduledStart: input.newStart,
						newScheduledEnd: input.newEnd,
						technicianId: visit.technicianId,
						reason: input.reason
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to reschedule visit' });
			}

			const newVisit = await prisma.scheduledVisit.findUniqueOrThrow({
				where: { id: result.entityId }
			});

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
		.errors({
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ visits: z.array(visitOutput) }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
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
