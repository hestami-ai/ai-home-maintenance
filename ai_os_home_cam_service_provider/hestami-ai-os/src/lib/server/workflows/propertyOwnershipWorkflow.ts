/**
 * Property Ownership Workflow (v1)
 *
 * DBOS durable workflow for property ownership management (Phase 3 Concierge).
 * Handles: create, update, verify, terminate, delete operations on PropertyOwnership records.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { orgTransaction } from '../db/rls.js';
import type { EntityWorkflowResult } from './schemas.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger, logWorkflowStart, logWorkflowEnd, logStepError } from './workflowLogger.js';
import type { PropertyOwnershipRole } from '../../../../generated/prisma/client.js';
import {
	ActivityEntityType,
	ActivityActionType,
	ActivityEventCategory,
	ActivityActorType,
	PropertyOwnershipStatus,
	DelegatedAuthorityStatus
} from '../../../../generated/prisma/enums.js';

// Workflow error types for tracing
const WorkflowErrorType = {
	PROPERTY_OWNERSHIP_WORKFLOW_ERROR: 'PROPERTY_OWNERSHIP_WORKFLOW_ERROR'
} as const;

const WORKFLOW_STATUS_EVENT = 'property_ownership_workflow_status';
const WORKFLOW_ERROR_EVENT = 'property_ownership_workflow_error';

// Action types for property ownership operations
export const PropertyOwnershipWorkflowAction = {
	CREATE: 'CREATE',
	UPDATE: 'UPDATE',
	VERIFY: 'VERIFY',
	TERMINATE: 'TERMINATE',
	DELETE: 'DELETE'
} as const;

export type PropertyOwnershipWorkflowAction = (typeof PropertyOwnershipWorkflowAction)[keyof typeof PropertyOwnershipWorkflowAction];

export interface PropertyOwnershipWorkflowInput {
	action: PropertyOwnershipWorkflowAction;
	organizationId: string;
	userId: string;
	// CREATE fields
	propertyId?: string;
	partyId?: string;
	role?: PropertyOwnershipRole;
	ownershipPercentage?: number;
	isPrimaryContact?: boolean;
	effectiveFrom?: Date;
	effectiveTo?: Date | null;
	notes?: string | null;
	// UPDATE/VERIFY/TERMINATE/DELETE fields
	propertyOwnershipId?: string;
}

export interface PropertyOwnershipWorkflowResult extends EntityWorkflowResult {
	propertyOwnershipId?: string;
	propertyId?: string;
	partyId?: string;
	role?: string;
	status?: string;
	ownershipPercentage?: number | null;
	isPrimaryContact?: boolean;
	verifiedAt?: string;
	verifiedBy?: string;
	effectiveFrom?: string;
	effectiveTo?: string | null;
	createdAt?: string;
	updatedAt?: string;
	deletedAt?: string;
	[key: string]: unknown;
}

// Step functions

async function createPropertyOwnership(
	input: PropertyOwnershipWorkflowInput
): Promise<{
	id: string;
	propertyId: string;
	partyId: string;
	role: string;
	status: string;
	ownershipPercentage: number | null;
	isPrimaryContact: boolean;
	effectiveFrom: string;
	effectiveTo: string | null;
	createdAt: string;
}> {
	// Use a transaction to ensure atomicity of primary contact update and create
	const propertyOwnership = await orgTransaction(input.organizationId, async (tx) => {
		// If setting as primary contact, unset other primaries for this property
		if (input.isPrimaryContact) {
			await tx.propertyOwnership.updateMany({
				where: { propertyId: input.propertyId!, isPrimaryContact: true },
				data: { isPrimaryContact: false }
			});
		}

		return tx.propertyOwnership.create({
			data: {
				propertyId: input.propertyId!,
				partyId: input.partyId!,
				role: input.role!,
				status: PropertyOwnershipStatus.ACTIVE,
				ownershipPercentage: input.ownershipPercentage,
				isPrimaryContact: input.isPrimaryContact ?? false,
				effectiveFrom: input.effectiveFrom ?? new Date(),
				effectiveTo: input.effectiveTo,
				notes: input.notes
			}
		});
	}, { userId: input.userId, reason: 'Create property ownership record' });

	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: ActivityEntityType.OWNERSHIP,
		entityId: propertyOwnership.id,
		action: ActivityActionType.CREATE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: `Property ownership created for role ${input.role}`,
		performedById: input.userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'propertyOwnershipWorkflow_v1',
		workflowStep: PropertyOwnershipWorkflowAction.CREATE,
		workflowVersion: 'v1',
		newState: { role: input.role, isPrimaryContact: input.isPrimaryContact }
	});

	return {
		id: propertyOwnership.id,
		propertyId: propertyOwnership.propertyId,
		partyId: propertyOwnership.partyId,
		role: propertyOwnership.role,
		status: propertyOwnership.status,
		ownershipPercentage: propertyOwnership.ownershipPercentage ? Number(propertyOwnership.ownershipPercentage) : null,
		isPrimaryContact: propertyOwnership.isPrimaryContact,
		effectiveFrom: propertyOwnership.effectiveFrom.toISOString(),
		effectiveTo: propertyOwnership.effectiveTo?.toISOString() ?? null,
		createdAt: propertyOwnership.createdAt.toISOString()
	};
}

async function updatePropertyOwnership(
	input: PropertyOwnershipWorkflowInput,
	existingPropertyId: string
): Promise<{
	id: string;
	ownershipPercentage: number | null;
	isPrimaryContact: boolean;
	effectiveTo: string | null;
	updatedAt: string;
}> {
	// Use a transaction to ensure atomicity of primary contact update
	const propertyOwnership = await orgTransaction(input.organizationId, async (tx) => {
		// If setting as primary contact, unset other primaries for this property
		if (input.isPrimaryContact === true) {
			await tx.propertyOwnership.updateMany({
				where: {
					propertyId: existingPropertyId,
					isPrimaryContact: true,
					id: { not: input.propertyOwnershipId! }
				},
				data: { isPrimaryContact: false }
			});
		}

		return tx.propertyOwnership.update({
			where: { id: input.propertyOwnershipId },
			data: {
				...(input.ownershipPercentage !== undefined && { ownershipPercentage: input.ownershipPercentage }),
				...(input.isPrimaryContact !== undefined && { isPrimaryContact: input.isPrimaryContact }),
				...(input.effectiveTo !== undefined && { effectiveTo: input.effectiveTo }),
				...(input.notes !== undefined && { notes: input.notes })
			}
		});
	}, { userId: input.userId, reason: 'Update property ownership record' });

	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: ActivityEntityType.OWNERSHIP,
		entityId: propertyOwnership.id,
		action: ActivityActionType.UPDATE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: `Property ownership updated`,
		performedById: input.userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'propertyOwnershipWorkflow_v1',
		workflowStep: PropertyOwnershipWorkflowAction.UPDATE,
		workflowVersion: 'v1',
		newState: { isPrimaryContact: input.isPrimaryContact, ownershipPercentage: input.ownershipPercentage }
	});

	return {
		id: propertyOwnership.id,
		ownershipPercentage: propertyOwnership.ownershipPercentage ? Number(propertyOwnership.ownershipPercentage) : null,
		isPrimaryContact: propertyOwnership.isPrimaryContact,
		effectiveTo: propertyOwnership.effectiveTo?.toISOString() ?? null,
		updatedAt: propertyOwnership.updatedAt.toISOString()
	};
}

async function verifyPropertyOwnership(
	propertyOwnershipId: string,
	organizationId: string,
	userId: string
): Promise<{
	id: string;
	status: string;
	verifiedAt: string;
	verifiedBy: string;
}> {
	const now = new Date();
	const propertyOwnership = await orgTransaction(organizationId, async (tx) => {
		return tx.propertyOwnership.update({
			where: { id: propertyOwnershipId },
			data: {
				status: PropertyOwnershipStatus.ACTIVE,
				verifiedAt: now,
				verifiedBy: userId
			}
		});
	}, { userId, reason: 'Verify property ownership record' });

	await recordWorkflowEvent({
		organizationId,
		entityType: ActivityEntityType.OWNERSHIP,
		entityId: propertyOwnershipId,
		action: ActivityActionType.STATUS_CHANGE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: `Property ownership verified`,
		performedById: userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'propertyOwnershipWorkflow_v1',
		workflowStep: 'VERIFY',
		workflowVersion: 'v1',
		newState: { status: PropertyOwnershipStatus.ACTIVE, verifiedAt: now.toISOString() }
	});

	return {
		id: propertyOwnership.id,
		status: propertyOwnership.status,
		verifiedAt: propertyOwnership.verifiedAt!.toISOString(),
		verifiedBy: propertyOwnership.verifiedBy!
	};
}

async function terminatePropertyOwnership(
	propertyOwnershipId: string,
	organizationId: string,
	userId: string,
	effectiveTo: Date
): Promise<{
	id: string;
	status: string;
	effectiveTo: string;
}> {
	// Use a transaction to terminate ownership and revoke delegated authorities
	const propertyOwnership = await orgTransaction(organizationId, async (tx) => {
		const ownership = await tx.propertyOwnership.update({
			where: { id: propertyOwnershipId },
			data: {
				status: PropertyOwnershipStatus.TERMINATED,
				effectiveTo,
				isPrimaryContact: false
			}
		});

		// Revoke any delegated authorities from this ownership
		await tx.delegatedAuthority.updateMany({
			where: {
				propertyOwnershipId,
				status: DelegatedAuthorityStatus.ACTIVE
			},
			data: {
				status: DelegatedAuthorityStatus.REVOKED,
				revokedAt: new Date(),
				revokedBy: userId,
				revokeReason: 'Property ownership terminated'
			}
		});

		return ownership;
	}, { userId, reason: 'Terminate property ownership' });

	await recordWorkflowEvent({
		organizationId,
		entityType: ActivityEntityType.OWNERSHIP,
		entityId: propertyOwnershipId,
		action: ActivityActionType.STATUS_CHANGE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: `Property ownership terminated`,
		performedById: userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'propertyOwnershipWorkflow_v1',
		workflowStep: 'TERMINATE',
		workflowVersion: 'v1',
		newState: { status: PropertyOwnershipStatus.TERMINATED, effectiveTo: effectiveTo.toISOString() }
	});

	return {
		id: propertyOwnership.id,
		status: propertyOwnership.status,
		effectiveTo: propertyOwnership.effectiveTo!.toISOString()
	};
}

async function deletePropertyOwnership(
	propertyOwnershipId: string,
	organizationId: string,
	userId: string
): Promise<{ deletedAt: string }> {
	const now = new Date();

	// Use a transaction to soft delete ownership and revoke delegated authorities
	await orgTransaction(organizationId, async (tx) => {
		await tx.propertyOwnership.update({
			where: { id: propertyOwnershipId },
			data: { deletedAt: now }
		});

		// Revoke any delegated authorities from this ownership
		await tx.delegatedAuthority.updateMany({
			where: { propertyOwnershipId },
			data: {
				status: DelegatedAuthorityStatus.REVOKED,
				revokedAt: now,
				revokedBy: userId,
				revokeReason: 'Property ownership deleted'
			}
		});
	}, { userId, reason: 'Delete property ownership' });

	await recordWorkflowEvent({
		organizationId,
		entityType: ActivityEntityType.OWNERSHIP,
		entityId: propertyOwnershipId,
		action: ActivityActionType.DELETE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: `Property ownership deleted`,
		performedById: userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'propertyOwnershipWorkflow_v1',
		workflowStep: PropertyOwnershipWorkflowAction.DELETE,
		workflowVersion: 'v1',
		newState: { deletedAt: now.toISOString() }
	});

	return { deletedAt: now.toISOString() };
}

// Main workflow function

async function propertyOwnershipWorkflow(input: PropertyOwnershipWorkflowInput): Promise<PropertyOwnershipWorkflowResult> {
	const workflowName = 'propertyOwnershipWorkflow_v1';
	const log = createWorkflowLogger(workflowName, DBOS.workflowID, input.action);
	const startTime = logWorkflowStart(log, input.action, {
		organizationId: input.organizationId,
		userId: input.userId,
		propertyOwnershipId: input.propertyOwnershipId
	}, workflowName, DBOS.workflowID);

	try {
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'started', action: input.action });

		switch (input.action) {
			case PropertyOwnershipWorkflowAction.CREATE: {
				if (!input.propertyId || !input.partyId || !input.role) {
					const error = new Error('Missing required fields: propertyId, partyId, role for CREATE');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: createPropertyOwnership starting', { propertyId: input.propertyId, partyId: input.partyId });
				const result = await DBOS.runStep(
					() => createPropertyOwnership(input),
					{ name: 'createPropertyOwnership' }
				);
				log.info('Step: createPropertyOwnership completed', { id: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'ownership_created', propertyOwnershipId: result.id });
				const successResult: PropertyOwnershipWorkflowResult = {
					success: true,
					entityId: result.id,
					propertyOwnershipId: result.id,
					propertyId: result.propertyId,
					partyId: result.partyId,
					role: result.role,
					status: result.status,
					ownershipPercentage: result.ownershipPercentage,
					isPrimaryContact: result.isPrimaryContact,
					effectiveFrom: result.effectiveFrom,
					effectiveTo: result.effectiveTo,
					createdAt: result.createdAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case PropertyOwnershipWorkflowAction.UPDATE: {
				if (!input.propertyOwnershipId || !input.propertyId) {
					const error = new Error('Missing required fields: propertyOwnershipId, propertyId for UPDATE');
					logStepError(log, 'validation', error, { propertyOwnershipId: input.propertyOwnershipId });
					throw error;
				}
				log.debug('Step: updatePropertyOwnership starting', { propertyOwnershipId: input.propertyOwnershipId });
				const result = await DBOS.runStep(
					() => updatePropertyOwnership(input, input.propertyId!),
					{ name: 'updatePropertyOwnership' }
				);
				log.info('Step: updatePropertyOwnership completed', { id: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'ownership_updated', propertyOwnershipId: result.id });
				const successResult: PropertyOwnershipWorkflowResult = {
					success: true,
					entityId: result.id,
					propertyOwnershipId: result.id,
					ownershipPercentage: result.ownershipPercentage,
					isPrimaryContact: result.isPrimaryContact,
					effectiveTo: result.effectiveTo,
					updatedAt: result.updatedAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case PropertyOwnershipWorkflowAction.VERIFY: {
				if (!input.propertyOwnershipId) {
					const error = new Error('Missing required field: propertyOwnershipId for VERIFY');
					logStepError(log, 'validation', error, { propertyOwnershipId: input.propertyOwnershipId });
					throw error;
				}
				log.debug('Step: verifyPropertyOwnership starting', { propertyOwnershipId: input.propertyOwnershipId });
				const result = await DBOS.runStep(
					() => verifyPropertyOwnership(input.propertyOwnershipId!, input.organizationId, input.userId),
					{ name: 'verifyPropertyOwnership' }
				);
				log.info('Step: verifyPropertyOwnership completed', { id: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'ownership_verified', propertyOwnershipId: result.id });
				const successResult: PropertyOwnershipWorkflowResult = {
					success: true,
					entityId: result.id,
					propertyOwnershipId: result.id,
					status: result.status,
					verifiedAt: result.verifiedAt,
					verifiedBy: result.verifiedBy
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case PropertyOwnershipWorkflowAction.TERMINATE: {
				if (!input.propertyOwnershipId) {
					const error = new Error('Missing required field: propertyOwnershipId for TERMINATE');
					logStepError(log, 'validation', error, { propertyOwnershipId: input.propertyOwnershipId });
					throw error;
				}
				const effectiveTo = input.effectiveTo ?? new Date();
				log.debug('Step: terminatePropertyOwnership starting', { propertyOwnershipId: input.propertyOwnershipId });
				const result = await DBOS.runStep(
					() => terminatePropertyOwnership(input.propertyOwnershipId!, input.organizationId, input.userId, effectiveTo),
					{ name: 'terminatePropertyOwnership' }
				);
				log.info('Step: terminatePropertyOwnership completed', { id: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'ownership_terminated', propertyOwnershipId: result.id });
				const successResult: PropertyOwnershipWorkflowResult = {
					success: true,
					entityId: result.id,
					propertyOwnershipId: result.id,
					status: result.status,
					effectiveTo: result.effectiveTo
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case PropertyOwnershipWorkflowAction.DELETE: {
				if (!input.propertyOwnershipId) {
					const error = new Error('Missing required field: propertyOwnershipId for DELETE');
					logStepError(log, 'validation', error, { propertyOwnershipId: input.propertyOwnershipId });
					throw error;
				}
				log.debug('Step: deletePropertyOwnership starting', { propertyOwnershipId: input.propertyOwnershipId });
				const result = await DBOS.runStep(
					() => deletePropertyOwnership(input.propertyOwnershipId!, input.organizationId, input.userId),
					{ name: 'deletePropertyOwnership' }
				);
				log.info('Step: deletePropertyOwnership completed', { propertyOwnershipId: input.propertyOwnershipId });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'ownership_deleted', propertyOwnershipId: input.propertyOwnershipId });
				const successResult: PropertyOwnershipWorkflowResult = {
					success: true,
					entityId: input.propertyOwnershipId,
					propertyOwnershipId: input.propertyOwnershipId,
					deletedAt: result.deletedAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			default: {
				const errorResult: PropertyOwnershipWorkflowResult = {
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
			propertyOwnershipId: input.propertyOwnershipId,
			error: errorMessage,
			stack: errorObj.stack
		});

		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		await recordSpanError(errorObj, {
			errorCode: ActivityActionType.WORKFLOW_FAILED,
			errorType: WorkflowErrorType.PROPERTY_OWNERSHIP_WORKFLOW_ERROR
		});
		const errorResult: PropertyOwnershipWorkflowResult = {
			success: false,
			error: errorMessage
		};
		logWorkflowEnd(log, input.action, false, startTime, errorResult);
		return errorResult;
	}
}

export const propertyOwnershipWorkflow_v1 = DBOS.registerWorkflow(propertyOwnershipWorkflow);

export async function startPropertyOwnershipWorkflow(
	input: PropertyOwnershipWorkflowInput,
	idempotencyKey: string
): Promise<PropertyOwnershipWorkflowResult> {
	const handle = await DBOS.startWorkflow(propertyOwnershipWorkflow_v1, { workflowID: idempotencyKey })(input);
	return handle.getResult();
}
