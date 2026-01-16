/**
 * ARC Request Workflow (v1)
 *
 * DBOS durable workflow for managing ARC request operations.
 * Handles: requestInfo, submitInfo.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { orgTransaction, clearOrgContext } from '../db/rls.js';
import { ARCRequestStatus, type EntityWorkflowResult } from './schemas.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger } from './workflowLogger.js';
import { Prisma } from '../../../../generated/prisma/client.js';

const log = createWorkflowLogger('ARCRequestWorkflow');

// Action types for the unified workflow
export const ARCRequestAction = {
	CREATE_REQUEST: 'CREATE_REQUEST',
	UPDATE_REQUEST: 'UPDATE_REQUEST',
	SUBMIT_REQUEST: 'SUBMIT_REQUEST',
	WITHDRAW_REQUEST: 'WITHDRAW_REQUEST',
	ADD_DOCUMENT: 'ADD_DOCUMENT',
	RECORD_DECISION: 'RECORD_DECISION',
	REQUEST_INFO: 'REQUEST_INFO',
	SUBMIT_INFO: 'SUBMIT_INFO'
} as const;

export type ARCRequestAction = (typeof ARCRequestAction)[keyof typeof ARCRequestAction];

export interface ARCRequestWorkflowInput {
	action: ARCRequestAction;
	organizationId: string;
	userId: string;
	requestId?: string; // Optional for CREATE_REQUEST
	data: Record<string, unknown>;
}

export interface ARCRequestWorkflowResult extends EntityWorkflowResult {
	previousStatus?: string;
	newStatus?: string;
}

const terminalStatuses: ARCRequestStatus[] = [
	ARCRequestStatus.APPROVED,
	ARCRequestStatus.DENIED,
	ARCRequestStatus.WITHDRAWN,
	ARCRequestStatus.CANCELLED,
	ARCRequestStatus.EXPIRED
];

// Helper to generate request number - requires transaction context
async function generateRequestNumber(tx: any, associationId: string): Promise<string> {
	const year = new Date().getFullYear();
	const count = await tx.aRCRequest.count({
		where: {
			associationId,
			createdAt: {
				gte: new Date(`${year}-01-01`),
				lt: new Date(`${year + 1}-01-01`)
			}
		}
	});
	return `ARC-${year}-${String(count + 1).padStart(4, '0')}`;
}

// Step functions for each operation
async function createRequest(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<{ entityId: string; newStatus: string }> {
	const associationId = data.associationId as string;

	try {
		const created = await orgTransaction(organizationId, async (tx) => {
			const requestNumber = await generateRequestNumber(tx, associationId);
			return tx.aRCRequest.create({
				data: {
					organizationId,
					associationId,
					committeeId: data.committeeId as string | undefined,
					unitId: data.unitId as string | undefined,
					requesterPartyId: data.requesterPartyId as string,
					title: data.title as string,
					description: (data.description as string) || '',
					category: data.category as any,
					estimatedCost: data.estimatedCost as number | undefined,
					proposedStartDate: data.proposedStartDate ? new Date(data.proposedStartDate as string) : undefined,
					proposedEndDate: data.proposedEndDate ? new Date(data.proposedEndDate as string) : undefined,
					requestNumber,
					status: 'DRAFT'
				}
			});
		}, { userId, reason: 'Creating ARC request via workflow' });

		log.info('CREATE_REQUEST completed', { requestId: created.id, userId });
		return { entityId: created.id, newStatus: created.status };
	} finally {
		await clearOrgContext(userId);
	}
}

async function updateRequest(
	organizationId: string,
	userId: string,
	requestId: string,
	data: Record<string, unknown>
): Promise<{ entityId: string; previousStatus: string; newStatus: string }> {
	try {
		const result = await orgTransaction(organizationId, async (tx) => {
			const request = await tx.aRCRequest.findFirst({
				where: { id: requestId },
				include: { association: true }
			});

			if (!request || request.association.organizationId !== organizationId) {
				throw new Error('ARC Request not found');
			}

			if (terminalStatuses.includes(request.status as ARCRequestStatus)) {
				throw new Error('Cannot update a finalized ARC request');
			}

			const previousStatus = request.status;

			const updated = await tx.aRCRequest.update({
				where: { id: requestId },
				data: {
					title: data.title as string | undefined,
					description: data.description as string | undefined,
					category: data.category as any | undefined,
					estimatedCost: data.estimatedCost as number | undefined,
					proposedStartDate: data.proposedStartDate ? new Date(data.proposedStartDate as string) : undefined,
					proposedEndDate: data.proposedEndDate ? new Date(data.proposedEndDate as string) : undefined
				}
			});

			return { entityId: updated.id, previousStatus, newStatus: updated.status };
		}, { userId, reason: 'Updating ARC request via workflow' });

		log.info('UPDATE_REQUEST completed', { requestId, userId });
		return result;
	} finally {
		await clearOrgContext(userId);
	}
}

async function submitRequest(
	organizationId: string,
	userId: string,
	requestId: string,
	_data: Record<string, unknown>
): Promise<{ entityId: string; previousStatus: string; newStatus: string }> {
	try {
		const result = await orgTransaction(organizationId, async (tx) => {
			const request = await tx.aRCRequest.findFirst({
				where: { id: requestId },
				include: { association: true }
			});

			if (!request || request.association.organizationId !== organizationId) {
				throw new Error('ARC Request not found');
			}

			if (request.status !== 'DRAFT') {
				throw new Error('Only draft requests can be submitted');
			}

			const previousStatus = request.status;

			const updated = await tx.aRCRequest.update({
				where: { id: requestId },
				data: {
					status: 'SUBMITTED',
					submittedAt: new Date()
				}
			});

			return { entityId: updated.id, previousStatus, newStatus: updated.status };
		}, { userId, reason: 'Submitting ARC request via workflow' });

		log.info('SUBMIT_REQUEST completed', { requestId, userId });
		return result;
	} finally {
		await clearOrgContext(userId);
	}
}

async function withdrawRequest(
	organizationId: string,
	userId: string,
	requestId: string,
	_data: Record<string, unknown>
): Promise<{ entityId: string; previousStatus: string; newStatus: string }> {
	try {
		const result = await orgTransaction(organizationId, async (tx) => {
			const request = await tx.aRCRequest.findFirst({
				where: { id: requestId },
				include: { association: true }
			});

			if (!request || request.association.organizationId !== organizationId) {
				throw new Error('ARC Request not found');
			}

			if (terminalStatuses.includes(request.status as ARCRequestStatus)) {
				throw new Error('Cannot withdraw a finalized ARC request');
			}

			const previousStatus = request.status;

			const updated = await tx.aRCRequest.update({
				where: { id: requestId },
				data: {
					status: 'WITHDRAWN',
					withdrawnAt: new Date()
				}
			});

			return { entityId: updated.id, previousStatus, newStatus: updated.status };
		}, { userId, reason: 'Withdrawing ARC request via workflow' });

		log.info('WITHDRAW_REQUEST completed', { requestId, userId });
		return result;
	} finally {
		await clearOrgContext(userId);
	}
}

async function addDocument(
	organizationId: string,
	userId: string,
	requestId: string,
	data: Record<string, unknown>
): Promise<{ entityId: string }> {
	try {
		const document = await orgTransaction(organizationId, async (tx) => {
			const request = await tx.aRCRequest.findUniqueOrThrow({
				where: { id: requestId },
				select: { associationId: true }
			});

			return tx.document.create({
				data: {
					organizationId,
					associationId: request.associationId,
					title: data.fileName as string,
					fileName: data.fileName as string,
					fileUrl: data.fileUrl as string,
					fileSize: (data.fileSize as number) || 0,
					mimeType: (data.mimeType as string) || 'application/octet-stream',
					description: (data.description as string) || undefined,
					category: 'ARC_ATTACHMENT',
					visibility: 'PRIVATE',
					status: 'ACTIVE',
					uploadedBy: userId,
					storagePath: data.fileUrl as string,
					latitude: data.gpsLatitude ? new Prisma.Decimal(data.gpsLatitude as number) : undefined,
					longitude: data.gpsLongitude ? new Prisma.Decimal(data.gpsLongitude as number) : undefined,
					capturedAt: data.capturedAt ? new Date(data.capturedAt as string) : undefined,
					contextBindings: {
						create: {
							contextType: 'ARC_REQUEST',
							contextId: requestId,
							isPrimary: true,
							createdBy: userId
						}
					}
				}
			});
		}, { userId, reason: 'Adding document to ARC request via workflow' });

		log.info('ADD_DOCUMENT completed', { documentId: document.id, requestId, userId });

		// Record activity event
		await recordWorkflowEvent({
			organizationId,
			entityType: 'ARC_REQUEST',
			entityId: requestId,
			action: 'UPDATE',
			eventCategory: 'EXECUTION',
			summary: `Document added: ${data.fileName}`,
			workflowId: 'arcRequestWorkflow_v1',
			workflowStep: 'ADD_DOCUMENT',
			performedById: userId,
			performedByType: 'HUMAN',
			arcRequestId: requestId,
			newState: { documentId: document.id, fileName: data.fileName }
		});

		return { entityId: document.id };
	} finally {
		await clearOrgContext(userId);
	}
}

async function recordDecision(
	organizationId: string,
	userId: string,
	requestId: string,
	data: Record<string, unknown>
): Promise<{ entityId: string; previousStatus: string; newStatus: string }> {
	try {
		const result = await orgTransaction(organizationId, async (tx) => {
			const request = await tx.aRCRequest.findFirst({
				where: { id: requestId },
				include: { association: true }
			});

			if (!request || request.association.organizationId !== organizationId) {
				throw new Error('ARC Request not found');
			}

			const reviewableStatuses: ARCRequestStatus[] = ['SUBMITTED', 'UNDER_REVIEW'];
			if (!reviewableStatuses.includes(request.status as ARCRequestStatus)) {
				throw new Error('Request is not in a reviewable status');
			}

			const previousStatus = request.status;
			const action = data.action as string;
			const newStatus = action === 'APPROVE' ? 'APPROVED' : action === 'DENY' ? 'DENIED' : 'UNDER_REVIEW';

			// Create review record
			await tx.aRCReview.create({
				data: {
					requestId,
					reviewerId: data.reviewerId as string,
					action: action as any,
					notes: (data.comments as string) || undefined,
					conditions: (data.conditions as string) || undefined
				}
			});

			// Update request status
			const updated = await tx.aRCRequest.update({
				where: { id: requestId },
				data: {
					status: newStatus as any,
					...(newStatus === 'APPROVED' || newStatus === 'DENIED' ? { decisionDate: new Date() } : {})
				}
			});

			return { entityId: updated.id, previousStatus, newStatus: updated.status, action };
		}, { userId, reason: 'Recording decision on ARC request via workflow' });

		log.info('RECORD_DECISION completed', { requestId, action: result.action, userId });
		return { entityId: result.entityId, previousStatus: result.previousStatus, newStatus: result.newStatus };
	} finally {
		await clearOrgContext(userId);
	}
}

async function requestInfo(
	organizationId: string,
	userId: string,
	requestId: string,
	_data: Record<string, unknown>
): Promise<{ entityId: string; previousStatus: string; newStatus: string }> {
	try {
		const result = await orgTransaction(organizationId, async (tx) => {
			const request = await tx.aRCRequest.findFirst({
				where: { id: requestId },
				include: { association: true }
			});

			if (!request || request.association.organizationId !== organizationId) {
				throw new Error('ARC Request not found');
			}

			if (terminalStatuses.includes(request.status as ARCRequestStatus)) {
				throw new Error('Cannot request info for a finalized ARC request');
			}

			const previousStatus = request.status;

			const updated = await tx.aRCRequest.update({
				where: { id: requestId },
				data: {
					status: 'CHANGES_REQUESTED'
				}
			});

			return { entityId: updated.id, previousStatus, newStatus: updated.status };
		}, { userId, reason: 'Requesting info on ARC request via workflow' });

		log.info('REQUEST_INFO completed', { requestId, userId });
		return result;
	} finally {
		await clearOrgContext(userId);
	}
}

async function submitInfo(
	organizationId: string,
	userId: string,
	requestId: string,
	_data: Record<string, unknown>
): Promise<{ entityId: string; previousStatus: string; newStatus: string }> {
	try {
		const result = await orgTransaction(organizationId, async (tx) => {
			const request = await tx.aRCRequest.findFirst({
				where: { id: requestId },
				include: { association: true }
			});

			if (!request || request.association.organizationId !== organizationId) {
				throw new Error('ARC Request not found');
			}

			if (request.status !== 'CHANGES_REQUESTED') {
				throw new Error('No information request pending for this ARC request');
			}

			const previousStatus = request.status;

			const updated = await tx.aRCRequest.update({
				where: { id: requestId },
				data: {
					status: 'SUBMITTED'
				}
			});

			return { entityId: updated.id, previousStatus, newStatus: updated.status };
		}, { userId, reason: 'Submitting info on ARC request via workflow' });

		log.info('SUBMIT_INFO completed', { requestId, userId });
		return result;
	} finally {
		await clearOrgContext(userId);
	}
}

// Main workflow function
async function arcRequestWorkflow(input: ARCRequestWorkflowInput): Promise<ARCRequestWorkflowResult> {
	try {
		let result: { entityId: string; previousStatus?: string; newStatus?: string };

		switch (input.action) {
			case 'CREATE_REQUEST':
				result = await DBOS.runStep(
					() => createRequest(input.organizationId, input.userId, input.data),
					{ name: 'createRequest' }
				);
				break;

			case 'UPDATE_REQUEST':
				result = await DBOS.runStep(
					() => updateRequest(input.organizationId, input.userId, input.requestId!, input.data),
					{ name: 'updateRequest' }
				);
				break;

			case 'SUBMIT_REQUEST':
				result = await DBOS.runStep(
					() => submitRequest(input.organizationId, input.userId, input.requestId!, input.data),
					{ name: 'submitRequest' }
				);
				break;

			case 'WITHDRAW_REQUEST':
				result = await DBOS.runStep(
					() => withdrawRequest(input.organizationId, input.userId, input.requestId!, input.data),
					{ name: 'withdrawRequest' }
				);
				break;

			case 'ADD_DOCUMENT':
				result = await DBOS.runStep(
					() => addDocument(input.organizationId, input.userId, input.requestId!, input.data),
					{ name: 'addDocument' }
				);
				break;

			case 'RECORD_DECISION':
				result = await DBOS.runStep(
					() => recordDecision(input.organizationId, input.userId, input.requestId!, input.data),
					{ name: 'recordDecision' }
				);
				break;

			case 'REQUEST_INFO':
				result = await DBOS.runStep(
					() => requestInfo(input.organizationId, input.userId, input.requestId!, input.data),
					{ name: 'requestInfo' }
				);
				break;

			case 'SUBMIT_INFO':
				result = await DBOS.runStep(
					() => submitInfo(input.organizationId, input.userId, input.requestId!, input.data),
					{ name: 'submitInfo' }
				);
				break;

			default:
				return { success: false, error: `Unknown action: ${input.action}` };
		}

		return {
			success: true,
			entityId: result.entityId,
			previousStatus: result.previousStatus,
			newStatus: result.newStatus
		};
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;
		log.error(`Error in ${input.action}`, { error: errorMessage, action: input.action });

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'ARC_REQUEST_WORKFLOW_ERROR'
		});

		return { success: false, error: errorMessage };
	}
}

export const arcRequestWorkflow_v1 = DBOS.registerWorkflow(arcRequestWorkflow);

export async function startARCRequestWorkflow(
	input: ARCRequestWorkflowInput,
	idempotencyKey: string
): Promise<ARCRequestWorkflowResult> {
	const workflowId = idempotencyKey || `arc-request-${input.action}-${input.requestId}-${Date.now()}`;
	const handle = await DBOS.startWorkflow(arcRequestWorkflow_v1, { workflowID: idempotencyKey})(input);
	return handle.getResult();
}
