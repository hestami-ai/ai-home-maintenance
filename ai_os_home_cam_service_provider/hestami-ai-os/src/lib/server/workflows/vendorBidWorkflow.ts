/**
 * Vendor Bid Workflow (v1)
 *
 * DBOS durable workflow for vendor bid operations (Concierge cases).
 * Handles: create, update, accept, reject.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import { type EntityWorkflowResult } from './schemas.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger } from './workflowLogger.js';

const log = createWorkflowLogger('VendorBidWorkflow');

// Action types for the unified workflow
export const VendorBidWorkflowAction = {
	CREATE: 'CREATE',
	UPDATE: 'UPDATE',
	ACCEPT: 'ACCEPT',
	REJECT: 'REJECT'
} as const;

export type VendorBidWorkflowAction = (typeof VendorBidWorkflowAction)[keyof typeof VendorBidWorkflowAction];

export interface VendorBidWorkflowInput {
	action: VendorBidWorkflowAction;
	organizationId: string;
	userId: string;
	bidId?: string;
	data: {
		// CREATE fields
		vendorCandidateId?: string;
		caseId?: string;
		scopeVersion?: string | null;
		amount?: number | null;
		currency?: string;
		validUntil?: Date | null;
		laborCost?: number | null;
		materialsCost?: number | null;
		otherCosts?: number | null;
		estimatedStartDate?: Date | null;
		estimatedDuration?: number | null;
		estimatedEndDate?: Date | null;
		notes?: string | null;
		// REJECT fields
		reason?: string;
	};
}

export interface VendorBidWorkflowResult extends EntityWorkflowResult {
	bidId?: string;
	vendorCandidateId?: string;
}

// Step functions

async function createVendorBid(
	data: VendorBidWorkflowInput['data']
): Promise<{ bidId: string; vendorCandidateId: string }> {
	const bid = await prisma.vendorBid.create({
		data: {
			vendorCandidateId: data.vendorCandidateId!,
			caseId: data.caseId!,
			scopeVersion: data.scopeVersion,
			amount: data.amount,
			currency: data.currency || 'USD',
			validUntil: data.validUntil,
			laborCost: data.laborCost,
			materialsCost: data.materialsCost,
			otherCosts: data.otherCosts,
			estimatedStartDate: data.estimatedStartDate,
			estimatedDuration: data.estimatedDuration,
			estimatedEndDate: data.estimatedEndDate,
			notes: data.notes,
			status: 'PENDING',
			receivedAt: new Date()
		}
	});

	// Update vendor candidate status to QUOTED
	await prisma.vendorCandidate.update({
		where: { id: data.vendorCandidateId! },
		data: {
			status: 'QUOTED',
			statusChangedAt: new Date()
		}
	});

	log.info('CREATE completed', { bidId: bid.id, vendorCandidateId: data.vendorCandidateId });
	return { bidId: bid.id, vendorCandidateId: data.vendorCandidateId! };
}

async function updateVendorBid(
	bidId: string,
	data: VendorBidWorkflowInput['data']
): Promise<{ bidId: string }> {
	await prisma.vendorBid.update({
		where: { id: bidId },
		data: {
			...(data.scopeVersion !== undefined && { scopeVersion: data.scopeVersion }),
			...(data.amount !== undefined && { amount: data.amount }),
			...(data.validUntil !== undefined && { validUntil: data.validUntil }),
			...(data.laborCost !== undefined && { laborCost: data.laborCost }),
			...(data.materialsCost !== undefined && { materialsCost: data.materialsCost }),
			...(data.otherCosts !== undefined && { otherCosts: data.otherCosts }),
			...(data.estimatedStartDate !== undefined && { estimatedStartDate: data.estimatedStartDate }),
			...(data.estimatedDuration !== undefined && { estimatedDuration: data.estimatedDuration }),
			...(data.estimatedEndDate !== undefined && { estimatedEndDate: data.estimatedEndDate }),
			...(data.notes !== undefined && { notes: data.notes })
		}
	});

	log.info('UPDATE completed', { bidId });
	return { bidId };
}

async function acceptVendorBid(
	bidId: string,
	vendorCandidateId: string,
	caseId: string
): Promise<{ bidId: string }> {
	await prisma.$transaction(async (tx) => {
		// Accept this bid
		await tx.vendorBid.update({
			where: { id: bidId },
			data: {
				status: 'ACCEPTED',
				respondedAt: new Date()
			}
		});

		// Update vendor candidate to SELECTED
		await tx.vendorCandidate.update({
			where: { id: vendorCandidateId },
			data: {
				status: 'SELECTED',
				statusChangedAt: new Date()
			}
		});

		// Reject other pending bids for this case
		await tx.vendorBid.updateMany({
			where: {
				caseId,
				id: { not: bidId },
				status: 'PENDING'
			},
			data: {
				status: 'REJECTED',
				respondedAt: new Date()
			}
		});
	});

	log.info('ACCEPT completed', { bidId, vendorCandidateId, caseId });
	return { bidId };
}

async function rejectVendorBid(
	bidId: string,
	vendorCandidateId: string,
	existingNotes: string | null,
	reason?: string
): Promise<{ bidId: string }> {
	await prisma.$transaction(async (tx) => {
		await tx.vendorBid.update({
			where: { id: bidId },
			data: {
				status: 'REJECTED',
				respondedAt: new Date(),
				notes: reason
					? existingNotes
						? `${existingNotes}\n\nRejection reason: ${reason}`
						: `Rejection reason: ${reason}`
					: existingNotes
			}
		});

		// Update vendor candidate to REJECTED
		await tx.vendorCandidate.update({
			where: { id: vendorCandidateId },
			data: {
				status: 'REJECTED',
				statusChangedAt: new Date()
			}
		});
	});

	log.info('REJECT completed', { bidId, vendorCandidateId });
	return { bidId };
}

// Main workflow function
async function vendorBidWorkflow(input: VendorBidWorkflowInput): Promise<VendorBidWorkflowResult> {
	try {
		switch (input.action) {
			case 'CREATE': {
				const result = await DBOS.runStep(
					() => createVendorBid(input.data),
					{ name: 'createVendorBid' }
				);
				return {
					success: true,
					entityId: result.bidId,
					bidId: result.bidId,
					vendorCandidateId: result.vendorCandidateId
				};
			}

			case 'UPDATE': {
				const result = await DBOS.runStep(
					() => updateVendorBid(input.bidId!, input.data),
					{ name: 'updateVendorBid' }
				);
				return { success: true, entityId: result.bidId, bidId: result.bidId };
			}

			case 'ACCEPT': {
				const result = await DBOS.runStep(
					() => acceptVendorBid(input.bidId!, input.data.vendorCandidateId!, input.data.caseId!),
					{ name: 'acceptVendorBid' }
				);
				return { success: true, entityId: result.bidId, bidId: result.bidId };
			}

			case 'REJECT': {
				const result = await DBOS.runStep(
					() => rejectVendorBid(
						input.bidId!,
						input.data.vendorCandidateId!,
						input.data.notes ?? null,
						input.data.reason
					),
					{ name: 'rejectVendorBid' }
				);
				return { success: true, entityId: result.bidId, bidId: result.bidId };
			}

			default:
				return { success: false, error: `Unknown action: ${input.action}` };
		}
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;
		console.error(`[VendorBidWorkflow] Error in ${input.action}:`, errorMessage);

		await recordSpanError(errorObj, {
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'VENDOR_BID_WORKFLOW_ERROR'
		});

		return { success: false, error: errorMessage };
	}
}

export const vendorBidWorkflow_v1 = DBOS.registerWorkflow(vendorBidWorkflow);

export async function startVendorBidWorkflow(
	input: VendorBidWorkflowInput,
	idempotencyKey: string
): Promise<VendorBidWorkflowResult> {
	const handle = await DBOS.startWorkflow(vendorBidWorkflow_v1, { workflowID: idempotencyKey })(input);
	return handle.getResult();
}
