/**
 * Bid Workflow (v1)
 *
 * DBOS durable workflow for work order bid operations.
 * Handles: requestBids, submitBid, acceptBid, rejectBid, withdrawBid, expireBid.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { type EntityWorkflowResult } from './schemas.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger } from './workflowLogger.js';
import { orgTransaction } from '../db/rls.js';

const log = createWorkflowLogger('BidWorkflow');

// Action types for the unified workflow
export const BidWorkflowAction = {
	REQUEST_BIDS: 'REQUEST_BIDS',
	SUBMIT_BID: 'SUBMIT_BID',
	ACCEPT_BID: 'ACCEPT_BID',
	REJECT_BID: 'REJECT_BID',
	WITHDRAW_BID: 'WITHDRAW_BID',
	EXPIRE_BID: 'EXPIRE_BID'
} as const;

export type BidWorkflowAction = (typeof BidWorkflowAction)[keyof typeof BidWorkflowAction];

export interface BidWorkflowInput {
	action: BidWorkflowAction;
	organizationId: string;
	userId: string;
	bidId?: string;
	workOrderId?: string;
	data: {
		// REQUEST_BIDS fields
		vendorIds?: string[];
		dueDate?: string;
		notes?: string;
		// SUBMIT_BID fields
		laborCost?: number;
		materialsCost?: number;
		estimatedHours?: number;
		proposedStartDate?: string;
		proposedEndDate?: string;
		// ACCEPT_BID fields
		workOrderId?: string;
		workOrderStatus?: string;
		vendorId?: string;
		vendorName?: string;
		totalAmount?: number;
		// REJECT_BID / WITHDRAW_BID fields
		reason?: string;
	};
}

export interface BidWorkflowResult extends EntityWorkflowResult {
	bidIds?: string[];
}

// Step functions

async function requestBids(
	organizationId: string,
	userId: string,
	workOrderId: string,
	data: BidWorkflowInput['data']
): Promise<string[]> {
	const vendorIds = data.vendorIds!;
	const dueDate = data.dueDate!;
	const notes = data.notes;

	const bids = await orgTransaction(
		organizationId,
		async (tx) => {
			const createdBids = [];
			for (const vendorId of vendorIds) {
				const bid = await tx.workOrderBid.create({
					data: {
						workOrderId,
						vendorId,
						status: 'REQUESTED',
						validUntil: new Date(dueDate),
						notes
					}
				});
				createdBids.push(bid);
			}
			return createdBids;
		},
		{ userId, reason: 'Request bids from vendors for work order' }
	);

	log.info('REQUEST_BIDS completed', { workOrderId, vendorIds, userId });
	return bids.map(b => b.id);
}

async function submitBid(
	organizationId: string,
	userId: string,
	bidId: string,
	data: BidWorkflowInput['data']
): Promise<string> {
	const totalAmount = (data.laborCost || 0) + (data.materialsCost || 0);

	const updated = await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.workOrderBid.update({
				where: { id: bidId },
				data: {
					laborCost: data.laborCost,
					materialsCost: data.materialsCost,
					totalAmount,
					estimatedHours: data.estimatedHours,
					proposedStartDate: data.proposedStartDate ? new Date(data.proposedStartDate) : null,
					proposedEndDate: data.proposedEndDate ? new Date(data.proposedEndDate) : null,
					notes: data.notes,
					status: 'SUBMITTED',
					submittedAt: new Date()
				}
			});
		},
		{ userId, reason: 'Submit bid for work order' }
	);

	log.info('SUBMIT_BID completed', { bidId, totalAmount, userId });
	return updated.id;
}

async function expireBid(
	organizationId: string,
	userId: string,
	bidId: string
): Promise<string> {
	await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.workOrderBid.update({
				where: { id: bidId },
				data: { status: 'EXPIRED' }
			});
		},
		{ userId, reason: 'Expire work order bid' }
	);

	log.info('EXPIRE_BID completed', { bidId, userId });
	return bidId;
}

async function acceptBid(
	organizationId: string,
	userId: string,
	bidId: string,
	data: BidWorkflowInput['data']
): Promise<string> {
	const workOrderId = data.workOrderId as string;
	const vendorId = data.vendorId as string;
	const vendorName = data.vendorName as string;
	const workOrderStatus = data.workOrderStatus as string;
	const totalAmount = data.totalAmount;
	const estimatedHours = data.estimatedHours;
	const notes = data.notes;

	await orgTransaction(
		organizationId,
		async (tx) => {
			// Accept this bid
			await tx.workOrderBid.update({
				where: { id: bidId },
				data: {
					status: 'ACCEPTED',
					respondedAt: new Date(),
					respondedBy: userId
				}
			});

			// Reject all other bids for this work order
			await tx.workOrderBid.updateMany({
				where: {
					workOrderId,
					id: { not: bidId },
					status: { in: ['REQUESTED', 'PENDING', 'SUBMITTED', 'UNDER_REVIEW'] }
				},
				data: {
					status: 'REJECTED',
					respondedAt: new Date(),
					respondedBy: userId
				}
			});

			// Assign vendor to work order
			await tx.workOrder.update({
				where: { id: workOrderId },
				data: {
					assignedVendorId: vendorId,
					assignedAt: new Date(),
					assignedBy: userId,
					status: 'ASSIGNED',
					estimatedCost: totalAmount,
					estimatedHours
				}
			});

			// Record status change
			await tx.workOrderStatusHistory.create({
				data: {
					workOrderId,
					fromStatus: workOrderStatus as any,
					toStatus: 'ASSIGNED' as any,
					changedBy: userId,
					notes: notes || `Bid accepted from ${vendorName}`
				}
			});
		},
		{ userId, reason: 'Accept bid and assign vendor to work order' }
	);

	log.info('ACCEPT_BID completed', { bidId, workOrderId, vendorId, userId });
	return bidId;
}

async function rejectBid(
	organizationId: string,
	userId: string,
	bidId: string,
	data: BidWorkflowInput['data']
): Promise<string> {
	await orgTransaction(
		organizationId,
		async (tx) => {
			const bid = await tx.workOrderBid.findUnique({ where: { id: bidId } });

			await tx.workOrderBid.update({
				where: { id: bidId },
				data: {
					status: 'REJECTED',
					respondedAt: new Date(),
					respondedBy: userId,
					notes: data.reason ? `Rejected: ${data.reason}` : bid?.notes
				}
			});
		},
		{ userId, reason: 'Reject work order bid' }
	);

	log.info('REJECT_BID completed', { bidId, userId });
	return bidId;
}

async function withdrawBid(
	organizationId: string,
	userId: string,
	bidId: string,
	data: BidWorkflowInput['data']
): Promise<string> {
	await orgTransaction(
		organizationId,
		async (tx) => {
			const bid = await tx.workOrderBid.findUnique({ where: { id: bidId } });

			await tx.workOrderBid.update({
				where: { id: bidId },
				data: {
					status: 'WITHDRAWN',
					notes: data.reason ? `Withdrawn: ${data.reason}` : bid?.notes
				}
			});
		},
		{ userId, reason: 'Withdraw work order bid' }
	);

	log.info('WITHDRAW_BID completed', { bidId, userId });
	return bidId;
}

// Main workflow function
async function bidWorkflow(input: BidWorkflowInput): Promise<BidWorkflowResult> {
	try {
		switch (input.action) {
			case 'REQUEST_BIDS': {
				const bidIds = await DBOS.runStep(
					() => requestBids(input.organizationId, input.userId, input.workOrderId!, input.data),
					{ name: 'requestBids' }
				);
				return { success: true, bidIds };
			}

			case 'SUBMIT_BID': {
				const bidId = await DBOS.runStep(
					() => submitBid(input.organizationId, input.userId, input.bidId!, input.data),
					{ name: 'submitBid' }
				);
				return { success: true, entityId: bidId };
			}

			case 'EXPIRE_BID': {
				const bidId = await DBOS.runStep(
					() => expireBid(input.organizationId, input.userId, input.bidId!),
					{ name: 'expireBid' }
				);
				return { success: true, entityId: bidId };
			}

			case 'ACCEPT_BID': {
				const bidId = await DBOS.runStep(
					() => acceptBid(input.organizationId, input.userId, input.bidId!, input.data),
					{ name: 'acceptBid' }
				);
				return { success: true, entityId: bidId };
			}

			case 'REJECT_BID': {
				const bidId = await DBOS.runStep(
					() => rejectBid(input.organizationId, input.userId, input.bidId!, input.data),
					{ name: 'rejectBid' }
				);
				return { success: true, entityId: bidId };
			}

			case 'WITHDRAW_BID': {
				const bidId = await DBOS.runStep(
					() => withdrawBid(input.organizationId, input.userId, input.bidId!, input.data),
					{ name: 'withdrawBid' }
				);
				return { success: true, entityId: bidId };
			}

			default:
				return { success: false, error: `Unknown action: ${input.action}` };
		}
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;
		console.error(`[BidWorkflow] Error in ${input.action}:`, errorMessage);

		await recordSpanError(errorObj, {
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'BID_WORKFLOW_ERROR'
		});

		return { success: false, error: errorMessage };
	}
}

export const bidWorkflow_v1 = DBOS.registerWorkflow(bidWorkflow);

export async function startBidWorkflow(
	input: BidWorkflowInput,
	idempotencyKey: string
): Promise<BidWorkflowResult> {
	const handle = await DBOS.startWorkflow(bidWorkflow_v1, { workflowID: idempotencyKey })(input);
	return handle.getResult();
}
