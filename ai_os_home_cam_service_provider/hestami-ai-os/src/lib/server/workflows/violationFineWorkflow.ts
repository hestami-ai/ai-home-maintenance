/**
 * Violation Fine Workflow (v1)
 *
 * DBOS durable workflow for managing violation fine operations.
 * Handles: fineToCharge (convert fine to assessment charge).
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';

// Action types for the unified workflow
export type ViolationFineAction = 'FINE_TO_CHARGE';

export interface ViolationFineWorkflowInput {
	action: ViolationFineAction;
	organizationId: string;
	userId: string;
	associationId: string;
	fineId: string;
	data: Record<string, unknown>;
}

export interface ViolationFineWorkflowResult {
	success: boolean;
	entityId?: string;
	chargeId?: string;
	error?: string;
}

// Step functions for each operation
async function fineToCharge(
	organizationId: string,
	userId: string,
	associationId: string,
	fineId: string
): Promise<{ fineId: string; chargeId: string }> {
	// Get the fine with violation details
	const fine = await prisma.violationFine.findFirst({
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
	let assessmentType = await prisma.assessmentType.findFirst({
		where: { associationId, code: 'FINE' }
	});

	if (!assessmentType) {
		// Get a revenue account for fines
		const fineRevenueAccount = await prisma.gLAccount.findFirst({
			where: {
				associationId,
				accountType: 'REVENUE',
				isActive: true
			}
		});

		if (!fineRevenueAccount) {
			throw new Error('No revenue account found for fine charges');
		}

		assessmentType = await prisma.assessmentType.create({
			data: {
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
	const charge = await prisma.assessmentCharge.create({
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
	await prisma.violationFine.update({
		where: { id: fineId },
		data: {
			assessmentChargeId: charge.id,
			glPosted: true
		}
	});

	console.log(`[ViolationFineWorkflow] FINE_TO_CHARGE fine:${fineId} -> charge:${charge.id} by user ${userId}`);
	return { fineId, chargeId: charge.id };
}

// Main workflow function
async function violationFineWorkflow(input: ViolationFineWorkflowInput): Promise<ViolationFineWorkflowResult> {
	try {
		switch (input.action) {
			case 'FINE_TO_CHARGE': {
				const result = await DBOS.runStep(
					() => fineToCharge(input.organizationId, input.userId, input.associationId, input.fineId),
					{ name: 'fineToCharge' }
				);
				return { success: true, entityId: result.fineId, chargeId: result.chargeId };
			}

			default:
				return { success: false, error: `Unknown action: ${input.action}` };
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`[ViolationFineWorkflow] Error in ${input.action}:`, errorMessage);
		return { success: false, error: errorMessage };
	}
}

export const violationFineWorkflow_v1 = DBOS.registerWorkflow(violationFineWorkflow);

export async function startViolationFineWorkflow(
	input: ViolationFineWorkflowInput,
	idempotencyKey?: string
): Promise<ViolationFineWorkflowResult> {
	const workflowId = idempotencyKey || `viol-fine-${input.action}-${input.fineId}-${Date.now()}`;
	const handle = await DBOS.startWorkflow(violationFineWorkflow_v1, { workflowID: workflowId })(input);
	return handle.getResult();
}
