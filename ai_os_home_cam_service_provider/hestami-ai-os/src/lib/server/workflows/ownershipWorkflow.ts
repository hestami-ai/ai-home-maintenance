/**
 * Ownership Workflow (v1)
 *
 * DBOS durable workflow for ownership (unit ownership) management.
 * Handles: create, update, end, and soft delete operations.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { orgTransaction, clearOrgContext } from '../db/rls.js';
import type { EntityWorkflowResult } from './schemas.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger, logWorkflowStart, logWorkflowEnd, logStepError } from './workflowLogger.js';
import type { OwnershipType, Prisma } from '../../../../generated/prisma/client.js';

const WORKFLOW_STATUS_EVENT = 'ownership_workflow_status';
const WORKFLOW_ERROR_EVENT = 'ownership_workflow_error';

export const OwnershipWorkflowAction = {
	CREATE: 'CREATE',
	END: 'END',
	DELETE: 'DELETE'
} as const;

export type OwnershipWorkflowAction = (typeof OwnershipWorkflowAction)[keyof typeof OwnershipWorkflowAction];

export interface OwnershipWorkflowInput {
	action: OwnershipWorkflowAction;
	organizationId: string;
	userId: string;
	ownershipId?: string;
	unitId?: string;
	partyId?: string;
	ownershipType?: OwnershipType;
	percentage?: number;
	startDate?: Date;
	endDate?: Date;
	isPrimary?: boolean;
	mailingAddress?: Record<string, unknown>;
}

export interface OwnershipWorkflowResult extends EntityWorkflowResult {
	ownershipId?: string;
	unitId?: string;
	partyId?: string;
	percentage?: number;
	endDate?: string;
	deletedAt?: string;
	[key: string]: unknown;
}

async function createOwnership(
	organizationId: string,
	userId: string,
	unitId: string,
	partyId: string,
	ownershipType: OwnershipType,
	data: {
		percentage?: number;
		startDate: Date;
		endDate?: Date;
		isPrimary?: boolean;
		mailingAddress?: Record<string, unknown>;
	}
): Promise<{ id: string; unitId: string; partyId: string; percentage: number }> {
	try {
		const ownership = await orgTransaction(organizationId, async (tx) => {
			// If setting as primary, unset other primaries for this unit
			if (data.isPrimary) {
				await tx.ownership.updateMany({
					where: { unitId, isPrimary: true },
					data: { isPrimary: false }
				});
			}

			return tx.ownership.create({
				data: {
					unitId,
					partyId,
					ownershipType,
					percentage: data.percentage ?? 100,
					startDate: data.startDate,
					endDate: data.endDate,
					isPrimary: data.isPrimary ?? false,
					...(data.mailingAddress !== undefined && { mailingAddress: data.mailingAddress as Prisma.InputJsonValue })
				}
			});
		}, { userId, reason: 'Creating ownership via workflow' });

		await recordWorkflowEvent({
			organizationId,
			entityType: 'OWNERSHIP',
			entityId: ownership.id,
			action: 'CREATE',
			eventCategory: 'EXECUTION',
			summary: `Ownership created for unit`,
			performedById: userId,
			performedByType: 'HUMAN',
			workflowId: 'ownershipWorkflow_v1',
			workflowStep: 'CREATE',
			workflowVersion: 'v1',
			unitId,
			newState: { ownershipType, percentage: ownership.percentage, isPrimary: data.isPrimary }
		});

		return { id: ownership.id, unitId: ownership.unitId, partyId: ownership.partyId, percentage: ownership.percentage };
	} finally {
		await clearOrgContext(userId);
	}
}

async function endOwnership(
	ownershipId: string,
	organizationId: string,
	userId: string,
	endDate: Date
): Promise<{ id: string; endDate: string }> {
	try {
		const ownership = await orgTransaction(organizationId, async (tx) => {
			return tx.ownership.update({
				where: { id: ownershipId },
				data: { endDate, isPrimary: false }
			});
		}, { userId, reason: 'Ending ownership via workflow' });

		await recordWorkflowEvent({
			organizationId,
			entityType: 'OWNERSHIP',
			entityId: ownershipId,
			action: 'UPDATE',
			eventCategory: 'EXECUTION',
			summary: `Ownership ended`,
			performedById: userId,
			performedByType: 'HUMAN',
			workflowId: 'ownershipWorkflow_v1',
			workflowStep: 'END',
			workflowVersion: 'v1',
			unitId: ownership.unitId,
			newState: { endDate: endDate.toISOString(), isPrimary: false }
		});

		return { id: ownership.id, endDate: ownership.endDate!.toISOString() };
	} finally {
		await clearOrgContext(userId);
	}
}

async function deleteOwnership(
	ownershipId: string,
	organizationId: string,
	userId: string
): Promise<{ deletedAt: string }> {
	try {
		const now = new Date();
		const ownership = await orgTransaction(organizationId, async (tx) => {
			return tx.ownership.update({
				where: { id: ownershipId },
				data: { deletedAt: now }
			});
		}, { userId, reason: 'Soft deleting ownership via workflow' });

		await recordWorkflowEvent({
			organizationId,
			entityType: 'OWNERSHIP',
			entityId: ownershipId,
			action: 'DELETE',
			eventCategory: 'EXECUTION',
			summary: `Ownership deleted`,
			performedById: userId,
			performedByType: 'HUMAN',
			workflowId: 'ownershipWorkflow_v1',
			workflowStep: 'DELETE',
			workflowVersion: 'v1',
			unitId: ownership.unitId,
			newState: { deletedAt: now.toISOString() }
		});

		return { deletedAt: now.toISOString() };
	} finally {
		await clearOrgContext(userId);
	}
}

async function ownershipWorkflow(input: OwnershipWorkflowInput): Promise<OwnershipWorkflowResult> {
	const workflowName = 'ownershipWorkflow_v1';
	const log = createWorkflowLogger(workflowName, DBOS.workflowID, input.action);
	const startTime = logWorkflowStart(log, input.action, {
		organizationId: input.organizationId,
		userId: input.userId,
		ownershipId: input.ownershipId
	}, workflowName, DBOS.workflowID);

	try {
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'started', action: input.action });

		switch (input.action) {
			case 'CREATE': {
				if (!input.unitId || !input.partyId || !input.ownershipType || !input.startDate) {
					const error = new Error('Missing required fields for CREATE');
					logStepError(log, 'validation', error, { unitId: input.unitId, partyId: input.partyId });
					throw error;
				}
				log.debug('Step: createOwnership starting', { unitId: input.unitId, partyId: input.partyId });
				const result = await DBOS.runStep(
					() =>
						createOwnership(input.organizationId, input.userId, input.unitId!, input.partyId!, input.ownershipType!, {
							percentage: input.percentage,
							startDate: input.startDate!,
							endDate: input.endDate,
							isPrimary: input.isPrimary,
							mailingAddress: input.mailingAddress
						}),
					{ name: 'createOwnership' }
				);
				log.info('Step: createOwnership completed', { ownershipId: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'ownership_created', ...result });
				const successResult: OwnershipWorkflowResult = {
					success: true,
					entityId: result.id,
					ownershipId: result.id,
					unitId: result.unitId,
					partyId: result.partyId,
					percentage: result.percentage
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'END': {
				if (!input.ownershipId || !input.endDate) {
					const error = new Error('Missing required fields: ownershipId, endDate for END');
					logStepError(log, 'validation', error, { ownershipId: input.ownershipId });
					throw error;
				}
				log.debug('Step: endOwnership starting', { ownershipId: input.ownershipId });
				const result = await DBOS.runStep(
					() => endOwnership(input.ownershipId!, input.organizationId, input.userId, input.endDate!),
					{ name: 'endOwnership' }
				);
				log.info('Step: endOwnership completed', { ownershipId: result.id, endDate: result.endDate });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'ownership_ended', ...result });
				const successResult: OwnershipWorkflowResult = {
					success: true,
					entityId: result.id,
					ownershipId: result.id,
					endDate: result.endDate
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'DELETE': {
				if (!input.ownershipId) {
					const error = new Error('Missing required field: ownershipId for DELETE');
					logStepError(log, 'validation', error, { ownershipId: input.ownershipId });
					throw error;
				}
				log.debug('Step: deleteOwnership starting', { ownershipId: input.ownershipId });
				const result = await DBOS.runStep(
					() => deleteOwnership(input.ownershipId!, input.organizationId, input.userId),
					{ name: 'deleteOwnership' }
				);
				log.info('Step: deleteOwnership completed', { ownershipId: input.ownershipId, deletedAt: result.deletedAt });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'ownership_deleted', ...result });
				const successResult: OwnershipWorkflowResult = {
					success: true,
					entityId: input.ownershipId,
					ownershipId: input.ownershipId,
					deletedAt: result.deletedAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			default: {
				const errorResult: OwnershipWorkflowResult = {
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
			ownershipId: input.ownershipId,
			error: errorMessage,
			stack: errorObj.stack
		});

		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		await recordSpanError(errorObj, {
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'OWNERSHIP_WORKFLOW_ERROR'
		});
		const errorResult: OwnershipWorkflowResult = {
			success: false,
			error: errorMessage
		};
		logWorkflowEnd(log, input.action, false, startTime, errorResult);
		return errorResult;
	}
}

export const ownershipWorkflow_v1 = DBOS.registerWorkflow(ownershipWorkflow);
