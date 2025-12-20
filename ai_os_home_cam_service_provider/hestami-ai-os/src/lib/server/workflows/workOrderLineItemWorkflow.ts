/**
 * Work Order Line Item Workflow (v1)
 *
 * DBOS durable workflow for managing work order line items.
 * Provides idempotency, durability, and trace correlation for line item operations.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import type { ContractorTradeType, PricebookItemType } from '../../../../generated/prisma/client.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';

const WORKFLOW_STATUS_EVENT = 'wo_line_item_status';
const WORKFLOW_ERROR_EVENT = 'wo_line_item_error';

interface AddLineItemInput {
	organizationId: string;
	userId: string;
	workOrderId: string;
	pricebookItemId?: string;
	quantity: number;
	unitPrice?: number;
	notes?: string;
	// For custom items
	itemCode?: string;
	itemName?: string;
	itemType?: PricebookItemType;
	unitOfMeasure?: string;
	trade?: ContractorTradeType;
}

interface RemoveLineItemInput {
	organizationId: string;
	userId: string;
	workOrderId: string;
	lineItemId: string;
}

interface LineItemResult {
	success: boolean;
	lineItemId?: string;
	lineNumber?: number;
	timestamp: string;
	error?: string;
}

async function addLineItem(input: AddLineItemInput): Promise<{
	id: string;
	lineNumber: number;
	itemName: string | null;
	quantity: number;
	unitPrice: number;
	total: number;
}> {
	let unitPrice = input.unitPrice ?? 0;
	let itemCode = input.itemCode ?? null;
	let itemName = input.itemName ?? null;
	let itemType = input.itemType ?? null;
	let unitOfMeasure = input.unitOfMeasure ?? null;
	let trade = input.trade ?? null;
	const isCustom = !input.pricebookItemId;

	// If pricebook item provided, snapshot its data
	if (input.pricebookItemId) {
		const pbItem = await prisma.pricebookItem.findUnique({
			where: { id: input.pricebookItemId }
		});
		if (!pbItem) {
			throw new Error('PricebookItem not found');
		}

		unitPrice = input.unitPrice ?? pbItem.basePrice.toNumber();
		itemCode = pbItem.code;
		itemName = pbItem.name;
		itemType = pbItem.type;
		unitOfMeasure = pbItem.unitOfMeasure;
		trade = pbItem.trade;
	}

	const total = unitPrice * input.quantity;

	// Get next line number
	const maxLine = await prisma.workOrderLineItem.aggregate({
		where: { workOrderId: input.workOrderId },
		_max: { lineNumber: true }
	});
	const lineNumber = (maxLine._max?.lineNumber ?? 0) + 1;

	const lineItem = await prisma.workOrderLineItem.create({
		data: {
			workOrderId: input.workOrderId,
			pricebookItemId: input.pricebookItemId ?? null,
			quantity: input.quantity,
			unitPrice,
			total,
			lineNumber,
			itemCode,
			itemName,
			itemType,
			unitOfMeasure,
			trade,
			isCustom,
			notes: input.notes
		}
	});

	// Record activity event
	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: 'WORK_ORDER',
		entityId: input.workOrderId,
		action: 'UPDATE',
		eventCategory: 'EXECUTION',
		summary: `Line item added: ${itemName || 'Custom item'}`,
		performedById: input.userId,
		performedByType: 'HUMAN',
		workflowId: 'workOrderLineItemWorkflow_v1',
		workflowStep: 'ADD_LINE_ITEM',
		workflowVersion: 'v1',
		workOrderId: input.workOrderId,
		newState: {
			lineItemId: lineItem.id,
			lineNumber,
			itemName,
			quantity: input.quantity,
			unitPrice,
			total
		}
	});

	return {
		id: lineItem.id,
		lineNumber,
		itemName,
		quantity: input.quantity,
		unitPrice,
		total
	};
}

async function removeLineItem(input: RemoveLineItemInput): Promise<void> {
	const lineItem = await prisma.workOrderLineItem.findFirst({
		where: { id: input.lineItemId, workOrderId: input.workOrderId }
	});

	if (!lineItem) {
		throw new Error('LineItem not found');
	}

	await prisma.workOrderLineItem.delete({ where: { id: input.lineItemId } });

	// Record activity event
	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: 'WORK_ORDER',
		entityId: input.workOrderId,
		action: 'UPDATE',
		eventCategory: 'EXECUTION',
		summary: `Line item removed: ${lineItem.itemName || 'Custom item'}`,
		performedById: input.userId,
		performedByType: 'HUMAN',
		workflowId: 'workOrderLineItemWorkflow_v1',
		workflowStep: 'REMOVE_LINE_ITEM',
		workflowVersion: 'v1',
		workOrderId: input.workOrderId,
		previousState: {
			lineItemId: lineItem.id,
			lineNumber: lineItem.lineNumber,
			itemName: lineItem.itemName
		}
	});
}

async function addLineItemWorkflow(input: AddLineItemInput): Promise<LineItemResult> {
	try {
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'started', action: 'ADD' });

		const result = await DBOS.runStep(() => addLineItem(input), { name: 'addLineItem' });

		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, {
			step: 'completed',
			lineItemId: result.id,
			lineNumber: result.lineNumber
		});

		return {
			success: true,
			lineItemId: result.id,
			lineNumber: result.lineNumber,
			timestamp: new Date().toISOString()
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		return {
			success: false,
			timestamp: new Date().toISOString(),
			error: errorMessage
		};
	}
}

async function removeLineItemWorkflow(input: RemoveLineItemInput): Promise<LineItemResult> {
	try {
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'started', action: 'REMOVE' });

		await DBOS.runStep(() => removeLineItem(input), { name: 'removeLineItem' });

		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, {
			step: 'completed',
			lineItemId: input.lineItemId
		});

		return {
			success: true,
			lineItemId: input.lineItemId,
			timestamp: new Date().toISOString()
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		return {
			success: false,
			timestamp: new Date().toISOString(),
			error: errorMessage
		};
	}
}

export const addLineItemWorkflow_v1 = DBOS.registerWorkflow(addLineItemWorkflow);
export const removeLineItemWorkflow_v1 = DBOS.registerWorkflow(removeLineItemWorkflow);

export async function startAddLineItemWorkflow(
	input: AddLineItemInput,
	workflowId: string
): Promise<LineItemResult> {
	const handle = await DBOS.startWorkflow(addLineItemWorkflow_v1, {
		workflowID: workflowId
	})(input);

	return handle.getResult();
}

export async function startRemoveLineItemWorkflow(
	input: RemoveLineItemInput,
	workflowId: string
): Promise<LineItemResult> {
	const handle = await DBOS.startWorkflow(removeLineItemWorkflow_v1, {
		workflowID: workflowId
	})(input);

	return handle.getResult();
}

export type { AddLineItemInput, RemoveLineItemInput, LineItemResult };
