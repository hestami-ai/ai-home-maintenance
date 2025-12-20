/**
 * Case Lifecycle Workflow (v1)
 *
 * DBOS durable workflow for concierge case management.
 * Handles: case creation, status transitions, assignment, resolution, closeout.
 * Compatible with intent conversion.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import type { ConciergeCaseStatus, ConciergeCasePriority } from '../../../../generated/prisma/client.js';
import { recordWorkflowEvent, recordWorkflowLifecycleEvent } from '../api/middleware/activityEvent.js';

const WORKFLOW_STATUS_EVENT = 'case_lifecycle_status';
const WORKFLOW_ERROR_EVENT = 'case_lifecycle_error';

interface AvailabilitySlot {
	startTime: string;
	endTime: string;
	notes?: string;
}

interface CaseLifecycleWorkflowInput {
	action:
		| 'CREATE_CASE'
		| 'CONVERT_INTENT'
		| 'TRANSITION_STATUS'
		| 'ASSIGN_CONCIERGE'
		| 'RESOLVE_CASE'
		| 'CLOSE_CASE'
		| 'CANCEL_CASE';
	organizationId: string;
	userId: string;
	caseId?: string;
	intentId?: string;
	propertyId?: string;
	title?: string;
	description?: string;
	priority?: ConciergeCasePriority;
	targetStatus?: ConciergeCaseStatus;
	assigneeUserId?: string;
	resolutionSummary?: string;
	cancelReason?: string;
	statusChangeReason?: string;
	// Owner availability fields
	availabilityType?: 'FLEXIBLE' | 'SPECIFIC';
	availabilityNotes?: string;
	availabilitySlots?: AvailabilitySlot[];
}

interface CaseLifecycleWorkflowResult {
	success: boolean;
	action: string;
	timestamp: string;
	caseId?: string;
	caseNumber?: string;
	status?: string;
	error?: string;
}

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
	INTAKE: ['ASSESSMENT', 'CANCELLED'],
	ASSESSMENT: ['IN_PROGRESS', 'PENDING_EXTERNAL', 'PENDING_OWNER', 'ON_HOLD', 'CANCELLED'],
	IN_PROGRESS: ['PENDING_EXTERNAL', 'PENDING_OWNER', 'ON_HOLD', 'RESOLVED', 'CANCELLED'],
	PENDING_EXTERNAL: ['IN_PROGRESS', 'ON_HOLD', 'RESOLVED', 'CANCELLED'],
	PENDING_OWNER: ['IN_PROGRESS', 'ON_HOLD', 'RESOLVED', 'CANCELLED'],
	ON_HOLD: ['ASSESSMENT', 'IN_PROGRESS', 'PENDING_EXTERNAL', 'PENDING_OWNER', 'CANCELLED'],
	RESOLVED: ['CLOSED', 'IN_PROGRESS'],
	CLOSED: [],
	CANCELLED: []
};

async function generateCaseNumber(organizationId: string): Promise<string> {
	const year = new Date().getFullYear();
	const prefix = `CASE-${year}`;
	const count = await prisma.conciergeCase.count({
		where: { organizationId, caseNumber: { startsWith: prefix } }
	});
	return `${prefix}-${String(count + 1).padStart(5, '0')}`;
}

async function createCase(
	organizationId: string,
	propertyId: string,
	title: string,
	description: string,
	priority: ConciergeCasePriority,
	userId: string,
	originIntentId?: string,
	assignedConciergeUserId?: string,
	availabilityType?: 'FLEXIBLE' | 'SPECIFIC',
	availabilityNotes?: string,
	availabilitySlots?: AvailabilitySlot[]
): Promise<{ id: string; caseNumber: string; status: string }> {
	const caseNumber = await generateCaseNumber(organizationId);

	// Use transaction to ensure atomicity of case creation with availability slots
	const newCase = await prisma.$transaction(async (tx) => {
		const createdCase = await tx.conciergeCase.create({
			data: {
				organizationId,
				propertyId,
				caseNumber,
				title,
				description,
				priority,
				status: 'INTAKE',
				...(originIntentId && { originIntentId }),
				...(assignedConciergeUserId && { assignedConciergeUserId }),
				availabilityType: availabilityType ?? 'FLEXIBLE',
				availabilityNotes
			}
		});

		// Create availability slots if provided
		if (availabilitySlots && availabilitySlots.length > 0) {
			await tx.caseAvailabilitySlot.createMany({
				data: availabilitySlots.map((slot) => ({
					caseId: createdCase.id,
					startTime: new Date(slot.startTime),
					endTime: new Date(slot.endTime),
					notes: slot.notes
				}))
			});
		}

		// Log initial status
		await tx.caseStatusHistory.create({
			data: {
				caseId: createdCase.id,
				toStatus: 'INTAKE',
				reason: 'Case created',
				changedBy: userId
			}
		});

		// If created from an intent, update the intent
		if (originIntentId) {
			await tx.ownerIntent.update({
				where: { id: originIntentId },
				data: {
					status: 'CONVERTED_TO_CASE',
					convertedCaseId: createdCase.id,
					convertedAt: new Date()
				}
			});
		}

		return createdCase;
	});

	// Record activity event for case creation
	await recordWorkflowEvent({
		organizationId,
		entityType: 'CONCIERGE_CASE',
		entityId: newCase.id,
		action: 'CREATE',
		eventCategory: 'EXECUTION',
		summary: `Case created: ${title}`,
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'caseLifecycleWorkflow_v1',
		workflowStep: 'CREATE_CASE',
		workflowVersion: 'v1',
		caseId: newCase.id,
		propertyId,
		intentId: originIntentId,
		newState: { caseNumber: newCase.caseNumber, status: newCase.status, title }
	});

	return { id: newCase.id, caseNumber: newCase.caseNumber, status: newCase.status };
}

async function convertIntentToCase(
	intentId: string,
	userId: string
): Promise<{ id: string; caseNumber: string; status: string }> {
	const intent = await prisma.ownerIntent.findUnique({
		where: { id: intentId }
	});

	if (!intent) {
		throw new Error('Intent not found');
	}

	if (intent.status !== 'SUBMITTED' && intent.status !== 'ACKNOWLEDGED') {
		throw new Error(`Cannot convert intent in status ${intent.status}`);
	}

	const caseNumber = await generateCaseNumber(intent.organizationId);

	const newCase = await prisma.conciergeCase.create({
		data: {
			organizationId: intent.organizationId,
			propertyId: intent.propertyId,
			caseNumber,
			title: intent.title,
			description: intent.description,
			priority: intent.priority === 'URGENT' ? 'URGENT' : intent.priority === 'HIGH' ? 'HIGH' : 'NORMAL',
			status: 'INTAKE',
			originIntentId: intentId
		}
	});

	// Update intent
	await prisma.ownerIntent.update({
		where: { id: intentId },
		data: {
			status: 'CONVERTED_TO_CASE',
			convertedCaseId: newCase.id,
			convertedAt: new Date()
		}
	});

	// Log initial status
	await prisma.caseStatusHistory.create({
		data: {
			caseId: newCase.id,
			toStatus: 'INTAKE',
			reason: `Converted from intent ${intentId}`,
			changedBy: userId
		}
	});

	// Record activity event for intent conversion
	await recordWorkflowEvent({
		organizationId: intent.organizationId,
		entityType: 'CONCIERGE_CASE',
		entityId: newCase.id,
		action: 'CREATE',
		eventCategory: 'DECISION',
		summary: `Intent converted to case: ${intent.title}`,
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'caseLifecycleWorkflow_v1',
		workflowStep: 'CONVERT_INTENT',
		workflowVersion: 'v1',
		caseId: newCase.id,
		intentId,
		propertyId: intent.propertyId,
		newState: { caseNumber: newCase.caseNumber, status: newCase.status }
	});

	return { id: newCase.id, caseNumber: newCase.caseNumber, status: newCase.status };
}

async function transitionStatus(
	caseId: string,
	targetStatus: ConciergeCaseStatus,
	userId: string,
	reason?: string
): Promise<{ status: string }> {
	const caseRecord = await prisma.conciergeCase.findUnique({
		where: { id: caseId }
	});

	if (!caseRecord) {
		throw new Error('Case not found');
	}

	const validTransitions = VALID_STATUS_TRANSITIONS[caseRecord.status] || [];
	if (!validTransitions.includes(targetStatus)) {
		throw new Error(`Invalid transition from ${caseRecord.status} to ${targetStatus}`);
	}

	await prisma.conciergeCase.update({
		where: { id: caseId },
		data: { status: targetStatus }
	});

	await prisma.caseStatusHistory.create({
		data: {
			caseId,
			fromStatus: caseRecord.status,
			toStatus: targetStatus,
			reason,
			changedBy: userId
		}
	});

	// Record activity event for status transition
	await recordWorkflowEvent({
		organizationId: caseRecord.organizationId,
		entityType: 'CONCIERGE_CASE',
		entityId: caseId,
		action: 'STATUS_CHANGE',
		eventCategory: 'EXECUTION',
		summary: `Case status changed from ${caseRecord.status} to ${targetStatus}${reason ? `: ${reason}` : ''}`,
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'caseLifecycleWorkflow_v1',
		workflowStep: 'TRANSITION_STATUS',
		workflowVersion: 'v1',
		caseId,
		propertyId: caseRecord.propertyId,
		previousState: { status: caseRecord.status },
		newState: { status: targetStatus }
	});

	return { status: targetStatus };
}

async function assignConcierge(
	caseId: string,
	assigneeUserId: string,
	userId: string
): Promise<{ assignedTo: string }> {
	await prisma.conciergeCase.update({
		where: { id: caseId },
		data: { assignedConciergeUserId: assigneeUserId }
	});

	await prisma.caseNote.create({
		data: {
			caseId,
			content: `Case assigned to user ${assigneeUserId}`,
			createdBy: userId,
			isInternal: true
		}
	});

	// Record activity event for assignment
	const caseRecord = await prisma.conciergeCase.findUnique({ where: { id: caseId } });
	if (caseRecord) {
		await recordWorkflowEvent({
			organizationId: caseRecord.organizationId,
			entityType: 'CONCIERGE_CASE',
			entityId: caseId,
			action: 'ASSIGN',
			eventCategory: 'EXECUTION',
			summary: `Case assigned to concierge`,
			performedById: userId,
			performedByType: 'HUMAN',
			workflowId: 'caseLifecycleWorkflow_v1',
			workflowStep: 'ASSIGN_CONCIERGE',
			workflowVersion: 'v1',
			caseId,
			propertyId: caseRecord.propertyId,
			newState: { assignedConciergeUserId: assigneeUserId }
		});
	}

	return { assignedTo: assigneeUserId };
}

async function resolveCase(
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

	const validTransitions = VALID_STATUS_TRANSITIONS[caseRecord.status] || [];
	if (!validTransitions.includes('RESOLVED')) {
		throw new Error(`Cannot resolve case in status ${caseRecord.status}`);
	}

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

	// Record activity event for resolution
	await recordWorkflowEvent({
		organizationId: caseRecord.organizationId,
		entityType: 'CONCIERGE_CASE',
		entityId: caseId,
		action: 'COMPLETE',
		eventCategory: 'DECISION',
		summary: `Case resolved: ${resolutionSummary.substring(0, 100)}`,
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'caseLifecycleWorkflow_v1',
		workflowStep: 'RESOLVE_CASE',
		workflowVersion: 'v1',
		caseId,
		propertyId: caseRecord.propertyId,
		previousState: { status: caseRecord.status },
		newState: { status: 'RESOLVED', resolutionSummary }
	});

	return { status: 'RESOLVED' };
}

async function closeCase(caseId: string, userId: string): Promise<{ status: string }> {
	const caseRecord = await prisma.conciergeCase.findUnique({
		where: { id: caseId }
	});

	if (!caseRecord) {
		throw new Error('Case not found');
	}

	if (caseRecord.status !== 'RESOLVED') {
		throw new Error('Can only close resolved cases');
	}

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
			reason: 'Case closed',
			changedBy: userId
		}
	});

	// Record activity event for close
	await recordWorkflowEvent({
		organizationId: caseRecord.organizationId,
		entityType: 'CONCIERGE_CASE',
		entityId: caseId,
		action: 'CLOSE',
		eventCategory: 'EXECUTION',
		summary: `Case closed`,
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'caseLifecycleWorkflow_v1',
		workflowStep: 'CLOSE_CASE',
		workflowVersion: 'v1',
		caseId,
		propertyId: caseRecord.propertyId,
		previousState: { status: 'RESOLVED' },
		newState: { status: 'CLOSED' }
	});

	return { status: 'CLOSED' };
}

async function cancelCase(
	caseId: string,
	cancelReason: string,
	userId: string
): Promise<{ status: string }> {
	const caseRecord = await prisma.conciergeCase.findUnique({
		where: { id: caseId }
	});

	if (!caseRecord) {
		throw new Error('Case not found');
	}

	const validTransitions = VALID_STATUS_TRANSITIONS[caseRecord.status] || [];
	if (!validTransitions.includes('CANCELLED')) {
		throw new Error(`Cannot cancel case in status ${caseRecord.status}`);
	}

	await prisma.conciergeCase.update({
		where: { id: caseId },
		data: {
			status: 'CANCELLED',
			cancelReason,
			cancelledBy: userId,
			cancelledAt: new Date()
		}
	});

	await prisma.caseStatusHistory.create({
		data: {
			caseId,
			fromStatus: caseRecord.status,
			toStatus: 'CANCELLED',
			reason: cancelReason,
			changedBy: userId
		}
	});

	// Record activity event for cancellation
	await recordWorkflowEvent({
		organizationId: caseRecord.organizationId,
		entityType: 'CONCIERGE_CASE',
		entityId: caseId,
		action: 'CANCEL',
		eventCategory: 'EXECUTION',
		summary: `Case cancelled: ${cancelReason}`,
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'caseLifecycleWorkflow_v1',
		workflowStep: 'CANCEL_CASE',
		workflowVersion: 'v1',
		caseId,
		propertyId: caseRecord.propertyId,
		previousState: { status: caseRecord.status },
		newState: { status: 'CANCELLED', cancelReason }
	});

	return { status: 'CANCELLED' };
}

async function caseLifecycleWorkflow(input: CaseLifecycleWorkflowInput): Promise<CaseLifecycleWorkflowResult> {
	try {
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'started', action: input.action });

		switch (input.action) {
			case 'CREATE_CASE': {
				if (!input.propertyId || !input.title || !input.description) {
					throw new Error('Missing required fields for CREATE_CASE');
				}
				const result = await DBOS.runStep(
					() =>
						createCase(
							input.organizationId,
							input.propertyId!,
							input.title!,
							input.description!,
							input.priority || 'NORMAL',
							input.userId,
							input.intentId,
							input.assigneeUserId,
							input.availabilityType,
							input.availabilityNotes,
							input.availabilitySlots
						),
					{ name: 'createCase' }
				);
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'case_created', ...result });
				return {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					caseId: result.id,
					caseNumber: result.caseNumber,
					status: result.status
				};
			}

			case 'CONVERT_INTENT': {
				if (!input.intentId) {
					throw new Error('Missing intentId for CONVERT_INTENT');
				}
				const result = await DBOS.runStep(
					() => convertIntentToCase(input.intentId!, input.userId),
					{ name: 'convertIntentToCase' }
				);
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'intent_converted', ...result });
				return {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					caseId: result.id,
					caseNumber: result.caseNumber,
					status: result.status
				};
			}

			case 'TRANSITION_STATUS': {
				if (!input.caseId || !input.targetStatus) {
					throw new Error('Missing caseId or targetStatus for TRANSITION_STATUS');
				}
				const result = await DBOS.runStep(
					() =>
						transitionStatus(input.caseId!, input.targetStatus!, input.userId, input.statusChangeReason),
					{ name: 'transitionStatus' }
				);
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'status_transitioned', ...result });
				return {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					caseId: input.caseId,
					status: result.status
				};
			}

			case 'ASSIGN_CONCIERGE': {
				if (!input.caseId || !input.assigneeUserId) {
					throw new Error('Missing caseId or assigneeUserId for ASSIGN_CONCIERGE');
				}
				await DBOS.runStep(
					() => assignConcierge(input.caseId!, input.assigneeUserId!, input.userId),
					{ name: 'assignConcierge' }
				);
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'concierge_assigned' });
				return {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					caseId: input.caseId
				};
			}

			case 'RESOLVE_CASE': {
				if (!input.caseId || !input.resolutionSummary) {
					throw new Error('Missing caseId or resolutionSummary for RESOLVE_CASE');
				}
				const result = await DBOS.runStep(
					() => resolveCase(input.caseId!, input.resolutionSummary!, input.userId),
					{ name: 'resolveCase' }
				);
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'case_resolved', ...result });
				return {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					caseId: input.caseId,
					status: result.status
				};
			}

			case 'CLOSE_CASE': {
				if (!input.caseId) {
					throw new Error('Missing caseId for CLOSE_CASE');
				}
				const result = await DBOS.runStep(() => closeCase(input.caseId!, input.userId), {
					name: 'closeCase'
				});
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'case_closed', ...result });
				return {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					caseId: input.caseId,
					status: result.status
				};
			}

			case 'CANCEL_CASE': {
				if (!input.caseId || !input.cancelReason) {
					throw new Error('Missing caseId or cancelReason for CANCEL_CASE');
				}
				const result = await DBOS.runStep(
					() => cancelCase(input.caseId!, input.cancelReason!, input.userId),
					{ name: 'cancelCase' }
				);
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'case_cancelled', ...result });
				return {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					caseId: input.caseId,
					status: result.status
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
		const errorMessage = error instanceof Error ? error.message : String(error);
		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });
		return {
			success: false,
			action: input.action,
			timestamp: new Date().toISOString(),
			error: errorMessage
		};
	}
}

export const caseLifecycleWorkflow_v1 = DBOS.registerWorkflow(caseLifecycleWorkflow);

export async function startCaseLifecycleWorkflow(
	input: CaseLifecycleWorkflowInput,
	workflowId?: string
): Promise<{ workflowId: string }> {
	const id =
		workflowId || `case-${input.action.toLowerCase()}-${input.caseId || input.intentId || 'new'}-${Date.now()}`;
	await DBOS.startWorkflow(caseLifecycleWorkflow_v1, { workflowID: id })(input);
	return { workflowId: id };
}

export async function getCaseLifecycleWorkflowStatus(
	workflowId: string
): Promise<{ step: string; [key: string]: unknown } | null> {
	const status = await DBOS.getEvent(workflowId, WORKFLOW_STATUS_EVENT, 0);
	return status as { step: string; [key: string]: unknown } | null;
}

export type { CaseLifecycleWorkflowInput, CaseLifecycleWorkflowResult };
