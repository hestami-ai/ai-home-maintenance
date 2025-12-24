/**
 * Supplier Workflow (v1)
 *
 * DBOS durable workflow for managing supplier operations.
 * Handles: create, update, delete.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import { type EntityWorkflowResult } from './schemas.js';

// Action types for the unified workflow
export const SupplierAction = {
	CREATE_SUPPLIER: 'CREATE_SUPPLIER',
	UPDATE_SUPPLIER: 'UPDATE_SUPPLIER',
	DELETE_SUPPLIER: 'DELETE_SUPPLIER'
} as const;

export type SupplierAction = (typeof SupplierAction)[keyof typeof SupplierAction];

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

	console.log(`[SupplierWorkflow] CREATE_SUPPLIER supplier:${supplier.id} by user ${userId}`);
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

	console.log(`[SupplierWorkflow] UPDATE_SUPPLIER supplier:${supplierId} by user ${userId}`);
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

	console.log(`[SupplierWorkflow] DELETE_SUPPLIER supplier:${supplierId} by user ${userId}`);
	return supplierId;
}

// Main workflow function
async function supplierWorkflow(input: SupplierWorkflowInput): Promise<SupplierWorkflowResult> {
	try {
		let entityId: string | undefined;

		switch (input.action) {
			case 'CREATE_SUPPLIER':
				entityId = await DBOS.runStep(
					() => createSupplier(input.organizationId, input.userId, input.data),
					{ name: 'createSupplier' }
				);
				break;

			case 'UPDATE_SUPPLIER':
				entityId = await DBOS.runStep(
					() => updateSupplier(input.organizationId, input.userId, input.supplierId!, input.data),
					{ name: 'updateSupplier' }
				);
				break;

			case 'DELETE_SUPPLIER':
				entityId = await DBOS.runStep(
					() => deleteSupplier(input.organizationId, input.userId, input.supplierId!),
					{ name: 'deleteSupplier' }
				);
				break;

			default:
				return { success: false, error: `Unknown action: ${input.action}` };
		}

		return { success: true, entityId };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`[SupplierWorkflow] Error in ${input.action}:`, errorMessage);
		return { success: false, error: errorMessage };
	}
}

export const supplierWorkflow_v1 = DBOS.registerWorkflow(supplierWorkflow);

export async function startSupplierWorkflow(
	input: SupplierWorkflowInput,
	idempotencyKey?: string
): Promise<SupplierWorkflowResult> {
	const workflowId = idempotencyKey || `supplier-${input.action}-${input.supplierId || 'new'}-${Date.now()}`;
	const handle = await DBOS.startWorkflow(supplierWorkflow_v1, { workflowID: workflowId })(input);
	return handle.getResult();
}
