/**
 * Customer Workflow (v1)
 *
 * DBOS durable workflow for customer management operations.
 * Provides idempotency, durability, and trace correlation.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { orgTransaction } from '../db/rls.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';
import { type LifecycleWorkflowResult } from './schemas.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger } from './workflowLogger.js';

const log = createWorkflowLogger('CustomerWorkflow');

const WORKFLOW_STATUS_EVENT = 'customer_status';
const WORKFLOW_ERROR_EVENT = 'customer_error';

export const CustomerAction = {
	CREATE: 'CREATE',
	UPDATE: 'UPDATE',
	DELETE: 'DELETE'
} as const;

export type CustomerAction = (typeof CustomerAction)[keyof typeof CustomerAction];

export interface CustomerWorkflowInput {
	action: CustomerAction;
	organizationId: string;
	userId: string;
	customerId?: string;
	data: Record<string, unknown>;
}

export interface CustomerWorkflowResult extends LifecycleWorkflowResult {
	customerId?: string;
}

async function createCustomer(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<{ id: string; displayName: string }> {
	const customer = await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.customer.create({
				data: {
					organizationId,
					name: data.displayName as string,
					companyName: data.companyName as string | undefined,
					email: data.email as string | undefined,
					phone: data.phone as string | undefined,
					altPhone: data.alternatePhone as string | undefined,
					addressLine1: data.addressLine1 as string | undefined,
					addressLine2: data.addressLine2 as string | undefined,
					city: data.city as string | undefined,
					state: data.state as string | undefined,
					postalCode: data.postalCode as string | undefined,
					country: data.country as string | undefined,
					notes: data.notes as string | undefined,
					tags: data.tags as string[] | undefined
				}
			});
		},
		{ userId, reason: 'Create customer' }
	);

	await recordWorkflowEvent({
		organizationId,
		entityType: 'JOB',
		entityId: customer.id,
		action: 'CREATE',
		eventCategory: 'EXECUTION',
		summary: `Customer created: ${customer.name}`,
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'customerWorkflow_v1',
		workflowStep: 'CREATE_CUSTOMER',
		workflowVersion: 'v1'
	});

	return { id: customer.id, displayName: customer.name };
}

async function updateCustomer(
	organizationId: string,
	userId: string,
	customerId: string,
	data: Record<string, unknown>
): Promise<{ id: string; displayName: string }> {
	const customer = await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.customer.update({
				where: { id: customerId },
				data: {
					name: data.displayName as string | undefined,
					companyName: data.companyName as string | undefined,
					email: data.email as string | undefined,
					phone: data.phone as string | undefined,
					altPhone: data.alternatePhone as string | undefined,
					addressLine1: data.addressLine1 as string | undefined,
					addressLine2: data.addressLine2 as string | undefined,
					city: data.city as string | undefined,
					state: data.state as string | undefined,
					postalCode: data.postalCode as string | undefined,
					country: data.country as string | undefined,
					notes: data.notes as string | undefined,
					tags: data.tags as string[] | undefined
				}
			});
		},
		{ userId, reason: 'Update customer' }
	);

	await recordWorkflowEvent({
		organizationId,
		entityType: 'JOB',
		entityId: customer.id,
		action: 'UPDATE',
		eventCategory: 'EXECUTION',
		summary: `Customer updated: ${customer.name}`,
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'customerWorkflow_v1',
		workflowStep: 'UPDATE_CUSTOMER',
		workflowVersion: 'v1'
	});

	return { id: customer.id, displayName: customer.name };
}

async function deleteCustomer(
	organizationId: string,
	userId: string,
	customerId: string
): Promise<{ id: string }> {
	await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.customer.update({
				where: { id: customerId },
				data: { deletedAt: new Date() }
			});
		},
		{ userId, reason: 'Soft delete customer' }
	);

	await recordWorkflowEvent({
		organizationId,
		entityType: 'JOB',
		entityId: customerId,
		action: 'DELETE',
		eventCategory: 'EXECUTION',
		summary: 'Customer deleted',
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'customerWorkflow_v1',
		workflowStep: 'DELETE_CUSTOMER',
		workflowVersion: 'v1'
	});

	return { id: customerId };
}

async function customerWorkflow(input: CustomerWorkflowInput): Promise<CustomerWorkflowResult> {
	try {
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'started', action: input.action });

		let customerId: string | undefined;

		switch (input.action) {
			case 'CREATE': {
				const result = await DBOS.runStep(
					() => createCustomer(input.organizationId, input.userId, input.data),
					{ name: 'createCustomer' }
				);
				customerId = result.id;
				break;
			}
			case 'UPDATE': {
				if (!input.customerId) throw new Error('customerId required for UPDATE');
				const result = await DBOS.runStep(
					() => updateCustomer(input.organizationId, input.userId, input.customerId!, input.data),
					{ name: 'updateCustomer' }
				);
				customerId = result.id;
				break;
			}
			case 'DELETE': {
				if (!input.customerId) throw new Error('customerId required for DELETE');
				const result = await DBOS.runStep(
					() => deleteCustomer(input.organizationId, input.userId, input.customerId!),
					{ name: 'deleteCustomer' }
				);
				customerId = result.id;
				break;
			}
			default:
				throw new Error(`Unknown action: ${input.action}`);
		}

		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'completed', customerId });

		return {
			success: true,
			action: input.action,
			customerId,
			timestamp: new Date().toISOString()
		};
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;
		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'CUSTOMER_WORKFLOW_ERROR'
		});

		return {
			success: false,
			action: input.action,
			timestamp: new Date().toISOString(),
			error: errorMessage
		};
	}
}

export const customerWorkflow_v1 = DBOS.registerWorkflow(customerWorkflow);

export async function startCustomerWorkflow(
	input: CustomerWorkflowInput,
	idempotencyKey: string
): Promise<CustomerWorkflowResult> {
	const handle = await DBOS.startWorkflow(customerWorkflow_v1, {
		workflowID: idempotencyKey})(input);

	return handle.getResult();
}

