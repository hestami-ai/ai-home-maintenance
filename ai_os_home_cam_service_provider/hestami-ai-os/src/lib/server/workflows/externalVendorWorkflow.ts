/**
 * External Vendor Workflow (v1)
 *
 * DBOS durable workflow for external vendor context management (Phase 3.8).
 * Handles: context create/update, service provider linking, interaction logging.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { orgTransaction } from '../db/rls.js';
import type { EntityWorkflowResult } from './schemas.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger, logWorkflowStart, logWorkflowEnd, logStepError } from './workflowLogger.js';
import {
	ActivityEntityType,
	ActivityActionType,
	ActivityEventCategory,
	ActivityActorType
} from '../../../../generated/prisma/enums.js';

// Workflow error types for tracing
const WorkflowErrorType = {
	EXTERNAL_VENDOR_WORKFLOW_ERROR: 'EXTERNAL_VENDOR_WORKFLOW_ERROR'
} as const;

const WORKFLOW_STATUS_EVENT = 'external_vendor_workflow_status';
const WORKFLOW_ERROR_EVENT = 'external_vendor_workflow_error';

// Action types for external vendor operations
export const ExternalVendorWorkflowAction = {
	CREATE_CONTEXT: 'CREATE_CONTEXT',
	UPDATE_CONTEXT: 'UPDATE_CONTEXT',
	LINK_TO_SERVICE_PROVIDER: 'LINK_TO_SERVICE_PROVIDER',
	LOG_INTERACTION: 'LOG_INTERACTION'
} as const;

export type ExternalVendorWorkflowAction = (typeof ExternalVendorWorkflowAction)[keyof typeof ExternalVendorWorkflowAction];

export interface ExternalVendorWorkflowInput {
	action: ExternalVendorWorkflowAction;
	organizationId: string;
	userId: string;
	// CREATE_CONTEXT fields
	propertyId?: string;
	vendorName?: string;
	vendorContactName?: string | null;
	vendorContactEmail?: string | null;
	vendorContactPhone?: string | null;
	vendorAddress?: string | null;
	tradeCategories?: string[];
	notes?: string | null;
	// UPDATE_CONTEXT / context-related fields
	contextId?: string;
	// LINK_TO_SERVICE_PROVIDER fields
	serviceProviderOrgId?: string;
	serviceProviderName?: string;
	// LOG_INTERACTION fields
	externalVendorContextId?: string;
	caseId?: string;
	interactionType?: string;
	interactionDate?: Date;
	description?: string;
	amount?: number;
	relatedDocumentIds?: string[];
}

export interface ExternalVendorWorkflowResult extends EntityWorkflowResult {
	contextId?: string;
	interactionId?: string;
	vendorName?: string;
	interactionType?: string;
	interactionDate?: string;
	linkedServiceProviderOrgId?: string;
	createdAt?: string;
	updatedAt?: string;
	[key: string]: unknown;
}

// Step functions

async function createContext(
	input: ExternalVendorWorkflowInput
): Promise<{ id: string; vendorName: string; createdAt: string }> {
	const vendorContext = await orgTransaction(
		input.organizationId,
		async (tx) => {
			return tx.externalVendorContext.create({
				data: {
					organizationId: input.organizationId,
					propertyId: input.propertyId,
					vendorName: input.vendorName!,
					vendorContactName: input.vendorContactName,
					vendorContactEmail: input.vendorContactEmail,
					vendorContactPhone: input.vendorContactPhone,
					vendorAddress: input.vendorAddress,
					tradeCategories: input.tradeCategories ?? [],
					notes: input.notes
				}
			});
		},
		{ userId: input.userId, reason: 'Create external vendor context' }
	);

	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: ActivityEntityType.EXTERNAL_VENDOR,
		entityId: vendorContext.id,
		action: ActivityActionType.CREATE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: `External vendor added: ${input.vendorName}`,
		performedById: input.userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'externalVendorWorkflow_v1',
		workflowStep: ExternalVendorWorkflowAction.CREATE_CONTEXT,
		workflowVersion: 'v1',
		newState: { vendorName: input.vendorName, tradeCategories: input.tradeCategories }
	});

	return {
		id: vendorContext.id,
		vendorName: vendorContext.vendorName,
		createdAt: vendorContext.createdAt.toISOString()
	};
}

async function updateContext(
	input: ExternalVendorWorkflowInput
): Promise<{ id: string; vendorName: string; updatedAt: string }> {
	const updateData: Record<string, unknown> = {};
	if (input.vendorName !== undefined) updateData.vendorName = input.vendorName;
	if (input.vendorContactName !== undefined) updateData.vendorContactName = input.vendorContactName;
	if (input.vendorContactEmail !== undefined) updateData.vendorContactEmail = input.vendorContactEmail;
	if (input.vendorContactPhone !== undefined) updateData.vendorContactPhone = input.vendorContactPhone;
	if (input.vendorAddress !== undefined) updateData.vendorAddress = input.vendorAddress;
	if (input.tradeCategories !== undefined) updateData.tradeCategories = input.tradeCategories;
	if (input.notes !== undefined) updateData.notes = input.notes;

	const updated = await orgTransaction(
		input.organizationId,
		async (tx) => {
			return tx.externalVendorContext.update({
				where: { id: input.contextId },
				data: updateData
			});
		},
		{ userId: input.userId, reason: 'Update external vendor context' }
	);

	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: ActivityEntityType.EXTERNAL_VENDOR,
		entityId: updated.id,
		action: ActivityActionType.UPDATE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: `External vendor updated: ${updated.vendorName}`,
		performedById: input.userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'externalVendorWorkflow_v1',
		workflowStep: ExternalVendorWorkflowAction.UPDATE_CONTEXT,
		workflowVersion: 'v1',
		newState: updateData
	});

	return {
		id: updated.id,
		vendorName: updated.vendorName,
		updatedAt: updated.updatedAt.toISOString()
	};
}

async function linkToServiceProvider(
	input: ExternalVendorWorkflowInput
): Promise<{ id: string; linkedServiceProviderOrgId: string }> {
	const updated = await orgTransaction(
		input.organizationId,
		async (tx) => {
			return tx.externalVendorContext.update({
				where: { id: input.contextId },
				data: { linkedServiceProviderOrgId: input.serviceProviderOrgId }
			});
		},
		{ userId: input.userId, reason: 'Link external vendor to service provider' }
	);

	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: ActivityEntityType.EXTERNAL_VENDOR,
		entityId: updated.id,
		action: ActivityActionType.UPDATE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: `Vendor linked to platform provider: ${input.serviceProviderName}`,
		performedById: input.userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'externalVendorWorkflow_v1',
		workflowStep: ExternalVendorWorkflowAction.LINK_TO_SERVICE_PROVIDER,
		workflowVersion: 'v1',
		newState: { linkedServiceProviderOrgId: input.serviceProviderOrgId }
	});

	return {
		id: updated.id,
		linkedServiceProviderOrgId: updated.linkedServiceProviderOrgId!
	};
}

async function logInteraction(
	input: ExternalVendorWorkflowInput
): Promise<{ id: string; interactionType: string; interactionDate: string; createdAt: string }> {
	const interaction = await orgTransaction(
		input.organizationId,
		async (tx) => {
			return tx.externalVendorInteraction.create({
				data: {
					externalVendorContextId: input.externalVendorContextId!,
					caseId: input.caseId,
					interactionType: input.interactionType as any,
					interactionDate: input.interactionDate!,
					description: input.description!,
					amount: input.amount,
					notes: input.notes,
					relatedDocumentIds: input.relatedDocumentIds ?? []
				}
			});
		},
		{ userId: input.userId, reason: 'Log external vendor interaction' }
	);

	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: ActivityEntityType.EXTERNAL_VENDOR,
		entityId: interaction.id,
		action: ActivityActionType.CREATE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: `Vendor interaction: ${input.interactionType} - ${input.description?.substring(0, 50)}`,
		performedById: input.userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'externalVendorWorkflow_v1',
		workflowStep: ExternalVendorWorkflowAction.LOG_INTERACTION,
		workflowVersion: 'v1',
		newState: { interactionType: input.interactionType, description: input.description }
	});

	return {
		id: interaction.id,
		interactionType: interaction.interactionType,
		interactionDate: interaction.interactionDate.toISOString(),
		createdAt: interaction.createdAt.toISOString()
	};
}

// Main workflow function

async function externalVendorWorkflow(input: ExternalVendorWorkflowInput): Promise<ExternalVendorWorkflowResult> {
	const workflowName = 'externalVendorWorkflow_v1';
	const log = createWorkflowLogger(workflowName, DBOS.workflowID, input.action);
	const startTime = logWorkflowStart(log, input.action, {
		organizationId: input.organizationId,
		userId: input.userId
	}, workflowName, DBOS.workflowID);

	try {
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'started', action: input.action });

		switch (input.action) {
			case ExternalVendorWorkflowAction.CREATE_CONTEXT: {
				if (!input.vendorName) {
					const error = new Error('Missing required field: vendorName for CREATE_CONTEXT');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: createContext starting', { vendorName: input.vendorName });
				const result = await DBOS.runStep(
					() => createContext(input),
					{ name: 'createContext' }
				);
				log.info('Step: createContext completed', { id: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'context_created', ...result });
				const successResult: ExternalVendorWorkflowResult = {
					success: true,
					entityId: result.id,
					contextId: result.id,
					vendorName: result.vendorName,
					createdAt: result.createdAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case ExternalVendorWorkflowAction.UPDATE_CONTEXT: {
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
				const successResult: ExternalVendorWorkflowResult = {
					success: true,
					entityId: result.id,
					contextId: result.id,
					vendorName: result.vendorName,
					updatedAt: result.updatedAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case ExternalVendorWorkflowAction.LINK_TO_SERVICE_PROVIDER: {
				if (!input.contextId || !input.serviceProviderOrgId) {
					const error = new Error('Missing required fields: contextId and serviceProviderOrgId for LINK_TO_SERVICE_PROVIDER');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: linkToServiceProvider starting', { contextId: input.contextId });
				const result = await DBOS.runStep(
					() => linkToServiceProvider(input),
					{ name: 'linkToServiceProvider' }
				);
				log.info('Step: linkToServiceProvider completed', { id: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'linked_to_provider', ...result });
				const successResult: ExternalVendorWorkflowResult = {
					success: true,
					entityId: result.id,
					contextId: result.id,
					linkedServiceProviderOrgId: result.linkedServiceProviderOrgId
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case ExternalVendorWorkflowAction.LOG_INTERACTION: {
				if (!input.externalVendorContextId || !input.interactionType || !input.interactionDate || !input.description) {
					const error = new Error('Missing required fields for LOG_INTERACTION');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: logInteraction starting', { contextId: input.externalVendorContextId });
				const result = await DBOS.runStep(
					() => logInteraction(input),
					{ name: 'logInteraction' }
				);
				log.info('Step: logInteraction completed', { id: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'interaction_logged', ...result });
				const successResult: ExternalVendorWorkflowResult = {
					success: true,
					entityId: result.id,
					interactionId: result.id,
					interactionType: result.interactionType,
					interactionDate: result.interactionDate,
					createdAt: result.createdAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			default: {
				const errorResult: ExternalVendorWorkflowResult = {
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
			errorCode: ActivityActionType.WORKFLOW_FAILED,
			errorType: WorkflowErrorType.EXTERNAL_VENDOR_WORKFLOW_ERROR
		});
		const errorResult: ExternalVendorWorkflowResult = {
			success: false,
			error: errorMessage
		};
		logWorkflowEnd(log, input.action, false, startTime, errorResult);
		return errorResult;
	}
}

export const externalVendorWorkflow_v1 = DBOS.registerWorkflow(externalVendorWorkflow);

export async function startExternalVendorWorkflow(
	input: ExternalVendorWorkflowInput,
	idempotencyKey: string
): Promise<ExternalVendorWorkflowResult> {
	const handle = await DBOS.startWorkflow(externalVendorWorkflow_v1, { workflowID: idempotencyKey })(input);
	return handle.getResult();
}
