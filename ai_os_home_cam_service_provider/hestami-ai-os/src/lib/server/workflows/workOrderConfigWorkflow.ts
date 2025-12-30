/**
 * Work Order Config Workflow (v1)
 *
 * DBOS durable workflow for managing work order configuration operations.
 * Handles: setPricebookOrTemplate, applyJobTemplate.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import { type EntityWorkflowResult } from './schemas.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger } from './workflowLogger.js';

const log = createWorkflowLogger('WorkOrderConfigWorkflow');

// Action types for the unified workflow
export const WorkOrderConfigAction = {
	SET_PRICEBOOK_OR_TEMPLATE: 'SET_PRICEBOOK_OR_TEMPLATE',
	APPLY_JOB_TEMPLATE: 'APPLY_JOB_TEMPLATE'
} as const;

export type WorkOrderConfigAction = (typeof WorkOrderConfigAction)[keyof typeof WorkOrderConfigAction];

export interface WorkOrderConfigWorkflowInput {
	action: WorkOrderConfigAction;
	organizationId: string;
	userId: string;
	workOrderId: string;
	data: Record<string, unknown>;
}

export interface WorkOrderConfigWorkflowResult extends EntityWorkflowResult {
	addedCount?: number;
}

// Step functions for each operation
async function setPricebookOrTemplate(
	organizationId: string,
	userId: string,
	workOrderId: string,
	data: Record<string, unknown>
): Promise<string> {
	const pricebookVersionId = data.pricebookVersionId as string | undefined;
	const jobTemplateId = data.jobTemplateId as string | undefined;

	const wo = await prisma.workOrder.findFirst({
		where: { id: workOrderId }
	});
	if (!wo) throw new Error('Work Order not found');

	await prisma.workOrder.update({
		where: { id: workOrderId },
		data: {
			pricebookVersionId: pricebookVersionId ?? wo.pricebookVersionId,
			jobTemplateId: jobTemplateId ?? wo.jobTemplateId
		}
	});

	console.log(`[WorkOrderConfigWorkflow] SET_PRICEBOOK_OR_TEMPLATE workOrder:${workOrderId} by user ${userId}`);
	return workOrderId;
}

async function applyJobTemplate(
	organizationId: string,
	userId: string,
	workOrderId: string,
	data: Record<string, unknown>
): Promise<{ workOrderId: string; addedCount: number }> {
	const jobTemplateId = data.jobTemplateId as string;
	const clearExisting = data.clearExisting as boolean | undefined;

	const template = await prisma.jobTemplate.findFirst({
		where: { id: jobTemplateId, isActive: true },
		include: { items: { include: { pricebookItem: true } } }
	});
	if (!template) throw new Error('JobTemplate not found');

	// Optionally clear existing line items
	if (clearExisting) {
		await prisma.workOrderLineItem.deleteMany({ where: { workOrderId } });
	}

	// Get starting line number
	const maxLine = await prisma.workOrderLineItem.aggregate({
		where: { workOrderId },
		_max: { lineNumber: true }
	});
	let lineNumber = clearExisting ? 1 : (maxLine._max?.lineNumber ?? 0) + 1;

	// Create line items from template
	const lineItemsData = template.items.map((ti) => {
		const pbItem = ti.pricebookItem;
		const unitPrice = pbItem.basePrice.toNumber();
		const quantity = ti.quantity.toNumber();
		const total = unitPrice * quantity;
		return {
			workOrderId,
			pricebookItemId: ti.pricebookItemId,
			quantity,
			unitPrice,
			total,
			lineNumber: lineNumber++,
			notes: ti.notes,
			isCustom: false,
			itemCode: pbItem.code,
			itemName: pbItem.name,
			itemType: pbItem.type,
			unitOfMeasure: pbItem.unitOfMeasure,
			trade: pbItem.trade
		};
	});

	await prisma.workOrderLineItem.createMany({ data: lineItemsData });

	// Update work order with template reference
	await prisma.workOrder.update({
		where: { id: workOrderId },
		data: {
			jobTemplateId: template.id,
			pricebookVersionId: template.pricebookVersionId
		}
	});

	console.log(`[WorkOrderConfigWorkflow] APPLY_JOB_TEMPLATE workOrder:${workOrderId} template:${jobTemplateId} added:${lineItemsData.length} by user ${userId}`);
	return { workOrderId, addedCount: lineItemsData.length };
}

// Main workflow function
async function workOrderConfigWorkflow(input: WorkOrderConfigWorkflowInput): Promise<WorkOrderConfigWorkflowResult> {
	try {
		let entityId: string | undefined;
		let addedCount: number | undefined;

		switch (input.action) {
			case 'SET_PRICEBOOK_OR_TEMPLATE':
				entityId = await DBOS.runStep(
					() => setPricebookOrTemplate(input.organizationId, input.userId, input.workOrderId, input.data),
					{ name: 'setPricebookOrTemplate' }
				);
				break;

			case 'APPLY_JOB_TEMPLATE':
				const result = await DBOS.runStep(
					() => applyJobTemplate(input.organizationId, input.userId, input.workOrderId, input.data),
					{ name: 'applyJobTemplate' }
				);
				entityId = result.workOrderId;
				addedCount = result.addedCount;
				break;

			default:
				return { success: false, error: `Unknown action: ${input.action}` };
		}

		return { success: true, entityId, addedCount };
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;
		console.error(`[WorkOrderConfigWorkflow] Error in ${input.action}:`, errorMessage);

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'WORK_ORDER_CONFIG_WORKFLOW_ERROR'
		});

		return { success: false, error: errorMessage };
	}
}

export const workOrderConfigWorkflow_v1 = DBOS.registerWorkflow(workOrderConfigWorkflow);

export async function startWorkOrderConfigWorkflow(
	input: WorkOrderConfigWorkflowInput,
	idempotencyKey?: string
): Promise<WorkOrderConfigWorkflowResult> {
	const workflowId = idempotencyKey || `work-order-config-${input.action}-${input.workOrderId}-${Date.now()}`;
	const handle = await DBOS.startWorkflow(workOrderConfigWorkflow_v1, { workflowID: workflowId })(input);
	return handle.getResult();
}
