/**
 * Governance Activity Service
 * 
 * Phase 11: Creates ActivityEvent records for governance actions.
 * Provides a centralized way to audit all governance-related activities.
 */

import { prisma } from '../db.js';
import type { 
	ActivityEntityType, 
	ActivityActionType, 
	ActivityEventCategory,
	ActivityActorType,
	Prisma
} from '../../../../generated/prisma/client.js';

interface GovernanceActivityInput {
	organizationId: string;
	associationId?: string;
	entityType: 'MEETING' | 'MOTION' | 'VOTE' | 'RESOLUTION';
	entityId: string;
	action: ActivityActionType;
	summary: string;
	performedById: string;
	performedByType?: ActivityActorType;
	eventCategory?: ActivityEventCategory;
	previousState?: Prisma.InputJsonValue;
	newState?: Prisma.InputJsonValue;
	metadata?: Prisma.InputJsonValue;
	traceId?: string;
}

/**
 * Create an activity event for a governance action
 */
export async function createGovernanceActivity(input: GovernanceActivityInput): Promise<string> {
	const event = await prisma.activityEvent.create({
		data: {
			organizationId: input.organizationId,
			associationId: input.associationId,
			entityType: input.entityType as ActivityEntityType,
			entityId: input.entityId,
			action: input.action,
			eventCategory: input.eventCategory || 'EXECUTION',
			summary: input.summary,
			performedById: input.performedById,
			performedByType: input.performedByType || 'HUMAN',
			previousState: input.previousState,
			newState: input.newState,
			metadata: input.metadata,
			traceId: input.traceId
		}
	});

	return event.id;
}

// ============================================================================
// Meeting Activity Helpers
// ============================================================================

export async function logMeetingCreated(params: {
	organizationId: string;
	associationId: string;
	meetingId: string;
	title: string;
	userId: string;
}): Promise<string> {
	return createGovernanceActivity({
		organizationId: params.organizationId,
		associationId: params.associationId,
		entityType: 'MEETING',
		entityId: params.meetingId,
		action: 'CREATE',
		summary: `Meeting "${params.title}" created`,
		performedById: params.userId,
		eventCategory: 'EXECUTION'
	});
}

export async function logMeetingStarted(params: {
	organizationId: string;
	associationId: string;
	meetingId: string;
	title: string;
	userId: string;
	quorumMet: boolean;
	presentCount: number;
}): Promise<string> {
	return createGovernanceActivity({
		organizationId: params.organizationId,
		associationId: params.associationId,
		entityType: 'MEETING',
		entityId: params.meetingId,
		action: 'START_SESSION',
		summary: `Meeting "${params.title}" started with ${params.presentCount} attendees`,
		performedById: params.userId,
		eventCategory: 'EXECUTION',
		metadata: { quorumMet: params.quorumMet, presentCount: params.presentCount }
	});
}

export async function logMeetingAdjourned(params: {
	organizationId: string;
	associationId: string;
	meetingId: string;
	title: string;
	userId: string;
}): Promise<string> {
	return createGovernanceActivity({
		organizationId: params.organizationId,
		associationId: params.associationId,
		entityType: 'MEETING',
		entityId: params.meetingId,
		action: 'ADJOURN',
		summary: `Meeting "${params.title}" adjourned`,
		performedById: params.userId,
		eventCategory: 'EXECUTION'
	});
}

export async function logMinutesApproved(params: {
	organizationId: string;
	associationId: string;
	meetingId: string;
	title: string;
	userId: string;
}): Promise<string> {
	return createGovernanceActivity({
		organizationId: params.organizationId,
		associationId: params.associationId,
		entityType: 'MEETING',
		entityId: params.meetingId,
		action: 'APPROVE_MINUTES',
		summary: `Minutes approved for meeting "${params.title}"`,
		performedById: params.userId,
		eventCategory: 'DECISION'
	});
}

// ============================================================================
// Motion Activity Helpers
// ============================================================================

export async function logMotionProposed(params: {
	organizationId: string;
	associationId: string;
	motionId: string;
	motionNumber: string;
	title: string;
	userId: string;
}): Promise<string> {
	return createGovernanceActivity({
		organizationId: params.organizationId,
		associationId: params.associationId,
		entityType: 'MOTION',
		entityId: params.motionId,
		action: 'PROPOSE',
		summary: `Motion ${params.motionNumber} "${params.title}" proposed`,
		performedById: params.userId,
		eventCategory: 'INTENT'
	});
}

export async function logMotionSeconded(params: {
	organizationId: string;
	associationId: string;
	motionId: string;
	motionNumber: string;
	title: string;
	secondedById: string;
}): Promise<string> {
	return createGovernanceActivity({
		organizationId: params.organizationId,
		associationId: params.associationId,
		entityType: 'MOTION',
		entityId: params.motionId,
		action: 'SECOND',
		summary: `Motion ${params.motionNumber} "${params.title}" seconded`,
		performedById: params.secondedById,
		eventCategory: 'EXECUTION'
	});
}

export async function logVotingOpened(params: {
	organizationId: string;
	associationId: string;
	motionId: string;
	motionNumber: string;
	voteId: string;
	userId: string;
}): Promise<string> {
	return createGovernanceActivity({
		organizationId: params.organizationId,
		associationId: params.associationId,
		entityType: 'MOTION',
		entityId: params.motionId,
		action: 'OPEN_VOTING',
		summary: `Voting opened on motion ${params.motionNumber}`,
		performedById: params.userId,
		eventCategory: 'EXECUTION',
		metadata: { voteId: params.voteId }
	});
}

export async function logVotingClosed(params: {
	organizationId: string;
	associationId: string;
	motionId: string;
	motionNumber: string;
	outcome: string;
	voteResults: { yes: number; no: number; abstain: number };
	userId: string;
}): Promise<string> {
	return createGovernanceActivity({
		organizationId: params.organizationId,
		associationId: params.associationId,
		entityType: 'MOTION',
		entityId: params.motionId,
		action: 'CLOSE_VOTING',
		summary: `Voting closed on motion ${params.motionNumber}: ${params.outcome}`,
		performedById: params.userId,
		eventCategory: 'DECISION',
		metadata: { outcome: params.outcome, ...params.voteResults }
	});
}

export async function logMotionTabled(params: {
	organizationId: string;
	associationId: string;
	motionId: string;
	motionNumber: string;
	reason?: string;
	userId: string;
}): Promise<string> {
	return createGovernanceActivity({
		organizationId: params.organizationId,
		associationId: params.associationId,
		entityType: 'MOTION',
		entityId: params.motionId,
		action: 'TABLE',
		summary: `Motion ${params.motionNumber} tabled${params.reason ? `: ${params.reason}` : ''}`,
		performedById: params.userId,
		eventCategory: 'DECISION'
	});
}

// ============================================================================
// Vote Activity Helpers
// ============================================================================

export async function logBallotCast(params: {
	organizationId: string;
	associationId: string;
	voteId: string;
	voterId: string;
	choice: string;
	hasConflictOfInterest: boolean;
}): Promise<string> {
	return createGovernanceActivity({
		organizationId: params.organizationId,
		associationId: params.associationId,
		entityType: 'VOTE',
		entityId: params.voteId,
		action: 'CAST_BALLOT',
		summary: `Ballot cast: ${params.choice}${params.hasConflictOfInterest ? ' (with conflict of interest disclosed)' : ''}`,
		performedById: params.voterId,
		eventCategory: 'EXECUTION',
		metadata: { choice: params.choice, hasConflictOfInterest: params.hasConflictOfInterest }
	});
}

// ============================================================================
// Resolution Activity Helpers
// ============================================================================

export async function logResolutionAdopted(params: {
	organizationId: string;
	associationId: string;
	resolutionId: string;
	title: string;
	motionId?: string;
	userId: string;
}): Promise<string> {
	return createGovernanceActivity({
		organizationId: params.organizationId,
		associationId: params.associationId,
		entityType: 'RESOLUTION',
		entityId: params.resolutionId,
		action: 'ADOPT',
		summary: `Resolution "${params.title}" adopted`,
		performedById: params.userId,
		eventCategory: 'DECISION',
		metadata: params.motionId ? { linkedMotionId: params.motionId } : undefined
	});
}

export async function logResolutionSuperseded(params: {
	organizationId: string;
	associationId: string;
	resolutionId: string;
	title: string;
	supersededById: string;
	userId: string;
}): Promise<string> {
	return createGovernanceActivity({
		organizationId: params.organizationId,
		associationId: params.associationId,
		entityType: 'RESOLUTION',
		entityId: params.resolutionId,
		action: 'SUPERSEDE',
		summary: `Resolution "${params.title}" superseded`,
		performedById: params.userId,
		eventCategory: 'EXECUTION',
		metadata: { supersededById: params.supersededById }
	});
}
