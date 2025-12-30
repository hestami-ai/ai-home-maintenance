/**
 * Billing Workflow (v1)
 *
 * DBOS durable workflow for billing operations (proposals, payments, estimates, invoices).
 * Provides idempotency, durability, and trace correlation.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import { orgTransaction, clearOrgContext } from '../db/rls.js';
import { EstimateStatus, InvoiceStatus, type EntityWorkflowResult } from './schemas.js';
import type { ProposalStatus, JobPaymentStatus, JobInvoiceStatus } from '../../../../generated/prisma/client.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger } from './workflowLogger.js';

const log = createWorkflowLogger('BillingWorkflow');

const WORKFLOW_STATUS_EVENT = 'billing_status';
const WORKFLOW_ERROR_EVENT = 'billing_error';

export const BillingAction = {
	// Proposal actions
	CREATE_PROPOSAL: 'CREATE_PROPOSAL',
	UPDATE_PROPOSAL: 'UPDATE_PROPOSAL',
	SEND_PROPOSAL: 'SEND_PROPOSAL',
	ACCEPT_PROPOSAL: 'ACCEPT_PROPOSAL',
	DECLINE_PROPOSAL: 'DECLINE_PROPOSAL',
	DELETE_PROPOSAL: 'DELETE_PROPOSAL',
	// Payment actions
	CREATE_PAYMENT_INTENT: 'CREATE_PAYMENT_INTENT',
	PROCESS_PAYMENT: 'PROCESS_PAYMENT',
	MARK_PAYMENT_FAILED: 'MARK_PAYMENT_FAILED',
	REFUND_PAYMENT: 'REFUND_PAYMENT',
	CANCEL_PAYMENT: 'CANCEL_PAYMENT',
	// Estimate actions
	UPDATE_ESTIMATE: 'UPDATE_ESTIMATE',
	ADD_ESTIMATE_LINE: 'ADD_ESTIMATE_LINE',
	REMOVE_ESTIMATE_LINE: 'REMOVE_ESTIMATE_LINE',
	SEND_ESTIMATE: 'SEND_ESTIMATE',
	ACCEPT_ESTIMATE: 'ACCEPT_ESTIMATE',
	DECLINE_ESTIMATE: 'DECLINE_ESTIMATE',
	// Invoice actions
	CREATE_INVOICE_FROM_ESTIMATE: 'CREATE_INVOICE_FROM_ESTIMATE',
	UPDATE_INVOICE: 'UPDATE_INVOICE',
	SEND_INVOICE: 'SEND_INVOICE',
	RECORD_INVOICE_PAYMENT: 'RECORD_INVOICE_PAYMENT',
	VOID_INVOICE: 'VOID_INVOICE',
	DELETE_INVOICE: 'DELETE_INVOICE'
} as const;

export type BillingAction = (typeof BillingAction)[keyof typeof BillingAction];

interface BillingWorkflowInput {
	action: BillingAction;
	organizationId: string;
	userId: string;
	entityId?: string;
	lineId?: string;
	data: Record<string, unknown>;
}

interface BillingWorkflowResult {
	success: boolean;
	action: BillingAction;
	entityId?: string;
	timestamp: string;
	error?: string;
}

// Proposal operations
async function createProposal(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<{ id: string }> {
	try {
		const proposal = await orgTransaction(organizationId, async (tx) => {
			return tx.proposal.create({
				data: {
					organizationId,
					customerId: data.customerId as string,
					estimateId: data.estimateId as string | undefined,
					proposalNumber: data.proposalNumber as string,
					title: data.title as string | undefined,
					coverLetter: data.coverLetter as string | undefined,
					terms: data.terms as string | undefined,
					status: 'DRAFT',
					validUntil: data.validUntil ? new Date(data.validUntil as string) : undefined,
					createdBy: userId
				}
			});
		}, { userId, reason: 'Creating proposal via workflow' });

		await recordWorkflowEvent({
			organizationId,
			entityType: 'JOB',
			entityId: proposal.id,
			action: 'CREATE',
			eventCategory: 'EXECUTION',
			summary: `Proposal created: ${proposal.title}`,
			performedById: userId,
			performedByType: 'HUMAN',
			workflowId: 'billingWorkflow_v1',
			workflowStep: 'CREATE_PROPOSAL',
			workflowVersion: 'v1'
		});

		log.info('CREATE_PROPOSAL completed', { proposalId: proposal.id, userId });
		return { id: proposal.id };
	} finally {
		await clearOrgContext(userId);
	}
}

async function updateProposalStatus(
	organizationId: string,
	userId: string,
	proposalId: string,
	status: ProposalStatus,
	step: string
): Promise<{ id: string }> {
	try {
		const proposal = await orgTransaction(organizationId, async (tx) => {
			return tx.proposal.update({
				where: { id: proposalId },
				data: { status }
			});
		}, { userId, reason: `Updating proposal status to ${status} via workflow` });

		await recordWorkflowEvent({
			organizationId,
			entityType: 'JOB',
			entityId: proposal.id,
			action: 'UPDATE',
			eventCategory: 'EXECUTION',
			summary: `Proposal ${status.toLowerCase()}`,
			performedById: userId,
			performedByType: 'HUMAN',
			workflowId: 'billingWorkflow_v1',
			workflowStep: step,
			workflowVersion: 'v1'
		});

		log.info('UPDATE_PROPOSAL_STATUS completed', { proposalId, status, userId });
		return { id: proposal.id };
	} finally {
		await clearOrgContext(userId);
	}
}

// Payment operations
async function createPaymentIntent(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<{ id: string }> {
	try {
		const intent = await orgTransaction(organizationId, async (tx) => {
			return tx.paymentIntent.create({
				data: {
					organizationId,
					invoiceId: data.invoiceId as string,
					customerId: data.customerId as string,
					amount: data.amount as number,
					status: 'PENDING',
					paymentMethod: data.paymentMethod as string | undefined
				}
			});
		}, { userId, reason: 'Creating payment intent via workflow' });

		await recordWorkflowEvent({
			organizationId,
			entityType: 'JOB',
			entityId: intent.id,
			action: 'CREATE',
			eventCategory: 'EXECUTION',
			summary: 'Payment intent created',
			performedById: userId,
			performedByType: 'HUMAN',
			workflowId: 'billingWorkflow_v1',
			workflowStep: 'CREATE_PAYMENT_INTENT',
			workflowVersion: 'v1',
			jobId: data.jobId as string
		});

		log.info('CREATE_PAYMENT_INTENT completed', { intentId: intent.id, userId });
		return { id: intent.id };
	} finally {
		await clearOrgContext(userId);
	}
}

async function updatePaymentStatus(
	organizationId: string,
	userId: string,
	paymentId: string,
	status: JobPaymentStatus,
	step: string,
	additionalData?: Record<string, unknown>
): Promise<{ id: string }> {
	const updateData: Record<string, unknown> = { status };
	if (additionalData?.processedAt) updateData.processedAt = new Date();
	if (additionalData?.failedAt) updateData.failedAt = new Date();
	if (additionalData?.failureReason) updateData.errorMessage = additionalData.failureReason as string;
	if (additionalData?.refundedAt) updateData.refundedAt = new Date();

	try {
		const payment = await orgTransaction(organizationId, async (tx) => {
			return tx.paymentIntent.update({
				where: { id: paymentId },
				data: updateData
			});
		}, { userId, reason: `Updating payment status to ${status} via workflow` });

		await recordWorkflowEvent({
			organizationId,
			entityType: 'JOB',
			entityId: payment.id,
			action: 'UPDATE',
			eventCategory: 'EXECUTION',
			summary: `Payment ${status.toLowerCase()}`,
			performedById: userId,
			performedByType: 'HUMAN',
			workflowId: 'billingWorkflow_v1',
			workflowStep: step,
			workflowVersion: 'v1'
		});

		log.info('UPDATE_PAYMENT_STATUS completed', { paymentId, status, userId });
		return { id: payment.id };
	} finally {
		await clearOrgContext(userId);
	}
}

// Estimate operations
async function updateEstimateStatus(
	organizationId: string,
	userId: string,
	estimateId: string,
	status: EstimateStatus,
	step: string
): Promise<{ id: string }> {
	try {
		const estimate = await orgTransaction(organizationId, async (tx) => {
			return tx.estimate.update({
				where: { id: estimateId },
				data: { status }
			});
		}, { userId, reason: `Updating estimate status to ${status} via workflow` });

		await recordWorkflowEvent({
			organizationId,
			entityType: 'JOB',
			entityId: estimate.id,
			action: 'UPDATE',
			eventCategory: 'EXECUTION',
			summary: `Estimate ${status.toLowerCase()}`,
			performedById: userId,
			performedByType: 'HUMAN',
			workflowId: 'billingWorkflow_v1',
			workflowStep: step,
			workflowVersion: 'v1',
			jobId: estimate.jobId
		});

		log.info('UPDATE_ESTIMATE_STATUS completed', { estimateId, status, userId });
		return { id: estimate.id };
	} finally {
		await clearOrgContext(userId);
	}
}

// Invoice operations
async function updateInvoiceStatus(
	organizationId: string,
	userId: string,
	invoiceId: string,
	status: JobInvoiceStatus,
	step: string
): Promise<{ id: string }> {
	try {
		const invoice = await orgTransaction(organizationId, async (tx) => {
			return tx.jobInvoice.update({
				where: { id: invoiceId },
				data: { status }
			});
		}, { userId, reason: `Updating invoice status to ${status} via workflow` });

		await recordWorkflowEvent({
			organizationId,
			entityType: 'JOB',
			entityId: invoice.id,
			action: 'UPDATE',
			eventCategory: 'EXECUTION',
			summary: `Invoice ${status.toLowerCase()}`,
			performedById: userId,
			performedByType: 'HUMAN',
			workflowId: 'billingWorkflow_v1',
			workflowStep: step,
			workflowVersion: 'v1',
			jobId: invoice.jobId
		});

		log.info('UPDATE_INVOICE_STATUS completed', { invoiceId, status, userId });
		return { id: invoice.id };
	} finally {
		await clearOrgContext(userId);
	}
}

async function deleteEntity(
	organizationId: string,
	userId: string,
	entityId: string,
	entityType: 'proposal' | 'invoice',
	step: string
): Promise<{ id: string }> {
	try {
		await orgTransaction(organizationId, async (tx) => {
			if (entityType === 'proposal') {
				return tx.proposal.delete({ where: { id: entityId } });
			} else {
				return tx.jobInvoice.delete({ where: { id: entityId } });
			}
		}, { userId, reason: `Deleting ${entityType} via workflow` });

		await recordWorkflowEvent({
			organizationId,
			entityType: 'JOB',
			entityId,
			action: 'DELETE',
			eventCategory: 'EXECUTION',
			summary: `${entityType} deleted`,
			performedById: userId,
			performedByType: 'HUMAN',
			workflowId: 'billingWorkflow_v1',
			workflowStep: step,
			workflowVersion: 'v1'
		});

		log.info('DELETE_ENTITY completed', { entityId, entityType, userId });
		return { id: entityId };
	} finally {
		await clearOrgContext(userId);
	}
}

// Invoice operations
async function createInvoiceFromEstimate(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<{ id: string }> {
	const estimateId = data.estimateId as string;

	const estimate = await prisma.estimate.findFirst({
		where: { id: estimateId, organizationId },
		include: { lines: { orderBy: { lineNumber: 'asc' } } }
	});
	if (!estimate) throw new Error('Estimate not found');

	const sourceLines = estimate.lines;
	const subtotal = sourceLines.reduce((sum, l) => sum + Number(l.lineTotal), 0);
	const taxAmount = sourceLines.reduce((sum, l) => l.isTaxable ? sum + (Number(l.lineTotal) * Number(l.taxRate) / 100) : sum, 0);
	const discount = data.discount !== undefined ? Number(data.discount) : Number(estimate.discount);
	const totalAmount = subtotal + taxAmount - discount;

	// Generate invoice number
	const year = new Date().getFullYear();
	const lastInvoice = await prisma.jobInvoice.findFirst({
		where: { organizationId, invoiceNumber: { startsWith: `INV-${year}-` } },
		orderBy: { createdAt: 'desc' }
	});
	const seq = lastInvoice ? parseInt((lastInvoice.invoiceNumber.split('-')[2] ?? '0'), 10) + 1 : 1;
	const invoiceNumber = `INV-${year}-${String(seq).padStart(6, '0')}`;

	try {
		const invoice = await orgTransaction(organizationId, async (tx) => {
			const inv = await tx.jobInvoice.create({
				data: {
					organizationId,
					jobId: estimate.jobId,
					customerId: estimate.customerId,
					invoiceNumber,
					status: 'DRAFT',
					issueDate: new Date(),
					dueDate: data.dueDate ? new Date(data.dueDate as string) : null,
					subtotal,
					taxAmount,
					discount,
					totalAmount,
					balanceDue: totalAmount,
					notes: (data.notes as string) ?? estimate.notes,
					terms: (data.terms as string) ?? estimate.terms,
					estimateId: estimate.id,
					createdBy: userId
				}
			});

			// Copy lines
			if (sourceLines.length > 0) {
				await tx.invoiceLine.createMany({
					data: sourceLines.map((line, idx) => ({
						invoiceId: inv.id,
						lineNumber: idx + 1,
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

			// Auto-transition job to INVOICED if in COMPLETED
			const job = await tx.job.findUnique({ where: { id: estimate.jobId } });
			if (job && job.status === 'COMPLETED') {
				await tx.job.update({
					where: { id: estimate.jobId },
					data: { status: 'INVOICED', invoicedAt: new Date() }
				});
				await tx.jobStatusHistory.create({
					data: {
						jobId: estimate.jobId,
						fromStatus: 'COMPLETED',
						toStatus: 'INVOICED',
						changedBy: userId,
						notes: `Auto-transitioned: Invoice ${inv.invoiceNumber} created`
					}
				});
			}

			return inv;
		}, { userId, reason: 'Creating invoice from estimate via workflow' });

		log.info('CREATE_INVOICE_FROM_ESTIMATE completed', { invoiceId: invoice.id, userId });
		return { id: invoice.id };
	} finally {
		await clearOrgContext(userId);
	}
}

async function updateInvoice(
	organizationId: string,
	userId: string,
	invoiceId: string,
	data: Record<string, unknown>
): Promise<{ id: string }> {
	const existing = await prisma.jobInvoice.findFirst({
		where: { id: invoiceId, organizationId },
		include: { lines: true }
	});
	if (!existing) throw new Error('Invoice not found');

	if (existing.status !== 'DRAFT') {
		throw new Error('Can only edit DRAFT invoices');
	}

	const discount = data.discount !== undefined ? Number(data.discount) : Number(existing.discount);
	const subtotal = existing.lines.reduce((sum, l) => sum + Number(l.lineTotal), 0);
	const taxAmount = existing.lines.reduce((sum, l) => l.isTaxable ? sum + (Number(l.lineTotal) * Number(l.taxRate) / 100) : sum, 0);
	const totalAmount = subtotal + taxAmount - discount;

	try {
		await orgTransaction(organizationId, async (tx) => {
			return tx.jobInvoice.update({
				where: { id: invoiceId },
				data: {
					dueDate: data.dueDate === null ? null : data.dueDate ? new Date(data.dueDate as string) : existing.dueDate,
					notes: (data.notes as string) ?? existing.notes,
					terms: (data.terms as string) ?? existing.terms,
					discount,
					subtotal,
					taxAmount,
					totalAmount,
					balanceDue: totalAmount - Number(existing.amountPaid)
				}
			});
		}, { userId, reason: 'Updating invoice via workflow' });

		log.info('UPDATE_INVOICE completed', { invoiceId, userId });
		return { id: invoiceId };
	} finally {
		await clearOrgContext(userId);
	}
}

async function billingWorkflow(input: BillingWorkflowInput): Promise<BillingWorkflowResult> {
	try {
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'started', action: input.action });

		let entityId: string | undefined;

		switch (input.action) {
			// Proposal actions
			case 'CREATE_PROPOSAL': {
				const result = await DBOS.runStep(
					() => createProposal(input.organizationId, input.userId, input.data),
					{ name: 'createProposal' }
				);
				entityId = result.id;
				break;
			}
			case 'UPDATE_PROPOSAL': {
				if (!input.entityId) throw new Error('entityId required');
				const result = await DBOS.runStep(
					() => updateProposalStatus(input.organizationId, input.userId, input.entityId!, input.data.status as ProposalStatus, 'UPDATE_PROPOSAL'),
					{ name: 'updateProposal' }
				);
				entityId = result.id;
				break;
			}
			case 'SEND_PROPOSAL': {
				if (!input.entityId) throw new Error('entityId required');
				const result = await DBOS.runStep(
					() => updateProposalStatus(input.organizationId, input.userId, input.entityId!, 'SENT', 'SEND_PROPOSAL'),
					{ name: 'sendProposal' }
				);
				entityId = result.id;
				break;
			}
			case 'ACCEPT_PROPOSAL': {
				if (!input.entityId) throw new Error('entityId required');
				const result = await DBOS.runStep(
					() => updateProposalStatus(input.organizationId, input.userId, input.entityId!, 'ACCEPTED', 'ACCEPT_PROPOSAL'),
					{ name: 'acceptProposal' }
				);
				entityId = result.id;
				break;
			}
			case 'DECLINE_PROPOSAL': {
				if (!input.entityId) throw new Error('entityId required');
				const result = await DBOS.runStep(
					() => updateProposalStatus(input.organizationId, input.userId, input.entityId!, 'DECLINED', 'DECLINE_PROPOSAL'),
					{ name: 'declineProposal' }
				);
				entityId = result.id;
				break;
			}
			case 'DELETE_PROPOSAL': {
				if (!input.entityId) throw new Error('entityId required');
				const result = await DBOS.runStep(
					() => deleteEntity(input.organizationId, input.userId, input.entityId!, 'proposal', 'DELETE_PROPOSAL'),
					{ name: 'deleteProposal' }
				);
				entityId = result.id;
				break;
			}

			// Payment actions
			case 'CREATE_PAYMENT_INTENT': {
				const result = await DBOS.runStep(
					() => createPaymentIntent(input.organizationId, input.userId, input.data),
					{ name: 'createPaymentIntent' }
				);
				entityId = result.id;
				break;
			}
			case 'PROCESS_PAYMENT': {
				if (!input.entityId) throw new Error('entityId required');
				const result = await DBOS.runStep(
					() => updatePaymentStatus(input.organizationId, input.userId, input.entityId!, 'SUCCEEDED', 'PROCESS_PAYMENT', { processedAt: new Date().toISOString() }),
					{ name: 'processPayment' }
				);
				entityId = result.id;
				break;
			}
			case 'MARK_PAYMENT_FAILED': {
				if (!input.entityId) throw new Error('entityId required');
				const result = await DBOS.runStep(
					() => updatePaymentStatus(input.organizationId, input.userId, input.entityId!, 'FAILED', 'MARK_PAYMENT_FAILED', { failedAt: true, failureReason: input.data.reason }),
					{ name: 'markPaymentFailed' }
				);
				entityId = result.id;
				break;
			}
			case 'REFUND_PAYMENT': {
				if (!input.entityId) throw new Error('entityId required');
				const result = await DBOS.runStep(
					() => updatePaymentStatus(input.organizationId, input.userId, input.entityId!, 'REFUNDED', 'REFUND_PAYMENT', { refundedAt: true, refundAmount: input.data.refundAmount }),
					{ name: 'refundPayment' }
				);
				entityId = result.id;
				break;
			}
			case 'CANCEL_PAYMENT': {
				if (!input.entityId) throw new Error('entityId required');
				const result = await DBOS.runStep(
					() => updatePaymentStatus(input.organizationId, input.userId, input.entityId!, 'CANCELLED', 'CANCEL_PAYMENT', { cancelledAt: true }),
					{ name: 'cancelPayment' }
				);
				entityId = result.id;
				break;
			}

			// Estimate actions
			case 'SEND_ESTIMATE': {
				if (!input.entityId) throw new Error('entityId required');
				const result = await DBOS.runStep(
					() => updateEstimateStatus(input.organizationId, input.userId, input.entityId!, 'SENT', 'SEND_ESTIMATE'),
					{ name: 'sendEstimate' }
				);
				entityId = result.id;
				break;
			}
			case 'ACCEPT_ESTIMATE': {
				if (!input.entityId) throw new Error('entityId required');
				const result = await DBOS.runStep(
					() => updateEstimateStatus(input.organizationId, input.userId, input.entityId!, 'ACCEPTED', 'ACCEPT_ESTIMATE'),
					{ name: 'acceptEstimate' }
				);
				entityId = result.id;
				break;
			}
			case 'DECLINE_ESTIMATE': {
				if (!input.entityId) throw new Error('entityId required');
				const result = await DBOS.runStep(
					() => updateEstimateStatus(input.organizationId, input.userId, input.entityId!, 'DECLINED', 'DECLINE_ESTIMATE'),
					{ name: 'declineEstimate' }
				);
				entityId = result.id;
				break;
			}

			// Invoice actions
			case 'CREATE_INVOICE_FROM_ESTIMATE': {
				const result = await DBOS.runStep(
					() => createInvoiceFromEstimate(input.organizationId, input.userId, input.data),
					{ name: 'createInvoiceFromEstimate' }
				);
				entityId = result.id;
				break;
			}
			case 'UPDATE_INVOICE': {
				if (!input.entityId) throw new Error('entityId required');
				const result = await DBOS.runStep(
					() => updateInvoice(input.organizationId, input.userId, input.entityId!, input.data),
					{ name: 'updateInvoice' }
				);
				entityId = result.id;
				break;
			}
			case 'SEND_INVOICE': {
				if (!input.entityId) throw new Error('entityId required');
				const result = await DBOS.runStep(
					() => updateInvoiceStatus(input.organizationId, input.userId, input.entityId!, 'SENT', 'SEND_INVOICE'),
					{ name: 'sendInvoice' }
				);
				entityId = result.id;
				break;
			}
			case 'VOID_INVOICE': {
				if (!input.entityId) throw new Error('entityId required');
				const result = await DBOS.runStep(
					() => updateInvoiceStatus(input.organizationId, input.userId, input.entityId!, 'VOID', 'VOID_INVOICE'),
					{ name: 'voidInvoice' }
				);
				entityId = result.id;
				break;
			}
			case 'DELETE_INVOICE': {
				if (!input.entityId) throw new Error('entityId required');
				const result = await DBOS.runStep(
					() => deleteEntity(input.organizationId, input.userId, input.entityId!, 'invoice', 'DELETE_INVOICE'),
					{ name: 'deleteInvoice' }
				);
				entityId = result.id;
				break;
			}

			default:
				throw new Error(`Unknown action: ${input.action}`);
		}

		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'completed', entityId });

		return {
			success: true,
			action: input.action,
			entityId,
			timestamp: new Date().toISOString()
		};
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;
		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'BILLING_WORKFLOW_ERROR'
		});

		return {
			success: false,
			action: input.action,
			timestamp: new Date().toISOString(),
			error: errorMessage
		};
	}
}

export const billingWorkflow_v1 = DBOS.registerWorkflow(billingWorkflow);

export async function startBillingWorkflow(
	input: BillingWorkflowInput,
	workflowId: string
): Promise<BillingWorkflowResult> {
	const handle = await DBOS.startWorkflow(billingWorkflow_v1, {
		workflowID: workflowId
	})(input);

	return handle.getResult();
}

export type { BillingWorkflowInput, BillingWorkflowResult };
