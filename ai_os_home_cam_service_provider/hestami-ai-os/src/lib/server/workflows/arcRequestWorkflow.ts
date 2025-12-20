/**
 * ARC Request Workflow (v1)
 *
 * DBOS durable workflow for managing ARC request operations.
 * Handles: requestInfo, submitInfo.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import type { ARCRequestStatus } from '../../../../generated/prisma/client.js';

// Action types for the unified workflow
export type ARCRequestAction = 
	| 'CREATE_REQUEST'
	| 'UPDATE_REQUEST'
	| 'SUBMIT_REQUEST'
	| 'WITHDRAW_REQUEST'
	| 'ADD_DOCUMENT'
	| 'RECORD_DECISION'
	| 'REQUEST_INFO'
	| 'SUBMIT_INFO';

export interface ARCRequestWorkflowInput {
	action: ARCRequestAction;
	organizationId: string;
	userId: string;
	requestId?: string; // Optional for CREATE_REQUEST
	data: Record<string, unknown>;
}

export interface ARCRequestWorkflowResult {
	success: boolean;
	entityId?: string;
	previousStatus?: string;
	newStatus?: string;
	error?: string;
}

const terminalStatuses: ARCRequestStatus[] = ['APPROVED', 'DENIED', 'WITHDRAWN', 'CANCELLED', 'EXPIRED'];

// Helper to generate request number
async function generateRequestNumber(associationId: string): Promise<string> {
	const year = new Date().getFullYear();
	const count = await prisma.aRCRequest.count({
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
	const requestNumber = await generateRequestNumber(associationId);

	const created = await prisma.aRCRequest.create({
		data: {
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

	console.log(`[ARCRequestWorkflow] CREATE_REQUEST request:${created.id} by user ${userId}`);
	return { entityId: created.id, newStatus: created.status };
}

async function updateRequest(
	organizationId: string,
	userId: string,
	requestId: string,
	data: Record<string, unknown>
): Promise<{ entityId: string; previousStatus: string; newStatus: string }> {
	const request = await prisma.aRCRequest.findFirst({
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

	const updated = await prisma.aRCRequest.update({
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

	console.log(`[ARCRequestWorkflow] UPDATE_REQUEST request:${requestId} by user ${userId}`);
	return { entityId: updated.id, previousStatus, newStatus: updated.status };
}

async function submitRequest(
	organizationId: string,
	userId: string,
	requestId: string,
	data: Record<string, unknown>
): Promise<{ entityId: string; previousStatus: string; newStatus: string }> {
	const request = await prisma.aRCRequest.findFirst({
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

	const updated = await prisma.aRCRequest.update({
		where: { id: requestId },
		data: {
			status: 'SUBMITTED',
			submittedAt: new Date()
		}
	});

	console.log(`[ARCRequestWorkflow] SUBMIT_REQUEST request:${requestId} by user ${userId}`);
	return { entityId: updated.id, previousStatus, newStatus: updated.status };
}

async function withdrawRequest(
	organizationId: string,
	userId: string,
	requestId: string,
	data: Record<string, unknown>
): Promise<{ entityId: string; previousStatus: string; newStatus: string }> {
	const request = await prisma.aRCRequest.findFirst({
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

	const updated = await prisma.aRCRequest.update({
		where: { id: requestId },
		data: {
			status: 'WITHDRAWN',
			withdrawnAt: new Date()
		}
	});

	console.log(`[ARCRequestWorkflow] WITHDRAW_REQUEST request:${requestId} by user ${userId}`);
	return { entityId: updated.id, previousStatus, newStatus: updated.status };
}

async function addDocument(
	organizationId: string,
	userId: string,
	requestId: string,
	data: Record<string, unknown>
): Promise<{ entityId: string }> {
	const document = await prisma.aRCDocument.create({
		data: {
			requestId,
			documentType: data.documentType as any,
			fileName: data.fileName as string,
			description: (data.description as string) || undefined,
			fileUrl: data.fileUrl as string,
			fileSize: (data.fileSize as number) || undefined,
			mimeType: (data.mimeType as string) || undefined,
			uploadedBy: userId
		}
	});

	console.log(`[ARCRequestWorkflow] ADD_DOCUMENT document:${document.id} request:${requestId} by user ${userId}`);
	return { entityId: document.id };
}

async function recordDecision(
	organizationId: string,
	userId: string,
	requestId: string,
	data: Record<string, unknown>
): Promise<{ entityId: string; previousStatus: string; newStatus: string }> {
	const request = await prisma.aRCRequest.findFirst({
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
	await prisma.aRCReview.create({
		data: {
			requestId,
			reviewerId: data.reviewerId as string,
			action: action as any,
			notes: (data.comments as string) || undefined,
			conditions: (data.conditions as string) || undefined
		}
	});

	// Update request status
	const updated = await prisma.aRCRequest.update({
		where: { id: requestId },
		data: {
			status: newStatus as any,
			...(newStatus === 'APPROVED' || newStatus === 'DENIED' ? { decisionDate: new Date() } : {})
		}
	});

	console.log(`[ARCRequestWorkflow] RECORD_DECISION request:${requestId} action:${action} by user ${userId}`);
	return { entityId: updated.id, previousStatus, newStatus: updated.status };
}

async function requestInfo(
	organizationId: string,
	userId: string,
	requestId: string,
	data: Record<string, unknown>
): Promise<{ entityId: string; previousStatus: string; newStatus: string }> {
	const request = await prisma.aRCRequest.findFirst({
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

	const updated = await prisma.aRCRequest.update({
		where: { id: requestId },
		data: {
			status: 'CHANGES_REQUESTED'
		}
	});

	console.log(`[ARCRequestWorkflow] REQUEST_INFO request:${requestId} by user ${userId}`);
	return { entityId: updated.id, previousStatus, newStatus: updated.status };
}

async function submitInfo(
	organizationId: string,
	userId: string,
	requestId: string,
	data: Record<string, unknown>
): Promise<{ entityId: string; previousStatus: string; newStatus: string }> {
	const request = await prisma.aRCRequest.findFirst({
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

	const updated = await prisma.aRCRequest.update({
		where: { id: requestId },
		data: {
			status: 'SUBMITTED'
		}
	});

	console.log(`[ARCRequestWorkflow] SUBMIT_INFO request:${requestId} by user ${userId}`);
	return { entityId: updated.id, previousStatus, newStatus: updated.status };
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
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`[ARCRequestWorkflow] Error in ${input.action}:`, errorMessage);
		return { success: false, error: errorMessage };
	}
}

export const arcRequestWorkflow_v1 = DBOS.registerWorkflow(arcRequestWorkflow);

export async function startARCRequestWorkflow(
	input: ARCRequestWorkflowInput,
	idempotencyKey?: string
): Promise<ARCRequestWorkflowResult> {
	const workflowId = idempotencyKey || `arc-request-${input.action}-${input.requestId}-${Date.now()}`;
	const handle = await DBOS.startWorkflow(arcRequestWorkflow_v1, { workflowID: workflowId })(input);
	return handle.getResult();
}
