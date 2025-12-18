/**
 * Invoice Payment Workflow (v1)
 *
 * DBOS durable workflow for invoice creation and payment processing.
 * Handles: invoice creation, payment intent (stub), receipts.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import type { JobInvoiceStatus } from '../../../../generated/prisma/client.js';

const WORKFLOW_STATUS_EVENT = 'invoice_status';
const WORKFLOW_ERROR_EVENT = 'invoice_error';

const validTransitions: Record<JobInvoiceStatus, JobInvoiceStatus[]> = {
	DRAFT: ['SENT', 'VOID'],
	SENT: ['VIEWED', 'PARTIAL', 'PAID', 'OVERDUE', 'VOID'],
	VIEWED: ['PARTIAL', 'PAID', 'OVERDUE', 'VOID'],
	PARTIAL: ['PAID', 'OVERDUE', 'VOID'],
	PAID: ['REFUNDED'],
	OVERDUE: ['PARTIAL', 'PAID', 'VOID'],
	VOID: [],
	REFUNDED: []
};

interface InvoicePaymentInput {
	invoiceId: string;
	toStatus: JobInvoiceStatus;
	userId: string;
	notes?: string;
	paymentAmount?: number;
	paymentMethod?: string;
	paymentReference?: string;
}

interface InvoicePaymentResult {
	success: boolean;
	invoiceId: string;
	fromStatus: JobInvoiceStatus;
	toStatus: JobInvoiceStatus;
	timestamp: string;
	paymentId?: string;
	error?: string;
}

async function validateInvoiceTransition(input: InvoicePaymentInput): Promise<{
	valid: boolean;
	currentStatus: JobInvoiceStatus;
	organizationId?: string;
	amountDue?: number;
	error?: string;
}> {
	const invoice = await prisma.jobInvoice.findUnique({
		where: { id: input.invoiceId },
		select: { status: true, organizationId: true, totalAmount: true, amountPaid: true }
	});

	if (!invoice) {
		return { valid: false, currentStatus: 'DRAFT', error: 'Invoice not found' };
	}

	const currentStatus = invoice.status as JobInvoiceStatus;
	const allowedTransitions = validTransitions[currentStatus] || [];

	if (!allowedTransitions.includes(input.toStatus)) {
		return {
			valid: false,
			currentStatus,
			organizationId: invoice.organizationId,
			error: `Invalid transition from ${currentStatus} to ${input.toStatus}`
		};
	}

	const amountDue = Number(invoice.totalAmount) - Number(invoice.amountPaid);

	// Validate payment amount for payment transitions
	if (['PARTIAL', 'PAID'].includes(input.toStatus)) {
		if (!input.paymentAmount || input.paymentAmount <= 0) {
			return {
				valid: false,
				currentStatus,
				organizationId: invoice.organizationId,
				amountDue,
				error: 'Payment amount is required'
			};
		}

		if (input.toStatus === 'PAID' && input.paymentAmount < amountDue) {
			return {
				valid: false,
				currentStatus,
				organizationId: invoice.organizationId,
				amountDue,
				error: `Payment amount ${input.paymentAmount} is less than amount due ${amountDue}`
			};
		}
	}

	return { valid: true, currentStatus, organizationId: invoice.organizationId, amountDue };
}

async function updateInvoiceStatus(
	input: InvoicePaymentInput,
	fromStatus: JobInvoiceStatus
): Promise<string | undefined> {
	let paymentId: string | undefined;

	await prisma.$transaction(async (tx) => {
		const updateData: Record<string, unknown> = {
			status: input.toStatus
		};

		switch (input.toStatus) {
			case 'SENT':
				updateData.sentAt = new Date();
				break;

			case 'VIEWED':
				updateData.viewedAt = new Date();
				break;

			case 'PARTIAL':
			case 'PAID':
				if (input.paymentAmount) {
					// Get invoice details for payment
					const invoiceDetails = await tx.jobInvoice.findUnique({
						where: { id: input.invoiceId },
						select: { organizationId: true, customerId: true, amountPaid: true, totalAmount: true }
					});
					
					// Create payment intent record
					const payment = await tx.paymentIntent.create({
						data: {
							organizationId: invoiceDetails!.organizationId,
							invoiceId: input.invoiceId,
							customerId: invoiceDetails!.customerId,
							amount: input.paymentAmount,
							status: 'SUCCEEDED',
							processedAt: new Date()
						}
					});
					paymentId = payment.id;

					// Update paid amount
					const newAmountPaid = Number(invoiceDetails?.amountPaid ?? 0) + input.paymentAmount;
					updateData.amountPaid = newAmountPaid;
					updateData.balanceDue = Number(invoiceDetails?.totalAmount ?? 0) - newAmountPaid;

					if (input.toStatus === 'PAID') {
						updateData.paidAt = new Date();
					}
				}
				break;

			case 'VOID':
				// VOID status - no additional fields needed
				break;

			case 'REFUNDED':
				// REFUNDED status - no additional fields needed
				break;
		}

		await tx.jobInvoice.update({
			where: { id: input.invoiceId },
			data: updateData
		});

		console.log(`[InvoiceWorkflow] Status changed from ${fromStatus} to ${input.toStatus}`);
	});

	return paymentId;
}

async function processPaymentIntent(
	invoiceId: string,
	amount: number,
	method: string
): Promise<{ success: boolean; transactionId?: string }> {
	// Stub implementation - in production would integrate with payment processor
	console.log(`[InvoiceWorkflow] Processing payment intent: invoice=${invoiceId}, amount=${amount}, method=${method}`);
	
	// Simulate successful payment
	return {
		success: true,
		transactionId: `txn_${Date.now()}`
	};
}

async function generateReceipt(invoiceId: string, paymentId: string): Promise<void> {
	// Stub implementation - in production would generate PDF receipt
	console.log(`[InvoiceWorkflow] Generating receipt for invoice ${invoiceId}, payment ${paymentId}`);
}

async function queueInvoiceNotifications(
	invoiceId: string,
	fromStatus: JobInvoiceStatus,
	toStatus: JobInvoiceStatus,
	userId: string
): Promise<void> {
	console.log(`[InvoiceWorkflow] Notification queued: Invoice ${invoiceId} transitioned from ${fromStatus} to ${toStatus} by user ${userId}`);
}

async function invoicePaymentWorkflow(input: InvoicePaymentInput): Promise<InvoicePaymentResult> {
	const workflowId = DBOS.workflowID;

	try {
		const validation = await DBOS.runStep(
			() => validateInvoiceTransition(input),
			{ name: 'validateInvoiceTransition' }
		);
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'validated', ...validation });

		if (!validation.valid) {
			return {
				success: false,
				invoiceId: input.invoiceId,
				fromStatus: validation.currentStatus,
				toStatus: input.toStatus,
				timestamp: new Date().toISOString(),
				error: validation.error
			};
		}

		// Process payment if applicable
		if (['PARTIAL', 'PAID'].includes(input.toStatus) && input.paymentAmount) {
			const paymentResult = await DBOS.runStep(
				() => processPaymentIntent(input.invoiceId, input.paymentAmount!, input.paymentMethod ?? 'OTHER'),
				{ name: 'processPaymentIntent' }
			);
			await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'payment_processed', ...paymentResult });

			if (!paymentResult.success) {
				return {
					success: false,
					invoiceId: input.invoiceId,
					fromStatus: validation.currentStatus,
					toStatus: input.toStatus,
					timestamp: new Date().toISOString(),
					error: 'Payment processing failed'
				};
			}
		}

		const paymentId = await DBOS.runStep(
			() => updateInvoiceStatus(input, validation.currentStatus),
			{ name: 'updateInvoiceStatus' }
		);
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'updated', status: input.toStatus });

		// Generate receipt if payment was made
		if (paymentId) {
			await DBOS.runStep(
				() => generateReceipt(input.invoiceId, paymentId),
				{ name: 'generateReceipt' }
			);
			await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'receipt_generated' });
		}

		await DBOS.runStep(
			() => queueInvoiceNotifications(input.invoiceId, validation.currentStatus, input.toStatus, input.userId),
			{ name: 'queueInvoiceNotifications' }
		);
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'notifications_queued' });

		return {
			success: true,
			invoiceId: input.invoiceId,
			fromStatus: validation.currentStatus,
			toStatus: input.toStatus,
			timestamp: new Date().toISOString(),
			paymentId
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		return {
			success: false,
			invoiceId: input.invoiceId,
			fromStatus: 'DRAFT',
			toStatus: input.toStatus,
			timestamp: new Date().toISOString(),
			error: errorMessage
		};
	}
}

export const invoicePayment_v1 = DBOS.registerWorkflow(invoicePaymentWorkflow);

export async function startInvoicePayment(
	input: InvoicePaymentInput,
	workflowId?: string
): Promise<{ workflowId: string }> {
	const id = workflowId || `invoice-payment-${input.invoiceId}-${Date.now()}`;
	await DBOS.startWorkflow(invoicePayment_v1, { workflowID: id })(input);
	return { workflowId: id };
}

export async function getInvoicePaymentStatus(
	workflowId: string
): Promise<{ step: string; [key: string]: unknown } | null> {
	const status = await DBOS.getEvent(workflowId, WORKFLOW_STATUS_EVENT, 0);
	return status as { step: string; [key: string]: unknown } | null;
}

export async function getInvoicePaymentError(
	workflowId: string
): Promise<{ error: string } | null> {
	const error = await DBOS.getEvent(workflowId, WORKFLOW_ERROR_EVENT, 0);
	return error as { error: string } | null;
}

export type { InvoicePaymentInput, InvoicePaymentResult };
