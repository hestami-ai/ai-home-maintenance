import { z } from 'zod';
import { ResponseMetaSchema } from '$lib/schemas/index.js';
import {
	orgProcedure,
	successResponse,
	PaginationInputSchema,
	PaginationOutputSchema,
	IdempotencyKeySchema
} from '../../router.js';
import { prisma } from '../../../db.js';
import { ConciergeActionTypeSchema } from '../../../../../../generated/zod/inputTypeSchemas/ConciergeActionTypeSchema.js';
import { ConciergeActionStatusSchema } from '../../../../../../generated/zod/inputTypeSchemas/ConciergeActionStatusSchema.js';
import type { Prisma } from '../../../../../../generated/prisma/client.js';
import { recordDecision, recordExecution } from '../../middleware/activityEvent.js';
import { createModuleLogger } from '../../../logger.js';

const log = createModuleLogger('ConciergeActionRoute');

// Valid status transitions for the action state machine
const VALID_ACTION_STATUS_TRANSITIONS: Record<string, string[]> = {
	PLANNED: ['IN_PROGRESS', 'CANCELLED'],
	IN_PROGRESS: ['COMPLETED', 'BLOCKED', 'CANCELLED'],
	BLOCKED: ['IN_PROGRESS', 'CANCELLED'],
	COMPLETED: [], // Terminal state
	CANCELLED: [] // Terminal state
};

/**
 * Validate action status transition
 */
function isValidActionStatusTransition(from: string, to: string): boolean {
	return VALID_ACTION_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Ensure case exists and belongs to organization
 */
async function ensureCase(caseId: string, organizationId: string, errors: any) {
	const caseRecord = await prisma.conciergeCase.findFirst({
		where: { id: caseId, organizationId, deletedAt: null }
	});
	if (!caseRecord) {
		throw errors.NOT_FOUND({ message: 'ConciergeCase not found' });
	}
	return caseRecord;
}

/**
 * Concierge Action management procedures for Phase 3.6
 */
export const conciergeActionRouter = {
	/**
	 * Create a new action for a case
	 */
	create: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				caseId: z.string(),
				actionType: ConciergeActionTypeSchema,
				description: z.string().min(1),
				plannedAt: z.string().datetime().optional(),
				notes: z.string().optional(),
				relatedDocumentIds: z.array(z.string()).optional(),
				relatedExternalContactIds: z.array(z.string()).optional()
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					action: z.object({
						id: z.string(),
						caseId: z.string(),
						actionType: z.string(),
						status: z.string(),
						description: z.string(),
						plannedAt: z.string().nullable(),
						createdAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await ensureCase(input.caseId, context.organization.id, errors);
			await context.cerbos.authorize('create', 'concierge_action', 'new');

			const action = await prisma.conciergeAction.create({
				data: {
					caseId: input.caseId,
					actionType: input.actionType,
					status: 'PLANNED',
					description: input.description,
					plannedAt: input.plannedAt ? new Date(input.plannedAt) : null,
					performedByUserId: context.user.id,
					notes: input.notes,
					relatedDocumentIds: input.relatedDocumentIds ?? [],
					relatedExternalContactIds: input.relatedExternalContactIds ?? []
				}
			});

			// Log creation
			await prisma.conciergeActionLog.create({
				data: {
					actionId: action.id,
					eventType: 'created',
					toStatus: 'PLANNED',
					description: 'Action created',
					changedBy: context.user.id
				}
			});

			// Record activity event
			await recordDecision(context, {
				entityType: 'CONCIERGE_ACTION',
				entityId: action.id,
				action: 'CREATE',
				summary: `Action planned: ${input.actionType} - ${input.description}`,
				caseId: input.caseId,
				newState: {
					actionType: action.actionType,
					status: action.status,
					description: action.description
				}
			});

			return successResponse(
				{
					action: {
						id: action.id,
						caseId: action.caseId,
						actionType: action.actionType,
						status: action.status,
						description: action.description,
						plannedAt: action.plannedAt?.toISOString() ?? null,
						createdAt: action.createdAt.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * Get a single action by ID
	 */
	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					action: z.object({
						id: z.string(),
						caseId: z.string(),
						actionType: z.string(),
						status: z.string(),
						description: z.string(),
						plannedAt: z.string().nullable(),
						startedAt: z.string().nullable(),
						completedAt: z.string().nullable(),
						performedByUserId: z.string(),
						outcome: z.string().nullable(),
						notes: z.string().nullable(),
						relatedDocumentIds: z.array(z.string()),
						relatedExternalContactIds: z.array(z.string()),
						createdAt: z.string(),
						updatedAt: z.string()
					}),
					logs: z.array(
						z.object({
							id: z.string(),
							eventType: z.string(),
							fromStatus: z.string().nullable(),
							toStatus: z.string().nullable(),
							description: z.string().nullable(),
							changedBy: z.string(),
							createdAt: z.string()
						})
					)
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			const action = await prisma.conciergeAction.findFirst({
				where: { id: input.id, deletedAt: null },
				include: {
					case: true,
					logs: { orderBy: { createdAt: 'desc' } }
				}
			});

			if (!action || action.case.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'ConciergeAction not found' });
			}

			await context.cerbos.authorize('view', 'concierge_action', action.id);

			return successResponse(
				{
					action: {
						id: action.id,
						caseId: action.caseId,
						actionType: action.actionType,
						status: action.status,
						description: action.description,
						plannedAt: action.plannedAt?.toISOString() ?? null,
						startedAt: action.startedAt?.toISOString() ?? null,
						completedAt: action.completedAt?.toISOString() ?? null,
						performedByUserId: action.performedByUserId,
						outcome: action.outcome ?? null,
						notes: action.notes ?? null,
						relatedDocumentIds: (action.relatedDocumentIds as string[]) ?? [],
						relatedExternalContactIds: (action.relatedExternalContactIds as string[]) ?? [],
						createdAt: action.createdAt.toISOString(),
						updatedAt: action.updatedAt.toISOString()
					},
					logs: action.logs.map((log) => ({
						id: log.id,
						eventType: log.eventType,
						fromStatus: log.fromStatus ?? null,
						toStatus: log.toStatus ?? null,
						description: log.description ?? null,
						changedBy: log.changedBy,
						createdAt: log.createdAt.toISOString()
					}))
				},
				context
			);
		}),

	/**
	 * List actions for a case
	 */
	listByCase: orgProcedure
		.input(
			PaginationInputSchema.extend({
				caseId: z.string(),
				status: ConciergeActionStatusSchema.optional(),
				actionType: ConciergeActionTypeSchema.optional()
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					actions: z.array(
						z.object({
							id: z.string(),
							actionType: z.string(),
							status: z.string(),
							description: z.string(),
							plannedAt: z.string().nullable(),
							startedAt: z.string().nullable(),
							completedAt: z.string().nullable(),
							performedByUserId: z.string(),
							createdAt: z.string()
						})
					),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await ensureCase(input.caseId, context.organization.id, errors);
			await context.cerbos.authorize('view', 'concierge_action', 'list');

			const where: Prisma.ConciergeActionWhereInput = {
				caseId: input.caseId,
				deletedAt: null,
				...(input.status && { status: input.status }),
				...(input.actionType && { actionType: input.actionType })
			};

			const actions = await prisma.conciergeAction.findMany({
				where,
				take: input.limit + 1,
				...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
				orderBy: { createdAt: 'desc' }
			});

			const hasMore = actions.length > input.limit;
			const items = hasMore ? actions.slice(0, -1) : actions;

			return successResponse(
				{
					actions: items.map((a) => ({
						id: a.id,
						actionType: a.actionType,
						status: a.status,
						description: a.description,
						plannedAt: a.plannedAt?.toISOString() ?? null,
						startedAt: a.startedAt?.toISOString() ?? null,
						completedAt: a.completedAt?.toISOString() ?? null,
						performedByUserId: a.performedByUserId,
						createdAt: a.createdAt.toISOString()
					})),
					pagination: {
						nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
						hasMore
					}
				},
				context
			);
		}),

	/**
	 * Start an action (transition from PLANNED to IN_PROGRESS)
	 */
	start: orgProcedure
		.input(z.object({ id: z.string() }))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Invalid request' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					action: z.object({
						id: z.string(),
						status: z.string(),
						startedAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			const action = await prisma.conciergeAction.findFirst({
				where: { id: input.id, deletedAt: null },
				include: { case: true }
			});

			if (!action || action.case.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'ConciergeAction not found' });
			}

			await context.cerbos.authorize('update', 'concierge_action', action.id);

			if (!isValidActionStatusTransition(action.status, 'IN_PROGRESS')) {
				throw errors.BAD_REQUEST({ message: `Cannot start action in status ${action.status}` });
			}

			const now = new Date();
			const updated = await prisma.conciergeAction.update({
				where: { id: input.id },
				data: {
					status: 'IN_PROGRESS',
					startedAt: now
				}
			});

			await prisma.conciergeActionLog.create({
				data: {
					actionId: action.id,
					eventType: 'status_change',
					fromStatus: action.status,
					toStatus: 'IN_PROGRESS',
					description: 'Action started',
					changedBy: context.user.id
				}
			});

			// Record activity event
			await recordExecution(context, {
				entityType: 'CONCIERGE_ACTION',
				entityId: action.id,
				action: 'STATUS_CHANGE',
				summary: `Action started: ${action.actionType}`,
				caseId: action.caseId,
				previousState: { status: action.status },
				newState: { status: 'IN_PROGRESS' }
			});

			return successResponse(
				{
					action: {
						id: updated.id,
						status: updated.status,
						startedAt: updated.startedAt!.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * Complete an action with outcome (transition to COMPLETED)
	 */
	complete: orgProcedure
		.input(
			z.object({
				id: z.string(),
				outcome: z.string().min(1),
				notes: z.string().optional()
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Invalid request' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					action: z.object({
						id: z.string(),
						status: z.string(),
						outcome: z.string(),
						completedAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			const action = await prisma.conciergeAction.findFirst({
				where: { id: input.id, deletedAt: null },
				include: { case: true }
			});

			if (!action || action.case.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'ConciergeAction not found' });
			}

			await context.cerbos.authorize('update', 'concierge_action', action.id);

			if (!isValidActionStatusTransition(action.status, 'COMPLETED')) {
				throw errors.BAD_REQUEST({ message: `Cannot complete action in status ${action.status}` });
			}

			const now = new Date();
			const updated = await prisma.conciergeAction.update({
				where: { id: input.id },
				data: {
					status: 'COMPLETED',
					completedAt: now,
					outcome: input.outcome,
					notes: input.notes ?? action.notes
				}
			});

			await prisma.conciergeActionLog.create({
				data: {
					actionId: action.id,
					eventType: 'completed',
					fromStatus: action.status,
					toStatus: 'COMPLETED',
					description: `Action completed with outcome: ${input.outcome.substring(0, 100)}`,
					changedBy: context.user.id
				}
			});

			// Record activity event
			await recordExecution(context, {
				entityType: 'CONCIERGE_ACTION',
				entityId: action.id,
				action: 'COMPLETE',
				summary: `Action completed: ${input.outcome.substring(0, 100)}`,
				caseId: action.caseId,
				previousState: { status: action.status },
				newState: { status: 'COMPLETED', outcome: input.outcome }
			});

			return successResponse(
				{
					action: {
						id: updated.id,
						status: updated.status,
						outcome: updated.outcome!,
						completedAt: updated.completedAt!.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * Mark action as blocked
	 */
	block: orgProcedure
		.input(
			z.object({
				id: z.string(),
				reason: z.string().min(1)
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Invalid request' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					action: z.object({
						id: z.string(),
						status: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			const action = await prisma.conciergeAction.findFirst({
				where: { id: input.id, deletedAt: null },
				include: { case: true }
			});

			if (!action || action.case.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'ConciergeAction not found' });
			}

			await context.cerbos.authorize('update', 'concierge_action', action.id);

			if (!isValidActionStatusTransition(action.status, 'BLOCKED')) {
				throw errors.BAD_REQUEST({ message: `Cannot block action in status ${action.status}` });
			}

			const updated = await prisma.conciergeAction.update({
				where: { id: input.id },
				data: {
					status: 'BLOCKED',
					notes: input.reason
				}
			});

			await prisma.conciergeActionLog.create({
				data: {
					actionId: action.id,
					eventType: 'blocked',
					fromStatus: action.status,
					toStatus: 'BLOCKED',
					description: `Action blocked: ${input.reason}`,
					changedBy: context.user.id
				}
			});

			// Record activity event
			await recordExecution(context, {
				entityType: 'CONCIERGE_ACTION',
				entityId: action.id,
				action: 'STATUS_CHANGE',
				summary: `Action blocked: ${input.reason}`,
				caseId: action.caseId,
				previousState: { status: action.status },
				newState: { status: 'BLOCKED', reason: input.reason }
			});

			return successResponse(
				{
					action: {
						id: updated.id,
						status: updated.status
					}
				},
				context
			);
		}),

	/**
	 * Cancel an action
	 */
	cancel: orgProcedure
		.input(
			z.object({
				id: z.string(),
				reason: z.string().min(1)
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Invalid request' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					action: z.object({
						id: z.string(),
						status: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			const action = await prisma.conciergeAction.findFirst({
				where: { id: input.id, deletedAt: null },
				include: { case: true }
			});

			if (!action || action.case.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'ConciergeAction not found' });
			}

			await context.cerbos.authorize('delete', 'concierge_action', action.id);

			if (!isValidActionStatusTransition(action.status, 'CANCELLED')) {
				throw errors.BAD_REQUEST({ message: `Cannot cancel action in status ${action.status}` });
			}

			const updated = await prisma.conciergeAction.update({
				where: { id: input.id },
				data: { status: 'CANCELLED' }
			});

			await prisma.conciergeActionLog.create({
				data: {
					actionId: action.id,
					eventType: 'cancelled',
					fromStatus: action.status,
					toStatus: 'CANCELLED',
					description: `Action cancelled: ${input.reason}`,
					changedBy: context.user.id
				}
			});

			// Record activity event
			await recordExecution(context, {
				entityType: 'CONCIERGE_ACTION',
				entityId: action.id,
				action: 'CANCEL',
				summary: `Action cancelled: ${input.reason}`,
				caseId: action.caseId,
				previousState: { status: action.status },
				newState: { status: 'CANCELLED', reason: input.reason }
			});

			return successResponse(
				{
					action: {
						id: updated.id,
						status: updated.status
					}
				},
				context
			);
		}),

	/**
	 * Resume a blocked action
	 */
	resume: orgProcedure
		.input(
			z.object({
				id: z.string(),
				notes: z.string().optional()
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Invalid request' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					action: z.object({
						id: z.string(),
						status: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			const action = await prisma.conciergeAction.findFirst({
				where: { id: input.id, deletedAt: null },
				include: { case: true }
			});

			if (!action || action.case.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'ConciergeAction not found' });
			}

			await context.cerbos.authorize('update', 'concierge_action', action.id);

			if (action.status !== 'BLOCKED') {
				throw errors.BAD_REQUEST({ message: 'Can only resume blocked actions' });
			}

			const updated = await prisma.conciergeAction.update({
				where: { id: input.id },
				data: {
					status: 'IN_PROGRESS',
					notes: input.notes ?? action.notes
				}
			});

			await prisma.conciergeActionLog.create({
				data: {
					actionId: action.id,
					eventType: 'resumed',
					fromStatus: 'BLOCKED',
					toStatus: 'IN_PROGRESS',
					description: input.notes ?? 'Action resumed',
					changedBy: context.user.id
				}
			});

			// Record activity event
			await recordExecution(context, {
				entityType: 'CONCIERGE_ACTION',
				entityId: action.id,
				action: 'STATUS_CHANGE',
				summary: `Action resumed`,
				caseId: action.caseId,
				previousState: { status: 'BLOCKED' },
				newState: { status: 'IN_PROGRESS' }
			});

			return successResponse(
				{
					action: {
						id: updated.id,
						status: updated.status
					}
				},
				context
			);
		}),

	/**
	 * Add a log entry to an action
	 */
	addLog: orgProcedure
		.input(
			z.object({
				actionId: z.string(),
				eventType: z.string().min(1),
				description: z.string().min(1)
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					log: z.object({
						id: z.string(),
						actionId: z.string(),
						eventType: z.string(),
						description: z.string(),
						createdAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			const action = await prisma.conciergeAction.findFirst({
				where: { id: input.actionId, deletedAt: null },
				include: { case: true }
			});

			if (!action || action.case.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'ConciergeAction not found' });
			}

			await context.cerbos.authorize('update', 'concierge_action', action.id);

			const log = await prisma.conciergeActionLog.create({
				data: {
					actionId: input.actionId,
					eventType: input.eventType,
					description: input.description,
					changedBy: context.user.id
				}
			});

			return successResponse(
				{
					log: {
						id: log.id,
						actionId: log.actionId,
						eventType: log.eventType,
						description: log.description!,
						createdAt: log.createdAt.toISOString()
					}
				},
				context
			);
		})
};
