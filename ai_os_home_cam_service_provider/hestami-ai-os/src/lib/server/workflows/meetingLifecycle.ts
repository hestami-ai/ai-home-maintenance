/**
 * Meeting Lifecycle Workflow (v1)
 *
 * DBOS durable workflow for managing meeting lifecycle.
 * Handles: notice generation, agenda distribution, meeting execution, and minutes approval.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import type { MeetingStatus } from '../../../../generated/prisma/client.js';
import { recordSpanError } from '../api/middleware/tracing.js';

// Event keys for workflow status tracking
const WORKFLOW_STATUS_EVENT = 'meeting_status';
const WORKFLOW_ERROR_EVENT = 'meeting_error';

// Valid status transitions (Phase 11: Full governance lifecycle)
const validTransitions: Record<MeetingStatus, MeetingStatus[]> = {
	SCHEDULED: ['IN_SESSION', 'CANCELLED'],
	IN_SESSION: ['ADJOURNED', 'CANCELLED'],
	ADJOURNED: ['MINUTES_DRAFT'],
	MINUTES_DRAFT: ['MINUTES_APPROVED', 'ADJOURNED'], // Can go back to ADJOURNED for revisions
	MINUTES_APPROVED: ['ARCHIVED'],
	ARCHIVED: [],
	CANCELLED: []
};

interface TransitionInput {
	meetingId: string;
	toStatus: MeetingStatus;
	userId: string;
	notes?: string;
}

interface TransitionResult {
	success: boolean;
	meetingId: string;
	fromStatus: MeetingStatus;
	toStatus: MeetingStatus;
	timestamp: string;
	error?: string;
}

// ============================================================================
// Workflow Steps
// ============================================================================

/**
 * Step 1: Validate the transition is allowed
 */
async function validateTransition(input: TransitionInput): Promise<{
	valid: boolean;
	currentStatus: MeetingStatus;
	meeting?: {
		id: string;
		title: string;
		associationId: string;
		scheduledFor: Date;
	};
	error?: string;
}> {
	const meeting = await prisma.meeting.findUnique({
		where: { id: input.meetingId }
	});

	if (!meeting) {
		return { valid: false, currentStatus: 'SCHEDULED', error: 'Meeting not found' };
	}

	const currentStatus = meeting.status as MeetingStatus;
	const allowedTransitions = validTransitions[currentStatus] || [];

	if (!allowedTransitions.includes(input.toStatus)) {
		return {
			valid: false,
			currentStatus,
			error: `Invalid transition from ${currentStatus} to ${input.toStatus}`
		};
	}

	// Additional validation for IN_SESSION transition
	if (input.toStatus === 'IN_SESSION') {
		// Check if meeting has agenda items
		const agendaCount = await prisma.meetingAgendaItem.count({
			where: { meetingId: input.meetingId }
		});
		if (agendaCount === 0) {
			return {
				valid: false,
				currentStatus,
				error: 'Meeting must have at least one agenda item before starting session'
			};
		}
	}

	return {
		valid: true,
		currentStatus,
		meeting: {
			id: meeting.id,
			title: meeting.title,
			associationId: meeting.associationId,
			scheduledFor: meeting.scheduledFor
		}
	};
}

/**
 * Step 2: Update the meeting status in the database
 */
async function updateMeetingStatus(
	input: TransitionInput,
	fromStatus: MeetingStatus
): Promise<void> {
	await prisma.meeting.update({
		where: { id: input.meetingId },
		data: { status: input.toStatus }
	});
}

/**
 * Step 3: Queue notifications based on transition
 */
async function queueNotifications(
	meetingId: string,
	fromStatus: MeetingStatus,
	toStatus: MeetingStatus,
	meeting: { title: string; associationId: string; scheduledFor: Date }
): Promise<void> {
	console.log(`[Workflow] Meeting notification queued: ${meeting.title} transitioned from ${fromStatus} to ${toStatus}`);

	// In a full implementation:
	// - SCHEDULED: Send meeting notice to all members
	// - HELD: Notify that minutes are pending
	// - CANCELLED: Send cancellation notice
}

/**
 * Step 4: Create minutes placeholder if meeting was held
 */
async function createMinutesPlaceholder(
	meetingId: string,
	userId: string
): Promise<void> {
	// Check if minutes already exist
	const existingMinutes = await prisma.meetingMinutes.findUnique({
		where: { meetingId }
	});

	if (!existingMinutes) {
		await prisma.meetingMinutes.create({
			data: {
				meetingId,
				recordedBy: userId,
				content: ''
			}
		});
	}
}

// ============================================================================
// Main Workflow
// ============================================================================

async function meetingTransitionWorkflow(input: TransitionInput): Promise<TransitionResult> {
	try {
		// Step 1: Validate transition
		const validation = await DBOS.runStep(
			() => validateTransition(input),
			{ name: 'validateTransition' }
		);
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'validated' });

		if (!validation.valid || !validation.meeting) {
			return {
				success: false,
				meetingId: input.meetingId,
				fromStatus: validation.currentStatus,
				toStatus: input.toStatus,
				timestamp: new Date().toISOString(),
				error: validation.error
			};
		}

		// Step 2: Update database
		await DBOS.runStep(
			() => updateMeetingStatus(input, validation.currentStatus),
			{ name: 'updateMeetingStatus' }
		);
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'updated', status: input.toStatus });

		// Step 3: Queue notifications
		await DBOS.runStep(
			() => queueNotifications(
				input.meetingId,
				validation.currentStatus,
				input.toStatus,
				validation.meeting!
			),
			{ name: 'queueNotifications' }
		);
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'notifications_queued' });

		// Step 4: Create minutes placeholder if meeting was adjourned
		if (input.toStatus === 'ADJOURNED') {
			await DBOS.runStep(
				() => createMinutesPlaceholder(input.meetingId, input.userId),
				{ name: 'createMinutesPlaceholder' }
			);
			await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'minutes_created' });
		}

		return {
			success: true,
			meetingId: input.meetingId,
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
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'MEETING_LIFECYCLE_ERROR'
		});

		return {
			success: false,
			meetingId: input.meetingId,
			fromStatus: 'SCHEDULED',
			toStatus: input.toStatus,
			timestamp: new Date().toISOString(),
			error: errorMessage
		};
	}
}

// Register the workflow with DBOS
export const meetingLifecycle_v1 = DBOS.registerWorkflow(meetingTransitionWorkflow);

// ============================================================================
// Workflow Helpers
// ============================================================================

export async function startMeetingTransition(
	input: TransitionInput,
	workflowId?: string
): Promise<{ workflowId: string }> {
	const id = workflowId || `meeting-transition-${input.meetingId}-${Date.now()}`;
	await DBOS.startWorkflow(meetingLifecycle_v1, { workflowID: id })(input);
	return { workflowId: id };
}

export async function getMeetingTransitionStatus(
	workflowId: string
): Promise<{ step: string;[key: string]: unknown } | null> {
	const status = await DBOS.getEvent(workflowId, WORKFLOW_STATUS_EVENT, 0);
	return status as { step: string;[key: string]: unknown } | null;
}

export type { TransitionInput as MeetingTransitionInput, TransitionResult as MeetingTransitionResult };
