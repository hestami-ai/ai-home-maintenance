/**
 * Work Order Lifecycle Workflow (v1)
 *
 * DBOS durable workflow for managing work order state transitions.
 * Handles: state validation, SLA tracking, notifications, and AP integration.
 *
 * State Machine (Phase 9 Updated):
 *   DRAFT → SUBMITTED → TRIAGED → AUTHORIZED → ASSIGNED → SCHEDULED → IN_PROGRESS → COMPLETED → INVOICED → CLOSED
 *                                                  ↓           ↓            ↓              ↓
 *                                               ON_HOLD ←→ IN_PROGRESS   CANCELLED   REVIEW_REQUIRED
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import { orgTransaction, clearOrgContext } from '../db/rls.js';
import { WorkOrderStatus, ActivityActionType } from '../../../../generated/prisma/enums.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger } from './workflowLogger.js';

const log = createWorkflowLogger('WorkOrderLifecycleWorkflow');

// Workflow error types for tracing
const WorkflowErrorType = {
	WORK_ORDER_LIFECYCLE_ERROR: 'WORK_ORDER_LIFECYCLE_ERROR'
} as const;

// Event keys for workflow status tracking
const WORKFLOW_STATUS_EVENT = 'work_order_status';
const WORKFLOW_ERROR_EVENT = 'work_order_error';

// Valid status transitions (Phase 9: Added AUTHORIZED and REVIEW_REQUIRED)
const validTransitions: Record<WorkOrderStatus, WorkOrderStatus[]> = {
	[WorkOrderStatus.DRAFT]: [WorkOrderStatus.SUBMITTED, WorkOrderStatus.CANCELLED],
	[WorkOrderStatus.SUBMITTED]: [WorkOrderStatus.TRIAGED, WorkOrderStatus.CANCELLED],
	[WorkOrderStatus.TRIAGED]: [WorkOrderStatus.AUTHORIZED, WorkOrderStatus.CANCELLED], // Phase 9: Must go through AUTHORIZED
	[WorkOrderStatus.AUTHORIZED]: [WorkOrderStatus.ASSIGNED, WorkOrderStatus.CANCELLED], // Phase 9: New state
	[WorkOrderStatus.ASSIGNED]: [WorkOrderStatus.SCHEDULED, WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.CANCELLED],
	[WorkOrderStatus.SCHEDULED]: [WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.ON_HOLD, WorkOrderStatus.CANCELLED],
	[WorkOrderStatus.IN_PROGRESS]: [WorkOrderStatus.ON_HOLD, WorkOrderStatus.COMPLETED, WorkOrderStatus.CANCELLED],
	[WorkOrderStatus.ON_HOLD]: [WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.CANCELLED],
	[WorkOrderStatus.COMPLETED]: [WorkOrderStatus.REVIEW_REQUIRED, WorkOrderStatus.INVOICED, WorkOrderStatus.CLOSED], // Phase 9: Added REVIEW_REQUIRED
	[WorkOrderStatus.REVIEW_REQUIRED]: [WorkOrderStatus.COMPLETED, WorkOrderStatus.CLOSED, WorkOrderStatus.CANCELLED], // Phase 9: New state
	[WorkOrderStatus.INVOICED]: [WorkOrderStatus.CLOSED],
	[WorkOrderStatus.CLOSED]: [],
	[WorkOrderStatus.CANCELLED]: []
};

// SLA hours by priority
const SLA_HOURS: Record<string, number> = {
	EMERGENCY: 4,
	HIGH: 24,
	MEDIUM: 72,
	LOW: 168,
	SCHEDULED: 336
};

interface TransitionInput {
	workOrderId: string;
	toStatus: WorkOrderStatus;
	userId: string;
	organizationId: string;
	notes?: string;
	// Optional data for specific transitions
	vendorId?: string;
	scheduledStart?: Date;
	scheduledEnd?: Date;
	actualCost?: number;
	actualHours?: number;
}

interface TransitionResult {
	success: boolean;
	workOrderId: string;
	fromStatus: WorkOrderStatus;
	toStatus: WorkOrderStatus;
	timestamp: string;
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
	currentStatus: WorkOrderStatus;
	error?: string;
}> {
	const workOrder = await prisma.workOrder.findUnique({
		where: { id: input.workOrderId }
	});

	if (!workOrder) {
		return { valid: false, currentStatus: WorkOrderStatus.DRAFT, error: 'Work order not found' };
	}

	const currentStatus = workOrder.status as WorkOrderStatus;
	const allowedTransitions = validTransitions[currentStatus] || [];

	if (!allowedTransitions.includes(input.toStatus)) {
		return {
			valid: false,
			currentStatus,
			error: `Invalid transition from ${currentStatus} to ${input.toStatus}`
		};
	}

	// Additional validation for specific transitions
	if (input.toStatus === WorkOrderStatus.ASSIGNED && !input.vendorId) {
		// Check if vendor is already assigned
		if (!workOrder.assignedVendorId) {
			return {
				valid: false,
				currentStatus,
				error: 'Vendor must be assigned before moving to ASSIGNED status'
			};
		}
	}

	return { valid: true, currentStatus };
}

/**
 * Step 2: Update the work order status in the database
 */
async function updateWorkOrderStatus(
	input: TransitionInput,
	fromStatus: WorkOrderStatus
): Promise<void> {
	try {
		await orgTransaction(input.organizationId, async (tx) => {
			// Build update data based on transition
			const updateData: Record<string, unknown> = {
				status: input.toStatus
			};

			// Handle specific transitions
			switch (input.toStatus) {
				case WorkOrderStatus.ASSIGNED:
					if (input.vendorId) {
						updateData.assignedVendorId = input.vendorId;
						updateData.assignedAt = new Date();
					}
					break;

				case WorkOrderStatus.SCHEDULED:
					if (input.scheduledStart) updateData.scheduledStart = input.scheduledStart;
					if (input.scheduledEnd) updateData.scheduledEnd = input.scheduledEnd;
					break;

				case WorkOrderStatus.IN_PROGRESS:
					updateData.actualStart = new Date();
					break;

				case WorkOrderStatus.COMPLETED:
					updateData.actualEnd = new Date();
					if (input.actualCost !== undefined) updateData.actualCost = input.actualCost;
					if (input.actualHours !== undefined) updateData.actualHours = input.actualHours;
					break;

				case WorkOrderStatus.CANCELLED:
					updateData.cancelledAt = new Date();
					updateData.cancelledBy = input.userId;
					break;
			}

			// Update the work order
			await tx.workOrder.update({
				where: { id: input.workOrderId },
				data: updateData
			});

			// Record status history
			await tx.workOrderStatusHistory.create({
				data: {
					workOrderId: input.workOrderId,
					fromStatus,
					toStatus: input.toStatus,
					changedBy: input.userId,
					notes: input.notes
				}
			});
		}, { userId: input.userId, reason: `Transitioning work order from ${fromStatus} to ${input.toStatus}` });

		log.info('updateWorkOrderStatus completed', { workOrderId: input.workOrderId, fromStatus, toStatus: input.toStatus, userId: input.userId });
	} finally {
		await clearOrgContext(input.userId);
	}
}

/**
 * Step 3: Check SLA compliance
 */
async function checkSlaCompliance(workOrderId: string): Promise<{
	isOverdue: boolean;
	hoursRemaining: number | null;
}> {
	const workOrder = await prisma.workOrder.findUnique({
		where: { id: workOrderId },
		select: { slaDeadline: true, status: true }
	});

	if (!workOrder?.slaDeadline) {
		return { isOverdue: false, hoursRemaining: null };
	}

	const now = new Date();
	const deadline = new Date(workOrder.slaDeadline);
	const hoursRemaining = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

	return {
		isOverdue: hoursRemaining < 0,
		hoursRemaining: Math.round(hoursRemaining * 10) / 10
	};
}

/**
 * Step 4: Queue notifications (stub - actual delivery handled by notification service)
 */
async function queueNotifications(
	workOrderId: string,
	fromStatus: WorkOrderStatus,
	toStatus: WorkOrderStatus,
	userId: string
): Promise<void> {
	// In a full implementation, this would:
	// 1. Determine who needs to be notified based on the transition
	// 2. Create notification records in the database
	// 3. Trigger the notification delivery service

	// For now, we log the notification intent
	log.info('Notification queued', { workOrderId, fromStatus, toStatus, userId });

	// Example notification rules:
	// - SUBMITTED: Notify managers
	// - ASSIGNED: Notify vendor
	// - COMPLETED: Notify requester
	// - SLA breach: Notify managers + escalation chain
}

// ============================================================================
// Main Workflow
// ============================================================================

/**
 * Work Order Lifecycle Workflow
 *
 * Durably processes a work order status transition with:
 * - Validation
 * - Database update
 * - SLA checking
 * - Notification queueing
 */
async function workOrderTransitionWorkflow(input: TransitionInput): Promise<TransitionResult> {
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
				workOrderId: input.workOrderId,
				fromStatus: validation.currentStatus,
				toStatus: input.toStatus,
				timestamp: new Date().toISOString(),
				error: validation.error
			};
		}

		// Step 2: Update database
		await DBOS.runStep(
			() => updateWorkOrderStatus(input, validation.currentStatus),
			{ name: 'updateWorkOrderStatus' }
		);
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'updated', status: input.toStatus });

		// Step 3: Check SLA compliance
		const slaStatus = await DBOS.runStep(
			() => checkSlaCompliance(input.workOrderId),
			{ name: 'checkSlaCompliance' }
		);
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'sla_checked', ...slaStatus });

		// Step 4: Queue notifications
		await DBOS.runStep(
			() => queueNotifications(
				input.workOrderId,
				validation.currentStatus,
				input.toStatus,
				input.userId
			),
			{ name: 'queueNotifications' }
		);
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'notifications_queued' });

		// Log SLA warning if applicable
		if (slaStatus.isOverdue) {
			log.warn('Work order is OVERDUE', { workflowId, workOrderId: input.workOrderId, hoursOverdue: Math.abs(slaStatus.hoursRemaining!) });
		}

		return {
			success: true,
			workOrderId: input.workOrderId,
			fromStatus: validation.currentStatus,
			toStatus: input.toStatus,
			timestamp: new Date().toISOString()
		};
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;

		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: ActivityActionType.WORKFLOW_FAILED,
			errorType: WorkflowErrorType.WORK_ORDER_LIFECYCLE_ERROR
		});

		return {
			success: false,
			workOrderId: input.workOrderId,
			fromStatus: WorkOrderStatus.DRAFT, // Unknown at this point
			toStatus: input.toStatus,
			timestamp: new Date().toISOString(),
			error: errorMessage
		};
	}

	// This path should be unreachable due to return in try/catch,
	// but kept for TypeScript safety if logic changes
	return {
		success: false,
		workOrderId: input.workOrderId,
		fromStatus: WorkOrderStatus.DRAFT,
		toStatus: input.toStatus,
		timestamp: new Date().toISOString(),
		error: 'Unknown error occurred'
	};
}

// Register the workflow with DBOS
export const workOrderLifecycle_v1 = DBOS.registerWorkflow(workOrderTransitionWorkflow);

// ============================================================================
// Workflow Helpers
// ============================================================================

/**
 * Start a work order transition workflow
 */
export async function startWorkOrderTransition(
	input: TransitionInput,
	workflowId?: string
): Promise<{ workflowId: string }> {
	const id = workflowId || `wo-transition-${input.workOrderId}-${Date.now()}`;
	await DBOS.startWorkflow(workOrderLifecycle_v1, { workflowID: id })(input);
	return { workflowId: id };
}

/**
 * Get the status of a work order transition workflow
 */
export async function getWorkOrderTransitionStatus(
	workflowId: string
): Promise<{ step: string;[key: string]: unknown } | null> {
	const status = await DBOS.getEvent(workflowId, WORKFLOW_STATUS_EVENT, 0);
	return status as { step: string;[key: string]: unknown } | null;
}

/**
 * Check if a work order transition workflow had an error
 */
export async function getWorkOrderTransitionError(
	workflowId: string
): Promise<{ error: string } | null> {
	const error = await DBOS.getEvent(workflowId, WORKFLOW_ERROR_EVENT, 0);
	return error as { error: string } | null;
}

// Export types
export type { TransitionInput, TransitionResult };
