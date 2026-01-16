/**
 * Inventory Item Workflow (v1)
 *
 * DBOS durable workflow for managing inventory item operations.
 * Handles: create, update, delete.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { orgTransaction } from '../db/rls.js';
import { type EntityWorkflowResult } from './schemas.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger } from './workflowLogger.js';

const log = createWorkflowLogger('InventoryItemWorkflow');

// Action types for the unified workflow
export const InventoryItemAction = {
	CREATE_ITEM: 'CREATE_ITEM',
	UPDATE_ITEM: 'UPDATE_ITEM',
	DELETE_ITEM: 'DELETE_ITEM'
} as const;

export type InventoryItemAction = (typeof InventoryItemAction)[keyof typeof InventoryItemAction];

export interface InventoryItemWorkflowInput {
	action: InventoryItemAction;
	organizationId: string;
	userId: string;
	itemId?: string;
	data: Record<string, unknown>;
}

export interface InventoryItemWorkflowResult extends EntityWorkflowResult {
	// Inherits success, error, entityId from EntityWorkflowResult
}

// Step functions for each operation
async function createItem(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const item = await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.inventoryItem.create({
				data: {
					organizationId,
					sku: data.sku as string,
					name: data.name as string,
					description: data.description as string | undefined,
					category: data.category as string | undefined,
					unitOfMeasure: data.unitOfMeasure as 'EACH' | 'BOX' | 'CASE' | 'PACK' | 'ROLL' | 'GALLON' | 'QUART' | 'PINT' | 'OUNCE' | 'POUND' | 'FOOT' | 'YARD' | 'METER' | 'SQUARE_FOOT' | 'CUBIC_FOOT' | 'HOUR' | 'DAY',
					unitCost: data.unitCost as number | undefined,
					reorderPoint: data.reorderPoint as number | undefined,
					reorderQuantity: data.reorderQuantity as number | undefined,
					minStockLevel: data.minStockLevel as number | undefined,
					maxStockLevel: data.maxStockLevel as number | undefined,
					isSerialTracked: data.isSerialTracked as boolean | undefined,
					isLotTracked: data.isLotTracked as boolean | undefined,
					preferredSupplierId: data.preferredSupplierId as string | undefined,
					pricebookItemId: data.pricebookItemId as string | undefined,
					isActive: true
				}
			});
		},
		{ userId, reason: 'Create inventory item' }
	);

	log.info('CREATE_ITEM completed', { itemId: item.id, userId });
	return item.id;
}

async function updateItem(
	organizationId: string,
	userId: string,
	itemId: string,
	data: Record<string, unknown>
): Promise<string> {
	const { id, idempotencyKey, ...updateData } = data;

	await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.inventoryItem.update({
				where: { id: itemId },
				data: updateData
			});
		},
		{ userId, reason: 'Update inventory item' }
	);

	log.info('UPDATE_ITEM completed', { itemId, userId });
	return itemId;
}

async function deleteItem(
	organizationId: string,
	userId: string,
	itemId: string
): Promise<string> {
	await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.inventoryItem.update({
				where: { id: itemId },
				data: { deletedAt: new Date() }
			});
		},
		{ userId, reason: 'Delete inventory item' }
	);

	log.info('DELETE_ITEM completed', { itemId, userId });
	return itemId;
}

// Main workflow function
async function inventoryItemWorkflow(input: InventoryItemWorkflowInput): Promise<InventoryItemWorkflowResult> {
	try {
		let entityId: string | undefined;

		switch (input.action) {
			case 'CREATE_ITEM':
				entityId = await DBOS.runStep(
					() => createItem(input.organizationId, input.userId, input.data),
					{ name: 'createItem' }
				);
				break;

			case 'UPDATE_ITEM':
				entityId = await DBOS.runStep(
					() => updateItem(input.organizationId, input.userId, input.itemId!, input.data),
					{ name: 'updateItem' }
				);
				break;

			case 'DELETE_ITEM':
				entityId = await DBOS.runStep(
					() => deleteItem(input.organizationId, input.userId, input.itemId!),
					{ name: 'deleteItem' }
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
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'INVENTORY_ITEM_WORKFLOW_ERROR'
		});

		return { success: false, error: errorMessage };
	}
}

export const inventoryItemWorkflow_v1 = DBOS.registerWorkflow(inventoryItemWorkflow);

export async function startInventoryItemWorkflow(
	input: InventoryItemWorkflowInput,
	idempotencyKey: string
): Promise<InventoryItemWorkflowResult> {
	const workflowId = idempotencyKey || `inv-item-${input.action}-${input.itemId || 'new'}-${Date.now()}`;
	const handle = await DBOS.startWorkflow(inventoryItemWorkflow_v1, { workflowID: idempotencyKey})(input);
	return handle.getResult();
}
