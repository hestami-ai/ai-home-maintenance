/**
 * Unit Workflow (v1)
 *
 * DBOS durable workflow for unit (property unit) management.
 * Handles: create, update, and soft delete operations.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { orgTransaction, clearOrgContext } from '../db/rls.js';
import type { EntityWorkflowResult } from './schemas.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger, logWorkflowStart, logWorkflowEnd, logStepError } from './workflowLogger.js';
import type { UnitType } from '../../../../generated/prisma/client.js';
import {
	ActivityEntityType,
	ActivityActionType,
	ActivityEventCategory,
	ActivityActorType
} from '../../../../generated/prisma/enums.js';

// Workflow error types for tracing
const WorkflowErrorType = {
	UNIT_WORKFLOW_ERROR: 'UNIT_WORKFLOW_ERROR'
} as const;

const WORKFLOW_STATUS_EVENT = 'unit_workflow_status';
const WORKFLOW_ERROR_EVENT = 'unit_workflow_error';

export const UnitWorkflowAction = {
	CREATE: 'CREATE',
	UPDATE: 'UPDATE',
	DELETE: 'DELETE'
} as const;

export type UnitWorkflowAction = (typeof UnitWorkflowAction)[keyof typeof UnitWorkflowAction];

export interface UnitWorkflowInput {
	action: UnitWorkflowAction;
	organizationId: string;
	userId: string;
	unitId?: string;
	propertyId?: string;
	unitNumber?: string;
	unitType?: UnitType;
	addressLine1?: string | null;
	addressLine2?: string | null;
	city?: string | null;
	state?: string | null;
	postalCode?: string | null;
	bedrooms?: number | null;
	bathrooms?: number | null;
	squareFeet?: number | null;
	lotSquareFeet?: number | null;
	parkingSpaces?: number;
	assessmentClass?: string | null;
	votingWeight?: number;
}

export interface UnitWorkflowResult extends EntityWorkflowResult {
	unitId?: string;
	unitNumber?: string;
	unitType?: string;
	updatedAt?: string;
	deletedAt?: string;
	[key: string]: unknown;
}

async function createUnit(
	organizationId: string,
	userId: string,
	propertyId: string,
	unitNumber: string,
	unitType: UnitType,
	data: {
		addressLine1?: string | null;
		addressLine2?: string | null;
		city?: string | null;
		state?: string | null;
		postalCode?: string | null;
		bedrooms?: number | null;
		bathrooms?: number | null;
		squareFeet?: number | null;
		lotSquareFeet?: number | null;
		parkingSpaces?: number;
		assessmentClass?: string | null;
		votingWeight?: number;
	}
): Promise<{ id: string; unitNumber: string; unitType: string }> {
	try {
		const unit = await orgTransaction(organizationId, async (tx) => {
			return tx.unit.create({
				data: {
					organizationId,
					propertyId,
					unitNumber,
					unitType,
					addressLine1: data.addressLine1,
					addressLine2: data.addressLine2,
					city: data.city,
					state: data.state,
					postalCode: data.postalCode,
					bedrooms: data.bedrooms,
					bathrooms: data.bathrooms,
					squareFeet: data.squareFeet,
					lotSquareFeet: data.lotSquareFeet,
					parkingSpaces: data.parkingSpaces ?? 0,
					assessmentClass: data.assessmentClass,
					votingWeight: data.votingWeight ?? 1
				}
			});
		}, { userId, reason: 'Creating unit via workflow' });

		await recordWorkflowEvent({
			organizationId,
			entityType: ActivityEntityType.UNIT,
			entityId: unit.id,
			action: ActivityActionType.CREATE,
			eventCategory: ActivityEventCategory.EXECUTION,
			summary: `Unit created: ${unitNumber}`,
			performedById: userId,
			performedByType: ActivityActorType.HUMAN,
			workflowId: 'unitWorkflow_v1',
			workflowStep: UnitWorkflowAction.CREATE,
			workflowVersion: 'v1',
			unitId: unit.id,
			newState: { unitNumber, unitType }
		});

		return { id: unit.id, unitNumber: unit.unitNumber, unitType: unit.unitType };
	} finally {
		await clearOrgContext(userId);
	}
}

async function updateUnit(
	unitId: string,
	organizationId: string,
	userId: string,
	data: {
		unitNumber?: string;
		unitType?: UnitType;
		addressLine1?: string | null;
		addressLine2?: string | null;
		city?: string | null;
		state?: string | null;
		postalCode?: string | null;
		bedrooms?: number | null;
		bathrooms?: number | null;
		squareFeet?: number | null;
		lotSquareFeet?: number | null;
		parkingSpaces?: number;
		assessmentClass?: string | null;
		votingWeight?: number;
	}
): Promise<{ id: string; unitNumber: string; updatedAt: string }> {
	try {
		const unit = await orgTransaction(organizationId, async (tx) => {
			const updateData: Record<string, unknown> = {};
			if (data.unitNumber !== undefined) updateData.unitNumber = data.unitNumber;
			if (data.unitType !== undefined) updateData.unitType = data.unitType;
			if (data.addressLine1 !== undefined) updateData.addressLine1 = data.addressLine1;
			if (data.addressLine2 !== undefined) updateData.addressLine2 = data.addressLine2;
			if (data.city !== undefined) updateData.city = data.city;
			if (data.state !== undefined) updateData.state = data.state;
			if (data.postalCode !== undefined) updateData.postalCode = data.postalCode;
			if (data.bedrooms !== undefined) updateData.bedrooms = data.bedrooms;
			if (data.bathrooms !== undefined) updateData.bathrooms = data.bathrooms;
			if (data.squareFeet !== undefined) updateData.squareFeet = data.squareFeet;
			if (data.lotSquareFeet !== undefined) updateData.lotSquareFeet = data.lotSquareFeet;
			if (data.parkingSpaces !== undefined) updateData.parkingSpaces = data.parkingSpaces;
			if (data.assessmentClass !== undefined) updateData.assessmentClass = data.assessmentClass;
			if (data.votingWeight !== undefined) updateData.votingWeight = data.votingWeight;

			return tx.unit.update({
				where: { id: unitId },
				data: updateData
			});
		}, { userId, reason: 'Updating unit via workflow' });

		await recordWorkflowEvent({
			organizationId,
			entityType: ActivityEntityType.UNIT,
			entityId: unitId,
			action: ActivityActionType.UPDATE,
			eventCategory: ActivityEventCategory.EXECUTION,
			summary: `Unit updated: ${unit.unitNumber}`,
			performedById: userId,
			performedByType: ActivityActorType.HUMAN,
			workflowId: 'unitWorkflow_v1',
			workflowStep: UnitWorkflowAction.UPDATE,
			workflowVersion: 'v1',
			unitId,
			newState: data
		});

		return { id: unit.id, unitNumber: unit.unitNumber, updatedAt: unit.updatedAt.toISOString() };
	} finally {
		await clearOrgContext(userId);
	}
}

async function deleteUnit(
	unitId: string,
	organizationId: string,
	userId: string
): Promise<{ deletedAt: string }> {
	try {
		const now = new Date();
		await orgTransaction(organizationId, async (tx) => {
			return tx.unit.update({
				where: { id: unitId },
				data: { deletedAt: now }
			});
		}, { userId, reason: 'Soft deleting unit via workflow' });

		await recordWorkflowEvent({
			organizationId,
			entityType: ActivityEntityType.UNIT,
			entityId: unitId,
			action: ActivityActionType.DELETE,
			eventCategory: ActivityEventCategory.EXECUTION,
			summary: `Unit deleted`,
			performedById: userId,
			performedByType: ActivityActorType.HUMAN,
			workflowId: 'unitWorkflow_v1',
			workflowStep: UnitWorkflowAction.DELETE,
			workflowVersion: 'v1',
			unitId,
			newState: { deletedAt: now.toISOString() }
		});

		return { deletedAt: now.toISOString() };
	} finally {
		await clearOrgContext(userId);
	}
}

async function unitWorkflow(input: UnitWorkflowInput): Promise<UnitWorkflowResult> {
	const workflowName = 'unitWorkflow_v1';
	const log = createWorkflowLogger(workflowName, DBOS.workflowID, input.action);
	const startTime = logWorkflowStart(log, input.action, {
		organizationId: input.organizationId,
		userId: input.userId,
		unitId: input.unitId
	}, workflowName, DBOS.workflowID);

	try {
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'started', action: input.action });

		switch (input.action) {
			case UnitWorkflowAction.CREATE: {
				if (!input.propertyId || !input.unitNumber || !input.unitType) {
					const error = new Error('Missing required fields: propertyId, unitNumber, unitType for CREATE');
					logStepError(log, 'validation', error, { propertyId: input.propertyId, unitNumber: input.unitNumber });
					throw error;
				}
				log.debug('Step: createUnit starting', { propertyId: input.propertyId, unitNumber: input.unitNumber });
				const result = await DBOS.runStep(
					() =>
						createUnit(input.organizationId, input.userId, input.propertyId!, input.unitNumber!, input.unitType!, {
							addressLine1: input.addressLine1,
							addressLine2: input.addressLine2,
							city: input.city,
							state: input.state,
							postalCode: input.postalCode,
							bedrooms: input.bedrooms,
							bathrooms: input.bathrooms,
							squareFeet: input.squareFeet,
							lotSquareFeet: input.lotSquareFeet,
							parkingSpaces: input.parkingSpaces,
							assessmentClass: input.assessmentClass,
							votingWeight: input.votingWeight
						}),
					{ name: 'createUnit' }
				);
				log.info('Step: createUnit completed', { unitId: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'unit_created', ...result });
				const successResult: UnitWorkflowResult = {
					success: true,
					entityId: result.id,
					unitId: result.id,
					unitNumber: result.unitNumber,
					unitType: result.unitType
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case UnitWorkflowAction.UPDATE: {
				if (!input.unitId) {
					const error = new Error('Missing required field: unitId for UPDATE');
					logStepError(log, 'validation', error, { unitId: input.unitId });
					throw error;
				}
				log.debug('Step: updateUnit starting', { unitId: input.unitId });
				const result = await DBOS.runStep(
					() =>
						updateUnit(input.unitId!, input.organizationId, input.userId, {
							unitNumber: input.unitNumber,
							unitType: input.unitType,
							addressLine1: input.addressLine1,
							addressLine2: input.addressLine2,
							city: input.city,
							state: input.state,
							postalCode: input.postalCode,
							bedrooms: input.bedrooms,
							bathrooms: input.bathrooms,
							squareFeet: input.squareFeet,
							lotSquareFeet: input.lotSquareFeet,
							parkingSpaces: input.parkingSpaces,
							assessmentClass: input.assessmentClass,
							votingWeight: input.votingWeight
						}),
					{ name: 'updateUnit' }
				);
				log.info('Step: updateUnit completed', { unitId: result.id, updatedAt: result.updatedAt });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'unit_updated', ...result });
				const successResult: UnitWorkflowResult = {
					success: true,
					entityId: result.id,
					unitId: result.id,
					unitNumber: result.unitNumber,
					updatedAt: result.updatedAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case UnitWorkflowAction.DELETE: {
				if (!input.unitId) {
					const error = new Error('Missing required field: unitId for DELETE');
					logStepError(log, 'validation', error, { unitId: input.unitId });
					throw error;
				}
				log.debug('Step: deleteUnit starting', { unitId: input.unitId });
				const result = await DBOS.runStep(
					() => deleteUnit(input.unitId!, input.organizationId, input.userId),
					{ name: 'deleteUnit' }
				);
				log.info('Step: deleteUnit completed', { unitId: input.unitId, deletedAt: result.deletedAt });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'unit_deleted', ...result });
				const successResult: UnitWorkflowResult = {
					success: true,
					entityId: input.unitId,
					unitId: input.unitId,
					deletedAt: result.deletedAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			default: {
				const errorResult: UnitWorkflowResult = {
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
			unitId: input.unitId,
			error: errorMessage,
			stack: errorObj.stack
		});

		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		await recordSpanError(errorObj, {
			errorCode: ActivityActionType.WORKFLOW_FAILED,
			errorType: WorkflowErrorType.UNIT_WORKFLOW_ERROR
		});
		const errorResult: UnitWorkflowResult = {
			success: false,
			error: errorMessage
		};
		logWorkflowEnd(log, input.action, false, startTime, errorResult);
		return errorResult;
	}
}

export const unitWorkflow_v1 = DBOS.registerWorkflow(unitWorkflow);
