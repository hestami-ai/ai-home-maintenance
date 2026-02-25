import { z } from 'zod';
import { ResponseMetaSchema } from '$lib/schemas/index.js';
import { authedProcedure, successResponse, PaginationInputSchema, PaginationOutputSchema, IdempotencyKeySchema } from '../../router.js';
import { prisma } from '../../../db.js';
import { ConciergeActionTypeSchema } from '../../../../../../generated/zod/inputTypeSchemas/ConciergeActionTypeSchema.js';
import { ConciergeActionStatusSchema } from '../../../../../../generated/zod/inputTypeSchemas/ConciergeActionStatusSchema.js';
import type { Prisma } from '../../../../../../generated/prisma/client.js';
import { ConciergeActionStatus, ActivityEntityType, ActivityActionType } from '../../../../../../generated/prisma/enums.js';
import { recordDecision, recordExecution } from '../../middleware/activityEvent.js';
import { createModuleLogger } from '../../../logger.js';
import { startConciergeActionWorkflow, ConciergeActionAction } from '../../../workflows/index.js';
import { lookupWorkItemOrgId, orgTransaction } from '../../../db/rls.js';

const log = createModuleLogger('StaffConciergeActionRoute');

// Valid status transitions for the action state machine
const VALID_ACTION_STATUS_TRANSITIONS: Record<ConciergeActionStatus, ConciergeActionStatus[]> = {
	[ConciergeActionStatus.PLANNED]: [ConciergeActionStatus.IN_PROGRESS, ConciergeActionStatus.CANCELLED],
	[ConciergeActionStatus.IN_PROGRESS]: [ConciergeActionStatus.COMPLETED, ConciergeActionStatus.BLOCKED, ConciergeActionStatus.CANCELLED],
	[ConciergeActionStatus.BLOCKED]: [ConciergeActionStatus.IN_PROGRESS, ConciergeActionStatus.CANCELLED],
	[ConciergeActionStatus.COMPLETED]: [], // Terminal state
	[ConciergeActionStatus.CANCELLED]: [] // Terminal state
};

/**
 * Validate action status transition
 */
function isValidActionStatusTransition(from: ConciergeActionStatus, to: ConciergeActionStatus): boolean {
	return VALID_ACTION_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Ensure case exists and belongs to organization (for staff with cross-org access)
 */
async function ensureCase(caseId: string, errors: any) {
	// For staff, we need to find the case across all organizations using SECURITY DEFINER
	const orgId = await lookupWorkItemOrgId(ActivityEntityType.CONCIERGE_CASE, caseId);
	if (!orgId) {
		throw errors.NOT_FOUND({ message: 'ConciergeCase not found' });
	}
	return orgId;
}

/**
 * Staff Concierge Action management procedures for Phase 3.6
 */
export const staffConciergeActionRouter = {
	/**
	 * Create a new action for a case
	 */
	create: authedProcedure
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
			const orgId = await ensureCase(input.caseId, errors);

			// Use DBOS workflow for durable execution (workflow handles RLS internally via orgTransaction)
			const workflowResult = await startConciergeActionWorkflow(
				{
					action: ConciergeActionAction.CREATE_ACTION,
					organizationId: orgId,
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

			// Record activity event with proper RLS context
			await orgTransaction(orgId, async () => {
				await recordDecision(context, {
					entityType: ActivityEntityType.CONCIERGE_ACTION,
					entityId: workflowResult.actionId!,
					action: ActivityActionType.CREATE,
					summary: `Action planned: ${input.actionType} - ${input.description}`,
					caseId: input.caseId,
					newState: {
						actionType: workflowResult.actionType,
						status: workflowResult.status,
						description: workflowResult.description
					}
				});
			}, { userId: context.user.id, reason: 'Staff creating concierge action - activity event', itemType: ActivityEntityType.CONCIERGE_CASE, itemId: input.caseId });

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
	 * Get a single action by ID (staff version)
	 */
	get: authedProcedure
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
			// Find the action and determine which org it belongs to
			const action = await prisma.conciergeAction.findFirst({
				where: {
					id: input.id,
					deletedAt: null
				},
				include: {
					case: true,
					logs: { orderBy: { createdAt: 'desc' } }
				}
			});

			if (!action) {
				throw errors.NOT_FOUND({ message: 'ConciergeAction not found' });
			}

			const orgId = await lookupWorkItemOrgId(ActivityEntityType.CONCIERGE_CASE, action.caseId);
			if (!orgId) {
				throw errors.NOT_FOUND({ message: 'ConciergeCase not found' });
			}

			// Use orgTransaction to ensure RLS context is set on the same connection
			return await orgTransaction(orgId, async () => {
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
			}, { userId: context.user.id, reason: 'Staff viewing concierge action', itemType: ActivityEntityType.CONCIERGE_CASE, itemId: action.caseId });
		}),

	/**
	 * List actions for a case (staff version)
	 */
	listByCase: authedProcedure
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
			const orgId = await ensureCase(input.caseId, errors);

			// Use orgTransaction to ensure RLS context is set on the same connection
			const result = await orgTransaction(orgId, async () => {
				const where: Prisma.ConciergeActionWhereInput = {
					caseId: input.caseId,
					case: { organizationId: orgId },
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

				return {
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
				};
			}, { userId: context.user.id, reason: 'Staff listing concierge actions', itemType: ActivityEntityType.CONCIERGE_CASE, itemId: input.caseId });

			return successResponse(result, context);
		}),

	/**
	 * Start an action (transition from PLANNED to IN_PROGRESS) - staff version
	 */
	start: authedProcedure
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
			// Find the action and determine which org it belongs to
			const action = await prisma.conciergeAction.findFirst({
				where: {
					id: input.id,
					deletedAt: null
				},
				include: { case: true }
			});

			if (!action) {
				throw errors.NOT_FOUND({ message: 'ConciergeAction not found' });
			}

			const orgId = await lookupWorkItemOrgId(ActivityEntityType.CONCIERGE_CASE, action.caseId);
			if (!orgId) {
				throw errors.NOT_FOUND({ message: 'ConciergeCase not found' });
			}

			// Validate status transition
			if (!isValidActionStatusTransition(action.status, ConciergeActionStatus.IN_PROGRESS)) {
				throw errors.BAD_REQUEST({ message: `Cannot start action in status ${action.status}` });
			}

			// Use DBOS workflow for durable execution (workflow handles RLS internally)
			const workflowResult = await startConciergeActionWorkflow(
				{
					action: ConciergeActionAction.START_ACTION,
					organizationId: orgId,
					userId: context.user.id,
					actionId: input.id
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.BAD_REQUEST({ message: workflowResult.error || 'Failed to start action' });
			}

			// Record activity event with proper RLS context
			await orgTransaction(orgId, async () => {
				await recordExecution(context, {
					entityType: ActivityEntityType.CONCIERGE_ACTION,
					entityId: action.id,
					action: ActivityActionType.STATUS_CHANGE,
					summary: `Action started: ${action.actionType}`,
					caseId: action.caseId,
					previousState: { status: action.status },
					newState: { status: ConciergeActionStatus.IN_PROGRESS }
				});
			}, { userId: context.user.id, reason: 'Staff starting concierge action - activity event', itemType: ActivityEntityType.CONCIERGE_CASE, itemId: action.caseId });

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
	 * Complete an action with outcome (transition to COMPLETED) - staff version
	 */
	complete: authedProcedure
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
			// Find the action and determine which org it belongs to
			const action = await prisma.conciergeAction.findFirst({
				where: {
					id: input.id,
					deletedAt: null
				},
				include: { case: true }
			});

			if (!action) {
				throw errors.NOT_FOUND({ message: 'ConciergeAction not found' });
			}

			const orgId = await lookupWorkItemOrgId(ActivityEntityType.CONCIERGE_CASE, action.caseId);
			if (!orgId) {
				throw errors.NOT_FOUND({ message: 'ConciergeCase not found' });
			}

			// Validate status transition
			if (!isValidActionStatusTransition(action.status, ConciergeActionStatus.COMPLETED)) {
				throw errors.BAD_REQUEST({ message: `Cannot complete action in status ${action.status}` });
			}

			// Use DBOS workflow for durable execution (workflow handles RLS internally)
			const workflowResult = await startConciergeActionWorkflow(
				{
					action: ConciergeActionAction.COMPLETE_ACTION,
					organizationId: orgId,
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

			// Record activity event with proper RLS context
			await orgTransaction(orgId, async () => {
				await recordExecution(context, {
					entityType: ActivityEntityType.CONCIERGE_ACTION,
					entityId: action.id,
					action: ActivityActionType.COMPLETE,
					summary: `Action completed: ${input.outcome.substring(0, 100)}`,
					caseId: action.caseId,
					previousState: { status: action.status },
					newState: { status: ConciergeActionStatus.COMPLETED, outcome: input.outcome }
				});
			}, { userId: context.user.id, reason: 'Staff completing concierge action - activity event', itemType: ActivityEntityType.CONCIERGE_CASE, itemId: action.caseId });

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
	 * Mark action as blocked - staff version
	 */
	block: authedProcedure
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
			// Find the action and determine which org it belongs to
			const action = await prisma.conciergeAction.findFirst({
				where: {
					id: input.id,
					deletedAt: null
				},
				include: { case: true }
			});

			if (!action) {
				throw errors.NOT_FOUND({ message: 'ConciergeAction not found' });
			}

			const orgId = await lookupWorkItemOrgId(ActivityEntityType.CONCIERGE_CASE, action.caseId);
			if (!orgId) {
				throw errors.NOT_FOUND({ message: 'ConciergeCase not found' });
			}

			// Validate status transition
			if (!isValidActionStatusTransition(action.status, ConciergeActionStatus.BLOCKED)) {
				throw errors.BAD_REQUEST({ message: `Cannot block action in status ${action.status}` });
			}

			// Use DBOS workflow for durable execution (workflow handles RLS internally)
			const workflowResult = await startConciergeActionWorkflow(
				{
					action: ConciergeActionAction.BLOCK_ACTION,
					organizationId: orgId,
					userId: context.user.id,
					actionId: input.id,
					blockReason: input.reason
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.BAD_REQUEST({ message: workflowResult.error || 'Failed to block action' });
			}

			// Record activity event with proper RLS context
			await orgTransaction(orgId, async () => {
				await recordExecution(context, {
					entityType: ActivityEntityType.CONCIERGE_ACTION,
					entityId: action.id,
					action: ActivityActionType.STATUS_CHANGE,
					summary: `Action blocked: ${input.reason.substring(0, 100)}`,
					caseId: action.caseId,
					previousState: { status: action.status },
					newState: { status: ConciergeActionStatus.BLOCKED }
				});
			}, { userId: context.user.id, reason: 'Staff blocking concierge action - activity event', itemType: ActivityEntityType.CONCIERGE_CASE, itemId: action.caseId });

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
	 * Cancel an action - staff version
	 */
	cancel: authedProcedure
		.input(
			IdempotencyKeySchema.extend({
				id: z.string(),
				reason: z.string().optional()
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
			// Find the action and determine which org it belongs to
			const action = await prisma.conciergeAction.findFirst({
				where: {
					id: input.id,
					deletedAt: null
				},
				include: { case: true }
			});

			if (!action) {
				throw errors.NOT_FOUND({ message: 'ConciergeAction not found' });
			}

			const orgId = await lookupWorkItemOrgId(ActivityEntityType.CONCIERGE_CASE, action.caseId);
			if (!orgId) {
				throw errors.NOT_FOUND({ message: 'ConciergeCase not found' });
			}

			// Validate status transition
			if (!isValidActionStatusTransition(action.status, ConciergeActionStatus.CANCELLED)) {
				throw errors.BAD_REQUEST({ message: `Cannot cancel action in status ${action.status}` });
			}

			// Use DBOS workflow for durable execution (workflow handles RLS internally)
			const workflowResult = await startConciergeActionWorkflow(
				{
					action: ConciergeActionAction.CANCEL_ACTION,
					organizationId: orgId,
					userId: context.user.id,
					actionId: input.id,
					cancelReason: input.reason
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.BAD_REQUEST({ message: workflowResult.error || 'Failed to cancel action' });
			}

			// Record activity event with proper RLS context
			await orgTransaction(orgId, async () => {
				await recordExecution(context, {
					entityType: ActivityEntityType.CONCIERGE_ACTION,
					entityId: action.id,
					action: ActivityActionType.STATUS_CHANGE,
					summary: `Action cancelled: ${input.reason || 'Cancelled by staff'}`,
					caseId: action.caseId,
					previousState: { status: action.status },
					newState: { status: ConciergeActionStatus.CANCELLED }
				});
			}, { userId: context.user.id, reason: 'Staff cancelling concierge action - activity event', itemType: ActivityEntityType.CONCIERGE_CASE, itemId: action.caseId });

			return successResponse(
				{
					action: {
						id: input.id,
						status: workflowResult.status!
					}
				},
				context
			);
		})
};
