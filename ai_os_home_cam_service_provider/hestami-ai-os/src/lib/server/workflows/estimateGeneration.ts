/**
 * Estimate Generation Workflow (v1)
 *
 * DBOS durable workflow for generating and managing estimates.
 * Handles: pricebook lookup, option sets, approvals, and conversion to jobs.
 *
 * State Machine:
 *   DRAFT → PENDING_REVIEW → SENT → VIEWED → ACCEPTED → CONVERTED
 *                              ↓       ↓
 *                           EXPIRED  DECLINED
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { orgTransaction } from '../db/rls.js';
import type { EstimateStatus } from '../../../../generated/prisma/client.js';
import { createWorkflowLogger } from './workflowLogger.js';
import { recordSpanError } from '../api/middleware/tracing.js';

const log = createWorkflowLogger('EstimateGenerationWorkflow');

const WORKFLOW_STATUS_EVENT = 'estimate_status';
const WORKFLOW_ERROR_EVENT = 'estimate_error';

const validTransitions: Record<EstimateStatus, EstimateStatus[]> = {
	DRAFT: ['SENT', 'REVISED'],
	SENT: ['VIEWED', 'EXPIRED', 'DECLINED'],
	VIEWED: ['ACCEPTED', 'DECLINED', 'EXPIRED', 'REVISED'],
	ACCEPTED: [],
	DECLINED: ['REVISED'],
	EXPIRED: ['REVISED'],
	REVISED: ['DRAFT']
};

interface EstimateGenerationInput {
	estimateId: string;
	organizationId: string;
	toStatus: EstimateStatus;
	userId: string;
	notes?: string;
	expiresAt?: Date;
	acceptedOptionId?: string;
}

interface EstimateGenerationResult {
	success: boolean;
	estimateId: string;
	fromStatus: EstimateStatus;
	toStatus: EstimateStatus;
	timestamp: string;
	jobId?: string;
	error?: string;
}

async function validateEstimateTransition(input: EstimateGenerationInput): Promise<{
	valid: boolean;
	currentStatus: EstimateStatus;
	organizationId?: string;
	error?: string;
}> {
	return orgTransaction(
		input.organizationId,
		async (tx) => {
			const estimate = await tx.estimate.findUnique({
				where: { id: input.estimateId },
				select: { status: true, organizationId: true, validUntil: true }
			});

			if (!estimate) {
				return { valid: false, currentStatus: 'DRAFT' as EstimateStatus, error: 'Estimate not found' };
			}

			const currentStatus = estimate.status as EstimateStatus;
			const allowedTransitions = validTransitions[currentStatus] || [];

			if (!allowedTransitions.includes(input.toStatus)) {
				return {
					valid: false,
					currentStatus,
					organizationId: estimate.organizationId,
					error: `Invalid transition from ${currentStatus} to ${input.toStatus}`
				};
			}

			// Check expiration
			if (estimate.validUntil && new Date() > estimate.validUntil) {
				if (!['EXPIRED', 'DECLINED'].includes(input.toStatus)) {
					return {
						valid: false,
						currentStatus,
						organizationId: estimate.organizationId,
						error: 'Estimate has expired'
					};
				}
			}

			return { valid: true, currentStatus, organizationId: estimate.organizationId };
		},
		{ userId: input.userId, reason: 'Validate estimate transition' }
	);
}

async function updateEstimateStatus(
	input: EstimateGenerationInput,
	fromStatus: EstimateStatus
): Promise<void> {
	await orgTransaction(
		input.organizationId,
		async (tx) => {
			const updateData: Record<string, unknown> = {
				status: input.toStatus
			};

			switch (input.toStatus) {
				case 'SENT':
					updateData.sentAt = new Date();
					if (input.expiresAt) updateData.validUntil = input.expiresAt;
					break;

				case 'VIEWED':
					updateData.viewedAt = new Date();
					break;

				case 'ACCEPTED':
					updateData.acceptedAt = new Date();
					updateData.acceptedBy = input.userId;
					if (input.acceptedOptionId) {
						updateData.acceptedOptionId = input.acceptedOptionId;
					}
					break;

				case 'DECLINED':
					updateData.declinedAt = new Date();
					break;

				case 'EXPIRED':
					// Status change only
					break;
			}

			await tx.estimate.update({
				where: { id: input.estimateId },
				data: updateData
			});

			log.info('Status changed', { estimateId: input.estimateId, fromStatus, toStatus: input.toStatus });
		},
		{ userId: input.userId, reason: 'Update estimate status' }
	);
}

async function lookupPricebookItems(organizationId: string, userId: string, estimateId: string): Promise<{
	itemCount: number;
	totalAmount: number;
}> {
	return orgTransaction(
		organizationId,
		async (tx) => {
			const lines = await tx.estimateLine.findMany({
				where: { estimateId },
				select: { lineTotal: true }
			});

			const totalAmount = lines.reduce((sum, line) => sum + Number(line.lineTotal), 0);

			return {
				itemCount: lines.length,
				totalAmount
			};
		},
		{ userId, reason: 'Lookup pricebook items for estimate' }
	);
}

async function convertToJob(organizationId: string, estimateId: string, userId: string): Promise<string | null> {
	return orgTransaction(
		organizationId,
		async (tx) => {
			const estimate = await tx.estimate.findUnique({
				where: { id: estimateId },
				include: {
					lines: true,
					options: true,
					job: { select: { id: true, customerId: true, associationId: true, propertyId: true, unitId: true } }
				}
			});

			if (!estimate || estimate.status !== 'ACCEPTED') {
				return null;
			}

			// Update the existing job to JOB_CREATED status
			await tx.job.update({
				where: { id: estimate.jobId },
				data: {
					status: 'JOB_CREATED',
					estimatedCost: estimate.totalAmount
				}
			});

			// Estimate stays ACCEPTED (no CONVERTED status)

			return estimate.jobId;
		},
		{ userId, reason: 'Convert estimate to job' }
	);
}

async function queueEstimateNotifications(
	estimateId: string,
	fromStatus: EstimateStatus,
	toStatus: EstimateStatus,
	userId: string
): Promise<void> {
	log.info('Notification queued', { estimateId, fromStatus, toStatus, userId });
}

async function estimateGenerationWorkflow(input: EstimateGenerationInput): Promise<EstimateGenerationResult> {
	const workflowId = DBOS.workflowID;

	try {
		const validation = await DBOS.runStep(
			() => validateEstimateTransition(input),
			{ name: 'validateEstimateTransition' }
		);
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'validated', ...validation });

		if (!validation.valid) {
			return {
				success: false,
				estimateId: input.estimateId,
				fromStatus: validation.currentStatus,
				toStatus: input.toStatus,
				timestamp: new Date().toISOString(),
				error: validation.error
			};
		}

		await DBOS.runStep(
			() => updateEstimateStatus(input, validation.currentStatus),
			{ name: 'updateEstimateStatus' }
		);
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'updated', status: input.toStatus });

		// Lookup pricebook items for reporting
		const pricebookInfo = await DBOS.runStep(
			() => lookupPricebookItems(input.organizationId, input.userId, input.estimateId),
			{ name: 'lookupPricebookItems' }
		);
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'pricebook_checked', ...pricebookInfo });

		// Convert to job if accepted
		let jobId: string | undefined;
		if (input.toStatus === 'ACCEPTED') {
			jobId = await DBOS.runStep(
				() => convertToJob(input.organizationId, input.estimateId, input.userId),
				{ name: 'convertToJob' }
			) ?? undefined;
			if (jobId) {
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'converted', jobId });
			}
		}

		await DBOS.runStep(
			() => queueEstimateNotifications(input.estimateId, validation.currentStatus, input.toStatus, input.userId),
			{ name: 'queueEstimateNotifications' }
		);
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'notifications_queued' });

		return {
			success: true,
			estimateId: input.estimateId,
			fromStatus: validation.currentStatus,
			toStatus: input.toStatus,
			timestamp: new Date().toISOString(),
			jobId
		};
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;
		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'ESTIMATE_GENERATION_WORKFLOW_ERROR'
		});

		return {
			success: false,
			estimateId: input.estimateId,
			fromStatus: 'DRAFT',
			toStatus: input.toStatus,
			timestamp: new Date().toISOString(),
			error: errorMessage
		};
	}
}

export const estimateGeneration_v1 = DBOS.registerWorkflow(estimateGenerationWorkflow);

export async function startEstimateGeneration(
	input: EstimateGenerationInput,
	workflowId?: string
): Promise<{ workflowId: string }> {
	const id = workflowId || `estimate-gen-${input.estimateId}-${Date.now()}`;
	await DBOS.startWorkflow(estimateGeneration_v1, { workflowID: id })(input);
	return { workflowId: id };
}

export async function getEstimateGenerationStatus(
	workflowId: string
): Promise<{ step: string;[key: string]: unknown } | null> {
	const status = await DBOS.getEvent(workflowId, WORKFLOW_STATUS_EVENT, 0);
	return status as { step: string;[key: string]: unknown } | null;
}

export async function getEstimateGenerationError(
	workflowId: string
): Promise<{ error: string } | null> {
	const error = await DBOS.getEvent(workflowId, WORKFLOW_ERROR_EVENT, 0);
	return error as { error: string } | null;
}

export type { EstimateGenerationInput, EstimateGenerationResult };
