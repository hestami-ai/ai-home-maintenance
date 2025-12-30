import { z } from 'zod';
import { ResponseMetaSchema, JsonSchema } from '../../schemas.js';
import {
	orgProcedure,
	successResponse,
	IdempotencyKeySchema,
	PaginationInputSchema,
	PaginationOutputSchema
} from '../../router.js';
import { prisma } from '../../../db.js';
import { assertContractorOrg } from '../contractor/utils.js';
import { DispatchStatus, SLAPriority } from '../../../../../../generated/prisma/client.js';
import { startDispatchWorkflow } from '../../../workflows/dispatchWorkflow.js';

// Valid dispatch status transitions
const DISPATCH_TRANSITIONS: Record<DispatchStatus, DispatchStatus[]> = {
	PENDING: ['ASSIGNED', 'CANCELLED'],
	ASSIGNED: ['ACCEPTED', 'DECLINED', 'CANCELLED'],
	ACCEPTED: ['EN_ROUTE', 'CANCELLED'],
	DECLINED: ['ASSIGNED'], // Can be reassigned
	EN_ROUTE: ['ON_SITE', 'CANCELLED'],
	ON_SITE: ['COMPLETED', 'CANCELLED'],
	COMPLETED: [],
	CANCELLED: []
};

const dispatchAssignmentOutput = z.object({
	id: z.string(),
	organizationId: z.string(),
	jobId: z.string(),
	jobVisitId: z.string().nullable(),
	technicianId: z.string(),
	status: z.nativeEnum(DispatchStatus),
	assignedAt: z.string(),
	assignedBy: z.string(),
	acceptedAt: z.string().nullable(),
	declinedAt: z.string().nullable(),
	declineReason: z.string().nullable(),
	startedAt: z.string().nullable(),
	completedAt: z.string().nullable(),
	cancelledAt: z.string().nullable(),
	cancelReason: z.string().nullable(),
	scheduledStart: z.string(),
	scheduledEnd: z.string(),
	actualStart: z.string().nullable(),
	actualEnd: z.string().nullable(),
	estimatedTravelMinutes: z.number().nullable(),
	actualTravelMinutes: z.number().nullable(),
	distanceMiles: z.string().nullable(),
	dispatchNotes: z.string().nullable(),
	techNotes: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string()
});

const scheduleSlotOutput = z.object({
	id: z.string(),
	organizationId: z.string(),
	technicianId: z.string(),
	startTime: z.string(),
	endTime: z.string(),
	slotType: z.string(),
	jobId: z.string().nullable(),
	jobVisitId: z.string().nullable(),
	notes: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string()
});

const routePlanOutput = z.object({
	id: z.string(),
	organizationId: z.string(),
	technicianId: z.string(),
	routeDate: z.string(),
	isOptimized: z.boolean(),
	optimizedAt: z.string().nullable(),
	totalDistanceMiles: z.string().nullable(),
	totalTravelMinutes: z.number().nullable(),
	totalJobMinutes: z.number().nullable(),
	startAddress: z.string().nullable(),
	endAddress: z.string().nullable(),
	stopsJson: JsonSchema.nullable(),
	createdAt: z.string(),
	updatedAt: z.string()
});

const slaWindowOutput = z.object({
	id: z.string(),
	organizationId: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	priority: z.nativeEnum(SLAPriority),
	responseTimeMinutes: z.number(),
	resolutionTimeMinutes: z.number(),
	businessHoursOnly: z.boolean(),
	jobCategory: z.string().nullable(),
	isDefault: z.boolean(),
	isActive: z.boolean(),
	createdAt: z.string(),
	updatedAt: z.string()
});

const slaRecordOutput = z.object({
	id: z.string(),
	organizationId: z.string(),
	jobId: z.string(),
	slaWindowId: z.string(),
	responseDue: z.string(),
	resolutionDue: z.string(),
	respondedAt: z.string().nullable(),
	resolvedAt: z.string().nullable(),
	responseBreached: z.boolean(),
	resolutionBreached: z.boolean(),
	notes: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string()
});

const formatDispatchAssignment = (d: any) => ({
	id: d.id,
	organizationId: d.organizationId,
	jobId: d.jobId,
	jobVisitId: d.jobVisitId,
	technicianId: d.technicianId,
	status: d.status,
	assignedAt: d.assignedAt.toISOString(),
	assignedBy: d.assignedBy,
	acceptedAt: d.acceptedAt?.toISOString() ?? null,
	declinedAt: d.declinedAt?.toISOString() ?? null,
	declineReason: d.declineReason,
	startedAt: d.startedAt?.toISOString() ?? null,
	completedAt: d.completedAt?.toISOString() ?? null,
	cancelledAt: d.cancelledAt?.toISOString() ?? null,
	cancelReason: d.cancelReason,
	scheduledStart: d.scheduledStart.toISOString(),
	scheduledEnd: d.scheduledEnd.toISOString(),
	actualStart: d.actualStart?.toISOString() ?? null,
	actualEnd: d.actualEnd?.toISOString() ?? null,
	estimatedTravelMinutes: d.estimatedTravelMinutes,
	actualTravelMinutes: d.actualTravelMinutes,
	distanceMiles: d.distanceMiles?.toString() ?? null,
	dispatchNotes: d.dispatchNotes,
	techNotes: d.techNotes,
	createdAt: d.createdAt.toISOString(),
	updatedAt: d.updatedAt.toISOString()
});

const formatScheduleSlot = (s: any) => ({
	id: s.id,
	organizationId: s.organizationId,
	technicianId: s.technicianId,
	startTime: s.startTime.toISOString(),
	endTime: s.endTime.toISOString(),
	slotType: s.slotType,
	jobId: s.jobId,
	jobVisitId: s.jobVisitId,
	notes: s.notes,
	createdAt: s.createdAt.toISOString(),
	updatedAt: s.updatedAt.toISOString()
});

const formatRoutePlan = (r: any) => ({
	id: r.id,
	organizationId: r.organizationId,
	technicianId: r.technicianId,
	routeDate: r.routeDate.toISOString().split('T')[0],
	isOptimized: r.isOptimized,
	optimizedAt: r.optimizedAt?.toISOString() ?? null,
	totalDistanceMiles: r.totalDistanceMiles?.toString() ?? null,
	totalTravelMinutes: r.totalTravelMinutes,
	totalJobMinutes: r.totalJobMinutes,
	startAddress: r.startAddress,
	endAddress: r.endAddress,
	stopsJson: r.stopsJson,
	createdAt: r.createdAt.toISOString(),
	updatedAt: r.updatedAt.toISOString()
});

const formatSLAWindow = (s: any) => ({
	id: s.id,
	organizationId: s.organizationId,
	name: s.name,
	description: s.description,
	priority: s.priority,
	responseTimeMinutes: s.responseTimeMinutes,
	resolutionTimeMinutes: s.resolutionTimeMinutes,
	businessHoursOnly: s.businessHoursOnly,
	jobCategory: s.jobCategory,
	isDefault: s.isDefault,
	isActive: s.isActive,
	createdAt: s.createdAt.toISOString(),
	updatedAt: s.updatedAt.toISOString()
});

const formatSLARecord = (s: any) => ({
	id: s.id,
	organizationId: s.organizationId,
	jobId: s.jobId,
	slaWindowId: s.slaWindowId,
	responseDue: s.responseDue.toISOString(),
	resolutionDue: s.resolutionDue.toISOString(),
	respondedAt: s.respondedAt?.toISOString() ?? null,
	resolvedAt: s.resolvedAt?.toISOString() ?? null,
	responseBreached: s.responseBreached,
	resolutionBreached: s.resolutionBreached,
	notes: s.notes,
	createdAt: s.createdAt.toISOString(),
	updatedAt: s.updatedAt.toISOString()
});

async function validateTechnicianEligibility(
	technicianId: string,
	organizationId: string,
	scheduledStart: Date,
	scheduledEnd: Date
): Promise<{ eligible: boolean; reason?: string }> {
	const tech = await prisma.technician.findFirst({
		where: { id: technicianId, organizationId, isActive: true },
		include: { availability: true, timeOff: true }
	});

	if (!tech) {
		return { eligible: false, reason: 'Technician not found or inactive' };
	}

	// Check for time off conflicts
	const timeOffConflict = tech.timeOff.some((to) => {
		return scheduledStart < to.endsAt && scheduledEnd > to.startsAt;
	});

	if (timeOffConflict) {
		return { eligible: false, reason: 'Technician has time off during this period' };
	}

	// Check for existing dispatch conflicts
	const existingDispatch = await prisma.dispatchAssignment.findFirst({
		where: {
			technicianId,
			status: { notIn: ['COMPLETED', 'CANCELLED', 'DECLINED'] },
			scheduledStart: { lt: scheduledEnd },
			scheduledEnd: { gt: scheduledStart }
		}
	});

	if (existingDispatch) {
		return { eligible: false, reason: 'Technician has a conflicting dispatch assignment' };
	}

	return { eligible: true };
}

export const dispatchRouter = {
	/**
	 * Assign a technician to a job
	 */
	assignTech: orgProcedure
		.input(
			z
				.object({
					jobId: z.string(),
					jobVisitId: z.string().optional(),
					technicianId: z.string(),
					scheduledStart: z.string().datetime(),
					scheduledEnd: z.string().datetime(),
					estimatedTravelMinutes: z.number().int().nonnegative().optional(),
					dispatchNotes: z.string().optional()
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
				data: z.object({ assignment: dispatchAssignmentOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('assign', 'dispatch_assignment', 'new');

			// Validate job exists
			const job = await prisma.job.findFirst({
				where: { id: input.jobId, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!job) throw errors.NOT_FOUND({ message: 'Job not found' });

			// Validate technician eligibility
			const eligibility = await validateTechnicianEligibility(
				input.technicianId,
				context.organization!.id,
				new Date(input.scheduledStart),
				new Date(input.scheduledEnd)
			);
			if (!eligibility.eligible) {
				throw errors.BAD_REQUEST({ message: eligibility.reason! });
			}

			// Use DBOS workflow for durable execution
			const result = await startDispatchWorkflow(
				{
					action: 'CREATE_ASSIGNMENT',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					data: {
						jobId: input.jobId,
						jobVisitId: input.jobVisitId,
						technicianId: input.technicianId,
						scheduledStart: input.scheduledStart,
						scheduledEnd: input.scheduledEnd,
						estimatedTravelMinutes: input.estimatedTravelMinutes,
						dispatchNotes: input.dispatchNotes
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to create assignment' });
			}

			const assignment = await prisma.dispatchAssignment.findUniqueOrThrow({
				where: { id: result.entityId }
			});

			return successResponse({ assignment: formatDispatchAssignment(assignment) }, context);
		}),

	/**
	 * Reassign a dispatch to a different technician
	 */
	reassign: orgProcedure
		.input(
			z
				.object({
					assignmentId: z.string(),
					newTechnicianId: z.string(),
					scheduledStart: z.string().datetime().optional(),
					scheduledEnd: z.string().datetime().optional(),
					reason: z.string().optional()
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
				data: z.object({ assignment: dispatchAssignmentOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('reassign', 'dispatch_assignment', input.assignmentId);

			const existing = await prisma.dispatchAssignment.findFirst({
				where: { id: input.assignmentId, organizationId: context.organization!.id }
			});
			if (!existing) throw errors.NOT_FOUND({ message: 'Dispatch assignment not found' });

			if (['COMPLETED', 'CANCELLED'].includes(existing.status)) {
				throw errors.BAD_REQUEST({ message: `Cannot reassign ${existing.status} dispatch` });
			}

			const scheduledStart = input.scheduledStart
				? new Date(input.scheduledStart)
				: existing.scheduledStart;
			const scheduledEnd = input.scheduledEnd
				? new Date(input.scheduledEnd)
				: existing.scheduledEnd;

			// Validate new technician eligibility
			const eligibility = await validateTechnicianEligibility(
				input.newTechnicianId,
				context.organization!.id,
				scheduledStart,
				scheduledEnd
			);
			if (!eligibility.eligible) {
				throw errors.BAD_REQUEST({ message: eligibility.reason! });
			}

			// Use DBOS workflow for durable execution
			const result = await startDispatchWorkflow(
				{
					action: 'REASSIGN',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					assignmentId: input.assignmentId,
					data: {
						newTechnicianId: input.newTechnicianId,
						scheduledStart: scheduledStart.toISOString(),
						scheduledEnd: scheduledEnd.toISOString(),
						reason: input.reason
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to reassign dispatch' });
			}

			const assignment = await prisma.dispatchAssignment.findUniqueOrThrow({
				where: { id: result.entityId }
			});

			return successResponse({ assignment: formatDispatchAssignment(assignment) }, context);
		}),

	/**
	 * Update dispatch status (accept, decline, start, complete, cancel)
	 */
	updateStatus: orgProcedure
		.input(
			z
				.object({
					assignmentId: z.string(),
					status: z.nativeEnum(DispatchStatus),
					reason: z.string().optional(),
					actualStart: z.string().datetime().optional(),
					actualEnd: z.string().datetime().optional(),
					techNotes: z.string().optional()
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
				data: z.object({ assignment: dispatchAssignmentOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);

			const existing = await prisma.dispatchAssignment.findFirst({
				where: { id: input.assignmentId, organizationId: context.organization!.id }
			});
			if (!existing) throw errors.NOT_FOUND({ message: 'Dispatch assignment not found' });

			// Authorize based on action
			const action = input.status.toLowerCase();
			await context.cerbos.authorize(action, 'dispatch_assignment', input.assignmentId);

			// Validate transition
			const allowedTransitions = DISPATCH_TRANSITIONS[existing.status];
			if (!allowedTransitions.includes(input.status)) {
				throw errors.BAD_REQUEST({ message: `Cannot transition from ${existing.status} to ${input.status}` });
			}

			// Use DBOS workflow for durable execution
			const result = await startDispatchWorkflow(
				{
					action: 'UPDATE_STATUS',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					assignmentId: input.assignmentId,
					data: {
						status: input.status,
						actualStart: input.actualStart,
						actualEnd: input.actualEnd,
						completionNotes: input.techNotes,
						reason: input.reason
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to update dispatch status' });
			}

			const assignment = await prisma.dispatchAssignment.findUniqueOrThrow({
				where: { id: result.entityId }
			});

			return successResponse({ assignment: formatDispatchAssignment(assignment) }, context);
		}),

	/**
	 * List dispatch assignments with filtering
	 */
	listAssignments: orgProcedure
		.input(
			z
				.object({
					technicianId: z.string().optional(),
					jobId: z.string().optional(),
					status: z.nativeEnum(DispatchStatus).optional(),
					dateFrom: z.string().datetime().optional(),
					dateTo: z.string().datetime().optional()
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
					assignments: z.array(dispatchAssignmentOutput),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('view', 'dispatch_assignment', 'list');

			const limit = input?.limit ?? 20;
			const cursor = input?.cursor;

			const where = {
				organizationId: context.organization!.id,
				...(input?.technicianId && { technicianId: input.technicianId }),
				...(input?.jobId && { jobId: input.jobId }),
				...(input?.status && { status: input.status }),
				...(input?.dateFrom && { scheduledStart: { gte: new Date(input.dateFrom) } }),
				...(input?.dateTo && { scheduledEnd: { lte: new Date(input.dateTo) } })
			};

			const assignments = await prisma.dispatchAssignment.findMany({
				where,
				take: limit + 1,
				...(cursor && { cursor: { id: cursor }, skip: 1 }),
				orderBy: { scheduledStart: 'asc' }
			});

			const hasMore = assignments.length > limit;
			if (hasMore) assignments.pop();

			const nextCursor = hasMore ? assignments[assignments.length - 1]?.id ?? null : null;

			return successResponse(
				{
					assignments: assignments.map(formatDispatchAssignment),
					pagination: { nextCursor, hasMore }
				},
				context
			);
		}),

	/**
	 * Get dispatch board (all technicians' schedules for a date range)
	 */
	getBoard: orgProcedure
		.input(
			z.object({
				dateFrom: z.string().datetime(),
				dateTo: z.string().datetime(),
				technicianIds: z.array(z.string()).optional()
			})
		)
		.errors({
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					technicians: z.array(
						z.object({
							technicianId: z.string(),
							technicianName: z.string(),
							assignments: z.array(dispatchAssignmentOutput),
							slots: z.array(scheduleSlotOutput),
							timeOff: z.array(z.object({
								startsAt: z.string(),
								endsAt: z.string()
							}))
						})
					)
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('view', 'dispatch_assignment', 'board');

			const dateFrom = new Date(input.dateFrom);
			const dateTo = new Date(input.dateTo);

			// Get technicians
			const techWhere = {
				organizationId: context.organization!.id,
				isActive: true,
				...(input.technicianIds && { id: { in: input.technicianIds } })
			};

			const technicians = await prisma.technician.findMany({
				where: techWhere,
				include: {
					dispatchAssignments: {
						where: {
							scheduledStart: { lt: dateTo },
							scheduledEnd: { gt: dateFrom }
						},
						orderBy: { scheduledStart: 'asc' }
					},
					scheduleSlots: {
						where: {
							startTime: { lt: dateTo },
							endTime: { gt: dateFrom }
						},
						orderBy: { startTime: 'asc' }
					},
					timeOff: {
						where: {
							startsAt: { lt: dateTo },
							endsAt: { gt: dateFrom }
						},
						orderBy: { startsAt: 'asc' }
					}
				}
			});

			const board = technicians.map((tech) => ({
				technicianId: tech.id,
				technicianName: `${tech.firstName} ${tech.lastName}`,
				assignments: tech.dispatchAssignments.map(formatDispatchAssignment),
				slots: tech.scheduleSlots.map(formatScheduleSlot),
				timeOff: tech.timeOff.map((t) => ({
					startsAt: t.startsAt.toISOString(),
					endsAt: t.endsAt.toISOString()
				}))
			}));

			return successResponse({ technicians: board }, context);
		}),

	/**
	 * Reschedule a dispatch assignment
	 */
	reschedule: orgProcedure
		.input(
			z
				.object({
					assignmentId: z.string(),
					scheduledStart: z.string().datetime(),
					scheduledEnd: z.string().datetime(),
					reason: z.string().optional()
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
				data: z.object({ assignment: dispatchAssignmentOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('edit', 'dispatch_assignment', input.assignmentId);

			const existing = await prisma.dispatchAssignment.findFirst({
				where: { id: input.assignmentId, organizationId: context.organization!.id }
			});
			if (!existing) throw errors.NOT_FOUND({ message: 'Dispatch assignment not found' });

			if (['COMPLETED', 'CANCELLED', 'ON_SITE'].includes(existing.status)) {
				throw errors.BAD_REQUEST({ message: `Cannot reschedule ${existing.status} dispatch` });
			}

			// Validate technician still available for new time
			const eligibility = await validateTechnicianEligibility(
				existing.technicianId,
				context.organization!.id,
				new Date(input.scheduledStart),
				new Date(input.scheduledEnd)
			);

			// Allow if only conflict is this same assignment
			if (!eligibility.eligible && eligibility.reason !== 'Technician has a conflicting dispatch assignment') {
				throw errors.BAD_REQUEST({ message: eligibility.reason! });
			}

			// Use DBOS workflow for durable execution
			const result = await startDispatchWorkflow(
				{
					action: 'RESCHEDULE',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					assignmentId: input.assignmentId,
					data: {
						scheduledStart: input.scheduledStart,
						scheduledEnd: input.scheduledEnd,
						reason: input.reason
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to reschedule dispatch' });
			}

			const assignment = await prisma.dispatchAssignment.findUniqueOrThrow({
				where: { id: result.entityId }
			});

			return successResponse({ assignment: formatDispatchAssignment(assignment) }, context);
		}),

	/**
	 * Get or create route plan for a technician on a date
	 */
	getRoutePlan: orgProcedure
		.input(
			z.object({
				technicianId: z.string(),
				routeDate: z.string() // YYYY-MM-DD format
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ routePlan: routePlanOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('view', 'route_plan', input.technicianId);

			// Validate technician
			const tech = await prisma.technician.findFirst({
				where: { id: input.technicianId, organizationId: context.organization!.id }
			});
			if (!tech) throw errors.NOT_FOUND({ message: 'Technician not found' });

			const routeDate = new Date(input.routeDate);

			let routePlan = await prisma.routePlan.findUnique({
				where: {
					technicianId_routeDate: {
						technicianId: input.technicianId,
						routeDate
					}
				}
			});

			if (!routePlan) {
				routePlan = await prisma.routePlan.create({
					data: {
						organizationId: context.organization!.id,
						technicianId: input.technicianId,
						routeDate
					}
				});
			}

			return successResponse({ routePlan: formatRoutePlan(routePlan) }, context);
		}),

	/**
	 * Optimize route (stub - returns current stops in order)
	 */
	optimizeRoute: orgProcedure
		.input(
			z
				.object({
					technicianId: z.string(),
					routeDate: z.string(),
					startAddress: z.string().optional(),
					endAddress: z.string().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.errors({
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ routePlan: routePlanOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('optimize', 'route_plan', input.technicianId);

			const routeDate = new Date(input.routeDate);
			const startOfDay = new Date(routeDate);
			startOfDay.setHours(0, 0, 0, 0);
			const endOfDay = new Date(routeDate);
			endOfDay.setHours(23, 59, 59, 999);

			// Get all assignments for the day
			const assignments = await prisma.dispatchAssignment.findMany({
				where: {
					technicianId: input.technicianId,
					organizationId: context.organization!.id,
					status: { notIn: ['CANCELLED', 'DECLINED'] },
					scheduledStart: { gte: startOfDay, lte: endOfDay }
				},
				include: { job: true },
				orderBy: { scheduledStart: 'asc' }
			});

			// Build stops array (stub - just uses scheduled order)
			const stops = assignments.map((a, idx) => ({
				order: idx + 1,
				jobId: a.jobId,
				jobTitle: a.job.title,
				scheduledStart: a.scheduledStart.toISOString(),
				scheduledEnd: a.scheduledEnd.toISOString(),
				address: a.job.addressLine1 ?? 'No address'
			}));

			// Use DBOS workflow for durable execution
			const result = await startDispatchWorkflow(
				{
					action: 'OPTIMIZE_ROUTE',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					technicianId: input.technicianId,
					data: {
						technicianId: input.technicianId,
						planDate: input.routeDate,
						startAddress: input.startAddress,
						endAddress: input.endAddress,
						stops
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to optimize route' });
			}

			const routePlan = await prisma.routePlan.findUniqueOrThrow({
				where: { id: result.entityId }
			});

			return successResponse({ routePlan: formatRoutePlan(routePlan) }, context);
		})
};
