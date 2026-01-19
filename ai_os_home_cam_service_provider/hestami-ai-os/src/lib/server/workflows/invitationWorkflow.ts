/**
 * Phase 38: Invitation Workflow
 *
 * DBOS workflow for organization invitation and join request lifecycle.
 * Handles creation, acceptance, revocation, and join request management.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import { createWorkflowLogger, logWorkflowStart, logWorkflowEnd } from './workflowLogger.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import {
	InvitationStatus,
	JoinRequestStatus,
	InvitationDeliveryMethod,
	UserRole,
	ActivityActionType
} from '../../../../generated/prisma/enums.js';
import type { InvitationDeliveryMethod as InvitationDeliveryMethodType } from '../../../../generated/prisma/enums.js';
import { WorkflowErrorType } from './schemas.js';
import { Prisma } from '../../../../generated/prisma/client.js';

// =============================================================================
// Workflow Action Types
// =============================================================================

export const InvitationWorkflowAction = {
	CREATE: 'CREATE',
	RESEND: 'RESEND',
	REVOKE: 'REVOKE',
	ACCEPT: 'ACCEPT',
	CREATE_JOIN_REQUEST: 'CREATE_JOIN_REQUEST',
	APPROVE_JOIN_REQUEST: 'APPROVE_JOIN_REQUEST',
	REJECT_JOIN_REQUEST: 'REJECT_JOIN_REQUEST',
	CANCEL_JOIN_REQUEST: 'CANCEL_JOIN_REQUEST'
} as const;

export type InvitationWorkflowAction = (typeof InvitationWorkflowAction)[keyof typeof InvitationWorkflowAction];

// =============================================================================
// Workflow Input Types
// =============================================================================

export interface InvitationWorkflowInput {
	action: InvitationWorkflowAction;
	organizationId: string;
	userId: string;
	invitationId?: string;
	joinRequestId?: string;
	data?: {
		email?: string;
		role?: string;
		deliveryMethod?: InvitationDeliveryMethodType;
		codeEncrypted?: string | null;
		expiresAt?: Date;
		metadata?: Record<string, unknown>;
		requestedRole?: string;
		verificationData?: Record<string, unknown>;
		reason?: string;
		requestUserId?: string;
	};
}

// =============================================================================
// Workflow Result Types
// =============================================================================

export interface InvitationWorkflowResult {
	success: boolean;
	error?: string;
	invitationId?: string;
	joinRequestId?: string;
	membershipId?: string;
}

// =============================================================================
// Workflow Implementation
// =============================================================================

async function invitationWorkflow(input: InvitationWorkflowInput): Promise<InvitationWorkflowResult> {
	const log = createWorkflowLogger('invitationWorkflow', DBOS.workflowID, input.action);
	const startTime = logWorkflowStart(log, input.action, { ...input } as Record<string, unknown>);

	try {
		switch (input.action) {
			case InvitationWorkflowAction.CREATE:
				return await handleCreate(input, log, startTime);

			case InvitationWorkflowAction.RESEND:
				return await handleResend(input, log, startTime);

			case InvitationWorkflowAction.REVOKE:
				return await handleRevoke(input, log, startTime);

			case InvitationWorkflowAction.ACCEPT:
				return await handleAccept(input, log, startTime);

			case InvitationWorkflowAction.CREATE_JOIN_REQUEST:
				return await handleCreateJoinRequest(input, log, startTime);

			case InvitationWorkflowAction.APPROVE_JOIN_REQUEST:
				return await handleApproveJoinRequest(input, log, startTime);

			case InvitationWorkflowAction.REJECT_JOIN_REQUEST:
				return await handleRejectJoinRequest(input, log, startTime);

			case InvitationWorkflowAction.CANCEL_JOIN_REQUEST:
				return await handleCancelJoinRequest(input, log, startTime);

			default: {
				const exhaustiveCheck: never = input.action;
				throw new Error(`Unknown action: ${exhaustiveCheck}`);
			}
		}
	} catch (error) {
		const err = error instanceof Error ? error : new Error(String(error));
		log.error('Workflow failed', { action: input.action, error: err.message });
		await DBOS.setEvent('workflow_error', { error: err.message });
		await recordSpanError(err, { errorCode: ActivityActionType.WORKFLOW_FAILED, errorType: WorkflowErrorType.INVITATION_WORKFLOW_ERROR });

		const failure = { success: false, error: err.message };
		logWorkflowEnd(log, input.action, false, startTime, failure);
		return failure;
	}
}

// =============================================================================
// Action Handlers
// =============================================================================

async function handleCreate(
	input: InvitationWorkflowInput,
	log: ReturnType<typeof createWorkflowLogger>,
	startTime: number
): Promise<InvitationWorkflowResult> {
	const { organizationId, userId, data } = input;

	if (!data?.email || !data?.role || !data?.codeEncrypted || !data?.expiresAt) {
		throw new Error('Missing required fields for CREATE action');
	}

	const invitation = await DBOS.runStep(
		() =>
			prisma.$transaction(async (tx) => {
				const inv = await tx.organizationInvitation.create({
					data: {
						organizationId,
						email: data.email!,
						role: data.role!,
						invitedByUserId: userId,
						codeEncrypted: data.codeEncrypted,
						expiresAt: data.expiresAt!,
						deliveryMethod: data.deliveryMethod || InvitationDeliveryMethod.CODE,
						status: InvitationStatus.PENDING,
						metadata: (data.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull
					}
				});
				return inv;
			}),
		{ name: 'createInvitation' }
	);

	log.info('Invitation created', { invitationId: invitation.id, email: data.email });
	await DBOS.setEvent('workflow_status', { step: 'completed', invitationId: invitation.id });

	const success = { success: true, invitationId: invitation.id };
	logWorkflowEnd(log, input.action, true, startTime, success);
	return success;
}

async function handleResend(
	input: InvitationWorkflowInput,
	log: ReturnType<typeof createWorkflowLogger>,
	startTime: number
): Promise<InvitationWorkflowResult> {
	const { invitationId, data } = input;

	if (!invitationId) {
		throw new Error('Missing invitationId for RESEND action');
	}

	await DBOS.runStep(
		() =>
			prisma.$transaction(async (tx) => {
				await tx.organizationInvitation.update({
					where: { id: invitationId },
					data: {
						codeEncrypted: data?.codeEncrypted,
						expiresAt: data?.expiresAt,
						sentAt: new Date()
					}
				});
			}),
		{ name: 'resendInvitation' }
	);

	log.info('Invitation resent', { invitationId });
	await DBOS.setEvent('workflow_status', { step: 'completed', invitationId });

	const success = { success: true, invitationId };
	logWorkflowEnd(log, input.action, true, startTime, success);
	return success;
}

async function handleRevoke(
	input: InvitationWorkflowInput,
	log: ReturnType<typeof createWorkflowLogger>,
	startTime: number
): Promise<InvitationWorkflowResult> {
	const { invitationId } = input;

	if (!invitationId) {
		throw new Error('Missing invitationId for REVOKE action');
	}

	await DBOS.runStep(
		() =>
			prisma.$transaction(async (tx) => {
				await tx.organizationInvitation.update({
					where: { id: invitationId },
					data: {
						status: InvitationStatus.REVOKED,
						codeEncrypted: null
					}
				});
			}),
		{ name: 'revokeInvitation' }
	);

	log.info('Invitation revoked', { invitationId });
	await DBOS.setEvent('workflow_status', { step: 'completed', invitationId });

	const success = { success: true, invitationId };
	logWorkflowEnd(log, input.action, true, startTime, success);
	return success;
}

async function handleAccept(
	input: InvitationWorkflowInput,
	log: ReturnType<typeof createWorkflowLogger>,
	startTime: number
): Promise<InvitationWorkflowResult> {
	const { organizationId, userId, invitationId, data } = input;

	if (!invitationId || !data?.role) {
		throw new Error('Missing required fields for ACCEPT action');
	}

	const membership = await DBOS.runStep(
		() =>
			prisma.$transaction(async (tx) => {
				await tx.organizationInvitation.update({
					where: { id: invitationId },
					data: {
						status: InvitationStatus.ACCEPTED,
						acceptedAt: new Date(),
						acceptedByUserId: userId,
						codeEncrypted: null
					}
				});

				const mem = await tx.userOrganization.create({
					data: {
						userId,
						organizationId,
						role: data.role as UserRole,
						isDefault: false
					}
				});

				return mem;
			}),
		{ name: 'acceptInvitation' }
	);

	log.info('Invitation accepted', { invitationId, membershipId: membership.id });
	await DBOS.setEvent('workflow_status', { step: 'completed', invitationId, membershipId: membership.id });

	const success = { success: true, invitationId, membershipId: membership.id };
	logWorkflowEnd(log, input.action, true, startTime, success);
	return success;
}

async function handleCreateJoinRequest(
	input: InvitationWorkflowInput,
	log: ReturnType<typeof createWorkflowLogger>,
	startTime: number
): Promise<InvitationWorkflowResult> {
	const { organizationId, userId, data } = input;

	if (!data?.requestedRole) {
		throw new Error('Missing requestedRole for CREATE_JOIN_REQUEST action');
	}

	const joinRequest = await DBOS.runStep(
		() =>
			prisma.$transaction(async (tx) => {
				const req = await tx.joinRequest.create({
					data: {
						organizationId,
						userId,
						requestedRole: data.requestedRole!,
						verificationData: (data.verificationData as Prisma.InputJsonValue) ?? Prisma.JsonNull,
						status: JoinRequestStatus.PENDING
					}
				});
				return req;
			}),
		{ name: 'createJoinRequest' }
	);

	log.info('Join request created', { joinRequestId: joinRequest.id });
	await DBOS.setEvent('workflow_status', { step: 'completed', joinRequestId: joinRequest.id });

	const success = { success: true, joinRequestId: joinRequest.id };
	logWorkflowEnd(log, input.action, true, startTime, success);
	return success;
}

async function handleApproveJoinRequest(
	input: InvitationWorkflowInput,
	log: ReturnType<typeof createWorkflowLogger>,
	startTime: number
): Promise<InvitationWorkflowResult> {
	const { organizationId, userId, joinRequestId, data } = input;

	if (!joinRequestId || !data?.role || !data?.requestUserId) {
		throw new Error('Missing required fields for APPROVE_JOIN_REQUEST action');
	}

	const membership = await DBOS.runStep(
		() =>
			prisma.$transaction(async (tx) => {
				await tx.joinRequest.update({
					where: { id: joinRequestId },
					data: {
						status: JoinRequestStatus.APPROVED,
						reviewedByUserId: userId,
						reviewedAt: new Date()
					}
				});

				const mem = await tx.userOrganization.create({
					data: {
						userId: data.requestUserId!,
						organizationId,
						role: data.role as UserRole,
						isDefault: false
					}
				});

				return mem;
			}),
		{ name: 'approveJoinRequest' }
	);

	log.info('Join request approved', { joinRequestId, membershipId: membership.id });
	await DBOS.setEvent('workflow_status', { step: 'completed', joinRequestId, membershipId: membership.id });

	const success = { success: true, joinRequestId, membershipId: membership.id };
	logWorkflowEnd(log, input.action, true, startTime, success);
	return success;
}

async function handleRejectJoinRequest(
	input: InvitationWorkflowInput,
	log: ReturnType<typeof createWorkflowLogger>,
	startTime: number
): Promise<InvitationWorkflowResult> {
	const { userId, joinRequestId, data } = input;

	if (!joinRequestId) {
		throw new Error('Missing joinRequestId for REJECT_JOIN_REQUEST action');
	}

	await DBOS.runStep(
		() =>
			prisma.$transaction(async (tx) => {
				await tx.joinRequest.update({
					where: { id: joinRequestId },
					data: {
						status: JoinRequestStatus.REJECTED,
						reviewedByUserId: userId,
						reviewedAt: new Date(),
						rejectionReason: data?.reason || null
					}
				});
			}),
		{ name: 'rejectJoinRequest' }
	);

	log.info('Join request rejected', { joinRequestId });
	await DBOS.setEvent('workflow_status', { step: 'completed', joinRequestId });

	const success = { success: true, joinRequestId };
	logWorkflowEnd(log, input.action, true, startTime, success);
	return success;
}

async function handleCancelJoinRequest(
	input: InvitationWorkflowInput,
	log: ReturnType<typeof createWorkflowLogger>,
	startTime: number
): Promise<InvitationWorkflowResult> {
	const { joinRequestId } = input;

	if (!joinRequestId) {
		throw new Error('Missing joinRequestId for CANCEL_JOIN_REQUEST action');
	}

	await DBOS.runStep(
		() =>
			prisma.$transaction(async (tx) => {
				await tx.joinRequest.update({
					where: { id: joinRequestId },
					data: {
						status: JoinRequestStatus.CANCELLED
					}
				});
			}),
		{ name: 'cancelJoinRequest' }
	);

	log.info('Join request cancelled', { joinRequestId });
	await DBOS.setEvent('workflow_status', { step: 'completed', joinRequestId });

	const success = { success: true, joinRequestId };
	logWorkflowEnd(log, input.action, true, startTime, success);
	return success;
}

// =============================================================================
// Export Registered Workflow
// =============================================================================

export const invitationWorkflow_v1 = DBOS.registerWorkflow(invitationWorkflow);
