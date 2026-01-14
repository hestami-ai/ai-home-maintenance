/**
 * External Approval Tracking Workflow (v1)
 *
 * DBOS durable workflow for tracking external HOA approvals.
 * Handles: submission tracking, response handling, expiration alerts.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import type { ExternalApprovalStatus } from '../../../../generated/prisma/client.js';
import { type LifecycleWorkflowResult } from './schemas.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger } from './workflowLogger.js';

const log = createWorkflowLogger('ExternalApprovalWorkflow');

const WORKFLOW_STATUS_EVENT = 'external_approval_status';
const WORKFLOW_ERROR_EVENT = 'external_approval_error';

export const ExternalApprovalAction = {
	SUBMIT_APPROVAL: 'SUBMIT_APPROVAL',
	RECORD_RESPONSE: 'RECORD_RESPONSE',
	CHECK_EXPIRATIONS: 'CHECK_EXPIRATIONS',
	EXTEND_APPROVAL: 'EXTEND_APPROVAL'
} as const;

export type ExternalApprovalAction = (typeof ExternalApprovalAction)[keyof typeof ExternalApprovalAction];

export interface ExternalApprovalWorkflowInput {
	action: ExternalApprovalAction;
	organizationId: string;
	userId: string;
	approvalId?: string;
	status?: ExternalApprovalStatus;
	approvalReference?: string;
	expiresAt?: string;
	notes?: string;
	daysAhead?: number;
}

export interface ExternalApprovalWorkflowResult extends LifecycleWorkflowResult {
	approvalId?: string;
	status?: string;
	expiringApprovals?: Array<{ id: string; approvalType: string; expiresAt: string; daysUntil: number }>;
}

async function submitApproval(
	approvalId: string,
	userId: string,
	approvalReference?: string
): Promise<{ status: string }> {
	const approval = await prisma.externalHOAApproval.findUnique({
		where: { id: approvalId }
	});

	if (!approval) {
		throw new Error('Approval not found');
	}

	if (approval.status !== 'PENDING') {
		throw new Error(`Cannot submit approval in status ${approval.status}`);
	}

	await prisma.externalHOAApproval.update({
		where: { id: approvalId },
		data: {
			status: 'SUBMITTED',
			submittedAt: new Date(),
			...(approvalReference && { approvalReference })
		}
	});

	return { status: 'SUBMITTED' };
}

async function recordResponse(
	approvalId: string,
	status: ExternalApprovalStatus,
	userId: string,
	expiresAt?: string,
	notes?: string
): Promise<{ status: string }> {
	const approval = await prisma.externalHOAApproval.findUnique({
		where: { id: approvalId }
	});

	if (!approval) {
		throw new Error('Approval not found');
	}

	if (approval.status !== 'SUBMITTED') {
		throw new Error(`Cannot record response for approval in status ${approval.status}`);
	}

	if (!['APPROVED', 'DENIED'].includes(status)) {
		throw new Error('Response status must be APPROVED or DENIED');
	}

	await prisma.externalHOAApproval.update({
		where: { id: approvalId },
		data: {
			status,
			responseAt: new Date(),
			...(expiresAt && { expiresAt: new Date(expiresAt) }),
			...(notes && { notes })
		}
	});

	return { status };
}

async function checkExpiringApprovals(
	organizationId: string,
	daysAhead: number = 30
): Promise<Array<{ id: string; approvalType: string; expiresAt: string; daysUntil: number }>> {
	const now = new Date();
	const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

	const approvals = await prisma.externalHOAApproval.findMany({
		where: {
			externalHoaContext: { organizationId },
			status: 'APPROVED',
			expiresAt: { gte: now, lte: futureDate },
			deletedAt: null
		}
	});

	return approvals.map((a) => {
		const daysUntil = Math.ceil((a.expiresAt!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
		return {
			id: a.id,
			approvalType: a.approvalType,
			expiresAt: a.expiresAt!.toISOString(),
			daysUntil
		};
	}).sort((a, b) => a.daysUntil - b.daysUntil);
}

async function markExpiredApprovals(organizationId: string): Promise<number> {
	const now = new Date();

	const result = await prisma.externalHOAApproval.updateMany({
		where: {
			externalHoaContext: { organizationId },
			status: 'APPROVED',
			expiresAt: { lt: now },
			deletedAt: null
		},
		data: { status: 'EXPIRED' }
	});

	return result.count;
}

async function extendApproval(
	approvalId: string,
	newExpiresAt: string,
	userId: string,
	notes?: string
): Promise<{ expiresAt: string }> {
	const approval = await prisma.externalHOAApproval.findUnique({
		where: { id: approvalId }
	});

	if (!approval) {
		throw new Error('Approval not found');
	}

	if (approval.status !== 'APPROVED') {
		throw new Error('Can only extend approved approvals');
	}

	await prisma.externalHOAApproval.update({
		where: { id: approvalId },
		data: {
			expiresAt: new Date(newExpiresAt),
			...(notes && { notes: `${approval.notes || ''}\n[Extended] ${notes}`.trim() })
		}
	});

	return { expiresAt: newExpiresAt };
}

async function externalApprovalWorkflow(
	input: ExternalApprovalWorkflowInput
): Promise<ExternalApprovalWorkflowResult> {
	try {
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'started', action: input.action });

		switch (input.action) {
			case 'SUBMIT_APPROVAL': {
				if (!input.approvalId) {
					throw new Error('Missing approvalId for SUBMIT_APPROVAL');
				}
				const result = await DBOS.runStep(
					() => submitApproval(input.approvalId!, input.userId, input.approvalReference),
					{ name: 'submitApproval' }
				);
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'approval_submitted', ...result });
				return {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					approvalId: input.approvalId,
					status: result.status
				};
			}

			case 'RECORD_RESPONSE': {
				if (!input.approvalId || !input.status) {
					throw new Error('Missing approvalId or status for RECORD_RESPONSE');
				}
				const result = await DBOS.runStep(
					() =>
						recordResponse(
							input.approvalId!,
							input.status!,
							input.userId,
							input.expiresAt,
							input.notes
						),
					{ name: 'recordResponse' }
				);
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'response_recorded', ...result });
				return {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					approvalId: input.approvalId,
					status: result.status
				};
			}

			case 'CHECK_EXPIRATIONS': {
				// First mark any already expired
				const expiredCount = await DBOS.runStep(
					() => markExpiredApprovals(input.organizationId),
					{ name: 'markExpiredApprovals' }
				);

				// Then check upcoming expirations
				const expiringApprovals = await DBOS.runStep(
					() => checkExpiringApprovals(input.organizationId, input.daysAhead || 30),
					{ name: 'checkExpiringApprovals' }
				);
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, {
					step: 'expirations_checked',
					expiredCount,
					upcomingCount: expiringApprovals.length
				});
				return {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					expiringApprovals
				};
			}

			case 'EXTEND_APPROVAL': {
				if (!input.approvalId || !input.expiresAt) {
					throw new Error('Missing approvalId or expiresAt for EXTEND_APPROVAL');
				}
				const result = await DBOS.runStep(
					() => extendApproval(input.approvalId!, input.expiresAt!, input.userId, input.notes),
					{ name: 'extendApproval' }
				);
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'approval_extended', ...result });
				return {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					approvalId: input.approvalId
				};
			}

			default:
				return {
					success: false,
					action: input.action,
					timestamp: new Date().toISOString(),
					error: `Unknown action: ${input.action}`
				};
		}
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;
		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'EXTERNAL_APPROVAL_WORKFLOW_ERROR'
		});

		return {
			success: false,
			action: input.action,
			timestamp: new Date().toISOString(),
			error: errorMessage
		};
	}
}

export const externalApprovalWorkflow_v1 = DBOS.registerWorkflow(externalApprovalWorkflow);

export async function startExternalApprovalWorkflow(
	input: ExternalApprovalWorkflowInput,
	workflowId?: string, idempotencyKey: string
): Promise<{ workflowId: string }> {
	const id =
		workflowId ||
		`approval-${input.action.toLowerCase()}-${input.approvalId || input.organizationId}-${Date.now()}`;
	await DBOS.startWorkflow(externalApprovalWorkflow_v1, { workflowID: idempotencyKey})(input);
	return { workflowId: id };
}

export async function getExternalApprovalWorkflowStatus(
	workflowId: string
): Promise<{ step: string;[key: string]: unknown } | null> {
	const status = await DBOS.getEvent(workflowId, WORKFLOW_STATUS_EVENT, 0);
	return status as { step: string;[key: string]: unknown } | null;
}

