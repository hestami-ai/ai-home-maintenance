/**
 * Violation Workflow (v1)
 *
 * DBOS durable workflow for managing violation operations.
 * Handles: update, updateStatus, scheduleHearing, recordHearingOutcome, recordAppeal, scheduleAppealHearing, recordAppealDecision.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
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
	DELETE_VIOLATION: 'DELETE_VIOLATION',
	SEND_NOTICE: 'SEND_NOTICE',
	ESCALATE: 'ESCALATE',
	DISMISS: 'DISMISS',
	SCHEDULE_HEARING: 'SCHEDULE_HEARING',
	RECORD_HEARING_OUTCOME: 'RECORD_HEARING_OUTCOME',
	RECORD_APPEAL: 'RECORD_APPEAL',
	SCHEDULE_APPEAL_HEARING: 'SCHEDULE_APPEAL_HEARING',
	RECORD_APPEAL_DECISION: 'RECORD_APPEAL_DECISION',
	// Violation Type actions
	CREATE_TYPE: 'CREATE_TYPE',
	UPDATE_TYPE: 'UPDATE_TYPE'
} as const;

export type ViolationAction = (typeof ViolationAction)[keyof typeof ViolationAction];

export interface ViolationWorkflowInput {
	action: ViolationAction;
	organizationId: string;
	userId: string;
	violationId?: string;
	typeId?: string; // For violation type operations
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
		// SEND_NOTICE fields
		noticeType?: string;
		subject?: string;
		body?: string;
		deliveryMethod?: string;
		recipientName?: string;
		recipientAddress?: string;
		recipientEmail?: string;
		curePeriodDays?: number;
		noticeCount?: number;
		defaultCurePeriodDays?: number;
		// ESCALATE fields
		escalationReason?: string;
		assignedTo?: string;
		// RECORD_HEARING_OUTCOME fields
		fineAssessed?: number;
		fineWaived?: number;
		appealDeadlineDays?: number;
		// RECORD_APPEAL fields
		createPlaceholderHearing?: boolean;
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
	const now = new Date();

	try {
		await orgTransaction(organizationId, async (tx) => {
			const violation = await tx.violation.findUnique({ where: { id: violationId } });
			if (!violation) throw new Error('Violation not found');

			const oldStatus = violation.status;

			// Build status-specific update data
			const updateData: Prisma.ViolationUncheckedUpdateInput = { status: newStatus };

			// Set status-specific fields
			if (newStatus === 'CURED') {
				updateData.curedDate = now;
				updateData.resolutionNotes = notes ?? violation.resolutionNotes;
			} else if (newStatus === 'CLOSED') {
				updateData.closedDate = now;
				updateData.closedBy = userId;
				updateData.resolutionNotes = notes ?? violation.resolutionNotes;
			} else if (newStatus === 'DISMISSED') {
				updateData.closedDate = now;
				updateData.closedBy = userId;
				updateData.resolutionNotes = notes ?? violation.resolutionNotes;
			}

			await tx.violation.update({
				where: { id: violationId },
				data: updateData
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
		}, { userId, reason: `Updating violation status to ${newStatus}` });

		log.info('UPDATE_STATUS completed', { violationId, newStatus, userId });
		return violationId;
	} finally {
		await clearOrgContext(userId);
	}
}

async function deleteViolation(
	organizationId: string,
	userId: string,
	violationId: string,
	data: Record<string, unknown>
): Promise<string> {
	const reason = data.reason as string | undefined;
	const deletedAt = new Date();

	try {
		await orgTransaction(organizationId, async (tx) => {
			const violation = await tx.violation.findUnique({ where: { id: violationId } });
			if (!violation) throw new Error('Violation not found');

			await tx.violation.update({
				where: { id: violationId },
				data: {
					deletedAt,
					status: 'CLOSED',
					closedDate: deletedAt,
					closedBy: userId,
					resolutionNotes: reason ?? violation.resolutionNotes
				}
			});

			await tx.violationStatusHistory.create({
				data: {
					violationId,
					fromStatus: violation.status,
					toStatus: 'CLOSED',
					changedBy: userId,
					notes: reason ?? 'Violation deleted'
				}
			});
		}, { userId, reason: `Deleting violation: ${reason ?? 'No reason provided'}` });

		log.info('DELETE_VIOLATION completed', { violationId, userId });
		return violationId;
	} finally {
		await clearOrgContext(userId);
	}
}

async function sendNotice(
	organizationId: string,
	userId: string,
	violationId: string,
	data: Record<string, unknown>
): Promise<string> {
	const noticeType = data.noticeType as string;
	const subject = data.subject as string;
	const body = data.body as string;
	const deliveryMethod = data.deliveryMethod as string;
	const recipientName = data.recipientName as string;
	const recipientAddress = data.recipientAddress as string | undefined;
	const recipientEmail = data.recipientEmail as string | undefined;
	const curePeriodDays = data.curePeriodDays as number;
	const noticeCount = data.noticeCount as number;
	const defaultCurePeriodDays = data.defaultCurePeriodDays as number;

	const now = new Date();
	const effectiveCurePeriodDays = curePeriodDays ?? defaultCurePeriodDays ?? 0;
	const curePeriodEnds = effectiveCurePeriodDays > 0
		? new Date(now.getTime() + effectiveCurePeriodDays * 24 * 60 * 60 * 1000)
		: null;
	const targetStatus = effectiveCurePeriodDays > 0 ? 'CURE_PERIOD' : 'NOTICE_SENT';

	try {
		const noticeId = await orgTransaction(organizationId, async (tx) => {
			const violation = await tx.violation.findUnique({ where: { id: violationId } });
			if (!violation) throw new Error('Violation not found');

			const notice = await tx.violationNotice.create({
				data: {
					violationId,
					noticeType: noticeType as any,
					noticeNumber: noticeCount + 1,
					subject,
					body,
					deliveryMethod: deliveryMethod as any,
					recipientName,
					recipientAddress,
					recipientEmail,
					sentDate: now,
					curePeriodDays: effectiveCurePeriodDays,
					curePeriodEnds,
					sentBy: userId
				}
			});

			await tx.violation.update({
				where: { id: violationId },
				data: {
					noticeCount: { increment: 1 },
					lastNoticeDate: now,
					lastNoticeType: noticeType as any,
					curePeriodEnds,
					status: targetStatus
				}
			});

			if (violation.status !== targetStatus) {
				await tx.violationStatusHistory.create({
					data: {
						violationId,
						fromStatus: violation.status,
						toStatus: targetStatus,
						changedBy: userId,
						notes: `${noticeType} sent`
					}
				});
			}

			return notice.id;
		}, { userId, reason: `Sending ${noticeType} notice for violation` });

		log.info('SEND_NOTICE completed', { noticeId, violationId, userId });
		return noticeId;
	} finally {
		await clearOrgContext(userId);
	}
}

async function escalateViolation(
	organizationId: string,
	userId: string,
	violationId: string,
	data: Record<string, unknown>
): Promise<string> {
	const escalationReason = data.escalationReason as string | undefined;
	const assignedTo = data.assignedTo as string | undefined;

	try {
		await orgTransaction(organizationId, async (tx) => {
			const violation = await tx.violation.findUnique({ where: { id: violationId } });
			if (!violation) throw new Error('Violation not found');

			await tx.violation.update({
				where: { id: violationId },
				data: {
					status: 'ESCALATED'
				}
			});

			await tx.violationStatusHistory.create({
				data: {
					violationId,
					fromStatus: violation.status,
					toStatus: 'ESCALATED',
					changedBy: userId,
					notes: escalationReason ?? 'Violation escalated'
				}
			});
		}, { userId, reason: `Escalating violation: ${escalationReason ?? 'No reason provided'}` });

		log.info('ESCALATE completed', { violationId, userId });
		return violationId;
	} finally {
		await clearOrgContext(userId);
	}
}

async function dismissViolation(
	organizationId: string,
	userId: string,
	violationId: string,
	data: Record<string, unknown>
): Promise<string> {
	const reason = data.reason as string | undefined;
	const now = new Date();

	try {
		await orgTransaction(organizationId, async (tx) => {
			const violation = await tx.violation.findUnique({ where: { id: violationId } });
			if (!violation) throw new Error('Violation not found');

			await tx.violation.update({
				where: { id: violationId },
				data: {
					status: 'DISMISSED',
					closedDate: now,
					closedBy: userId,
					resolutionNotes: reason ?? violation.resolutionNotes
				}
			});

			await tx.violationStatusHistory.create({
				data: {
					violationId,
					fromStatus: violation.status,
					toStatus: 'DISMISSED',
					changedBy: userId,
					notes: reason ?? 'Violation dismissed'
				}
			});
		}, { userId, reason: `Dismissing violation: ${reason ?? 'No reason provided'}` });

		log.info('DISMISS completed', { violationId, userId });
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
	const fineAssessed = data.fineAssessed as number | undefined;
	const fineWaived = data.fineWaived as number | undefined;
	const appealDeadlineDays = data.appealDeadlineDays as number | undefined;

	const now = new Date();
	const appealDeadline = appealDeadlineDays
		? new Date(now.getTime() + appealDeadlineDays * 24 * 60 * 60 * 1000)
		: null;

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
					fineAssessed,
					fineWaived,
					appealDeadline,
					recordedBy: userId,
					recordedAt: now
				}
			});

			await tx.violation.update({
				where: { id: violationId },
				data: { status: newStatus }
			});

			await tx.violationStatusHistory.create({
				data: {
					violationId,
					fromStatus: 'HEARING_SCHEDULED',
					toStatus: newStatus,
					changedBy: userId,
					notes: `Hearing outcome: ${outcome}`
				}
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
	let hearingId = data.hearingId as string | undefined;
	const reason = data.reason as string;
	const filedBy = data.filedBy as string | undefined;
	const createPlaceholderHearing = data.createPlaceholderHearing as boolean | undefined;

	try {
		const appealId = await orgTransaction(organizationId, async (tx) => {
			// Create placeholder hearing if needed
			if (createPlaceholderHearing && !hearingId) {
				const hearing = await tx.violationHearing.create({
					data: {
						violationId,
						hearingDate: new Date(),
						outcome: 'PENDING',
						outcomeNotes: 'Appeal filed - hearing pending'
					}
				});
				hearingId = hearing.id;
			}

			if (!hearingId) {
				throw new Error('No hearing found and createPlaceholderHearing not set');
			}

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

// Violation Type step functions
async function createViolationType(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const violationType = await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.violationType.create({
				data: {
					organizationId,
					associationId: data.associationId as string,
					code: data.code as string,
					name: data.name as string,
					description: data.description as string | undefined,
					category: data.category as string,
					ccnrSection: data.ccnrSection as string | undefined,
					ruleReference: data.ruleReference as string | undefined,
					defaultSeverity: data.defaultSeverity as any,
					defaultCurePeriodDays: data.defaultCurePeriodDays as number | undefined,
					firstFineAmount: data.firstFineAmount as number | undefined,
					secondFineAmount: data.secondFineAmount as number | undefined,
					subsequentFineAmount: data.subsequentFineAmount as number | undefined,
					maxFineAmount: data.maxFineAmount as number | undefined
				}
			});
		},
		{ userId, reason: 'Create violation type' }
	);

	log.info('CREATE_TYPE completed', { typeId: violationType.id, code: violationType.code, userId });
	return violationType.id;
}

async function updateViolationType(
	organizationId: string,
	userId: string,
	typeId: string,
	data: Record<string, unknown>
): Promise<string> {
	const { id, associationId, code, ...updateData } = data;

	await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.violationType.update({
				where: { id: typeId },
				data: updateData
			});
		},
		{ userId, reason: 'Update violation type' }
	);

	log.info('UPDATE_TYPE completed', { typeId, userId });
	return typeId;
}

// Main workflow function
async function violationWorkflow(input: ViolationWorkflowInput): Promise<ViolationWorkflowResult> {
	try {
		let entityId: string | undefined;

		switch (input.action) {
			case 'UPDATE_VIOLATION':
				entityId = await DBOS.runStep(
					() => updateViolation(input.organizationId, input.userId, input.violationId!, input.data),
					{ name: 'updateViolation' }
				);
				break;

			case 'UPDATE_STATUS':
				entityId = await DBOS.runStep(
					() => updateStatus(input.organizationId, input.userId, input.violationId!, input.data),
					{ name: 'updateStatus' }
				);
				break;

			case 'DELETE_VIOLATION':
				entityId = await DBOS.runStep(
					() => deleteViolation(input.organizationId, input.userId, input.violationId!, input.data),
					{ name: 'deleteViolation' }
				);
				break;

			case 'SEND_NOTICE':
				entityId = await DBOS.runStep(
					() => sendNotice(input.organizationId, input.userId, input.violationId!, input.data),
					{ name: 'sendNotice' }
				);
				break;

			case 'ESCALATE':
				entityId = await DBOS.runStep(
					() => escalateViolation(input.organizationId, input.userId, input.violationId!, input.data),
					{ name: 'escalateViolation' }
				);
				break;

			case 'DISMISS':
				entityId = await DBOS.runStep(
					() => dismissViolation(input.organizationId, input.userId, input.violationId!, input.data),
					{ name: 'dismissViolation' }
				);
				break;

			case 'SCHEDULE_HEARING':
				entityId = await DBOS.runStep(
					() => scheduleHearing(input.organizationId, input.userId, input.violationId!, input.data),
					{ name: 'scheduleHearing' }
				);
				break;

			case 'RECORD_HEARING_OUTCOME':
				entityId = await DBOS.runStep(
					() => recordHearingOutcome(input.organizationId, input.userId, input.violationId!, input.data),
					{ name: 'recordHearingOutcome' }
				);
				break;

			case 'RECORD_APPEAL':
				entityId = await DBOS.runStep(
					() => recordAppeal(input.organizationId, input.userId, input.violationId!, input.data),
					{ name: 'recordAppeal' }
				);
				break;

			case 'SCHEDULE_APPEAL_HEARING':
				entityId = await DBOS.runStep(
					() => scheduleAppealHearing(input.organizationId, input.userId, input.violationId!, input.data),
					{ name: 'scheduleAppealHearing' }
				);
				break;

			case 'RECORD_APPEAL_DECISION':
				entityId = await DBOS.runStep(
					() => recordAppealDecision(input.organizationId, input.userId, input.violationId!, input.data),
					{ name: 'recordAppealDecision' }
				);
				break;

			case 'CREATE_TYPE':
				entityId = await DBOS.runStep(
					() => createViolationType(input.organizationId, input.userId, input.data),
					{ name: 'createViolationType' }
				);
				break;

			case 'UPDATE_TYPE':
				entityId = await DBOS.runStep(
					() => updateViolationType(input.organizationId, input.userId, input.typeId!, input.data),
					{ name: 'updateViolationType' }
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
	idempotencyKey: string
): Promise<ViolationWorkflowResult> {
	const workflowId = idempotencyKey || `violation-${input.action}-${input.violationId}-${Date.now()}`;
	const handle = await DBOS.startWorkflow(violationWorkflow_v1, { workflowID: idempotencyKey})(input);
	return handle.getResult();
}
