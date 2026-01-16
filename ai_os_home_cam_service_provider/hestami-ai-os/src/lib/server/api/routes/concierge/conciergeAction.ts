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
import { startConciergeActionWorkflow } from '../../../workflows/index.js';

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

			// Use DBOS workflow for durable execution
			const workflowResult = await startConciergeActionWorkflow(
				{
					action: 'CREATE_ACTION',
					organizationId: context.organization.id,
					userId: context.user.id,
					caseId: input.caseId,
					actionType: input.actionType,
					description: input.description,
					plannedAt: input.plannedAt,
					notes: input.notes,
					relatedDocumentIds: input.relatedDocumentIds,
					relatedExternalContactIds: input.relatedExternalContactIds
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.FORBIDDEN({ message: workflowResult.error || 'Failed to create action' });
			}

			// Record activity event
			await recordDecision(context, {
				entityType: 'CONCIERGE_ACTION',
				entityId: workflowResult.actionId!,
				action: 'CREATE',
				summary: `Action planned: ${input.actionType} - ${input.description}`,
				caseId: input.caseId,
				newState: {
					actionType: workflowResult.actionType,
					status: workflowResult.status,
					description: workflowResult.description
				}
			});

			return successResponse(
				{
					action: {
						id: workflowResult.actionId!,
						caseId: workflowResult.caseId!,
						actionType: workflowResult.actionType!,
						status: workflowResult.status!,
						description: workflowResult.description!,
						plannedAt: workflowResult.plannedAt ?? null,
						createdAt: workflowResult.createdAt!
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
			// Defense in depth: explicit org filter via case relationship for connection pool safety
			const action = await prisma.conciergeAction.findFirst({
				where: {
					id: input.id,
					deletedAt: null,
					case: { organizationId: context.organization.id, deletedAt: null }
				},
				include: {
					case: true,
					logs: { orderBy: { createdAt: 'desc' } }
				}
			});

			if (!action) {
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
				case: { organizationId: context.organization.id },
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
		.input(IdempotencyKeySchema.extend({ id: z.string() }))
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
			// Defense in depth: explicit org filter via case relationship for connection pool safety
			const action = await prisma.conciergeAction.findFirst({
				where: {
					id: input.id,
					deletedAt: null,
					case: { organizationId: context.organization.id, deletedAt: null }
				},
				include: { case: true }
			});

			if (!action) {
				throw errors.NOT_FOUND({ message: 'ConciergeAction not found' });
			}

			await context.cerbos.authorize('update', 'concierge_action', action.id);

			if (!isValidActionStatusTransition(action.status, 'IN_PROGRESS')) {
				throw errors.BAD_REQUEST({ message: `Cannot start action in status ${action.status}` });
			}

			// Use DBOS workflow for durable execution
			const workflowResult = await startConciergeActionWorkflow(
				{
					action: 'START_ACTION',
					organizationId: context.organization.id,
					userId: context.user.id,
					actionId: input.id
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.BAD_REQUEST({ message: workflowResult.error || 'Failed to start action' });
			}

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
						id: input.id,
						status: workflowResult.status!,
						startedAt: workflowResult.startedAt!
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
			IdempotencyKeySchema.extend({
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
			// Defense in depth: explicit org filter via case relationship for connection pool safety
			const action = await prisma.conciergeAction.findFirst({
				where: {
					id: input.id,
					deletedAt: null,
					case: { organizationId: context.organization.id, deletedAt: null }
				},
				include: { case: true }
			});

			if (!action) {
				throw errors.NOT_FOUND({ message: 'ConciergeAction not found' });
			}

			await context.cerbos.authorize('update', 'concierge_action', action.id);

			if (!isValidActionStatusTransition(action.status, 'COMPLETED')) {
				throw errors.BAD_REQUEST({ message: `Cannot complete action in status ${action.status}` });
			}

			// Use DBOS workflow for durable execution
			const workflowResult = await startConciergeActionWorkflow(
				{
					action: 'COMPLETE_ACTION',
					organizationId: context.organization.id,
					userId: context.user.id,
					actionId: input.id,
					outcome: input.outcome,
					notes: input.notes
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.BAD_REQUEST({ message: workflowResult.error || 'Failed to complete action' });
			}

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
						id: input.id,
						status: workflowResult.status!,
						outcome: workflowResult.outcome!,
						completedAt: workflowResult.completedAt!
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
			IdempotencyKeySchema.extend({
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
			// Defense in depth: explicit org filter via case relationship for connection pool safety
			const action = await prisma.conciergeAction.findFirst({
				where: {
					id: input.id,
					deletedAt: null,
					case: { organizationId: context.organization.id, deletedAt: null }
				},
				include: { case: true }
			});

			if (!action) {
				throw errors.NOT_FOUND({ message: 'ConciergeAction not found' });
			}

			await context.cerbos.authorize('update', 'concierge_action', action.id);

			if (!isValidActionStatusTransition(action.status, 'BLOCKED')) {
				throw errors.BAD_REQUEST({ message: `Cannot block action in status ${action.status}` });
			}

			// Use DBOS workflow for durable execution
			const workflowResult = await startConciergeActionWorkflow(
				{
					action: 'BLOCK_ACTION',
					organizationId: context.organization.id,
					userId: context.user.id,
					actionId: input.id,
					blockReason: input.reason
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.BAD_REQUEST({ message: workflowResult.error || 'Failed to block action' });
			}

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
						id: input.id,
						status: workflowResult.status!
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
			IdempotencyKeySchema.extend({
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
			// Defense in depth: explicit org filter via case relationship for connection pool safety
			const action = await prisma.conciergeAction.findFirst({
				where: {
					id: input.id,
					deletedAt: null,
					case: { organizationId: context.organization.id, deletedAt: null }
				},
				include: { case: true }
			});

			if (!action) {
				throw errors.NOT_FOUND({ message: 'ConciergeAction not found' });
			}

			await context.cerbos.authorize('delete', 'concierge_action', action.id);

			if (!isValidActionStatusTransition(action.status, 'CANCELLED')) {
				throw errors.BAD_REQUEST({ message: `Cannot cancel action in status ${action.status}` });
			}

			// Use DBOS workflow for durable execution
			const workflowResult = await startConciergeActionWorkflow(
				{
					action: 'CANCEL_ACTION',
					organizationId: context.organization.id,
					userId: context.user.id,
					actionId: input.id,
					cancelReason: input.reason
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.BAD_REQUEST({ message: workflowResult.error || 'Failed to cancel action' });
			}

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
						id: input.id,
						status: workflowResult.status!
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
			IdempotencyKeySchema.extend({
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
			// Defense in depth: explicit org filter via case relationship for connection pool safety
			const action = await prisma.conciergeAction.findFirst({
				where: {
					id: input.id,
					deletedAt: null,
					case: { organizationId: context.organization.id, deletedAt: null }
				},
				include: { case: true }
			});

			if (!action) {
				throw errors.NOT_FOUND({ message: 'ConciergeAction not found' });
			}

			await context.cerbos.authorize('update', 'concierge_action', action.id);

			if (action.status !== 'BLOCKED') {
				throw errors.BAD_REQUEST({ message: 'Can only resume blocked actions' });
			}

			// Use DBOS workflow for durable execution
			const workflowResult = await startConciergeActionWorkflow(
				{
					action: 'RESUME_ACTION',
					organizationId: context.organization.id,
					userId: context.user.id,
					actionId: input.id,
					notes: input.notes
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.BAD_REQUEST({ message: workflowResult.error || 'Failed to resume action' });
			}

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
						id: input.id,
						status: workflowResult.status!
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
			IdempotencyKeySchema.extend({
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
			// Defense in depth: explicit org filter via case relationship for connection pool safety
			const action = await prisma.conciergeAction.findFirst({
				where: {
					id: input.actionId,
					deletedAt: null,
					case: { organizationId: context.organization.id, deletedAt: null }
				},
				include: { case: true }
			});

			if (!action) {
				throw errors.NOT_FOUND({ message: 'ConciergeAction not found' });
			}

			await context.cerbos.authorize('update', 'concierge_action', action.id);

			// Use DBOS workflow for durable execution
			const workflowResult = await startConciergeActionWorkflow(
				{
					action: 'ADD_LOG',
					organizationId: context.organization.id,
					userId: context.user.id,
					actionId: input.actionId,
					eventType: input.eventType,
					logDescription: input.description
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.FORBIDDEN({ message: workflowResult.error || 'Failed to add log' });
			}

			return successResponse(
				{
					log: {
						id: workflowResult.logId!,
						actionId: input.actionId,
						eventType: input.eventType,
						description: input.description,
						createdAt: new Date().toISOString()
					}
				},
				context
			);
		})
};
