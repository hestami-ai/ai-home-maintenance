/**
 * Contract Workflow (v1)
 *
 * DBOS durable workflow for service contract management operations.
 * Provides idempotency, durability, and trace correlation.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { orgTransaction } from '../db/rls.js';
import type { RecurrenceFrequency, ServiceContractType } from '../../../../generated/prisma/client.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';
import { type LifecycleWorkflowResult } from './schemas.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger } from './workflowLogger.js';

const log = createWorkflowLogger('ContractWorkflow');

const WORKFLOW_STATUS_EVENT = 'contract_status';
const WORKFLOW_ERROR_EVENT = 'contract_error';

export const ContractAction = {
	CREATE_CONTRACT: 'CREATE_CONTRACT',
	UPDATE_CONTRACT: 'UPDATE_CONTRACT',
	ACTIVATE_CONTRACT: 'ACTIVATE_CONTRACT',
	SUSPEND_CONTRACT: 'SUSPEND_CONTRACT',
	CANCEL_CONTRACT: 'CANCEL_CONTRACT',
	RENEW_CONTRACT: 'RENEW_CONTRACT',
	DELETE_CONTRACT: 'DELETE_CONTRACT',
	ADD_SERVICE_ITEM: 'ADD_SERVICE_ITEM',
	REMOVE_SERVICE_ITEM: 'REMOVE_SERVICE_ITEM'
} as const;

export type ContractAction = (typeof ContractAction)[keyof typeof ContractAction];

export interface ServiceContractWorkflowInput {
	action: ContractAction;
	organizationId: string;
	userId: string;
	contractId?: string;
	serviceItemId?: string;
	data: Record<string, unknown>;
}

export interface ServiceContractWorkflowResult extends LifecycleWorkflowResult {
	entityId?: string;
}

async function createContract(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<{ id: string }> {
	const contract = await orgTransaction(organizationId, async (tx) => {
		return tx.serviceContract.create({
			data: {
				organizationId,
				contractNumber: data.contractNumber as string,
				customerId: data.customerId as string | undefined,
				name: data.name as string,
				type: data.type as ServiceContractType,
				description: data.description as string | undefined,
				status: 'DRAFT',
				startDate: new Date(data.startDate as string),
				endDate: new Date(data.endDate as string),
				billingFrequency: data.billingFrequency as RecurrenceFrequency,
				billingAmount: data.billingAmount as number,
				contractValue: data.contractValue as number,
				autoRenew: data.autoRenew as boolean ?? false,
				createdBy: userId
			}
		});
	}, { userId, reason: 'Create service contract' });

	await recordWorkflowEvent({
		organizationId,
		entityType: 'JOB',
		entityId: contract.id,
		action: 'CREATE',
		eventCategory: 'EXECUTION',
		summary: `Service contract created: ${contract.name}`,
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'contractWorkflow_v1',
		workflowStep: 'CREATE_CONTRACT',
		workflowVersion: 'v1'
	});

	return { id: contract.id };
}

async function updateContract(
	organizationId: string,
	userId: string,
	contractId: string,
	data: Record<string, unknown>
): Promise<{ id: string }> {
	const contract = await orgTransaction(organizationId, async (tx) => {
		return tx.serviceContract.update({
			where: { id: contractId },
			data: {
				name: data.name as string | undefined,
				description: data.description as string | undefined,
				startDate: data.startDate ? new Date(data.startDate as string) : undefined,
				endDate: data.endDate ? new Date(data.endDate as string) : undefined,
				billingFrequency: data.billingFrequency as RecurrenceFrequency | undefined,
				billingAmount: data.billingAmount as number | undefined,
				contractValue: data.contractValue as number | undefined,
				autoRenew: data.autoRenew as boolean | undefined
			}
		});
	}, { userId, reason: 'Update service contract' });

	await recordWorkflowEvent({
		organizationId,
		entityType: 'JOB',
		entityId: contract.id,
		action: 'UPDATE',
		eventCategory: 'EXECUTION',
		summary: `Service contract updated: ${contract.name}`,
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'contractWorkflow_v1',
		workflowStep: 'UPDATE_CONTRACT',
		workflowVersion: 'v1'
	});

	return { id: contract.id };
}

async function activateContract(
	organizationId: string,
	userId: string,
	contractId: string
): Promise<{ id: string }> {
	const contract = await orgTransaction(organizationId, async (tx) => {
		return tx.serviceContract.update({
			where: { id: contractId },
			data: {
				status: 'ACTIVE'
			}
		});
	}, { userId, reason: 'Activate service contract' });

	await recordWorkflowEvent({
		organizationId,
		entityType: 'JOB',
		entityId: contract.id,
		action: 'UPDATE',
		eventCategory: 'EXECUTION',
		summary: 'Service contract activated',
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'contractWorkflow_v1',
		workflowStep: 'ACTIVATE_CONTRACT',
		workflowVersion: 'v1'
	});

	return { id: contract.id };
}

async function suspendContract(
	organizationId: string,
	userId: string,
	contractId: string,
	reason?: string
): Promise<{ id: string }> {
	const contract = await orgTransaction(organizationId, async (tx) => {
		return tx.serviceContract.update({
			where: { id: contractId },
			data: {
				status: 'SUSPENDED',
				notes: reason
			}
		});
	}, { userId, reason: 'Suspend service contract' });

	await recordWorkflowEvent({
		organizationId,
		entityType: 'JOB',
		entityId: contract.id,
		action: 'UPDATE',
		eventCategory: 'EXECUTION',
		summary: 'Service contract suspended',
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'contractWorkflow_v1',
		workflowStep: 'SUSPEND_CONTRACT',
		workflowVersion: 'v1'
	});

	return { id: contract.id };
}

async function cancelContract(
	organizationId: string,
	userId: string,
	contractId: string,
	reason?: string
): Promise<{ id: string }> {
	const contract = await orgTransaction(organizationId, async (tx) => {
		return tx.serviceContract.update({
			where: { id: contractId },
			data: {
				status: 'CANCELLED',
				notes: reason
			}
		});
	}, { userId, reason: 'Cancel service contract' });

	await recordWorkflowEvent({
		organizationId,
		entityType: 'JOB',
		entityId: contract.id,
		action: 'UPDATE',
		eventCategory: 'EXECUTION',
		summary: 'Service contract cancelled',
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'contractWorkflow_v1',
		workflowStep: 'CANCEL_CONTRACT',
		workflowVersion: 'v1'
	});

	return { id: contract.id };
}

async function renewContract(
	organizationId: string,
	userId: string,
	contractId: string,
	data: Record<string, unknown>
): Promise<{ id: string }> {
	const contract = await orgTransaction(organizationId, async (tx) => {
		return tx.serviceContract.update({
			where: { id: contractId },
			data: {
				status: 'ACTIVE',
				startDate: new Date(data.newStartDate as string),
				endDate: new Date(data.newEndDate as string)
			}
		});
	}, { userId, reason: 'Renew service contract' });

	await recordWorkflowEvent({
		organizationId,
		entityType: 'JOB',
		entityId: contract.id,
		action: 'UPDATE',
		eventCategory: 'EXECUTION',
		summary: 'Service contract renewed',
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'contractWorkflow_v1',
		workflowStep: 'RENEW_CONTRACT',
		workflowVersion: 'v1'
	});

	return { id: contract.id };
}

async function deleteContract(
	organizationId: string,
	userId: string,
	contractId: string
): Promise<{ id: string }> {
	await orgTransaction(organizationId, async (tx) => {
		return tx.serviceContract.update({
			where: { id: contractId },
			data: { deletedAt: new Date() }
		});
	}, { userId, reason: 'Delete service contract' });

	await recordWorkflowEvent({
		organizationId,
		entityType: 'JOB',
		entityId: contractId,
		action: 'DELETE',
		eventCategory: 'EXECUTION',
		summary: 'Service contract deleted',
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'contractWorkflow_v1',
		workflowStep: 'DELETE_CONTRACT',
		workflowVersion: 'v1'
	});

	return { id: contractId };
}

async function addServiceItem(
	organizationId: string,
	userId: string,
	contractId: string,
	data: Record<string, unknown>
): Promise<{ id: string }> {
	const item = await orgTransaction(organizationId, async (tx) => {
		return tx.contractServiceItem.create({
			data: {
				contractId,
				name: data.name as string,
				pricebookItemId: data.pricebookItemId as string | undefined,
				quantity: data.quantity as number ?? 1,
				unitPrice: data.unitPrice as number,
				lineTotal: data.lineTotal as number,
				frequency: data.frequency as RecurrenceFrequency,
				notes: data.notes as string | undefined
			}
		});
	}, { userId, reason: 'Add service item to contract' });

	await recordWorkflowEvent({
		organizationId,
		entityType: 'JOB',
		entityId: item.id,
		action: 'CREATE',
		eventCategory: 'EXECUTION',
		summary: 'Service item added to contract',
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'contractWorkflow_v1',
		workflowStep: 'ADD_SERVICE_ITEM',
		workflowVersion: 'v1'
	});

	return { id: item.id };
}

async function removeServiceItem(
	organizationId: string,
	userId: string,
	serviceItemId: string
): Promise<{ id: string }> {
	await orgTransaction(organizationId, async (tx) => {
		return tx.contractServiceItem.delete({
			where: { id: serviceItemId }
		});
	}, { userId, reason: 'Remove service item from contract' });

	await recordWorkflowEvent({
		organizationId,
		entityType: 'JOB',
		entityId: serviceItemId,
		action: 'DELETE',
		eventCategory: 'EXECUTION',
		summary: 'Service item removed from contract',
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'contractWorkflow_v1',
		workflowStep: 'REMOVE_SERVICE_ITEM',
		workflowVersion: 'v1'
	});

	return { id: serviceItemId };
}

async function contractWorkflow(input: ServiceContractWorkflowInput): Promise<ServiceContractWorkflowResult> {
	try {
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'started', action: input.action });

		let entityId: string | undefined;

		switch (input.action) {
			case 'CREATE_CONTRACT': {
				const result = await DBOS.runStep(
					() => createContract(input.organizationId, input.userId, input.data),
					{ name: 'createContract' }
				);
				entityId = result.id;
				break;
			}
			case 'UPDATE_CONTRACT': {
				if (!input.contractId) throw new Error('contractId required for UPDATE_CONTRACT');
				const result = await DBOS.runStep(
					() => updateContract(input.organizationId, input.userId, input.contractId!, input.data),
					{ name: 'updateContract' }
				);
				entityId = result.id;
				break;
			}
			case 'ACTIVATE_CONTRACT': {
				if (!input.contractId) throw new Error('contractId required for ACTIVATE_CONTRACT');
				const result = await DBOS.runStep(
					() => activateContract(input.organizationId, input.userId, input.contractId!),
					{ name: 'activateContract' }
				);
				entityId = result.id;
				break;
			}
			case 'SUSPEND_CONTRACT': {
				if (!input.contractId) throw new Error('contractId required for SUSPEND_CONTRACT');
				const result = await DBOS.runStep(
					() => suspendContract(input.organizationId, input.userId, input.contractId!, input.data.reason as string | undefined),
					{ name: 'suspendContract' }
				);
				entityId = result.id;
				break;
			}
			case 'CANCEL_CONTRACT': {
				if (!input.contractId) throw new Error('contractId required for CANCEL_CONTRACT');
				const result = await DBOS.runStep(
					() => cancelContract(input.organizationId, input.userId, input.contractId!, input.data.reason as string | undefined),
					{ name: 'cancelContract' }
				);
				entityId = result.id;
				break;
			}
			case 'RENEW_CONTRACT': {
				if (!input.contractId) throw new Error('contractId required for RENEW_CONTRACT');
				const result = await DBOS.runStep(
					() => renewContract(input.organizationId, input.userId, input.contractId!, input.data),
					{ name: 'renewContract' }
				);
				entityId = result.id;
				break;
			}
			case 'DELETE_CONTRACT': {
				if (!input.contractId) throw new Error('contractId required for DELETE_CONTRACT');
				const result = await DBOS.runStep(
					() => deleteContract(input.organizationId, input.userId, input.contractId!),
					{ name: 'deleteContract' }
				);
				entityId = result.id;
				break;
			}
			case 'ADD_SERVICE_ITEM': {
				if (!input.contractId) throw new Error('contractId required for ADD_SERVICE_ITEM');
				const result = await DBOS.runStep(
					() => addServiceItem(input.organizationId, input.userId, input.contractId!, input.data),
					{ name: 'addServiceItem' }
				);
				entityId = result.id;
				break;
			}
			case 'REMOVE_SERVICE_ITEM': {
				if (!input.serviceItemId) throw new Error('serviceItemId required for REMOVE_SERVICE_ITEM');
				const result = await DBOS.runStep(
					() => removeServiceItem(input.organizationId, input.userId, input.serviceItemId!),
					{ name: 'removeServiceItem' }
				);
				entityId = result.id;
				break;
			}
			default:
				throw new Error(`Unknown action: ${input.action}`);
		}

		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'completed', entityId });

		return {
			success: true,
			action: input.action,
			entityId,
			timestamp: new Date().toISOString()
		};
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;
		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'CONTRACT_WORKFLOW_ERROR'
		});

		return {
			success: false,
			action: input.action,
			timestamp: new Date().toISOString(),
			error: errorMessage
		};
	}
}

export const contractWorkflow_v1 = DBOS.registerWorkflow(contractWorkflow);

export async function startServiceContractWorkflow(
	input: ServiceContractWorkflowInput,
	idempotencyKey: string
): Promise<ServiceContractWorkflowResult> {
	const handle = await DBOS.startWorkflow(contractWorkflow_v1, {
		workflowID: idempotencyKey})(input);

	return handle.getResult();
}

