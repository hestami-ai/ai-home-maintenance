/**
 * Transfer Workflow (v1)
 *
 * DBOS durable workflow for managing inventory transfer operations.
 * Handles: create, ship, receive, cancel.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { orgTransaction } from '../db/rls.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { type EntityWorkflowResult } from './schemas.js';
import { createWorkflowLogger } from './workflowLogger.js';
import { ActivityActionType } from '../../../../generated/prisma/enums.js';

// Workflow error types for tracing
const WorkflowErrorType = {
	TRANSFER_WORKFLOW_ERROR: 'TRANSFER_WORKFLOW_ERROR'
} as const;

// Transfer status values (matches schema comment: PENDING, IN_TRANSIT, COMPLETED, CANCELLED)
export const TransferStatus = {
	PENDING: 'PENDING',
	IN_TRANSIT: 'IN_TRANSIT',
	RECEIVED: 'RECEIVED',
	CANCELLED: 'CANCELLED'
} as const;

export type TransferStatus = (typeof TransferStatus)[keyof typeof TransferStatus];

const log = createWorkflowLogger('TransferWorkflow');

// Action types for the unified workflow
export const TransferAction = {
	CREATE_TRANSFER: 'CREATE_TRANSFER',
	SHIP_TRANSFER: 'SHIP_TRANSFER',
	RECEIVE_TRANSFER: 'RECEIVE_TRANSFER',
	CANCEL_TRANSFER: 'CANCEL_TRANSFER'
} as const;

export type TransferAction = (typeof TransferAction)[keyof typeof TransferAction];

export interface TransferWorkflowInput {
	action: TransferAction;
	organizationId: string;
	userId: string;
	transferId?: string;
	data: Record<string, unknown>;
}

export interface TransferWorkflowResult extends EntityWorkflowResult {
	// Inherits success, error, entityId from EntityWorkflowResult
}

// Step functions for each operation
async function createTransfer(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const fromLocationId = data.fromLocationId as string;
	const toLocationId = data.toLocationId as string;
	const notes = data.notes as string | undefined;
	const lines = data.lines as Array<{
		itemId: string;
		quantity: number;
		lotNumber?: string;
		serialNumber?: string;
	}>;

	return orgTransaction(organizationId, async (tx) => {
		// Generate transfer number within transaction
		const count = await tx.inventoryTransfer.count({ where: { organizationId } });
		const transferNumber = `TRF-${String(count + 1).padStart(6, '0')}`;

		const transfer = await tx.inventoryTransfer.create({
			data: {
				organizationId,
				transferNumber,
				fromLocationId,
				toLocationId,
				notes,
				requestedBy: userId
			}
		});

		await tx.inventoryTransferLine.createMany({
			data: lines.map((line) => ({
				transferId: transfer.id,
				itemId: line.itemId,
				quantityRequested: line.quantity,
				lotNumber: line.lotNumber,
				serialNumber: line.serialNumber
			}))
		});

		log.info('CREATE_TRANSFER completed', { transferId: transfer.id, userId });
		return transfer.id;
	}, { userId, reason: 'Create inventory transfer' });
}

async function shipTransfer(
	organizationId: string,
	userId: string,
	transferId: string,
	data: Record<string, unknown>
): Promise<string> {
	const existingLines = data.existingLines as Array<{
		id: string;
		itemId: string;
		quantityRequested: number;
		lotNumber: string | null;
		serialNumber: string | null;
	}>;
	const fromLocationId = data.fromLocationId as string;
	const inputLines = data.lines as Array<{ lineId: string; quantityShipped: number }> | undefined;

	return orgTransaction(organizationId, async (tx) => {
		// Update line quantities and deduct from source location
		for (const line of existingLines) {
			const shipLine = inputLines?.find((l) => l.lineId === line.id);
			const qtyToShip = shipLine?.quantityShipped ?? line.quantityRequested;

			// Deduct from source location
			const level = await tx.inventoryLevel.findFirst({
				where: {
					itemId: line.itemId,
					locationId: fromLocationId,
					lotNumber: line.lotNumber ?? null,
					serialNumber: line.serialNumber ?? null
				}
			});

			if (!level || level.quantityAvailable < qtyToShip) {
				throw new Error(`Insufficient stock for item ${line.itemId}`);
			}

			await tx.inventoryLevel.update({
				where: { id: level.id },
				data: {
					quantityOnHand: level.quantityOnHand - qtyToShip,
					quantityAvailable: level.quantityAvailable - qtyToShip
				}
			});

			await tx.inventoryTransferLine.update({
				where: { id: line.id },
				data: { quantityShipped: qtyToShip }
			});
		}

		// Update transfer status
		await tx.inventoryTransfer.update({
			where: { id: transferId },
			data: {
				status: TransferStatus.IN_TRANSIT,
				shippedAt: new Date()
			}
		});

		log.info('SHIP_TRANSFER completed', { transferId, userId });
		return transferId;
	}, { userId, reason: 'Ship inventory transfer' });
}

async function receiveTransfer(
	organizationId: string,
	userId: string,
	transferId: string,
	data: Record<string, unknown>
): Promise<string> {
	const existingLines = data.existingLines as Array<{
		id: string;
		itemId: string;
		quantityShipped: number;
		lotNumber: string | null;
		serialNumber: string | null;
	}>;
	const toLocationId = data.toLocationId as string;
	const inputLines = data.lines as Array<{ lineId: string; quantityReceived: number }> | undefined;

	return orgTransaction(organizationId, async (tx) => {
		// Update line quantities and add to destination location
		for (const line of existingLines) {
			const recvLine = inputLines?.find((l) => l.lineId === line.id);
			const qtyToReceive = recvLine?.quantityReceived ?? line.quantityShipped;

			// Add to destination location
			const level = await tx.inventoryLevel.findFirst({
				where: {
					itemId: line.itemId,
					locationId: toLocationId,
					lotNumber: line.lotNumber ?? null,
					serialNumber: line.serialNumber ?? null
				}
			});

			if (level) {
				await tx.inventoryLevel.update({
					where: { id: level.id },
					data: {
						quantityOnHand: level.quantityOnHand + qtyToReceive,
						quantityAvailable: level.quantityAvailable + qtyToReceive
					}
				});
			} else {
				await tx.inventoryLevel.create({
					data: {
						itemId: line.itemId,
						locationId: toLocationId,
						quantityOnHand: qtyToReceive,
						quantityAvailable: qtyToReceive,
						lotNumber: line.lotNumber,
						serialNumber: line.serialNumber
					}
				});
			}

			await tx.inventoryTransferLine.update({
				where: { id: line.id },
				data: { quantityReceived: qtyToReceive }
			});
		}

		// Update transfer status
		await tx.inventoryTransfer.update({
			where: { id: transferId },
			data: {
				status: TransferStatus.RECEIVED,
				receivedAt: new Date()
			}
		});

		log.info('RECEIVE_TRANSFER completed', { transferId, userId });
		return transferId;
	}, { userId, reason: 'Receive inventory transfer' });
}

async function cancelTransfer(
	organizationId: string,
	userId: string,
	transferId: string,
	data: Record<string, unknown>
): Promise<string> {
	const existingStatus = data.existingStatus as string;
	const fromLocationId = data.fromLocationId as string;
	const existingLines = data.existingLines as Array<{
		id: string;
		itemId: string;
		quantityShipped: number;
		lotNumber: string | null;
		serialNumber: string | null;
	}>;
	const reason = data.reason as string | undefined;
	const existingNotes = data.existingNotes as string | undefined;

	return orgTransaction(organizationId, async (tx) => {
		// If in transit, return stock to source
		if (existingStatus === TransferStatus.IN_TRANSIT) {
			for (const line of existingLines) {
				if (line.quantityShipped > 0) {
					const level = await tx.inventoryLevel.findFirst({
						where: {
							itemId: line.itemId,
							locationId: fromLocationId,
							lotNumber: line.lotNumber ?? null,
							serialNumber: line.serialNumber ?? null
						}
					});

					if (level) {
						await tx.inventoryLevel.update({
							where: { id: level.id },
							data: {
								quantityOnHand: level.quantityOnHand + line.quantityShipped,
								quantityAvailable: level.quantityAvailable + line.quantityShipped
							}
						});
					} else {
						await tx.inventoryLevel.create({
							data: {
								itemId: line.itemId,
								locationId: fromLocationId,
								quantityOnHand: line.quantityShipped,
								quantityAvailable: line.quantityShipped,
								lotNumber: line.lotNumber,
								serialNumber: line.serialNumber
							}
						});
					}
				}
			}
		}

		await tx.inventoryTransfer.update({
			where: { id: transferId },
			data: {
				status: TransferStatus.CANCELLED,
				notes: reason ? `${existingNotes ?? ''}\nCancelled: ${reason}`.trim() : existingNotes
			}
		});

		log.info('CANCEL_TRANSFER completed', { transferId, userId });
		return transferId;
	}, { userId, reason: 'Cancel inventory transfer' });
}

// Main workflow function
async function transferWorkflow(input: TransferWorkflowInput): Promise<TransferWorkflowResult> {
	try {
		let entityId: string | undefined;

		switch (input.action) {
			case TransferAction.CREATE_TRANSFER:
				entityId = await DBOS.runStep(
					() => createTransfer(input.organizationId, input.userId, input.data),
					{ name: 'createTransfer' }
				);
				break;

			case TransferAction.SHIP_TRANSFER:
				entityId = await DBOS.runStep(
					() => shipTransfer(input.organizationId, input.userId, input.transferId!, input.data),
					{ name: 'shipTransfer' }
				);
				break;

			case TransferAction.RECEIVE_TRANSFER:
				entityId = await DBOS.runStep(
					() => receiveTransfer(input.organizationId, input.userId, input.transferId!, input.data),
					{ name: 'receiveTransfer' }
				);
				break;

			case TransferAction.CANCEL_TRANSFER:
				entityId = await DBOS.runStep(
					() => cancelTransfer(input.organizationId, input.userId, input.transferId!, input.data),
					{ name: 'cancelTransfer' }
				);
				break;

			default:
				return { success: false, error: `Unknown action: ${input.action}` };
		}

		return { success: true, entityId };
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;
		log.error('Workflow error', { action: input.action, error: errorMessage });

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: ActivityActionType.WORKFLOW_FAILED,
			errorType: WorkflowErrorType.TRANSFER_WORKFLOW_ERROR
		});

		return { success: false, error: errorMessage };
	}
}

export const transferWorkflow_v1 = DBOS.registerWorkflow(transferWorkflow);

export async function startTransferWorkflow(
	input: TransferWorkflowInput,
	idempotencyKey: string
): Promise<TransferWorkflowResult> {
	const workflowId = idempotencyKey || `transfer-${input.action}-${input.transferId || 'new'}-${Date.now()}`;
	const handle = await DBOS.startWorkflow(transferWorkflow_v1, { workflowID: idempotencyKey})(input);
	return handle.getResult();
}
