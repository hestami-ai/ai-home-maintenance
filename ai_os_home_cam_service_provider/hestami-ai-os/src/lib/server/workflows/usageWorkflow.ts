/**
 * Usage Workflow (v1)
 *
 * DBOS durable workflow for managing material usage operations.
 * Handles: record, reverse.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import { orgTransaction } from '../db/rls.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { type EntityWorkflowResult } from './schemas.js';
import { createWorkflowLogger } from './workflowLogger.js';
import { ActivityActionType } from '../../../../generated/prisma/enums.js';

const log = createWorkflowLogger('UsageWorkflow');

// Workflow error types for tracing
const WorkflowErrorType = {
	USAGE_WORKFLOW_ERROR: 'USAGE_WORKFLOW_ERROR'
} as const;

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

	// Check stock first (read operation, no RLS context needed for check)
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

	// Perform all mutations in org transaction
	const usage = await orgTransaction(
		organizationId,
		async (tx) => {
			// Deduct from inventory
			await tx.inventoryLevel.update({
				where: { id: level.id },
				data: {
					quantityOnHand: level.quantityOnHand - quantity,
					quantityAvailable: level.quantityAvailable - quantity
				}
			});

			// Record usage
			const totalCost = unitCost * quantity;

			return tx.materialUsage.create({
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
		},
		{ userId, reason: 'Record material usage' }
	);

	log.info('RECORD_USAGE completed', { usageId: usage.id, userId });
	return usage.id;
}

async function reverseUsage(
	organizationId: string,
	userId: string,
	usageId: string,
	_data: Record<string, unknown>
): Promise<string> {
	// Get usage record first (read operation)
	const usage = await prisma.materialUsage.findUnique({ where: { id: usageId } });
	if (!usage) {
		throw new Error('Usage record not found');
	}

	// Check for existing inventory level (read operation)
	const level = await prisma.inventoryLevel.findFirst({
		where: {
			itemId: usage.itemId,
			locationId: usage.locationId,
			lotNumber: usage.lotNumber ?? null,
			serialNumber: usage.serialNumber ?? null
		}
	});

	// Perform all mutations in org transaction
	await orgTransaction(
		organizationId,
		async (tx) => {
			// Return stock to inventory
			if (level) {
				await tx.inventoryLevel.update({
					where: { id: level.id },
					data: {
						quantityOnHand: level.quantityOnHand + usage.quantity,
						quantityAvailable: level.quantityAvailable + usage.quantity
					}
				});
			} else {
				await tx.inventoryLevel.create({
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
			await tx.materialUsage.delete({ where: { id: usageId } });
		},
		{ userId, reason: 'Reverse material usage' }
	);

	log.info('REVERSE_USAGE completed', { usageId, userId });
	return usageId;
}

// Main workflow function
async function usageWorkflow(input: UsageWorkflowInput): Promise<UsageWorkflowResult> {
	try {
		let entityId: string | undefined;

		switch (input.action) {
			case UsageAction.RECORD_USAGE:
				entityId = await DBOS.runStep(
					() => recordUsage(input.organizationId, input.userId, input.data),
					{ name: 'recordUsage' }
				);
				break;

			case UsageAction.REVERSE_USAGE:
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
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;
		log.error('Workflow error', { action: input.action, error: errorMessage });

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: ActivityActionType.WORKFLOW_FAILED,
			errorType: WorkflowErrorType.USAGE_WORKFLOW_ERROR
		});

		return { success: false, error: errorMessage };
	}
}

export const usageWorkflow_v1 = DBOS.registerWorkflow(usageWorkflow);

export async function startUsageWorkflow(
	input: UsageWorkflowInput,
	idempotencyKey: string
): Promise<UsageWorkflowResult> {
	const workflowId = idempotencyKey || `usage-${input.action}-${input.usageId || 'new'}-${Date.now()}`;
	const handle = await DBOS.startWorkflow(usageWorkflow_v1, { workflowID: idempotencyKey})(input);
	return handle.getResult();
}
