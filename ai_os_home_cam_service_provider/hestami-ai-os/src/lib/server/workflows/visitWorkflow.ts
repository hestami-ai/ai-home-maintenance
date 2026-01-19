/**
 * Visit Workflow (v1)
 *
 * DBOS durable workflow for scheduled visit management operations.
 * Provides idempotency, durability, and trace correlation.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { orgTransaction } from '../db/rls.js';
import {
	ScheduledVisitStatus,
	ActivityEntityType,
	ActivityActionType,
	ActivityEventCategory,
	ActivityActorType
} from '../../../../generated/prisma/enums.js';

// Workflow error types for tracing
const WorkflowErrorType = {
	VISIT_WORKFLOW_ERROR: 'VISIT_WORKFLOW_ERROR'
} as const;

const WORKFLOW_STATUS_EVENT = 'visit_status';
const WORKFLOW_ERROR_EVENT = 'visit_error';

// Action types for visit operations
export const VisitActionValues = {
	CREATE_VISIT: 'CREATE_VISIT',
	ASSIGN_VISIT: 'ASSIGN_VISIT',
	CONFIRM_VISIT: 'CONFIRM_VISIT',
	START_VISIT: 'START_VISIT',
	COMPLETE_VISIT: 'COMPLETE_VISIT',
	CANCEL_VISIT: 'CANCEL_VISIT',
	RESCHEDULE_VISIT: 'RESCHEDULE_VISIT'
} as const;

export type VisitAction = (typeof VisitActionValues)[keyof typeof VisitActionValues];

interface VisitWorkflowInput {
	action: VisitAction;
	organizationId: string;
	userId: string;
	visitId?: string;
	data: Record<string, unknown>;
}

interface VisitWorkflowResult {
	success: boolean;
	action: VisitAction;
	entityId?: string;
	timestamp: string;
	error?: string;
}

async function createVisit(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<{ id: string }> {
	const visit = await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.scheduledVisit.create({
				data: {
					contractId: data.contractId as string,
					scheduleId: data.scheduleId as string | undefined,
					visitNumber: data.visitNumber as number,
					scheduledDate: new Date(data.scheduledDate as string),
					scheduledStart: data.scheduledStart ? new Date(data.scheduledStart as string) : undefined,
					scheduledEnd: data.scheduledEnd ? new Date(data.scheduledEnd as string) : undefined,
					technicianId: data.technicianId as string | undefined,
					status: ScheduledVisitStatus.SCHEDULED,
					serviceNotes: data.notes as string | undefined
				}
			});
		},
		{ userId, reason: 'Creating scheduled visit' }
	);

	await recordWorkflowEvent({
		organizationId,
		entityType: ActivityEntityType.JOB,
		entityId: visit.id,
		action: ActivityActionType.CREATE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: 'Scheduled visit created',
		performedById: userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'visitWorkflow_v1',
		workflowStep: VisitActionValues.CREATE_VISIT,
		workflowVersion: 'v1'
	});

	return { id: visit.id };
}

async function assignVisit(
	organizationId: string,
	userId: string,
	visitId: string,
	data: Record<string, unknown>
): Promise<{ id: string }> {
	const visit = await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.scheduledVisit.update({
				where: { id: visitId },
				data: {
					technicianId: data.technicianId as string,
					assignedAt: new Date()
				}
			});
		},
		{ userId, reason: 'Assigning visit to technician' }
	);

	await recordWorkflowEvent({
		organizationId,
		entityType: ActivityEntityType.JOB,
		entityId: visit.id,
		action: ActivityActionType.UPDATE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: 'Visit assigned to technician',
		performedById: userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'visitWorkflow_v1',
		workflowStep: VisitActionValues.ASSIGN_VISIT,
		workflowVersion: 'v1'
	});

	return { id: visit.id };
}

async function confirmVisit(
	organizationId: string,
	userId: string,
	visitId: string
): Promise<{ id: string }> {
	const visit = await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.scheduledVisit.update({
				where: { id: visitId },
				data: {
					status: ScheduledVisitStatus.CONFIRMED,
					confirmedAt: new Date()
				}
			});
		},
		{ userId, reason: 'Confirming visit' }
	);

	await recordWorkflowEvent({
		organizationId,
		entityType: ActivityEntityType.JOB,
		entityId: visit.id,
		action: ActivityActionType.UPDATE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: 'Visit confirmed',
		performedById: userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'visitWorkflow_v1',
		workflowStep: VisitActionValues.CONFIRM_VISIT,
		workflowVersion: 'v1'
	});

	return { id: visit.id };
}

async function startVisit(
	organizationId: string,
	userId: string,
	visitId: string
): Promise<{ id: string }> {
	const visit = await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.scheduledVisit.update({
				where: { id: visitId },
				data: {
					status: ScheduledVisitStatus.IN_PROGRESS,
					actualStart: new Date()
				}
			});
		},
		{ userId, reason: 'Starting visit' }
	);

	await recordWorkflowEvent({
		organizationId,
		entityType: ActivityEntityType.JOB,
		entityId: visit.id,
		action: ActivityActionType.UPDATE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: 'Visit started',
		performedById: userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'visitWorkflow_v1',
		workflowStep: VisitActionValues.START_VISIT,
		workflowVersion: 'v1'
	});

	return { id: visit.id };
}

async function completeVisit(
	organizationId: string,
	userId: string,
	visitId: string,
	data: Record<string, unknown>
): Promise<{ id: string }> {
	const visit = await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.scheduledVisit.update({
				where: { id: visitId },
				data: {
					status: ScheduledVisitStatus.COMPLETED,
					actualEnd: new Date(),
					completedAt: new Date(),
					completionNotes: data.completionNotes as string | undefined
				}
			});
		},
		{ userId, reason: 'Completing visit' }
	);

	await recordWorkflowEvent({
		organizationId,
		entityType: ActivityEntityType.JOB,
		entityId: visit.id,
		action: ActivityActionType.UPDATE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: 'Visit completed',
		performedById: userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'visitWorkflow_v1',
		workflowStep: VisitActionValues.COMPLETE_VISIT,
		workflowVersion: 'v1'
	});

	return { id: visit.id };
}

async function cancelVisit(
	organizationId: string,
	userId: string,
	visitId: string,
	_data: Record<string, unknown>
): Promise<{ id: string }> {
	const visit = await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.scheduledVisit.update({
				where: { id: visitId },
				data: {
					status: ScheduledVisitStatus.CANCELLED
				}
			});
		},
		{ userId, reason: 'Cancelling visit' }
	);

	await recordWorkflowEvent({
		organizationId,
		entityType: ActivityEntityType.JOB,
		entityId: visit.id,
		action: ActivityActionType.UPDATE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: 'Visit cancelled',
		performedById: userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'visitWorkflow_v1',
		workflowStep: VisitActionValues.CANCEL_VISIT,
		workflowVersion: 'v1'
	});

	return { id: visit.id };
}

async function rescheduleVisit(
	organizationId: string,
	userId: string,
	visitId: string,
	data: Record<string, unknown>
): Promise<{ id: string }> {
	// Cancel old visit and create new one in a single transaction
	const newVisit = await orgTransaction(
		organizationId,
		async (tx) => {
			await tx.scheduledVisit.update({
				where: { id: visitId },
				data: {
					status: ScheduledVisitStatus.RESCHEDULED
				}
			});

			return tx.scheduledVisit.create({
				data: {
					contractId: data.contractId as string,
					scheduleId: data.scheduleId as string | undefined,
					visitNumber: data.visitNumber as number,
					scheduledDate: new Date(data.newScheduledDate as string),
					scheduledStart: data.newScheduledStart ? new Date(data.newScheduledStart as string) : undefined,
					scheduledEnd: data.newScheduledEnd ? new Date(data.newScheduledEnd as string) : undefined,
					technicianId: data.technicianId as string | undefined,
					status: ScheduledVisitStatus.SCHEDULED,
					rescheduleReason: data.reason as string | undefined,
					rescheduledFrom: visitId
				}
			});
		},
		{ userId, reason: 'Rescheduling visit' }
	);

	await recordWorkflowEvent({
		organizationId,
		entityType: ActivityEntityType.JOB,
		entityId: newVisit.id,
		action: ActivityActionType.CREATE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: 'Visit rescheduled',
		performedById: userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'visitWorkflow_v1',
		workflowStep: VisitActionValues.RESCHEDULE_VISIT,
		workflowVersion: 'v1'
	});

	return { id: newVisit.id };
}

async function visitWorkflow(input: VisitWorkflowInput): Promise<VisitWorkflowResult> {
	try {
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'started', action: input.action });

		let entityId: string | undefined;

		switch (input.action) {
			case VisitActionValues.CREATE_VISIT: {
				const result = await DBOS.runStep(
					() => createVisit(input.organizationId, input.userId, input.data),
					{ name: 'createVisit' }
				);
				entityId = result.id;
				break;
			}
			case VisitActionValues.ASSIGN_VISIT: {
				if (!input.visitId) throw new Error('visitId required for ASSIGN_VISIT');
				const result = await DBOS.runStep(
					() => assignVisit(input.organizationId, input.userId, input.visitId!, input.data),
					{ name: 'assignVisit' }
				);
				entityId = result.id;
				break;
			}
			case VisitActionValues.CONFIRM_VISIT: {
				if (!input.visitId) throw new Error('visitId required for CONFIRM_VISIT');
				const result = await DBOS.runStep(
					() => confirmVisit(input.organizationId, input.userId, input.visitId!),
					{ name: 'confirmVisit' }
				);
				entityId = result.id;
				break;
			}
			case VisitActionValues.START_VISIT: {
				if (!input.visitId) throw new Error('visitId required for START_VISIT');
				const result = await DBOS.runStep(
					() => startVisit(input.organizationId, input.userId, input.visitId!),
					{ name: 'startVisit' }
				);
				entityId = result.id;
				break;
			}
			case VisitActionValues.COMPLETE_VISIT: {
				if (!input.visitId) throw new Error('visitId required for COMPLETE_VISIT');
				const result = await DBOS.runStep(
					() => completeVisit(input.organizationId, input.userId, input.visitId!, input.data),
					{ name: 'completeVisit' }
				);
				entityId = result.id;
				break;
			}
			case VisitActionValues.CANCEL_VISIT: {
				if (!input.visitId) throw new Error('visitId required for CANCEL_VISIT');
				const result = await DBOS.runStep(
					() => cancelVisit(input.organizationId, input.userId, input.visitId!, input.data),
					{ name: 'cancelVisit' }
				);
				entityId = result.id;
				break;
			}
			case VisitActionValues.RESCHEDULE_VISIT: {
				if (!input.visitId) throw new Error('visitId required for RESCHEDULE_VISIT');
				const result = await DBOS.runStep(
					() => rescheduleVisit(input.organizationId, input.userId, input.visitId!, input.data),
					{ name: 'rescheduleVisit' }
				);
				entityId = result.id;
				break;
			}
			default:
				throw new Error(`Unknown action: ${input.action}`);
		}

		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'completed', entityId });

		return {
			success: true,
			action: input.action,
			entityId,
			timestamp: new Date().toISOString()
		};
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;
		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: ActivityActionType.WORKFLOW_FAILED,
			errorType: WorkflowErrorType.VISIT_WORKFLOW_ERROR
		});

		return {
			success: false,
			action: input.action,
			timestamp: new Date().toISOString(),
			error: errorMessage
		};
	}
}

export const visitWorkflow_v1 = DBOS.registerWorkflow(visitWorkflow);

export async function startVisitWorkflow(
	input: VisitWorkflowInput,
	idempotencyKey: string
): Promise<VisitWorkflowResult> {
	const handle = await DBOS.startWorkflow(visitWorkflow_v1, {
		workflowID: idempotencyKey})(input);

	return handle.getResult();
}

export type { VisitWorkflowInput, VisitWorkflowResult };
