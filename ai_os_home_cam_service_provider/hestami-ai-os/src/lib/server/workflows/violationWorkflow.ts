/**
 * Violation Workflow (v1)
 *
 * DBOS durable workflow for managing violation operations.
 * Handles: update, updateStatus, scheduleHearing, recordHearingOutcome, recordAppeal, scheduleAppealHearing, recordAppealDecision.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import { orgTransaction, clearOrgContext } from '../db/rls.js';
import type { Prisma } from '../../../../generated/prisma/client.js';
import {
	ViolationStatus,
	ViolationSeverity,
	HearingOutcome,
	AppealStatus,
	type EntityWorkflowResult
} from './schemas.js';
import { createWorkflowLogger } from './workflowLogger.js';
import { recordSpanError } from '../api/middleware/tracing.js';

const log = createWorkflowLogger('ViolationWorkflow');

// Action types for the unified workflow
export const ViolationAction = {
	UPDATE_VIOLATION: 'UPDATE_VIOLATION',
	UPDATE_STATUS: 'UPDATE_STATUS',
	SCHEDULE_HEARING: 'SCHEDULE_HEARING',
	RECORD_HEARING_OUTCOME: 'RECORD_HEARING_OUTCOME',
	RECORD_APPEAL: 'RECORD_APPEAL',
	SCHEDULE_APPEAL_HEARING: 'SCHEDULE_APPEAL_HEARING',
	RECORD_APPEAL_DECISION: 'RECORD_APPEAL_DECISION'
} as const;

export type ViolationAction = (typeof ViolationAction)[keyof typeof ViolationAction];

export interface ViolationWorkflowInput {
	action: ViolationAction;
	organizationId: string;
	userId: string;
	violationId: string;
	data: {
		title?: string;
		description?: string;
		severity?: ViolationSeverity;
		unitId?: string;
		commonAreaName?: string;
		locationDetails?: string;
		observedDate?: string;
		responsiblePartyId?: string;
		reporterType?: string;
		status?: ViolationStatus;
		notes?: string;
		hearingDate?: string;
		hearingLocation?: string;
		hearingNotes?: string;
		outcome?: HearingOutcome;
		fineAmount?: number;
		appealReason?: string;
		appealDate?: string;
		appealStatus?: AppealStatus;
		appealDecision?: string;
		appealDecisionDate?: string;
		hearingId?: string;
		reason?: string;
		appealId?: string;
		decision?: string;
		filedBy?: string;
		documentsJson?: string | null;
		revisedFineAmount?: number;
	};
}

export interface ViolationWorkflowResult extends EntityWorkflowResult {
	// Inherits success, error, entityId from EntityWorkflowResult
}

// Step functions for each operation
async function updateViolation(
	organizationId: string,
	userId: string,
	violationId: string,
	data: Record<string, unknown>
): Promise<string> {
	const updateData: Prisma.ViolationUncheckedUpdateInput = {};
	if (data.title !== undefined) updateData.title = data.title as string;
	if (data.description !== undefined) updateData.description = data.description as string;
	if (data.severity !== undefined) updateData.severity = data.severity as any;
	if (data.unitId !== undefined) updateData.unitId = data.unitId as string;
	if (data.commonAreaName !== undefined) updateData.commonAreaName = data.commonAreaName as string;
	if (data.locationDetails !== undefined) updateData.locationDetails = data.locationDetails as string;
	if (data.observedDate !== undefined) updateData.observedDate = new Date(data.observedDate as string);
	if (data.responsiblePartyId !== undefined) updateData.responsiblePartyId = data.responsiblePartyId as string;
	if (data.reporterType !== undefined) updateData.reporterType = data.reporterType as any;

	try {
		await orgTransaction(organizationId, async (tx) => {
			return tx.violation.update({
				where: { id: violationId },
				data: updateData
			});
		}, { userId, reason: 'Updating violation via workflow' });

		log.info('UPDATE_VIOLATION completed', { violationId, userId });
		return violationId;
	} finally {
		await clearOrgContext(userId);
	}
}

async function updateStatus(
	organizationId: string,
	userId: string,
	violationId: string,
	data: Record<string, unknown>
): Promise<string> {
	const newStatus = data.status as ViolationStatus;
	const notes = data.notes as string | undefined;

	const violation = await prisma.violation.findUnique({ where: { id: violationId } });
	if (!violation) throw new Error('Violation not found');

	const oldStatus = violation.status;

	try {
		await orgTransaction(organizationId, async (tx) => {
			await tx.violation.update({
				where: { id: violationId },
				data: { status: newStatus }
			});

			await tx.violationStatusHistory.create({
				data: {
					violationId,
					fromStatus: oldStatus,
					toStatus: newStatus,
					changedBy: userId,
					notes
				}
			});
		}, { userId, reason: `Updating violation status from ${oldStatus} to ${newStatus}` });

		log.info('UPDATE_STATUS completed', { violationId, oldStatus, newStatus, userId });
		return violationId;
	} finally {
		await clearOrgContext(userId);
	}
}

async function scheduleHearing(
	organizationId: string,
	userId: string,
	violationId: string,
	data: Record<string, unknown>
): Promise<string> {
	try {
		const hearingId = await orgTransaction(organizationId, async (tx) => {
			const hearing = await tx.violationHearing.create({
				data: {
					violationId,
					hearingDate: new Date(data.hearingDate as string),
					hearingTime: data.hearingTime as string | undefined,
					location: data.location as string | undefined,
					hearingOfficer: data.hearingOfficer as string | undefined
				}
			});

			// Update violation status
			await tx.violation.update({
				where: { id: violationId },
				data: { status: 'HEARING_SCHEDULED' }
			});

			return hearing.id;
		}, { userId, reason: 'Scheduling violation hearing via workflow' });

		log.info('SCHEDULE_HEARING completed', { hearingId, violationId, userId });
		return hearingId;
	} finally {
		await clearOrgContext(userId);
	}
}

async function recordHearingOutcome(
	organizationId: string,
	userId: string,
	violationId: string,
	data: Record<string, unknown>
): Promise<string> {
	const hearingId = data.hearingId as string;
	const outcome = data.outcome as string;
	const notes = data.notes as string | undefined;

	// Determine new violation status based on outcome
	let newStatus: ViolationStatus = 'HEARING_HELD';
	if (outcome === 'DISMISSED') {
		newStatus = 'DISMISSED';
	} else if (outcome === 'FINE_IMPOSED') {
		newStatus = 'FINE_ASSESSED';
	}

	try {
		await orgTransaction(organizationId, async (tx) => {
			await tx.violationHearing.update({
				where: { id: hearingId },
				data: {
					outcome: outcome as any,
					outcomeNotes: notes,
					recordedBy: userId,
					recordedAt: new Date()
				}
			});

			await tx.violation.update({
				where: { id: violationId },
				data: { status: newStatus }
			});
		}, { userId, reason: `Recording hearing outcome: ${outcome}` });

		log.info('RECORD_HEARING_OUTCOME completed', { hearingId, outcome, userId });
		return hearingId;
	} finally {
		await clearOrgContext(userId);
	}
}

async function recordAppeal(
	organizationId: string,
	userId: string,
	violationId: string,
	data: Record<string, unknown>
): Promise<string> {
	const hearingId = data.hearingId as string;
	const reason = data.reason as string;
	const filedBy = data.filedBy as string | undefined;

	try {
		const appealId = await orgTransaction(organizationId, async (tx) => {
			const appeal = await tx.violationAppeal.create({
				data: {
					hearingId,
					reason,
					filedBy: filedBy || userId,
					filedDate: new Date(),
					status: 'PENDING'
				}
			});

			// Update violation status
			await tx.violation.update({
				where: { id: violationId },
				data: { status: 'APPEALED' }
			});

			return appeal.id;
		}, { userId, reason: 'Recording appeal for violation via workflow' });

		log.info('RECORD_APPEAL completed', { appealId, violationId, userId });
		return appealId;
	} finally {
		await clearOrgContext(userId);
	}
}

async function scheduleAppealHearing(
	organizationId: string,
	userId: string,
	violationId: string,
	data: Record<string, unknown>
): Promise<string> {
	const appealId = data.appealId as string;

	try {
		await orgTransaction(organizationId, async (tx) => {
			return tx.violationAppeal.update({
				where: { id: appealId },
				data: {
					appealHearingDate: new Date(data.appealHearingDate as string),
					appealHearingLocation: data.appealHearingLocation as string | undefined,
					status: 'SCHEDULED'
				}
			});
		}, { userId, reason: 'Scheduling appeal hearing via workflow' });

		log.info('SCHEDULE_APPEAL_HEARING completed', { appealId, userId });
		return appealId;
	} finally {
		await clearOrgContext(userId);
	}
}

async function recordAppealDecision(
	organizationId: string,
	userId: string,
	violationId: string,
	data: Record<string, unknown>
): Promise<string> {
	const appealId = data.appealId as string;
	const decision = data.decision as string;
	const notes = data.notes as string | undefined;

	const newStatus: ViolationStatus = decision === 'OVERTURNED' ? 'DISMISSED' : 'CLOSED';

	try {
		await orgTransaction(organizationId, async (tx) => {
			await tx.violationAppeal.update({
				where: { id: appealId },
				data: {
					decisionNotes: notes,
					decisionDate: new Date(),
					decisionBy: userId,
					status: 'UPHELD'
				}
			});

			await tx.violation.update({
				where: { id: violationId },
				data: { status: newStatus }
			});
		}, { userId, reason: `Recording appeal decision: ${decision}` });

		log.info('RECORD_APPEAL_DECISION completed', { appealId, decision, userId });
		return appealId;
	} finally {
		await clearOrgContext(userId);
	}
}

// Main workflow function
async function violationWorkflow(input: ViolationWorkflowInput): Promise<ViolationWorkflowResult> {
	try {
		let entityId: string | undefined;

		switch (input.action) {
			case 'UPDATE_VIOLATION':
				entityId = await DBOS.runStep(
					() => updateViolation(input.organizationId, input.userId, input.violationId, input.data),
					{ name: 'updateViolation' }
				);
				break;

			case 'UPDATE_STATUS':
				entityId = await DBOS.runStep(
					() => updateStatus(input.organizationId, input.userId, input.violationId, input.data),
					{ name: 'updateStatus' }
				);
				break;

			case 'SCHEDULE_HEARING':
				entityId = await DBOS.runStep(
					() => scheduleHearing(input.organizationId, input.userId, input.violationId, input.data),
					{ name: 'scheduleHearing' }
				);
				break;

			case 'RECORD_HEARING_OUTCOME':
				entityId = await DBOS.runStep(
					() => recordHearingOutcome(input.organizationId, input.userId, input.violationId, input.data),
					{ name: 'recordHearingOutcome' }
				);
				break;

			case 'RECORD_APPEAL':
				entityId = await DBOS.runStep(
					() => recordAppeal(input.organizationId, input.userId, input.violationId, input.data),
					{ name: 'recordAppeal' }
				);
				break;

			case 'SCHEDULE_APPEAL_HEARING':
				entityId = await DBOS.runStep(
					() => scheduleAppealHearing(input.organizationId, input.userId, input.violationId, input.data),
					{ name: 'scheduleAppealHearing' }
				);
				break;

			case 'RECORD_APPEAL_DECISION':
				entityId = await DBOS.runStep(
					() => recordAppealDecision(input.organizationId, input.userId, input.violationId, input.data),
					{ name: 'recordAppealDecision' }
				);
				break;

			default:
				return { success: false, error: `Unknown action: ${input.action}` };
		}

		return { success: true, entityId };
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;
		console.error(`[ViolationWorkflow] Error in ${input.action}:`, errorMessage);

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'VIOLATION_WORKFLOW_ERROR'
		});

		return { success: false, error: errorMessage };
	}
}

export const violationWorkflow_v1 = DBOS.registerWorkflow(violationWorkflow);

export async function startViolationWorkflow(
	input: ViolationWorkflowInput,
	idempotencyKey?: string
): Promise<ViolationWorkflowResult> {
	const workflowId = idempotencyKey || `violation-${input.action}-${input.violationId}-${Date.now()}`;
	const handle = await DBOS.startWorkflow(violationWorkflow_v1, { workflowID: workflowId })(input);
	return handle.getResult();
}
