/**
 * Purchase Order Workflow (v1)
 *
 * DBOS durable workflow for managing purchase order operations.
 * Handles: create, update, addLine, removeLine, submit, confirm, receive, cancel, delete.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import type { PurchaseOrderStatus } from '../../../../generated/prisma/client.js';
import { type EntityWorkflowResult } from './schemas.js';
import { createWorkflowLogger, logWorkflowStart, logWorkflowEnd } from './workflowLogger.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';
import { recordSpanError } from '../api/middleware/tracing.js';

// Action types for the unified workflow
export const PurchaseOrderAction = {
	CREATE_PO: 'CREATE_PO',
	UPDATE_PO: 'UPDATE_PO',
	ADD_LINE: 'ADD_LINE',
	REMOVE_LINE: 'REMOVE_LINE',
	SUBMIT_PO: 'SUBMIT_PO',
	CONFIRM_PO: 'CONFIRM_PO',
	RECEIVE_PO: 'RECEIVE_PO',
	CANCEL_PO: 'CANCEL_PO',
	DELETE_PO: 'DELETE_PO'
} as const;

export type PurchaseOrderAction = (typeof PurchaseOrderAction)[keyof typeof PurchaseOrderAction];

const WORKFLOW_STATUS_EVENT = 'po_status';
const WORKFLOW_ERROR_EVENT = 'po_error';

export interface PurchaseOrderWorkflowInput {
	action: PurchaseOrderAction;
	organizationId: string;
	userId: string;
	purchaseOrderId?: string;
	lineId?: string;
	data: Record<string, unknown>;
}

export interface PurchaseOrderWorkflowResult extends EntityWorkflowResult {
	// Inherits success, error, entityId from EntityWorkflowResult
}

// Helper to generate PO number
async function generatePONumber(organizationId: string): Promise<string> {
	const count = await prisma.purchaseOrder.count({ where: { organizationId } });
	return `PO-${String(count + 1).padStart(6, '0')}`;
}

// Step functions for each operation
async function createPO(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const supplierId = data.supplierId as string;
	const expectedDate = data.expectedDate as string | undefined;
	const deliveryLocationId = data.deliveryLocationId as string | undefined;
	const taxAmount = data.taxAmount as number | undefined;
	const shippingCost = data.shippingCost as number | undefined;
	const notes = data.notes as string | undefined;
	const lines = data.lines as Array<{
		itemId: string;
		description?: string;
		quantity: number;
		unitCost: number;
	}> | undefined;

	const poNumber = await generatePONumber(organizationId);

	const linesWithTotals = (lines ?? []).map((line, idx) => ({
		...line,
		lineNumber: idx + 1,
		lineTotal: line.quantity * line.unitCost
	}));

	const subtotal = linesWithTotals.reduce((sum, l) => sum + l.lineTotal, 0);
	const totalAmount = subtotal + (taxAmount ?? 0) + (shippingCost ?? 0);

	const po = await prisma.purchaseOrder.create({
		data: {
			organizationId,
			poNumber,
			supplierId,
			expectedDate: expectedDate ? new Date(expectedDate) : null,
			deliveryLocationId,
			subtotal,
			taxAmount: taxAmount ?? 0,
			shippingCost: shippingCost ?? 0,
			totalAmount,
			notes,
			createdBy: userId
		}
	});

	if (linesWithTotals.length > 0) {
		await prisma.purchaseOrderLine.createMany({
			data: linesWithTotals.map((line) => ({
				purchaseOrderId: po.id,
				lineNumber: line.lineNumber,
				itemId: line.itemId,
				description: line.description,
				quantity: line.quantity,
				unitCost: line.unitCost,
				lineTotal: line.lineTotal
			}))
		});
	}

	return po.id;
}

async function updatePO(
	organizationId: string,
	userId: string,
	poId: string,
	data: Record<string, unknown>
): Promise<string> {
	const { id, idempotencyKey, ...updateData } = data;

	await prisma.purchaseOrder.update({
		where: { id: poId },
		data: updateData
	});

	return poId;
}

async function addLine(
	organizationId: string,
	userId: string,
	poId: string,
	data: Record<string, unknown>
): Promise<string> {
	await prisma.purchaseOrderLine.create({
		data: {
			purchaseOrderId: poId,
			lineNumber: data.lineNumber as number,
			itemId: data.itemId as string,
			description: data.description as string,
			quantity: data.quantity as number,
			unitCost: data.unitCost as number,
			lineTotal: data.lineTotal as number
		}
	});

	// Recalculate PO total
	await recalculatePOTotal(poId);

	return poId;
}

async function removeLine(
	organizationId: string,
	userId: string,
	poId: string,
	lineId: string
): Promise<string> {
	await prisma.purchaseOrderLine.delete({ where: { id: lineId } });

	// Recalculate PO total
	await recalculatePOTotal(poId);

	return poId;
}

async function submitPO(
	organizationId: string,
	userId: string,
	poId: string
): Promise<string> {
	await prisma.purchaseOrder.update({
		where: { id: poId },
		data: {
			status: 'SUBMITTED',
			submittedAt: new Date()
		}
	});

	return poId;
}

async function confirmPO(
	organizationId: string,
	userId: string,
	poId: string
): Promise<string> {
	await prisma.purchaseOrder.update({
		where: { id: poId },
		data: {
			status: 'CONFIRMED',
			confirmedAt: new Date()
		}
	});

	return poId;
}

async function receivePO(
	organizationId: string,
	userId: string,
	poId: string,
	data: Record<string, unknown>
): Promise<string> {
	const poNumber = data.poNumber as string;
	const locationId = data.locationId as string;
	const notes = data.notes as string | undefined;
	const existingLines = data.existingLines as Array<{
		id: string;
		itemId: string;
		quantity: number;
		quantityReceived: number;
	}>;
	const lines = data.lines as Array<{
		lineId: string;
		quantityReceived: number;
		lotNumber?: string;
		serialNumber?: string;
		expirationDate?: string;
	}>;

	// Create receipt
	const receiptCount = await prisma.purchaseOrderReceipt.count({
		where: { purchaseOrderId: poId }
	});
	const receiptNumber = `${poNumber}-R${receiptCount + 1}`;

	const receipt = await prisma.purchaseOrderReceipt.create({
		data: {
			purchaseOrderId: poId,
			receiptNumber,
			receivedBy: userId,
			locationId,
			notes
		}
	});

	// Process each line
	for (const recvLine of lines) {
		const poLine = existingLines.find((l) => l.id === recvLine.lineId);
		if (!poLine) continue;

		if (recvLine.quantityReceived > 0) {
			// Create receipt line
			await prisma.purchaseOrderReceiptLine.create({
				data: {
					receiptId: receipt.id,
					itemId: poLine.itemId,
					quantityReceived: recvLine.quantityReceived,
					lotNumber: recvLine.lotNumber,
					serialNumber: recvLine.serialNumber,
					expirationDate: recvLine.expirationDate ? new Date(recvLine.expirationDate) : null
				}
			});

			// Update PO line received quantity
			await prisma.purchaseOrderLine.update({
				where: { id: recvLine.lineId },
				data: { quantityReceived: poLine.quantityReceived + recvLine.quantityReceived }
			});

			// Add to inventory
			let level = await prisma.inventoryLevel.findFirst({
				where: {
					itemId: poLine.itemId,
					locationId,
					lotNumber: recvLine.lotNumber ?? null,
					serialNumber: recvLine.serialNumber ?? null
				}
			});

			if (level) {
				await prisma.inventoryLevel.update({
					where: { id: level.id },
					data: {
						quantityOnHand: level.quantityOnHand + recvLine.quantityReceived,
						quantityAvailable: level.quantityAvailable + recvLine.quantityReceived,
						expirationDate: recvLine.expirationDate ? new Date(recvLine.expirationDate) : level.expirationDate
					}
				});
			} else {
				await prisma.inventoryLevel.create({
					data: {
						itemId: poLine.itemId,
						locationId,
						quantityOnHand: recvLine.quantityReceived,
						quantityAvailable: recvLine.quantityReceived,
						lotNumber: recvLine.lotNumber,
						serialNumber: recvLine.serialNumber,
						expirationDate: recvLine.expirationDate ? new Date(recvLine.expirationDate) : null
					}
				});
			}
		}
	}

	// Check if fully received
	const updatedLines = await prisma.purchaseOrderLine.findMany({
		where: { purchaseOrderId: poId }
	});

	const fullyReceived = updatedLines.every((l) => l.quantityReceived >= l.quantity);
	const partiallyReceived = updatedLines.some((l) => l.quantityReceived > 0);

	let newStatus: 'CONFIRMED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' = 'CONFIRMED';
	if (fullyReceived) {
		newStatus = 'RECEIVED';
	} else if (partiallyReceived) {
		newStatus = 'PARTIALLY_RECEIVED';
	}

	await prisma.purchaseOrder.update({
		where: { id: poId },
		data: {
			status: newStatus,
			receivedAt: fullyReceived ? new Date() : null
		}
	});

	return poId;
}

async function cancelPO(
	organizationId: string,
	userId: string,
	poId: string
): Promise<string> {
	await prisma.purchaseOrder.update({
		where: { id: poId },
		data: {
			status: 'CANCELLED'
		}
	});

	return poId;
}

async function deletePO(
	organizationId: string,
	userId: string,
	poId: string
): Promise<string> {
	await prisma.purchaseOrder.delete({ where: { id: poId } });
	return poId;
}

async function recalculatePOTotal(poId: string): Promise<void> {
	const lines = await prisma.purchaseOrderLine.findMany({ where: { purchaseOrderId: poId } });

	let totalAmount = 0;
	for (const line of lines) {
		totalAmount += Number(line.lineTotal);
	}

	await prisma.purchaseOrder.update({
		where: { id: poId },
		data: { totalAmount }
	});
}

// Main workflow function
async function purchaseOrderWorkflow(input: PurchaseOrderWorkflowInput): Promise<PurchaseOrderWorkflowResult> {
	const log = createWorkflowLogger('purchaseOrderWorkflow', DBOS.workflowID, input.action);
	const startTime = logWorkflowStart(log, input.action, input as any);

	try {
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'started', action: input.action });

		let entityId: string | undefined;

		switch (input.action) {
			case 'CREATE_PO':
				entityId = await DBOS.runStep(
					() => createPO(input.organizationId, input.userId, input.data),
					{ name: 'createPO' }
				);
				await recordWorkflowEvent({
					organizationId: input.organizationId,
					entityType: 'PURCHASE_ORDER',
					entityId: entityId,
					action: 'CREATE',
					eventCategory: 'EXECUTION',
					summary: 'Purchase Order created',
					performedById: input.userId,
					performedByType: 'HUMAN',
					workflowId: 'purchaseOrderWorkflow_v1',
					workflowStep: 'CREATE_PO',
					workflowVersion: 'v1'
				});
				break;

			case 'UPDATE_PO':
				entityId = await DBOS.runStep(
					() => updatePO(input.organizationId, input.userId, input.purchaseOrderId!, input.data),
					{ name: 'updatePO' }
				);
				await recordWorkflowEvent({
					organizationId: input.organizationId,
					entityType: 'PURCHASE_ORDER',
					entityId: entityId,
					action: 'UPDATE',
					eventCategory: 'EXECUTION',
					summary: 'Purchase Order updated',
					performedById: input.userId,
					performedByType: 'HUMAN',
					workflowId: 'purchaseOrderWorkflow_v1',
					workflowStep: 'UPDATE_PO',
					workflowVersion: 'v1'
				});
				break;

			case 'ADD_LINE':
				entityId = await DBOS.runStep(
					() => addLine(input.organizationId, input.userId, input.purchaseOrderId!, input.data),
					{ name: 'addLine' }
				);
				await recordWorkflowEvent({
					organizationId: input.organizationId,
					entityType: 'PURCHASE_ORDER',
					entityId: entityId,
					action: 'UPDATE',
					eventCategory: 'EXECUTION',
					summary: 'Purchase Order line item added',
					performedById: input.userId,
					performedByType: 'HUMAN',
					workflowId: 'purchaseOrderWorkflow_v1',
					workflowStep: 'ADD_LINE',
					workflowVersion: 'v1'
				});
				break;

			case 'REMOVE_LINE':
				entityId = await DBOS.runStep(
					() => removeLine(input.organizationId, input.userId, input.purchaseOrderId!, input.lineId!),
					{ name: 'removeLine' }
				);
				await recordWorkflowEvent({
					organizationId: input.organizationId,
					entityType: 'PURCHASE_ORDER',
					entityId: entityId,
					action: 'UPDATE',
					eventCategory: 'EXECUTION',
					summary: 'Purchase Order line item removed',
					performedById: input.userId,
					performedByType: 'HUMAN',
					workflowId: 'purchaseOrderWorkflow_v1',
					workflowStep: 'REMOVE_LINE',
					workflowVersion: 'v1'
				});
				break;

			case 'SUBMIT_PO':
				entityId = await DBOS.runStep(
					() => submitPO(input.organizationId, input.userId, input.purchaseOrderId!),
					{ name: 'submitPO' }
				);
				await recordWorkflowEvent({
					organizationId: input.organizationId,
					entityType: 'PURCHASE_ORDER',
					entityId: entityId,
					action: 'UPDATE',
					eventCategory: 'EXECUTION',
					summary: 'Purchase Order submitted',
					performedById: input.userId,
					performedByType: 'HUMAN',
					workflowId: 'purchaseOrderWorkflow_v1',
					workflowStep: 'SUBMIT_PO',
					workflowVersion: 'v1'
				});
				break;

			case 'CONFIRM_PO':
				entityId = await DBOS.runStep(
					() => confirmPO(input.organizationId, input.userId, input.purchaseOrderId!),
					{ name: 'confirmPO' }
				);
				await recordWorkflowEvent({
					organizationId: input.organizationId,
					entityType: 'PURCHASE_ORDER',
					entityId: entityId,
					action: 'UPDATE',
					eventCategory: 'EXECUTION', // Confirmation by vendor/human
					summary: 'Purchase Order confirmed',
					performedById: input.userId,
					performedByType: 'HUMAN',
					workflowId: 'purchaseOrderWorkflow_v1',
					workflowStep: 'CONFIRM_PO',
					workflowVersion: 'v1'
				});
				break;

			case 'RECEIVE_PO':
				entityId = await DBOS.runStep(
					() => receivePO(input.organizationId, input.userId, input.purchaseOrderId!, input.data),
					{ name: 'receivePO' }
				);
				await recordWorkflowEvent({
					organizationId: input.organizationId,
					entityType: 'PURCHASE_ORDER',
					entityId: entityId,
					action: 'UPDATE',
					eventCategory: 'EXECUTION',
					summary: 'Purchase Order items received',
					performedById: input.userId,
					performedByType: 'HUMAN',
					workflowId: 'purchaseOrderWorkflow_v1',
					workflowStep: 'RECEIVE_PO',
					workflowVersion: 'v1'
				});
				break;

			case 'CANCEL_PO':
				entityId = await DBOS.runStep(
					() => cancelPO(input.organizationId, input.userId, input.purchaseOrderId!),
					{ name: 'cancelPO' }
				);
				await recordWorkflowEvent({
					organizationId: input.organizationId,
					entityType: 'PURCHASE_ORDER',
					entityId: entityId,
					action: 'UPDATE',
					eventCategory: 'EXECUTION',
					summary: 'Purchase Order cancelled',
					performedById: input.userId,
					performedByType: 'HUMAN',
					workflowId: 'purchaseOrderWorkflow_v1',
					workflowStep: 'CANCEL_PO',
					workflowVersion: 'v1'
				});
				break;

			case 'DELETE_PO':
				entityId = await DBOS.runStep(
					() => deletePO(input.organizationId, input.userId, input.purchaseOrderId!),
					{ name: 'deletePO' }
				);
				await recordWorkflowEvent({
					organizationId: input.organizationId,
					entityType: 'PURCHASE_ORDER',
					entityId: input.purchaseOrderId!,
					action: 'DELETE',
					eventCategory: 'EXECUTION',
					summary: 'Purchase Order deleted',
					performedById: input.userId,
					performedByType: 'HUMAN',
					workflowId: 'purchaseOrderWorkflow_v1',
					workflowStep: 'DELETE_PO',
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
			errorType: 'PURCHASE_ORDER_WORKFLOW_ERROR'
		});

		const errorResult = { success: false, error: errorMessage };
		logWorkflowEnd(log, input.action, false, startTime, errorResult as any);
		return errorResult;
	}
}

export const purchaseOrderWorkflow_v1 = DBOS.registerWorkflow(purchaseOrderWorkflow);

export async function startPurchaseOrderWorkflow(
	input: PurchaseOrderWorkflowInput,
	idempotencyKey?: string
): Promise<PurchaseOrderWorkflowResult> {
	const workflowId = idempotencyKey || `po-${input.action}-${input.purchaseOrderId || 'new'}-${Date.now()}`;
	const handle = await DBOS.startWorkflow(purchaseOrderWorkflow_v1, { workflowID: workflowId })(input);
	return handle.getResult();
}
