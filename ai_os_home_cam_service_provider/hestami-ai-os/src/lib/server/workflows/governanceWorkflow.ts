/**
 * Governance Workflow (v1)
 *
 * DBOS durable workflow for managing governance operations.
 * Handles: createBoard, createMeeting, createMotion, createResolution.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import type { Prisma } from '../../../../generated/prisma/client.js';
import { type EntityWorkflowResult } from './schemas.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger } from './workflowLogger.js';

const log = createWorkflowLogger('GovernanceWorkflow');

// Action types for the unified workflow
export const GovernanceAction = {
	CREATE_BOARD: 'CREATE_BOARD',
	CREATE_MEETING: 'CREATE_MEETING',
	CREATE_MOTION: 'CREATE_MOTION',
	CREATE_RESOLUTION: 'CREATE_RESOLUTION',
	UPDATE_RESOLUTION_STATUS: 'UPDATE_RESOLUTION_STATUS',
	CREATE_POLICY: 'CREATE_POLICY',
	CREATE_POLICY_VERSION: 'CREATE_POLICY_VERSION',
	SET_ACTIVE_POLICY_VERSION: 'SET_ACTIVE_POLICY_VERSION',
	LINK_RESOLUTION_TO_MOTION: 'LINK_RESOLUTION_TO_MOTION',
	SECOND_MOTION: 'SECOND_MOTION',
	UPDATE_MOTION_STATUS: 'UPDATE_MOTION_STATUS',
	RECORD_MOTION_OUTCOME: 'RECORD_MOTION_OUTCOME',
	WITHDRAW_MOTION: 'WITHDRAW_MOTION',
	OPEN_VOTING: 'OPEN_VOTING',
	CLOSE_VOTING: 'CLOSE_VOTING',
	TABLE_MOTION: 'TABLE_MOTION',
	LINK_ARC_TO_MOTION: 'LINK_ARC_TO_MOTION',
	ADD_AGENDA_ITEM: 'ADD_AGENDA_ITEM',
	ADD_MEETING_MINUTES: 'ADD_MEETING_MINUTES',
	RECORD_ATTENDANCE: 'RECORD_ATTENDANCE',
	CREATE_VOTE: 'CREATE_VOTE',
	CAST_BALLOT: 'CAST_BALLOT',
	CLOSE_VOTE: 'CLOSE_VOTE',
	START_MEETING: 'START_MEETING',
	ADJOURN_MEETING: 'ADJOURN_MEETING',
	UPDATE_MINUTES: 'UPDATE_MINUTES',
	APPROVE_MINUTES: 'APPROVE_MINUTES',
	ARCHIVE_MEETING: 'ARCHIVE_MEETING',
	ADD_BOARD_MEMBER: 'ADD_BOARD_MEMBER',
	REMOVE_BOARD_MEMBER: 'REMOVE_BOARD_MEMBER'
} as const;

export type GovernanceAction = (typeof GovernanceAction)[keyof typeof GovernanceAction];

export interface GovernanceWorkflowInput {
	action: GovernanceAction;
	organizationId: string;
	userId: string;
	entityId?: string;
	data: Record<string, unknown>;
}

export interface GovernanceWorkflowResult {
	success: boolean;
	entityId?: string;
	error?: string;
}

// Helper function to record board history
async function recordBoardHistory(
	boardId: string,
	changeType: string,
	detail: Prisma.InputJsonValue | undefined,
	changedBy: string | undefined
) {
	await prisma.boardHistory.create({
		data: {
			boardId,
			changeType,
			detail,
			changedBy
		}
	});
}

// Step functions for each operation
async function createBoard(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const associationId = data.associationId as string;
	const name = data.name as string;
	const description = data.description as string | undefined;

	const board = await prisma.board.create({
		data: {
			organizationId,
			associationId,
			name,
			description
		}
	});

	await recordBoardHistory(board.id, 'BOARD_CREATED', { name }, userId);

	console.log(`[GovernanceWorkflow] CREATE_BOARD board:${board.id} by user ${userId}`);
	return board.id;
}

async function createMeeting(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const boardId = data.boardId as string;
	const title = data.title as string;
	const meetingType = data.meetingType as string;
	const scheduledAt = data.scheduledAt as string;
	const location = data.location as string | undefined;
	const description = data.description as string | undefined;
	const associationId = data.associationId as string | undefined;

	// Get board to find associationId if not provided
	const board = await prisma.board.findUnique({ where: { id: boardId } });
	if (!board) throw new Error('Board not found');

	const meeting = await prisma.meeting.create({
		data: {
			organizationId,
			associationId: associationId || board.associationId,
			boardId,
			title,
			type: meetingType as any,
			status: 'SCHEDULED',
			scheduledFor: new Date(scheduledAt),
			location,
			description,
			createdBy: userId
		}
	});

	await recordBoardHistory(boardId, 'MEETING_SCHEDULED', { meetingId: meeting.id, title }, userId);

	console.log(`[GovernanceWorkflow] CREATE_MEETING meeting:${meeting.id} by user ${userId}`);
	return meeting.id;
}

async function createMotion(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const associationId = data.associationId as string;
	const meetingId = data.meetingId as string | undefined;
	const title = data.title as string;
	const description = data.description as string | undefined;
	const movedBy = data.movedBy as string | undefined;
	const secondedBy = data.secondedBy as string | undefined;
	const category = data.category as string | undefined;

	// Generate motion number
	const year = new Date().getFullYear();
	const count = await prisma.boardMotion.count({
		where: {
			associationId,
			motionNumber: { startsWith: `MOT-${year}-` }
		}
	});
	const motionNumber = `MOT-${year}-${String(count + 1).padStart(4, '0')}`;

	const motion = await prisma.boardMotion.create({
		data: {
			associationId,
			meetingId,
			motionNumber,
			title,
			description,
			movedById: movedBy,
			secondedById: secondedBy,
			category: category as any,
			status: 'PROPOSED',
			createdBy: userId
		}
	});

	console.log(`[GovernanceWorkflow] CREATE_MOTION motion:${motion.id} by user ${userId}`);
	return motion.id;
}

async function createResolution(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const associationId = data.associationId as string;
	const title = data.title as string;
	const content = data.content as string;
	const effectiveDate = data.effectiveDate as string | undefined;
	const expirationDate = data.expirationDate as string | undefined;
	const category = data.category as string | undefined;
	const motionId = data.motionId as string | undefined;

	const resolution = await prisma.resolution.create({
		data: {
			associationId,
			title,
			summary: content,
			effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
			motionId,
			status: 'PROPOSED'
		}
	});

	console.log(`[GovernanceWorkflow] CREATE_RESOLUTION resolution:${resolution.id} by user ${userId}`);
	return resolution.id;
}

async function secondMotion(
	organizationId: string,
	userId: string,
	motionId: string,
	data: Record<string, unknown>
): Promise<string> {
	const secondedById = data.secondedById as string;

	await prisma.boardMotion.update({
		where: { id: motionId },
		data: {
			secondedById,
			status: 'SECONDED'
		}
	});

	console.log(`[GovernanceWorkflow] SECOND_MOTION motion:${motionId} by user ${userId}`);
	return motionId;
}

async function updateMotionStatus(
	organizationId: string,
	userId: string,
	motionId: string,
	data: Record<string, unknown>
): Promise<string> {
	const status = data.status as string;
	const outcomeNotes = data.notes as string | undefined;

	await prisma.boardMotion.update({
		where: { id: motionId },
		data: {
			status: status as any,
			outcomeNotes
		}
	});

	console.log(`[GovernanceWorkflow] UPDATE_MOTION_STATUS motion:${motionId} status:${status} by user ${userId}`);
	return motionId;
}

async function recordMotionOutcome(
	organizationId: string,
	userId: string,
	motionId: string,
	data: Record<string, unknown>
): Promise<string> {
	const outcome = data.outcome as string;
	const outcomeNotes = data.notes as string | undefined;

	await prisma.boardMotion.update({
		where: { id: motionId },
		data: {
			outcome: outcome as any,
			outcomeNotes,
			decidedAt: new Date()
		}
	});

	console.log(`[GovernanceWorkflow] RECORD_MOTION_OUTCOME motion:${motionId} outcome:${outcome} by user ${userId}`);
	return motionId;
}

async function withdrawMotion(
	organizationId: string,
	userId: string,
	motionId: string,
	data: Record<string, unknown>
): Promise<string> {
	const reason = data.reason as string | undefined;

	await prisma.boardMotion.update({
		where: { id: motionId },
		data: {
			status: 'WITHDRAWN',
			outcome: 'WITHDRAWN',
			outcomeNotes: reason
		}
	});

	console.log(`[GovernanceWorkflow] WITHDRAW_MOTION motion:${motionId} by user ${userId}`);
	return motionId;
}

async function openVoting(
	organizationId: string,
	userId: string,
	motionId: string,
	data: Record<string, unknown>
): Promise<string> {
	const meetingId = data.meetingId as string;
	const question = data.question as string || 'Motion vote';

	const vote = await prisma.vote.create({
		data: {
			meetingId,
			motionId,
			question,
			createdBy: userId
		}
	});

	await prisma.boardMotion.update({
		where: { id: motionId },
		data: { status: 'UNDER_VOTE', voteId: vote.id }
	});

	console.log(`[GovernanceWorkflow] OPEN_VOTING vote:${vote.id} for motion:${motionId} by user ${userId}`);
	return vote.id;
}

async function closeVoting(
	organizationId: string,
	userId: string,
	motionId: string,
	data: Record<string, unknown>
): Promise<string> {
	const outcome = data.outcome as string;
	const outcomeNotes = data.outcomeNotes as string | undefined;

	await prisma.$transaction(async (tx) => {
		// Close all votes for this motion
		await tx.vote.updateMany({
			where: { motionId },
			data: { closedAt: new Date() }
		});

		// Update motion with results
		await tx.boardMotion.update({
			where: { id: motionId },
			data: {
				status: outcome as any,
				outcome: outcome as any,
				outcomeNotes,
				decidedAt: new Date()
			}
		});
	});

	console.log(`[GovernanceWorkflow] CLOSE_VOTING motion:${motionId} outcome:${outcome} by user ${userId}`);
	return motionId;
}

async function tableMotion(
	organizationId: string,
	userId: string,
	motionId: string,
	data: Record<string, unknown>
): Promise<string> {
	const reason = data.reason as string | undefined;

	await prisma.boardMotion.update({
		where: { id: motionId },
		data: {
			status: 'TABLED',
			outcome: 'TABLED',
			outcomeNotes: reason
		}
	});

	console.log(`[GovernanceWorkflow] TABLE_MOTION motion:${motionId} by user ${userId}`);
	return motionId;
}

async function linkArcToMotion(
	organizationId: string,
	userId: string,
	motionId: string,
	data: Record<string, unknown>
): Promise<string> {
	const arcRequestId = data.arcRequestId as string;
	const motionStatus = data.motionStatus as string;

	const newArcStatus = motionStatus === 'APPROVED' ? 'APPROVED' : 'DENIED';

	await prisma.aRCRequest.update({
		where: { id: arcRequestId },
		data: {
			status: newArcStatus as any,
			decisionDate: new Date()
		}
	});

	console.log(`[GovernanceWorkflow] LINK_ARC_TO_MOTION arc:${arcRequestId} motion:${motionId} status:${newArcStatus} by user ${userId}`);
	return arcRequestId;
}

async function updateResolutionStatus(
	organizationId: string,
	userId: string,
	resolutionId: string,
	data: Record<string, unknown>
): Promise<string> {
	const status = data.status as string;

	await prisma.resolution.update({
		where: { id: resolutionId },
		data: { status: status as any }
	});

	console.log(`[GovernanceWorkflow] UPDATE_RESOLUTION_STATUS resolution:${resolutionId} status:${status} by user ${userId}`);
	return resolutionId;
}

async function createPolicy(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const policy = await prisma.policyDocument.create({
		data: {
			organizationId,
			associationId: data.associationId as string,
			resolutionId: data.resolutionId as string | undefined,
			title: data.title as string,
			description: data.description as string | undefined,
			status: 'DRAFT'
		}
	});

	console.log(`[GovernanceWorkflow] CREATE_POLICY policy:${policy.id} by user ${userId}`);
	return policy.id;
}

async function createPolicyVersion(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const policyDocumentId = data.policyDocumentId as string;

	// Get current max version count
	const versionCount = await prisma.policyVersion.count({
		where: { policyDocumentId }
	});
	const nextVersion = `v${versionCount + 1}`;

	const version = await prisma.policyVersion.create({
		data: {
			policyDocumentId,
			version: nextVersion,
			content: data.content as string,
			status: 'DRAFT'
		}
	});

	console.log(`[GovernanceWorkflow] CREATE_POLICY_VERSION version:${version.id} ${nextVersion} by user ${userId}`);
	return version.id;
}

async function setActivePolicyVersion(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const policyDocumentId = data.policyDocumentId as string;
	const versionId = data.versionId as string;

	// Get the version string
	const version = await prisma.policyVersion.findUnique({ where: { id: versionId } });
	if (!version) throw new Error('Policy version not found');

	await prisma.$transaction(async (tx) => {
		// Deactivate all versions
		await tx.policyVersion.updateMany({
			where: { policyDocumentId },
			data: { status: 'DRAFT' }
		});

		// Activate the selected version
		await tx.policyVersion.update({
			where: { id: versionId },
			data: { status: 'ACTIVE', approvedAt: new Date(), approvedBy: userId }
		});

		// Update policy's active version reference
		await tx.policyDocument.update({
			where: { id: policyDocumentId },
			data: { currentVersion: version.version, status: 'ACTIVE' }
		});
	});

	console.log(`[GovernanceWorkflow] SET_ACTIVE_POLICY_VERSION policy:${policyDocumentId} version:${versionId} by user ${userId}`);
	return policyDocumentId;
}

async function linkResolutionToMotion(
	organizationId: string,
	userId: string,
	resolutionId: string,
	data: Record<string, unknown>
): Promise<string> {
	const motionId = data.motionId as string;

	await prisma.resolution.update({
		where: { id: resolutionId },
		data: { motionId }
	});

	console.log(`[GovernanceWorkflow] LINK_RESOLUTION_TO_MOTION resolution:${resolutionId} motion:${motionId} by user ${userId}`);
	return resolutionId;
}

async function addAgendaItem(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const meetingId = data.meetingId as string;

	// Get max order
	const maxOrder = await prisma.meetingAgendaItem.aggregate({
		where: { meetingId },
		_max: { order: true }
	});

	const item = await prisma.meetingAgendaItem.create({
		data: {
			meetingId,
			title: data.title as string,
			description: data.description as string | undefined,
			timeAllotment: data.duration as number | undefined,
			order: (maxOrder._max.order ?? 0) + 1
		}
	});

	console.log(`[GovernanceWorkflow] ADD_AGENDA_ITEM item:${item.id} meeting:${meetingId} by user ${userId}`);
	return item.id;
}

async function addMeetingMinutes(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const meetingId = data.meetingId as string;

	const minutes = await prisma.meetingMinutes.create({
		data: {
			meetingId,
			content: data.content as string,
			recordedBy: userId
		}
	});

	console.log(`[GovernanceWorkflow] ADD_MEETING_MINUTES minutes:${minutes.id} meeting:${meetingId} by user ${userId}`);
	return minutes.id;
}

async function recordAttendance(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const meetingId = data.meetingId as string;
	const partyId = data.partyId as string;

	const attendance = await prisma.meetingAttendance.upsert({
		where: {
			meetingId_partyId: { meetingId, partyId }
		},
		create: {
			meetingId,
			partyId,
			status: (data.status as any) || 'PRESENT',
			checkedInAt: new Date()
		},
		update: {
			status: (data.status as any) || 'PRESENT',
			checkedInAt: new Date()
		}
	});

	console.log(`[GovernanceWorkflow] RECORD_ATTENDANCE attendance:${attendance.id} meeting:${meetingId} by user ${userId}`);
	return attendance.id;
}

async function createVote(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const meetingId = data.meetingId as string;

	const vote = await prisma.vote.create({
		data: {
			meetingId,
			agendaItemId: data.agendaItemId as string | undefined,
			question: data.question as string,
			method: (data.method as any) || 'IN_PERSON',
			quorumRequired: data.quorumRequired as number | undefined,
			createdBy: userId
		}
	});

	console.log(`[GovernanceWorkflow] CREATE_VOTE vote:${vote.id} meeting:${meetingId} by user ${userId}`);
	return vote.id;
}

async function castBallot(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const voteId = data.voteId as string;
	const voterPartyId = data.voterPartyId as string;

	const ballot = await prisma.voteBallot.upsert({
		where: {
			voteId_voterPartyId: { voteId, voterPartyId }
		},
		create: {
			voteId,
			voterPartyId,
			choice: data.choice as any
		},
		update: {
			choice: data.choice as any,
			castAt: new Date()
		}
	});

	console.log(`[GovernanceWorkflow] CAST_BALLOT ballot:${ballot.id} vote:${voteId} by user ${userId}`);
	return ballot.id;
}

async function closeVoteSession(
	organizationId: string,
	userId: string,
	voteId: string,
	data: Record<string, unknown>
): Promise<string> {
	await prisma.vote.update({
		where: { id: voteId },
		data: { closedAt: new Date() }
	});

	console.log(`[GovernanceWorkflow] CLOSE_VOTE vote:${voteId} by user ${userId}`);
	return voteId;
}

async function startMeeting(
	organizationId: string,
	userId: string,
	meetingId: string,
	data: Record<string, unknown>
): Promise<string> {
	await prisma.meeting.update({
		where: { id: meetingId },
		data: { status: 'IN_SESSION' }
	});

	console.log(`[GovernanceWorkflow] START_MEETING meeting:${meetingId} by user ${userId}`);
	return meetingId;
}

async function adjournMeeting(
	organizationId: string,
	userId: string,
	meetingId: string,
	data: Record<string, unknown>
): Promise<string> {
	await prisma.meeting.update({
		where: { id: meetingId },
		data: { status: 'ADJOURNED' }
	});

	console.log(`[GovernanceWorkflow] ADJOURN_MEETING meeting:${meetingId} by user ${userId}`);
	return meetingId;
}

async function updateMinutes(
	organizationId: string,
	userId: string,
	meetingId: string,
	data: Record<string, unknown>
): Promise<string> {
	const content = data.content as string;

	// Update or create minutes
	const existing = await prisma.meetingMinutes.findFirst({ where: { meetingId } });

	if (existing) {
		await prisma.meetingMinutes.update({
			where: { id: existing.id },
			data: { content }
		});
	} else {
		await prisma.meetingMinutes.create({
			data: {
				meetingId,
				content,
				recordedBy: userId
			}
		});
	}

	// Update meeting status to indicate minutes are in draft
	await prisma.meeting.update({
		where: { id: meetingId },
		data: { status: 'MINUTES_DRAFT' }
	});

	console.log(`[GovernanceWorkflow] UPDATE_MINUTES meeting:${meetingId} by user ${userId}`);
	return meetingId;
}

async function approveMinutes(
	organizationId: string,
	userId: string,
	meetingId: string,
	data: Record<string, unknown>
): Promise<string> {
	// Update meeting status to indicate minutes are approved
	await prisma.meeting.update({
		where: { id: meetingId },
		data: { status: 'MINUTES_APPROVED' }
	});

	console.log(`[GovernanceWorkflow] APPROVE_MINUTES meeting:${meetingId} by user ${userId}`);
	return meetingId;
}

async function archiveMeeting(
	organizationId: string,
	userId: string,
	meetingId: string,
	data: Record<string, unknown>
): Promise<string> {
	await prisma.meeting.update({
		where: { id: meetingId },
		data: { status: 'ARCHIVED' }
	});

	console.log(`[GovernanceWorkflow] ARCHIVE_MEETING meeting:${meetingId} by user ${userId}`);
	return meetingId;
}

async function addBoardMember(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const boardId = data.boardId as string;
	const partyId = data.partyId as string;
	const termStart = new Date(data.termStart as string);

	// Check if member already exists
	const existing = await prisma.boardMember.findFirst({
		where: { boardId, partyId, termStart }
	});
	if (existing) return existing.id;

	const member = await prisma.boardMember.create({
		data: {
			boardId,
			partyId,
			role: data.role as any,
			termStart,
			termEnd: data.termEnd ? new Date(data.termEnd as string) : undefined
		}
	});

	// Record history
	await prisma.boardHistory.create({
		data: {
			boardId,
			changeType: 'MEMBER_ADDED',
			detail: { memberId: member.id, partyId: member.partyId, role: member.role },
			changedBy: userId
		}
	});

	console.log(`[GovernanceWorkflow] ADD_BOARD_MEMBER member:${member.id} board:${boardId} by user ${userId}`);
	return member.id;
}

async function removeBoardMember(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const boardId = data.boardId as string;
	const memberId = data.memberId as string;

	const member = await prisma.boardMember.update({
		where: { id: memberId },
		data: { isActive: false, termEnd: new Date() }
	});

	// Record history
	await prisma.boardHistory.create({
		data: {
			boardId,
			changeType: 'MEMBER_REMOVED',
			detail: { memberId, reason: 'removed' },
			changedBy: userId
		}
	});

	console.log(`[GovernanceWorkflow] REMOVE_BOARD_MEMBER member:${memberId} board:${boardId} by user ${userId}`);
	return member.id;
}

// Main workflow function
async function governanceWorkflow(input: GovernanceWorkflowInput): Promise<GovernanceWorkflowResult> {
	try {
		let entityId: string | undefined;

		switch (input.action) {
			case 'CREATE_BOARD':
				entityId = await DBOS.runStep(
					() => createBoard(input.organizationId, input.userId, input.data),
					{ name: 'createBoard' }
				);
				break;

			case 'CREATE_MEETING':
				entityId = await DBOS.runStep(
					() => createMeeting(input.organizationId, input.userId, input.data),
					{ name: 'createMeeting' }
				);
				break;

			case 'CREATE_MOTION':
				entityId = await DBOS.runStep(
					() => createMotion(input.organizationId, input.userId, input.data),
					{ name: 'createMotion' }
				);
				break;

			case 'CREATE_RESOLUTION':
				entityId = await DBOS.runStep(
					() => createResolution(input.organizationId, input.userId, input.data),
					{ name: 'createResolution' }
				);
				break;

			case 'SECOND_MOTION':
				entityId = await DBOS.runStep(
					() => secondMotion(input.organizationId, input.userId, input.entityId!, input.data),
					{ name: 'secondMotion' }
				);
				break;

			case 'UPDATE_MOTION_STATUS':
				entityId = await DBOS.runStep(
					() => updateMotionStatus(input.organizationId, input.userId, input.entityId!, input.data),
					{ name: 'updateMotionStatus' }
				);
				break;

			case 'RECORD_MOTION_OUTCOME':
				entityId = await DBOS.runStep(
					() => recordMotionOutcome(input.organizationId, input.userId, input.entityId!, input.data),
					{ name: 'recordMotionOutcome' }
				);
				break;

			case 'WITHDRAW_MOTION':
				entityId = await DBOS.runStep(
					() => withdrawMotion(input.organizationId, input.userId, input.entityId!, input.data),
					{ name: 'withdrawMotion' }
				);
				break;

			case 'OPEN_VOTING':
				entityId = await DBOS.runStep(
					() => openVoting(input.organizationId, input.userId, input.entityId!, input.data),
					{ name: 'openVoting' }
				);
				break;

			case 'CLOSE_VOTING':
				entityId = await DBOS.runStep(
					() => closeVoting(input.organizationId, input.userId, input.entityId!, input.data),
					{ name: 'closeVoting' }
				);
				break;

			case 'TABLE_MOTION':
				entityId = await DBOS.runStep(
					() => tableMotion(input.organizationId, input.userId, input.entityId!, input.data),
					{ name: 'tableMotion' }
				);
				break;

			case 'LINK_ARC_TO_MOTION':
				entityId = await DBOS.runStep(
					() => linkArcToMotion(input.organizationId, input.userId, input.entityId!, input.data),
					{ name: 'linkArcToMotion' }
				);
				break;

			case 'UPDATE_RESOLUTION_STATUS':
				entityId = await DBOS.runStep(
					() => updateResolutionStatus(input.organizationId, input.userId, input.entityId!, input.data),
					{ name: 'updateResolutionStatus' }
				);
				break;

			case 'CREATE_POLICY':
				entityId = await DBOS.runStep(
					() => createPolicy(input.organizationId, input.userId, input.data),
					{ name: 'createPolicy' }
				);
				break;

			case 'CREATE_POLICY_VERSION':
				entityId = await DBOS.runStep(
					() => createPolicyVersion(input.organizationId, input.userId, input.data),
					{ name: 'createPolicyVersion' }
				);
				break;

			case 'SET_ACTIVE_POLICY_VERSION':
				entityId = await DBOS.runStep(
					() => setActivePolicyVersion(input.organizationId, input.userId, input.data),
					{ name: 'setActivePolicyVersion' }
				);
				break;

			case 'LINK_RESOLUTION_TO_MOTION':
				entityId = await DBOS.runStep(
					() => linkResolutionToMotion(input.organizationId, input.userId, input.entityId!, input.data),
					{ name: 'linkResolutionToMotion' }
				);
				break;

			case 'ADD_AGENDA_ITEM':
				entityId = await DBOS.runStep(
					() => addAgendaItem(input.organizationId, input.userId, input.data),
					{ name: 'addAgendaItem' }
				);
				break;

			case 'ADD_MEETING_MINUTES':
				entityId = await DBOS.runStep(
					() => addMeetingMinutes(input.organizationId, input.userId, input.data),
					{ name: 'addMeetingMinutes' }
				);
				break;

			case 'RECORD_ATTENDANCE':
				entityId = await DBOS.runStep(
					() => recordAttendance(input.organizationId, input.userId, input.data),
					{ name: 'recordAttendance' }
				);
				break;

			case 'CREATE_VOTE':
				entityId = await DBOS.runStep(
					() => createVote(input.organizationId, input.userId, input.data),
					{ name: 'createVote' }
				);
				break;

			case 'CAST_BALLOT':
				entityId = await DBOS.runStep(
					() => castBallot(input.organizationId, input.userId, input.data),
					{ name: 'castBallot' }
				);
				break;

			case 'CLOSE_VOTE':
				entityId = await DBOS.runStep(
					() => closeVoteSession(input.organizationId, input.userId, input.entityId!, input.data),
					{ name: 'closeVoteSession' }
				);
				break;

			case 'START_MEETING':
				entityId = await DBOS.runStep(
					() => startMeeting(input.organizationId, input.userId, input.entityId!, input.data),
					{ name: 'startMeeting' }
				);
				break;

			case 'ADJOURN_MEETING':
				entityId = await DBOS.runStep(
					() => adjournMeeting(input.organizationId, input.userId, input.entityId!, input.data),
					{ name: 'adjournMeeting' }
				);
				break;

			case 'UPDATE_MINUTES':
				entityId = await DBOS.runStep(
					() => updateMinutes(input.organizationId, input.userId, input.entityId!, input.data),
					{ name: 'updateMinutes' }
				);
				break;

			case 'APPROVE_MINUTES':
				entityId = await DBOS.runStep(
					() => approveMinutes(input.organizationId, input.userId, input.entityId!, input.data),
					{ name: 'approveMinutes' }
				);
				break;

			case 'ARCHIVE_MEETING':
				entityId = await DBOS.runStep(
					() => archiveMeeting(input.organizationId, input.userId, input.entityId!, input.data),
					{ name: 'archiveMeeting' }
				);
				break;

			case 'ADD_BOARD_MEMBER':
				entityId = await DBOS.runStep(
					() => addBoardMember(input.organizationId, input.userId, input.data),
					{ name: 'addBoardMember' }
				);
				break;

			case 'REMOVE_BOARD_MEMBER':
				entityId = await DBOS.runStep(
					() => removeBoardMember(input.organizationId, input.userId, input.data),
					{ name: 'removeBoardMember' }
				);
				break;

			default:
				return { success: false, error: `Unknown action: ${input.action}` };
		}

		return { success: true, entityId };
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;
		console.error(`[GovernanceWorkflow] Error in ${input.action}:`, errorMessage);

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'GOVERNANCE_WORKFLOW_ERROR'
		});

		return { success: false, error: errorMessage };
	}
}

export const governanceWorkflow_v1 = DBOS.registerWorkflow(governanceWorkflow);

export async function startGovernanceWorkflow(
	input: GovernanceWorkflowInput,
	idempotencyKey?: string
): Promise<GovernanceWorkflowResult> {
	const workflowId = idempotencyKey || `governance-${input.action}-${Date.now()}`;
	const handle = await DBOS.startWorkflow(governanceWorkflow_v1, { workflowID: workflowId })(input);
	return handle.getResult();
}
