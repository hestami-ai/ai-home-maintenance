/**
 * Usage Workflow (v1)
 *
 * DBOS durable workflow for managing material usage operations.
 * Handles: record, reverse.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import { type EntityWorkflowResult } from './schemas.js';

// Action types for the unified workflow
export const UsageAction = {
	RECORD_USAGE: 'RECORD_USAGE',
	REVERSE_USAGE: 'REVERSE_USAGE'
} as const;

export type UsageAction = (typeof UsageAction)[keyof typeof UsageAction];

export interface UsageWorkflowInput {
	action: UsageAction;
	organizationId: string;
	userId: string;
	usageId?: string;
	data: Record<string, unknown>;
}

export interface UsageWorkflowResult extends EntityWorkflowResult {
	// Inherits success, error, entityId from EntityWorkflowResult
}

// Step functions for each operation
async function recordUsage(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const itemId = data.itemId as string;
	const locationId = data.locationId as string;
	const quantity = data.quantity as number;
	const jobId = data.jobId as string;
	const jobVisitId = data.jobVisitId as string | undefined;
	const lotNumber = (data.lotNumber as string | undefined) ?? null;
	const serialNumber = (data.serialNumber as string | undefined) ?? null;
	const unitCost = data.unitCost as number;
	const notes = data.notes as string | undefined;

	// Check and deduct stock
	const level = await prisma.inventoryLevel.findFirst({
		where: {
			itemId,
			locationId,
			lotNumber,
			serialNumber
		}
	});

	if (!level || level.quantityAvailable < quantity) {
		throw new Error('Insufficient stock at location');
	}

	// Deduct from inventory
	await prisma.inventoryLevel.update({
		where: { id: level.id },
		data: {
			quantityOnHand: level.quantityOnHand - quantity,
			quantityAvailable: level.quantityAvailable - quantity
		}
	});

	// Record usage
	const totalCost = unitCost * quantity;

	const usage = await prisma.materialUsage.create({
		data: {
			organizationId,
			jobId,
			jobVisitId,
			itemId,
			locationId,
			quantity,
			unitCost,
			totalCost,
			lotNumber,
			serialNumber,
			usedBy: userId,
			notes
		}
	});

	console.log(`[UsageWorkflow] RECORD_USAGE usage:${usage.id} by user ${userId}`);
	return usage.id;
}

async function reverseUsage(
	organizationId: string,
	userId: string,
	usageId: string,
	data: Record<string, unknown>
): Promise<string> {
	const usage = await prisma.materialUsage.findUnique({ where: { id: usageId } });
	if (!usage) {
		throw new Error('Usage record not found');
	}

	// Return stock to inventory
	const level = await prisma.inventoryLevel.findFirst({
		where: {
			itemId: usage.itemId,
			locationId: usage.locationId,
			lotNumber: usage.lotNumber ?? null,
			serialNumber: usage.serialNumber ?? null
		}
	});

	if (level) {
		await prisma.inventoryLevel.update({
			where: { id: level.id },
			data: {
				quantityOnHand: level.quantityOnHand + usage.quantity,
				quantityAvailable: level.quantityAvailable + usage.quantity
			}
		});
	} else {
		await prisma.inventoryLevel.create({
			data: {
				itemId: usage.itemId,
				locationId: usage.locationId,
				quantityOnHand: usage.quantity,
				quantityAvailable: usage.quantity,
				lotNumber: usage.lotNumber,
				serialNumber: usage.serialNumber
			}
		});
	}

	// Delete usage record
	await prisma.materialUsage.delete({ where: { id: usageId } });

	console.log(`[UsageWorkflow] REVERSE_USAGE usage:${usageId} by user ${userId}`);
	return usageId;
}

// Main workflow function
async function usageWorkflow(input: UsageWorkflowInput): Promise<UsageWorkflowResult> {
	try {
		let entityId: string | undefined;

		switch (input.action) {
			case 'RECORD_USAGE':
				entityId = await DBOS.runStep(
					() => recordUsage(input.organizationId, input.userId, input.data),
					{ name: 'recordUsage' }
				);
				break;

			case 'REVERSE_USAGE':
				entityId = await DBOS.runStep(
					() => reverseUsage(input.organizationId, input.userId, input.usageId!, input.data),
					{ name: 'reverseUsage' }
				);
				break;

			default:
				return { success: false, error: `Unknown action: ${input.action}` };
		}

		return { success: true, entityId };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`[UsageWorkflow] Error in ${input.action}:`, errorMessage);
		return { success: false, error: errorMessage };
	}
}

export const usageWorkflow_v1 = DBOS.registerWorkflow(usageWorkflow);

export async function startUsageWorkflow(
	input: UsageWorkflowInput,
	idempotencyKey?: string
): Promise<UsageWorkflowResult> {
	const workflowId = idempotencyKey || `usage-${input.action}-${input.usageId || 'new'}-${Date.now()}`;
	const handle = await DBOS.startWorkflow(usageWorkflow_v1, { workflowID: workflowId })(input);
	return handle.getResult();
}
