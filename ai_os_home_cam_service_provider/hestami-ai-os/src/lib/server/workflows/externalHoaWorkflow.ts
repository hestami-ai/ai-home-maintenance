/**
 * External HOA Workflow (v1)
 *
 * DBOS durable workflow for external HOA context management (Phase 3.7).
 * Handles: context create/update, approval create/update, rule create/delete.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { orgTransaction } from '../db/rls.js';
import type { EntityWorkflowResult } from './schemas.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger, logWorkflowStart, logWorkflowEnd, logStepError } from './workflowLogger.js';

const WORKFLOW_STATUS_EVENT = 'external_hoa_workflow_status';
const WORKFLOW_ERROR_EVENT = 'external_hoa_workflow_error';

// Action types for external HOA operations
export const ExternalHoaWorkflowAction = {
	CREATE_CONTEXT: 'CREATE_CONTEXT',
	UPDATE_CONTEXT: 'UPDATE_CONTEXT',
	CREATE_APPROVAL: 'CREATE_APPROVAL',
	UPDATE_APPROVAL_STATUS: 'UPDATE_APPROVAL_STATUS',
	ADD_RULE: 'ADD_RULE',
	DELETE_RULE: 'DELETE_RULE'
} as const;

export type ExternalHoaWorkflowAction = (typeof ExternalHoaWorkflowAction)[keyof typeof ExternalHoaWorkflowAction];

export interface ExternalHoaWorkflowInput {
	action: ExternalHoaWorkflowAction;
	organizationId: string;
	userId: string;
	// CREATE_CONTEXT fields
	propertyId?: string;
	hoaName?: string;
	hoaContactName?: string | null;
	hoaContactEmail?: string | null;
	hoaContactPhone?: string | null;
	hoaAddress?: string | null;
	notes?: string | null;
	documentsJson?: string[];
	// UPDATE_CONTEXT / context-related fields
	contextId?: string;
	// CREATE_APPROVAL fields
	externalHoaContextId?: string;
	caseId?: string;
	approvalType?: string;
	relatedDocumentIds?: string[];
	// UPDATE_APPROVAL_STATUS fields
	approvalId?: string;
	status?: string;
	submittedAt?: Date;
	responseAt?: Date;
	expiresAt?: Date;
	approvalReference?: string;
	// ADD_RULE fields
	ruleCategory?: string;
	ruleDescription?: string;
	sourceDocumentId?: string;
	// DELETE_RULE fields
	ruleId?: string;
}

export interface ExternalHoaWorkflowResult extends EntityWorkflowResult {
	contextId?: string;
	approvalId?: string;
	ruleId?: string;
	hoaName?: string;
	approvalType?: string;
	ruleCategory?: string;
	ruleDescription?: string;
	status?: string;
	createdAt?: string;
	updatedAt?: string;
	deleted?: boolean;
	[key: string]: unknown;
}

// Step functions

async function createContext(
	input: ExternalHoaWorkflowInput
): Promise<{ id: string; propertyId: string; hoaName: string; createdAt: string }> {
	const hoaContext = await orgTransaction(
		input.organizationId,
		async (tx) => {
			return tx.externalHOAContext.create({
				data: {
					organizationId: input.organizationId,
					propertyId: input.propertyId!,
					hoaName: input.hoaName!,
					hoaContactName: input.hoaContactName,
					hoaContactEmail: input.hoaContactEmail,
					hoaContactPhone: input.hoaContactPhone,
					hoaAddress: input.hoaAddress,
					notes: input.notes,
					documentsJson: input.documentsJson ?? []
				}
			});
		},
		{ userId: input.userId, reason: 'Create external HOA context' }
	);

	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: 'EXTERNAL_HOA',
		entityId: hoaContext.id,
		action: 'CREATE',
		eventCategory: 'EXECUTION',
		summary: `External HOA context created: ${input.hoaName}`,
		performedById: input.userId,
		performedByType: 'HUMAN',
		workflowId: 'externalHoaWorkflow_v1',
		workflowStep: 'CREATE_CONTEXT',
		workflowVersion: 'v1',
		newState: { hoaName: input.hoaName, propertyId: input.propertyId }
	});

	return {
		id: hoaContext.id,
		propertyId: hoaContext.propertyId,
		hoaName: hoaContext.hoaName,
		createdAt: hoaContext.createdAt.toISOString()
	};
}

async function updateContext(
	input: ExternalHoaWorkflowInput
): Promise<{ id: string; hoaName: string; updatedAt: string }> {
	const updateData: Record<string, unknown> = {};
	if (input.hoaName !== undefined) updateData.hoaName = input.hoaName;
	if (input.hoaContactName !== undefined) updateData.hoaContactName = input.hoaContactName;
	if (input.hoaContactEmail !== undefined) updateData.hoaContactEmail = input.hoaContactEmail;
	if (input.hoaContactPhone !== undefined) updateData.hoaContactPhone = input.hoaContactPhone;
	if (input.hoaAddress !== undefined) updateData.hoaAddress = input.hoaAddress;
	if (input.notes !== undefined) updateData.notes = input.notes;
	if (input.documentsJson !== undefined) updateData.documentsJson = input.documentsJson;

	const updated = await orgTransaction(
		input.organizationId,
		async (tx) => {
			return tx.externalHOAContext.update({
				where: { id: input.contextId },
				data: updateData
			});
		},
		{ userId: input.userId, reason: 'Update external HOA context' }
	);

	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: 'EXTERNAL_HOA',
		entityId: updated.id,
		action: 'UPDATE',
		eventCategory: 'EXECUTION',
		summary: `External HOA context updated: ${updated.hoaName}`,
		performedById: input.userId,
		performedByType: 'HUMAN',
		workflowId: 'externalHoaWorkflow_v1',
		workflowStep: 'UPDATE_CONTEXT',
		workflowVersion: 'v1',
		newState: updateData
	});

	return {
		id: updated.id,
		hoaName: updated.hoaName,
		updatedAt: updated.updatedAt.toISOString()
	};
}

async function createApproval(
	input: ExternalHoaWorkflowInput,
	_propertyId: string
): Promise<{ id: string; approvalType: string; status: string; createdAt: string }> {
	const approval = await orgTransaction(
		input.organizationId,
		async (tx) => {
			return tx.externalHOAApproval.create({
				data: {
					externalHoaContextId: input.externalHoaContextId!,
					caseId: input.caseId,
					approvalType: input.approvalType!,
					status: 'PENDING',
					notes: input.notes,
					relatedDocumentIds: input.relatedDocumentIds ?? []
				}
			});
		},
		{ userId: input.userId, reason: 'Create external HOA approval' }
	);

	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: 'EXTERNAL_HOA',
		entityId: approval.id,
		action: 'CREATE',
		eventCategory: 'INTENT',
		summary: `HOA approval requested: ${input.approvalType}`,
		performedById: input.userId,
		performedByType: 'HUMAN',
		workflowId: 'externalHoaWorkflow_v1',
		workflowStep: 'CREATE_APPROVAL',
		workflowVersion: 'v1',
		newState: { approvalType: input.approvalType, status: 'PENDING' }
	});

	return {
		id: approval.id,
		approvalType: approval.approvalType,
		status: approval.status,
		createdAt: approval.createdAt.toISOString()
	};
}

async function updateApprovalStatus(
	input: ExternalHoaWorkflowInput,
	previousStatus: string,
	_propertyId: string
): Promise<{ id: string; status: string; updatedAt: string }> {
	const updateData: Record<string, unknown> = { status: input.status };
	if (input.submittedAt) updateData.submittedAt = input.submittedAt;
	if (input.responseAt) updateData.responseAt = input.responseAt;
	if (input.expiresAt) updateData.expiresAt = input.expiresAt;
	if (input.approvalReference) updateData.approvalReference = input.approvalReference;
	if (input.notes) updateData.notes = input.notes;

	const updated = await orgTransaction(
		input.organizationId,
		async (tx) => {
			return tx.externalHOAApproval.update({
				where: { id: input.approvalId },
				data: updateData
			});
		},
		{ userId: input.userId, reason: 'Update external HOA approval status' }
	);

	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: 'EXTERNAL_HOA',
		entityId: updated.id,
		action: 'STATUS_CHANGE',
		eventCategory: 'EXECUTION',
		summary: `HOA approval status: ${input.status}`,
		performedById: input.userId,
		performedByType: 'HUMAN',
		workflowId: 'externalHoaWorkflow_v1',
		workflowStep: 'UPDATE_APPROVAL_STATUS',
		workflowVersion: 'v1',
		previousState: { status: previousStatus },
		newState: { status: input.status }
	});

	return {
		id: updated.id,
		status: updated.status,
		updatedAt: updated.updatedAt.toISOString()
	};
}

async function addRule(
	input: ExternalHoaWorkflowInput
): Promise<{ id: string; ruleCategory: string; ruleDescription: string; createdAt: string }> {
	const rule = await orgTransaction(
		input.organizationId,
		async (tx) => {
			return tx.externalHOARule.create({
				data: {
					externalHoaContextId: input.externalHoaContextId!,
					ruleCategory: input.ruleCategory!,
					ruleDescription: input.ruleDescription!,
					sourceDocumentId: input.sourceDocumentId,
					notes: input.notes
				}
			});
		},
		{ userId: input.userId, reason: 'Add external HOA rule' }
	);

	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: 'EXTERNAL_HOA',
		entityId: rule.id,
		action: 'CREATE',
		eventCategory: 'EXECUTION',
		summary: `HOA rule added: ${input.ruleCategory}`,
		performedById: input.userId,
		performedByType: 'HUMAN',
		workflowId: 'externalHoaWorkflow_v1',
		workflowStep: 'ADD_RULE',
		workflowVersion: 'v1',
		newState: { ruleCategory: input.ruleCategory, ruleDescription: input.ruleDescription }
	});

	return {
		id: rule.id,
		ruleCategory: rule.ruleCategory,
		ruleDescription: rule.ruleDescription,
		createdAt: rule.createdAt.toISOString()
	};
}

async function deleteRule(
	ruleId: string,
	organizationId: string,
	userId: string
): Promise<{ deleted: boolean }> {
	await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.externalHOARule.update({
				where: { id: ruleId },
				data: { deletedAt: new Date() }
			});
		},
		{ userId, reason: 'Delete external HOA rule' }
	);

	await recordWorkflowEvent({
		organizationId,
		entityType: 'EXTERNAL_HOA',
		entityId: ruleId,
		action: 'DELETE',
		eventCategory: 'EXECUTION',
		summary: `HOA rule deleted`,
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'externalHoaWorkflow_v1',
		workflowStep: 'DELETE_RULE',
		workflowVersion: 'v1',
		newState: { deletedAt: new Date().toISOString() }
	});

	return { deleted: true };
}

// Main workflow function

async function externalHoaWorkflow(input: ExternalHoaWorkflowInput): Promise<ExternalHoaWorkflowResult> {
	const workflowName = 'externalHoaWorkflow_v1';
	const log = createWorkflowLogger(workflowName, DBOS.workflowID, input.action);
	const startTime = logWorkflowStart(log, input.action, {
		organizationId: input.organizationId,
		userId: input.userId
	}, workflowName, DBOS.workflowID);

	try {
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'started', action: input.action });

		switch (input.action) {
			case 'CREATE_CONTEXT': {
				if (!input.propertyId || !input.hoaName) {
					const error = new Error('Missing required fields: propertyId and hoaName for CREATE_CONTEXT');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: createContext starting', { propertyId: input.propertyId });
				const result = await DBOS.runStep(
					() => createContext(input),
					{ name: 'createContext' }
				);
				log.info('Step: createContext completed', { id: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'context_created', ...result });
				const successResult: ExternalHoaWorkflowResult = {
					success: true,
					entityId: result.id,
					contextId: result.id,
					hoaName: result.hoaName,
					createdAt: result.createdAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'UPDATE_CONTEXT': {
				if (!input.contextId) {
					const error = new Error('Missing required field: contextId for UPDATE_CONTEXT');
					logStepError(log, 'validation', error, { contextId: input.contextId });
					throw error;
				}
				log.debug('Step: updateContext starting', { contextId: input.contextId });
				const result = await DBOS.runStep(
					() => updateContext(input),
					{ name: 'updateContext' }
				);
				log.info('Step: updateContext completed', { id: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'context_updated', ...result });
				const successResult: ExternalHoaWorkflowResult = {
					success: true,
					entityId: result.id,
					contextId: result.id,
					hoaName: result.hoaName,
					updatedAt: result.updatedAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'CREATE_APPROVAL': {
				if (!input.externalHoaContextId || !input.approvalType) {
					const error = new Error('Missing required fields: externalHoaContextId and approvalType for CREATE_APPROVAL');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: createApproval starting', { contextId: input.externalHoaContextId });
				const result = await DBOS.runStep(
					() => createApproval(input, input.propertyId ?? ''),
					{ name: 'createApproval' }
				);
				log.info('Step: createApproval completed', { id: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'approval_created', ...result });
				const successResult: ExternalHoaWorkflowResult = {
					success: true,
					entityId: result.id,
					approvalId: result.id,
					approvalType: result.approvalType,
					status: result.status,
					createdAt: result.createdAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'UPDATE_APPROVAL_STATUS': {
				if (!input.approvalId || !input.status) {
					const error = new Error('Missing required fields: approvalId and status for UPDATE_APPROVAL_STATUS');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: updateApprovalStatus starting', { approvalId: input.approvalId });
				// We need previous status for activity logging - passed via input
				const previousStatus = (input as { previousStatus?: string }).previousStatus ?? 'unknown';
				const result = await DBOS.runStep(
					() => updateApprovalStatus(input, previousStatus, input.propertyId ?? ''),
					{ name: 'updateApprovalStatus' }
				);
				log.info('Step: updateApprovalStatus completed', { id: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'approval_status_updated', ...result });
				const successResult: ExternalHoaWorkflowResult = {
					success: true,
					entityId: result.id,
					approvalId: result.id,
					status: result.status,
					updatedAt: result.updatedAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'ADD_RULE': {
				if (!input.externalHoaContextId || !input.ruleCategory || !input.ruleDescription) {
					const error = new Error('Missing required fields: externalHoaContextId, ruleCategory, and ruleDescription for ADD_RULE');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: addRule starting', { contextId: input.externalHoaContextId });
				const result = await DBOS.runStep(
					() => addRule(input),
					{ name: 'addRule' }
				);
				log.info('Step: addRule completed', { id: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'rule_added', ...result });
				const successResult: ExternalHoaWorkflowResult = {
					success: true,
					entityId: result.id,
					ruleId: result.id,
					ruleCategory: result.ruleCategory,
					ruleDescription: result.ruleDescription,
					createdAt: result.createdAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'DELETE_RULE': {
				if (!input.ruleId) {
					const error = new Error('Missing required field: ruleId for DELETE_RULE');
					logStepError(log, 'validation', error, { ruleId: input.ruleId });
					throw error;
				}
				log.debug('Step: deleteRule starting', { ruleId: input.ruleId });
				await DBOS.runStep(
					() => deleteRule(input.ruleId!, input.organizationId, input.userId),
					{ name: 'deleteRule' }
				);
				log.info('Step: deleteRule completed', { ruleId: input.ruleId });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'rule_deleted', ruleId: input.ruleId });
				const successResult: ExternalHoaWorkflowResult = {
					success: true,
					entityId: input.ruleId,
					ruleId: input.ruleId,
					deleted: true
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			default: {
				const errorResult: ExternalHoaWorkflowResult = {
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
			error: errorMessage,
			stack: errorObj.stack
		});

		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		await recordSpanError(errorObj, {
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'EXTERNAL_HOA_WORKFLOW_ERROR'
		});
		const errorResult: ExternalHoaWorkflowResult = {
			success: false,
			error: errorMessage
		};
		logWorkflowEnd(log, input.action, false, startTime, errorResult);
		return errorResult;
	}
}

export const externalHoaWorkflow_v1 = DBOS.registerWorkflow(externalHoaWorkflow);

export async function startExternalHoaWorkflow(
	input: ExternalHoaWorkflowInput,
	idempotencyKey: string
): Promise<ExternalHoaWorkflowResult> {
	const handle = await DBOS.startWorkflow(externalHoaWorkflow_v1, { workflowID: idempotencyKey })(input);
	return handle.getResult();
}
