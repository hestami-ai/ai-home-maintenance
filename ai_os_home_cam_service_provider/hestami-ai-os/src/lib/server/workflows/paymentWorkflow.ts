/**
 * Payment Workflow (v1)
 *
 * DBOS durable workflow for payment (AR) management.
 * Handles: create and void operations with payment applications and GL posting.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import type { EntityWorkflowResult } from './schemas.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger, logWorkflowStart, logWorkflowEnd, logStepError } from './workflowLogger.js';
import { postPaymentToGL, reversePaymentGL } from '../accounting/index.js';
import type { PaymentMethod } from '../../../../generated/prisma/client.js';
import { orgTransaction } from '../db/rls.js';

const log = createWorkflowLogger('paymentWorkflow');

const WORKFLOW_STATUS_EVENT = 'payment_workflow_status';
const WORKFLOW_ERROR_EVENT = 'payment_workflow_error';

// Action types for payment operations
export const PaymentWorkflowAction = {
	CREATE: 'CREATE',
	VOID: 'VOID'
} as const;

export type PaymentWorkflowAction = (typeof PaymentWorkflowAction)[keyof typeof PaymentWorkflowAction];

export interface PaymentWorkflowInput {
	action: PaymentWorkflowAction;
	organizationId: string;
	userId: string;
	associationId: string;
	// CREATE fields
	unitId?: string;
	paymentDate?: string;
	amount?: number;
	paymentMethod?: PaymentMethod;
	referenceNumber?: string | null;
	bankAccountId?: string | null;
	payerName?: string | null;
	payerPartyId?: string | null;
	memo?: string | null;
	autoApply?: boolean;
	postToGL?: boolean;
	// VOID fields
	paymentId?: string;
	applications?: Array<{ chargeId: string; amount: number }>;
	paymentAmount?: number;
}

export interface PaymentWorkflowResult extends EntityWorkflowResult {
	paymentId?: string;
	amount?: string;
	appliedAmount?: string;
	unappliedAmount?: string;
	status?: string;
	[key: string]: unknown;
}

// Step functions

async function createPaymentWithApplications(
	input: PaymentWorkflowInput
): Promise<{ id: string; amount: number; appliedAmount: number; unappliedAmount: number; status: string }> {
	// Create payment in transaction with RLS context
	const result = await orgTransaction(input.organizationId, async (tx) => {
		const payment = await tx.payment.create({
			data: {
				associationId: input.associationId,
				unitId: input.unitId!,
				paymentDate: new Date(input.paymentDate!),
				amount: input.amount!,
				paymentMethod: input.paymentMethod!,
				referenceNumber: input.referenceNumber,
				bankAccountId: input.bankAccountId,
				payerName: input.payerName,
				payerPartyId: input.payerPartyId,
				memo: input.memo,
				unappliedAmount: input.amount!,
				status: 'PENDING'
			}
		});

		let appliedAmount = 0;

		// Auto-apply to oldest unpaid charges
		if (input.autoApply) {
			const unpaidCharges = await tx.assessmentCharge.findMany({
				where: {
					unitId: input.unitId,
					balanceDue: { gt: 0 },
					status: { in: ['BILLED', 'PARTIALLY_PAID'] }
				},
				orderBy: { dueDate: 'asc' }
			});

			let remainingAmount = input.amount!;

			for (const charge of unpaidCharges) {
				if (remainingAmount <= 0) break;

				const balanceDue = Number(charge.balanceDue);
				const applyAmount = Math.min(remainingAmount, balanceDue);

				// Create payment application
				await tx.paymentApplication.create({
					data: {
						paymentId: payment.id,
						chargeId: charge.id,
						amount: applyAmount
					}
				});

				// Update charge
				const newPaidAmount = Number(charge.paidAmount) + applyAmount;
				const newBalanceDue = Number(charge.totalAmount) - newPaidAmount;
				const newStatus = newBalanceDue <= 0 ? 'PAID' : 'PARTIALLY_PAID';

				await tx.assessmentCharge.update({
					where: { id: charge.id },
					data: {
						paidAmount: newPaidAmount,
						balanceDue: newBalanceDue,
						status: newStatus
					}
				});

				appliedAmount += applyAmount;
				remainingAmount -= applyAmount;
			}

			// Update payment with applied amounts
			await tx.payment.update({
				where: { id: payment.id },
				data: {
					appliedAmount,
					unappliedAmount: input.amount! - appliedAmount
				}
			});
		}

		return {
			id: payment.id,
			amount: input.amount!,
			appliedAmount,
			unappliedAmount: input.amount! - appliedAmount,
			status: payment.status
		};
	}, { userId: input.userId, reason: 'Creating payment with applications' });

	// Record activity event
	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: 'INVOICE',
		entityId: result.id,
		action: 'CREATE',
		eventCategory: 'EXECUTION',
		summary: `Payment created: $${result.amount.toFixed(2)}`,
		performedById: input.userId,
		performedByType: 'HUMAN',
		workflowId: 'paymentWorkflow_v1',
		workflowStep: 'CREATE',
		workflowVersion: 'v1',
		newState: { amount: result.amount, appliedAmount: result.appliedAmount, status: result.status }
	});

	return result;
}

async function postPaymentToGLStep(
	paymentId: string,
	userId: string,
	organizationId: string
): Promise<{ success: boolean; error?: string }> {
	try {
		await postPaymentToGL(paymentId, userId);
		return { success: true };
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		log.warn(`Failed to post payment ${paymentId} to GL`, { error: errorObj.message, paymentId });
		await recordSpanError(errorObj, {
			errorCode: 'GL_POSTING_FAILED',
			errorType: 'Payment_GL_Error'
		});
		return { success: false, error: errorObj.message };
	}
}

async function voidPaymentWithReversal(
	input: PaymentWorkflowInput
): Promise<{ success: boolean }> {
	// Reverse all applications with RLS context
	await orgTransaction(input.organizationId, async (tx) => {
		for (const app of input.applications || []) {
			const charge = await tx.assessmentCharge.findUnique({
				where: { id: app.chargeId }
			});

			if (charge) {
				const newPaidAmount = Math.max(0, Number(charge.paidAmount) - app.amount);
				const newBalanceDue = Number(charge.totalAmount) - newPaidAmount;
				const newStatus = newPaidAmount === 0 ? 'BILLED' : 'PARTIALLY_PAID';

				await tx.assessmentCharge.update({
					where: { id: app.chargeId },
					data: {
						paidAmount: newPaidAmount,
						balanceDue: newBalanceDue,
						status: newStatus
					}
				});
			}
		}

		// Delete applications and void payment
		await tx.paymentApplication.deleteMany({
			where: { paymentId: input.paymentId }
		});

		await tx.payment.update({
			where: { id: input.paymentId },
			data: {
				status: 'VOIDED',
				appliedAmount: 0,
				unappliedAmount: input.paymentAmount
			}
		});
	}, { userId: input.userId, reason: 'Voiding payment with reversal' });

	// Record activity event
	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: 'INVOICE',
		entityId: input.paymentId!,
		action: 'DELETE',
		eventCategory: 'EXECUTION',
		summary: `Payment voided`,
		performedById: input.userId,
		performedByType: 'HUMAN',
		workflowId: 'paymentWorkflow_v1',
		workflowStep: 'VOID',
		workflowVersion: 'v1',
		newState: { status: 'VOIDED' }
	});

	return { success: true };
}

async function reversePaymentGLStep(
	paymentId: string,
	userId: string,
	organizationId: string
): Promise<{ success: boolean; error?: string }> {
	try {
		await reversePaymentGL(paymentId, userId);
		return { success: true };
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		console.warn(`Failed to reverse GL for payment ${paymentId}:`, error);
		await recordSpanError(errorObj, {
			errorCode: 'GL_REVERSAL_FAILED',
			errorType: 'Payment_Void_Error'
		});
		return { success: false, error: errorObj.message };
	}
}

// Main workflow function

async function paymentWorkflow(input: PaymentWorkflowInput): Promise<PaymentWorkflowResult> {
	const workflowName = 'paymentWorkflow_v1';
	const log = createWorkflowLogger(workflowName, DBOS.workflowID, input.action);
	const startTime = logWorkflowStart(log, input.action, {
		organizationId: input.organizationId,
		userId: input.userId,
		paymentId: input.paymentId
	}, workflowName, DBOS.workflowID);

	try {
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'started', action: input.action });

		switch (input.action) {
			case 'CREATE': {
				if (!input.unitId || !input.paymentDate || !input.amount || !input.paymentMethod) {
					const error = new Error('Missing required fields for CREATE');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: createPaymentWithApplications starting', { unitId: input.unitId, amount: input.amount });
				const result = await DBOS.runStep(
					() => createPaymentWithApplications(input),
					{ name: 'createPaymentWithApplications' }
				);
				log.info('Step: createPaymentWithApplications completed', { id: result.id });

				// Post to GL if requested (non-blocking)
				if (input.postToGL) {
					log.debug('Step: postPaymentToGL starting', { paymentId: result.id });
					await DBOS.runStep(
						() => postPaymentToGLStep(result.id, input.userId, input.organizationId),
						{ name: 'postPaymentToGL' }
					);
					log.info('Step: postPaymentToGL completed');
				}

				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'payment_created', ...result });
				const successResult: PaymentWorkflowResult = {
					success: true,
					entityId: result.id,
					paymentId: result.id,
					amount: result.amount.toString(),
					appliedAmount: result.appliedAmount.toString(),
					unappliedAmount: result.unappliedAmount.toString(),
					status: result.status
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'VOID': {
				if (!input.paymentId) {
					const error = new Error('Missing required field: paymentId for VOID');
					logStepError(log, 'validation', error, { paymentId: input.paymentId });
					throw error;
				}
				log.debug('Step: voidPaymentWithReversal starting', { paymentId: input.paymentId });
				await DBOS.runStep(
					() => voidPaymentWithReversal(input),
					{ name: 'voidPaymentWithReversal' }
				);
				log.info('Step: voidPaymentWithReversal completed', { paymentId: input.paymentId });

				// Reverse GL entry (non-blocking)
				log.debug('Step: reversePaymentGL starting', { paymentId: input.paymentId });
				await DBOS.runStep(
					() => reversePaymentGLStep(input.paymentId!, input.userId, input.organizationId),
					{ name: 'reversePaymentGL' }
				);
				log.info('Step: reversePaymentGL completed');

				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'payment_voided', paymentId: input.paymentId });
				const successResult: PaymentWorkflowResult = {
					success: true,
					entityId: input.paymentId,
					paymentId: input.paymentId
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			default: {
				const errorResult: PaymentWorkflowResult = {
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
			paymentId: input.paymentId,
			error: errorMessage,
			stack: errorObj.stack
		});

		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'PAYMENT_WORKFLOW_ERROR'
		});
		const errorResult: PaymentWorkflowResult = {
			success: false,
			error: errorMessage
		};
		logWorkflowEnd(log, input.action, false, startTime, errorResult);
		return errorResult;
	}
}

export const paymentWorkflow_v1 = DBOS.registerWorkflow(paymentWorkflow);

export async function startPaymentWorkflow(
	input: PaymentWorkflowInput,
	idempotencyKey: string
): Promise<PaymentWorkflowResult> {
	const handle = await DBOS.startWorkflow(paymentWorkflow_v1, { workflowID: idempotencyKey })(input);
	return handle.getResult();
}
