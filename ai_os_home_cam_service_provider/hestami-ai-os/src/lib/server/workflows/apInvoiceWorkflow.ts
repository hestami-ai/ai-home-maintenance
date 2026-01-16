/**
 * AP Invoice Workflow (v1)
 *
 * DBOS durable workflow for AP Invoice management.
 * Handles: create, approve, and void operations.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { orgTransaction } from '../db/rls.js';
import type { EntityWorkflowResult } from './schemas.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger, logWorkflowStart, logWorkflowEnd, logStepError } from './workflowLogger.js';

const WORKFLOW_STATUS_EVENT = 'ap_invoice_workflow_status';
const WORKFLOW_ERROR_EVENT = 'ap_invoice_workflow_error';

// Action types for AP invoice operations
export const APInvoiceAction = {
	CREATE: 'CREATE',
	APPROVE: 'APPROVE',
	VOID: 'VOID'
} as const;

export type APInvoiceAction = (typeof APInvoiceAction)[keyof typeof APInvoiceAction];

export interface APInvoiceLineInput {
	description: string;
	quantity: number;
	unitPrice: number;
	glAccountId: string;
}

export interface APInvoiceWorkflowInput {
	action: APInvoiceAction;
	organizationId: string;
	userId: string;
	// CREATE fields
	associationId?: string;
	vendorId?: string;
	invoiceNumber?: string;
	invoiceDate?: string;
	dueDate?: string;
	description?: string | null;
	memo?: string | null;
	lines?: APInvoiceLineInput[];
	workOrderId?: string | null;
	// APPROVE/VOID fields
	invoiceId?: string;
}

export interface APInvoiceWorkflowResult extends EntityWorkflowResult {
	invoiceId?: string;
	invoiceNumber?: string;
	vendorName?: string;
	totalAmount?: string;
	status?: string;
	approvedAt?: string;
	[key: string]: unknown;
}

// Step functions

async function createAPInvoice(
	input: APInvoiceWorkflowInput
): Promise<{ id: string; invoiceNumber: string; vendorName: string; totalAmount: string; status: string }> {
	const subtotal = input.lines!.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
	const totalAmount = subtotal;

	const invoice = await orgTransaction(input.organizationId, async (tx) => {
		return tx.aPInvoice.create({
			data: {
				associationId: input.associationId!,
				vendorId: input.vendorId!,
				invoiceNumber: input.invoiceNumber!,
				invoiceDate: new Date(input.invoiceDate!),
				dueDate: new Date(input.dueDate!),
				description: input.description,
				memo: input.memo,
				subtotal,
				totalAmount,
				balanceDue: totalAmount,
				workOrderId: input.workOrderId,
				status: 'DRAFT',
				lineItems: {
					create: input.lines!.map((line, index) => ({
						description: line.description,
						quantity: line.quantity,
						unitPrice: line.unitPrice,
						amount: line.quantity * line.unitPrice,
						glAccountId: line.glAccountId,
						lineNumber: index + 1
					}))
				}
			},
			include: { vendor: true }
		});
	}, { userId: input.userId, reason: 'Create AP invoice with line items' });

	// Record activity event
	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: 'INVOICE',
		entityId: invoice.id,
		action: 'CREATE',
		eventCategory: 'EXECUTION',
		summary: `AP Invoice created: ${invoice.invoiceNumber}`,
		performedById: input.userId,
		performedByType: 'HUMAN',
		workflowId: 'apInvoiceWorkflow_v1',
		workflowStep: 'CREATE',
		workflowVersion: 'v1',
		newState: { invoiceNumber: invoice.invoiceNumber, vendorName: invoice.vendor.name, totalAmount: totalAmount.toString() }
	});

	return {
		id: invoice.id,
		invoiceNumber: invoice.invoiceNumber,
		vendorName: invoice.vendor.name,
		totalAmount: invoice.totalAmount.toString(),
		status: invoice.status
	};
}

async function approveAPInvoice(
	invoiceId: string,
	userId: string,
	organizationId: string
): Promise<{ id: string; status: string; approvedAt: string }> {
	const now = new Date();

	await orgTransaction(organizationId, async (tx) => {
		return tx.aPInvoice.update({
			where: { id: invoiceId },
			data: {
				status: 'APPROVED',
				approvedBy: userId,
				approvedAt: now
			}
		});
	}, { userId, reason: 'Approve AP invoice' });

	// Record activity event
	await recordWorkflowEvent({
		organizationId,
		entityType: 'INVOICE',
		entityId: invoiceId,
		action: 'UPDATE',
		eventCategory: 'EXECUTION',
		summary: `AP Invoice approved`,
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'apInvoiceWorkflow_v1',
		workflowStep: 'APPROVE',
		workflowVersion: 'v1',
		newState: { status: 'APPROVED', approvedAt: now.toISOString() }
	});

	return {
		id: invoiceId,
		status: 'APPROVED',
		approvedAt: now.toISOString()
	};
}

async function voidAPInvoice(
	invoiceId: string,
	userId: string,
	organizationId: string
): Promise<{ success: boolean }> {
	await orgTransaction(organizationId, async (tx) => {
		return tx.aPInvoice.update({
			where: { id: invoiceId },
			data: { status: 'VOIDED' }
		});
	}, { userId, reason: 'Void AP invoice' });

	// Record activity event
	await recordWorkflowEvent({
		organizationId,
		entityType: 'INVOICE',
		entityId: invoiceId,
		action: 'UPDATE',
		eventCategory: 'EXECUTION',
		summary: `AP Invoice voided`,
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'apInvoiceWorkflow_v1',
		workflowStep: 'VOID',
		workflowVersion: 'v1',
		newState: { status: 'VOIDED' }
	});

	return { success: true };
}

// Main workflow function

async function apInvoiceWorkflow(input: APInvoiceWorkflowInput): Promise<APInvoiceWorkflowResult> {
	const workflowName = 'apInvoiceWorkflow_v1';
	const log = createWorkflowLogger(workflowName, DBOS.workflowID, input.action);
	const startTime = logWorkflowStart(log, input.action, {
		organizationId: input.organizationId,
		userId: input.userId,
		invoiceId: input.invoiceId
	}, workflowName, DBOS.workflowID);

	try {
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'started', action: input.action });

		switch (input.action) {
			case 'CREATE': {
				if (!input.associationId || !input.vendorId || !input.invoiceNumber || !input.invoiceDate || !input.dueDate || !input.lines) {
					const error = new Error('Missing required fields for CREATE: associationId, vendorId, invoiceNumber, invoiceDate, dueDate, lines');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: createAPInvoice starting', { invoiceNumber: input.invoiceNumber });
				const result = await DBOS.runStep(
					() => createAPInvoice(input),
					{ name: 'createAPInvoice' }
				);
				log.info('Step: createAPInvoice completed', { invoiceId: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'invoice_created', ...result });
				const successResult: APInvoiceWorkflowResult = {
					success: true,
					entityId: result.id,
					invoiceId: result.id,
					invoiceNumber: result.invoiceNumber,
					vendorName: result.vendorName,
					totalAmount: result.totalAmount,
					status: result.status
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'APPROVE': {
				if (!input.invoiceId) {
					const error = new Error('Missing required field: invoiceId for APPROVE');
					logStepError(log, 'validation', error, { invoiceId: input.invoiceId });
					throw error;
				}
				log.debug('Step: approveAPInvoice starting', { invoiceId: input.invoiceId });
				const result = await DBOS.runStep(
					() => approveAPInvoice(input.invoiceId!, input.userId, input.organizationId),
					{ name: 'approveAPInvoice' }
				);
				log.info('Step: approveAPInvoice completed', { invoiceId: result.id, approvedAt: result.approvedAt });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'invoice_approved', ...result });
				const successResult: APInvoiceWorkflowResult = {
					success: true,
					entityId: result.id,
					invoiceId: result.id,
					status: result.status,
					approvedAt: result.approvedAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'VOID': {
				if (!input.invoiceId) {
					const error = new Error('Missing required field: invoiceId for VOID');
					logStepError(log, 'validation', error, { invoiceId: input.invoiceId });
					throw error;
				}
				log.debug('Step: voidAPInvoice starting', { invoiceId: input.invoiceId });
				const result = await DBOS.runStep(
					() => voidAPInvoice(input.invoiceId!, input.userId, input.organizationId),
					{ name: 'voidAPInvoice' }
				);
				log.info('Step: voidAPInvoice completed', { invoiceId: input.invoiceId });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'invoice_voided', invoiceId: input.invoiceId });
				const successResult: APInvoiceWorkflowResult = {
					success: true,
					entityId: input.invoiceId,
					invoiceId: input.invoiceId,
					status: 'VOIDED'
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			default: {
				const errorResult: APInvoiceWorkflowResult = {
					success: false,
					error: `Unknown action: ${input.action}`
				};
				log.warn('Unknown workflow action', { action: input.action });
				logWorkflowEnd(log, input.action, false, startTime, errorResult);
				return errorResult;
			}
		}
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;

		log.error('Workflow failed', {
			action: input.action,
			invoiceId: input.invoiceId,
			error: errorMessage,
			stack: errorObj.stack
		});

		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'AP_INVOICE_WORKFLOW_ERROR'
		});
		const errorResult: APInvoiceWorkflowResult = {
			success: false,
			error: errorMessage
		};
		logWorkflowEnd(log, input.action, false, startTime, errorResult);
		return errorResult;
	}
}

export const apInvoiceWorkflow_v1 = DBOS.registerWorkflow(apInvoiceWorkflow);

export async function startAPInvoiceWorkflow(
	input: APInvoiceWorkflowInput,
	idempotencyKey: string
): Promise<APInvoiceWorkflowResult> {
	const handle = await DBOS.startWorkflow(apInvoiceWorkflow_v1, { workflowID: idempotencyKey })(input);
	return handle.getResult();
}
