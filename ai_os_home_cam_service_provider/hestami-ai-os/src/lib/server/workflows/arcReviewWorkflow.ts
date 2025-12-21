/**
 * ARC Review Workflow (v1)
 *
 * DBOS durable workflow for managing ARC review operations.
 * Handles: addMember, removeMember, assignCommittee, submitReview, recordDecision.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import { ARCRequestStatus, type EntityWorkflowResult } from './schemas.js';
import type { ARCReviewAction } from '../../../../generated/prisma/client.js';
import { createWorkflowLogger } from './workflowLogger.js';

const log = createWorkflowLogger('ARCReviewWorkflow');

// Action types for the unified workflow
export const ARCReviewAction_WF = {
	ADD_MEMBER: 'ADD_MEMBER',
	REMOVE_MEMBER: 'REMOVE_MEMBER',
	ASSIGN_COMMITTEE: 'ASSIGN_COMMITTEE',
	SUBMIT_REVIEW: 'SUBMIT_REVIEW',
	RECORD_DECISION: 'RECORD_DECISION'
} as const;

export type ARCReviewAction_WF = (typeof ARCReviewAction_WF)[keyof typeof ARCReviewAction_WF];

export interface ARCReviewWorkflowInput {
	action: ARCReviewAction_WF;
	organizationId: string;
	userId: string;
	committeeId?: string;
	requestId?: string;
	data: Record<string, unknown>;
}

export interface ARCReviewWorkflowResult extends EntityWorkflowResult {
	status?: string;
	leftAt?: string;
}

const terminalStatuses: ARCRequestStatus[] = [
	ARCRequestStatus.APPROVED,
	ARCRequestStatus.DENIED,
	ARCRequestStatus.WITHDRAWN,
	ARCRequestStatus.CANCELLED,
	ARCRequestStatus.EXPIRED
];
const reviewableStatuses: ARCRequestStatus[] = [
	ARCRequestStatus.SUBMITTED,
	ARCRequestStatus.UNDER_REVIEW
];

const ensureCommitteeBelongs = async (committeeId: string, associationId: string) => {
	const committee = await prisma.aRCCommittee.findFirst({ where: { id: committeeId, associationId, isActive: true } });
	if (!committee) throw new Error('ARC Committee not found');
	return committee;
};

const ensurePartyBelongs = async (partyId: string, organizationId: string) => {
	const party = await prisma.party.findFirst({ where: { id: partyId, organizationId, deletedAt: null } });
	if (!party) throw new Error('Party not found');
};

const ensureCommitteeMember = async (committeeId: string, userId: string) => {
	const membership = await prisma.aRCCommitteeMember.findFirst({
		where: { committeeId, leftAt: null, party: { userId } }
	});
	if (!membership) throw new Error('User is not a committee member');
};

const getReviewStats = async (requestId: string) => {
	const reviews = await prisma.aRCReview.findMany({ where: { requestId }, select: { action: true } });
	const counts = reviews.reduce(
		(acc, r) => {
			acc.total += 1;
			if (r.action === 'APPROVE') acc.approvals += 1;
			return acc;
		},
		{ total: 0, approvals: 0 }
	);
	return counts;
};

// Step functions for each operation
async function addMember(
	organizationId: string,
	userId: string,
	committeeId: string,
	data: Record<string, unknown>
): Promise<string> {
	const partyId = data.partyId as string;

	const committee = await prisma.aRCCommittee.findFirst({
		where: { id: committeeId },
		include: { association: true }
	});
	if (!committee || committee.association.organizationId !== organizationId) {
		throw new Error('ARC Committee not found');
	}
	await ensurePartyBelongs(partyId, committee.association.organizationId);

	const existing = await prisma.aRCCommitteeMember.findFirst({
		where: { committeeId, partyId, leftAt: null }
	});
	if (existing) return existing.id;

	const member = await prisma.aRCCommitteeMember.create({
		data: {
			committeeId,
			partyId,
			role: data.role as string | undefined,
			isChair: (data.isChair as boolean) ?? false
		}
	});

	console.log(`[ARCReviewWorkflow] ADD_MEMBER member:${member.id} by user ${userId}`);
	return member.id;
}

async function removeMember(
	organizationId: string,
	userId: string,
	committeeId: string,
	data: Record<string, unknown>
): Promise<string> {
	const partyId = data.partyId as string;

	const committee = await prisma.aRCCommittee.findFirst({
		where: { id: committeeId },
		include: { association: true }
	});
	if (!committee || committee.association.organizationId !== organizationId) {
		throw new Error('ARC Committee not found');
	}

	const leftAt = new Date();
	await prisma.aRCCommitteeMember.updateMany({
		where: { committeeId, partyId, leftAt: null },
		data: { leftAt }
	});

	console.log(`[ARCReviewWorkflow] REMOVE_MEMBER committee:${committeeId} party:${partyId} by user ${userId}`);
	return leftAt.toISOString();
}

async function assignCommittee(
	organizationId: string,
	userId: string,
	requestId: string,
	data: Record<string, unknown>
): Promise<{ entityId: string; status: string }> {
	const committeeId = data.committeeId as string;

	const request = await prisma.aRCRequest.findFirst({
		where: { id: requestId },
		include: { association: true }
	});
	if (!request || request.association.organizationId !== organizationId) {
		throw new Error('ARC Request not found');
	}

	if (terminalStatuses.includes(request.status as ARCRequestStatus)) {
		throw new Error('Cannot assign committee after final decision or closure');
	}

	await ensureCommitteeBelongs(committeeId, request.associationId);

	const updated = await prisma.aRCRequest.update({
		where: { id: requestId },
		data: { committeeId, status: 'UNDER_REVIEW', reviewedAt: null, decisionDate: null }
	});

	console.log(`[ARCReviewWorkflow] ASSIGN_COMMITTEE request:${requestId} committee:${committeeId} by user ${userId}`);
	return { entityId: updated.id, status: updated.status };
}

async function submitReview(
	organizationId: string,
	userId: string,
	requestId: string,
	data: Record<string, unknown>
): Promise<string> {
	const request = await prisma.aRCRequest.findFirst({
		where: { id: requestId },
		include: { association: true }
	});
	if (!request || request.association.organizationId !== organizationId) {
		throw new Error('ARC Request not found');
	}
	if (!request.committeeId) {
		throw new Error('Request is not assigned to a committee');
	}

	if (!reviewableStatuses.includes(request.status as ARCRequestStatus)) {
		throw new Error('Request is not in a reviewable state');
	}

	await ensureCommitteeMember(request.committeeId, userId);

	if (request.status === 'SUBMITTED') {
		await prisma.aRCRequest.update({ where: { id: request.id }, data: { status: 'UNDER_REVIEW' } });
	}

	const existing = await prisma.aRCReview.findFirst({
		where: { requestId, reviewerId: userId }
	});
	if (existing) return existing.id;

	const review = await prisma.aRCReview.create({
		data: {
			requestId,
			reviewerId: userId,
			action: data.action as ARCReviewAction,
			notes: data.notes as string | undefined,
			conditions: data.conditions as string | undefined,
			expiresAt: data.expiresAt ? new Date(data.expiresAt as string) : undefined
		}
	});

	console.log(`[ARCReviewWorkflow] SUBMIT_REVIEW review:${review.id} by user ${userId}`);
	return review.id;
}

async function recordDecision(
	organizationId: string,
	userId: string,
	requestId: string,
	data: Record<string, unknown>
): Promise<{ entityId: string; status: string }> {
	const request = await prisma.aRCRequest.findFirst({
		where: { id: requestId },
		include: { association: true }
	});
	if (!request || request.association.organizationId !== organizationId) {
		throw new Error('ARC Request not found');
	}

	if (terminalStatuses.includes(request.status as ARCRequestStatus)) {
		throw new Error('Request already has a final decision');
	}

	const actionToStatus: Record<ARCReviewAction, ARCRequestStatus> = {
		APPROVE: 'APPROVED',
		DENY: 'DENIED',
		REQUEST_CHANGES: 'CHANGES_REQUESTED',
		TABLE: 'TABLED'
	};

	const action = data.action as ARCReviewAction;
	const status = actionToStatus[action];
	const decisionDate = new Date();

	if (request.committeeId) {
		const committee = await ensureCommitteeBelongs(request.committeeId, request.associationId);
		const activeMembers = await prisma.aRCCommitteeMember.count({
			where: { committeeId: committee.id, leftAt: null }
		});
		const { total, approvals } = await getReviewStats(request.id);

		if (committee.quorum && total < committee.quorum) {
			throw new Error('Quorum not met for committee decision');
		}

		if (action === 'APPROVE' && committee.approvalThreshold !== null) {
			const threshold = Number(committee.approvalThreshold);
			const approvalPct = activeMembers > 0 ? (approvals / activeMembers) * 100 : 0;
			if (approvalPct < threshold) {
				throw new Error('Approval threshold not met');
			}
		}
	}

	const res = await prisma.$transaction(async (tx) => {
		await tx.aRCReview.create({
			data: {
				requestId,
				reviewerId: userId,
				action,
				notes: data.notes as string | undefined,
				conditions: data.conditions as string | undefined,
				expiresAt: data.expiresAt ? new Date(data.expiresAt as string) : undefined
			}
		});

		const updated = await tx.aRCRequest.update({
			where: { id: requestId },
			data: {
				status,
				reviewedAt: decisionDate,
				decisionDate,
				conditions: data.conditions as string | undefined,
				expiresAt: data.expiresAt ? new Date(data.expiresAt as string) : request.expiresAt
			}
		});

		return updated;
	});

	console.log(`[ARCReviewWorkflow] RECORD_DECISION request:${requestId} status:${status} by user ${userId}`);
	return { entityId: res.id, status: res.status };
}

// Main workflow function
async function arcReviewWorkflow(input: ARCReviewWorkflowInput): Promise<ARCReviewWorkflowResult> {
	try {
		switch (input.action) {
			case 'ADD_MEMBER': {
				const entityId = await DBOS.runStep(
					() => addMember(input.organizationId, input.userId, input.committeeId!, input.data),
					{ name: 'addMember' }
				);
				return { success: true, entityId };
			}

			case 'REMOVE_MEMBER': {
				const leftAt = await DBOS.runStep(
					() => removeMember(input.organizationId, input.userId, input.committeeId!, input.data),
					{ name: 'removeMember' }
				);
				return { success: true, leftAt };
			}

			case 'ASSIGN_COMMITTEE': {
				const result = await DBOS.runStep(
					() => assignCommittee(input.organizationId, input.userId, input.requestId!, input.data),
					{ name: 'assignCommittee' }
				);
				return { success: true, entityId: result.entityId, status: result.status };
			}

			case 'SUBMIT_REVIEW': {
				const entityId = await DBOS.runStep(
					() => submitReview(input.organizationId, input.userId, input.requestId!, input.data),
					{ name: 'submitReview' }
				);
				return { success: true, entityId };
			}

			case 'RECORD_DECISION': {
				const result = await DBOS.runStep(
					() => recordDecision(input.organizationId, input.userId, input.requestId!, input.data),
					{ name: 'recordDecision' }
				);
				return { success: true, entityId: result.entityId, status: result.status };
			}

			default:
				return { success: false, error: `Unknown action: ${input.action}` };
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`[ARCReviewWorkflow] Error in ${input.action}:`, errorMessage);
		return { success: false, error: errorMessage };
	}
}

export const arcReviewWorkflow_v1 = DBOS.registerWorkflow(arcReviewWorkflow);

export async function startARCReviewWorkflow(
	input: ARCReviewWorkflowInput,
	idempotencyKey?: string
): Promise<ARCReviewWorkflowResult> {
	const workflowId = idempotencyKey || `arc-review-${input.action}-${input.requestId || input.committeeId || 'new'}-${Date.now()}`;
	const handle = await DBOS.startWorkflow(arcReviewWorkflow_v1, { workflowID: workflowId })(input);
	return handle.getResult();
}
