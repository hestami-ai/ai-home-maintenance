/**
 * Estimate Workflow (v1)
 *
 * DBOS durable workflow for managing estimate operations.
 * Handles: generate, update, addLine, removeLine, send, accept, decline, revise, delete.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { orgTransaction } from '../db/rls.js';
import { type EntityWorkflowResult } from './schemas.js';
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
	MARK_VIEWED: 'MARK_VIEWED',
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

	await orgTransaction(organizationId, async (tx) => {
		await tx.estimate.update({
			where: { id: estimateId },
			data: updateData
		});
	}, { userId, reason: 'UPDATE_ESTIMATE' });

	log.info('UPDATE_ESTIMATE completed', { estimateId, userId });
	return estimateId;
}

async function addLine(
	organizationId: string,
	userId: string,
	estimateId: string,
	data: Record<string, unknown>
): Promise<string> {
	await orgTransaction(organizationId, async (tx) => {
		await tx.estimateLine.create({
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

		// Recalculate estimate totals within same transaction
		const lines = await tx.estimateLine.findMany({ where: { estimateId } });

		let subtotal = 0;
		let taxAmount = 0;

		for (const line of lines) {
			subtotal += Number(line.lineTotal);
			if (line.isTaxable) {
				taxAmount += Number(line.lineTotal) * (Number(line.taxRate) / 100);
			}
		}

		const totalAmount = subtotal + taxAmount;

		await tx.estimate.update({
			where: { id: estimateId },
			data: { subtotal, taxAmount, totalAmount }
		});
	}, { userId, reason: 'ADD_LINE' });

	log.info('ADD_LINE completed', { estimateId, userId });
	return estimateId;
}

async function removeLine(
	organizationId: string,
	userId: string,
	estimateId: string,
	lineId: string
): Promise<string> {
	await orgTransaction(organizationId, async (tx) => {
		await tx.estimateLine.delete({ where: { id: lineId } });

		// Recalculate estimate totals within same transaction
		const lines = await tx.estimateLine.findMany({ where: { estimateId } });

		let subtotal = 0;
		let taxAmount = 0;

		for (const line of lines) {
			subtotal += Number(line.lineTotal);
			if (line.isTaxable) {
				taxAmount += Number(line.lineTotal) * (Number(line.taxRate) / 100);
			}
		}

		const totalAmount = subtotal + taxAmount;

		await tx.estimate.update({
			where: { id: estimateId },
			data: { subtotal, taxAmount, totalAmount }
		});
	}, { userId, reason: 'REMOVE_LINE' });

	log.info('REMOVE_LINE completed', { estimateId, userId });
	return estimateId;
}

async function sendEstimate(
	organizationId: string,
	userId: string,
	estimateId: string
): Promise<string> {
	await orgTransaction(organizationId, async (tx) => {
		await tx.estimate.update({
			where: { id: estimateId },
			data: {
				status: 'SENT',
				sentAt: new Date()
			}
		});
	}, { userId, reason: 'SEND_ESTIMATE' });

	log.info('SEND_ESTIMATE completed', { estimateId, userId });
	return estimateId;
}

async function markViewed(
	organizationId: string,
	userId: string,
	estimateId: string
): Promise<string> {
	await orgTransaction(organizationId, async (tx) => {
		await tx.estimate.update({
			where: { id: estimateId },
			data: {
				status: 'VIEWED',
				viewedAt: new Date()
			}
		});
	}, { userId, reason: 'MARK_VIEWED' });

	log.info('MARK_VIEWED completed', { estimateId, userId });
	return estimateId;
}

async function acceptEstimate(
	organizationId: string,
	userId: string,
	estimateId: string,
	data: Record<string, unknown>
): Promise<string> {
	await orgTransaction(organizationId, async (tx) => {
		await tx.estimate.update({
			where: { id: estimateId },
			data: {
				status: 'ACCEPTED',
				acceptedAt: new Date()
			}
		});
	}, { userId, reason: 'ACCEPT_ESTIMATE' });

	log.info('ACCEPT_ESTIMATE completed', { estimateId, userId });
	return estimateId;
}

async function declineEstimate(
	organizationId: string,
	userId: string,
	estimateId: string
): Promise<string> {
	await orgTransaction(organizationId, async (tx) => {
		await tx.estimate.update({
			where: { id: estimateId },
			data: {
				status: 'DECLINED',
				declinedAt: new Date()
			}
		});
	}, { userId, reason: 'DECLINE_ESTIMATE' });

	log.info('DECLINE_ESTIMATE completed', { estimateId, userId });
	return estimateId;
}

async function reviseEstimate(
	organizationId: string,
	userId: string,
	estimateId: string
): Promise<string> {
	const revisedId = await orgTransaction(organizationId, async (tx) => {
		const existing = await tx.estimate.findUniqueOrThrow({
			where: { id: estimateId },
			include: { lines: true, options: { include: { lines: true } } }
		});

		// Create new revision
		const newVersion = (existing.version ?? 1) + 1;
		const newEstimateNumber = `${existing.estimateNumber}-R${newVersion}`;

		const revised = await tx.estimate.create({
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
			await tx.estimateLine.create({
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
		await tx.estimate.update({
			where: { id: estimateId },
			data: { status: 'REVISED' }
		});

		return revised.id;
	}, { userId, reason: 'REVISE_ESTIMATE' });

	log.info('REVISE_ESTIMATE completed', { estimateId, revisedId, userId });
	return revisedId;
}

async function deleteEstimate(
	organizationId: string,
	userId: string,
	estimateId: string
): Promise<string> {
	await orgTransaction(organizationId, async (tx) => {
		await tx.estimate.delete({ where: { id: estimateId } });
	}, { userId, reason: 'DELETE_ESTIMATE' });

	log.info('DELETE_ESTIMATE completed', { estimateId, userId });
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

	const estimateId = await orgTransaction(organizationId, async (tx) => {
		// Get pricebook items
		const pricebookItems = await tx.pricebookItem.findMany({
			where: { id: { in: pricebookItemIds } }
		});

		// Generate estimate number
		const year = new Date().getFullYear();
		const lastEstimate = await tx.estimate.findFirst({
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

		return est.id;
	}, { userId, reason: 'GENERATE_FROM_PRICEBOOK' });

	log.info('GENERATE_FROM_PRICEBOOK completed', { estimateId, userId });
	return estimateId;
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

			case 'MARK_VIEWED':
				entityId = await DBOS.runStep(
					() => markViewed(input.organizationId, input.userId, input.estimateId!),
					{ name: 'markViewed' }
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
		log.error(`Error in ${input.action}`, { action: input.action, error: errorMessage });

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
	idempotencyKey: string
): Promise<EstimateWorkflowResult> {
	const workflowId = idempotencyKey || `estimate-${input.action}-${input.estimateId || 'new'}-${Date.now()}`;
	const handle = await DBOS.startWorkflow(estimateWorkflow_v1, { workflowID: idempotencyKey})(input);
	return handle.getResult();
}
