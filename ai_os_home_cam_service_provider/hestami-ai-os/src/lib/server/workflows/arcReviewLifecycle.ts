/**
 * ARC Review Lifecycle Workflow (v1)
 *
 * DBOS durable workflow for managing ARC request state transitions.
 * Handles: submission, committee review, decision recording, revision loops, and expiration.
 *
 * State Machine:
 *   DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED/DENIED/CHANGES_REQUESTED/TABLED
 *                                           ↓
 *                                       EXPIRED (if approval not acted upon)
 *                           ↓
 *                    CHANGES_REQUESTED → SUBMITTED (revision loop)
 *                           ↓
 *                       WITHDRAWN / CANCELLED
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import { orgTransaction, clearOrgContext } from '../db/rls.js';
import type { ARCRequestStatus } from '../../../../generated/prisma/client.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger } from './workflowLogger.js';

const log = createWorkflowLogger('ARCReviewLifecycleWorkflow');

// Event keys for workflow status tracking
const WORKFLOW_STATUS_EVENT = 'arc_status';
const WORKFLOW_ERROR_EVENT = 'arc_error';

// Valid status transitions
const validTransitions: Record<ARCRequestStatus, ARCRequestStatus[]> = {
	DRAFT: ['SUBMITTED', 'CANCELLED'],
	SUBMITTED: ['UNDER_REVIEW', 'WITHDRAWN', 'CANCELLED'],
	UNDER_REVIEW: ['APPROVED', 'DENIED', 'CHANGES_REQUESTED', 'TABLED', 'WITHDRAWN', 'CANCELLED'],
	APPROVED: ['EXPIRED'],
	DENIED: [],
	CHANGES_REQUESTED: ['SUBMITTED', 'WITHDRAWN', 'CANCELLED'],
	TABLED: ['UNDER_REVIEW', 'WITHDRAWN', 'CANCELLED'],
	WITHDRAWN: [],
	CANCELLED: [],
	EXPIRED: []
};

// Default approval expiration days
const DEFAULT_APPROVAL_EXPIRATION_DAYS = 365;

interface TransitionInput {
	requestId: string;
	toStatus: ARCRequestStatus;
	userId: string;
	notes?: string;
	// Optional data for specific transitions
	committeeId?: string;
	reviewAction?: string;
	conditions?: string;
	expirationDays?: number;
}

interface TransitionResult {
	success: boolean;
	requestId: string;
	fromStatus: ARCRequestStatus;
	toStatus: ARCRequestStatus;
	timestamp: string;
	approvalExpires?: string;
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
	currentStatus: ARCRequestStatus;
	committeeId?: string;
	error?: string;
}> {
	const request = await prisma.aRCRequest.findUnique({
		where: { id: input.requestId }
	});

	if (!request) {
		return { valid: false, currentStatus: 'DRAFT', error: 'ARC request not found' };
	}

	const currentStatus = request.status as ARCRequestStatus;
	const allowedTransitions = validTransitions[currentStatus] || [];

	if (!allowedTransitions.includes(input.toStatus)) {
		return {
			valid: false,
			currentStatus,
			error: `Invalid transition from ${currentStatus} to ${input.toStatus}`
		};
	}

	// Additional validation for specific transitions
	if (input.toStatus === 'UNDER_REVIEW') {
		// Must have a committee assigned
		if (!request.committeeId && !input.committeeId) {
			return {
				valid: false,
				currentStatus,
				error: 'A committee must be assigned before moving to UNDER_REVIEW'
			};
		}
	}

	if (['APPROVED', 'DENIED', 'CHANGES_REQUESTED', 'TABLED'].includes(input.toStatus)) {
		// Must have at least one review
		const reviewCount = await prisma.aRCReview.count({
			where: { requestId: input.requestId }
		});
		if (reviewCount === 0) {
			return {
				valid: false,
				currentStatus,
				error: 'At least one committee review is required before recording a decision'
			};
		}
	}

	return { valid: true, currentStatus, committeeId: request.committeeId ?? undefined };
}

/**
 * Step 2: Update the ARC request status in the database
 */
async function updateARCRequestStatus(
	input: TransitionInput,
	fromStatus: ARCRequestStatus
): Promise<{ approvalExpires?: Date }> {
	// Look up the request to get organizationId
	const request = await prisma.aRCRequest.findUnique({
		where: { id: input.requestId },
		select: { organizationId: true }
	});

	if (!request) {
		throw new Error('ARC request not found');
	}

	const { organizationId } = request;
	let approvalExpires: Date | undefined;

	try {
		await orgTransaction(organizationId, async (tx) => {
			// Build update data based on transition
			const updateData: Record<string, unknown> = {
				status: input.toStatus
			};

			// Handle specific transitions
			switch (input.toStatus) {
				case 'SUBMITTED':
					updateData.submittedAt = new Date();
					break;

				case 'UNDER_REVIEW':
					if (input.committeeId) {
						updateData.committeeId = input.committeeId;
					}
					updateData.reviewedAt = new Date();
					break;

				case 'APPROVED':
					updateData.decisionDate = new Date();
					updateData.conditions = input.conditions;
					// Set expiration date
					const expirationDays = input.expirationDays || DEFAULT_APPROVAL_EXPIRATION_DAYS;
					approvalExpires = new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000);
					updateData.expiresAt = approvalExpires;
					break;

				case 'DENIED':
				case 'CHANGES_REQUESTED':
				case 'TABLED':
					updateData.decisionDate = new Date();
					if (input.conditions) {
						updateData.conditions = input.conditions;
					}
					break;

				case 'WITHDRAWN':
					updateData.withdrawnAt = new Date();
					if (input.notes) {
						updateData.cancellationReason = input.notes;
					}
					break;

				case 'CANCELLED':
					if (input.notes) {
						updateData.cancellationReason = input.notes;
					}
					break;

				case 'EXPIRED':
					// No additional fields needed
					break;
			}

			// Update the request
			await tx.aRCRequest.update({
				where: { id: input.requestId },
				data: updateData
			});
		}, { userId: input.userId, reason: 'Updating ARC request status via lifecycle workflow' });

		return { approvalExpires };
	} finally {
		await clearOrgContext(input.userId);
	}
}

/**
 * Step 3: Check approval expiration
 */
async function checkApprovalExpiration(requestId: string): Promise<{
	isExpired: boolean;
	daysRemaining: number | null;
	shouldExpire: boolean;
}> {
	const request = await prisma.aRCRequest.findUnique({
		where: { id: requestId },
		select: { expiresAt: true, status: true }
	});

	if (!request?.expiresAt || request.status !== 'APPROVED') {
		return { isExpired: false, daysRemaining: null, shouldExpire: false };
	}

	const now = new Date();
	const expiration = new Date(request.expiresAt);
	const daysRemaining = Math.ceil((expiration.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

	return {
		isExpired: daysRemaining < 0,
		daysRemaining,
		shouldExpire: daysRemaining < 0
	};
}

/**
 * Step 4: Queue notifications
 */
async function queueNotifications(
	requestId: string,
	fromStatus: ARCRequestStatus,
	toStatus: ARCRequestStatus,
	userId: string
): Promise<void> {
	// In a full implementation, this would:
	// 1. Determine who needs to be notified based on the transition
	// 2. Create notification records in the database
	// 3. Trigger the notification delivery service

	log.info(`Notification queued: ARC request ${requestId} transitioned from ${fromStatus} to ${toStatus} by user ${userId}`);

	// Example notification rules:
	// - SUBMITTED: Notify committee members
	// - UNDER_REVIEW: Notify requestor that review has started
	// - APPROVED/DENIED: Notify requestor with decision
	// - CHANGES_REQUESTED: Notify requestor with required changes
	// - EXPIRING_SOON: Notify requestor before approval expires
}

// ============================================================================
// Main Workflow
// ============================================================================

/**
 * ARC Review Lifecycle Workflow
 *
 * Durably processes an ARC request status transition with:
 * - Validation
 * - Database update
 * - Expiration tracking
 * - Notification queueing
 */
async function arcReviewTransitionWorkflow(input: TransitionInput): Promise<TransitionResult> {
	const workflowId = DBOS.workflowID;

	try {
		// Step 1: Validate transition
		const validation = await DBOS.runStep(
			() => validateTransition(input),
			{ name: 'validateTransition' }
		);
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'validated', ...validation });

		if (!validation.valid) {
			return {
				success: false,
				requestId: input.requestId,
				fromStatus: validation.currentStatus,
				toStatus: input.toStatus,
				timestamp: new Date().toISOString(),
				error: validation.error
			};
		}

		// Step 2: Update database
		const updateResult = await DBOS.runStep(
			() => updateARCRequestStatus(input, validation.currentStatus),
			{ name: 'updateARCRequestStatus' }
		);
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'updated', status: input.toStatus });

		// Step 3: Check approval expiration (if applicable)
		let expirationStatus = { isExpired: false, daysRemaining: null as number | null, shouldExpire: false };
		if (input.toStatus === 'APPROVED' || validation.currentStatus === 'APPROVED') {
			expirationStatus = await DBOS.runStep(
				() => checkApprovalExpiration(input.requestId),
				{ name: 'checkApprovalExpiration' }
			);
			await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'expiration_checked', ...expirationStatus });
		}

		// Step 4: Queue notifications
		await DBOS.runStep(
			() => queueNotifications(
				input.requestId,
				validation.currentStatus,
				input.toStatus,
				input.userId
			),
			{ name: 'queueNotifications' }
		);
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'notifications_queued' });

		// Log expiration warning if applicable
		if (expirationStatus.shouldExpire) {
			log.warn(`Workflow ${workflowId}: ARC request ${input.requestId} approval has EXPIRED`);
		}

		return {
			success: true,
			requestId: input.requestId,
			fromStatus: validation.currentStatus,
			toStatus: input.toStatus,
			timestamp: new Date().toISOString(),
			approvalExpires: updateResult.approvalExpires?.toISOString()
		};
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;

		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'ARC_REVIEW_LIFECYCLE_ERROR'
		});

		return {
			success: false,
			requestId: input.requestId,
			fromStatus: 'DRAFT',
			toStatus: input.toStatus,
			timestamp: new Date().toISOString(),
			error: errorMessage
		};
	}
}

// Register the workflow with DBOS
export const arcReviewLifecycle_v1 = DBOS.registerWorkflow(arcReviewTransitionWorkflow);

// ============================================================================
// Workflow Helpers
// ============================================================================

/**
 * Start an ARC review transition workflow
 */
export async function startARCReviewTransition(
	input: TransitionInput,
	workflowId?: string
): Promise<{ workflowId: string }> {
	const id = workflowId || `arc-transition-${input.requestId}-${Date.now()}`;
	await DBOS.startWorkflow(arcReviewLifecycle_v1, { workflowID: id })(input);
	return { workflowId: id };
}

/**
 * Get the status of an ARC review transition workflow
 */
export async function getARCReviewTransitionStatus(
	workflowId: string
): Promise<{ step: string;[key: string]: unknown } | null> {
	const status = await DBOS.getEvent(workflowId, WORKFLOW_STATUS_EVENT, 0);
	return status as { step: string;[key: string]: unknown } | null;
}

/**
 * Check if an ARC review transition workflow had an error
 */
export async function getARCReviewTransitionError(
	workflowId: string
): Promise<{ error: string } | null> {
	const error = await DBOS.getEvent(workflowId, WORKFLOW_ERROR_EVENT, 0);
	return error as { error: string } | null;
}

// Export types
export type { TransitionInput as ARCTransitionInput, TransitionResult as ARCTransitionResult };
