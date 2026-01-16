/**
 * Time Entry Workflow (v1)
 *
 * DBOS durable workflow for managing field tech time entry operations.
 * Handles: create, stop, update, delete.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { recordSpanError } from '../api/middleware/tracing.js';
import { type EntityWorkflowResult } from './schemas.js';
import { orgTransaction } from '../db/rls.js';
import { createWorkflowLogger } from './workflowLogger.js';

const log = createWorkflowLogger('TimeEntryWorkflow');

// Action types for the unified workflow
export const TimeEntryAction = {
	CREATE_ENTRY: 'CREATE_ENTRY',
	STOP_ENTRY: 'STOP_ENTRY',
	UPDATE_ENTRY: 'UPDATE_ENTRY',
	DELETE_ENTRY: 'DELETE_ENTRY'
} as const;

export type TimeEntryAction = (typeof TimeEntryAction)[keyof typeof TimeEntryAction];

export interface TimeEntryWorkflowInput {
	action: TimeEntryAction;
	organizationId: string;
	userId: string;
	entryId?: string;
	data: Record<string, unknown>;
}

export interface TimeEntryWorkflowResult extends EntityWorkflowResult {
	// Inherits success, error, entityId from EntityWorkflowResult
}

// Step functions for each operation
async function createEntry(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const jobId = data.jobId as string;
	const jobVisitId = data.jobVisitId as string | undefined;
	const technicianId = data.technicianId as string;
	const startTime = data.startTime as string | undefined;
	const entryType = data.entryType as string;
	const notes = data.notes as string | undefined;
	const isBillable = data.isBillable as boolean | undefined;
	const hourlyRate = data.hourlyRate as number | undefined;
	const localId = data.localId as string | undefined;

	const entry = await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.jobTimeEntry.create({
				data: {
					organizationId,
					jobId,
					jobVisitId,
					technicianId,
					startTime: startTime ? new Date(startTime) : new Date(),
					entryType: entryType as 'TRAVEL' | 'WORK' | 'BREAK',
					notes,
					isBillable,
					hourlyRate,
					localId,
					isSynced: !localId,
					syncedAt: localId ? new Date() : null
				}
			});
		},
		{ userId, reason: 'Creating time entry' }
	);

	log.info('CREATE_ENTRY completed', { entryId: entry.id, userId });
	return entry.id;
}

async function stopEntry(
	organizationId: string,
	userId: string,
	entryId: string,
	data: Record<string, unknown>
): Promise<string> {
	const endTime = data.endTime as string;
	const durationMinutes = data.durationMinutes as number;
	const notes = data.notes as string | undefined;

	await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.jobTimeEntry.update({
				where: { id: entryId },
				data: {
					endTime: new Date(endTime),
					durationMinutes,
					notes: notes !== undefined ? notes : undefined
				}
			});
		},
		{ userId, reason: 'Stopping time entry' }
	);

	log.info('STOP_ENTRY completed', { entryId, userId });
	return entryId;
}

async function updateEntry(
	organizationId: string,
	userId: string,
	entryId: string,
	data: Record<string, unknown>
): Promise<string> {
	const { id, idempotencyKey, ...updateData } = data;

	// Convert date strings to Date objects if present
	if (updateData.startTime) {
		updateData.startTime = new Date(updateData.startTime as string);
	}
	if (updateData.endTime) {
		updateData.endTime = new Date(updateData.endTime as string);
	}

	await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.jobTimeEntry.update({
				where: { id: entryId },
				data: updateData
			});
		},
		{ userId, reason: 'Updating time entry' }
	);

	log.info('UPDATE_ENTRY completed', { entryId, userId });
	return entryId;
}

async function deleteEntry(
	organizationId: string,
	userId: string,
	entryId: string
): Promise<string> {
	await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.jobTimeEntry.delete({ where: { id: entryId } });
		},
		{ userId, reason: 'Deleting time entry' }
	);

	log.info('DELETE_ENTRY completed', { entryId, userId });
	return entryId;
}

// Main workflow function
async function timeEntryWorkflow(input: TimeEntryWorkflowInput): Promise<TimeEntryWorkflowResult> {
	try {
		let entityId: string | undefined;

		switch (input.action) {
			case 'CREATE_ENTRY':
				entityId = await DBOS.runStep(
					() => createEntry(input.organizationId, input.userId, input.data),
					{ name: 'createEntry' }
				);
				break;

			case 'STOP_ENTRY':
				entityId = await DBOS.runStep(
					() => stopEntry(input.organizationId, input.userId, input.entryId!, input.data),
					{ name: 'stopEntry' }
				);
				break;

			case 'UPDATE_ENTRY':
				entityId = await DBOS.runStep(
					() => updateEntry(input.organizationId, input.userId, input.entryId!, input.data),
					{ name: 'updateEntry' }
				);
				break;

			case 'DELETE_ENTRY':
				entityId = await DBOS.runStep(
					() => deleteEntry(input.organizationId, input.userId, input.entryId!),
					{ name: 'deleteEntry' }
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
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'TIME_ENTRY_WORKFLOW_ERROR'
		});

		return { success: false, error: errorMessage };
	}
}

export const timeEntryWorkflow_v1 = DBOS.registerWorkflow(timeEntryWorkflow);

export async function startTimeEntryWorkflow(
	input: TimeEntryWorkflowInput,
	idempotencyKey: string
): Promise<TimeEntryWorkflowResult> {
	const workflowId = idempotencyKey || `time-entry-${input.action}-${input.entryId || 'new'}-${Date.now()}`;
	const handle = await DBOS.startWorkflow(timeEntryWorkflow_v1, { workflowID: idempotencyKey})(input);
	return handle.getResult();
}
