/**
 * Violation Lifecycle Workflow (v1)
 *
 * DBOS durable workflow for managing violation state transitions.
 * Handles: notice escalation, cure period tracking, SLA timers, and notifications.
 *
 * State Machine:
 *   DRAFT → OPEN → NOTICE_SENT → CURE_PERIOD → CURED/ESCALATED
 *                                     ↓
 *                              HEARING_SCHEDULED → HEARING_HELD → FINE_ASSESSED
 *                                     ↓                              ↓
 *                                 APPEALED ←─────────────────────────┘
 *                                     ↓
 *                                 CLOSED / DISMISSED
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import { orgTransaction } from '../db/rls.js';
import {
	ViolationStatus,
	ViolationSeverity,
	ActivityEntityType,
	ActivityActionType,
	ActivityEventCategory,
	ActivityActorType
} from '../../../../generated/prisma/enums.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';
import { createWorkflowLogger, logWorkflowStart, logWorkflowEnd } from './workflowLogger.js';

// Workflow error types for tracing
const WorkflowErrorType = {
	VIOLATION_LIFECYCLE_ERROR: 'VIOLATION_LIFECYCLE_ERROR'
} as const;

// Event keys for workflow status tracking
const WORKFLOW_STATUS_EVENT = 'violation_status';
const WORKFLOW_ERROR_EVENT = 'violation_error';

// Valid status transitions
const validTransitions: Record<ViolationStatus, ViolationStatus[]> = {
	[ViolationStatus.DRAFT]: [ViolationStatus.OPEN, ViolationStatus.DISMISSED],
	[ViolationStatus.OPEN]: [ViolationStatus.NOTICE_SENT, ViolationStatus.CURED, ViolationStatus.DISMISSED],
	[ViolationStatus.NOTICE_SENT]: [ViolationStatus.CURE_PERIOD, ViolationStatus.ESCALATED, ViolationStatus.CURED, ViolationStatus.DISMISSED],
	[ViolationStatus.CURE_PERIOD]: [ViolationStatus.CURED, ViolationStatus.ESCALATED, ViolationStatus.DISMISSED],
	[ViolationStatus.CURED]: [ViolationStatus.CLOSED],
	[ViolationStatus.ESCALATED]: [ViolationStatus.HEARING_SCHEDULED, ViolationStatus.FINE_ASSESSED, ViolationStatus.DISMISSED],
	[ViolationStatus.HEARING_SCHEDULED]: [ViolationStatus.HEARING_HELD, ViolationStatus.DISMISSED],
	[ViolationStatus.HEARING_HELD]: [ViolationStatus.FINE_ASSESSED, ViolationStatus.CURED, ViolationStatus.DISMISSED],
	[ViolationStatus.FINE_ASSESSED]: [ViolationStatus.APPEALED, ViolationStatus.CLOSED],
	[ViolationStatus.APPEALED]: [ViolationStatus.FINE_ASSESSED, ViolationStatus.CURED, ViolationStatus.DISMISSED, ViolationStatus.CLOSED],
	[ViolationStatus.CLOSED]: [],
	[ViolationStatus.DISMISSED]: []
};

// Default cure period days by severity
const CURE_PERIOD_DAYS: Record<string, number> = {
	MINOR: 14,
	MODERATE: 10,
	MAJOR: 7,
	CRITICAL: 3
};

interface TransitionInput {
	violationId: string;
	organizationId: string;
	toStatus: ViolationStatus;
	userId: string;
	notes?: string;
	// Optional data for specific transitions
	noticeId?: string;
	hearingId?: string;
	fineAmount?: number;
	curePeriodDays?: number;
}

interface TransitionResult {
	success: boolean;
	violationId: string;
	fromStatus: ViolationStatus;
	toStatus: ViolationStatus;
	timestamp: string;
	curePeriodEnds?: string;
	error?: string;
}

// ============================================================================
// Workflow Steps (durable operations)
// ============================================================================

/**
 * Step 1: Validate the transition is allowed
 */
async function validateTransition(input: TransitionInput): Promise<{
	valid: boolean;
	currentStatus: ViolationStatus;
	severity?: string;
	error?: string;
	organizationId?: string; // Returning orgId for audit context
}> {
	const violation = await prisma.violation.findUnique({
		where: { id: input.violationId },
		select: {
			status: true,
			severity: true,
			association: {
				select: { organizationId: true }
			}
		}
	});

	if (!violation) {
		return { valid: false, currentStatus: ViolationStatus.DRAFT, error: 'Violation not found' };
	}

	const currentStatus = violation.status as ViolationStatus;
	const allowedTransitions = validTransitions[currentStatus] || [];
	const organizationId = violation.association?.organizationId;

	if (!allowedTransitions.includes(input.toStatus)) {
		return {
			valid: false,
			currentStatus,
			error: `Invalid transition from ${currentStatus} to ${input.toStatus}`,
			organizationId
		};
	}

	// Additional validation for specific transitions
	if (input.toStatus === ViolationStatus.NOTICE_SENT && !input.noticeId) {
		// Check if there's at least one notice
		const noticeCount = await prisma.violationNotice.count({
			where: { violationId: input.violationId }
		});
		if (noticeCount === 0) {
			return {
				valid: false,
				currentStatus,
				error: 'At least one notice must be created before transitioning to NOTICE_SENT',
				organizationId
			};
		}
	}

	if (input.toStatus === ViolationStatus.HEARING_SCHEDULED && !input.hearingId) {
		// Check if there's a scheduled hearing (one with PENDING outcome)
		const hearing = await prisma.violationHearing.findFirst({
			where: { violationId: input.violationId, outcome: 'PENDING' }
		});
		if (!hearing) {
			return {
				valid: false,
				currentStatus,
				error: 'A hearing must be scheduled before transitioning to HEARING_SCHEDULED',
				organizationId
			};
		}
	}

	return {
		valid: true,
		currentStatus,
		severity: violation.severity,
		organizationId
	};
}

/**
 * Step 2: Update the violation status in the database
 */
async function updateViolationStatus(
	input: TransitionInput,
	fromStatus: ViolationStatus,
	severity?: string
): Promise<{ curePeriodEnds?: Date }> {
	let curePeriodEnds: Date | undefined;

	await prisma.$transaction(async (tx) => {
		// Build update data based on transition
		const updateData: Record<string, unknown> = {
			status: input.toStatus
		};

		// Handle specific transitions
		switch (input.toStatus) {
			case ViolationStatus.CURE_PERIOD:
				// Calculate cure period end date
				const cureDays = input.curePeriodDays || CURE_PERIOD_DAYS[severity || ViolationSeverity.MODERATE];
				curePeriodEnds = new Date(Date.now() + cureDays * 24 * 60 * 60 * 1000);
				updateData.curePeriodEnds = curePeriodEnds;
				break;

			case ViolationStatus.CURED:
				updateData.curedDate = new Date();
				break;

			case ViolationStatus.CLOSED:
			case ViolationStatus.DISMISSED:
				updateData.closedDate = new Date();
				updateData.closedBy = input.userId;
				break;
		}

		// Update the violation
		await tx.violation.update({
			where: { id: input.violationId },
			data: updateData
		});

		// Record status history
		await tx.violationStatusHistory.create({
			data: {
				violationId: input.violationId,
				fromStatus,
				toStatus: input.toStatus,
				changedBy: input.userId,
				notes: input.notes
			}
		});
	});

	return { curePeriodEnds };
}

/**
 * Step 3: Check cure period compliance
 */
async function checkCurePeriodCompliance(violationId: string): Promise<{
	isOverdue: boolean;
	daysRemaining: number | null;
	shouldEscalate: boolean;
}> {
	const violation = await prisma.violation.findUnique({
		where: { id: violationId },
		select: { curePeriodEnds: true, status: true }
	});

	if (!violation?.curePeriodEnds || violation.status !== ViolationStatus.CURE_PERIOD) {
		return { isOverdue: false, daysRemaining: null, shouldEscalate: false };
	}

	const now = new Date();
	const deadline = new Date(violation.curePeriodEnds);
	const daysRemaining = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

	return {
		isOverdue: daysRemaining < 0,
		daysRemaining,
		shouldEscalate: daysRemaining < 0
	};
}

/**
 * Step 4: Queue notifications
 */
async function queueNotifications(
	violationId: string,
	fromStatus: ViolationStatus,
	toStatus: ViolationStatus,
	userId: string
): Promise<void> {
	// In a full implementation, this would:
	// 1. Determine who needs to be notified based on the transition
	// 2. Create notification records in the database
	// 3. Trigger the notification delivery service

	// console.log(`[Workflow] Notification queued...`); 
	// Removed console.log for standard compliance, handled by caller workflow logger
}

// ============================================================================
// Main Workflow
// ============================================================================

/**
 * Violation Lifecycle Workflow
 *
 * Durably processes a violation status transition with:
 * - Validation
 * - Database update
 * - Cure period tracking
 * - Notification queueing
 */
async function violationTransitionWorkflow(input: TransitionInput): Promise<TransitionResult> {
	const logger = createWorkflowLogger('violationLifecycle', DBOS.workflowID, `TRANSITION_TO_${input.toStatus}`);
	const startTime = logWorkflowStart(logger, `TRANSITION_TO_${input.toStatus}`, input as any);

	try {
		// Step 1: Validate transition
		const validation = await DBOS.runStep(
			() => validateTransition(input),
			{ name: 'validateTransition' }
		);
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'validated', ...validation });

		if (!validation.valid) {
			const errorResult = {
				success: false,
				violationId: input.violationId,
				fromStatus: validation.currentStatus,
				toStatus: input.toStatus,
				timestamp: new Date().toISOString(),
				error: validation.error
			};
			logWorkflowEnd(logger, `TRANSITION_TO_${input.toStatus}`, false, startTime, errorResult as any);
			return errorResult;
		}

		// Step 2: Update database
		const updateResult = await DBOS.runStep(
			() => updateViolationStatus(input, validation.currentStatus, validation.severity),
			{ name: 'updateViolationStatus' }
		);

		if (validation.organizationId) {
			await recordWorkflowEvent({
				organizationId: validation.organizationId,
				entityType: ActivityEntityType.VIOLATION,
				entityId: input.violationId,
				action: ActivityActionType.STATUS_CHANGE,
				eventCategory: ActivityEventCategory.EXECUTION,
				summary: `Violation status changed to ${input.toStatus}`,
				performedById: input.userId,
				performedByType: ActivityActorType.HUMAN,
				workflowId: 'violationLifecycle_v1',
				workflowStep: ActivityActionType.STATUS_CHANGE,
				workflowVersion: 'v1',
				previousState: { status: validation.currentStatus },
				newState: { status: input.toStatus }
			});
		}

		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'updated', status: input.toStatus });

		// Step 3: Check cure period compliance (if applicable)
		let cureStatus = { isOverdue: false, daysRemaining: null as number | null, shouldEscalate: false };
		if (input.toStatus === ViolationStatus.CURE_PERIOD || validation.currentStatus === ViolationStatus.CURE_PERIOD) {
			cureStatus = await DBOS.runStep(
				() => checkCurePeriodCompliance(input.violationId),
				{ name: 'checkCurePeriodCompliance' }
			);
			await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'cure_checked', ...cureStatus });
		}

		// Step 4: Queue notifications
		await DBOS.runStep(
			() => queueNotifications(
				input.violationId,
				validation.currentStatus,
				input.toStatus,
				input.userId
			),
			{ name: 'queueNotifications' }
		);
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'notifications_queued' });

		// Log escalation warning if applicable
		if (cureStatus.shouldEscalate) {
			logger.warn(`Violation ${input.violationId} cure period EXPIRED - should escalate`);
		}

		const successResult = {
			success: true,
			violationId: input.violationId,
			fromStatus: validation.currentStatus,
			toStatus: input.toStatus,
			timestamp: new Date().toISOString(),
			curePeriodEnds: updateResult.curePeriodEnds?.toISOString()
		};
		logWorkflowEnd(logger, `TRANSITION_TO_${input.toStatus}`, true, startTime, successResult as any);
		return successResult;

	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;

		logger.error('Workflow failed', { error: errorMessage });
		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: ActivityActionType.WORKFLOW_FAILED,
			errorType: WorkflowErrorType.VIOLATION_LIFECYCLE_ERROR
		});

		const errorResult = {
			success: false,
			violationId: input.violationId,
			fromStatus: ViolationStatus.DRAFT,
			toStatus: input.toStatus,
			timestamp: new Date().toISOString(),
			error: errorMessage
		};
		logWorkflowEnd(logger, `TRANSITION_TO_${input.toStatus}`, false, startTime, errorResult as any);
		return errorResult;
	}
}

// Register the workflow with DBOS
export const violationLifecycle_v1 = DBOS.registerWorkflow(violationTransitionWorkflow);

// ============================================================================
// Workflow Helpers
// ============================================================================

/**
 * Start a violation transition workflow
 */
export async function startViolationTransition(
	input: TransitionInput,
	workflowId?: string
): Promise<{ workflowId: string }> {
	const id = workflowId || `viol-transition-${input.violationId}-${Date.now()}`;
	await DBOS.startWorkflow(violationLifecycle_v1, { workflowID: id })(input);
	return { workflowId: id };
}

/**
 * Get the status of a violation transition workflow
 */
export async function getViolationTransitionStatus(
	workflowId: string
): Promise<{ step: string;[key: string]: unknown } | null> {
	const status = await DBOS.getEvent(workflowId, WORKFLOW_STATUS_EVENT, 0);
	return status as { step: string;[key: string]: unknown } | null;
}

/**
 * Check if a violation transition workflow had an error
 */
export async function getViolationTransitionError(
	workflowId: string
): Promise<{ error: string } | null> {
	const error = await DBOS.getEvent(workflowId, WORKFLOW_ERROR_EVENT, 0);
	return error as { error: string } | null;
}

// Export types
export type { TransitionInput as ViolationTransitionInput, TransitionResult as ViolationTransitionResult };
