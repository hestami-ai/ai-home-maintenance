/**
 * Governance Workflow (v1)
 *
 * DBOS durable workflow for managing governance operations.
 * Handles: createBoard, createMeeting, createMotion, createResolution.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { orgTransaction } from '../db/rls.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger } from './workflowLogger.js';

const log = createWorkflowLogger('GovernanceWorkflow');

// Action types for the unified workflow
export const GovernanceAction = {
	CREATE_BOARD: 'CREATE_BOARD',
	CREATE_MEETING: 'CREATE_MEETING',
	CREATE_MOTION: 'CREATE_MOTION',
	UPDATE_MOTION: 'UPDATE_MOTION',
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
	REMOVE_BOARD_MEMBER: 'REMOVE_BOARD_MEMBER',
	// Phase 28: Committee actions
	CREATE_COMMITTEE: 'CREATE_COMMITTEE',
	UPDATE_COMMITTEE: 'UPDATE_COMMITTEE',
	ADD_COMMITTEE_MEMBER: 'ADD_COMMITTEE_MEMBER',
	REMOVE_COMMITTEE_MEMBER: 'REMOVE_COMMITTEE_MEMBER'
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

// Step functions for each operation
async function createBoard(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const associationId = data.associationId as string;
	const name = data.name as string;
	const description = data.description as string | undefined;

	const boardId = await orgTransaction(organizationId, async (tx) => {
		const board = await tx.board.create({
			data: {
				organizationId,
				associationId,
				name,
				description
			}
		});

		await tx.boardHistory.create({
			data: {
				boardId: board.id,
				changeType: 'BOARD_CREATED',
				detail: { name },
				changedBy: userId
			}
		});

		return board.id;
	}, { userId, reason: 'Creating board via workflow' });

	log.info('CREATE_BOARD completed', { boardId, userId });
	return boardId;
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

	const meetingId = await orgTransaction(organizationId, async (tx) => {
		// Get board to find associationId if not provided
		const board = await tx.board.findUnique({ where: { id: boardId } });
		if (!board) throw new Error('Board not found');

		const meeting = await tx.meeting.create({
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

		await tx.boardHistory.create({
			data: {
				boardId,
				changeType: 'MEETING_SCHEDULED',
				detail: { meetingId: meeting.id, title },
				changedBy: userId
			}
		});

		return meeting.id;
	}, { userId, reason: 'Creating meeting via workflow' });

	log.info('CREATE_MEETING completed', { meetingId, userId });
	return meetingId;
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

	const motionId = await orgTransaction(organizationId, async (tx) => {
		// Generate motion number
		const year = new Date().getFullYear();
		const count = await tx.boardMotion.count({
			where: {
				associationId,
				motionNumber: { startsWith: `MOT-${year}-` }
			}
		});
		const motionNumber = `MOT-${year}-${String(count + 1).padStart(4, '0')}`;

		const motion = await tx.boardMotion.create({
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

		return motion.id;
	}, { userId, reason: 'Creating motion via workflow' });

	log.info('CREATE_MOTION completed', { motionId, userId });
	return motionId;
}

async function updateMotion(
	organizationId: string,
	userId: string,
	motionId: string,
	data: Record<string, unknown>
): Promise<string> {
	const updateData: Record<string, unknown> = {};
	if (data.title) updateData.title = data.title as string;
	if (data.description !== undefined) updateData.description = data.description as string | null;
	if (data.category) updateData.category = data.category;
	if (data.rationale !== undefined) updateData.rationale = data.rationale as string | null;
	if (data.effectiveDate !== undefined) {
		updateData.effectiveDate = data.effectiveDate ? new Date(data.effectiveDate as string) : null;
	}
	if (data.expiresAt !== undefined) {
		updateData.expiresAt = data.expiresAt ? new Date(data.expiresAt as string) : null;
	}

	const resultId = await orgTransaction(organizationId, async (tx) => {
		const motion = await tx.boardMotion.update({
			where: { id: motionId },
			data: updateData as any
		});
		return motion.id;
	}, { userId, reason: 'Updating motion via workflow' });

	log.info('UPDATE_MOTION completed', { motionId: resultId, userId });
	return resultId;
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
	const motionId = data.motionId as string | undefined;

	const resolutionId = await orgTransaction(organizationId, async (tx) => {
		const resolution = await tx.resolution.create({
			data: {
				associationId,
				title,
				summary: content,
				effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
				motionId,
				status: 'PROPOSED'
			}
		});
		return resolution.id;
	}, { userId, reason: 'Creating resolution via workflow' });

	log.info('CREATE_RESOLUTION completed', { resolutionId, userId });
	return resolutionId;
}

async function secondMotion(
	organizationId: string,
	userId: string,
	motionId: string,
	data: Record<string, unknown>
): Promise<string> {
	const secondedById = data.secondedById as string;

	const resultId = await orgTransaction(organizationId, async (tx) => {
		await tx.boardMotion.update({
			where: { id: motionId },
			data: {
				secondedById,
				status: 'SECONDED'
			}
		});
		return motionId;
	}, { userId, reason: 'Seconding motion via workflow' });

	log.info('SECOND_MOTION completed', { motionId: resultId, userId });
	return resultId;
}

async function updateMotionStatus(
	organizationId: string,
	userId: string,
	motionId: string,
	data: Record<string, unknown>
): Promise<string> {
	const status = data.status as string;
	const outcomeNotes = data.notes as string | undefined;

	const resultId = await orgTransaction(organizationId, async (tx) => {
		await tx.boardMotion.update({
			where: { id: motionId },
			data: {
				status: status as any,
				outcomeNotes
			}
		});
		return motionId;
	}, { userId, reason: 'Updating motion status via workflow' });

	log.info('UPDATE_MOTION_STATUS completed', { motionId: resultId, status, userId });
	return resultId;
}

async function recordMotionOutcome(
	organizationId: string,
	userId: string,
	motionId: string,
	data: Record<string, unknown>
): Promise<string> {
	const outcome = data.outcome as string;
	const outcomeNotes = data.notes as string | undefined;

	const resultId = await orgTransaction(organizationId, async (tx) => {
		await tx.boardMotion.update({
			where: { id: motionId },
			data: {
				outcome: outcome as any,
				outcomeNotes,
				decidedAt: new Date()
			}
		});
		return motionId;
	}, { userId, reason: 'Recording motion outcome via workflow' });

	log.info('RECORD_MOTION_OUTCOME completed', { motionId: resultId, outcome, userId });
	return resultId;
}

async function withdrawMotion(
	organizationId: string,
	userId: string,
	motionId: string,
	data: Record<string, unknown>
): Promise<string> {
	const reason = data.reason as string | undefined;

	const resultId = await orgTransaction(organizationId, async (tx) => {
		await tx.boardMotion.update({
			where: { id: motionId },
			data: {
				status: 'WITHDRAWN',
				outcome: 'WITHDRAWN',
				outcomeNotes: reason
			}
		});
		return motionId;
	}, { userId, reason: 'Withdrawing motion via workflow' });

	log.info('WITHDRAW_MOTION completed', { motionId: resultId, userId });
	return resultId;
}

async function openVoting(
	organizationId: string,
	userId: string,
	motionId: string,
	data: Record<string, unknown>
): Promise<string> {
	const meetingId = data.meetingId as string;
	const question = data.question as string || 'Motion vote';

	const voteId = await orgTransaction(organizationId, async (tx) => {
		const vote = await tx.vote.create({
			data: {
				meetingId,
				motionId,
				question,
				createdBy: userId
			}
		});

		await tx.boardMotion.update({
			where: { id: motionId },
			data: { status: 'UNDER_VOTE', voteId: vote.id }
		});

		return vote.id;
	}, { userId, reason: 'Opening voting on motion via workflow' });

	log.info('OPEN_VOTING completed', { voteId, motionId, userId });
	return voteId;
}

async function closeVoting(
	organizationId: string,
	userId: string,
	motionId: string,
	data: Record<string, unknown>
): Promise<string> {
	const outcome = data.outcome as string;
	const outcomeNotes = data.outcomeNotes as string | undefined;

	const resultId = await orgTransaction(organizationId, async (tx) => {
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

		return motionId;
	}, { userId, reason: 'Closing voting on motion via workflow' });

	log.info('CLOSE_VOTING completed', { motionId: resultId, outcome, userId });
	return resultId;
}

async function tableMotion(
	organizationId: string,
	userId: string,
	motionId: string,
	data: Record<string, unknown>
): Promise<string> {
	const reason = data.reason as string | undefined;

	const resultId = await orgTransaction(organizationId, async (tx) => {
		await tx.boardMotion.update({
			where: { id: motionId },
			data: {
				status: 'TABLED',
				outcome: 'TABLED',
				outcomeNotes: reason
			}
		});
		return motionId;
	}, { userId, reason: 'Tabling motion via workflow' });

	log.info('TABLE_MOTION completed', { motionId: resultId, userId });
	return resultId;
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

	const resultId = await orgTransaction(organizationId, async (tx) => {
		await tx.aRCRequest.update({
			where: { id: arcRequestId },
			data: {
				status: newArcStatus as any,
				decisionDate: new Date()
			}
		});
		return arcRequestId;
	}, { userId, reason: 'Linking ARC request to motion via workflow' });

	log.info('LINK_ARC_TO_MOTION completed', { arcRequestId: resultId, motionId, status: newArcStatus, userId });
	return resultId;
}

async function updateResolutionStatus(
	organizationId: string,
	userId: string,
	resolutionId: string,
	data: Record<string, unknown>
): Promise<string> {
	const status = data.status as string;

	const resultId = await orgTransaction(organizationId, async (tx) => {
		await tx.resolution.update({
			where: { id: resolutionId },
			data: { status: status as any }
		});
		return resolutionId;
	}, { userId, reason: 'Updating resolution status via workflow' });

	log.info('UPDATE_RESOLUTION_STATUS completed', { resolutionId: resultId, status, userId });
	return resultId;
}

async function createPolicy(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const policyId = await orgTransaction(organizationId, async (tx) => {
		const policy = await tx.policyDocument.create({
			data: {
				organizationId,
				associationId: data.associationId as string,
				resolutionId: data.resolutionId as string | undefined,
				title: data.title as string,
				description: data.description as string | undefined,
				status: 'DRAFT'
			}
		});
		return policy.id;
	}, { userId, reason: 'Creating policy document via workflow' });

	log.info('CREATE_POLICY completed', { policyId, userId });
	return policyId;
}

async function createPolicyVersion(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const policyDocumentId = data.policyDocumentId as string;

	const versionId = await orgTransaction(organizationId, async (tx) => {
		// Get current max version count
		const versionCount = await tx.policyVersion.count({
			where: { policyDocumentId }
		});
		const nextVersion = `v${versionCount + 1}`;

		const version = await tx.policyVersion.create({
			data: {
				policyDocumentId,
				version: nextVersion,
				content: data.content as string,
				status: 'DRAFT'
			}
		});

		return version.id;
	}, { userId, reason: 'Creating policy version via workflow' });

	log.info('CREATE_POLICY_VERSION completed', { versionId, userId });
	return versionId;
}

async function setActivePolicyVersion(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const policyDocumentId = data.policyDocumentId as string;
	const versionId = data.versionId as string;

	const resultId = await orgTransaction(organizationId, async (tx) => {
		// Get the version string
		const version = await tx.policyVersion.findUnique({ where: { id: versionId } });
		if (!version) throw new Error('Policy version not found');

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

		return policyDocumentId;
	}, { userId, reason: 'Setting active policy version via workflow' });

	log.info('SET_ACTIVE_POLICY_VERSION completed', { policyDocumentId: resultId, versionId, userId });
	return resultId;
}

async function linkResolutionToMotion(
	organizationId: string,
	userId: string,
	resolutionId: string,
	data: Record<string, unknown>
): Promise<string> {
	const motionId = data.motionId as string;

	const resultId = await orgTransaction(organizationId, async (tx) => {
		await tx.resolution.update({
			where: { id: resolutionId },
			data: { motionId }
		});
		return resolutionId;
	}, { userId, reason: 'Linking resolution to motion via workflow' });

	log.info('LINK_RESOLUTION_TO_MOTION completed', { resolutionId: resultId, motionId, userId });
	return resultId;
}

async function addAgendaItem(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const meetingId = data.meetingId as string;

	const itemId = await orgTransaction(organizationId, async (tx) => {
		// Get max order
		const maxOrder = await tx.meetingAgendaItem.aggregate({
			where: { meetingId },
			_max: { order: true }
		});

		const item = await tx.meetingAgendaItem.create({
			data: {
				meetingId,
				title: data.title as string,
				description: data.description as string | undefined,
				timeAllotment: data.duration as number | undefined,
				order: (maxOrder._max.order ?? 0) + 1
			}
		});

		return item.id;
	}, { userId, reason: 'Adding agenda item via workflow' });

	log.info('ADD_AGENDA_ITEM completed', { itemId, meetingId, userId });
	return itemId;
}

async function addMeetingMinutes(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const meetingId = data.meetingId as string;

	const minutesId = await orgTransaction(organizationId, async (tx) => {
		const minutes = await tx.meetingMinutes.create({
			data: {
				meetingId,
				content: data.content as string,
				recordedBy: userId
			}
		});
		return minutes.id;
	}, { userId, reason: 'Adding meeting minutes via workflow' });

	log.info('ADD_MEETING_MINUTES completed', { minutesId, meetingId, userId });
	return minutesId;
}

async function recordAttendance(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const meetingId = data.meetingId as string;
	const partyId = data.partyId as string;

	const attendanceId = await orgTransaction(organizationId, async (tx) => {
		const attendance = await tx.meetingAttendance.upsert({
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
		return attendance.id;
	}, { userId, reason: 'Recording attendance via workflow' });

	log.info('RECORD_ATTENDANCE completed', { attendanceId, meetingId, userId });
	return attendanceId;
}

async function createVote(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const meetingId = data.meetingId as string;

	const voteId = await orgTransaction(organizationId, async (tx) => {
		const vote = await tx.vote.create({
			data: {
				meetingId,
				agendaItemId: data.agendaItemId as string | undefined,
				question: data.question as string,
				method: (data.method as any) || 'IN_PERSON',
				quorumRequired: data.quorumRequired as number | undefined,
				createdBy: userId
			}
		});
		return vote.id;
	}, { userId, reason: 'Creating vote via workflow' });

	log.info('CREATE_VOTE completed', { voteId, meetingId, userId });
	return voteId;
}

async function castBallot(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const voteId = data.voteId as string;
	const voterPartyId = data.voterPartyId as string;

	const ballotId = await orgTransaction(organizationId, async (tx) => {
		const ballot = await tx.voteBallot.upsert({
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
		return ballot.id;
	}, { userId, reason: 'Casting ballot via workflow' });

	log.info('CAST_BALLOT completed', { ballotId, voteId, userId });
	return ballotId;
}

async function closeVoteSession(
	organizationId: string,
	userId: string,
	voteId: string,
	_data: Record<string, unknown>
): Promise<string> {
	const resultId = await orgTransaction(organizationId, async (tx) => {
		await tx.vote.update({
			where: { id: voteId },
			data: { closedAt: new Date() }
		});
		return voteId;
	}, { userId, reason: 'Closing vote session via workflow' });

	log.info('CLOSE_VOTE completed', { voteId: resultId, userId });
	return resultId;
}

async function startMeeting(
	organizationId: string,
	userId: string,
	meetingId: string,
	_data: Record<string, unknown>
): Promise<string> {
	const resultId = await orgTransaction(organizationId, async (tx) => {
		await tx.meeting.update({
			where: { id: meetingId },
			data: { status: 'IN_SESSION' }
		});
		return meetingId;
	}, { userId, reason: 'Starting meeting via workflow' });

	log.info('START_MEETING completed', { meetingId: resultId, userId });
	return resultId;
}

async function adjournMeeting(
	organizationId: string,
	userId: string,
	meetingId: string,
	_data: Record<string, unknown>
): Promise<string> {
	const resultId = await orgTransaction(organizationId, async (tx) => {
		await tx.meeting.update({
			where: { id: meetingId },
			data: { status: 'ADJOURNED' }
		});

		// Create minutes placeholder if not exists
		const existingMinutes = await tx.meetingMinutes.findUnique({ where: { meetingId } });
		if (!existingMinutes) {
			await tx.meetingMinutes.create({
				data: { meetingId, recordedBy: userId, content: '' }
			});
		}

		return meetingId;
	}, { userId, reason: 'Adjourning meeting via workflow' });

	log.info('ADJOURN_MEETING completed', { meetingId: resultId, userId });
	return resultId;
}

async function updateMinutes(
	organizationId: string,
	userId: string,
	meetingId: string,
	data: Record<string, unknown>
): Promise<string> {
	const content = data.content as string;

	const resultId = await orgTransaction(organizationId, async (tx) => {
		// Update or create minutes
		const existing = await tx.meetingMinutes.findFirst({ where: { meetingId } });

		if (existing) {
			await tx.meetingMinutes.update({
				where: { id: existing.id },
				data: { content }
			});
		} else {
			await tx.meetingMinutes.create({
				data: {
					meetingId,
					content,
					recordedBy: userId
				}
			});
		}

		// Update meeting status to indicate minutes are in draft
		await tx.meeting.update({
			where: { id: meetingId },
			data: { status: 'MINUTES_DRAFT' }
		});

		return meetingId;
	}, { userId, reason: 'Updating meeting minutes via workflow' });

	log.info('UPDATE_MINUTES completed', { meetingId: resultId, userId });
	return resultId;
}

async function approveMinutes(
	organizationId: string,
	userId: string,
	meetingId: string,
	_data: Record<string, unknown>
): Promise<string> {
	const resultId = await orgTransaction(organizationId, async (tx) => {
		// Update meeting status to indicate minutes are approved
		await tx.meeting.update({
			where: { id: meetingId },
			data: { status: 'MINUTES_APPROVED' }
		});
		return meetingId;
	}, { userId, reason: 'Approving meeting minutes via workflow' });

	log.info('APPROVE_MINUTES completed', { meetingId: resultId, userId });
	return resultId;
}

async function archiveMeeting(
	organizationId: string,
	userId: string,
	meetingId: string,
	_data: Record<string, unknown>
): Promise<string> {
	const resultId = await orgTransaction(organizationId, async (tx) => {
		await tx.meeting.update({
			where: { id: meetingId },
			data: { status: 'ARCHIVED' }
		});
		return meetingId;
	}, { userId, reason: 'Archiving meeting via workflow' });

	log.info('ARCHIVE_MEETING completed', { meetingId: resultId, userId });
	return resultId;
}

async function addBoardMember(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const boardId = data.boardId as string;
	const partyId = data.partyId as string;
	const termStart = new Date(data.termStart as string);

	const memberId = await orgTransaction(organizationId, async (tx) => {
		// Check if member already exists
		const existing = await tx.boardMember.findFirst({
			where: { boardId, partyId, termStart }
		});
		if (existing) return existing.id;

		const member = await tx.boardMember.create({
			data: {
				boardId,
				partyId,
				role: data.role as any,
				termStart,
				termEnd: data.termEnd ? new Date(data.termEnd as string) : undefined
			}
		});

		// Record history
		await tx.boardHistory.create({
			data: {
				boardId,
				changeType: 'MEMBER_ADDED',
				detail: { memberId: member.id, partyId: member.partyId, role: member.role },
				changedBy: userId
			}
		});

		return member.id;
	}, { userId, reason: 'Adding board member via workflow' });

	log.info('ADD_BOARD_MEMBER completed', { memberId, boardId, userId });
	return memberId;
}

async function removeBoardMember(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const boardId = data.boardId as string;
	const memberId = data.memberId as string;

	const resultId = await orgTransaction(organizationId, async (tx) => {
		const member = await tx.boardMember.update({
			where: { id: memberId },
			data: { isActive: false, termEnd: new Date() }
		});

		// Record history
		await tx.boardHistory.create({
			data: {
				boardId,
				changeType: 'MEMBER_REMOVED',
				detail: { memberId, reason: 'removed' },
				changedBy: userId
			}
		});

		return member.id;
	}, { userId, reason: 'Removing board member via workflow' });

	log.info('REMOVE_BOARD_MEMBER completed', { memberId: resultId, boardId, userId });
	return resultId;
}

// -----------------------------------------------------------------------------
// Phase 28: Committee Step Functions
// -----------------------------------------------------------------------------

async function createCommittee(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const associationId = data.associationId as string;
	const name = data.name as string;
	const description = data.description as string | undefined;
	const committeeType = data.committeeType as string;
	const isArcLinked = data.isArcLinked as boolean | undefined;

	const committeeId = await orgTransaction(organizationId, async (tx) => {
		const committee = await tx.committee.create({
			data: {
				organizationId,
				associationId,
				name,
				description,
				committeeType: committeeType as any,
				isArcLinked: isArcLinked ?? false
			}
		});
		return committee.id;
	}, { userId, reason: 'Creating committee via workflow' });

	log.info('CREATE_COMMITTEE completed', { committeeId, userId });
	return committeeId;
}

async function updateCommittee(
	organizationId: string,
	userId: string,
	committeeId: string,
	data: Record<string, unknown>
): Promise<string> {
	const updateData: Record<string, any> = {};
	if (data.name !== undefined) updateData.name = data.name;
	if (data.description !== undefined) updateData.description = data.description;
	if (data.committeeType !== undefined) updateData.committeeType = data.committeeType;
	if (data.isArcLinked !== undefined) updateData.isArcLinked = data.isArcLinked;
	if (data.isActive !== undefined) updateData.isActive = data.isActive;

	const resultId = await orgTransaction(organizationId, async (tx) => {
		await tx.committee.update({
			where: { id: committeeId },
			data: updateData
		});
		return committeeId;
	}, { userId, reason: 'Updating committee via workflow' });

	log.info('UPDATE_COMMITTEE completed', { committeeId: resultId, userId });
	return resultId;
}

async function addCommitteeMember(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const committeeId = data.committeeId as string;
	const partyId = data.partyId as string;
	const termStart = new Date(data.termStart as string);

	const memberId = await orgTransaction(organizationId, async (tx) => {
		// Check if member already exists
		const existing = await tx.committeeMember.findFirst({
			where: { committeeId, partyId, termStart }
		});
		if (existing) return existing.id;

		const member = await tx.committeeMember.create({
			data: {
				committeeId,
				partyId,
				role: data.role as any,
				termStart,
				termEnd: data.termEnd ? new Date(data.termEnd as string) : undefined
			}
		});

		return member.id;
	}, { userId, reason: 'Adding committee member via workflow' });

	log.info('ADD_COMMITTEE_MEMBER completed', { memberId, committeeId, userId });
	return memberId;
}

async function removeCommitteeMember(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const memberId = data.memberId as string;

	const resultId = await orgTransaction(organizationId, async (tx) => {
		const member = await tx.committeeMember.update({
			where: { id: memberId },
			data: { isActive: false, termEnd: new Date() }
		});
		return member.id;
	}, { userId, reason: 'Removing committee member via workflow' });

	log.info('REMOVE_COMMITTEE_MEMBER completed', { memberId: resultId, userId });
	return resultId;
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

			case 'UPDATE_MOTION':
				entityId = await DBOS.runStep(
					() => updateMotion(input.organizationId, input.userId, input.entityId!, input.data),
					{ name: 'updateMotion' }
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

			// Phase 28: Committee actions
			case 'CREATE_COMMITTEE':
				entityId = await DBOS.runStep(
					() => createCommittee(input.organizationId, input.userId, input.data),
					{ name: 'createCommittee' }
				);
				break;

			case 'UPDATE_COMMITTEE':
				entityId = await DBOS.runStep(
					() => updateCommittee(input.organizationId, input.userId, input.entityId!, input.data),
					{ name: 'updateCommittee' }
				);
				break;

			case 'ADD_COMMITTEE_MEMBER':
				entityId = await DBOS.runStep(
					() => addCommitteeMember(input.organizationId, input.userId, input.data),
					{ name: 'addCommitteeMember' }
				);
				break;

			case 'REMOVE_COMMITTEE_MEMBER':
				entityId = await DBOS.runStep(
					() => removeCommitteeMember(input.organizationId, input.userId, input.data),
					{ name: 'removeCommitteeMember' }
				);
				break;

			default:
				return { success: false, error: `Unknown action: ${input.action}` };
		}

		return { success: true, entityId };
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;
		log.error('Workflow error', { action: input.action, error: errorMessage });

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
	idempotencyKey: string
): Promise<GovernanceWorkflowResult> {
	const workflowId = idempotencyKey || `governance-${input.action}-${Date.now()}`;
	const handle = await DBOS.startWorkflow(governanceWorkflow_v1, { workflowID: workflowId })(input);
	return handle.getResult();
}
