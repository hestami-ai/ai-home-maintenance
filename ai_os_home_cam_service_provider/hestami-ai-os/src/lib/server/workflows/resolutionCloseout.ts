/**
 * Resolution Closeout Workflow (v1)
 *
 * DBOS durable workflow for managing resolution lifecycle and downstream actions.
 * Handles: linking to motions, creating work orders, updating policies.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import type { ResolutionStatus, WorkOrderStatus, WorkOrderPriority } from '../../../../generated/prisma/client.js';
import { recordSpanError } from '../api/middleware/tracing.js';

// Event keys for workflow status tracking
const WORKFLOW_STATUS_EVENT = 'resolution_status';
const WORKFLOW_ERROR_EVENT = 'resolution_error';

// Valid status transitions
const validTransitions: Record<ResolutionStatus, ResolutionStatus[]> = {
	PROPOSED: ['ADOPTED', 'ARCHIVED'],
	ADOPTED: ['SUPERSEDED', 'ARCHIVED'],
	SUPERSEDED: ['ARCHIVED'],
	ARCHIVED: []
};

interface CloseoutInput {
	resolutionId: string;
	toStatus: ResolutionStatus;
	userId: string;
	motionId?: string;
	createWorkOrder?: {
		title: string;
		description?: string;
		priority?: string;
	};
	updatePolicyId?: string;
	notes?: string;
}

interface CloseoutResult {
	success: boolean;
	resolutionId: string;
	fromStatus: ResolutionStatus;
	toStatus: ResolutionStatus;
	timestamp: string;
	createdWorkOrderId?: string;
	updatedPolicyId?: string;
	error?: string;
}

// ============================================================================
// Workflow Steps
// ============================================================================

/**
 * Step 1: Validate the transition is allowed
 */
async function validateTransition(input: CloseoutInput): Promise<{
	valid: boolean;
	currentStatus: ResolutionStatus;
	resolution?: {
		id: string;
		title: string;
		organizationId: string;
		associationId: string;
		boardId: string | null;
	};
	error?: string;
}> {
	const resolution = await prisma.resolution.findUnique({
		where: { id: input.resolutionId },
		include: { association: { select: { organizationId: true } } }
	});

	if (!resolution) {
		return { valid: false, currentStatus: 'PROPOSED', error: 'Resolution not found' };
	}

	const currentStatus = resolution.status as ResolutionStatus;
	const allowedTransitions = validTransitions[currentStatus] || [];

	if (!allowedTransitions.includes(input.toStatus)) {
		return {
			valid: false,
			currentStatus,
			error: `Invalid transition from ${currentStatus} to ${input.toStatus}`
		};
	}

	return {
		valid: true,
		currentStatus,
		resolution: {
			id: resolution.id,
			title: resolution.title,
			organizationId: resolution.association.organizationId,
			associationId: resolution.associationId,
			boardId: resolution.boardId
		}
	};
}

/**
 * Step 2: Link resolution to motion if provided
 */
async function linkToMotion(
	resolutionId: string,
	motionId: string
): Promise<void> {
	// Verify motion exists
	const motion = await prisma.boardMotion.findUnique({
		where: { id: motionId }
	});

	if (!motion) {
		throw new Error(`Motion ${motionId} not found`);
	}

	await prisma.resolution.update({
		where: { id: resolutionId },
		data: { motionId }
	});
}

/**
 * Step 3: Update the resolution status
 */
async function updateResolutionStatus(
	input: CloseoutInput,
	fromStatus: ResolutionStatus
): Promise<void> {
	const updateData: Record<string, unknown> = {
		status: input.toStatus
	};

	// Set adoptedAt for ADOPTED status
	if (input.toStatus === 'ADOPTED') {
		updateData.adoptedAt = new Date();
		updateData.adoptedBy = input.userId;
	}

	await prisma.resolution.update({
		where: { id: input.resolutionId },
		data: updateData
	});
}

/**
 * Step 4: Create downstream work order if requested
 */
async function createDownstreamWorkOrder(
	resolution: { id: string; organizationId: string; associationId: string },
	workOrderData: { title: string; description?: string; priority?: string },
	userId: string
): Promise<string> {
	// Generate work order number
	const year = new Date().getFullYear();
	const count = await prisma.workOrder.count({
		where: {
			associationId: resolution.associationId,
			workOrderNumber: { startsWith: `WO-${year}-` }
		}
	});
	const workOrderNumber = `WO-${year}-${String(count + 1).padStart(5, '0')}`;

	const workOrder = await prisma.workOrder.create({
		data: {
			organizationId: resolution.organizationId,
			associationId: resolution.associationId,
			workOrderNumber,
			title: workOrderData.title,
			description: workOrderData.description || '',
			category: 'OTHER',
			priority: (workOrderData.priority as WorkOrderPriority) ?? ('MEDIUM' as WorkOrderPriority),
			status: 'DRAFT' as WorkOrderStatus,
			originType: 'BOARD_DIRECTIVE',
			resolutionId: resolution.id,
			requestedBy: userId,
			requestedAt: new Date()
		}
	});

	return workOrder.id;
}

/**
 * Step 5: Update policy document if requested
 */
async function updatePolicyDocument(
	policyId: string,
	resolutionId: string
): Promise<void> {
	await prisma.policyDocument.update({
		where: { id: policyId },
		data: { resolutionId }
	});
}

/**
 * Step 6: Queue notifications
 */
async function queueNotifications(
	resolutionId: string,
	fromStatus: ResolutionStatus,
	toStatus: ResolutionStatus,
	resolution: { title: string; associationId: string }
): Promise<void> {
	console.log(`[Workflow] Resolution notification queued: "${resolution.title}" transitioned from ${fromStatus} to ${toStatus}`);

	// In a full implementation:
	// - ADOPTED: Notify stakeholders of new resolution
	// - SUPERSEDED: Notify that resolution has been replaced
	// - Work order created: Notify assigned parties
}

// ============================================================================
// Main Workflow
// ============================================================================

async function resolutionLifecycleWorkflow(input: CloseoutInput): Promise<CloseoutResult> {
	try {
		// Step 1: Validate transition
		const validation = await DBOS.runStep(
			() => validateTransition(input),
			{ name: 'validateTransition' }
		);
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'validated' });

		if (!validation.valid || !validation.resolution) {
			return {
				success: false,
				resolutionId: input.resolutionId,
				fromStatus: validation.currentStatus,
				toStatus: input.toStatus,
				timestamp: new Date().toISOString(),
				error: validation.error
			};
		}

		// Step 2: Link to motion if provided
		if (input.motionId) {
			await DBOS.runStep(
				() => linkToMotion(input.resolutionId, input.motionId!),
				{ name: 'linkToMotion' }
			);
			await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'motion_linked' });
		}

		// Step 3: Update resolution status
		await DBOS.runStep(
			() => updateResolutionStatus(input, validation.currentStatus),
			{ name: 'updateResolutionStatus' }
		);
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'status_updated', status: input.toStatus });

		// Step 4: Create work order if requested
		let createdWorkOrderId: string | undefined;
		if (input.createWorkOrder && input.toStatus === 'ADOPTED') {
			createdWorkOrderId = await DBOS.runStep(
				() => createDownstreamWorkOrder(
					validation.resolution!,
					input.createWorkOrder!,
					input.userId
				),
				{ name: 'createWorkOrder' }
			);
			await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'work_order_created', workOrderId: createdWorkOrderId });
		}

		// Step 5: Update policy if requested
		let updatedPolicyId: string | undefined;
		if (input.updatePolicyId && input.toStatus === 'ADOPTED') {
			await DBOS.runStep(
				() => updatePolicyDocument(input.updatePolicyId!, input.resolutionId),
				{ name: 'updatePolicy' }
			);
			updatedPolicyId = input.updatePolicyId;
			await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'policy_updated', policyId: updatedPolicyId });
		}

		// Step 6: Queue notifications
		await DBOS.runStep(
			() => queueNotifications(
				input.resolutionId,
				validation.currentStatus,
				input.toStatus,
				validation.resolution!
			),
			{ name: 'queueNotifications' }
		);
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'notifications_queued' });

		return {
			success: true,
			resolutionId: input.resolutionId,
			fromStatus: validation.currentStatus,
			toStatus: input.toStatus,
			timestamp: new Date().toISOString(),
			createdWorkOrderId,
			updatedPolicyId
		};
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;

		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'RESOLUTION_CLOSEOUT_ERROR'
		});

		return {
			success: false,
			resolutionId: input.resolutionId,
			fromStatus: 'PROPOSED',
			toStatus: input.toStatus,
			timestamp: new Date().toISOString(),
			error: errorMessage
		};
	}
}

// Register the workflow with DBOS
export const resolutionCloseout_v1 = DBOS.registerWorkflow(resolutionLifecycleWorkflow);

// ============================================================================
// Workflow Helpers
// ============================================================================

export async function startResolutionCloseout(
	input: CloseoutInput,
	idempotencyKey: string
): Promise<CloseoutResult> {
	const handle = await DBOS.startWorkflow(resolutionCloseout_v1, { workflowID: idempotencyKey })(input);
	return handle.getResult();
}

export async function getResolutionCloseoutStatus(
	workflowId: string
): Promise<{ step: string;[key: string]: unknown } | null> {
	const status = await DBOS.getEvent(workflowId, WORKFLOW_STATUS_EVENT, 0);
	return status as { step: string;[key: string]: unknown } | null;
}

export type { CloseoutInput as ResolutionCloseoutInput, CloseoutResult as ResolutionCloseoutResult };
