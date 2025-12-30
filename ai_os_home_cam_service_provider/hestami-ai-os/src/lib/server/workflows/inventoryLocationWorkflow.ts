/**
 * Inventory Location Workflow (v1)
 *
 * DBOS durable workflow for managing inventory location operations.
 * Handles: create, update, delete.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import { type EntityWorkflowResult } from './schemas.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger } from './workflowLogger.js';

const log = createWorkflowLogger('InventoryLocationWorkflow');

// Action types for the unified workflow
export const InventoryLocationAction = {
	CREATE_LOCATION: 'CREATE_LOCATION',
	UPDATE_LOCATION: 'UPDATE_LOCATION',
	DELETE_LOCATION: 'DELETE_LOCATION'
} as const;

export type InventoryLocationAction = (typeof InventoryLocationAction)[keyof typeof InventoryLocationAction];

export interface InventoryLocationWorkflowInput {
	action: InventoryLocationAction;
	organizationId: string;
	userId: string;
	locationId?: string;
	data: Record<string, unknown>;
}

export interface InventoryLocationWorkflowResult extends EntityWorkflowResult {
	// Inherits success, error, entityId from EntityWorkflowResult
}

// Step functions for each operation
async function createLocation(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const location = await prisma.inventoryLocation.create({
		data: {
			organizationId,
			name: data.name as string,
			code: data.code as string | undefined,
			type: data.type as 'WAREHOUSE' | 'TRUCK' | 'BRANCH' | 'VENDOR_CONSIGNMENT',
			description: data.description as string | undefined,
			addressLine1: data.addressLine1 as string | undefined,
			addressLine2: data.addressLine2 as string | undefined,
			city: data.city as string | undefined,
			state: data.state as string | undefined,
			postalCode: data.postalCode as string | undefined,
			technicianId: data.technicianId as string | undefined,
			branchId: data.branchId as string | undefined,
			isActive: true
		}
	});

	console.log(`[InventoryLocationWorkflow] CREATE_LOCATION location:${location.id} by user ${userId}`);
	return location.id;
}

async function updateLocation(
	organizationId: string,
	userId: string,
	locationId: string,
	data: Record<string, unknown>
): Promise<string> {
	const { id, idempotencyKey, ...updateData } = data;

	await prisma.inventoryLocation.update({
		where: { id: locationId },
		data: updateData
	});

	console.log(`[InventoryLocationWorkflow] UPDATE_LOCATION location:${locationId} by user ${userId}`);
	return locationId;
}

async function deleteLocation(
	organizationId: string,
	userId: string,
	locationId: string
): Promise<string> {
	await prisma.inventoryLocation.update({
		where: { id: locationId },
		data: { deletedAt: new Date() }
	});

	console.log(`[InventoryLocationWorkflow] DELETE_LOCATION location:${locationId} by user ${userId}`);
	return locationId;
}

// Main workflow function
async function inventoryLocationWorkflow(input: InventoryLocationWorkflowInput): Promise<InventoryLocationWorkflowResult> {
	try {
		let entityId: string | undefined;

		switch (input.action) {
			case 'CREATE_LOCATION':
				entityId = await DBOS.runStep(
					() => createLocation(input.organizationId, input.userId, input.data),
					{ name: 'createLocation' }
				);
				break;

			case 'UPDATE_LOCATION':
				entityId = await DBOS.runStep(
					() => updateLocation(input.organizationId, input.userId, input.locationId!, input.data),
					{ name: 'updateLocation' }
				);
				break;

			case 'DELETE_LOCATION':
				entityId = await DBOS.runStep(
					() => deleteLocation(input.organizationId, input.userId, input.locationId!),
					{ name: 'deleteLocation' }
				);
				break;

			default:
				return { success: false, error: `Unknown action: ${input.action}` };
		}

		return { success: true, entityId };
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;
		console.error(`[InventoryLocationWorkflow] Error in ${input.action}:`, errorMessage);

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'INVENTORY_LOCATION_WORKFLOW_ERROR'
		});

		return { success: false, error: errorMessage };
	}
}

export const inventoryLocationWorkflow_v1 = DBOS.registerWorkflow(inventoryLocationWorkflow);

export async function startInventoryLocationWorkflow(
	input: InventoryLocationWorkflowInput,
	idempotencyKey?: string
): Promise<InventoryLocationWorkflowResult> {
	const workflowId = idempotencyKey || `inv-loc-${input.action}-${input.locationId || 'new'}-${Date.now()}`;
	const handle = await DBOS.startWorkflow(inventoryLocationWorkflow_v1, { workflowID: workflowId })(input);
	return handle.getResult();
}
