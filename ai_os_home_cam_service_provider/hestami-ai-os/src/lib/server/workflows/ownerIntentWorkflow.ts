/**
 * Owner Intent Workflow (v1)
 *
 * DBOS durable workflow for owner intent management (Phase 3 Concierge).
 * Handles: create, update, submit, acknowledge, convertToCase, decline, withdraw, addNote, delete.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import { Prisma } from '../../../../generated/prisma/client.js';
import type { EntityWorkflowResult } from './schemas.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger, logWorkflowStart, logWorkflowEnd, logStepError } from './workflowLogger.js';

const WORKFLOW_STATUS_EVENT = 'owner_intent_workflow_status';
const WORKFLOW_ERROR_EVENT = 'owner_intent_workflow_error';

// Action types for owner intent operations
export const OwnerIntentWorkflowAction = {
	CREATE: 'CREATE',
	UPDATE: 'UPDATE',
	SUBMIT: 'SUBMIT',
	ACKNOWLEDGE: 'ACKNOWLEDGE',
	CONVERT_TO_CASE: 'CONVERT_TO_CASE',
	DECLINE: 'DECLINE',
	WITHDRAW: 'WITHDRAW',
	ADD_NOTE: 'ADD_NOTE',
	DELETE: 'DELETE'
} as const;

export type OwnerIntentWorkflowAction = (typeof OwnerIntentWorkflowAction)[keyof typeof OwnerIntentWorkflowAction];

export interface OwnerIntentWorkflowInput {
	action: OwnerIntentWorkflowAction;
	organizationId: string;
	userId: string;
	// CREATE fields
	propertyId?: string;
	title?: string;
	description?: string;
	category?: string;
	priority?: string;
	constraints?: Record<string, unknown>;
	attachments?: string[];
	submittedByPartyId?: string;
	// UPDATE/status change fields
	intentId?: string;
	// CONVERT_TO_CASE fields
	caseId?: string;
	// DECLINE/WITHDRAW fields
	reason?: string;
	// ADD_NOTE fields
	content?: string;
	isInternal?: boolean;
}

export interface OwnerIntentWorkflowResult extends EntityWorkflowResult {
	intentId?: string;
	noteId?: string;
	propertyId?: string;
	title?: string;
	category?: string;
	priority?: string;
	status?: string;
	submittedAt?: string;
	acknowledgedAt?: string;
	acknowledgedBy?: string;
	convertedCaseId?: string;
	convertedAt?: string;
	declinedAt?: string;
	declinedBy?: string;
	withdrawnAt?: string;
	deletedAt?: string;
	createdAt?: string;
	updatedAt?: string;
	// Note fields
	noteContent?: string;
	noteIsInternal?: boolean;
	noteCreatedBy?: string;
	noteCreatedAt?: string;
	[key: string]: unknown;
}

// Step functions

async function createIntent(
	input: OwnerIntentWorkflowInput
): Promise<{
	intentId: string;
	propertyId: string;
	title: string;
	category: string;
	priority: string;
	status: string;
	createdAt: string;
}> {
	const intent = await prisma.ownerIntent.create({
		data: {
			organizationId: input.organizationId,
			propertyId: input.propertyId!,
			title: input.title!,
			description: input.description!,
			category: input.category as 'MAINTENANCE' | 'IMPROVEMENT' | 'ISSUE' | 'INQUIRY' | 'EMERGENCY' | 'OTHER',
			priority: (input.priority ?? 'NORMAL') as 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT',
			status: 'DRAFT',
			constraints: (input.constraints ?? undefined) as Prisma.InputJsonValue | undefined,
			attachments: input.attachments,
			submittedByPartyId: input.submittedByPartyId
		}
	});

	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: 'OWNER_INTENT',
		entityId: intent.id,
		action: 'CREATE',
		eventCategory: 'INTENT',
		summary: `Owner intent created: ${input.title}`,
		performedById: input.userId,
		performedByType: 'HUMAN',
		workflowId: 'ownerIntentWorkflow_v1',
		workflowStep: 'CREATE',
		workflowVersion: 'v1',
		propertyId: input.propertyId,
		newState: { title: input.title, category: input.category, priority: input.priority, status: 'DRAFT' }
	});

	return {
		intentId: intent.id,
		propertyId: intent.propertyId,
		title: intent.title,
		category: intent.category,
		priority: intent.priority,
		status: intent.status,
		createdAt: intent.createdAt.toISOString()
	};
}

async function updateIntent(
	input: OwnerIntentWorkflowInput
): Promise<{
	intentId: string;
	title: string;
	category: string;
	priority: string;
	updatedAt: string;
}> {
	const intent = await prisma.ownerIntent.update({
		where: { id: input.intentId },
		data: {
			...(input.title !== undefined && { title: input.title }),
			...(input.description !== undefined && { description: input.description }),
			...(input.category !== undefined && { category: input.category as 'MAINTENANCE' | 'IMPROVEMENT' | 'ISSUE' | 'INQUIRY' | 'EMERGENCY' | 'OTHER' }),
			...(input.priority !== undefined && { priority: input.priority as 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' }),
			...(input.constraints !== undefined && {
				constraints: input.constraints === null
					? Prisma.DbNull
					: (input.constraints as Prisma.InputJsonValue)
			}),
			...(input.attachments !== undefined && {
				attachments: input.attachments === null
					? Prisma.DbNull
					: (input.attachments as Prisma.InputJsonValue)
			})
		}
	});

	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: 'OWNER_INTENT',
		entityId: intent.id,
		action: 'UPDATE',
		eventCategory: 'EXECUTION',
		summary: `Owner intent updated`,
		performedById: input.userId,
		performedByType: 'HUMAN',
		workflowId: 'ownerIntentWorkflow_v1',
		workflowStep: 'UPDATE',
		workflowVersion: 'v1',
		newState: { title: input.title, category: input.category, priority: input.priority }
	});

	return {
		intentId: intent.id,
		title: intent.title,
		category: intent.category,
		priority: intent.priority,
		updatedAt: intent.updatedAt.toISOString()
	};
}

async function submitIntent(
	intentId: string,
	organizationId: string,
	userId: string,
	propertyId: string,
	title: string
): Promise<{
	intentId: string;
	status: string;
	submittedAt: string;
}> {
	const now = new Date();
	const intent = await prisma.ownerIntent.update({
		where: { id: intentId },
		data: {
			status: 'SUBMITTED',
			submittedAt: now
		}
	});

	await recordWorkflowEvent({
		organizationId,
		entityType: 'OWNER_INTENT',
		entityId: intentId,
		action: 'SUBMIT',
		eventCategory: 'INTENT',
		summary: `Intent submitted for review: ${title}`,
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'ownerIntentWorkflow_v1',
		workflowStep: 'SUBMIT',
		workflowVersion: 'v1',
		propertyId,
		previousState: { status: 'DRAFT' },
		newState: { status: 'SUBMITTED' }
	});

	return {
		intentId: intent.id,
		status: intent.status,
		submittedAt: intent.submittedAt!.toISOString()
	};
}

async function acknowledgeIntent(
	intentId: string,
	organizationId: string,
	userId: string,
	propertyId: string
): Promise<{
	intentId: string;
	status: string;
	acknowledgedAt: string;
	acknowledgedBy: string;
}> {
	const now = new Date();
	const intent = await prisma.ownerIntent.update({
		where: { id: intentId },
		data: {
			status: 'ACKNOWLEDGED',
			acknowledgedAt: now,
			acknowledgedBy: userId
		}
	});

	await recordWorkflowEvent({
		organizationId,
		entityType: 'OWNER_INTENT',
		entityId: intentId,
		action: 'STATUS_CHANGE',
		eventCategory: 'EXECUTION',
		summary: 'Intent acknowledged by concierge',
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'ownerIntentWorkflow_v1',
		workflowStep: 'ACKNOWLEDGE',
		workflowVersion: 'v1',
		propertyId,
		previousState: { status: 'SUBMITTED' },
		newState: { status: 'ACKNOWLEDGED' }
	});

	return {
		intentId: intent.id,
		status: intent.status,
		acknowledgedAt: intent.acknowledgedAt!.toISOString(),
		acknowledgedBy: intent.acknowledgedBy!
	};
}

async function convertToCase(
	intentId: string,
	caseId: string,
	organizationId: string,
	userId: string,
	propertyId: string,
	previousStatus: string
): Promise<{
	intentId: string;
	status: string;
	convertedCaseId: string;
	convertedAt: string;
}> {
	const now = new Date();
	const intent = await prisma.ownerIntent.update({
		where: { id: intentId },
		data: {
			status: 'CONVERTED_TO_CASE',
			convertedCaseId: caseId,
			convertedAt: now
		}
	});

	await recordWorkflowEvent({
		organizationId,
		entityType: 'OWNER_INTENT',
		entityId: intentId,
		action: 'STATUS_CHANGE',
		eventCategory: 'DECISION',
		summary: 'Intent converted to case',
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'ownerIntentWorkflow_v1',
		workflowStep: 'CONVERT_TO_CASE',
		workflowVersion: 'v1',
		propertyId,
		caseId,
		previousState: { status: previousStatus },
		newState: { status: 'CONVERTED_TO_CASE', convertedCaseId: caseId }
	});

	return {
		intentId: intent.id,
		status: intent.status,
		convertedCaseId: intent.convertedCaseId!,
		convertedAt: intent.convertedAt!.toISOString()
	};
}

async function declineIntent(
	intentId: string,
	reason: string,
	organizationId: string,
	userId: string,
	propertyId: string,
	previousStatus: string
): Promise<{
	intentId: string;
	status: string;
	declinedAt: string;
	declinedBy: string;
}> {
	const now = new Date();
	const intent = await prisma.ownerIntent.update({
		where: { id: intentId },
		data: {
			status: 'DECLINED',
			declinedAt: now,
			declinedBy: userId,
			declineReason: reason
		}
	});

	await recordWorkflowEvent({
		organizationId,
		entityType: 'OWNER_INTENT',
		entityId: intentId,
		action: 'DENY',
		eventCategory: 'DECISION',
		summary: `Intent declined: ${reason}`,
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'ownerIntentWorkflow_v1',
		workflowStep: 'DECLINE',
		workflowVersion: 'v1',
		propertyId,
		previousState: { status: previousStatus },
		newState: { status: 'DECLINED', declineReason: reason }
	});

	return {
		intentId: intent.id,
		status: intent.status,
		declinedAt: intent.declinedAt!.toISOString(),
		declinedBy: intent.declinedBy!
	};
}

async function withdrawIntent(
	intentId: string,
	reason: string | undefined,
	organizationId: string,
	userId: string,
	propertyId: string,
	previousStatus: string
): Promise<{
	intentId: string;
	status: string;
	withdrawnAt: string;
}> {
	const now = new Date();
	const intent = await prisma.ownerIntent.update({
		where: { id: intentId },
		data: {
			status: 'WITHDRAWN',
			withdrawnAt: now,
			withdrawReason: reason
		}
	});

	await recordWorkflowEvent({
		organizationId,
		entityType: 'OWNER_INTENT',
		entityId: intentId,
		action: 'CANCEL',
		eventCategory: 'INTENT',
		summary: `Owner withdrew intent${reason ? `: ${reason}` : ''}`,
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'ownerIntentWorkflow_v1',
		workflowStep: 'WITHDRAW',
		workflowVersion: 'v1',
		propertyId,
		previousState: { status: previousStatus },
		newState: { status: 'WITHDRAWN', withdrawReason: reason }
	});

	return {
		intentId: intent.id,
		status: intent.status,
		withdrawnAt: intent.withdrawnAt!.toISOString()
	};
}

async function addNote(
	intentId: string,
	content: string,
	isInternal: boolean,
	organizationId: string,
	userId: string
): Promise<{
	noteId: string;
	intentId: string;
	content: string;
	isInternal: boolean;
	createdBy: string;
	createdAt: string;
}> {
	const note = await prisma.intentNote.create({
		data: {
			intentId,
			content,
			isInternal,
			createdBy: userId
		}
	});

	await recordWorkflowEvent({
		organizationId,
		entityType: 'INTENT_NOTE',
		entityId: note.id,
		action: 'CREATE',
		eventCategory: 'EXECUTION',
		summary: `Note added to intent`,
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'ownerIntentWorkflow_v1',
		workflowStep: 'ADD_NOTE',
		workflowVersion: 'v1',
		newState: { isInternal }
	});

	return {
		noteId: note.id,
		intentId: note.intentId,
		content: note.content,
		isInternal: note.isInternal,
		createdBy: note.createdBy,
		createdAt: note.createdAt.toISOString()
	};
}

async function deleteIntent(
	intentId: string,
	organizationId: string,
	userId: string
): Promise<{ deletedAt: string }> {
	const now = new Date();
	await prisma.ownerIntent.update({
		where: { id: intentId },
		data: { deletedAt: now }
	});

	await recordWorkflowEvent({
		organizationId,
		entityType: 'OWNER_INTENT',
		entityId: intentId,
		action: 'DELETE',
		eventCategory: 'EXECUTION',
		summary: 'Owner intent deleted',
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'ownerIntentWorkflow_v1',
		workflowStep: 'DELETE',
		workflowVersion: 'v1',
		newState: { deletedAt: now.toISOString() }
	});

	return { deletedAt: now.toISOString() };
}

// Main workflow function

async function ownerIntentWorkflow(input: OwnerIntentWorkflowInput): Promise<OwnerIntentWorkflowResult> {
	const workflowName = 'ownerIntentWorkflow_v1';
	const log = createWorkflowLogger(workflowName, DBOS.workflowID, input.action);
	const startTime = logWorkflowStart(log, input.action, {
		organizationId: input.organizationId,
		userId: input.userId,
		intentId: input.intentId
	}, workflowName, DBOS.workflowID);

	try {
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'started', action: input.action });

		switch (input.action) {
			case 'CREATE': {
				if (!input.propertyId || !input.title || !input.description || !input.category) {
					const error = new Error('Missing required fields for CREATE');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: createIntent starting', { title: input.title });
				const result = await DBOS.runStep(
					() => createIntent(input),
					{ name: 'createIntent' }
				);
				log.info('Step: createIntent completed', { id: result.intentId });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'intent_created', intentId: result.intentId });
				const successResult: OwnerIntentWorkflowResult = {
					success: true,
					entityId: result.intentId,
					intentId: result.intentId,
					propertyId: result.propertyId,
					title: result.title,
					category: result.category,
					priority: result.priority,
					status: result.status,
					createdAt: result.createdAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'UPDATE': {
				if (!input.intentId) {
					const error = new Error('Missing required field: intentId for UPDATE');
					logStepError(log, 'validation', error, { intentId: input.intentId });
					throw error;
				}
				log.debug('Step: updateIntent starting', { intentId: input.intentId });
				const result = await DBOS.runStep(
					() => updateIntent(input),
					{ name: 'updateIntent' }
				);
				log.info('Step: updateIntent completed', { id: result.intentId });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'intent_updated', intentId: result.intentId });
				const successResult: OwnerIntentWorkflowResult = {
					success: true,
					entityId: result.intentId,
					intentId: result.intentId,
					title: result.title,
					category: result.category,
					priority: result.priority,
					updatedAt: result.updatedAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'SUBMIT': {
				if (!input.intentId || !input.propertyId || !input.title) {
					const error = new Error('Missing required fields for SUBMIT');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: submitIntent starting', { intentId: input.intentId });
				const result = await DBOS.runStep(
					() => submitIntent(input.intentId!, input.organizationId, input.userId, input.propertyId!, input.title!),
					{ name: 'submitIntent' }
				);
				log.info('Step: submitIntent completed', { id: result.intentId });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'intent_submitted', intentId: result.intentId });
				const successResult: OwnerIntentWorkflowResult = {
					success: true,
					entityId: result.intentId,
					intentId: result.intentId,
					status: result.status,
					submittedAt: result.submittedAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'ACKNOWLEDGE': {
				if (!input.intentId || !input.propertyId) {
					const error = new Error('Missing required fields for ACKNOWLEDGE');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: acknowledgeIntent starting', { intentId: input.intentId });
				const result = await DBOS.runStep(
					() => acknowledgeIntent(input.intentId!, input.organizationId, input.userId, input.propertyId!),
					{ name: 'acknowledgeIntent' }
				);
				log.info('Step: acknowledgeIntent completed', { id: result.intentId });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'intent_acknowledged', intentId: result.intentId });
				const successResult: OwnerIntentWorkflowResult = {
					success: true,
					entityId: result.intentId,
					intentId: result.intentId,
					status: result.status,
					acknowledgedAt: result.acknowledgedAt,
					acknowledgedBy: result.acknowledgedBy
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'CONVERT_TO_CASE': {
				if (!input.intentId || !input.caseId || !input.propertyId) {
					const error = new Error('Missing required fields for CONVERT_TO_CASE');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: convertToCase starting', { intentId: input.intentId });
				const result = await DBOS.runStep(
					() => convertToCase(input.intentId!, input.caseId!, input.organizationId, input.userId, input.propertyId!, input.priority || 'SUBMITTED'),
					{ name: 'convertToCase' }
				);
				log.info('Step: convertToCase completed', { id: result.intentId });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'intent_converted', intentId: result.intentId });
				const successResult: OwnerIntentWorkflowResult = {
					success: true,
					entityId: result.intentId,
					intentId: result.intentId,
					status: result.status,
					convertedCaseId: result.convertedCaseId,
					convertedAt: result.convertedAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'DECLINE': {
				if (!input.intentId || !input.reason || !input.propertyId) {
					const error = new Error('Missing required fields for DECLINE');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: declineIntent starting', { intentId: input.intentId });
				const result = await DBOS.runStep(
					() => declineIntent(input.intentId!, input.reason!, input.organizationId, input.userId, input.propertyId!, input.priority || 'SUBMITTED'),
					{ name: 'declineIntent' }
				);
				log.info('Step: declineIntent completed', { id: result.intentId });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'intent_declined', intentId: result.intentId });
				const successResult: OwnerIntentWorkflowResult = {
					success: true,
					entityId: result.intentId,
					intentId: result.intentId,
					status: result.status,
					declinedAt: result.declinedAt,
					declinedBy: result.declinedBy
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'WITHDRAW': {
				if (!input.intentId || !input.propertyId) {
					const error = new Error('Missing required fields for WITHDRAW');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: withdrawIntent starting', { intentId: input.intentId });
				const result = await DBOS.runStep(
					() => withdrawIntent(input.intentId!, input.reason, input.organizationId, input.userId, input.propertyId!, input.priority || 'DRAFT'),
					{ name: 'withdrawIntent' }
				);
				log.info('Step: withdrawIntent completed', { id: result.intentId });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'intent_withdrawn', intentId: result.intentId });
				const successResult: OwnerIntentWorkflowResult = {
					success: true,
					entityId: result.intentId,
					intentId: result.intentId,
					status: result.status,
					withdrawnAt: result.withdrawnAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'ADD_NOTE': {
				if (!input.intentId || !input.content) {
					const error = new Error('Missing required fields for ADD_NOTE');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: addNote starting', { intentId: input.intentId });
				const result = await DBOS.runStep(
					() => addNote(input.intentId!, input.content!, input.isInternal ?? true, input.organizationId, input.userId),
					{ name: 'addNote' }
				);
				log.info('Step: addNote completed', { noteId: result.noteId });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'note_added', noteId: result.noteId });
				const successResult: OwnerIntentWorkflowResult = {
					success: true,
					entityId: result.noteId,
					noteId: result.noteId,
					intentId: result.intentId,
					noteContent: result.content,
					noteIsInternal: result.isInternal,
					noteCreatedBy: result.createdBy,
					noteCreatedAt: result.createdAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'DELETE': {
				if (!input.intentId) {
					const error = new Error('Missing required field: intentId for DELETE');
					logStepError(log, 'validation', error, { intentId: input.intentId });
					throw error;
				}
				log.debug('Step: deleteIntent starting', { intentId: input.intentId });
				const result = await DBOS.runStep(
					() => deleteIntent(input.intentId!, input.organizationId, input.userId),
					{ name: 'deleteIntent' }
				);
				log.info('Step: deleteIntent completed', { intentId: input.intentId });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'intent_deleted', intentId: input.intentId });
				const successResult: OwnerIntentWorkflowResult = {
					success: true,
					entityId: input.intentId,
					intentId: input.intentId,
					deletedAt: result.deletedAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			default: {
				const errorResult: OwnerIntentWorkflowResult = {
					success: false,
					error: `Unknown action: ${input.action}`
				};
				log.warn('Unknown workflow action', { action: input.action });
				logWorkflowEnd(log, input.action, false, startTime, errorResult);
				return errorResult;
			}
		}
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;

		log.error('Workflow failed', {
			action: input.action,
			intentId: input.intentId,
			error: errorMessage,
			stack: errorObj.stack
		});

		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		await recordSpanError(errorObj, {
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'OWNER_INTENT_WORKFLOW_ERROR'
		});
		const errorResult: OwnerIntentWorkflowResult = {
			success: false,
			error: errorMessage
		};
		logWorkflowEnd(log, input.action, false, startTime, errorResult);
		return errorResult;
	}
}

export const ownerIntentWorkflow_v1 = DBOS.registerWorkflow(ownerIntentWorkflow);

export async function startOwnerIntentWorkflow(
	input: OwnerIntentWorkflowInput,
	idempotencyKey: string
): Promise<OwnerIntentWorkflowResult> {
	const handle = await DBOS.startWorkflow(ownerIntentWorkflow_v1, { workflowID: idempotencyKey })(input);
	return handle.getResult();
}
