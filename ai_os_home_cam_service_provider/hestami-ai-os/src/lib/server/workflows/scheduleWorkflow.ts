/**
 * Schedule Workflow (v1)
 *
 * DBOS durable workflow for contract schedule management operations.
 * Provides idempotency, durability, and trace correlation.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import type { RecurrenceFrequency } from '../../../../generated/prisma/client.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger, logWorkflowStart, logWorkflowEnd } from './workflowLogger.js';

const WORKFLOW_STATUS_EVENT = 'schedule_status';
const WORKFLOW_ERROR_EVENT = 'schedule_error';

type ScheduleAction =
	| 'CREATE_SCHEDULE'
	| 'UPDATE_SCHEDULE'
	| 'DELETE_SCHEDULE'
	| 'GENERATE_VISITS';

interface ScheduleWorkflowInput {
	action: ScheduleAction;
	organizationId: string;
	userId: string;
	scheduleId?: string;
	contractId?: string;
	data: Record<string, unknown>;
}

interface ScheduleWorkflowResult {
	success: boolean;
	action: ScheduleAction;
	entityId?: string;
	generatedCount?: number;
	timestamp: string;
	error?: string;
}

async function createSchedule(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<{ id: string }> {
	const schedule = await prisma.contractSchedule.create({
		data: {
			contractId: data.contractId as string,
			name: data.name as string,
			description: data.description as string | undefined,
			frequency: data.frequency as RecurrenceFrequency,
			startDate: new Date(data.startDate as string),
			endDate: data.endDate ? new Date(data.endDate as string) : undefined,
			preferredDayOfWeek: data.dayOfWeek as number | undefined,
			preferredDayOfMonth: data.dayOfMonth as number | undefined,
			preferredTimeStart: data.preferredStartTime as string | undefined,
			preferredTimeEnd: data.preferredEndTime as string | undefined,
			isActive: data.isActive as boolean ?? true
		}
	});

	await recordWorkflowEvent({
		organizationId,
		entityType: 'JOB',
		entityId: schedule.id,
		action: 'CREATE',
		eventCategory: 'EXECUTION',
		summary: `Contract schedule created: ${schedule.name}`,
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'scheduleWorkflow_v1',
		workflowStep: 'CREATE_SCHEDULE',
		workflowVersion: 'v1'
	});

	return { id: schedule.id };
}

async function updateSchedule(
	organizationId: string,
	userId: string,
	scheduleId: string,
	data: Record<string, unknown>
): Promise<{ id: string }> {
	const schedule = await prisma.contractSchedule.update({
		where: { id: scheduleId },
		data: {
			name: data.name as string | undefined,
			description: data.description as string | undefined,
			frequency: data.frequency as RecurrenceFrequency | undefined,
			startDate: data.startDate ? new Date(data.startDate as string) : undefined,
			endDate: data.endDate ? new Date(data.endDate as string) : undefined,
			preferredDayOfWeek: data.dayOfWeek as number | undefined,
			preferredDayOfMonth: data.dayOfMonth as number | undefined,
			preferredTimeStart: data.preferredStartTime as string | undefined,
			preferredTimeEnd: data.preferredEndTime as string | undefined,
			isActive: data.isActive as boolean | undefined
		}
	});

	await recordWorkflowEvent({
		organizationId,
		entityType: 'JOB',
		entityId: schedule.id,
		action: 'UPDATE',
		eventCategory: 'EXECUTION',
		summary: `Contract schedule updated: ${schedule.name}`,
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'scheduleWorkflow_v1',
		workflowStep: 'UPDATE_SCHEDULE',
		workflowVersion: 'v1'
	});

	return { id: schedule.id };
}

async function deleteSchedule(
	organizationId: string,
	userId: string,
	scheduleId: string
): Promise<{ id: string }> {
	await prisma.contractSchedule.delete({
		where: { id: scheduleId }
	});

	await recordWorkflowEvent({
		organizationId,
		entityType: 'JOB',
		entityId: scheduleId,
		action: 'DELETE',
		eventCategory: 'EXECUTION',
		summary: 'Contract schedule deleted',
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'scheduleWorkflow_v1',
		workflowStep: 'DELETE_SCHEDULE',
		workflowVersion: 'v1'
	});

	return { id: scheduleId };
}

async function generateVisits(
	organizationId: string,
	userId: string,
	scheduleId: string,
	data: Record<string, unknown>
): Promise<{ id: string; count: number }> {
	const schedule = await prisma.contractSchedule.findUniqueOrThrow({
		where: { id: scheduleId }
	});

	const startDate = new Date(data.startDate as string);
	const endDate = new Date(data.endDate as string);
	const visits: { scheduledDate: Date }[] = [];

	// Generate visit dates based on frequency
	let currentDate = new Date(startDate);
	let visitNumber = (data.startingVisitNumber as number) ?? 1;

	while (currentDate <= endDate) {
		visits.push({ scheduledDate: new Date(currentDate) });

		switch (schedule.frequency) {
			case 'DAILY':
				currentDate.setDate(currentDate.getDate() + 1);
				break;
			case 'WEEKLY':
				currentDate.setDate(currentDate.getDate() + 7);
				break;
			case 'BIWEEKLY':
				currentDate.setDate(currentDate.getDate() + 14);
				break;
			case 'MONTHLY':
				currentDate.setMonth(currentDate.getMonth() + 1);
				break;
			case 'QUARTERLY':
				currentDate.setMonth(currentDate.getMonth() + 3);
				break;
			case 'ANNUAL':
				currentDate.setFullYear(currentDate.getFullYear() + 1);
				break;
			case 'SEMI_ANNUAL':
				currentDate.setMonth(currentDate.getMonth() + 6);
				break;
			default:
				currentDate.setMonth(currentDate.getMonth() + 1);
		}
	}

	// Create visits in batch
	const createdVisits = await prisma.$transaction(
		visits.map((v, idx) =>
			prisma.scheduledVisit.create({
				data: {
					contractId: schedule.contractId,
					scheduleId: schedule.id,
					visitNumber: visitNumber + idx,
					scheduledDate: v.scheduledDate,
					status: 'SCHEDULED'
				}
			})
		)
	);

	await recordWorkflowEvent({
		organizationId,
		entityType: 'JOB',
		entityId: schedule.id,
		action: 'CREATE',
		eventCategory: 'EXECUTION',
		summary: `Generated ${createdVisits.length} visits for schedule`,
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'scheduleWorkflow_v1',
		workflowStep: 'GENERATE_VISITS',
		workflowVersion: 'v1'
	});

	return { id: schedule.id, count: createdVisits.length };
}

async function scheduleWorkflow(input: ScheduleWorkflowInput): Promise<ScheduleWorkflowResult> {
	const log = createWorkflowLogger('scheduleWorkflow', DBOS.workflowID, input.action);
	const startTime = logWorkflowStart(log, input.action, input as any);

	try {
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'started', action: input.action });

		let entityId: string | undefined;
		let generatedCount: number | undefined;

		switch (input.action) {
			case 'CREATE_SCHEDULE': {
				const result = await DBOS.runStep(
					() => createSchedule(input.organizationId, input.userId, input.data),
					{ name: 'createSchedule' }
				);
				entityId = result.id;
				break;
			}
			case 'UPDATE_SCHEDULE': {
				if (!input.scheduleId) throw new Error('scheduleId required for UPDATE_SCHEDULE');
				const result = await DBOS.runStep(
					() => updateSchedule(input.organizationId, input.userId, input.scheduleId!, input.data),
					{ name: 'updateSchedule' }
				);
				entityId = result.id;
				break;
			}
			case 'DELETE_SCHEDULE': {
				if (!input.scheduleId) throw new Error('scheduleId required for DELETE_SCHEDULE');
				const result = await DBOS.runStep(
					() => deleteSchedule(input.organizationId, input.userId, input.scheduleId!),
					{ name: 'deleteSchedule' }
				);
				entityId = result.id;
				break;
			}
			case 'GENERATE_VISITS': {
				if (!input.scheduleId) throw new Error('scheduleId required for GENERATE_VISITS');
				const result = await DBOS.runStep(
					() => generateVisits(input.organizationId, input.userId, input.scheduleId!, input.data),
					{ name: 'generateVisits' }
				);
				entityId = result.id;
				generatedCount = result.count;
				break;
			}
			default:
				const errorResult = {
					success: false,
					action: input.action,
					timestamp: new Date().toISOString(),
					error: `Unknown action: ${input.action}`
				};
				logWorkflowEnd(log, input.action, false, startTime, errorResult as any);
				return errorResult;
		}

		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'completed', entityId, generatedCount });

		const successResult = {
			success: true,
			action: input.action,
			entityId,
			generatedCount,
			timestamp: new Date().toISOString()
		};
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
			errorType: 'SCHEDULE_WORKFLOW_ERROR'
		});

		const errorResult = {
			success: false,
			action: input.action,
			timestamp: new Date().toISOString(),
			error: errorMessage
		};
		logWorkflowEnd(log, input.action, false, startTime, errorResult as any);
		return errorResult;
	}
}

export const scheduleWorkflow_v1 = DBOS.registerWorkflow(scheduleWorkflow);

export async function startScheduleWorkflow(
	input: ScheduleWorkflowInput,
	workflowId: string
): Promise<ScheduleWorkflowResult> {
	const handle = await DBOS.startWorkflow(scheduleWorkflow_v1, {
		workflowID: workflowId
	})(input);

	return handle.getResult();
}

export type { ScheduleWorkflowInput, ScheduleWorkflowResult, ScheduleAction };
