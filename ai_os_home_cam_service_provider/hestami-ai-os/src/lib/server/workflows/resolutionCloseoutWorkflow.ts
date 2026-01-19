/**
 * Resolution Closeout Workflow (v1)
 *
 * DBOS durable workflow for case resolution and closeout.
 * Handles: resolution validation, decision recording, case closure, owner notification.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import { orgTransaction } from '../db/rls.js';
import type { DecisionCategory } from '../../../../generated/prisma/client.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger, logWorkflowStart, logWorkflowEnd, logStepError } from './workflowLogger.js';
import { ActivityActionType, ConciergeCaseStatus, ConciergeActionStatus } from '../../../../generated/prisma/enums.js';

// Workflow error types for tracing
const WorkflowErrorType = {
	RESOLUTION_CLOSEOUT_WORKFLOW_ERROR: 'RESOLUTION_CLOSEOUT_WORKFLOW_ERROR'
} as const;

// Action types for resolution closeout workflow
export const ResolutionCloseoutAction = {
	VALIDATE_RESOLUTION: 'VALIDATE_RESOLUTION',
	RECORD_DECISION: 'RECORD_DECISION',
	CLOSE_CASE: 'CLOSE_CASE',
	FULL_CLOSEOUT: 'FULL_CLOSEOUT'
} as const;

const log = createWorkflowLogger('resolutionCloseoutWorkflow');

const WORKFLOW_STATUS_EVENT = 'resolution_closeout_status';
const WORKFLOW_ERROR_EVENT = 'resolution_closeout_error';

interface ResolutionCloseoutWorkflowInput {
	action: 'VALIDATE_RESOLUTION' | 'RECORD_DECISION' | 'CLOSE_CASE' | 'FULL_CLOSEOUT';
	organizationId: string;
	userId: string;
	caseId: string;
	resolutionSummary?: string;
	decisionCategory?: DecisionCategory;
	decisionTitle?: string;
	decisionDescription?: string;
	decisionRationale?: string;
	notifyOwner?: boolean;
}

interface ResolutionCloseoutWorkflowResult {
	success: boolean;
	action: string;
	timestamp: string;
	caseId?: string;
	decisionId?: string;
	status?: string;
	validationIssues?: string[];
	error?: string;
}

interface ValidationResult {
	isValid: boolean;
	issues: string[];
}

async function validateResolution(caseId: string): Promise<ValidationResult> {
	const caseRecord = await prisma.conciergeCase.findUnique({
		where: { id: caseId },
		include: {
			actions: { where: { deletedAt: null } },
			decisions: { where: { deletedAt: null } }
		}
	});

	if (!caseRecord) {
		return { isValid: false, issues: ['Case not found'] };
	}

	const issues: string[] = [];

	// Check case is in resolvable state
	if (!([ConciergeCaseStatus.IN_PROGRESS, ConciergeCaseStatus.PENDING_EXTERNAL, ConciergeCaseStatus.PENDING_OWNER] as ConciergeCaseStatus[]).includes(caseRecord.status as ConciergeCaseStatus)) {
		issues.push(`Case is in status ${caseRecord.status}, cannot resolve`);
	}

	// Check all actions are completed or cancelled
	const pendingActions = caseRecord.actions.filter(
		(a) => !([ConciergeActionStatus.COMPLETED, ConciergeActionStatus.CANCELLED] as ConciergeActionStatus[]).includes(a.status as ConciergeActionStatus)
	);
	if (pendingActions.length > 0) {
		issues.push(`${pendingActions.length} action(s) still pending`);
	}

	// Check resolution summary exists if already resolved
	if (caseRecord.status === ConciergeCaseStatus.RESOLVED && !caseRecord.resolutionSummary) {
		issues.push('Resolution summary is required');
	}

	return { isValid: issues.length === 0, issues };
}

async function recordResolutionDecision(
	caseId: string,
	organizationId: string,
	userId: string,
	category: DecisionCategory,
	title: string,
	description: string,
	rationale: string
): Promise<{ decisionId: string }> {
	const decision = await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.materialDecision.create({
				data: {
					organizationId,
					caseId,
					category,
					title,
					description,
					rationale,
					decidedByUserId: userId,
					decidedAt: new Date()
				}
			});
		},
		{ userId, reason: 'Record resolution decision' }
	);

	return { decisionId: decision.id };
}

async function resolveAndCloseCase(
	caseId: string,
	resolutionSummary: string,
	userId: string,
	organizationId: string
): Promise<{ status: string }> {
	return orgTransaction(
		organizationId,
		async (tx) => {
			const caseRecord = await tx.conciergeCase.findUnique({
				where: { id: caseId }
			});

			if (!caseRecord) {
				throw new Error('Case not found');
			}

			// If not already resolved, resolve first
			if (caseRecord.status !== ConciergeCaseStatus.RESOLVED) {
				await tx.conciergeCase.update({
					where: { id: caseId },
					data: {
						status: ConciergeCaseStatus.RESOLVED,
						resolutionSummary,
						resolvedBy: userId,
						resolvedAt: new Date()
					}
				});

				await tx.caseStatusHistory.create({
					data: {
						caseId,
						fromStatus: caseRecord.status,
						toStatus: ConciergeCaseStatus.RESOLVED,
						reason: resolutionSummary,
						changedBy: userId
					}
				});
			}

			// Now close
			await tx.conciergeCase.update({
				where: { id: caseId },
				data: {
					status: ConciergeCaseStatus.CLOSED,
					closedAt: new Date()
				}
			});

			await tx.caseStatusHistory.create({
				data: {
					caseId,
					fromStatus: ConciergeCaseStatus.RESOLVED,
					toStatus: ConciergeCaseStatus.CLOSED,
					reason: 'Case closed after resolution',
					changedBy: userId
				}
			});

			return { status: ConciergeCaseStatus.CLOSED };
		},
		{ userId, reason: 'Resolve and close case' }
	);
}

async function createOwnerNotification(
	caseId: string,
	organizationId: string,
	userId: string
): Promise<void> {
	// Create an internal note indicating owner should be notified
	// In a full implementation, this would trigger an actual notification
	await orgTransaction(
		organizationId,
		async (tx) => {
			await tx.caseNote.create({
				data: {
					caseId,
					content: 'Owner notification: Case has been resolved and closed.',
					createdBy: userId,
					isInternal: false // Visible to owner
				}
			});
		},
		{ userId, reason: 'Create owner notification' }
	);
}

async function resolutionCloseoutWorkflow(
	input: ResolutionCloseoutWorkflowInput
): Promise<ResolutionCloseoutWorkflowResult> {
	const startTime = logWorkflowStart(log, input.action, { caseId: input.caseId, organizationId: input.organizationId }, 'resolutionCloseoutWorkflow');
	try {
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'started', action: input.action });

		switch (input.action) {
			case 'VALIDATE_RESOLUTION': {
				const validation = await DBOS.runStep(() => validateResolution(input.caseId), {
					name: 'validateResolution'
				});
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'validation_complete', ...validation });
				const result = {
					success: validation.isValid,
					action: input.action,
					timestamp: new Date().toISOString(),
					caseId: input.caseId,
					validationIssues: validation.issues
				};
				logWorkflowEnd(log, input.action, validation.isValid, startTime, result);
				return result;
			}

			case 'RECORD_DECISION': {
				if (
					!input.decisionCategory ||
					!input.decisionTitle ||
					!input.decisionDescription ||
					!input.decisionRationale
				) {
					throw new Error('Missing decision fields for RECORD_DECISION');
				}
				const decisionResult = await DBOS.runStep(
					() =>
						recordResolutionDecision(
							input.caseId,
							input.organizationId,
							input.userId,
							input.decisionCategory!,
							input.decisionTitle!,
							input.decisionDescription!,
							input.decisionRationale!
						),
					{ name: 'recordResolutionDecision' }
				);
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'decision_recorded', ...decisionResult });
				const result = {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					caseId: input.caseId,
					decisionId: decisionResult.decisionId
				};
				logWorkflowEnd(log, input.action, true, startTime, result);
				return result;
			}

			case 'CLOSE_CASE': {
				if (!input.resolutionSummary) {
					throw new Error('Missing resolutionSummary for CLOSE_CASE');
				}
				const closeResult = await DBOS.runStep(
					() => resolveAndCloseCase(input.caseId, input.resolutionSummary!, input.userId, input.organizationId),
					{ name: 'resolveAndCloseCase' }
				);
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'case_closed', ...closeResult });
				const result = {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					caseId: input.caseId,
					status: closeResult.status
				};
				logWorkflowEnd(log, input.action, true, startTime, result);
				return result;
			}

			case 'FULL_CLOSEOUT': {
				if (!input.resolutionSummary) {
					throw new Error('Missing resolutionSummary for FULL_CLOSEOUT');
				}

				// Step 1: Validate
				const validation = await DBOS.runStep(() => validateResolution(input.caseId), {
					name: 'validateResolution'
				});
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'validation_complete', ...validation });

				if (!validation.isValid) {
					const failResult = {
						success: false,
						action: input.action,
						timestamp: new Date().toISOString(),
						caseId: input.caseId,
						validationIssues: validation.issues,
						error: 'Validation failed'
					};
					logWorkflowEnd(log, input.action, false, startTime, failResult);
					return failResult;
				}

				// Step 2: Record decision if provided
				let decisionId: string | undefined;
				if (input.decisionCategory && input.decisionTitle && input.decisionRationale) {
					const decisionResult = await DBOS.runStep(
						() =>
							recordResolutionDecision(
								input.caseId,
								input.organizationId,
								input.userId,
								input.decisionCategory!,
								input.decisionTitle!,
								input.decisionDescription || input.resolutionSummary!,
								input.decisionRationale!
							),
						{ name: 'recordResolutionDecision' }
					);
					decisionId = decisionResult.decisionId;
					await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'decision_recorded', decisionId });
				}

				// Step 3: Close case
				const closeResult = await DBOS.runStep(
					() => resolveAndCloseCase(input.caseId, input.resolutionSummary!, input.userId, input.organizationId),
					{ name: 'resolveAndCloseCase' }
				);
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'case_closed', ...closeResult });

				// Step 4: Notify owner if requested
				if (input.notifyOwner) {
					await DBOS.runStep(
						() => createOwnerNotification(input.caseId, input.organizationId, input.userId),
						{ name: 'createOwnerNotification' }
					);
					await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'owner_notified' });
				}

				const result = {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					caseId: input.caseId,
					decisionId,
					status: closeResult.status
				};
				logWorkflowEnd(log, input.action, true, startTime, result);
				return result;
			}

			default: {
				const result = {
					success: false,
					action: input.action,
					timestamp: new Date().toISOString(),
					error: `Unknown action: ${input.action}`
				};
				logWorkflowEnd(log, input.action, false, startTime, result);
				return result;
			}
		}
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;

		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: ActivityActionType.WORKFLOW_FAILED,
			errorType: WorkflowErrorType.RESOLUTION_CLOSEOUT_WORKFLOW_ERROR
		});

		logStepError(log, input.action, errorObj, { caseId: input.caseId });

		const result = {
			success: false,
			action: input.action,
			timestamp: new Date().toISOString(),
			error: errorMessage
		};
		logWorkflowEnd(log, input.action, false, startTime, result);
		return result;
	}
}

export const resolutionCloseoutWorkflow_v1 = DBOS.registerWorkflow(resolutionCloseoutWorkflow);

export async function startResolutionCloseoutWorkflow(
	input: ResolutionCloseoutWorkflowInput,
	idempotencyKey: string
): Promise<{ workflowId: string }> {
	await DBOS.startWorkflow(resolutionCloseoutWorkflow_v1, { workflowID: idempotencyKey })(input);
	return { workflowId: idempotencyKey };
}

export async function getResolutionCloseoutWorkflowStatus(
	workflowId: string
): Promise<{ step: string;[key: string]: unknown } | null> {
	const status = await DBOS.getEvent(workflowId, WORKFLOW_STATUS_EVENT, 0);
	return status as { step: string;[key: string]: unknown } | null;
}

export type { ResolutionCloseoutWorkflowInput, ResolutionCloseoutWorkflowResult };
