/**
 * Inventory Item Workflow (v1)
 *
 * DBOS durable workflow for managing inventory item operations.
 * Handles: create, update, delete.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';

// Action types for the unified workflow
export type InventoryItemAction =
	| 'CREATE_ITEM'
	| 'UPDATE_ITEM'
	| 'DELETE_ITEM';

export interface InventoryItemWorkflowInput {
	action: InventoryItemAction;
	organizationId: string;
	userId: string;
	itemId?: string;
	data: Record<string, unknown>;
}

export interface InventoryItemWorkflowResult {
	success: boolean;
	entityId?: string;
	error?: string;
}

// Step functions for each operation
async function createItem(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const item = await prisma.inventoryItem.create({
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

	console.log(`[InventoryItemWorkflow] CREATE_ITEM item:${item.id} by user ${userId}`);
	return item.id;
}

async function updateItem(
	organizationId: string,
	userId: string,
	itemId: string,
	data: Record<string, unknown>
): Promise<string> {
	const { id, idempotencyKey, ...updateData } = data;

	await prisma.inventoryItem.update({
		where: { id: itemId },
		data: updateData
	});

	console.log(`[InventoryItemWorkflow] UPDATE_ITEM item:${itemId} by user ${userId}`);
	return itemId;
}

async function deleteItem(
	organizationId: string,
	userId: string,
	itemId: string
): Promise<string> {
	await prisma.inventoryItem.update({
		where: { id: itemId },
		data: { deletedAt: new Date() }
	});

	console.log(`[InventoryItemWorkflow] DELETE_ITEM item:${itemId} by user ${userId}`);
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
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`[InventoryItemWorkflow] Error in ${input.action}:`, errorMessage);
		return { success: false, error: errorMessage };
	}
}

export const inventoryItemWorkflow_v1 = DBOS.registerWorkflow(inventoryItemWorkflow);

export async function startInventoryItemWorkflow(
	input: InventoryItemWorkflowInput,
	idempotencyKey?: string
): Promise<InventoryItemWorkflowResult> {
	const workflowId = idempotencyKey || `inv-item-${input.action}-${input.itemId || 'new'}-${Date.now()}`;
	const handle = await DBOS.startWorkflow(inventoryItemWorkflow_v1, { workflowID: workflowId })(input);
	return handle.getResult();
}
