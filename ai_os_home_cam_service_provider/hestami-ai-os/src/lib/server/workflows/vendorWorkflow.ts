/**
 * Vendor Workflow (v1)
 *
 * DBOS durable workflow for vendor (AP) management.
 * Handles: create, update, and delete (soft delete) operations.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import type { EntityWorkflowResult } from './schemas.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger, logWorkflowStart, logWorkflowEnd, logStepError } from './workflowLogger.js';
import { orgTransaction } from '../db/rls.js';

const WORKFLOW_STATUS_EVENT = 'vendor_workflow_status';
const WORKFLOW_ERROR_EVENT = 'vendor_workflow_error';

// Action types for vendor operations
export const VendorWorkflowAction = {
	CREATE: 'CREATE',
	UPDATE: 'UPDATE',
	DELETE: 'DELETE'
} as const;

export type VendorWorkflowAction = (typeof VendorWorkflowAction)[keyof typeof VendorWorkflowAction];

export interface VendorWorkflowInput {
	action: VendorWorkflowAction;
	organizationId: string;
	userId: string;
	associationId: string;
	// CREATE fields
	name?: string;
	dba?: string | null;
	contactName?: string | null;
	email?: string | null;
	phone?: string | null;
	addressLine1?: string | null;
	addressLine2?: string | null;
	city?: string | null;
	state?: string | null;
	postalCode?: string | null;
	taxId?: string | null;
	w9OnFile?: boolean;
	is1099Eligible?: boolean;
	paymentTerms?: number;
	defaultGLAccountId?: string | null;
	// UPDATE/DELETE fields
	vendorId?: string;
	isActive?: boolean;
}

export interface VendorWorkflowResult extends EntityWorkflowResult {
	vendorId?: string;
	name?: string;
	email?: string | null;
	isActive?: boolean;
	[key: string]: unknown;
}

// Step functions

async function createVendor(
	input: VendorWorkflowInput
): Promise<{ id: string; name: string; email: string | null; isActive: boolean }> {
	const vendor = await orgTransaction(
		input.organizationId,
		async (tx) => {
			return tx.vendor.create({
				data: {
					organizationId: input.organizationId,
					associationId: input.associationId,
					name: input.name!,
					dba: input.dba,
					contactName: input.contactName,
					email: input.email,
					phone: input.phone,
					addressLine1: input.addressLine1,
					addressLine2: input.addressLine2,
					city: input.city,
					state: input.state,
					postalCode: input.postalCode,
					taxId: input.taxId,
					w9OnFile: input.w9OnFile ?? false,
					is1099Eligible: input.is1099Eligible ?? false,
					paymentTerms: input.paymentTerms ?? 30,
					defaultGLAccountId: input.defaultGLAccountId
				}
			});
		},
		{ userId: input.userId, reason: 'Create vendor record' }
	);

	// Record activity event
	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: 'EXTERNAL_VENDOR',
		entityId: vendor.id,
		action: 'CREATE',
		eventCategory: 'EXECUTION',
		summary: `Vendor created: ${vendor.name}`,
		performedById: input.userId,
		performedByType: 'HUMAN',
		workflowId: 'vendorWorkflow_v1',
		workflowStep: 'CREATE',
		workflowVersion: 'v1',
		newState: { name: vendor.name, email: vendor.email }
	});

	return {
		id: vendor.id,
		name: vendor.name,
		email: vendor.email,
		isActive: vendor.isActive
	};
}

async function updateVendor(
	input: VendorWorkflowInput
): Promise<{ id: string; name: string; isActive: boolean }> {
	const updateData: Record<string, unknown> = {};
	if (input.name !== undefined) updateData.name = input.name;
	if (input.dba !== undefined) updateData.dba = input.dba;
	if (input.contactName !== undefined) updateData.contactName = input.contactName;
	if (input.email !== undefined) updateData.email = input.email;
	if (input.phone !== undefined) updateData.phone = input.phone;
	if (input.addressLine1 !== undefined) updateData.addressLine1 = input.addressLine1;
	if (input.addressLine2 !== undefined) updateData.addressLine2 = input.addressLine2;
	if (input.city !== undefined) updateData.city = input.city;
	if (input.state !== undefined) updateData.state = input.state;
	if (input.postalCode !== undefined) updateData.postalCode = input.postalCode;
	if (input.w9OnFile !== undefined) updateData.w9OnFile = input.w9OnFile;
	if (input.is1099Eligible !== undefined) updateData.is1099Eligible = input.is1099Eligible;
	if (input.paymentTerms !== undefined) updateData.paymentTerms = input.paymentTerms;
	if (input.isActive !== undefined) updateData.isActive = input.isActive;

	const vendor = await orgTransaction(
		input.organizationId,
		async (tx) => {
			return tx.vendor.update({
				where: { id: input.vendorId },
				data: updateData
			});
		},
		{ userId: input.userId, reason: 'Update vendor record' }
	);

	// Record activity event
	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: 'EXTERNAL_VENDOR',
		entityId: vendor.id,
		action: 'UPDATE',
		eventCategory: 'EXECUTION',
		summary: `Vendor updated: ${vendor.name}`,
		performedById: input.userId,
		performedByType: 'HUMAN',
		workflowId: 'vendorWorkflow_v1',
		workflowStep: 'UPDATE',
		workflowVersion: 'v1',
		newState: updateData
	});

	return {
		id: vendor.id,
		name: vendor.name,
		isActive: vendor.isActive
	};
}

async function deleteVendor(
	vendorId: string,
	organizationId: string,
	userId: string
): Promise<{ success: boolean }> {
	await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.vendor.update({
				where: { id: vendorId },
				data: { deletedAt: new Date() }
			});
		},
		{ userId, reason: 'Soft delete vendor record' }
	);

	// Record activity event
	await recordWorkflowEvent({
		organizationId,
		entityType: 'EXTERNAL_VENDOR',
		entityId: vendorId,
		action: 'DELETE',
		eventCategory: 'EXECUTION',
		summary: `Vendor deleted`,
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'vendorWorkflow_v1',
		workflowStep: 'DELETE',
		workflowVersion: 'v1',
		newState: { deletedAt: new Date().toISOString() }
	});

	return { success: true };
}

// Main workflow function

async function vendorWorkflow(input: VendorWorkflowInput): Promise<VendorWorkflowResult> {
	const workflowName = 'vendorWorkflow_v1';
	const log = createWorkflowLogger(workflowName, DBOS.workflowID, input.action);
	const startTime = logWorkflowStart(log, input.action, {
		organizationId: input.organizationId,
		userId: input.userId,
		vendorId: input.vendorId
	}, workflowName, DBOS.workflowID);

	try {
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'started', action: input.action });

		switch (input.action) {
			case 'CREATE': {
				if (!input.name) {
					const error = new Error('Missing required field: name for CREATE');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: createVendor starting', { name: input.name });
				const result = await DBOS.runStep(
					() => createVendor(input),
					{ name: 'createVendor' }
				);
				log.info('Step: createVendor completed', { id: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'vendor_created', ...result });
				const successResult: VendorWorkflowResult = {
					success: true,
					entityId: result.id,
					vendorId: result.id,
					name: result.name,
					email: result.email,
					isActive: result.isActive
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'UPDATE': {
				if (!input.vendorId) {
					const error = new Error('Missing required field: vendorId for UPDATE');
					logStepError(log, 'validation', error, { vendorId: input.vendorId });
					throw error;
				}
				log.debug('Step: updateVendor starting', { vendorId: input.vendorId });
				const result = await DBOS.runStep(
					() => updateVendor(input),
					{ name: 'updateVendor' }
				);
				log.info('Step: updateVendor completed', { id: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'vendor_updated', ...result });
				const successResult: VendorWorkflowResult = {
					success: true,
					entityId: result.id,
					vendorId: result.id,
					name: result.name,
					isActive: result.isActive
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'DELETE': {
				if (!input.vendorId) {
					const error = new Error('Missing required field: vendorId for DELETE');
					logStepError(log, 'validation', error, { vendorId: input.vendorId });
					throw error;
				}
				log.debug('Step: deleteVendor starting', { vendorId: input.vendorId });
				await DBOS.runStep(
					() => deleteVendor(input.vendorId!, input.organizationId, input.userId),
					{ name: 'deleteVendor' }
				);
				log.info('Step: deleteVendor completed', { vendorId: input.vendorId });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'vendor_deleted', vendorId: input.vendorId });
				const successResult: VendorWorkflowResult = {
					success: true,
					entityId: input.vendorId,
					vendorId: input.vendorId
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			default: {
				const errorResult: VendorWorkflowResult = {
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
			vendorId: input.vendorId,
			error: errorMessage,
			stack: errorObj.stack
		});

		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'VENDOR_WORKFLOW_ERROR'
		});
		const errorResult: VendorWorkflowResult = {
			success: false,
			error: errorMessage
		};
		logWorkflowEnd(log, input.action, false, startTime, errorResult);
		return errorResult;
	}
}

export const vendorWorkflow_v1 = DBOS.registerWorkflow(vendorWorkflow);

export async function startVendorWorkflow(
	input: VendorWorkflowInput,
	idempotencyKey: string
): Promise<VendorWorkflowResult> {
	const handle = await DBOS.startWorkflow(vendorWorkflow_v1, { workflowID: idempotencyKey })(input);
	return handle.getResult();
}
