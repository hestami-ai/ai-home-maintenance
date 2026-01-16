/**
 * Concierge Action Execution Workflow (v1)
 *
 * DBOS durable workflow for concierge action management.
 * Handles: action planning, execution tracking, outcome recording.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { orgTransaction } from '../db/rls.js';
import type { ConciergeActionType } from '../../../../generated/prisma/client.js';
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
	CANCEL_ACTION: 'CANCEL_ACTION',
	ADD_LOG: 'ADD_LOG'
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
	// Additional fields for create
	relatedDocumentIds?: string[];
	relatedExternalContactIds?: string[];
	// Fields for addLog
	eventType?: string;
	logDescription?: string;
}

export interface ConciergeActionWorkflowResult extends LifecycleWorkflowResult {
	actionId?: string;
	status?: string;
	startedAt?: string;
	completedAt?: string;
	outcome?: string;
	logId?: string;
	caseId?: string;
	actionType?: string;
	description?: string;
	plannedAt?: string | null;
	createdAt?: string;
}

const VALID_ACTION_STATUS_TRANSITIONS: Record<string, string[]> = {
	PLANNED: ['IN_PROGRESS', 'CANCELLED'],
	IN_PROGRESS: ['COMPLETED', 'BLOCKED', 'CANCELLED'],
	BLOCKED: ['IN_PROGRESS', 'CANCELLED'],
	COMPLETED: [],
	CANCELLED: []
};

async function createAction(
	organizationId: string,
	caseId: string,
	actionType: ConciergeActionType,
	description: string,
	userId: string,
	plannedAt?: string,
	notes?: string,
	relatedDocumentIds?: string[],
	relatedExternalContactIds?: string[]
): Promise<{ id: string; status: string; caseId: string; actionType: string; description: string; plannedAt: string | null; createdAt: string }> {
	return orgTransaction(organizationId, async (tx) => {
		const action = await tx.conciergeAction.create({
			data: {
				caseId,
				actionType,
				description,
				status: 'PLANNED',
				performedByUserId: userId,
				plannedAt: plannedAt ? new Date(plannedAt) : null,
				notes,
				relatedDocumentIds: relatedDocumentIds ?? [],
				relatedExternalContactIds: relatedExternalContactIds ?? []
			}
		});

		await tx.conciergeActionLog.create({
			data: {
				actionId: action.id,
				eventType: 'created',
				toStatus: 'PLANNED',
				description: 'Action created',
				changedBy: userId
			}
		});

		log.info('Concierge action created', { actionId: action.id, caseId, actionType });

		return {
			id: action.id,
			status: action.status,
			caseId: action.caseId,
			actionType: action.actionType,
			description: action.description,
			plannedAt: action.plannedAt?.toISOString() ?? null,
			createdAt: action.createdAt.toISOString()
		};
	}, { userId, reason: 'Create concierge action' });
}

async function addActionLog(
	organizationId: string,
	actionId: string,
	eventType: string,
	logDescription: string,
	userId: string
): Promise<{ logId: string; actionId: string; eventType: string; description: string; createdAt: string }> {
	return orgTransaction(organizationId, async (tx) => {
		const logEntry = await tx.conciergeActionLog.create({
			data: {
				actionId,
				eventType,
				description: logDescription,
				changedBy: userId
			}
		});

		log.info('Concierge action log added', { logId: logEntry.id, actionId, eventType });

		return {
			logId: logEntry.id,
			actionId: logEntry.actionId,
			eventType: logEntry.eventType,
			description: logEntry.description!,
			createdAt: logEntry.createdAt.toISOString()
		};
	}, { userId, reason: 'Add concierge action log' });
}

async function startAction(organizationId: string, actionId: string, userId: string): Promise<{ status: string; startedAt: string }> {
	return orgTransaction(organizationId, async (tx) => {
		const action = await tx.conciergeAction.findUnique({
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
		await tx.conciergeAction.update({
			where: { id: actionId },
			data: { status: 'IN_PROGRESS', startedAt: now }
		});

		await tx.conciergeActionLog.create({
			data: {
				actionId,
				eventType: 'status_change',
				fromStatus: action.status,
				toStatus: 'IN_PROGRESS',
				description: 'Action started',
				changedBy: userId
			}
		});

		log.info('Concierge action started', { actionId, fromStatus: action.status });

		return { status: 'IN_PROGRESS', startedAt: now.toISOString() };
	}, { userId, reason: 'Start concierge action' });
}

async function completeAction(
	organizationId: string,
	actionId: string,
	outcome: string,
	userId: string,
	notes?: string
): Promise<{ status: string; completedAt: string; outcome: string }> {
	return orgTransaction(organizationId, async (tx) => {
		const action = await tx.conciergeAction.findUnique({
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
		await tx.conciergeAction.update({
			where: { id: actionId },
			data: {
				status: 'COMPLETED',
				completedAt: now,
				outcome,
				notes: notes ?? action.notes
			}
		});

		await tx.conciergeActionLog.create({
			data: {
				actionId,
				eventType: 'completed',
				fromStatus: action.status,
				toStatus: 'COMPLETED',
				description: `Action completed: ${outcome.substring(0, 100)}`,
				changedBy: userId
			}
		});

		log.info('Concierge action completed', { actionId, fromStatus: action.status, outcome: outcome.substring(0, 50) });

		return { status: 'COMPLETED', completedAt: now.toISOString(), outcome };
	}, { userId, reason: 'Complete concierge action' });
}

async function blockAction(
	organizationId: string,
	actionId: string,
	blockReason: string,
	userId: string
): Promise<{ status: string }> {
	return orgTransaction(organizationId, async (tx) => {
		const action = await tx.conciergeAction.findUnique({
			where: { id: actionId }
		});

		if (!action) {
			throw new Error('Action not found');
		}

		const validTransitions = VALID_ACTION_STATUS_TRANSITIONS[action.status] || [];
		if (!validTransitions.includes('BLOCKED')) {
			throw new Error(`Cannot block action in status ${action.status}`);
		}

		await tx.conciergeAction.update({
			where: { id: actionId },
			data: { status: 'BLOCKED', notes: blockReason }
		});

		await tx.conciergeActionLog.create({
			data: {
				actionId,
				eventType: 'blocked',
				fromStatus: action.status,
				toStatus: 'BLOCKED',
				description: `Action blocked: ${blockReason}`,
				changedBy: userId
			}
		});

		log.info('Concierge action blocked', { actionId, fromStatus: action.status, blockReason });

		return { status: 'BLOCKED' };
	}, { userId, reason: 'Block concierge action' });
}

async function resumeAction(organizationId: string, actionId: string, userId: string, notes?: string): Promise<{ status: string }> {
	return orgTransaction(organizationId, async (tx) => {
		const action = await tx.conciergeAction.findUnique({
			where: { id: actionId }
		});

		if (!action) {
			throw new Error('Action not found');
		}

		if (action.status !== 'BLOCKED') {
			throw new Error('Can only resume blocked actions');
		}

		await tx.conciergeAction.update({
			where: { id: actionId },
			data: { status: 'IN_PROGRESS', notes: notes ?? action.notes }
		});

		await tx.conciergeActionLog.create({
			data: {
				actionId,
				eventType: 'resumed',
				fromStatus: 'BLOCKED',
				toStatus: 'IN_PROGRESS',
				description: notes ?? 'Action resumed',
				changedBy: userId
			}
		});

		log.info('Concierge action resumed', { actionId });

		return { status: 'IN_PROGRESS' };
	}, { userId, reason: 'Resume concierge action' });
}

async function cancelAction(
	organizationId: string,
	actionId: string,
	cancelReason: string,
	userId: string
): Promise<{ status: string }> {
	return orgTransaction(organizationId, async (tx) => {
		const action = await tx.conciergeAction.findUnique({
			where: { id: actionId }
		});

		if (!action) {
			throw new Error('Action not found');
		}

		const validTransitions = VALID_ACTION_STATUS_TRANSITIONS[action.status] || [];
		if (!validTransitions.includes('CANCELLED')) {
			throw new Error(`Cannot cancel action in status ${action.status}`);
		}

		await tx.conciergeAction.update({
			where: { id: actionId },
			data: { status: 'CANCELLED' }
		});

		await tx.conciergeActionLog.create({
			data: {
				actionId,
				eventType: 'cancelled',
				fromStatus: action.status,
				toStatus: 'CANCELLED',
				description: `Action cancelled: ${cancelReason}`,
				changedBy: userId
			}
		});

		log.info('Concierge action cancelled', { actionId, fromStatus: action.status, cancelReason });

		return { status: 'CANCELLED' };
	}, { userId, reason: 'Cancel concierge action' });
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
							input.organizationId,
							input.caseId!,
							input.actionType!,
							input.description!,
							input.userId,
							input.plannedAt,
							input.notes,
							input.relatedDocumentIds,
							input.relatedExternalContactIds
						),
					{ name: 'createAction' }
				);
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'action_created', ...result });
				return {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					actionId: result.id,
					status: result.status,
					caseId: result.caseId,
					actionType: result.actionType,
					description: result.description,
					plannedAt: result.plannedAt,
					createdAt: result.createdAt
				};
			}

			case 'START_ACTION': {
				if (!input.actionId) {
					throw new Error('Missing actionId for START_ACTION');
				}
				const result = await DBOS.runStep(() => startAction(input.organizationId, input.actionId!, input.userId), {
					name: 'startAction'
				});
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'action_started', ...result });
				return {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					actionId: input.actionId,
					status: result.status,
					startedAt: result.startedAt
				};
			}

			case 'COMPLETE_ACTION': {
				if (!input.actionId || !input.outcome) {
					throw new Error('Missing actionId or outcome for COMPLETE_ACTION');
				}
				const result = await DBOS.runStep(
					() => completeAction(input.organizationId, input.actionId!, input.outcome!, input.userId, input.notes),
					{ name: 'completeAction' }
				);
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'action_completed', ...result });
				return {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					actionId: input.actionId,
					status: result.status,
					completedAt: result.completedAt,
					outcome: result.outcome
				};
			}

			case 'BLOCK_ACTION': {
				if (!input.actionId || !input.blockReason) {
					throw new Error('Missing actionId or blockReason for BLOCK_ACTION');
				}
				const result = await DBOS.runStep(
					() => blockAction(input.organizationId, input.actionId!, input.blockReason!, input.userId),
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
					() => resumeAction(input.organizationId, input.actionId!, input.userId, input.notes),
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
					() => cancelAction(input.organizationId, input.actionId!, input.cancelReason!, input.userId),
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

			case 'ADD_LOG': {
				if (!input.actionId || !input.eventType || !input.logDescription) {
					throw new Error('Missing actionId, eventType or logDescription for ADD_LOG');
				}
				const result = await DBOS.runStep(
					() => addActionLog(input.organizationId, input.actionId!, input.eventType!, input.logDescription!, input.userId),
					{ name: 'addActionLog' }
				);
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'log_added', ...result });
				return {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					actionId: input.actionId,
					logId: result.logId
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
	idempotencyKey: string
): Promise<ConciergeActionWorkflowResult> {
	const handle = await DBOS.startWorkflow(conciergeActionWorkflow_v1, { workflowID: idempotencyKey })(input);
	return handle.getResult();
}

export async function getConciergeActionWorkflowStatus(
	workflowId: string
): Promise<{ step: string;[key: string]: unknown } | null> {
	const status = await DBOS.getEvent(workflowId, WORKFLOW_STATUS_EVENT, 0);
	return status as { step: string;[key: string]: unknown } | null;
}

