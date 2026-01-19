/**
 * Party Workflow (v1)
 *
 * DBOS durable workflow for party (owner/tenant) management.
 * Handles: create, update, and soft delete operations.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import { orgTransaction, clearOrgContext } from '../db/rls.js';
import type { EntityWorkflowResult, CrudAction } from './schemas.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger, logWorkflowStart, logWorkflowEnd, logStepError } from './workflowLogger.js';
import {
	ActivityEntityType,
	ActivityActionType,
	ActivityEventCategory,
	ActivityActorType,
	PartyType
} from '../../../../generated/prisma/enums.js';

// Workflow error types for tracing
const WorkflowErrorType = {
	PARTY_WORKFLOW_ERROR: 'PARTY_WORKFLOW_ERROR'
} as const;

const WORKFLOW_STATUS_EVENT = 'party_workflow_status';
const WORKFLOW_ERROR_EVENT = 'party_workflow_error';

// Action types for party operations
export const PartyWorkflowAction = {
	CREATE: 'CREATE',
	UPDATE: 'UPDATE',
	DELETE: 'DELETE'
} as const;

export type PartyWorkflowAction = (typeof PartyWorkflowAction)[keyof typeof PartyWorkflowAction];

export interface PartyWorkflowInput {
	action: PartyWorkflowAction;
	organizationId: string;
	userId: string;
	partyId?: string;
	partyType?: PartyType;
	firstName?: string | null;
	lastName?: string | null;
	entityName?: string | null;
	email?: string | null;
	phone?: string | null;
	addressLine1?: string | null;
	addressLine2?: string | null;
	city?: string | null;
	state?: string | null;
	postalCode?: string | null;
	country?: string;
	linkedUserId?: string | null;
}

export interface PartyWorkflowResult extends EntityWorkflowResult {
	partyId?: string;
	partyType?: string;
	displayName?: string;
	updatedAt?: string;
	deletedAt?: string;
	[key: string]: unknown;
}

async function createParty(
	organizationId: string,
	userId: string,
	partyType: PartyType,
	data: {
		firstName?: string | null;
		lastName?: string | null;
		entityName?: string | null;
		email?: string | null;
		phone?: string | null;
		addressLine1?: string | null;
		addressLine2?: string | null;
		city?: string | null;
		state?: string | null;
		postalCode?: string | null;
		country?: string;
		linkedUserId?: string | null;
	}
): Promise<{ id: string; partyType: string; displayName: string }> {
	try {
		const party = await orgTransaction(organizationId, async (tx) => {
			return tx.party.create({
				data: {
					organizationId,
					partyType,
					firstName: data.firstName,
					lastName: data.lastName,
					entityName: data.entityName,
					email: data.email,
					phone: data.phone,
					addressLine1: data.addressLine1,
					addressLine2: data.addressLine2,
					city: data.city,
					state: data.state,
					postalCode: data.postalCode,
					country: data.country ?? 'US',
					userId: data.linkedUserId
				}
			});
		}, { userId, reason: 'Creating party via workflow' });

		const displayName =
			party.partyType === PartyType.INDIVIDUAL
				? `${party.firstName ?? ''} ${party.lastName ?? ''}`.trim()
				: party.entityName ?? '';

		// Record activity event
		await recordWorkflowEvent({
			organizationId,
			entityType: ActivityEntityType.PARTY,
			entityId: party.id,
			action: ActivityActionType.CREATE,
			eventCategory: ActivityEventCategory.EXECUTION,
			summary: `Party created: ${displayName}`,
			performedById: userId,
			performedByType: ActivityActorType.HUMAN,
			workflowId: 'partyWorkflow_v1',
			workflowStep: PartyWorkflowAction.CREATE,
			workflowVersion: 'v1',
			newState: { partyType: party.partyType, displayName }
		});

		return { id: party.id, partyType: party.partyType, displayName };
	} finally {
		await clearOrgContext(userId);
	}
}

async function updateParty(
	partyId: string,
	organizationId: string,
	userId: string,
	data: {
		partyType?: PartyType;
		firstName?: string | null;
		lastName?: string | null;
		entityName?: string | null;
		email?: string | null;
		phone?: string | null;
		addressLine1?: string | null;
		addressLine2?: string | null;
		city?: string | null;
		state?: string | null;
		postalCode?: string | null;
		country?: string;
	}
): Promise<{ id: string; updatedAt: string }> {
	try {
		const party = await orgTransaction(organizationId, async (tx) => {
			// Build update data, excluding undefined values
			const updateData: Record<string, unknown> = {};
			if (data.partyType !== undefined) updateData.partyType = data.partyType;
			if (data.firstName !== undefined) updateData.firstName = data.firstName;
			if (data.lastName !== undefined) updateData.lastName = data.lastName;
			if (data.entityName !== undefined) updateData.entityName = data.entityName;
			if (data.email !== undefined) updateData.email = data.email;
			if (data.phone !== undefined) updateData.phone = data.phone;
			if (data.addressLine1 !== undefined) updateData.addressLine1 = data.addressLine1;
			if (data.addressLine2 !== undefined) updateData.addressLine2 = data.addressLine2;
			if (data.city !== undefined) updateData.city = data.city;
			if (data.state !== undefined) updateData.state = data.state;
			if (data.postalCode !== undefined) updateData.postalCode = data.postalCode;
			if (data.country !== undefined) updateData.country = data.country;

			return tx.party.update({
				where: { id: partyId },
				data: updateData
			});
		}, { userId, reason: 'Updating party via workflow' });

		// Record activity event
		await recordWorkflowEvent({
			organizationId,
			entityType: ActivityEntityType.PARTY,
			entityId: partyId,
			action: ActivityActionType.UPDATE,
			eventCategory: ActivityEventCategory.EXECUTION,
			summary: `Party updated`,
			performedById: userId,
			performedByType: ActivityActorType.HUMAN,
			workflowId: 'partyWorkflow_v1',
			workflowStep: PartyWorkflowAction.UPDATE,
			workflowVersion: 'v1',
			newState: data
		});

		return { id: party.id, updatedAt: party.updatedAt.toISOString() };
	} finally {
		await clearOrgContext(userId);
	}
}

async function deleteParty(
	partyId: string,
	organizationId: string,
	userId: string
): Promise<{ deletedAt: string }> {
	try {
		const now = new Date();
		await orgTransaction(organizationId, async (tx) => {
			return tx.party.update({
				where: { id: partyId },
				data: { deletedAt: now }
			});
		}, { userId, reason: 'Soft deleting party via workflow' });

		// Record activity event
		await recordWorkflowEvent({
			organizationId,
			entityType: ActivityEntityType.PARTY,
			entityId: partyId,
			action: ActivityActionType.DELETE,
			eventCategory: ActivityEventCategory.EXECUTION,
			summary: `Party deleted`,
			performedById: userId,
			performedByType: ActivityActorType.HUMAN,
			workflowId: 'partyWorkflow_v1',
			workflowStep: PartyWorkflowAction.DELETE,
			workflowVersion: 'v1',
			newState: { deletedAt: now.toISOString() }
		});

		return { deletedAt: now.toISOString() };
	} finally {
		await clearOrgContext(userId);
	}
}

async function partyWorkflow(input: PartyWorkflowInput): Promise<PartyWorkflowResult> {
	const workflowName = 'partyWorkflow_v1';
	const log = createWorkflowLogger(workflowName, DBOS.workflowID, input.action);
	const startTime = logWorkflowStart(log, input.action, {
		organizationId: input.organizationId,
		userId: input.userId,
		partyId: input.partyId
	}, workflowName, DBOS.workflowID);

	try {
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'started', action: input.action });

		switch (input.action) {
			case PartyWorkflowAction.CREATE: {
				if (!input.partyType) {
					const error = new Error('Missing required field: partyType for CREATE');
					logStepError(log, 'validation', error, { partyType: input.partyType });
					throw error;
				}
				log.debug('Step: createParty starting', { partyType: input.partyType });
				const result = await DBOS.runStep(
					() =>
						createParty(input.organizationId, input.userId, input.partyType!, {
							firstName: input.firstName,
							lastName: input.lastName,
							entityName: input.entityName,
							email: input.email,
							phone: input.phone,
							addressLine1: input.addressLine1,
							addressLine2: input.addressLine2,
							city: input.city,
							state: input.state,
							postalCode: input.postalCode,
							country: input.country,
							linkedUserId: input.linkedUserId
						}),
					{ name: 'createParty' }
				);
				log.info('Step: createParty completed', { partyId: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'party_created', ...result });
				const successResult: PartyWorkflowResult = {
					success: true,
					entityId: result.id,
					partyId: result.id,
					partyType: result.partyType,
					displayName: result.displayName
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case PartyWorkflowAction.UPDATE: {
				if (!input.partyId) {
					const error = new Error('Missing required field: partyId for UPDATE');
					logStepError(log, 'validation', error, { partyId: input.partyId });
					throw error;
				}
				log.debug('Step: updateParty starting', { partyId: input.partyId });
				const result = await DBOS.runStep(
					() =>
						updateParty(input.partyId!, input.organizationId, input.userId, {
							partyType: input.partyType,
							firstName: input.firstName,
							lastName: input.lastName,
							entityName: input.entityName,
							email: input.email,
							phone: input.phone,
							addressLine1: input.addressLine1,
							addressLine2: input.addressLine2,
							city: input.city,
							state: input.state,
							postalCode: input.postalCode,
							country: input.country
						}),
					{ name: 'updateParty' }
				);
				log.info('Step: updateParty completed', { partyId: result.id, updatedAt: result.updatedAt });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'party_updated', ...result });
				const successResult: PartyWorkflowResult = {
					success: true,
					entityId: result.id,
					partyId: result.id,
					updatedAt: result.updatedAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case PartyWorkflowAction.DELETE: {
				if (!input.partyId) {
					const error = new Error('Missing required field: partyId for DELETE');
					logStepError(log, 'validation', error, { partyId: input.partyId });
					throw error;
				}
				log.debug('Step: deleteParty starting', { partyId: input.partyId });
				const result = await DBOS.runStep(
					() => deleteParty(input.partyId!, input.organizationId, input.userId),
					{ name: 'deleteParty' }
				);
				log.info('Step: deleteParty completed', { partyId: input.partyId, deletedAt: result.deletedAt });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'party_deleted', ...result });
				const successResult: PartyWorkflowResult = {
					success: true,
					entityId: input.partyId,
					partyId: input.partyId,
					deletedAt: result.deletedAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			default: {
				const errorResult: PartyWorkflowResult = {
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
			partyId: input.partyId,
			error: errorMessage,
			stack: errorObj.stack
		});

		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: ActivityActionType.WORKFLOW_FAILED,
			errorType: WorkflowErrorType.PARTY_WORKFLOW_ERROR
		});
		const errorResult: PartyWorkflowResult = {
			success: false,
			error: errorMessage
		};
		logWorkflowEnd(log, input.action, false, startTime, errorResult);
		return errorResult;
	}
}

export const partyWorkflow_v1 = DBOS.registerWorkflow(partyWorkflow);
