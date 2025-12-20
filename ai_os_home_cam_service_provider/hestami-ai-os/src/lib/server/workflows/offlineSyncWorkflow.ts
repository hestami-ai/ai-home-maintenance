/**
 * Offline Sync Workflow (v1)
 *
 * DBOS durable workflow for managing offline sync queue operations.
 * Handles: queue, batchQueue, markSynced, markFailed, clearSynced.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import type { Prisma } from '../../../../generated/prisma/client.js';

// Action types for the unified workflow
export type OfflineSyncAction =
	| 'QUEUE_ITEM'
	| 'BATCH_QUEUE'
	| 'MARK_SYNCED'
	| 'MARK_FAILED'
	| 'CLEAR_SYNCED';

export interface OfflineSyncWorkflowInput {
	action: OfflineSyncAction;
	organizationId: string;
	userId: string;
	queueItemId?: string;
	data: Record<string, unknown>;
}

export interface OfflineSyncWorkflowResult {
	success: boolean;
	entityId?: string;
	entityIds?: string[];
	deletedCount?: number;
	error?: string;
}

// Step functions for each operation
async function queueItem(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const item = await prisma.offlineSyncQueue.create({
		data: {
			organizationId,
			technicianId: data.technicianId as string,
			entityType: data.entityType as string,
			entityId: data.entityId as string,
			action: data.action as string,
			payload: data.payload as Prisma.InputJsonValue
		}
	});

	console.log(`[OfflineSyncWorkflow] QUEUE_ITEM item:${item.id} by user ${userId}`);
	return item.id;
}

async function batchQueue(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string[]> {
	const technicianId = data.technicianId as string;
	const items = data.items as Array<{
		entityType: string;
		entityId: string;
		action: string;
		payload: Prisma.InputJsonValue;
	}>;

	const created = await prisma.$transaction(
		items.map((item) =>
			prisma.offlineSyncQueue.create({
				data: {
					organizationId,
					technicianId,
					entityType: item.entityType,
					entityId: item.entityId,
					action: item.action,
					payload: item.payload
				}
			})
		)
	);

	console.log(`[OfflineSyncWorkflow] BATCH_QUEUE ${created.length} items by user ${userId}`);
	return created.map((c) => c.id);
}

async function markSynced(
	organizationId: string,
	userId: string,
	queueItemId: string,
	data: Record<string, unknown>
): Promise<string> {
	await prisma.offlineSyncQueue.update({
		where: { id: queueItemId },
		data: {
			isSynced: true,
			syncedAt: new Date(),
			syncedId: data.syncedId as string
		}
	});

	console.log(`[OfflineSyncWorkflow] MARK_SYNCED item:${queueItemId} by user ${userId}`);
	return queueItemId;
}

async function markFailed(
	organizationId: string,
	userId: string,
	queueItemId: string,
	data: Record<string, unknown>
): Promise<string> {
	const existingAttempts = data.existingAttempts as number;

	await prisma.offlineSyncQueue.update({
		where: { id: queueItemId },
		data: {
			attempts: existingAttempts + 1,
			lastAttemptAt: new Date(),
			errorMessage: data.errorMessage as string
		}
	});

	console.log(`[OfflineSyncWorkflow] MARK_FAILED item:${queueItemId} by user ${userId}`);
	return queueItemId;
}

async function clearSynced(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<number> {
	const technicianId = data.technicianId as string;
	const cutoffDate = new Date(data.cutoffDate as string);

	const result = await prisma.offlineSyncQueue.deleteMany({
		where: {
			organizationId,
			technicianId,
			isSynced: true,
			syncedAt: { lt: cutoffDate }
		}
	});

	console.log(`[OfflineSyncWorkflow] CLEAR_SYNCED ${result.count} items by user ${userId}`);
	return result.count;
}

// Main workflow function
async function offlineSyncWorkflow(input: OfflineSyncWorkflowInput): Promise<OfflineSyncWorkflowResult> {
	try {
		let entityId: string | undefined;
		let entityIds: string[] | undefined;
		let deletedCount: number | undefined;

		switch (input.action) {
			case 'QUEUE_ITEM':
				entityId = await DBOS.runStep(
					() => queueItem(input.organizationId, input.userId, input.data),
					{ name: 'queueItem' }
				);
				break;

			case 'BATCH_QUEUE':
				entityIds = await DBOS.runStep(
					() => batchQueue(input.organizationId, input.userId, input.data),
					{ name: 'batchQueue' }
				);
				break;

			case 'MARK_SYNCED':
				entityId = await DBOS.runStep(
					() => markSynced(input.organizationId, input.userId, input.queueItemId!, input.data),
					{ name: 'markSynced' }
				);
				break;

			case 'MARK_FAILED':
				entityId = await DBOS.runStep(
					() => markFailed(input.organizationId, input.userId, input.queueItemId!, input.data),
					{ name: 'markFailed' }
				);
				break;

			case 'CLEAR_SYNCED':
				deletedCount = await DBOS.runStep(
					() => clearSynced(input.organizationId, input.userId, input.data),
					{ name: 'clearSynced' }
				);
				break;

			default:
				return { success: false, error: `Unknown action: ${input.action}` };
		}

		return { success: true, entityId, entityIds, deletedCount };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`[OfflineSyncWorkflow] Error in ${input.action}:`, errorMessage);
		return { success: false, error: errorMessage };
	}
}

export const offlineSyncWorkflow_v1 = DBOS.registerWorkflow(offlineSyncWorkflow);

export async function startOfflineSyncWorkflow(
	input: OfflineSyncWorkflowInput,
	idempotencyKey?: string
): Promise<OfflineSyncWorkflowResult> {
	const workflowId = idempotencyKey || `offline-sync-${input.action}-${input.queueItemId || 'new'}-${Date.now()}`;
	const handle = await DBOS.startWorkflow(offlineSyncWorkflow_v1, { workflowID: workflowId })(input);
	return handle.getResult();
}
