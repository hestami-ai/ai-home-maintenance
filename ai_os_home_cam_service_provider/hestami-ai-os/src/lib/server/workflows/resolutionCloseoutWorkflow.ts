/**
 * Resolution Closeout Workflow (v1)
 *
 * DBOS durable workflow for case resolution and closeout.
 * Handles: resolution validation, decision recording, case closure, owner notification.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import type { DecisionCategory } from '../../../../generated/prisma/client.js';
import { recordSpanError } from '../api/middleware/tracing.js';

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
	if (!['IN_PROGRESS', 'PENDING_EXTERNAL', 'PENDING_OWNER'].includes(caseRecord.status)) {
		issues.push(`Case is in status ${caseRecord.status}, cannot resolve`);
	}

	// Check all actions are completed or cancelled
	const pendingActions = caseRecord.actions.filter(
		(a) => !['COMPLETED', 'CANCELLED'].includes(a.status)
	);
	if (pendingActions.length > 0) {
		issues.push(`${pendingActions.length} action(s) still pending`);
	}

	// Check resolution summary exists if already resolved
	if (caseRecord.status === 'RESOLVED' && !caseRecord.resolutionSummary) {
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
	const decision = await prisma.materialDecision.create({
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

	return { decisionId: decision.id };
}

async function resolveAndCloseCase(
	caseId: string,
	resolutionSummary: string,
	userId: string
): Promise<{ status: string }> {
	const caseRecord = await prisma.conciergeCase.findUnique({
		where: { id: caseId }
	});

	if (!caseRecord) {
		throw new Error('Case not found');
	}

	// If not already resolved, resolve first
	if (caseRecord.status !== 'RESOLVED') {
		await prisma.conciergeCase.update({
			where: { id: caseId },
			data: {
				status: 'RESOLVED',
				resolutionSummary,
				resolvedBy: userId,
				resolvedAt: new Date()
			}
		});

		await prisma.caseStatusHistory.create({
			data: {
				caseId,
				fromStatus: caseRecord.status,
				toStatus: 'RESOLVED',
				reason: resolutionSummary,
				changedBy: userId
			}
		});
	}

	// Now close
	await prisma.conciergeCase.update({
		where: { id: caseId },
		data: {
			status: 'CLOSED',
			closedAt: new Date()
		}
	});

	await prisma.caseStatusHistory.create({
		data: {
			caseId,
			fromStatus: 'RESOLVED',
			toStatus: 'CLOSED',
			reason: 'Case closed after resolution',
			changedBy: userId
		}
	});

	return { status: 'CLOSED' };
}

async function createOwnerNotification(
	caseId: string,
	organizationId: string,
	userId: string
): Promise<void> {
	// Create an internal note indicating owner should be notified
	// In a full implementation, this would trigger an actual notification
	await prisma.caseNote.create({
		data: {
			caseId,
			content: 'Owner notification: Case has been resolved and closed.',
			createdBy: userId,
			isInternal: false // Visible to owner
		}
	});
}

async function resolutionCloseoutWorkflow(
	input: ResolutionCloseoutWorkflowInput
): Promise<ResolutionCloseoutWorkflowResult> {
	try {
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'started', action: input.action });

		switch (input.action) {
			case 'VALIDATE_RESOLUTION': {
				const validation = await DBOS.runStep(() => validateResolution(input.caseId), {
					name: 'validateResolution'
				});
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'validation_complete', ...validation });
				return {
					success: validation.isValid,
					action: input.action,
					timestamp: new Date().toISOString(),
					caseId: input.caseId,
					validationIssues: validation.issues
				};
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
				const result = await DBOS.runStep(
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
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'decision_recorded', ...result });
				return {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					caseId: input.caseId,
					decisionId: result.decisionId
				};
			}

			case 'CLOSE_CASE': {
				if (!input.resolutionSummary) {
					throw new Error('Missing resolutionSummary for CLOSE_CASE');
				}
				const result = await DBOS.runStep(
					() => resolveAndCloseCase(input.caseId, input.resolutionSummary!, input.userId),
					{ name: 'resolveAndCloseCase' }
				);
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'case_closed', ...result });
				return {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					caseId: input.caseId,
					status: result.status
				};
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
					return {
						success: false,
						action: input.action,
						timestamp: new Date().toISOString(),
						caseId: input.caseId,
						validationIssues: validation.issues,
						error: 'Validation failed'
					};
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
					() => resolveAndCloseCase(input.caseId, input.resolutionSummary!, input.userId),
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

				return {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					caseId: input.caseId,
					decisionId,
					status: closeResult.status
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
			errorType: 'RESOLUTION_CLOSEOUT_WORKFLOW_ERROR'
		});

		return {
			success: false,
			action: input.action,
			timestamp: new Date().toISOString(),
			error: errorMessage
		};
	}
}

export const resolutionCloseoutWorkflow_v1 = DBOS.registerWorkflow(resolutionCloseoutWorkflow);

export async function startResolutionCloseoutWorkflow(
	input: ResolutionCloseoutWorkflowInput,
	workflowId?: string
): Promise<{ workflowId: string }> {
	const id = workflowId || `closeout-${input.action.toLowerCase()}-${input.caseId}-${Date.now()}`;
	await DBOS.startWorkflow(resolutionCloseoutWorkflow_v1, { workflowID: id })(input);
	return { workflowId: id };
}

export async function getResolutionCloseoutWorkflowStatus(
	workflowId: string
): Promise<{ step: string;[key: string]: unknown } | null> {
	const status = await DBOS.getEvent(workflowId, WORKFLOW_STATUS_EVENT, 0);
	return status as { step: string;[key: string]: unknown } | null;
}

export type { ResolutionCloseoutWorkflowInput, ResolutionCloseoutWorkflowResult };
