/**
 * Inventory Location Workflow (v1)
 *
 * DBOS durable workflow for managing inventory location operations.
 * Handles: create, update, delete.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { orgTransaction } from '../db/rls.js';
import { type EntityWorkflowResult } from './schemas.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger } from './workflowLogger.js';
import { ActivityActionType } from '../../../../generated/prisma/enums.js';

// Workflow error types for tracing
const WorkflowErrorType = {
	INVENTORY_LOCATION_WORKFLOW_ERROR: 'INVENTORY_LOCATION_WORKFLOW_ERROR'
} as const;

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
	const location = await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.inventoryLocation.create({
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
		},
		{ userId, reason: 'Create inventory location' }
	);

	log.info('CREATE_LOCATION completed', { locationId: location.id, userId });
	return location.id;
}

async function updateLocation(
	organizationId: string,
	userId: string,
	locationId: string,
	data: Record<string, unknown>
): Promise<string> {
	const { id, idempotencyKey, ...updateData } = data;

	await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.inventoryLocation.update({
				where: { id: locationId },
				data: updateData
			});
		},
		{ userId, reason: 'Update inventory location' }
	);

	log.info('UPDATE_LOCATION completed', { locationId, userId });
	return locationId;
}

async function deleteLocation(
	organizationId: string,
	userId: string,
	locationId: string
): Promise<string> {
	await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.inventoryLocation.update({
				where: { id: locationId },
				data: { deletedAt: new Date() }
			});
		},
		{ userId, reason: 'Delete inventory location' }
	);

	log.info('DELETE_LOCATION completed', { locationId, userId });
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
		log.error(`Error in ${input.action}`, { error: errorMessage });

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: ActivityActionType.WORKFLOW_FAILED,
			errorType: WorkflowErrorType.INVENTORY_LOCATION_WORKFLOW_ERROR
		});

		return { success: false, error: errorMessage };
	}
}

export const inventoryLocationWorkflow_v1 = DBOS.registerWorkflow(inventoryLocationWorkflow);

export async function startInventoryLocationWorkflow(
	input: InventoryLocationWorkflowInput,
	idempotencyKey: string
): Promise<InventoryLocationWorkflowResult> {
	const workflowId = idempotencyKey || `inv-loc-${input.action}-${input.locationId || 'new'}-${Date.now()}`;
	const handle = await DBOS.startWorkflow(inventoryLocationWorkflow_v1, { workflowID: idempotencyKey})(input);
	return handle.getResult();
}
