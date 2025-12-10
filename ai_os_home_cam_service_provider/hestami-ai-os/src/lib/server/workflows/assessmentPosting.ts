/**
 * Assessment Posting Workflow (v1)
 *
 * DBOS durable workflow for automated assessment charge generation.
 * Handles: scheduled charge creation, late fee application, and delinquency escalation.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';

// Event keys for workflow status tracking
const WORKFLOW_STATUS_EVENT = 'assessment_posting_status';
const WORKFLOW_ERROR_EVENT = 'assessment_posting_error';

interface PostingInput {
	associationId: string;
	assessmentTypeId: string;
	postingDate: Date;
	dueDate: Date;
	userId: string;
	applyLateFees?: boolean;
}

interface PostingResult {
	success: boolean;
	associationId: string;
	chargesCreated: number;
	totalAmount: string;
	lateFeesApplied: number;
	timestamp: string;
	error?: string;
}

// ============================================================================
// Workflow Steps
// ============================================================================

/**
 * Step 1: Get assessment type and validate
 */
async function getAssessmentType(typeId: string, associationId: string): Promise<{
	valid: boolean;
	assessmentType?: {
		id: string;
		name: string;
		defaultAmount: string;
		revenueAccountId: string;
		gracePeriodDays: number;
	};
	error?: string;
}> {
	const assessmentType = await prisma.assessmentType.findFirst({
		where: { id: typeId, associationId, isActive: true }
	});

	if (!assessmentType) {
		return { valid: false, error: 'Assessment type not found or inactive' };
	}

	return {
		valid: true,
		assessmentType: {
			id: assessmentType.id,
			name: assessmentType.name,
			defaultAmount: assessmentType.defaultAmount.toString(),
			revenueAccountId: assessmentType.revenueAccountId,
			gracePeriodDays: assessmentType.gracePeriodDays
		}
	};
}

/**
 * Step 2: Get all units that need charges
 */
async function getUnitsForCharging(associationId: string): Promise<Array<{
	id: string;
	unitNumber: string;
}>> {
	const units = await prisma.unit.findMany({
		where: {
			property: {
				associationId,
				deletedAt: null
			}
		},
		select: {
			id: true,
			unitNumber: true
		}
	});

	return units;
}

/**
 * Step 3: Create assessment charges for units
 */
async function createAssessmentCharges(
	associationId: string,
	units: Array<{ id: string; unitNumber: string }>,
	assessmentType: { id: string; name: string; defaultAmount: string; revenueAccountId: string },
	postingDate: Date,
	dueDate: Date
): Promise<{ chargesCreated: number; totalAmount: number }> {
	let chargesCreated = 0;
	let totalAmount = 0;
	const amount = parseFloat(assessmentType.defaultAmount);

	for (const unit of units) {
		// Check if charge already exists for this period
		const existingCharge = await prisma.assessmentCharge.findFirst({
			where: {
				unitId: unit.id,
				assessmentTypeId: assessmentType.id,
				chargeDate: postingDate
			}
		});

		if (existingCharge) {
			continue; // Skip if already charged
		}

		// Create the charge
		await prisma.assessmentCharge.create({
			data: {
				associationId,
				unitId: unit.id,
				assessmentTypeId: assessmentType.id,
				chargeDate: postingDate,
				dueDate,
				amount,
				lateFeeAmount: 0,
				totalAmount: amount,
				paidAmount: 0,
				balanceDue: amount,
				status: 'PENDING',
				description: `${assessmentType.name} - ${postingDate.toISOString().split('T')[0]}`
			}
		});

		chargesCreated++;
		totalAmount += amount;
	}

	return { chargesCreated, totalAmount };
}

/**
 * Step 4: Apply late fees to overdue charges
 */
async function applyLateFees(
	associationId: string,
	graceDays: number
): Promise<{ lateFeesApplied: number }> {
	const cutoffDate = new Date();
	cutoffDate.setDate(cutoffDate.getDate() - graceDays);

	// Find overdue charges without late fees
	const overdueCharges = await prisma.assessmentCharge.findMany({
		where: {
			associationId,
			dueDate: { lt: cutoffDate },
			status: 'PENDING',
			lateFeeApplied: false
		},
		include: {
			assessmentType: true
		}
	});

	let lateFeesApplied = 0;

	for (const charge of overdueCharges) {
		// Calculate late fee from assessment type config or default 10%
		const lateFeeAmount = charge.assessmentType.lateFeeAmount
			? parseFloat(charge.assessmentType.lateFeeAmount.toString())
			: parseFloat(charge.amount.toString()) * 0.1;

		// Update charge with late fee
		await prisma.assessmentCharge.update({
			where: { id: charge.id },
			data: {
				lateFeeApplied: true,
				lateFeeAmount,
				lateFeeDate: new Date(),
				totalAmount: parseFloat(charge.amount.toString()) + lateFeeAmount,
				balanceDue: parseFloat(charge.amount.toString()) + lateFeeAmount - parseFloat(charge.paidAmount.toString())
			}
		});

		lateFeesApplied++;
	}

	return { lateFeesApplied };
}

/**
 * Step 5: Queue delinquency notifications
 */
async function queueDelinquencyNotifications(
	associationId: string,
	chargesCreated: number,
	lateFeesApplied: number
): Promise<void> {
	console.log(`[Workflow] Assessment posting complete for association ${associationId}: ${chargesCreated} charges created, ${lateFeesApplied} late fees applied`);
}

// ============================================================================
// Main Workflow
// ============================================================================

async function assessmentPostingWorkflow(input: PostingInput): Promise<PostingResult> {
	try {
		// Step 1: Get and validate assessment type
		const typeResult = await DBOS.runStep(
			() => getAssessmentType(input.assessmentTypeId, input.associationId),
			{ name: 'getAssessmentType' }
		);
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'type_validated' });

		if (!typeResult.valid || !typeResult.assessmentType) {
			return {
				success: false,
				associationId: input.associationId,
				chargesCreated: 0,
				totalAmount: '0',
				lateFeesApplied: 0,
				timestamp: new Date().toISOString(),
				error: typeResult.error
			};
		}

		// Step 2: Get units for charging
		const units = await DBOS.runStep(
			() => getUnitsForCharging(input.associationId),
			{ name: 'getUnitsForCharging' }
		);
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'units_retrieved', count: units.length });

		// Step 3: Create charges
		const chargeResult = await DBOS.runStep(
			() => createAssessmentCharges(
				input.associationId,
				units,
				typeResult.assessmentType!,
				input.postingDate,
				input.dueDate
			),
			{ name: 'createAssessmentCharges' }
		);
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'charges_created', ...chargeResult });

		// Step 4: Apply late fees if requested
		let lateFeesApplied = 0;
		if (input.applyLateFees) {
			const lateFeeResult = await DBOS.runStep(
				() => applyLateFees(input.associationId, typeResult.assessmentType!.gracePeriodDays),
				{ name: 'applyLateFees' }
			);
			lateFeesApplied = lateFeeResult.lateFeesApplied;
			await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'late_fees_applied', lateFeesApplied });
		}

		// Step 5: Queue notifications
		await DBOS.runStep(
			() => queueDelinquencyNotifications(input.associationId, chargeResult.chargesCreated, lateFeesApplied),
			{ name: 'queueDelinquencyNotifications' }
		);
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'complete' });

		return {
			success: true,
			associationId: input.associationId,
			chargesCreated: chargeResult.chargesCreated,
			totalAmount: chargeResult.totalAmount.toString(),
			lateFeesApplied,
			timestamp: new Date().toISOString()
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		return {
			success: false,
			associationId: input.associationId,
			chargesCreated: 0,
			totalAmount: '0',
			lateFeesApplied: 0,
			timestamp: new Date().toISOString(),
			error: errorMessage
		};
	}
}

// Register the workflow with DBOS
export const assessmentPosting_v1 = DBOS.registerWorkflow(assessmentPostingWorkflow);

// ============================================================================
// Workflow Helpers
// ============================================================================

export async function startAssessmentPosting(
	input: PostingInput,
	workflowId?: string
): Promise<{ workflowId: string }> {
	const id = workflowId || `assessment-posting-${input.associationId}-${Date.now()}`;
	await DBOS.startWorkflow(assessmentPosting_v1, { workflowID: id })(input);
	return { workflowId: id };
}

export async function getAssessmentPostingStatus(
	workflowId: string
): Promise<{ step: string; [key: string]: unknown } | null> {
	const status = await DBOS.getEvent(workflowId, WORKFLOW_STATUS_EVENT, 0);
	return status as { step: string; [key: string]: unknown } | null;
}

export type { PostingInput as AssessmentPostingInput, PostingResult as AssessmentPostingResult };
