/**
 * Invoice Create Workflow (v1)
 *
 * DBOS durable workflow for creating invoices.
 * Provides idempotency, durability, and trace correlation for invoice creation.
 *
 * This is separate from invoicePayment_v1 which handles payment processing.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import type { JobInvoiceStatus } from '../../../../generated/prisma/client.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';
import { type BaseWorkflowResult } from './schemas.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger } from './workflowLogger.js';

const log = createWorkflowLogger('InvoiceCreateWorkflow');

const WORKFLOW_STATUS_EVENT = 'invoice_create_status';
const WORKFLOW_ERROR_EVENT = 'invoice_create_error';

export interface InvoiceLine {
	description: string;
	quantity: number;
	unitPrice: number;
	pricebookItemId?: string;
	isTaxable?: boolean;
	taxRate?: number;
}

export interface InvoiceCreateInput {
	organizationId: string;
	userId: string;
	jobId: string;
	customerId: string;
	dueDate?: string;
	notes?: string;
	terms?: string;
	discount?: number;
	lines?: InvoiceLine[];
}

export interface InvoiceCreateResult extends BaseWorkflowResult {
	invoiceId?: string;
	invoiceNumber?: string;
	status?: JobInvoiceStatus;
	timestamp: string;
}

async function generateInvoiceNumber(organizationId: string): Promise<string> {
	const year = new Date().getFullYear();
	const prefix = `INV-${year}-`;
	const count = await prisma.jobInvoice.count({
		where: {
			organizationId,
			invoiceNumber: { startsWith: prefix }
		}
	});
	return `${prefix}${String(count + 1).padStart(6, '0')}`;
}

function recalculateInvoiceTotals(
	lines: Array<{ quantity: number; unitPrice: number; isTaxable?: boolean; taxRate?: number }>,
	discount?: number
): { subtotal: number; taxAmount: number; totalAmount: number } {
	let subtotal = 0;
	let taxAmount = 0;

	for (const line of lines) {
		const lineTotal = line.quantity * line.unitPrice;
		subtotal += lineTotal;
		if (line.isTaxable && line.taxRate) {
			taxAmount += lineTotal * (line.taxRate / 100);
		}
	}

	const discountAmount = discount ?? 0;
	const totalAmount = subtotal - discountAmount + taxAmount;

	return { subtotal, taxAmount, totalAmount };
}

async function createInvoice(input: InvoiceCreateInput): Promise<{
	id: string;
	invoiceNumber: string;
	status: JobInvoiceStatus;
}> {
	const invoiceNumber = await generateInvoiceNumber(input.organizationId);

	const invoice = await prisma.$transaction(async (tx) => {
		// Calculate line totals
		const linesWithTotals = (input.lines ?? []).map((line, idx) => ({
			...line,
			lineNumber: idx + 1,
			lineTotal: line.quantity * line.unitPrice
		}));

		const { subtotal, taxAmount, totalAmount } = recalculateInvoiceTotals(
			linesWithTotals,
			input.discount
		);

		const createdInvoice = await tx.jobInvoice.create({
			data: {
				organizationId: input.organizationId,
				jobId: input.jobId,
				customerId: input.customerId,
				invoiceNumber,
				dueDate: input.dueDate ? new Date(input.dueDate) : null,
				subtotal,
				taxAmount,
				discount: input.discount ?? 0,
				totalAmount,
				balanceDue: totalAmount,
				notes: input.notes,
				terms: input.terms,
				createdBy: input.userId
			}
		});

		// Create lines
		if (linesWithTotals.length > 0) {
			await tx.invoiceLine.createMany({
				data: linesWithTotals.map((line) => ({
					invoiceId: createdInvoice.id,
					lineNumber: line.lineNumber,
					description: line.description,
					quantity: line.quantity,
					unitPrice: line.unitPrice,
					lineTotal: line.lineTotal,
					pricebookItemId: line.pricebookItemId,
					isTaxable: line.isTaxable,
					taxRate: line.taxRate
				}))
			});
		}

		// Phase 15: Auto-transition job to INVOICED if in COMPLETED
		const job = await tx.job.findUnique({ where: { id: input.jobId } });
		if (job && job.status === 'COMPLETED') {
			await tx.job.update({
				where: { id: input.jobId },
				data: { status: 'INVOICED', invoicedAt: new Date() }
			});
			await tx.jobStatusHistory.create({
				data: {
					jobId: input.jobId,
					fromStatus: 'COMPLETED',
					toStatus: 'INVOICED',
					changedBy: input.userId,
					notes: `Auto-transitioned: Invoice ${createdInvoice.invoiceNumber} created`
				}
			});
		}

		return createdInvoice;
	});

	// Record activity event
	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: 'INVOICE',
		entityId: invoice.id,
		action: 'CREATE',
		eventCategory: 'EXECUTION',
		summary: `Invoice created: ${invoice.invoiceNumber}`,
		performedById: input.userId,
		performedByType: 'HUMAN',
		workflowId: 'invoiceCreateWorkflow_v1',
		workflowStep: 'CREATE_INVOICE',
		workflowVersion: 'v1',
		jobId: input.jobId,
		newState: {
			invoiceNumber: invoice.invoiceNumber,
			status: invoice.status
		}
	});

	return {
		id: invoice.id,
		invoiceNumber: invoice.invoiceNumber,
		status: invoice.status as JobInvoiceStatus
	};
}

async function invoiceCreateWorkflow(input: InvoiceCreateInput): Promise<InvoiceCreateResult> {
	try {
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'started' });

		const result = await DBOS.runStep(() => createInvoice(input), { name: 'createInvoice' });

		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, {
			step: 'completed',
			invoiceId: result.id,
			invoiceNumber: result.invoiceNumber
		});

		return {
			success: true,
			invoiceId: result.id,
			invoiceNumber: result.invoiceNumber,
			status: result.status,
			timestamp: new Date().toISOString()
		};
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;
		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'INVOICE_CREATE_WORKFLOW_ERROR'
		});

		return {
			success: false,
			timestamp: new Date().toISOString(),
			error: errorMessage
		};
	}
}

export const invoiceCreateWorkflow_v1 = DBOS.registerWorkflow(invoiceCreateWorkflow);

export async function startInvoiceCreateWorkflow(
	input: InvoiceCreateInput,
	workflowId: string
): Promise<InvoiceCreateResult> {
	const handle = await DBOS.startWorkflow(invoiceCreateWorkflow_v1, {
		workflowID: workflowId
	})(input);

	return handle.getResult();
}

export async function getInvoiceCreateWorkflowStatus(
	workflowId: string
): Promise<{ step: string;[key: string]: unknown } | null> {
	const status = await DBOS.getEvent(workflowId, WORKFLOW_STATUS_EVENT, 0);
	return status as { step: string;[key: string]: unknown } | null;
}

