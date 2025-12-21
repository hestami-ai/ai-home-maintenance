/**
 * Inventory Workflow (v1)
 *
 * DBOS durable workflow for inventory management.
 * Handles: usage logging, reorder triggers, PO creation (stub).
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import { type LifecycleWorkflowResult } from './schemas.js';
import { createWorkflowLogger } from './workflowLogger.js';

const log = createWorkflowLogger('InventoryWorkflow');

const WORKFLOW_STATUS_EVENT = 'inventory_status';
const WORKFLOW_ERROR_EVENT = 'inventory_error';

export const InventoryAction = {
	LOG_USAGE: 'LOG_USAGE',
	CHECK_REORDER: 'CHECK_REORDER',
	CREATE_PO: 'CREATE_PO',
	RECEIVE_PO: 'RECEIVE_PO'
} as const;

export type InventoryAction = (typeof InventoryAction)[keyof typeof InventoryAction];

export interface InventoryWorkflowInput {
	action: InventoryAction;
	organizationId: string;
	userId: string;
	// For LOG_USAGE
	itemId?: string;
	locationId?: string;
	jobId?: string;
	quantity?: number;
	// For CREATE_PO / RECEIVE_PO
	purchaseOrderId?: string;
	supplierId?: string;
	items?: Array<{ itemId: string; quantity: number; unitCost: number }>;
}

export interface InventoryWorkflowResult extends LifecycleWorkflowResult {
	usageId?: string;
	reorderItems?: Array<{ itemId: string; itemName: string; currentStock: number; reorderPoint: number }>;
	purchaseOrderId?: string;
}

async function logMaterialUsage(
	organizationId: string,
	itemId: string,
	locationId: string,
	jobId: string,
	quantity: number,
	userId: string
): Promise<string> {
	// Get item unit cost for calculating total
	const item = await prisma.inventoryItem.findUnique({
		where: { id: itemId },
		select: { unitCost: true }
	});

	const unitCost = item?.unitCost ?? 0;
	const totalCost = Number(unitCost) * quantity;

	// Create usage record
	const usage = await prisma.materialUsage.create({
		data: {
			organizationId,
			itemId,
			locationId,
			jobId,
			quantity,
			unitCost,
			totalCost,
			usedAt: new Date(),
			usedBy: userId
		}
	});

	return usage.id;
}

async function checkReorderLevels(
	organizationId: string
): Promise<Array<{ itemId: string; itemName: string; currentStock: number; reorderPoint: number }>> {
	// Get all active items
	const items = await prisma.inventoryItem.findMany({
		where: {
			organizationId,
			isActive: true
		}
	});

	// Filter items that have reorder points set
	const reorderItems = items
		.filter(item => item.reorderPoint !== null && item.reorderPoint !== undefined)
		.map(item => ({
			itemId: item.id,
			itemName: item.name,
			currentStock: 0, // Would need stock aggregation in production
			reorderPoint: Number(item.reorderPoint)
		}));

	return reorderItems;
}

async function createPurchaseOrder(
	organizationId: string,
	supplierId: string,
	items: Array<{ itemId: string; quantity: number; unitCost: number }>,
	userId: string
): Promise<string> {
	// Generate PO number
	const year = new Date().getFullYear();
	const count = await prisma.purchaseOrder.count({
		where: {
			organizationId,
			poNumber: { startsWith: `PO-${year}-` }
		}
	});
	const poNumber = `PO-${year}-${String(count + 1).padStart(6, '0')}`;

	const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);

	const po = await prisma.$transaction(async (tx) => {
		const purchaseOrder = await tx.purchaseOrder.create({
			data: {
				organizationId,
				supplierId,
				poNumber,
				status: 'DRAFT',
				subtotal,
				taxAmount: 0,
				totalAmount: subtotal,
				createdBy: userId
			}
		});

		await tx.purchaseOrderLine.createMany({
			data: items.map((item, index) => ({
				purchaseOrderId: purchaseOrder.id,
				lineNumber: index + 1,
				itemId: item.itemId,
				quantity: item.quantity,
				unitCost: item.unitCost,
				lineTotal: item.quantity * item.unitCost
			}))
		});

		return purchaseOrder;
	});

	return po.id;
}

async function receivePurchaseOrder(
	purchaseOrderId: string,
	userId: string
): Promise<boolean> {
	const po = await prisma.purchaseOrder.findUnique({
		where: { id: purchaseOrderId },
		include: { lines: true }
	});

	if (!po || po.status !== 'SUBMITTED') {
		return false;
	}

	// Get first location for this org to use as receipt location
	const location = await prisma.inventoryLocation.findFirst({
		where: { organizationId: po.organizationId }
	});

	if (!location) {
		return false;
	}

	await prisma.$transaction(async (tx) => {
		// Create receipt
		const receipt = await tx.purchaseOrderReceipt.create({
			data: {
				purchaseOrderId,
				receiptNumber: `RCV-${Date.now()}`,
				receivedAt: new Date(),
				receivedBy: userId,
				locationId: location.id
			}
		});

		// Process each line
		for (const line of po.lines) {
			// Create receipt line
			await tx.purchaseOrderReceiptLine.create({
				data: {
					receiptId: receipt.id,
					itemId: line.itemId,
					quantityReceived: line.quantity
				}
			});

			// Update line received quantity
			await tx.purchaseOrderLine.update({
				where: { id: line.id },
				data: { quantityReceived: line.quantity }
			});
		}

		// Update PO status
		await tx.purchaseOrder.update({
			where: { id: purchaseOrderId },
			data: { status: 'RECEIVED' }
		});
	});

	return true;
}

async function inventoryWorkflow(input: InventoryWorkflowInput): Promise<InventoryWorkflowResult> {
	const workflowId = DBOS.workflowID;

	try {
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'started', action: input.action });

		switch (input.action) {
			case 'LOG_USAGE': {
				if (!input.itemId || !input.locationId || !input.jobId || !input.quantity) {
					return {
						success: false,
						action: input.action,
						timestamp: new Date().toISOString(),
						error: 'Missing required fields for usage logging'
					};
				}

				const usageId = await DBOS.runStep(
					() => logMaterialUsage(
						input.organizationId,
						input.itemId!,
						input.locationId!,
						input.jobId!,
						input.quantity!,
						input.userId
					),
					{ name: 'logMaterialUsage' }
				);
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'usage_logged', usageId });

				return {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					usageId
				};
			}

			case 'CHECK_REORDER': {
				const reorderItems = await DBOS.runStep(
					() => checkReorderLevels(input.organizationId),
					{ name: 'checkReorderLevels' }
				);
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'reorder_checked', count: reorderItems.length });

				return {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					reorderItems
				};
			}

			case 'CREATE_PO': {
				if (!input.supplierId || !input.items || input.items.length === 0) {
					return {
						success: false,
						action: input.action,
						timestamp: new Date().toISOString(),
						error: 'Missing supplier or items for PO creation'
					};
				}

				const purchaseOrderId = await DBOS.runStep(
					() => createPurchaseOrder(
						input.organizationId,
						input.supplierId!,
						input.items!,
						input.userId
					),
					{ name: 'createPurchaseOrder' }
				);
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'po_created', purchaseOrderId });

				return {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					purchaseOrderId
				};
			}

			case 'RECEIVE_PO': {
				if (!input.purchaseOrderId) {
					return {
						success: false,
						action: input.action,
						timestamp: new Date().toISOString(),
						error: 'Missing purchase order ID'
					};
				}

				const received = await DBOS.runStep(
					() => receivePurchaseOrder(input.purchaseOrderId!, input.userId),
					{ name: 'receivePurchaseOrder' }
				);
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'po_received', success: received });

				return {
					success: received,
					action: input.action,
					timestamp: new Date().toISOString(),
					purchaseOrderId: input.purchaseOrderId,
					error: received ? undefined : 'Failed to receive PO'
				};
			}

			default:
				return {
					success: false,
					action: input.action,
					timestamp: new Date().toISOString(),
					error: `Unknown action: ${input.action}`
				};
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		return {
			success: false,
			action: input.action,
			timestamp: new Date().toISOString(),
			error: errorMessage
		};
	}
}

export const inventoryWorkflow_v1 = DBOS.registerWorkflow(inventoryWorkflow);

export async function startInventoryWorkflow(
	input: InventoryWorkflowInput,
	workflowId?: string
): Promise<{ workflowId: string }> {
	const id = workflowId || `inventory-${input.action.toLowerCase()}-${Date.now()}`;
	await DBOS.startWorkflow(inventoryWorkflow_v1, { workflowID: id })(input);
	return { workflowId: id };
}

export async function getInventoryWorkflowStatus(
	workflowId: string
): Promise<{ step: string; [key: string]: unknown } | null> {
	const status = await DBOS.getEvent(workflowId, WORKFLOW_STATUS_EVENT, 0);
	return status as { step: string; [key: string]: unknown } | null;
}

export async function getInventoryWorkflowError(
	workflowId: string
): Promise<{ error: string } | null> {
	const error = await DBOS.getEvent(workflowId, WORKFLOW_ERROR_EVENT, 0);
	return error as { error: string } | null;
}

