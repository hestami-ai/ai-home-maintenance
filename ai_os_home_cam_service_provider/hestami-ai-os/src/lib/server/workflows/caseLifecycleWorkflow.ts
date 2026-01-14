/**
 * Case Lifecycle Workflow (v1)
 *
 * DBOS durable workflow for concierge case management.
 * Handles: case creation, status transitions, assignment, resolution, closeout.
 * Compatible with intent conversion.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import { orgTransaction, clearOrgContext } from '../db/rls.js';
import {
	ConciergeCaseStatus,
	ConciergeCasePriority,
	type LifecycleWorkflowResult
} from './schemas.js';
import { recordWorkflowEvent, recordWorkflowLifecycleEvent } from '../api/middleware/activityEvent.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger, logWorkflowStart, logWorkflowEnd, logStepError } from './workflowLogger.js';

const WORKFLOW_STATUS_EVENT = 'case_lifecycle_status';
const WORKFLOW_ERROR_EVENT = 'case_lifecycle_error';

// Action types for case lifecycle operations
export const CaseLifecycleAction = {
	CREATE_CASE: 'CREATE_CASE',
	CONVERT_INTENT: 'CONVERT_INTENT',
	TRANSITION_STATUS: 'TRANSITION_STATUS',
	ASSIGN_CONCIERGE: 'ASSIGN_CONCIERGE',
	UNASSIGN_CONCIERGE: 'UNASSIGN_CONCIERGE',
	RESOLVE_CASE: 'RESOLVE_CASE',
	CLOSE_CASE: 'CLOSE_CASE',
	CANCEL_CASE: 'CANCEL_CASE',
	ADD_NOTE: 'ADD_NOTE',
	ADD_PARTICIPANT: 'ADD_PARTICIPANT',
	REMOVE_PARTICIPANT: 'REMOVE_PARTICIPANT',
	LINK_UNIT: 'LINK_UNIT',
	LINK_JOB: 'LINK_JOB',
	LINK_ARC: 'LINK_ARC',
	LINK_WORK_ORDER: 'LINK_WORK_ORDER',
	UNLINK_CROSS_DOMAIN: 'UNLINK_CROSS_DOMAIN',
	REQUEST_CLARIFICATION: 'REQUEST_CLARIFICATION',
	RESPOND_CLARIFICATION: 'RESPOND_CLARIFICATION'
} as const;

export type CaseLifecycleAction = (typeof CaseLifecycleAction)[keyof typeof CaseLifecycleAction];

interface AvailabilitySlot {
	startTime: string;
	endTime: string;
	notes?: string;
}

export interface CaseLifecycleWorkflowInput {
	action: CaseLifecycleAction;
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
	// Note fields
	noteContent?: string;
	noteType?: string;
	isInternal?: boolean;
	// Participant fields
	participantId?: string;
	partyId?: string;
	externalContactName?: string;
	externalContactEmail?: string;
	externalContactPhone?: string;
	participantRole?: string;
	participantNotes?: string;
	// Cross-domain linking fields
	unitId?: string;
	jobId?: string;
	arcRequestId?: string;
	workOrderId?: string;
	unlinkType?: 'unit' | 'job' | 'all';
	// Clarification fields
	clarificationQuestion?: string;
	clarificationResponse?: string;
}

export interface CaseLifecycleWorkflowResult extends LifecycleWorkflowResult {
	caseId?: string;
	caseNumber?: string;
	status?: string;
	// Note result fields
	noteId?: string;
	// Participant result fields
	participantId?: string;
	removedAt?: string;
	// Cross-domain linking result fields
	linkedUnitId?: string;
	linkedJobId?: string;
	linkedArcRequestId?: string;
	linkedWorkOrderId?: string;
	unlinked?: string[];
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

	try {
		// Use orgTransaction to set RLS context and ensure atomicity
		const newCase = await orgTransaction(organizationId, async (tx) => {
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
		}, { userId, reason: 'Creating case via workflow' });

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
	} finally {
		// CRITICAL: Always clear context to prevent leakage to next request
		await clearOrgContext(userId);
	}
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

	try {
		const newCase = await orgTransaction(intent.organizationId, async (tx) => {
			const createdCase = await tx.conciergeCase.create({
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
			await tx.ownerIntent.update({
				where: { id: intentId },
				data: {
					status: 'CONVERTED_TO_CASE',
					convertedCaseId: createdCase.id,
					convertedAt: new Date()
				}
			});

			// Log initial status
			await tx.caseStatusHistory.create({
				data: {
					caseId: createdCase.id,
					toStatus: 'INTAKE',
					reason: `Converted from intent ${intentId}`,
					changedBy: userId
				}
			});

			return createdCase;
		}, { userId, reason: 'Converting intent to case via workflow' });

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
	} finally {
		await clearOrgContext(userId);
	}
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

	try {
		await orgTransaction(caseRecord.organizationId, async (tx) => {
			await tx.conciergeCase.update({
				where: { id: caseId },
				data: { status: targetStatus }
			});

			await tx.caseStatusHistory.create({
				data: {
					caseId,
					fromStatus: caseRecord.status,
					toStatus: targetStatus,
					reason,
					changedBy: userId
				}
			});
		}, { userId, reason: 'Transitioning case status via workflow' });

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
	} finally {
		await clearOrgContext(userId);
	}
}

async function assignConcierge(
	caseId: string,
	assigneeUserId: string,
	userId: string
): Promise<{ assignedTo: string }> {
	// First get the case to know the org
	const caseRecord = await prisma.conciergeCase.findUnique({ where: { id: caseId } });
	if (!caseRecord) {
		throw new Error('Case not found');
	}

	try {
		await orgTransaction(caseRecord.organizationId, async (tx) => {
			await tx.conciergeCase.update({
				where: { id: caseId },
				data: { assignedConciergeUserId: assigneeUserId }
			});

			await tx.caseNote.create({
				data: {
					caseId,
					content: `Case assigned to user ${assigneeUserId}`,
					createdBy: userId,
					isInternal: true
				}
			});
		}, { userId, reason: 'Assigning concierge to case via workflow' });

		// Record activity event for assignment
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

		return { assignedTo: assigneeUserId };
	} finally {
		await clearOrgContext(userId);
	}
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

	try {
		await orgTransaction(caseRecord.organizationId, async (tx) => {
			await tx.conciergeCase.update({
				where: { id: caseId },
				data: {
					status: 'RESOLVED',
					resolutionSummary,
					resolvedBy: userId,
					resolvedAt: new Date()
				}
			});

			await tx.caseStatusHistory.create({
				data: {
					caseId,
					fromStatus: caseRecord.status,
					toStatus: 'RESOLVED',
					reason: resolutionSummary,
					changedBy: userId
				}
			});
		}, { userId, reason: 'Resolving case via workflow' });

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
	} finally {
		await clearOrgContext(userId);
	}
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

	try {
		await orgTransaction(caseRecord.organizationId, async (tx) => {
			await tx.conciergeCase.update({
				where: { id: caseId },
				data: {
					status: 'CLOSED',
					closedAt: new Date()
				}
			});

			await tx.caseStatusHistory.create({
				data: {
					caseId,
					fromStatus: 'RESOLVED',
					toStatus: 'CLOSED',
					reason: 'Case closed',
					changedBy: userId
				}
			});
		}, { userId, reason: 'Closing case via workflow' });

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
	} finally {
		await clearOrgContext(userId);
	}
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

	try {
		await orgTransaction(caseRecord.organizationId, async (tx) => {
			await tx.conciergeCase.update({
				where: { id: caseId },
				data: {
					status: 'CANCELLED',
					cancelReason,
					cancelledBy: userId,
					cancelledAt: new Date()
				}
			});

			await tx.caseStatusHistory.create({
				data: {
					caseId,
					fromStatus: caseRecord.status,
					toStatus: 'CANCELLED',
					reason: cancelReason,
					changedBy: userId
				}
			});
		}, { userId, reason: 'Cancelling case via workflow' });

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
	} finally {
		await clearOrgContext(userId);
	}
}

async function unassignConcierge(
	caseId: string,
	userId: string
): Promise<{ unassigned: boolean }> {
	const caseRecord = await prisma.conciergeCase.findUnique({ where: { id: caseId } });
	if (!caseRecord) {
		throw new Error('Case not found');
	}

	try {
		await orgTransaction(caseRecord.organizationId, async (tx) => {
			await tx.conciergeCase.update({
				where: { id: caseId },
				data: { assignedConciergeUserId: null }
			});
		}, { userId, reason: 'Unassigning concierge from case via workflow' });

		await recordWorkflowEvent({
			organizationId: caseRecord.organizationId,
			entityType: 'CONCIERGE_CASE',
			entityId: caseId,
			action: 'UNASSIGN',
			eventCategory: 'EXECUTION',
			summary: `Case unassigned`,
			performedById: userId,
			performedByType: 'HUMAN',
			workflowId: 'caseLifecycleWorkflow_v1',
			workflowStep: 'UNASSIGN_CONCIERGE',
			workflowVersion: 'v1',
			caseId,
			propertyId: caseRecord.propertyId,
			previousState: { assignedConciergeUserId: caseRecord.assignedConciergeUserId },
			newState: { assignedConciergeUserId: null }
		});

		return { unassigned: true };
	} finally {
		await clearOrgContext(userId);
	}
}

async function addNote(
	caseId: string,
	organizationId: string,
	userId: string,
	content: string,
	noteType: string,
	isInternal: boolean
): Promise<{ noteId: string }> {
	try {
		const note = await orgTransaction(organizationId, async (tx) => {
			return tx.caseNote.create({
				data: {
					caseId,
					content,
					noteType,
					isInternal,
					createdBy: userId
				}
			});
		}, { userId, reason: 'Adding note to case via workflow' });

		await recordWorkflowEvent({
			organizationId,
			entityType: 'CONCIERGE_CASE',
			entityId: caseId,
			action: 'ADD_NOTE',
			eventCategory: 'EXECUTION',
			summary: `Note added to case`,
			performedById: userId,
			performedByType: 'HUMAN',
			workflowId: 'caseLifecycleWorkflow_v1',
			workflowStep: 'ADD_NOTE',
			workflowVersion: 'v1',
			caseId,
			newState: { noteId: note.id, noteType }
		});

		return { noteId: note.id };
	} finally {
		await clearOrgContext(userId);
	}
}

async function addParticipant(
	caseId: string,
	organizationId: string,
	userId: string,
	data: {
		partyId?: string;
		externalContactName?: string;
		externalContactEmail?: string;
		externalContactPhone?: string;
		role: string;
		notes?: string;
	}
): Promise<{ participantId: string }> {
	try {
		const participant = await orgTransaction(organizationId, async (tx) => {
			return tx.caseParticipant.create({
				data: {
					caseId,
					partyId: data.partyId,
					externalContactName: data.externalContactName,
					externalContactEmail: data.externalContactEmail,
					externalContactPhone: data.externalContactPhone,
					role: data.role,
					notes: data.notes,
					addedBy: userId
				}
			});
		}, { userId, reason: 'Adding participant to case via workflow' });

		await recordWorkflowEvent({
			organizationId,
			entityType: 'CONCIERGE_CASE',
			entityId: caseId,
			action: 'ADD_PARTICIPANT',
			eventCategory: 'EXECUTION',
			summary: `Participant added to case`,
			performedById: userId,
			performedByType: 'HUMAN',
			workflowId: 'caseLifecycleWorkflow_v1',
			workflowStep: 'ADD_PARTICIPANT',
			workflowVersion: 'v1',
			caseId,
			newState: { participantId: participant.id, role: data.role }
		});

		return { participantId: participant.id };
	} finally {
		await clearOrgContext(userId);
	}
}

async function removeParticipant(
	participantId: string,
	organizationId: string,
	userId: string
): Promise<{ removedAt: string }> {
	const now = new Date();
	try {
		const participant = await orgTransaction(organizationId, async (tx) => {
			return tx.caseParticipant.update({
				where: { id: participantId },
				data: { removedAt: now }
			});
		}, { userId, reason: 'Removing participant from case via workflow' });

		await recordWorkflowEvent({
			organizationId,
			entityType: 'CONCIERGE_CASE',
			entityId: participant.caseId,
			action: 'REMOVE_PARTICIPANT',
			eventCategory: 'EXECUTION',
			summary: `Participant removed from case`,
			performedById: userId,
			performedByType: 'HUMAN',
			workflowId: 'caseLifecycleWorkflow_v1',
			workflowStep: 'REMOVE_PARTICIPANT',
			workflowVersion: 'v1',
			caseId: participant.caseId,
			newState: { participantId, removedAt: now.toISOString() }
		});

		return { removedAt: now.toISOString() };
	} finally {
		await clearOrgContext(userId);
	}
}

async function linkUnit(
	caseId: string,
	unitId: string,
	organizationId: string,
	userId: string
): Promise<{ linkedUnitId: string }> {
	try {
		await orgTransaction(organizationId, async (tx) => {
			await tx.conciergeCase.update({
				where: { id: caseId },
				data: { linkedUnitId: unitId }
			});
		}, { userId, reason: 'Linking unit to case via workflow' });

		await recordWorkflowEvent({
			organizationId,
			entityType: 'CONCIERGE_CASE',
			entityId: caseId,
			action: 'LINK',
			eventCategory: 'EXECUTION',
			summary: `Case linked to unit`,
			performedById: userId,
			performedByType: 'HUMAN',
			workflowId: 'caseLifecycleWorkflow_v1',
			workflowStep: 'LINK_UNIT',
			workflowVersion: 'v1',
			caseId,
			unitId,
			newState: { linkedUnitId: unitId }
		});

		return { linkedUnitId: unitId };
	} finally {
		await clearOrgContext(userId);
	}
}

async function linkJob(
	caseId: string,
	jobId: string,
	organizationId: string,
	userId: string
): Promise<{ linkedJobId: string }> {
	try {
		await orgTransaction(organizationId, async (tx) => {
			await tx.conciergeCase.update({
				where: { id: caseId },
				data: { linkedJobId: jobId }
			});
		}, { userId, reason: 'Linking job to case via workflow' });

		await recordWorkflowEvent({
			organizationId,
			entityType: 'CONCIERGE_CASE',
			entityId: caseId,
			action: 'LINK',
			eventCategory: 'EXECUTION',
			summary: `Case linked to job`,
			performedById: userId,
			performedByType: 'HUMAN',
			workflowId: 'caseLifecycleWorkflow_v1',
			workflowStep: 'LINK_JOB',
			workflowVersion: 'v1',
			caseId,
			newState: { linkedJobId: jobId }
		});

		return { linkedJobId: jobId };
	} finally {
		await clearOrgContext(userId);
	}
}

async function linkArc(
	caseId: string,
	arcRequestId: string,
	organizationId: string,
	userId: string
): Promise<{ linkedArcRequestId: string }> {
	try {
		await orgTransaction(organizationId, async (tx) => {
			await tx.conciergeCase.update({
				where: { id: caseId },
				data: { linkedArcRequestId: arcRequestId }
			});
		}, { userId, reason: 'Linking ARC request to case via workflow' });

		await recordWorkflowEvent({
			organizationId,
			entityType: 'CONCIERGE_CASE',
			entityId: caseId,
			action: 'LINK',
			eventCategory: 'EXECUTION',
			summary: `Case linked to ARC request`,
			performedById: userId,
			performedByType: 'HUMAN',
			workflowId: 'caseLifecycleWorkflow_v1',
			workflowStep: 'LINK_ARC',
			workflowVersion: 'v1',
			caseId,
			newState: { linkedArcRequestId: arcRequestId }
		});

		return { linkedArcRequestId: arcRequestId };
	} finally {
		await clearOrgContext(userId);
	}
}

async function linkWorkOrder(
	caseId: string,
	workOrderId: string,
	organizationId: string,
	userId: string
): Promise<{ linkedWorkOrderId: string }> {
	try {
		await orgTransaction(organizationId, async (tx) => {
			await tx.conciergeCase.update({
				where: { id: caseId },
				data: { linkedWorkOrderId: workOrderId }
			});
		}, { userId, reason: 'Linking work order to case via workflow' });

		await recordWorkflowEvent({
			organizationId,
			entityType: 'CONCIERGE_CASE',
			entityId: caseId,
			action: 'LINK',
			eventCategory: 'EXECUTION',
			summary: `Case linked to work order`,
			performedById: userId,
			performedByType: 'HUMAN',
			workflowId: 'caseLifecycleWorkflow_v1',
			workflowStep: 'LINK_WORK_ORDER',
			workflowVersion: 'v1',
			caseId,
			newState: { linkedWorkOrderId: workOrderId }
		});

		return { linkedWorkOrderId: workOrderId };
	} finally {
		await clearOrgContext(userId);
	}
}

async function unlinkCrossDomain(
	caseId: string,
	unlinkType: 'unit' | 'job' | 'all',
	organizationId: string,
	userId: string
): Promise<{ unlinked: string[] }> {
	const caseRecord = await prisma.conciergeCase.findUnique({ where: { id: caseId } });
	if (!caseRecord) {
		throw new Error('Case not found');
	}

	const unlinked: string[] = [];
	const updateData: { linkedUnitId?: null; linkedJobId?: null } = {};

	if (unlinkType === 'unit' || unlinkType === 'all') {
		if (caseRecord.linkedUnitId) {
			updateData.linkedUnitId = null;
			unlinked.push('unit');
		}
	}

	if (unlinkType === 'job' || unlinkType === 'all') {
		if (caseRecord.linkedJobId) {
			updateData.linkedJobId = null;
			unlinked.push('job');
		}
	}

	if (Object.keys(updateData).length === 0) {
		return { unlinked };
	}

	try {
		await orgTransaction(organizationId, async (tx) => {
			await tx.conciergeCase.update({
				where: { id: caseId },
				data: updateData
			});
		}, { userId, reason: 'Unlinking cross-domain entities from case via workflow' });

		await recordWorkflowEvent({
			organizationId,
			entityType: 'CONCIERGE_CASE',
			entityId: caseId,
			action: 'UNLINK',
			eventCategory: 'EXECUTION',
			summary: `Case unlinked from ${unlinked.join(', ')}`,
			performedById: userId,
			performedByType: 'HUMAN',
			workflowId: 'caseLifecycleWorkflow_v1',
			workflowStep: 'UNLINK_CROSS_DOMAIN',
			workflowVersion: 'v1',
			caseId,
			newState: { unlinked }
		});

		return { unlinked };
	} finally {
		await clearOrgContext(userId);
	}
}

async function requestClarification(
	caseId: string,
	question: string,
	organizationId: string,
	userId: string
): Promise<{ noteId: string; status: string }> {
	const caseRecord = await prisma.conciergeCase.findUnique({ where: { id: caseId } });
	if (!caseRecord) {
		throw new Error('Case not found');
	}

	try {
		const result = await orgTransaction(organizationId, async (tx) => {
			const note = await tx.caseNote.create({
				data: {
					caseId,
					content: question,
					noteType: 'CLARIFICATION_REQUEST',
					isInternal: false,
					createdBy: userId
				}
			});

			let updatedCase = caseRecord;
			if (caseRecord.status !== 'PENDING_OWNER') {
				const validTransitions = VALID_STATUS_TRANSITIONS[caseRecord.status] || [];
				if (validTransitions.includes('PENDING_OWNER')) {
					updatedCase = await tx.conciergeCase.update({
						where: { id: caseId },
						data: { status: 'PENDING_OWNER' }
					});

					await tx.caseStatusHistory.create({
						data: {
							caseId,
							fromStatus: caseRecord.status,
							toStatus: 'PENDING_OWNER',
							reason: 'Clarification requested from owner',
							changedBy: userId
						}
					});
				}
			}

			return { note, updatedCase };
		}, { userId, reason: 'Requesting clarification via workflow' });

		await recordWorkflowEvent({
			organizationId,
			entityType: 'CONCIERGE_CASE',
			entityId: caseId,
			action: 'REQUEST_INFO',
			eventCategory: 'EXECUTION',
			summary: `Clarification requested: ${question.substring(0, 100)}`,
			performedById: userId,
			performedByType: 'HUMAN',
			workflowId: 'caseLifecycleWorkflow_v1',
			workflowStep: 'REQUEST_CLARIFICATION',
			workflowVersion: 'v1',
			caseId,
			propertyId: caseRecord.propertyId,
			newState: { status: result.updatedCase.status, clarificationRequested: true }
		});

		return { noteId: result.note.id, status: result.updatedCase.status };
	} finally {
		await clearOrgContext(userId);
	}
}

async function respondClarification(
	caseId: string,
	response: string,
	organizationId: string,
	userId: string
): Promise<{ noteId: string }> {
	try {
		const note = await orgTransaction(organizationId, async (tx) => {
			return tx.caseNote.create({
				data: {
					caseId,
					content: response,
					noteType: 'CLARIFICATION_RESPONSE',
					isInternal: false,
					createdBy: userId
				}
			});
		}, { userId, reason: 'Responding to clarification via workflow' });

		const caseRecord = await prisma.conciergeCase.findUnique({ where: { id: caseId } });

		await recordWorkflowEvent({
			organizationId,
			entityType: 'CONCIERGE_CASE',
			entityId: caseId,
			action: 'RESPOND',
			eventCategory: 'EXECUTION',
			summary: `Owner responded to clarification: ${response.substring(0, 100)}`,
			performedById: userId,
			performedByType: 'HUMAN',
			workflowId: 'caseLifecycleWorkflow_v1',
			workflowStep: 'RESPOND_CLARIFICATION',
			workflowVersion: 'v1',
			caseId,
			propertyId: caseRecord?.propertyId
		});

		return { noteId: note.id };
	} finally {
		await clearOrgContext(userId);
	}
}

async function caseLifecycleWorkflow(input: CaseLifecycleWorkflowInput): Promise<CaseLifecycleWorkflowResult> {
	const workflowName = 'caseLifecycleWorkflow_v1';
	const log = createWorkflowLogger(workflowName, DBOS.workflowID, input.action);
	const startTime = logWorkflowStart(log, input.action, {
		organizationId: input.organizationId,
		userId: input.userId,
		caseId: input.caseId,
		intentId: input.intentId
	}, workflowName, DBOS.workflowID);

	try {
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'started', action: input.action });

		switch (input.action) {
			case 'CREATE_CASE': {
				if (!input.propertyId || !input.title || !input.description) {
					const error = new Error('Missing required fields for CREATE_CASE');
					logStepError(log, 'validation', error, { propertyId: input.propertyId, title: input.title });
					throw error;
				}
				log.debug('Step: createCase starting', { propertyId: input.propertyId, priority: input.priority });
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
				log.info('Step: createCase completed', { caseId: result.id, caseNumber: result.caseNumber });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'case_created', ...result });
				const successResult = {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					caseId: result.id,
					caseNumber: result.caseNumber,
					status: result.status
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'CONVERT_INTENT': {
				if (!input.intentId) {
					const error = new Error('Missing intentId for CONVERT_INTENT');
					logStepError(log, 'validation', error, { intentId: input.intentId });
					throw error;
				}
				log.debug('Step: convertIntentToCase starting', { intentId: input.intentId });
				const result = await DBOS.runStep(
					() => convertIntentToCase(input.intentId!, input.userId),
					{ name: 'convertIntentToCase' }
				);
				log.info('Step: convertIntentToCase completed', { caseId: result.id, caseNumber: result.caseNumber });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'intent_converted', ...result });
				const successResult = {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					caseId: result.id,
					caseNumber: result.caseNumber,
					status: result.status
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'TRANSITION_STATUS': {
				if (!input.caseId || !input.targetStatus) {
					const error = new Error('Missing caseId or targetStatus for TRANSITION_STATUS');
					logStepError(log, 'validation', error, { caseId: input.caseId, targetStatus: input.targetStatus });
					throw error;
				}
				log.debug('Step: transitionStatus starting', { caseId: input.caseId, targetStatus: input.targetStatus });
				const result = await DBOS.runStep(
					() =>
						transitionStatus(input.caseId!, input.targetStatus!, input.userId, input.statusChangeReason),
					{ name: 'transitionStatus' }
				);
				log.info('Step: transitionStatus completed', { caseId: input.caseId, newStatus: result.status });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'status_transitioned', ...result });
				const successResult = {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					caseId: input.caseId,
					status: result.status
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'ASSIGN_CONCIERGE': {
				if (!input.caseId || !input.assigneeUserId) {
					const error = new Error('Missing caseId or assigneeUserId for ASSIGN_CONCIERGE');
					logStepError(log, 'validation', error, { caseId: input.caseId, assigneeUserId: input.assigneeUserId });
					throw error;
				}
				log.debug('Step: assignConcierge starting', { caseId: input.caseId, assigneeUserId: input.assigneeUserId });
				await DBOS.runStep(
					() => assignConcierge(input.caseId!, input.assigneeUserId!, input.userId),
					{ name: 'assignConcierge' }
				);
				log.info('Step: assignConcierge completed', { caseId: input.caseId, assigneeUserId: input.assigneeUserId });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'concierge_assigned' });
				const successResult = {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					caseId: input.caseId
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'RESOLVE_CASE': {
				if (!input.caseId || !input.resolutionSummary) {
					const error = new Error('Missing caseId or resolutionSummary for RESOLVE_CASE');
					logStepError(log, 'validation', error, { caseId: input.caseId });
					throw error;
				}
				log.debug('Step: resolveCase starting', { caseId: input.caseId });
				const result = await DBOS.runStep(
					() => resolveCase(input.caseId!, input.resolutionSummary!, input.userId),
					{ name: 'resolveCase' }
				);
				log.info('Step: resolveCase completed', { caseId: input.caseId, status: result.status });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'case_resolved', ...result });
				const successResult = {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					caseId: input.caseId,
					status: result.status
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'CLOSE_CASE': {
				if (!input.caseId) {
					const error = new Error('Missing caseId for CLOSE_CASE');
					logStepError(log, 'validation', error, { caseId: input.caseId });
					throw error;
				}
				log.debug('Step: closeCase starting', { caseId: input.caseId });
				const result = await DBOS.runStep(() => closeCase(input.caseId!, input.userId), {
					name: 'closeCase'
				});
				log.info('Step: closeCase completed', { caseId: input.caseId, status: result.status });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'case_closed', ...result });
				const successResult = {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					caseId: input.caseId,
					status: result.status
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'CANCEL_CASE': {
				if (!input.caseId || !input.cancelReason) {
					const error = new Error('Missing caseId or cancelReason for CANCEL_CASE');
					logStepError(log, 'validation', error, { caseId: input.caseId });
					throw error;
				}
				log.debug('Step: cancelCase starting', { caseId: input.caseId, reason: input.cancelReason });
				const result = await DBOS.runStep(
					() => cancelCase(input.caseId!, input.cancelReason!, input.userId),
					{ name: 'cancelCase' }
				);
				log.info('Step: cancelCase completed', { caseId: input.caseId, status: result.status });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'case_cancelled', ...result });
				const successResult = {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					caseId: input.caseId,
					status: result.status
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'UNASSIGN_CONCIERGE': {
				if (!input.caseId) {
					const error = new Error('Missing caseId for UNASSIGN_CONCIERGE');
					logStepError(log, 'validation', error, { caseId: input.caseId });
					throw error;
				}
				log.debug('Step: unassignConcierge starting', { caseId: input.caseId });
				await DBOS.runStep(
					() => unassignConcierge(input.caseId!, input.userId),
					{ name: 'unassignConcierge' }
				);
				log.info('Step: unassignConcierge completed', { caseId: input.caseId });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'concierge_unassigned' });
				const successResult = {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					caseId: input.caseId
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'ADD_NOTE': {
				if (!input.caseId || !input.noteContent) {
					const error = new Error('Missing caseId or noteContent for ADD_NOTE');
					logStepError(log, 'validation', error, { caseId: input.caseId });
					throw error;
				}
				log.debug('Step: addNote starting', { caseId: input.caseId });
				const result = await DBOS.runStep(
					() => addNote(
						input.caseId!,
						input.organizationId,
						input.userId,
						input.noteContent!,
						input.noteType ?? 'GENERAL',
						input.isInternal ?? true
					),
					{ name: 'addNote' }
				);
				log.info('Step: addNote completed', { caseId: input.caseId, noteId: result.noteId });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'note_added', ...result });
				const successResult = {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					caseId: input.caseId,
					noteId: result.noteId
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'ADD_PARTICIPANT': {
				if (!input.caseId || !input.participantRole) {
					const error = new Error('Missing caseId or participantRole for ADD_PARTICIPANT');
					logStepError(log, 'validation', error, { caseId: input.caseId });
					throw error;
				}
				if (!input.partyId && !input.externalContactName) {
					const error = new Error('Must provide either partyId or externalContactName');
					logStepError(log, 'validation', error, { caseId: input.caseId });
					throw error;
				}
				log.debug('Step: addParticipant starting', { caseId: input.caseId });
				const result = await DBOS.runStep(
					() => addParticipant(
						input.caseId!,
						input.organizationId,
						input.userId,
						{
							partyId: input.partyId,
							externalContactName: input.externalContactName,
							externalContactEmail: input.externalContactEmail,
							externalContactPhone: input.externalContactPhone,
							role: input.participantRole!,
							notes: input.participantNotes
						}
					),
					{ name: 'addParticipant' }
				);
				log.info('Step: addParticipant completed', { caseId: input.caseId, participantId: result.participantId });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'participant_added', ...result });
				const successResult = {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					caseId: input.caseId,
					participantId: result.participantId
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'REMOVE_PARTICIPANT': {
				if (!input.participantId) {
					const error = new Error('Missing participantId for REMOVE_PARTICIPANT');
					logStepError(log, 'validation', error, { participantId: input.participantId });
					throw error;
				}
				log.debug('Step: removeParticipant starting', { participantId: input.participantId });
				const result = await DBOS.runStep(
					() => removeParticipant(input.participantId!, input.organizationId, input.userId),
					{ name: 'removeParticipant' }
				);
				log.info('Step: removeParticipant completed', { participantId: input.participantId });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'participant_removed', ...result });
				const successResult = {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					participantId: input.participantId,
					removedAt: result.removedAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'LINK_UNIT': {
				if (!input.caseId || !input.unitId) {
					const error = new Error('Missing caseId or unitId for LINK_UNIT');
					logStepError(log, 'validation', error, { caseId: input.caseId, unitId: input.unitId });
					throw error;
				}
				log.debug('Step: linkUnit starting', { caseId: input.caseId, unitId: input.unitId });
				const result = await DBOS.runStep(
					() => linkUnit(input.caseId!, input.unitId!, input.organizationId, input.userId),
					{ name: 'linkUnit' }
				);
				log.info('Step: linkUnit completed', { caseId: input.caseId, linkedUnitId: result.linkedUnitId });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'unit_linked', ...result });
				const successResult = {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					caseId: input.caseId,
					linkedUnitId: result.linkedUnitId
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'LINK_JOB': {
				if (!input.caseId || !input.jobId) {
					const error = new Error('Missing caseId or jobId for LINK_JOB');
					logStepError(log, 'validation', error, { caseId: input.caseId, jobId: input.jobId });
					throw error;
				}
				log.debug('Step: linkJob starting', { caseId: input.caseId, jobId: input.jobId });
				const result = await DBOS.runStep(
					() => linkJob(input.caseId!, input.jobId!, input.organizationId, input.userId),
					{ name: 'linkJob' }
				);
				log.info('Step: linkJob completed', { caseId: input.caseId, linkedJobId: result.linkedJobId });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'job_linked', ...result });
				const successResult = {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					caseId: input.caseId,
					linkedJobId: result.linkedJobId
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'LINK_ARC': {
				if (!input.caseId || !input.arcRequestId) {
					const error = new Error('Missing caseId or arcRequestId for LINK_ARC');
					logStepError(log, 'validation', error, { caseId: input.caseId, arcRequestId: input.arcRequestId });
					throw error;
				}
				log.debug('Step: linkArc starting', { caseId: input.caseId, arcRequestId: input.arcRequestId });
				const result = await DBOS.runStep(
					() => linkArc(input.caseId!, input.arcRequestId!, input.organizationId, input.userId),
					{ name: 'linkArc' }
				);
				log.info('Step: linkArc completed', { caseId: input.caseId, linkedArcRequestId: result.linkedArcRequestId });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'arc_linked', ...result });
				const successResult = {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					caseId: input.caseId,
					linkedArcRequestId: result.linkedArcRequestId
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'LINK_WORK_ORDER': {
				if (!input.caseId || !input.workOrderId) {
					const error = new Error('Missing caseId or workOrderId for LINK_WORK_ORDER');
					logStepError(log, 'validation', error, { caseId: input.caseId, workOrderId: input.workOrderId });
					throw error;
				}
				log.debug('Step: linkWorkOrder starting', { caseId: input.caseId, workOrderId: input.workOrderId });
				const result = await DBOS.runStep(
					() => linkWorkOrder(input.caseId!, input.workOrderId!, input.organizationId, input.userId),
					{ name: 'linkWorkOrder' }
				);
				log.info('Step: linkWorkOrder completed', { caseId: input.caseId, linkedWorkOrderId: result.linkedWorkOrderId });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'work_order_linked', ...result });
				const successResult = {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					caseId: input.caseId,
					linkedWorkOrderId: result.linkedWorkOrderId
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'UNLINK_CROSS_DOMAIN': {
				if (!input.caseId || !input.unlinkType) {
					const error = new Error('Missing caseId or unlinkType for UNLINK_CROSS_DOMAIN');
					logStepError(log, 'validation', error, { caseId: input.caseId, unlinkType: input.unlinkType });
					throw error;
				}
				log.debug('Step: unlinkCrossDomain starting', { caseId: input.caseId, unlinkType: input.unlinkType });
				const result = await DBOS.runStep(
					() => unlinkCrossDomain(input.caseId!, input.unlinkType!, input.organizationId, input.userId),
					{ name: 'unlinkCrossDomain' }
				);
				log.info('Step: unlinkCrossDomain completed', { caseId: input.caseId, unlinked: result.unlinked });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'cross_domain_unlinked', ...result });
				const successResult = {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					caseId: input.caseId,
					unlinked: result.unlinked
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'REQUEST_CLARIFICATION': {
				if (!input.caseId || !input.clarificationQuestion) {
					const error = new Error('Missing caseId or clarificationQuestion for REQUEST_CLARIFICATION');
					logStepError(log, 'validation', error, { caseId: input.caseId });
					throw error;
				}
				log.debug('Step: requestClarification starting', { caseId: input.caseId });
				const result = await DBOS.runStep(
					() => requestClarification(input.caseId!, input.clarificationQuestion!, input.organizationId, input.userId),
					{ name: 'requestClarification' }
				);
				log.info('Step: requestClarification completed', { caseId: input.caseId, noteId: result.noteId, status: result.status });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'clarification_requested', ...result });
				const successResult = {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					caseId: input.caseId,
					noteId: result.noteId,
					status: result.status
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'RESPOND_CLARIFICATION': {
				if (!input.caseId || !input.clarificationResponse) {
					const error = new Error('Missing caseId or clarificationResponse for RESPOND_CLARIFICATION');
					logStepError(log, 'validation', error, { caseId: input.caseId });
					throw error;
				}
				log.debug('Step: respondClarification starting', { caseId: input.caseId });
				const result = await DBOS.runStep(
					() => respondClarification(input.caseId!, input.clarificationResponse!, input.organizationId, input.userId),
					{ name: 'respondClarification' }
				);
				log.info('Step: respondClarification completed', { caseId: input.caseId, noteId: result.noteId });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'clarification_responded', ...result });
				const successResult = {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					caseId: input.caseId,
					noteId: result.noteId
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			default: {
				const errorResult = {
					success: false,
					action: input.action,
					timestamp: new Date().toISOString(),
					error: `Unknown action: ${input.action}`
				};
				log.warn('Unknown workflow action', { action: input.action });
				logWorkflowEnd(log, input.action, false, startTime, errorResult);
				return errorResult;
			}
		}
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;

		log.error('Workflow failed', {
			action: input.action,
			caseId: input.caseId,
			intentId: input.intentId,
			error: errorMessage,
			stack: errorObj.stack
		});

		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'CASE_LIFECYCLE_ERROR'
		});
		const errorResult = {
			success: false,
			action: input.action,
			timestamp: new Date().toISOString(),
			error: errorMessage
		};
		logWorkflowEnd(log, input.action, false, startTime, errorResult);
		return errorResult;
	}
}

export const caseLifecycleWorkflow_v1 = DBOS.registerWorkflow(caseLifecycleWorkflow);

export async function startCaseLifecycleWorkflow(
	input: CaseLifecycleWorkflowInput,
	workflowId?: string, idempotencyKey: string
): Promise<{ workflowId: string }> {
	const id =
		workflowId || `case-${input.action.toLowerCase()}-${input.caseId || input.intentId || 'new'}-${Date.now()}`;
	await DBOS.startWorkflow(caseLifecycleWorkflow_v1, { workflowID: idempotencyKey})(input);
	return { workflowId: id };
}

export async function getCaseLifecycleWorkflowStatus(
	workflowId: string
): Promise<{ step: string;[key: string]: unknown } | null> {
	const status = await DBOS.getEvent(workflowId, WORKFLOW_STATUS_EVENT, 0);
	return status as { step: string;[key: string]: unknown } | null;
}

