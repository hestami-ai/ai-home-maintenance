/**
 * Material Decision Workflow (v1)
 *
 * DBOS durable workflow for material decision management (Phase 3.9 Concierge).
 * Handles: create, recordOutcome, update, delete.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import type { EntityWorkflowResult } from './schemas.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger, logWorkflowStart, logWorkflowEnd, logStepError } from './workflowLogger.js';

const WORKFLOW_STATUS_EVENT = 'material_decision_workflow_status';
const WORKFLOW_ERROR_EVENT = 'material_decision_workflow_error';

// Action types for material decision operations
export const MaterialDecisionWorkflowAction = {
	CREATE: 'CREATE',
	RECORD_OUTCOME: 'RECORD_OUTCOME',
	UPDATE: 'UPDATE',
	DELETE: 'DELETE'
} as const;

export type MaterialDecisionWorkflowAction = (typeof MaterialDecisionWorkflowAction)[keyof typeof MaterialDecisionWorkflowAction];

export interface OptionConsidered {
	option: string;
	pros?: string[];
	cons?: string[];
	selected?: boolean;
}

export interface MaterialDecisionWorkflowInput {
	action: MaterialDecisionWorkflowAction;
	organizationId: string;
	userId: string;
	// CREATE fields
	caseId?: string;
	category?: string;
	title?: string;
	description?: string;
	rationale?: string;
	optionsConsidered?: OptionConsidered[];
	estimatedImpact?: string;
	relatedDocumentIds?: string[];
	relatedActionIds?: string[];
	// UPDATE/DELETE/RECORD_OUTCOME fields
	decisionId?: string;
	// RECORD_OUTCOME fields
	actualOutcome?: string;
}

export interface MaterialDecisionWorkflowResult extends EntityWorkflowResult {
	decisionId?: string;
	category?: string;
	title?: string;
	decidedAt?: string;
	createdAt?: string;
	actualOutcome?: string;
	outcomeRecordedAt?: string;
	updatedAt?: string;
	deleted?: boolean;
	[key: string]: unknown;
}

// Step functions

async function createDecision(
	input: MaterialDecisionWorkflowInput
): Promise<{
	decisionId: string;
	category: string;
	title: string;
	decidedAt: string;
	createdAt: string;
}> {
	const now = new Date();
	const decision = await prisma.materialDecision.create({
		data: {
			organizationId: input.organizationId,
			caseId: input.caseId,
			category: input.category as 'FINANCIAL' | 'LEGAL' | 'OPERATIONAL' | 'VENDOR_SELECTION' | 'MAINTENANCE' | 'EMERGENCY' | 'POLICY' | 'COMPLAINT_RESOLUTION' | 'OTHER',
			title: input.title!,
			description: input.description!,
			rationale: input.rationale!,
			decidedByUserId: input.userId,
			decidedAt: now,
			optionsConsidered: input.optionsConsidered ?? [],
			estimatedImpact: input.estimatedImpact,
			relatedDocumentIds: input.relatedDocumentIds ?? [],
			relatedActionIds: input.relatedActionIds ?? []
		}
	});

	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: 'MATERIAL_DECISION',
		entityId: decision.id,
		action: 'CREATE',
		eventCategory: 'DECISION',
		summary: `Material decision created: ${input.title}`,
		performedById: input.userId,
		performedByType: 'HUMAN',
		workflowId: 'materialDecisionWorkflow_v1',
		workflowStep: 'CREATE',
		workflowVersion: 'v1',
		caseId: input.caseId,
		newState: { category: input.category, title: input.title, rationale: input.rationale }
	});

	return {
		decisionId: decision.id,
		category: decision.category,
		title: decision.title,
		decidedAt: decision.decidedAt.toISOString(),
		createdAt: decision.createdAt.toISOString()
	};
}

async function recordOutcome(
	decisionId: string,
	actualOutcome: string,
	organizationId: string,
	userId: string,
	caseId?: string
): Promise<{
	decisionId: string;
	actualOutcome: string;
	outcomeRecordedAt: string;
}> {
	const now = new Date();
	const updated = await prisma.materialDecision.update({
		where: { id: decisionId },
		data: {
			actualOutcome,
			outcomeRecordedAt: now
		}
	});

	await recordWorkflowEvent({
		organizationId,
		entityType: 'MATERIAL_DECISION',
		entityId: decisionId,
		action: 'UPDATE',
		eventCategory: 'EXECUTION',
		summary: `Decision outcome recorded: ${actualOutcome.substring(0, 100)}`,
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'materialDecisionWorkflow_v1',
		workflowStep: 'RECORD_OUTCOME',
		workflowVersion: 'v1',
		caseId,
		newState: { actualOutcome }
	});

	return {
		decisionId: updated.id,
		actualOutcome: updated.actualOutcome!,
		outcomeRecordedAt: updated.outcomeRecordedAt!.toISOString()
	};
}

async function updateDecision(
	input: MaterialDecisionWorkflowInput
): Promise<{
	decisionId: string;
	title: string;
	updatedAt: string;
}> {
	const updateData: Record<string, unknown> = {};
	if (input.title !== undefined) updateData.title = input.title;
	if (input.description !== undefined) updateData.description = input.description;
	if (input.rationale !== undefined) updateData.rationale = input.rationale;
	if (input.estimatedImpact !== undefined) updateData.estimatedImpact = input.estimatedImpact;
	if (input.relatedDocumentIds !== undefined) updateData.relatedDocumentIds = input.relatedDocumentIds;
	if (input.relatedActionIds !== undefined) updateData.relatedActionIds = input.relatedActionIds;

	const updated = await prisma.materialDecision.update({
		where: { id: input.decisionId },
		data: updateData
	});

	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: 'MATERIAL_DECISION',
		entityId: updated.id,
		action: 'UPDATE',
		eventCategory: 'EXECUTION',
		summary: `Material decision updated: ${updated.title}`,
		performedById: input.userId,
		performedByType: 'HUMAN',
		workflowId: 'materialDecisionWorkflow_v1',
		workflowStep: 'UPDATE',
		workflowVersion: 'v1',
		newState: updateData
	});

	return {
		decisionId: updated.id,
		title: updated.title,
		updatedAt: updated.updatedAt.toISOString()
	};
}

async function deleteDecision(
	decisionId: string,
	organizationId: string,
	userId: string
): Promise<{ deleted: boolean }> {
	await prisma.materialDecision.update({
		where: { id: decisionId },
		data: { deletedAt: new Date() }
	});

	await recordWorkflowEvent({
		organizationId,
		entityType: 'MATERIAL_DECISION',
		entityId: decisionId,
		action: 'DELETE',
		eventCategory: 'EXECUTION',
		summary: 'Material decision deleted',
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'materialDecisionWorkflow_v1',
		workflowStep: 'DELETE',
		workflowVersion: 'v1',
		newState: { deletedAt: new Date().toISOString() }
	});

	return { deleted: true };
}

// Main workflow function

async function materialDecisionWorkflow(input: MaterialDecisionWorkflowInput): Promise<MaterialDecisionWorkflowResult> {
	const workflowName = 'materialDecisionWorkflow_v1';
	const log = createWorkflowLogger(workflowName, DBOS.workflowID, input.action);
	const startTime = logWorkflowStart(log, input.action, {
		organizationId: input.organizationId,
		userId: input.userId,
		decisionId: input.decisionId
	}, workflowName, DBOS.workflowID);

	try {
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'started', action: input.action });

		switch (input.action) {
			case 'CREATE': {
				if (!input.title || !input.description || !input.rationale || !input.category) {
					const error = new Error('Missing required fields for CREATE');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: createDecision starting', { title: input.title });
				const result = await DBOS.runStep(
					() => createDecision(input),
					{ name: 'createDecision' }
				);
				log.info('Step: createDecision completed', { id: result.decisionId });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'decision_created', decisionId: result.decisionId });
				const successResult: MaterialDecisionWorkflowResult = {
					success: true,
					entityId: result.decisionId,
					decisionId: result.decisionId,
					category: result.category,
					title: result.title,
					decidedAt: result.decidedAt,
					createdAt: result.createdAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'RECORD_OUTCOME': {
				if (!input.decisionId || !input.actualOutcome) {
					const error = new Error('Missing required fields: decisionId and actualOutcome for RECORD_OUTCOME');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: recordOutcome starting', { decisionId: input.decisionId });
				const result = await DBOS.runStep(
					() => recordOutcome(input.decisionId!, input.actualOutcome!, input.organizationId, input.userId, input.caseId),
					{ name: 'recordOutcome' }
				);
				log.info('Step: recordOutcome completed', { id: result.decisionId });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'outcome_recorded', decisionId: result.decisionId });
				const successResult: MaterialDecisionWorkflowResult = {
					success: true,
					entityId: result.decisionId,
					decisionId: result.decisionId,
					actualOutcome: result.actualOutcome,
					outcomeRecordedAt: result.outcomeRecordedAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'UPDATE': {
				if (!input.decisionId) {
					const error = new Error('Missing required field: decisionId for UPDATE');
					logStepError(log, 'validation', error, { decisionId: input.decisionId });
					throw error;
				}
				log.debug('Step: updateDecision starting', { decisionId: input.decisionId });
				const result = await DBOS.runStep(
					() => updateDecision(input),
					{ name: 'updateDecision' }
				);
				log.info('Step: updateDecision completed', { id: result.decisionId });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'decision_updated', decisionId: result.decisionId });
				const successResult: MaterialDecisionWorkflowResult = {
					success: true,
					entityId: result.decisionId,
					decisionId: result.decisionId,
					title: result.title,
					updatedAt: result.updatedAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'DELETE': {
				if (!input.decisionId) {
					const error = new Error('Missing required field: decisionId for DELETE');
					logStepError(log, 'validation', error, { decisionId: input.decisionId });
					throw error;
				}
				log.debug('Step: deleteDecision starting', { decisionId: input.decisionId });
				const result = await DBOS.runStep(
					() => deleteDecision(input.decisionId!, input.organizationId, input.userId),
					{ name: 'deleteDecision' }
				);
				log.info('Step: deleteDecision completed', { decisionId: input.decisionId });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'decision_deleted', decisionId: input.decisionId });
				const successResult: MaterialDecisionWorkflowResult = {
					success: true,
					entityId: input.decisionId,
					decisionId: input.decisionId,
					deleted: result.deleted
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			default: {
				const errorResult: MaterialDecisionWorkflowResult = {
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
			decisionId: input.decisionId,
			error: errorMessage,
			stack: errorObj.stack
		});

		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		await recordSpanError(errorObj, {
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'MATERIAL_DECISION_WORKFLOW_ERROR'
		});
		const errorResult: MaterialDecisionWorkflowResult = {
			success: false,
			error: errorMessage
		};
		logWorkflowEnd(log, input.action, false, startTime, errorResult);
		return errorResult;
	}
}

export const materialDecisionWorkflow_v1 = DBOS.registerWorkflow(materialDecisionWorkflow);

export async function startMaterialDecisionWorkflow(
	input: MaterialDecisionWorkflowInput,
	idempotencyKey: string
): Promise<MaterialDecisionWorkflowResult> {
	const handle = await DBOS.startWorkflow(materialDecisionWorkflow_v1, { workflowID: idempotencyKey })(input);
	return handle.getResult();
}
