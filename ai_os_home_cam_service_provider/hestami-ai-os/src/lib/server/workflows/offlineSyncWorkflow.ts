/**
 * Offline Sync Workflow (v1)
 *
 * DBOS durable workflow for managing offline sync queue operations.
 * Handles: queue, batchQueue, markSynced, markFailed, clearSynced.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import type { Prisma } from '../../../../generated/prisma/client.js';
import { type EntityWorkflowResult } from './schemas.js';
import { createWorkflowLogger, logWorkflowStart, logWorkflowEnd } from './workflowLogger.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';
import { recordSpanError } from '../api/middleware/tracing.js';

// Action types for the unified workflow
export const OfflineSyncAction = {
	QUEUE_ITEM: 'QUEUE_ITEM',
	BATCH_QUEUE: 'BATCH_QUEUE',
	MARK_SYNCED: 'MARK_SYNCED',
	MARK_FAILED: 'MARK_FAILED',
	CLEAR_SYNCED: 'CLEAR_SYNCED'
} as const;

export type OfflineSyncAction = (typeof OfflineSyncAction)[keyof typeof OfflineSyncAction];

const WORKFLOW_STATUS_EVENT = 'sync_status';
const WORKFLOW_ERROR_EVENT = 'sync_error';

export interface OfflineSyncWorkflowInput {
	action: OfflineSyncAction;
	organizationId: string;
	userId: string;
	queueItemId?: string;
	data: Record<string, unknown>;
}

export interface OfflineSyncWorkflowResult extends EntityWorkflowResult {
	entityIds?: string[];
	deletedCount?: number;
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

	return result.count;
}

// Main workflow function
async function offlineSyncWorkflow(input: OfflineSyncWorkflowInput): Promise<OfflineSyncWorkflowResult> {
	const log = createWorkflowLogger('offlineSyncWorkflow', DBOS.workflowID, input.action);
	const startTime = logWorkflowStart(log, input.action, input as any);

	try {
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'started', action: input.action });

		let entityId: string | undefined;
		let entityIds: string[] | undefined;
		let deletedCount: number | undefined;

		switch (input.action) {
			case 'QUEUE_ITEM':
				entityId = await DBOS.runStep(
					() => queueItem(input.organizationId, input.userId, input.data),
					{ name: 'queueItem' }
				);
				await recordWorkflowEvent({
					organizationId: input.organizationId,
					entityType: 'OTHER', // Offline sync queue items
					entityId: entityId,
					action: 'CREATE',
					eventCategory: 'SYSTEM',
					summary: `Queued offline item for ${(input.data.entityType as string) || 'unknown'}`,
					performedById: input.userId,
					performedByType: 'HUMAN',
					workflowId: 'offlineSyncWorkflow_v1',
					workflowStep: 'QUEUE_ITEM',
					workflowVersion: 'v1'
				});
				break;

			case 'BATCH_QUEUE':
				entityIds = await DBOS.runStep(
					() => batchQueue(input.organizationId, input.userId, input.data),
					{ name: 'batchQueue' }
				);
				await recordWorkflowEvent({
					organizationId: input.organizationId,
					entityType: 'OTHER',
					entityId: input.userId, // Using user ID as proxy for batch
					action: 'CREATE',
					eventCategory: 'SYSTEM',
					summary: `Queued ${entityIds.length} offline items`,
					performedById: input.userId,
					performedByType: 'HUMAN',
					workflowId: 'offlineSyncWorkflow_v1',
					workflowStep: 'BATCH_QUEUE',
					workflowVersion: 'v1'
				});
				break;

			case 'MARK_SYNCED':
				entityId = await DBOS.runStep(
					() => markSynced(input.organizationId, input.userId, input.queueItemId!, input.data),
					{ name: 'markSynced' }
				);
				// We might not want to audit every sync mark to avoid noise, 
				// but let's do it for consistency and traceability.
				await recordWorkflowEvent({
					organizationId: input.organizationId,
					entityType: 'OTHER',
					entityId: entityId,
					action: 'UPDATE',
					eventCategory: 'SYSTEM',
					summary: 'Offline item marked as synced',
					performedById: input.userId,
					performedByType: 'SYSTEM',
					workflowId: 'offlineSyncWorkflow_v1',
					workflowStep: 'MARK_SYNCED',
					workflowVersion: 'v1'
				});
				break;

			case 'MARK_FAILED':
				entityId = await DBOS.runStep(
					() => markFailed(input.organizationId, input.userId, input.queueItemId!, input.data),
					{ name: 'markFailed' }
				);
				await recordWorkflowEvent({
					organizationId: input.organizationId,
					entityType: 'OTHER',
					entityId: entityId,
					action: 'UPDATE',
					eventCategory: 'SYSTEM',
					summary: `Offline item sync failed: ${input.data.errorMessage}`,
					performedById: input.userId,
					performedByType: 'SYSTEM',
					workflowId: 'offlineSyncWorkflow_v1',
					workflowStep: 'MARK_FAILED',
					workflowVersion: 'v1'
				});
				break;

			case 'CLEAR_SYNCED':
				deletedCount = await DBOS.runStep(
					() => clearSynced(input.organizationId, input.userId, input.data),
					{ name: 'clearSynced' }
				);
				await recordWorkflowEvent({
					organizationId: input.organizationId,
					entityType: 'OTHER',
					entityId: input.organizationId, // Organization level action
					action: 'DELETE',
					eventCategory: 'SYSTEM',
					summary: `Cleared ${deletedCount} synced items`,
					performedById: input.userId,
					performedByType: 'SYSTEM',
					workflowId: 'offlineSyncWorkflow_v1',
					workflowStep: 'CLEAR_SYNCED',
					workflowVersion: 'v1'
				});
				break;

			default:
				const errorResult = { success: false, error: `Unknown action: ${input.action}` };
				logWorkflowEnd(log, input.action, false, startTime, errorResult as any);
				return errorResult;
		}

		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'completed', entityId, count: deletedCount || entityIds?.length });

		const successResult = { success: true, entityId, entityIds, deletedCount };
		logWorkflowEnd(log, input.action, true, startTime, successResult as any);
		return successResult;

	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;
		log.error('Workflow failed', { action: input.action, error: errorMessage });
		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'OFFLINE_SYNC_WORKFLOW_ERROR'
		});

		const errorResult = { success: false, error: errorMessage };
		logWorkflowEnd(log, input.action, false, startTime, errorResult as any);
		return errorResult;
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
