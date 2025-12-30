/**
 * Concierge Action Execution Workflow (v1)
 *
 * DBOS durable workflow for concierge action management.
 * Handles: action planning, execution tracking, outcome recording.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import type { ConciergeActionType, ConciergeActionStatus } from '../../../../generated/prisma/client.js';
import { type LifecycleWorkflowResult } from './schemas.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger } from './workflowLogger.js';

const log = createWorkflowLogger('ConciergeActionWorkflow');

const WORKFLOW_STATUS_EVENT = 'concierge_action_status';
const WORKFLOW_ERROR_EVENT = 'concierge_action_error';

export const ConciergeActionAction = {
	CREATE_ACTION: 'CREATE_ACTION',
	START_ACTION: 'START_ACTION',
	COMPLETE_ACTION: 'COMPLETE_ACTION',
	BLOCK_ACTION: 'BLOCK_ACTION',
	RESUME_ACTION: 'RESUME_ACTION',
	CANCEL_ACTION: 'CANCEL_ACTION'
} as const;

export type ConciergeActionAction = (typeof ConciergeActionAction)[keyof typeof ConciergeActionAction];

export interface ConciergeActionWorkflowInput {
	action: ConciergeActionAction;
	organizationId: string;
	userId: string;
	actionId?: string;
	caseId?: string;
	actionType?: ConciergeActionType;
	description?: string;
	plannedAt?: string;
	outcome?: string;
	blockReason?: string;
	cancelReason?: string;
	notes?: string;
}

export interface ConciergeActionWorkflowResult extends LifecycleWorkflowResult {
	actionId?: string;
	status?: string;
}

const VALID_ACTION_STATUS_TRANSITIONS: Record<string, string[]> = {
	PLANNED: ['IN_PROGRESS', 'CANCELLED'],
	IN_PROGRESS: ['COMPLETED', 'BLOCKED', 'CANCELLED'],
	BLOCKED: ['IN_PROGRESS', 'CANCELLED'],
	COMPLETED: [],
	CANCELLED: []
};

async function createAction(
	caseId: string,
	actionType: ConciergeActionType,
	description: string,
	userId: string,
	plannedAt?: string,
	notes?: string
): Promise<{ id: string; status: string }> {
	const action = await prisma.conciergeAction.create({
		data: {
			caseId,
			actionType,
			description,
			status: 'PLANNED',
			performedByUserId: userId,
			plannedAt: plannedAt ? new Date(plannedAt) : null,
			notes
		}
	});

	await prisma.conciergeActionLog.create({
		data: {
			actionId: action.id,
			eventType: 'created',
			toStatus: 'PLANNED',
			description: 'Action created',
			changedBy: userId
		}
	});

	return { id: action.id, status: action.status };
}

async function startAction(actionId: string, userId: string): Promise<{ status: string; startedAt: string }> {
	const action = await prisma.conciergeAction.findUnique({
		where: { id: actionId }
	});

	if (!action) {
		throw new Error('Action not found');
	}

	const validTransitions = VALID_ACTION_STATUS_TRANSITIONS[action.status] || [];
	if (!validTransitions.includes('IN_PROGRESS')) {
		throw new Error(`Cannot start action in status ${action.status}`);
	}

	const now = new Date();
	await prisma.conciergeAction.update({
		where: { id: actionId },
		data: { status: 'IN_PROGRESS', startedAt: now }
	});

	await prisma.conciergeActionLog.create({
		data: {
			actionId,
			eventType: 'status_change',
			fromStatus: action.status,
			toStatus: 'IN_PROGRESS',
			description: 'Action started',
			changedBy: userId
		}
	});

	return { status: 'IN_PROGRESS', startedAt: now.toISOString() };
}

async function completeAction(
	actionId: string,
	outcome: string,
	userId: string,
	notes?: string
): Promise<{ status: string; completedAt: string }> {
	const action = await prisma.conciergeAction.findUnique({
		where: { id: actionId }
	});

	if (!action) {
		throw new Error('Action not found');
	}

	const validTransitions = VALID_ACTION_STATUS_TRANSITIONS[action.status] || [];
	if (!validTransitions.includes('COMPLETED')) {
		throw new Error(`Cannot complete action in status ${action.status}`);
	}

	const now = new Date();
	await prisma.conciergeAction.update({
		where: { id: actionId },
		data: {
			status: 'COMPLETED',
			completedAt: now,
			outcome,
			notes: notes ?? action.notes
		}
	});

	await prisma.conciergeActionLog.create({
		data: {
			actionId,
			eventType: 'completed',
			fromStatus: action.status,
			toStatus: 'COMPLETED',
			description: `Action completed: ${outcome.substring(0, 100)}`,
			changedBy: userId
		}
	});

	return { status: 'COMPLETED', completedAt: now.toISOString() };
}

async function blockAction(
	actionId: string,
	blockReason: string,
	userId: string
): Promise<{ status: string }> {
	const action = await prisma.conciergeAction.findUnique({
		where: { id: actionId }
	});

	if (!action) {
		throw new Error('Action not found');
	}

	const validTransitions = VALID_ACTION_STATUS_TRANSITIONS[action.status] || [];
	if (!validTransitions.includes('BLOCKED')) {
		throw new Error(`Cannot block action in status ${action.status}`);
	}

	await prisma.conciergeAction.update({
		where: { id: actionId },
		data: { status: 'BLOCKED', notes: blockReason }
	});

	await prisma.conciergeActionLog.create({
		data: {
			actionId,
			eventType: 'blocked',
			fromStatus: action.status,
			toStatus: 'BLOCKED',
			description: `Action blocked: ${blockReason}`,
			changedBy: userId
		}
	});

	return { status: 'BLOCKED' };
}

async function resumeAction(actionId: string, userId: string, notes?: string): Promise<{ status: string }> {
	const action = await prisma.conciergeAction.findUnique({
		where: { id: actionId }
	});

	if (!action) {
		throw new Error('Action not found');
	}

	if (action.status !== 'BLOCKED') {
		throw new Error('Can only resume blocked actions');
	}

	await prisma.conciergeAction.update({
		where: { id: actionId },
		data: { status: 'IN_PROGRESS', notes: notes ?? action.notes }
	});

	await prisma.conciergeActionLog.create({
		data: {
			actionId,
			eventType: 'resumed',
			fromStatus: 'BLOCKED',
			toStatus: 'IN_PROGRESS',
			description: notes ?? 'Action resumed',
			changedBy: userId
		}
	});

	return { status: 'IN_PROGRESS' };
}

async function cancelAction(
	actionId: string,
	cancelReason: string,
	userId: string
): Promise<{ status: string }> {
	const action = await prisma.conciergeAction.findUnique({
		where: { id: actionId }
	});

	if (!action) {
		throw new Error('Action not found');
	}

	const validTransitions = VALID_ACTION_STATUS_TRANSITIONS[action.status] || [];
	if (!validTransitions.includes('CANCELLED')) {
		throw new Error(`Cannot cancel action in status ${action.status}`);
	}

	await prisma.conciergeAction.update({
		where: { id: actionId },
		data: { status: 'CANCELLED' }
	});

	await prisma.conciergeActionLog.create({
		data: {
			actionId,
			eventType: 'cancelled',
			fromStatus: action.status,
			toStatus: 'CANCELLED',
			description: `Action cancelled: ${cancelReason}`,
			changedBy: userId
		}
	});

	return { status: 'CANCELLED' };
}

async function conciergeActionWorkflow(
	input: ConciergeActionWorkflowInput
): Promise<ConciergeActionWorkflowResult> {
	try {
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'started', action: input.action });

		switch (input.action) {
			case 'CREATE_ACTION': {
				if (!input.caseId || !input.actionType || !input.description) {
					throw new Error('Missing required fields for CREATE_ACTION');
				}
				const result = await DBOS.runStep(
					() =>
						createAction(
							input.caseId!,
							input.actionType!,
							input.description!,
							input.userId,
							input.plannedAt,
							input.notes
						),
					{ name: 'createAction' }
				);
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'action_created', ...result });
				return {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					actionId: result.id,
					status: result.status
				};
			}

			case 'START_ACTION': {
				if (!input.actionId) {
					throw new Error('Missing actionId for START_ACTION');
				}
				const result = await DBOS.runStep(() => startAction(input.actionId!, input.userId), {
					name: 'startAction'
				});
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'action_started', ...result });
				return {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					actionId: input.actionId,
					status: result.status
				};
			}

			case 'COMPLETE_ACTION': {
				if (!input.actionId || !input.outcome) {
					throw new Error('Missing actionId or outcome for COMPLETE_ACTION');
				}
				const result = await DBOS.runStep(
					() => completeAction(input.actionId!, input.outcome!, input.userId, input.notes),
					{ name: 'completeAction' }
				);
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'action_completed', ...result });
				return {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					actionId: input.actionId,
					status: result.status
				};
			}

			case 'BLOCK_ACTION': {
				if (!input.actionId || !input.blockReason) {
					throw new Error('Missing actionId or blockReason for BLOCK_ACTION');
				}
				const result = await DBOS.runStep(
					() => blockAction(input.actionId!, input.blockReason!, input.userId),
					{ name: 'blockAction' }
				);
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'action_blocked', ...result });
				return {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					actionId: input.actionId,
					status: result.status
				};
			}

			case 'RESUME_ACTION': {
				if (!input.actionId) {
					throw new Error('Missing actionId for RESUME_ACTION');
				}
				const result = await DBOS.runStep(
					() => resumeAction(input.actionId!, input.userId, input.notes),
					{ name: 'resumeAction' }
				);
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'action_resumed', ...result });
				return {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					actionId: input.actionId,
					status: result.status
				};
			}

			case 'CANCEL_ACTION': {
				if (!input.actionId || !input.cancelReason) {
					throw new Error('Missing actionId or cancelReason for CANCEL_ACTION');
				}
				const result = await DBOS.runStep(
					() => cancelAction(input.actionId!, input.cancelReason!, input.userId),
					{ name: 'cancelAction' }
				);
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'action_cancelled', ...result });
				return {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					actionId: input.actionId,
					status: result.status
				};
			}

			default:
				return {
					success: false,
					action: input.action,
					timestamp: new Date().toISOString(),
					error: `Unknown action: ${input.action}`
				};
		}
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;
		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'CONCIERGE_ACTION_WORKFLOW_ERROR'
		});

		return {
			success: false,
			action: input.action,
			timestamp: new Date().toISOString(),
			error: errorMessage
		};
	}
}

export const conciergeActionWorkflow_v1 = DBOS.registerWorkflow(conciergeActionWorkflow);

export async function startConciergeActionWorkflow(
	input: ConciergeActionWorkflowInput,
	workflowId?: string
): Promise<{ workflowId: string }> {
	const id =
		workflowId ||
		`action-${input.action.toLowerCase()}-${input.actionId || input.caseId || 'new'}-${Date.now()}`;
	await DBOS.startWorkflow(conciergeActionWorkflow_v1, { workflowID: id })(input);
	return { workflowId: id };
}

export async function getConciergeActionWorkflowStatus(
	workflowId: string
): Promise<{ step: string;[key: string]: unknown } | null> {
	const status = await DBOS.getEvent(workflowId, WORKFLOW_STATUS_EVENT, 0);
	return status as { step: string;[key: string]: unknown } | null;
}

