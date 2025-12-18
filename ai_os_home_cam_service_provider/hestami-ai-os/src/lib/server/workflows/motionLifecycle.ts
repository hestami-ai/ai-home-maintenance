/**
 * Motion Lifecycle Workflow (v1)
 *
 * DBOS durable workflow for managing board motion lifecycle.
 * Handles: proposal, seconding, voting, and outcome determination.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import type { BoardMotionStatus } from '../../../../generated/prisma/client.js';

// Event keys for workflow status tracking
const WORKFLOW_STATUS_EVENT = 'motion_status';
const WORKFLOW_ERROR_EVENT = 'motion_error';

// Valid status transitions (Phase 11: Full governance lifecycle)
const validTransitions: Record<BoardMotionStatus, BoardMotionStatus[]> = {
	PROPOSED: ['SECONDED', 'WITHDRAWN', 'TABLED'],
	SECONDED: ['UNDER_DISCUSSION', 'UNDER_VOTE', 'WITHDRAWN', 'TABLED'],
	UNDER_DISCUSSION: ['UNDER_VOTE', 'TABLED', 'WITHDRAWN'],
	UNDER_VOTE: ['APPROVED', 'DENIED', 'TABLED'],
	TABLED: ['PROPOSED', 'WITHDRAWN'], // Can be brought back from table
	APPROVED: [], // Terminal state
	DENIED: [], // Terminal state
	WITHDRAWN: [] // Terminal state
};

interface TransitionInput {
	motionId: string;
	toStatus: BoardMotionStatus;
	userId: string;
	secondedById?: string;
	notes?: string;
}

interface TransitionResult {
	success: boolean;
	motionId: string;
	fromStatus: BoardMotionStatus;
	toStatus: BoardMotionStatus;
	timestamp: string;
	error?: string;
	voteResults?: {
		yes: number;
		no: number;
		abstain: number;
		passed: boolean;
	};
}

// ============================================================================
// Workflow Steps
// ============================================================================

/**
 * Step 1: Validate the transition is allowed
 */
async function validateTransition(input: TransitionInput): Promise<{
	valid: boolean;
	currentStatus: BoardMotionStatus;
	motion?: {
		id: string;
		title: string;
		motionNumber: string;
		associationId: string;
		meetingId: string | null;
	};
	error?: string;
}> {
	const motion = await prisma.boardMotion.findUnique({
		where: { id: input.motionId }
	});

	if (!motion) {
		return { valid: false, currentStatus: 'PROPOSED', error: 'Motion not found' };
	}

	const currentStatus = motion.status as BoardMotionStatus;
	const allowedTransitions = validTransitions[currentStatus] || [];

	if (!allowedTransitions.includes(input.toStatus)) {
		return {
			valid: false,
			currentStatus,
			error: `Invalid transition from ${currentStatus} to ${input.toStatus}`
		};
	}

	// Additional validation for SECONDED transition
	if (input.toStatus === 'SECONDED' && !input.secondedById) {
		return {
			valid: false,
			currentStatus,
			error: 'secondedById is required to second a motion'
		};
	}

	return {
		valid: true,
		currentStatus,
		motion: {
			id: motion.id,
			title: motion.title,
			motionNumber: motion.motionNumber,
			associationId: motion.associationId,
			meetingId: motion.meetingId
		}
	};
}

/**
 * Step 2: Update the motion status in the database
 */
async function updateMotionStatus(
	input: TransitionInput,
	fromStatus: BoardMotionStatus
): Promise<void> {
	const updateData: Record<string, unknown> = {
		status: input.toStatus
	};

	// Add secondedById if transitioning to SECONDED
	if (input.toStatus === 'SECONDED' && input.secondedById) {
		updateData.secondedById = input.secondedById;
	}

	// Add outcome notes if provided
	if (input.notes) {
		updateData.outcomeNotes = input.notes;
	}

	// Set decidedAt for terminal states
	if (['APPROVED', 'DENIED', 'WITHDRAWN'].includes(input.toStatus)) {
		updateData.decidedAt = new Date();
		if (input.toStatus === 'APPROVED') {
			updateData.outcome = 'PASSED';
		} else if (input.toStatus === 'DENIED') {
			updateData.outcome = 'FAILED';
		} else if (input.toStatus === 'WITHDRAWN') {
			updateData.outcome = 'WITHDRAWN';
		}
	}

	// Set outcome for TABLED
	if (input.toStatus === 'TABLED') {
		updateData.outcome = 'TABLED';
	}

	await prisma.boardMotion.update({
		where: { id: input.motionId },
		data: updateData
	});
}

/**
 * Step 3: Queue notifications based on transition
 */
async function queueNotifications(
	motionId: string,
	fromStatus: BoardMotionStatus,
	toStatus: BoardMotionStatus,
	motion: { title: string; motionNumber: string; associationId: string }
): Promise<void> {
	console.log(`[Workflow] Motion notification queued: ${motion.motionNumber} "${motion.title}" transitioned from ${fromStatus} to ${toStatus}`);

	// In a full implementation:
	// - SECONDED: Notify board that motion is ready for discussion
	// - UNDER_VOTE: Notify eligible voters that voting is open
	// - APPROVED/DENIED: Notify stakeholders of outcome
	// - TABLED: Notify that motion has been postponed
}

/**
 * Step 4: Tally votes if closing voting
 */
async function tallyVotes(motionId: string): Promise<{
	yes: number;
	no: number;
	abstain: number;
	passed: boolean;
}> {
	const votes = await prisma.vote.findMany({
		where: { motionId },
		include: { ballots: true }
	});

	const allBallots = votes.flatMap(v => v.ballots);
	const yes = allBallots.filter(b => b.choice === 'YES').length;
	const no = allBallots.filter(b => b.choice === 'NO').length;
	const abstain = allBallots.filter(b => b.choice === 'ABSTAIN').length;
	const passed = yes > no;

	return { yes, no, abstain, passed };
}

/**
 * Step 5: Trigger downstream actions on approval
 */
async function triggerDownstreamActions(
	motionId: string,
	motion: { associationId: string; meetingId: string | null }
): Promise<void> {
	console.log(`[Workflow] Triggering downstream actions for approved motion ${motionId}`);

	// In a full implementation:
	// - Create Resolution record linked to motion
	// - If motion approves ARC request, update ARC status
	// - If motion authorizes work order, create work order
	// - If motion changes policy, update PolicyDocument
}

// ============================================================================
// Main Workflow
// ============================================================================

async function motionTransitionWorkflow(input: TransitionInput): Promise<TransitionResult> {
	try {
		// Step 1: Validate transition
		const validation = await DBOS.runStep(
			() => validateTransition(input),
			{ name: 'validateTransition' }
		);
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'validated' });

		if (!validation.valid || !validation.motion) {
			return {
				success: false,
				motionId: input.motionId,
				fromStatus: validation.currentStatus,
				toStatus: input.toStatus,
				timestamp: new Date().toISOString(),
				error: validation.error
			};
		}

		// Step 2: If transitioning to APPROVED/DENIED, tally votes first
		let voteResults: { yes: number; no: number; abstain: number; passed: boolean } | undefined;
		if (input.toStatus === 'APPROVED' || input.toStatus === 'DENIED') {
			voteResults = await DBOS.runStep(
				() => tallyVotes(input.motionId),
				{ name: 'tallyVotes' }
			);
			await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'votes_tallied', results: voteResults });

			// Override toStatus based on actual vote results
			if (voteResults.passed && input.toStatus === 'DENIED') {
				input.toStatus = 'APPROVED';
			} else if (!voteResults.passed && input.toStatus === 'APPROVED') {
				input.toStatus = 'DENIED';
			}
		}

		// Step 3: Update database
		await DBOS.runStep(
			() => updateMotionStatus(input, validation.currentStatus),
			{ name: 'updateMotionStatus' }
		);
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'updated', status: input.toStatus });

		// Step 4: Queue notifications
		await DBOS.runStep(
			() => queueNotifications(
				input.motionId,
				validation.currentStatus,
				input.toStatus,
				validation.motion!
			),
			{ name: 'queueNotifications' }
		);
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'notifications_queued' });

		// Step 5: Trigger downstream actions if approved
		if (input.toStatus === 'APPROVED') {
			await DBOS.runStep(
				() => triggerDownstreamActions(input.motionId, validation.motion!),
				{ name: 'triggerDownstreamActions' }
			);
			await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'downstream_triggered' });
		}

		return {
			success: true,
			motionId: input.motionId,
			fromStatus: validation.currentStatus,
			toStatus: input.toStatus,
			timestamp: new Date().toISOString(),
			voteResults
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		return {
			success: false,
			motionId: input.motionId,
			fromStatus: 'PROPOSED',
			toStatus: input.toStatus,
			timestamp: new Date().toISOString(),
			error: errorMessage
		};
	}
}

// Register the workflow with DBOS
export const motionLifecycle_v1 = DBOS.registerWorkflow(motionTransitionWorkflow);

// ============================================================================
// Workflow Helpers
// ============================================================================

export async function startMotionTransition(
	input: TransitionInput,
	workflowId?: string
): Promise<{ workflowId: string }> {
	const id = workflowId || `motion-transition-${input.motionId}-${Date.now()}`;
	await DBOS.startWorkflow(motionLifecycle_v1, { workflowID: id })(input);
	return { workflowId: id };
}

export async function getMotionTransitionStatus(
	workflowId: string
): Promise<{ step: string; [key: string]: unknown } | null> {
	const status = await DBOS.getEvent(workflowId, WORKFLOW_STATUS_EVENT, 0);
	return status as { step: string; [key: string]: unknown } | null;
}

export type { TransitionInput as MotionTransitionInput, TransitionResult as MotionTransitionResult };
