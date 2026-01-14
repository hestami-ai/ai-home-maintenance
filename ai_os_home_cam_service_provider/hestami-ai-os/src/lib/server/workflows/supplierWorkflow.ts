/**
 * Supplier Workflow (v1)
 *
 * DBOS durable workflow for managing supplier operations.
 * Handles: create, update, delete.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import { type EntityWorkflowResult } from './schemas.js';
import { createWorkflowLogger, logWorkflowStart, logWorkflowEnd } from './workflowLogger.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';
import { recordSpanError } from '../api/middleware/tracing.js';

// Action types for the unified workflow
export const SupplierAction = {
	CREATE_SUPPLIER: 'CREATE_SUPPLIER',
	UPDATE_SUPPLIER: 'UPDATE_SUPPLIER',
	DELETE_SUPPLIER: 'DELETE_SUPPLIER'
} as const;

export type SupplierAction = (typeof SupplierAction)[keyof typeof SupplierAction];

const WORKFLOW_STATUS_EVENT = 'supplier_status';
const WORKFLOW_ERROR_EVENT = 'supplier_error';

export interface SupplierWorkflowInput {
	action: SupplierAction;
	organizationId: string;
	userId: string;
	supplierId?: string;
	data: Record<string, unknown>;
}

export interface SupplierWorkflowResult extends EntityWorkflowResult {
	// Inherits success, error, entityId from EntityWorkflowResult
}

// Step functions for each operation
async function createSupplier(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const supplier = await prisma.supplier.create({
		data: {
			organizationId,
			name: data.name as string,
			code: data.code as string | undefined,
			contactName: data.contactName as string | undefined,
			email: data.email as string | undefined,
			phone: data.phone as string | undefined,
			website: data.website as string | undefined,
			addressLine1: data.addressLine1 as string | undefined,
			addressLine2: data.addressLine2 as string | undefined,
			city: data.city as string | undefined,
			state: data.state as string | undefined,
			postalCode: data.postalCode as string | undefined,
			country: data.country as string | undefined,
			paymentTermsDays: data.paymentTermsDays as number | undefined,
			creditLimit: data.creditLimit as number | undefined,
			vendorId: data.vendorId as string | undefined,
			notes: data.notes as string | undefined,
			isActive: true
		}
	});

	return supplier.id;
}

async function updateSupplier(
	organizationId: string,
	userId: string,
	supplierId: string,
	data: Record<string, unknown>
): Promise<string> {
	const { id, idempotencyKey, ...updateData } = data;

	await prisma.supplier.update({
		where: { id: supplierId },
		data: updateData
	});

	return supplierId;
}

async function deleteSupplier(
	organizationId: string,
	userId: string,
	supplierId: string
): Promise<string> {
	await prisma.supplier.update({
		where: { id: supplierId },
		data: { deletedAt: new Date() }
	});

	return supplierId;
}

// Main workflow function
async function supplierWorkflow(input: SupplierWorkflowInput): Promise<SupplierWorkflowResult> {
	const log = createWorkflowLogger('supplierWorkflow', DBOS.workflowID, input.action);
	const startTime = logWorkflowStart(log, input.action, input as any);

	try {
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'started', action: input.action });

		let entityId: string | undefined;

		switch (input.action) {
			case 'CREATE_SUPPLIER':
				entityId = await DBOS.runStep(
					() => createSupplier(input.organizationId, input.userId, input.data),
					{ name: 'createSupplier' }
				);
				await recordWorkflowEvent({
					organizationId: input.organizationId,
					entityType: 'EXTERNAL_VENDOR',
					entityId: entityId,
					action: 'CREATE',
					eventCategory: 'EXECUTION',
					summary: `Supplier created: ${input.data.name}`,
					performedById: input.userId,
					performedByType: 'HUMAN',
					workflowId: 'supplierWorkflow_v1',
					workflowStep: 'CREATE_SUPPLIER',
					workflowVersion: 'v1'
				});
				break;

			case 'UPDATE_SUPPLIER':
				entityId = await DBOS.runStep(
					() => updateSupplier(input.organizationId, input.userId, input.supplierId!, input.data),
					{ name: 'updateSupplier' }
				);
				await recordWorkflowEvent({
					organizationId: input.organizationId,
					entityType: 'EXTERNAL_VENDOR',
					entityId: entityId,
					action: 'UPDATE',
					eventCategory: 'EXECUTION',
					summary: 'Supplier details updated',
					performedById: input.userId,
					performedByType: 'HUMAN',
					workflowId: 'supplierWorkflow_v1',
					workflowStep: 'UPDATE_SUPPLIER',
					workflowVersion: 'v1'
				});
				break;

			case 'DELETE_SUPPLIER':
				entityId = await DBOS.runStep(
					() => deleteSupplier(input.organizationId, input.userId, input.supplierId!),
					{ name: 'deleteSupplier' }
				);
				await recordWorkflowEvent({
					organizationId: input.organizationId,
					entityType: 'EXTERNAL_VENDOR',
					entityId: input.supplierId!,
					action: 'DELETE',
					eventCategory: 'EXECUTION',
					summary: 'Supplier deleted (soft delete)',
					performedById: input.userId,
					performedByType: 'HUMAN',
					workflowId: 'supplierWorkflow_v1',
					workflowStep: 'DELETE_SUPPLIER',
					workflowVersion: 'v1'
				});
				break;

			default:
				const errorResult = { success: false, error: `Unknown action: ${input.action}` };
				logWorkflowEnd(log, input.action, false, startTime, errorResult as any);
				return errorResult;
		}

		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'completed', entityId });

		const successResult = { success: true, entityId };
		logWorkflowEnd(log, input.action, true, startTime, successResult as any);
		return successResult;

	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;
		log.error('Workflow failed', { action: input.action, error: errorMessage });
		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'SUPPLIER_WORKFLOW_ERROR'
		});

		const errorResult = { success: false, error: errorMessage };
		logWorkflowEnd(log, input.action, false, startTime, errorResult as any);
		return errorResult;
	}
}

export const supplierWorkflow_v1 = DBOS.registerWorkflow(supplierWorkflow);

export async function startSupplierWorkflow(
	input: SupplierWorkflowInput,
	idempotencyKey: string
): Promise<SupplierWorkflowResult> {
	const workflowId = idempotencyKey || `supplier-${input.action}-${input.supplierId || 'new'}-${Date.now()}`;
	const handle = await DBOS.startWorkflow(supplierWorkflow_v1, { workflowID: idempotencyKey})(input);
	return handle.getResult();
}
