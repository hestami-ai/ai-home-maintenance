/**
 * Estimate Workflow (v1)
 *
 * DBOS durable workflow for managing estimate operations.
 * Handles: generate, update, addLine, removeLine, send, accept, decline, revise, delete.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import { EstimateStatus, type EntityWorkflowResult } from './schemas.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger } from './workflowLogger.js';

const log = createWorkflowLogger('EstimateWorkflow');

// Action types for the unified workflow
export const EstimateAction = {
	GENERATE_ESTIMATE: 'GENERATE_ESTIMATE',
	GENERATE_FROM_PRICEBOOK: 'GENERATE_FROM_PRICEBOOK',
	UPDATE_ESTIMATE: 'UPDATE_ESTIMATE',
	ADD_LINE: 'ADD_LINE',
	REMOVE_LINE: 'REMOVE_LINE',
	SEND_ESTIMATE: 'SEND_ESTIMATE',
	ACCEPT_ESTIMATE: 'ACCEPT_ESTIMATE',
	DECLINE_ESTIMATE: 'DECLINE_ESTIMATE',
	REVISE_ESTIMATE: 'REVISE_ESTIMATE',
	DELETE_ESTIMATE: 'DELETE_ESTIMATE'
} as const;

export type EstimateAction = (typeof EstimateAction)[keyof typeof EstimateAction];

export interface EstimateWorkflowInput {
	action: EstimateAction;
	organizationId: string;
	userId: string;
	estimateId?: string;
	lineId?: string;
	data: Record<string, unknown>;
}

export interface EstimateWorkflowResult extends EntityWorkflowResult {
	// Inherits success, error, entityId from EntityWorkflowResult
}

// Step functions for each operation
async function updateEstimate(
	organizationId: string,
	userId: string,
	estimateId: string,
	data: Record<string, unknown>
): Promise<string> {
	const { id, idempotencyKey, ...updateData } = data;

	await prisma.estimate.update({
		where: { id: estimateId },
		data: updateData
	});

	console.log(`[EstimateWorkflow] UPDATE_ESTIMATE on estimate:${estimateId} by user ${userId}`);
	return estimateId;
}

async function addLine(
	organizationId: string,
	userId: string,
	estimateId: string,
	data: Record<string, unknown>
): Promise<string> {
	const line = await prisma.estimateLine.create({
		data: {
			estimateId,
			lineNumber: data.lineNumber as number,
			description: data.description as string,
			quantity: data.quantity as number,
			unitPrice: data.unitPrice as number,
			lineTotal: data.lineTotal as number,
			pricebookItemId: data.pricebookItemId as string | undefined,
			isTaxable: data.isTaxable as boolean | undefined ?? true,
			taxRate: data.taxRate as number | undefined ?? 0,
			optionId: data.optionId as string | undefined
		}
	});

	// Recalculate estimate totals
	await recalculateEstimateTotals(estimateId);

	console.log(`[EstimateWorkflow] ADD_LINE on estimate:${estimateId} by user ${userId}`);
	return estimateId;
}

async function removeLine(
	organizationId: string,
	userId: string,
	estimateId: string,
	lineId: string
): Promise<string> {
	await prisma.estimateLine.delete({ where: { id: lineId } });

	// Recalculate estimate totals
	await recalculateEstimateTotals(estimateId);

	console.log(`[EstimateWorkflow] REMOVE_LINE on estimate:${estimateId} by user ${userId}`);
	return estimateId;
}

async function sendEstimate(
	organizationId: string,
	userId: string,
	estimateId: string
): Promise<string> {
	await prisma.estimate.update({
		where: { id: estimateId },
		data: {
			status: 'SENT',
			sentAt: new Date()
		}
	});

	console.log(`[EstimateWorkflow] SEND_ESTIMATE on estimate:${estimateId} by user ${userId}`);
	return estimateId;
}

async function acceptEstimate(
	organizationId: string,
	userId: string,
	estimateId: string,
	data: Record<string, unknown>
): Promise<string> {
	await prisma.estimate.update({
		where: { id: estimateId },
		data: {
			status: 'ACCEPTED',
			acceptedAt: new Date()
		}
	});

	console.log(`[EstimateWorkflow] ACCEPT_ESTIMATE on estimate:${estimateId} by user ${userId}`);
	return estimateId;
}

async function declineEstimate(
	organizationId: string,
	userId: string,
	estimateId: string
): Promise<string> {
	await prisma.estimate.update({
		where: { id: estimateId },
		data: {
			status: 'DECLINED',
			declinedAt: new Date()
		}
	});

	console.log(`[EstimateWorkflow] DECLINE_ESTIMATE on estimate:${estimateId} by user ${userId}`);
	return estimateId;
}

async function reviseEstimate(
	organizationId: string,
	userId: string,
	estimateId: string
): Promise<string> {
	const existing = await prisma.estimate.findUniqueOrThrow({
		where: { id: estimateId },
		include: { lines: true, options: { include: { lines: true } } }
	});

	// Create new revision
	const newVersion = (existing.version ?? 1) + 1;
	const newEstimateNumber = `${existing.estimateNumber}-R${newVersion}`;

	const revised = await prisma.estimate.create({
		data: {
			organizationId: existing.organizationId,
			customerId: existing.customerId,
			jobId: existing.jobId,
			estimateNumber: newEstimateNumber,
			version: newVersion,
			previousVersionId: existing.id,
			title: existing.title,
			description: existing.description,
			validUntil: existing.validUntil,
			subtotal: existing.subtotal,
			taxAmount: existing.taxAmount,
			totalAmount: existing.totalAmount,
			status: 'DRAFT',
			createdBy: userId
		}
	});

	// Copy lines
	for (const line of existing.lines) {
		await prisma.estimateLine.create({
			data: {
				estimateId: revised.id,
				lineNumber: line.lineNumber,
				description: line.description,
				quantity: line.quantity,
				unitPrice: line.unitPrice,
				lineTotal: line.lineTotal,
				pricebookItemId: line.pricebookItemId,
				isTaxable: line.isTaxable,
				taxRate: line.taxRate
			}
		});
	}

	// Mark original as revised
	await prisma.estimate.update({
		where: { id: estimateId },
		data: { status: 'REVISED' }
	});

	console.log(`[EstimateWorkflow] REVISE_ESTIMATE on estimate:${estimateId} -> ${revised.id} by user ${userId}`);
	return revised.id;
}

async function deleteEstimate(
	organizationId: string,
	userId: string,
	estimateId: string
): Promise<string> {
	await prisma.estimate.delete({ where: { id: estimateId } });

	console.log(`[EstimateWorkflow] DELETE_ESTIMATE on estimate:${estimateId} by user ${userId}`);
	return estimateId;
}

async function generateFromPricebook(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const jobId = data.jobId as string;
	const customerId = data.customerId as string;
	const pricebookItemIds = data.pricebookItemIds as string[];
	const title = data.title as string | undefined;
	const description = data.description as string | undefined;
	const validUntil = data.validUntil as string | undefined;
	const defaultTaxRate = (data.defaultTaxRate as number) ?? 0;

	// Get pricebook items
	const pricebookItems = await prisma.pricebookItem.findMany({
		where: { id: { in: pricebookItemIds } }
	});

	// Generate estimate number
	const year = new Date().getFullYear();
	const lastEstimate = await prisma.estimate.findFirst({
		where: { organizationId, estimateNumber: { startsWith: `EST-${year}-` } },
		orderBy: { createdAt: 'desc' }
	});
	const seq = lastEstimate ? parseInt((lastEstimate.estimateNumber.split('-')[2] ?? '0'), 10) + 1 : 1;
	const estimateNumber = `EST-${year}-${String(seq).padStart(6, '0')}`;

	const linesWithTotals = pricebookItems.map((item, idx) => ({
		lineNumber: idx + 1,
		description: `${item.name}${item.description ? ` - ${item.description}` : ''}`,
		quantity: 1,
		unitPrice: Number(item.basePrice),
		lineTotal: Number(item.basePrice),
		pricebookItemId: item.id,
		isTaxable: item.isTaxable,
		taxRate: defaultTaxRate
	}));

	let subtotal = 0;
	let taxAmount = 0;
	for (const line of linesWithTotals) {
		subtotal += line.lineTotal;
		if (line.isTaxable) {
			taxAmount += line.lineTotal * (line.taxRate / 100);
		}
	}
	const totalAmount = subtotal + taxAmount;

	const estimate = await prisma.$transaction(async (tx) => {
		const est = await tx.estimate.create({
			data: {
				organizationId,
				jobId,
				customerId,
				estimateNumber,
				title: title ?? 'Estimate',
				description,
				validUntil: validUntil ? new Date(validUntil) : null,
				subtotal,
				taxAmount,
				totalAmount,
				createdBy: userId
			}
		});

		if (linesWithTotals.length > 0) {
			await tx.estimateLine.createMany({
				data: linesWithTotals.map((line) => ({
					estimateId: est.id,
					...line
				}))
			});
		}

		return est;
	});

	console.log(`[EstimateWorkflow] GENERATE_FROM_PRICEBOOK estimate:${estimate.id} by user ${userId}`);
	return estimate.id;
}

async function recalculateEstimateTotals(estimateId: string): Promise<void> {
	const lines = await prisma.estimateLine.findMany({ where: { estimateId } });

	let subtotal = 0;
	let taxAmount = 0;

	for (const line of lines) {
		subtotal += Number(line.lineTotal);
		if (line.isTaxable) {
			taxAmount += Number(line.lineTotal) * (Number(line.taxRate) / 100);
		}
	}

	const totalAmount = subtotal + taxAmount;

	await prisma.estimate.update({
		where: { id: estimateId },
		data: { subtotal, taxAmount, totalAmount }
	});
}

// Main workflow function
async function estimateWorkflow(input: EstimateWorkflowInput): Promise<EstimateWorkflowResult> {
	try {
		let entityId: string | undefined;

		switch (input.action) {
			case 'UPDATE_ESTIMATE':
				entityId = await DBOS.runStep(
					() => updateEstimate(input.organizationId, input.userId, input.estimateId!, input.data),
					{ name: 'updateEstimate' }
				);
				break;

			case 'ADD_LINE':
				entityId = await DBOS.runStep(
					() => addLine(input.organizationId, input.userId, input.estimateId!, input.data),
					{ name: 'addLine' }
				);
				break;

			case 'REMOVE_LINE':
				entityId = await DBOS.runStep(
					() => removeLine(input.organizationId, input.userId, input.estimateId!, input.lineId!),
					{ name: 'removeLine' }
				);
				break;

			case 'SEND_ESTIMATE':
				entityId = await DBOS.runStep(
					() => sendEstimate(input.organizationId, input.userId, input.estimateId!),
					{ name: 'sendEstimate' }
				);
				break;

			case 'ACCEPT_ESTIMATE':
				entityId = await DBOS.runStep(
					() => acceptEstimate(input.organizationId, input.userId, input.estimateId!, input.data),
					{ name: 'acceptEstimate' }
				);
				break;

			case 'DECLINE_ESTIMATE':
				entityId = await DBOS.runStep(
					() => declineEstimate(input.organizationId, input.userId, input.estimateId!),
					{ name: 'declineEstimate' }
				);
				break;

			case 'REVISE_ESTIMATE':
				entityId = await DBOS.runStep(
					() => reviseEstimate(input.organizationId, input.userId, input.estimateId!),
					{ name: 'reviseEstimate' }
				);
				break;

			case 'DELETE_ESTIMATE':
				entityId = await DBOS.runStep(
					() => deleteEstimate(input.organizationId, input.userId, input.estimateId!),
					{ name: 'deleteEstimate' }
				);
				break;

			case 'GENERATE_FROM_PRICEBOOK':
				entityId = await DBOS.runStep(
					() => generateFromPricebook(input.organizationId, input.userId, input.data),
					{ name: 'generateFromPricebook' }
				);
				break;

			default:
				return { success: false, error: `Unknown action: ${input.action}` };
		}

		return { success: true, entityId };
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;
		console.error(`[EstimateWorkflow] Error in ${input.action}:`, errorMessage);

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'ESTIMATE_WORKFLOW_ERROR'
		});

		return { success: false, error: errorMessage };
	}
}

export const estimateWorkflow_v1 = DBOS.registerWorkflow(estimateWorkflow);

export async function startEstimateWorkflow(
	input: EstimateWorkflowInput,
	idempotencyKey?: string
): Promise<EstimateWorkflowResult> {
	const workflowId = idempotencyKey || `estimate-${input.action}-${input.estimateId || 'new'}-${Date.now()}`;
	const handle = await DBOS.startWorkflow(estimateWorkflow_v1, { workflowID: workflowId })(input);
	return handle.getResult();
}
