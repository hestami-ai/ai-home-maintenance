/**
 * Violation Fine Workflow (v1)
 *
 * DBOS durable workflow for managing violation fine operations.
 * Handles: fineToCharge (convert fine to assessment charge).
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { orgTransaction } from '../db/rls.js';
import { type EntityWorkflowResult } from './schemas.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger } from './workflowLogger.js';
import { ActivityActionType, ViolationStatus } from '../../../../generated/prisma/enums.js';

// Workflow error types for tracing
const WorkflowErrorType = {
	VIOLATION_FINE_WORKFLOW_ERROR: 'VIOLATION_FINE_WORKFLOW_ERROR'
} as const;

const log = createWorkflowLogger('ViolationFineWorkflow');

// Action types for the unified workflow
export const ViolationFineAction = {
	FINE_TO_CHARGE: 'FINE_TO_CHARGE',
	ASSESS_FINE: 'ASSESS_FINE',
	WAIVE_FINE: 'WAIVE_FINE'
} as const;

export type ViolationFineAction = (typeof ViolationFineAction)[keyof typeof ViolationFineAction];

export interface ViolationFineWorkflowInput {
	action: ViolationFineAction;
	organizationId: string;
	userId: string;
	associationId: string;
	violationId?: string;
	fineId?: string;
	data: {
		// ASSESS_FINE fields
		amount?: number;
		reason?: string;
		dueDays?: number;
		fineCount?: number;
		currentStatus?: string;
		// WAIVE_FINE fields
		waivedAmount?: number;
		waiveReason?: string;
		fineAmount?: number;
	};
}

export interface ViolationFineWorkflowResult extends EntityWorkflowResult {
	chargeId?: string;
}

// Step functions for each operation
async function fineToCharge(
	organizationId: string,
	userId: string,
	associationId: string,
	fineId: string
): Promise<{ fineId: string; chargeId: string }> {
	return orgTransaction(organizationId, async (tx) => {
		// Get the fine with violation details
		const fine = await tx.violationFine.findFirst({
			where: { id: fineId },
			include: {
				violation: {
					include: { unit: true }
				}
			}
		});

		if (!fine || fine.violation.associationId !== associationId) {
			throw new Error('Fine not found');
		}

		if (fine.assessmentChargeId) {
			throw new Error('Fine has already been converted to an assessment charge');
		}

		if (!fine.violation.unitId) {
			throw new Error('Violation must be associated with a unit to create a charge');
		}

		// Get or create a "Violation Fine" assessment type
		let assessmentType = await tx.assessmentType.findFirst({
			where: { associationId, code: 'FINE' }
		});

		if (!assessmentType) {
			// Get a revenue account for fines
			const fineRevenueAccount = await tx.gLAccount.findFirst({
				where: {
					associationId,
					accountType: 'REVENUE',
					isActive: true
				}
			});

			if (!fineRevenueAccount) {
				throw new Error('No revenue account found for fine charges');
			}

			assessmentType = await tx.assessmentType.create({
				data: {
					organizationId,
					associationId,
					name: 'Violation Fine',
					code: 'FINE',
					description: 'Fines assessed for violations',
					frequency: 'ONE_TIME',
					defaultAmount: 0,
					revenueAccountId: fineRevenueAccount.id
				}
			});
		}

		// Create the assessment charge
		const amount = parseFloat(fine.amount.toString());
		const charge = await tx.assessmentCharge.create({
			data: {
				associationId,
				unitId: fine.violation.unitId,
				assessmentTypeId: assessmentType.id,
				chargeDate: fine.assessedDate,
				dueDate: fine.dueDate,
				amount,
				lateFeeAmount: 0,
				totalAmount: amount,
				paidAmount: parseFloat(fine.paidAmount.toString()),
				balanceDue: parseFloat(fine.balanceDue.toString()),
				status: fine.balanceDue.equals(0) ? 'PAID' : 'PENDING',
				description: `Violation Fine #${fine.fineNumber} - ${fine.reason || 'Violation fine'}`
			}
		});

		// Update the fine with the charge reference
		await tx.violationFine.update({
			where: { id: fineId },
			data: {
				assessmentChargeId: charge.id,
				glPosted: true
			}
		});

		log.info('FINE_TO_CHARGE completed', { fineId, chargeId: charge.id, userId });
		return { fineId, chargeId: charge.id };
	}, { userId, reason: 'fineToCharge' });
}

async function assessFine(
	organizationId: string,
	userId: string,
	violationId: string,
	data: ViolationFineWorkflowInput['data']
): Promise<{ fineId: string; fineNumber: number; amount: string; dueDate: string }> {
	const amount = data.amount!;
	const reason = data.reason;
	const dueDays = data.dueDays ?? 30;
	const fineCount = data.fineCount ?? 0;
	const currentStatus = data.currentStatus as string;

	const now = new Date();
	const dueDate = new Date(now.getTime() + dueDays * 24 * 60 * 60 * 1000);
	const fineNumber = fineCount + 1;

	return orgTransaction(organizationId, async (tx) => {
		const fine = await tx.violationFine.create({
			data: {
				violationId,
				fineNumber,
				amount,
				reason,
				assessedDate: now,
				dueDate,
				balanceDue: amount,
				assessedBy: userId
			}
		});

		// Update violation totals
		await tx.violation.update({
			where: { id: violationId },
			data: {
				totalFinesAssessed: { increment: amount },
				status: ViolationStatus.FINE_ASSESSED
			}
		});

		if (currentStatus !== ViolationStatus.FINE_ASSESSED) {
			await tx.violationStatusHistory.create({
				data: {
					violationId,
					fromStatus: currentStatus as any,
					toStatus: ViolationStatus.FINE_ASSESSED,
					changedBy: userId,
					notes: `Fine #${fineNumber} assessed: $${amount}`
				}
			});
		}

		log.info('ASSESS_FINE completed', { fineId: fine.id, userId });
		return {
			fineId: fine.id,
			fineNumber: fine.fineNumber,
			amount: fine.amount.toString(),
			dueDate: fine.dueDate.toISOString()
		};
	}, { userId, reason: 'assessFine' });
}

async function waiveFine(
	organizationId: string,
	userId: string,
	fineId: string,
	data: ViolationFineWorkflowInput['data']
): Promise<{ fineId: string; waivedAmount: string; balanceDue: string }> {
	const waivedAmount = data.waivedAmount!;
	const waiveReason = data.waiveReason;

	return orgTransaction(organizationId, async (tx) => {
		const fine = await tx.violationFine.findUnique({ where: { id: fineId } });
		if (!fine) throw new Error('Fine not found');

		const newWaivedAmount = parseFloat(fine.waivedAmount.toString()) + waivedAmount;
		const newBalanceDue = parseFloat(fine.balanceDue.toString()) - waivedAmount;

		const updated = await tx.violationFine.update({
			where: { id: fineId },
			data: {
				waivedAmount: newWaivedAmount,
				balanceDue: Math.max(0, newBalanceDue),
				waivedBy: userId,
				waivedDate: new Date(),
				waiverReason: waiveReason
			}
		});

		// Update violation totals
		await tx.violation.update({
			where: { id: fine.violationId },
			data: {
				totalFinesWaived: { increment: waivedAmount }
			}
		});

		log.info('WAIVE_FINE completed', { fineId, waivedAmount, userId });
		return {
			fineId: updated.id,
			waivedAmount: newWaivedAmount.toString(),
			balanceDue: Math.max(0, newBalanceDue).toString()
		};
	}, { userId, reason: 'waiveFine' });
}

// Main workflow function
async function violationFineWorkflow(input: ViolationFineWorkflowInput): Promise<ViolationFineWorkflowResult> {
	try {
		switch (input.action) {
			case ViolationFineAction.FINE_TO_CHARGE: {
				const result = await DBOS.runStep(
					() => fineToCharge(input.organizationId, input.userId, input.associationId, input.fineId!),
					{ name: 'fineToCharge' }
				);
				return { success: true, entityId: result.fineId, chargeId: result.chargeId };
			}

			case ViolationFineAction.ASSESS_FINE: {
				const result = await DBOS.runStep(
					() => assessFine(input.organizationId, input.userId, input.violationId!, input.data),
					{ name: 'assessFine' }
				);
				return { success: true, entityId: result.fineId };
			}

			case ViolationFineAction.WAIVE_FINE: {
				const result = await DBOS.runStep(
					() => waiveFine(input.organizationId, input.userId, input.fineId!, input.data),
					{ name: 'waiveFine' }
				);
				return { success: true, entityId: result.fineId };
			}

			default:
				return { success: false, error: `Unknown action: ${input.action}` };
		}
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;
		log.error('Workflow error', { action: input.action, error: errorMessage });

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: ActivityActionType.WORKFLOW_FAILED,
			errorType: WorkflowErrorType.VIOLATION_FINE_WORKFLOW_ERROR
		});

		return { success: false, error: errorMessage };
	}
}

export const violationFineWorkflow_v1 = DBOS.registerWorkflow(violationFineWorkflow);

export async function startViolationFineWorkflow(
	input: ViolationFineWorkflowInput,
	idempotencyKey: string
): Promise<ViolationFineWorkflowResult> {
	const workflowId = idempotencyKey || `viol-fine-${input.action}-${input.fineId}-${Date.now()}`;
	const handle = await DBOS.startWorkflow(violationFineWorkflow_v1, { workflowID: idempotencyKey})(input);
	return handle.getResult();
}
