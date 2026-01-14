/**
 * Stock Workflow (v1)
 *
 * DBOS durable workflow for managing inventory stock operations.
 * Handles: adjust, reserve, release, recordCount.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { type EntityWorkflowResult } from './schemas.js';

// Action types for the unified workflow
export const StockAction = {
	ADJUST_STOCK: 'ADJUST_STOCK',
	RESERVE_STOCK: 'RESERVE_STOCK',
	RELEASE_STOCK: 'RELEASE_STOCK',
	RECORD_COUNT: 'RECORD_COUNT'
} as const;

export type StockAction = (typeof StockAction)[keyof typeof StockAction];

export interface StockWorkflowInput {
	action: StockAction;
	organizationId: string;
	userId: string;
	itemId?: string;
	locationId?: string;
	levelId?: string;
	data: Record<string, unknown>;
}

export interface StockWorkflowResult extends EntityWorkflowResult {
	// Inherits success, error, entityId from EntityWorkflowResult
}

// Step functions for each operation
async function adjustStock(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const itemId = data.itemId as string;
	const locationId = data.locationId as string;
	const adjustment = data.adjustment as number;
	const lotNumber = (data.lotNumber as string | undefined) ?? null;
	const serialNumber = (data.serialNumber as string | undefined) ?? null;
	const expirationDate = data.expirationDate as string | undefined;

	let level = await prisma.inventoryLevel.findFirst({
		where: {
			itemId,
			locationId,
			lotNumber,
			serialNumber
		}
	});

	if (level) {
		const newOnHand = level.quantityOnHand + adjustment;
		if (newOnHand < 0) {
			throw new Error('Adjustment would result in negative stock');
		}

		level = await prisma.inventoryLevel.update({
			where: { id: level.id },
			data: {
				quantityOnHand: newOnHand,
				quantityAvailable: newOnHand - level.quantityReserved,
				expirationDate: expirationDate ? new Date(expirationDate) : level.expirationDate
			}
		});
	} else {
		if (adjustment < 0) {
			throw new Error('Cannot remove stock that does not exist');
		}

		level = await prisma.inventoryLevel.create({
			data: {
				itemId,
				locationId,
				quantityOnHand: adjustment,
				quantityAvailable: adjustment,
				lotNumber,
				serialNumber,
				expirationDate: expirationDate ? new Date(expirationDate) : null
			}
		});
	}

	console.log(`[StockWorkflow] ADJUST_STOCK on item:${itemId} location:${locationId} by user ${userId}`);
	return level.id;
}

async function reserveStock(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const itemId = data.itemId as string;
	const locationId = data.locationId as string;
	const quantity = data.quantity as number;
	const lotNumber = (data.lotNumber as string | undefined) ?? null;
	const serialNumber = (data.serialNumber as string | undefined) ?? null;

	const level = await prisma.inventoryLevel.findFirst({
		where: {
			itemId,
			locationId,
			lotNumber,
			serialNumber
		}
	});

	if (!level) {
		throw new Error('Inventory level not found');
	}

	if (level.quantityAvailable < quantity) {
		throw new Error('Insufficient available stock');
	}

	const updated = await prisma.inventoryLevel.update({
		where: { id: level.id },
		data: {
			quantityReserved: level.quantityReserved + quantity,
			quantityAvailable: level.quantityAvailable - quantity
		}
	});

	console.log(`[StockWorkflow] RESERVE_STOCK on item:${itemId} location:${locationId} qty:${quantity} by user ${userId}`);
	return updated.id;
}

async function releaseStock(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const itemId = data.itemId as string;
	const locationId = data.locationId as string;
	const quantity = data.quantity as number;
	const lotNumber = (data.lotNumber as string | undefined) ?? null;
	const serialNumber = (data.serialNumber as string | undefined) ?? null;

	const level = await prisma.inventoryLevel.findFirst({
		where: {
			itemId,
			locationId,
			lotNumber,
			serialNumber
		}
	});

	if (!level) {
		throw new Error('Inventory level not found');
	}

	if (level.quantityReserved < quantity) {
		throw new Error('Cannot release more than reserved');
	}

	const updated = await prisma.inventoryLevel.update({
		where: { id: level.id },
		data: {
			quantityReserved: level.quantityReserved - quantity,
			quantityAvailable: level.quantityAvailable + quantity
		}
	});

	console.log(`[StockWorkflow] RELEASE_STOCK on item:${itemId} location:${locationId} qty:${quantity} by user ${userId}`);
	return updated.id;
}

async function recordCount(
	organizationId: string,
	userId: string,
	levelId: string | undefined,
	data: Record<string, unknown>
): Promise<string> {
	const countedQuantity = data.countedQuantity as number;
	const itemId = data.itemId as string;
	const locationId = data.locationId as string;
	const lotNumber = (data.lotNumber as string | undefined) ?? null;
	const serialNumber = (data.serialNumber as string | undefined) ?? null;

	let updated;

	if (levelId) {
		const level = await prisma.inventoryLevel.findUnique({ where: { id: levelId } });
		if (!level) {
			throw new Error('Inventory level not found');
		}

		// Update existing level
		updated = await prisma.inventoryLevel.update({
			where: { id: levelId },
			data: {
				quantityOnHand: countedQuantity,
				quantityAvailable: countedQuantity - level.quantityReserved,
				lastCountedAt: new Date()
			}
		});
	} else {
		// Create new level if it doesn't exist
		updated = await prisma.inventoryLevel.create({
			data: {
				itemId,
				locationId,
				quantityOnHand: countedQuantity,
				quantityAvailable: countedQuantity,
				lotNumber,
				serialNumber,
				lastCountedAt: new Date()
			}
		});
	}

	console.log(`[StockWorkflow] RECORD_COUNT on level:${updated.id} by user ${userId}`);
	return updated.id;
}

// Main workflow function
async function stockWorkflow(input: StockWorkflowInput): Promise<StockWorkflowResult> {
	try {
		let entityId: string | undefined;

		switch (input.action) {
			case 'ADJUST_STOCK':
				entityId = await DBOS.runStep(
					() => adjustStock(input.organizationId, input.userId, input.data),
					{ name: 'adjustStock' }
				);
				break;

			case 'RESERVE_STOCK':
				entityId = await DBOS.runStep(
					() => reserveStock(input.organizationId, input.userId, input.data),
					{ name: 'reserveStock' }
				);
				break;

			case 'RELEASE_STOCK':
				entityId = await DBOS.runStep(
					() => releaseStock(input.organizationId, input.userId, input.data),
					{ name: 'releaseStock' }
				);
				break;

			case 'RECORD_COUNT':
				entityId = await DBOS.runStep(
					() => recordCount(input.organizationId, input.userId, input.levelId!, input.data),
					{ name: 'recordCount' }
				);
				break;

			default:
				return { success: false, error: `Unknown action: ${input.action}` };
		}

		return { success: true, entityId };
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;
		console.error(`[StockWorkflow] Error in ${input.action}:`, errorMessage);

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'STOCK_WORKFLOW_ERROR'
		});

		return { success: false, error: errorMessage };
	}
}

export const stockWorkflow_v1 = DBOS.registerWorkflow(stockWorkflow);

export async function startStockWorkflow(
	input: StockWorkflowInput,
	idempotencyKey: string
): Promise<StockWorkflowResult> {
	const workflowId = idempotencyKey || `stock-${input.action}-${input.itemId || input.levelId || 'new'}-${Date.now()}`;
	const handle = await DBOS.startWorkflow(stockWorkflow_v1, { workflowID: idempotencyKey})(input);
	return handle.getResult();
}
