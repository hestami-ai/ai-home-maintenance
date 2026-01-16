/**
 * SLA Workflow (v1)
 *
 * DBOS durable workflow for SLA window and record management.
 * Provides idempotency, durability, and trace correlation.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { orgTransaction } from '../db/rls.js';
import { type SLAPriority } from '../../../../generated/prisma/client.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger } from './workflowLogger.js';

const WORKFLOW_STATUS_EVENT = 'sla_status';
const WORKFLOW_ERROR_EVENT = 'sla_error';
const workflowName = 'SLAWorkflow';
const log = createWorkflowLogger(workflowName);

type SLAAction =
	| 'CREATE_WINDOW'
	| 'UPDATE_WINDOW'
	| 'DELETE_WINDOW'
	| 'CREATE_RECORD'
	| 'MARK_RESPONSE'
	| 'MARK_RESOLUTION';

interface SLAWorkflowInput {
	action: SLAAction;
	organizationId: string;
	userId: string;
	windowId?: string;
	recordId?: string;
	data: Record<string, unknown>;
}

interface SLAWorkflowResult {
	success: boolean;
	action: SLAAction;
	entityId?: string;
	timestamp: string;
	error?: string;
}

async function createWindow(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<{ id: string }> {
	const window = await orgTransaction(organizationId, async (tx) => {
		return tx.sLAWindow.create({
			data: {
				organizationId,
				name: data.name as string,
				priority: data.priority as SLAPriority,
				responseTimeMinutes: data.responseMinutes as number,
				resolutionTimeMinutes: data.resolutionMinutes as number,
				businessHoursOnly: data.businessHoursOnly as boolean ?? true,
				isDefault: data.isDefault as boolean ?? false
			}
		});
	}, { userId, reason: 'SLA workflow: create window' });

	log.info('SLA window created', { windowId: window.id, windowName: window.name });

	await recordWorkflowEvent({
		organizationId,
		entityType: 'JOB',
		entityId: window.id,
		action: 'CREATE',
		eventCategory: 'EXECUTION',
		summary: `SLA window created: ${window.name}`,
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'slaWorkflow_v1',
		workflowStep: 'CREATE_WINDOW',
		workflowVersion: 'v1'
	});

	return { id: window.id };
}

async function updateWindow(
	organizationId: string,
	userId: string,
	windowId: string,
	data: Record<string, unknown>
): Promise<{ id: string }> {
	const window = await orgTransaction(organizationId, async (tx) => {
		return tx.sLAWindow.update({
			where: { id: windowId },
			data: {
				name: data.name as string | undefined,
				priority: data.priority as SLAPriority | undefined,
				responseTimeMinutes: data.responseTimeMinutes as number | undefined,
				resolutionTimeMinutes: data.resolutionTimeMinutes as number | undefined,
				businessHoursOnly: data.businessHoursOnly as boolean | undefined,
				isDefault: data.isDefault as boolean | undefined
			}
		});
	}, { userId, reason: 'SLA workflow: update window' });

	log.info('SLA window updated', { windowId: window.id, windowName: window.name });

	await recordWorkflowEvent({
		organizationId,
		entityType: 'JOB',
		entityId: window.id,
		action: 'UPDATE',
		eventCategory: 'EXECUTION',
		summary: `SLA window updated: ${window.name}`,
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'slaWorkflow_v1',
		workflowStep: 'UPDATE_WINDOW',
		workflowVersion: 'v1'
	});

	return { id: window.id };
}

async function deleteWindow(
	organizationId: string,
	userId: string,
	windowId: string
): Promise<{ id: string }> {
	await orgTransaction(organizationId, async (tx) => {
		return tx.sLAWindow.delete({ where: { id: windowId } });
	}, { userId, reason: 'SLA workflow: delete window' });

	log.info('SLA window deleted', { windowId });

	await recordWorkflowEvent({
		organizationId,
		entityType: 'JOB',
		entityId: windowId,
		action: 'DELETE',
		eventCategory: 'EXECUTION',
		summary: 'SLA window deleted',
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'slaWorkflow_v1',
		workflowStep: 'DELETE_WINDOW',
		workflowVersion: 'v1'
	});

	return { id: windowId };
}

async function createRecord(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<{ id: string }> {
	const record = await orgTransaction(organizationId, async (tx) => {
		return tx.sLARecord.create({
			data: {
				organizationId,
				jobId: data.jobId as string,
				slaWindowId: data.slaWindowId as string,
				responseDue: new Date(data.responseDue as string),
				resolutionDue: new Date(data.resolutionDue as string),
				notes: data.notes as string | undefined
			}
		});
	}, { userId, reason: 'SLA workflow: create record' });

	log.info('SLA record created', { recordId: record.id, jobId: data.jobId });

	await recordWorkflowEvent({
		organizationId,
		entityType: 'JOB',
		entityId: record.id,
		action: 'CREATE',
		eventCategory: 'EXECUTION',
		summary: 'SLA tracking started',
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'slaWorkflow_v1',
		workflowStep: 'CREATE_RECORD',
		workflowVersion: 'v1',
		jobId: data.jobId as string
	});

	return { id: record.id };
}

async function markResponse(
	organizationId: string,
	userId: string,
	recordId: string
): Promise<{ id: string }> {
	const record = await orgTransaction(organizationId, async (tx) => {
		return tx.sLARecord.update({
			where: { id: recordId },
			data: { respondedAt: new Date() }
		});
	}, { userId, reason: 'SLA workflow: mark response' });

	log.info('SLA response marked', { recordId: record.id });

	await recordWorkflowEvent({
		organizationId,
		entityType: 'JOB',
		entityId: record.id,
		action: 'UPDATE',
		eventCategory: 'EXECUTION',
		summary: 'SLA response marked',
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'slaWorkflow_v1',
		workflowStep: 'MARK_RESPONSE',
		workflowVersion: 'v1'
	});

	return { id: record.id };
}

async function markResolution(
	organizationId: string,
	userId: string,
	recordId: string
): Promise<{ id: string }> {
	const record = await orgTransaction(organizationId, async (tx) => {
		return tx.sLARecord.update({
			where: { id: recordId },
			data: { resolvedAt: new Date() }
		});
	}, { userId, reason: 'SLA workflow: mark resolution' });

	log.info('SLA resolution marked', { recordId: record.id });

	await recordWorkflowEvent({
		organizationId,
		entityType: 'JOB',
		entityId: record.id,
		action: 'UPDATE',
		eventCategory: 'EXECUTION',
		summary: 'SLA resolution marked',
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'slaWorkflow_v1',
		workflowStep: 'MARK_RESOLUTION',
		workflowVersion: 'v1'
	});

	return { id: record.id };
}

async function slaWorkflow(input: SLAWorkflowInput): Promise<SLAWorkflowResult> {
	try {
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'started', action: input.action });

		let entityId: string | undefined;

		switch (input.action) {
			case 'CREATE_WINDOW': {
				const result = await DBOS.runStep(
					() => createWindow(input.organizationId, input.userId, input.data),
					{ name: 'createWindow' }
				);
				entityId = result.id;
				break;
			}
			case 'UPDATE_WINDOW': {
				if (!input.windowId) throw new Error('windowId required for UPDATE_WINDOW');
				const result = await DBOS.runStep(
					() => updateWindow(input.organizationId, input.userId, input.windowId!, input.data),
					{ name: 'updateWindow' }
				);
				entityId = result.id;
				break;
			}
			case 'DELETE_WINDOW': {
				if (!input.windowId) throw new Error('windowId required for DELETE_WINDOW');
				const result = await DBOS.runStep(
					() => deleteWindow(input.organizationId, input.userId, input.windowId!),
					{ name: 'deleteWindow' }
				);
				entityId = result.id;
				break;
			}
			case 'CREATE_RECORD': {
				const result = await DBOS.runStep(
					() => createRecord(input.organizationId, input.userId, input.data),
					{ name: 'createRecord' }
				);
				entityId = result.id;
				break;
			}
			case 'MARK_RESPONSE': {
				if (!input.recordId) throw new Error('recordId required for MARK_RESPONSE');
				const result = await DBOS.runStep(
					() => markResponse(input.organizationId, input.userId, input.recordId!),
					{ name: 'markResponse' }
				);
				entityId = result.id;
				break;
			}
			case 'MARK_RESOLUTION': {
				if (!input.recordId) throw new Error('recordId required for MARK_RESOLUTION');
				const result = await DBOS.runStep(
					() => markResolution(input.organizationId, input.userId, input.recordId!),
					{ name: 'markResolution' }
				);
				entityId = result.id;
				break;
			}
			default:
				throw new Error(`Unknown action: ${input.action}`);
		}

		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'completed', entityId });

		return {
			success: true,
			action: input.action,
			entityId,
			timestamp: new Date().toISOString()
		};
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;
		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'SLA_WORKFLOW_ERROR'
		});

		return {
			success: false,
			action: input.action,
			timestamp: new Date().toISOString(),
			error: errorMessage
		};
	}
}

export const slaWorkflow_v1 = DBOS.registerWorkflow(slaWorkflow);

export async function startSLAWorkflow(
	input: SLAWorkflowInput,
	idempotencyKey: string
): Promise<SLAWorkflowResult> {
	const handle = await DBOS.startWorkflow(slaWorkflow_v1, {
		workflowID: idempotencyKey})(input);

	return handle.getResult();
}

export type { SLAWorkflowInput, SLAWorkflowResult, SLAAction };
