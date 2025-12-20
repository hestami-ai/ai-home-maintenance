/**
 * Transfer Workflow (v1)
 *
 * DBOS durable workflow for managing inventory transfer operations.
 * Handles: create, ship, receive, cancel.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';

// Action types for the unified workflow
export type TransferAction =
	| 'CREATE_TRANSFER'
	| 'SHIP_TRANSFER'
	| 'RECEIVE_TRANSFER'
	| 'CANCEL_TRANSFER';

export interface TransferWorkflowInput {
	action: TransferAction;
	organizationId: string;
	userId: string;
	transferId?: string;
	data: Record<string, unknown>;
}

export interface TransferWorkflowResult {
	success: boolean;
	entityId?: string;
	error?: string;
}

// Helper to generate transfer number
async function generateTransferNumber(organizationId: string): Promise<string> {
	const count = await prisma.inventoryTransfer.count({ where: { organizationId } });
	return `TRF-${String(count + 1).padStart(6, '0')}`;
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

	const transferNumber = await generateTransferNumber(organizationId);

	const transfer = await prisma.inventoryTransfer.create({
		data: {
			organizationId,
			transferNumber,
			fromLocationId,
			toLocationId,
			notes,
			requestedBy: userId
		}
	});

	await prisma.inventoryTransferLine.createMany({
		data: lines.map((line) => ({
			transferId: transfer.id,
			itemId: line.itemId,
			quantityRequested: line.quantity,
			lotNumber: line.lotNumber,
			serialNumber: line.serialNumber
		}))
	});

	console.log(`[TransferWorkflow] CREATE_TRANSFER transfer:${transfer.id} by user ${userId}`);
	return transfer.id;
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

	// Update line quantities and deduct from source location
	for (const line of existingLines) {
		const shipLine = inputLines?.find((l) => l.lineId === line.id);
		const qtyToShip = shipLine?.quantityShipped ?? line.quantityRequested;

		// Deduct from source location
		const level = await prisma.inventoryLevel.findFirst({
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

		await prisma.inventoryLevel.update({
			where: { id: level.id },
			data: {
				quantityOnHand: level.quantityOnHand - qtyToShip,
				quantityAvailable: level.quantityAvailable - qtyToShip
			}
		});

		await prisma.inventoryTransferLine.update({
			where: { id: line.id },
			data: { quantityShipped: qtyToShip }
		});
	}

	// Update transfer status
	await prisma.inventoryTransfer.update({
		where: { id: transferId },
		data: {
			status: 'IN_TRANSIT',
			shippedAt: new Date()
		}
	});

	console.log(`[TransferWorkflow] SHIP_TRANSFER on transfer:${transferId} by user ${userId}`);
	return transferId;
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

	// Update line quantities and add to destination location
	for (const line of existingLines) {
		const recvLine = inputLines?.find((l) => l.lineId === line.id);
		const qtyToReceive = recvLine?.quantityReceived ?? line.quantityShipped;

		// Add to destination location
		let level = await prisma.inventoryLevel.findFirst({
			where: {
				itemId: line.itemId,
				locationId: toLocationId,
				lotNumber: line.lotNumber ?? null,
				serialNumber: line.serialNumber ?? null
			}
		});

		if (level) {
			await prisma.inventoryLevel.update({
				where: { id: level.id },
				data: {
					quantityOnHand: level.quantityOnHand + qtyToReceive,
					quantityAvailable: level.quantityAvailable + qtyToReceive
				}
			});
		} else {
			await prisma.inventoryLevel.create({
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

		await prisma.inventoryTransferLine.update({
			where: { id: line.id },
			data: { quantityReceived: qtyToReceive }
		});
	}

	// Update transfer status
	await prisma.inventoryTransfer.update({
		where: { id: transferId },
		data: {
			status: 'RECEIVED',
			receivedAt: new Date()
		}
	});

	console.log(`[TransferWorkflow] RECEIVE_TRANSFER on transfer:${transferId} by user ${userId}`);
	return transferId;
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

	// If in transit, return stock to source
	if (existingStatus === 'IN_TRANSIT') {
		for (const line of existingLines) {
			if (line.quantityShipped > 0) {
				let level = await prisma.inventoryLevel.findFirst({
					where: {
						itemId: line.itemId,
						locationId: fromLocationId,
						lotNumber: line.lotNumber ?? null,
						serialNumber: line.serialNumber ?? null
					}
				});

				if (level) {
					await prisma.inventoryLevel.update({
						where: { id: level.id },
						data: {
							quantityOnHand: level.quantityOnHand + line.quantityShipped,
							quantityAvailable: level.quantityAvailable + line.quantityShipped
						}
					});
				} else {
					await prisma.inventoryLevel.create({
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

	await prisma.inventoryTransfer.update({
		where: { id: transferId },
		data: {
			status: 'CANCELLED',
			notes: reason ? `${existingNotes ?? ''}\nCancelled: ${reason}`.trim() : existingNotes
		}
	});

	console.log(`[TransferWorkflow] CANCEL_TRANSFER on transfer:${transferId} by user ${userId}`);
	return transferId;
}

// Main workflow function
async function transferWorkflow(input: TransferWorkflowInput): Promise<TransferWorkflowResult> {
	try {
		let entityId: string | undefined;

		switch (input.action) {
			case 'CREATE_TRANSFER':
				entityId = await DBOS.runStep(
					() => createTransfer(input.organizationId, input.userId, input.data),
					{ name: 'createTransfer' }
				);
				break;

			case 'SHIP_TRANSFER':
				entityId = await DBOS.runStep(
					() => shipTransfer(input.organizationId, input.userId, input.transferId!, input.data),
					{ name: 'shipTransfer' }
				);
				break;

			case 'RECEIVE_TRANSFER':
				entityId = await DBOS.runStep(
					() => receiveTransfer(input.organizationId, input.userId, input.transferId!, input.data),
					{ name: 'receiveTransfer' }
				);
				break;

			case 'CANCEL_TRANSFER':
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
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`[TransferWorkflow] Error in ${input.action}:`, errorMessage);
		return { success: false, error: errorMessage };
	}
}

export const transferWorkflow_v1 = DBOS.registerWorkflow(transferWorkflow);

export async function startTransferWorkflow(
	input: TransferWorkflowInput,
	idempotencyKey?: string
): Promise<TransferWorkflowResult> {
	const workflowId = idempotencyKey || `transfer-${input.action}-${input.transferId || 'new'}-${Date.now()}`;
	const handle = await DBOS.startWorkflow(transferWorkflow_v1, { workflowID: workflowId })(input);
	return handle.getResult();
}
