/**
 * Report Schedule Workflow (v1)
 *
 * DBOS durable workflow for managing report schedule operations.
 * Handles: create, update, delete, runNow.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import { orgTransaction } from '../db/rls.js';
import type { ReportFormat, ReportDeliveryMethod } from '../../../../generated/prisma/client.js';
import {
	ScheduleFrequency,
	ActivityActionType
} from '../../../../generated/prisma/enums.js';
import { type EntityWorkflowResult } from './schemas.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger } from './workflowLogger.js';

// Workflow error types for tracing
const WorkflowErrorType = {
	REPORT_SCHEDULE_WORKFLOW_ERROR: 'REPORT_SCHEDULE_WORKFLOW_ERROR'
} as const;

const log = createWorkflowLogger('ReportScheduleWorkflow');

// Action types for the unified workflow
export const ReportScheduleAction = {
	CREATE_SCHEDULE: 'CREATE_SCHEDULE',
	UPDATE_SCHEDULE: 'UPDATE_SCHEDULE',
	DELETE_SCHEDULE: 'DELETE_SCHEDULE',
	RUN_NOW: 'RUN_NOW'
} as const;

export type ReportScheduleAction = (typeof ReportScheduleAction)[keyof typeof ReportScheduleAction];

export interface ReportScheduleWorkflowInput {
	action: ReportScheduleAction;
	organizationId: string;
	userId: string;
	associationId: string;
	scheduleId?: string;
	data: Record<string, unknown>;
}

export interface ReportScheduleWorkflowResult extends EntityWorkflowResult {
	// Inherits success, error, entityId from EntityWorkflowResult
}

// Calculate next run date based on frequency
const calculateNextRun = (frequency: string, cronExpression?: string | null): Date => {
	const now = new Date();
	switch (frequency) {
		case ScheduleFrequency.DAILY:
			return new Date(now.getTime() + 24 * 60 * 60 * 1000);
		case ScheduleFrequency.WEEKLY:
			return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
		case ScheduleFrequency.BIWEEKLY:
			return new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
		case ScheduleFrequency.MONTHLY: {
			const nextMonth = new Date(now);
			nextMonth.setMonth(nextMonth.getMonth() + 1);
			return nextMonth;
		}
		case ScheduleFrequency.QUARTERLY: {
			const nextQuarter = new Date(now);
			nextQuarter.setMonth(nextQuarter.getMonth() + 3);
			return nextQuarter;
		}
		case ScheduleFrequency.ANNUALLY: {
			const nextYear = new Date(now);
			nextYear.setFullYear(nextYear.getFullYear() + 1);
			return nextYear;
		}
		default:
			return new Date(now.getTime() + 24 * 60 * 60 * 1000);
	}
};

// Step functions for each operation
async function createSchedule(
	organizationId: string,
	userId: string,
	associationId: string,
	data: Record<string, unknown>
): Promise<string> {
	const reportId = data.reportId as string;

	// Verify report exists (read operation - no RLS transaction needed)
	const report = await prisma.reportDefinition.findFirst({
		where: {
			id: reportId,
			isActive: true,
			OR: [
				{ associationId },
				{ isSystemReport: true, associationId: null }
			]
		}
	});

	if (!report) throw new Error('Report definition not found');

	const frequency = data.frequency as string;
	const cronExpression = data.cronExpression as string | undefined;
	const format = (data.format as string) || report.defaultFormat;
	const nextRunAt = calculateNextRun(frequency, cronExpression);

	const schedule = await orgTransaction(organizationId, async (tx) => {
		return tx.reportSchedule.create({
			data: {
				reportId,
				associationId,
				name: data.name as string,
				frequency: frequency as ScheduleFrequency,
				cronExpression,
				parametersJson: data.parametersJson as string | undefined,
				format: format as ReportFormat,
				deliveryMethod: (data.deliveryMethod as ReportDeliveryMethod) || 'EMAIL',
				recipientsJson: data.recipientsJson as string | undefined,
				nextRunAt,
				createdBy: userId
			}
		});
	}, { userId, reason: 'Create report schedule' });

	log.info(`CREATE_SCHEDULE schedule:${schedule.id} by user ${userId}`);
	return schedule.id;
}

async function updateSchedule(
	organizationId: string,
	userId: string,
	associationId: string,
	scheduleId: string,
	data: Record<string, unknown>
): Promise<string> {
	const existing = await prisma.reportSchedule.findFirst({
		where: { id: scheduleId, associationId }
	});
	if (!existing) throw new Error('Report schedule not found');

	// Recalculate next run if frequency changed
	let nextRunAt = existing.nextRunAt;
	const frequency = data.frequency as string | undefined;
	if (frequency && frequency !== existing.frequency) {
		nextRunAt = calculateNextRun(frequency, data.cronExpression as string | undefined);
	}

	await orgTransaction(organizationId, async (tx) => {
		return tx.reportSchedule.update({
			where: { id: scheduleId },
			data: {
				name: data.name as string | undefined,
				frequency: frequency as ScheduleFrequency | undefined,
				cronExpression: data.cronExpression as string | undefined,
				parametersJson: data.parametersJson as string | undefined,
				format: data.format as ReportFormat | undefined,
				deliveryMethod: data.deliveryMethod as ReportDeliveryMethod | undefined,
				recipientsJson: data.recipientsJson as string | null | undefined,
				isActive: data.isActive as boolean | undefined,
				nextRunAt
			}
		});
	}, { userId, reason: 'Update report schedule' });

	log.info(`UPDATE_SCHEDULE schedule:${scheduleId} by user ${userId}`);
	return scheduleId;
}

async function deleteSchedule(
	organizationId: string,
	userId: string,
	associationId: string,
	scheduleId: string
): Promise<string> {
	const existing = await prisma.reportSchedule.findFirst({
		where: { id: scheduleId, associationId }
	});
	if (!existing) throw new Error('Report schedule not found');

	await orgTransaction(organizationId, async (tx) => {
		return tx.reportSchedule.delete({ where: { id: scheduleId } });
	}, { userId, reason: 'Delete report schedule' });

	log.info(`DELETE_SCHEDULE schedule:${scheduleId} by user ${userId}`);
	return scheduleId;
}

async function runNow(
	organizationId: string,
	userId: string,
	associationId: string,
	scheduleId: string
): Promise<string> {
	const schedule = await prisma.reportSchedule.findFirst({
		where: { id: scheduleId, associationId }
	});
	if (!schedule) throw new Error('Report schedule not found');

	// Create execution from schedule and update schedule last run in a single transaction
	const execution = await orgTransaction(organizationId, async (tx) => {
		const exec = await tx.reportExecution.create({
			data: {
				reportId: schedule.reportId,
				scheduleId: schedule.id,
				associationId,
				status: 'PENDING',
				parametersJson: schedule.parametersJson,
				format: schedule.format,
				executedBy: userId
			}
		});

		// Update schedule last run
		await tx.reportSchedule.update({
			where: { id: scheduleId },
			data: {
				lastRunAt: new Date(),
				nextRunAt: calculateNextRun(schedule.frequency, schedule.cronExpression)
			}
		});

		return exec;
	}, { userId, reason: 'Run report schedule now' });

	log.info(`RUN_NOW schedule:${scheduleId} execution:${execution.id} by user ${userId}`);
	return execution.id;
}

// Main workflow function
async function reportScheduleWorkflow(input: ReportScheduleWorkflowInput): Promise<ReportScheduleWorkflowResult> {
	try {
		let entityId: string | undefined;

		switch (input.action) {
			case ReportScheduleAction.CREATE_SCHEDULE:
				entityId = await DBOS.runStep(
					() => createSchedule(input.organizationId, input.userId, input.associationId, input.data),
					{ name: 'createSchedule' }
				);
				break;

			case ReportScheduleAction.UPDATE_SCHEDULE:
				entityId = await DBOS.runStep(
					() => updateSchedule(input.organizationId, input.userId, input.associationId, input.scheduleId!, input.data),
					{ name: 'updateSchedule' }
				);
				break;

			case ReportScheduleAction.DELETE_SCHEDULE:
				entityId = await DBOS.runStep(
					() => deleteSchedule(input.organizationId, input.userId, input.associationId, input.scheduleId!),
					{ name: 'deleteSchedule' }
				);
				break;

			case ReportScheduleAction.RUN_NOW:
				entityId = await DBOS.runStep(
					() => runNow(input.organizationId, input.userId, input.associationId, input.scheduleId!),
					{ name: 'runNow' }
				);
				break;

			default:
				return { success: false, error: `Unknown action: ${input.action}` };
		}

		return { success: true, entityId };
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;
		log.error(`Error in ${input.action}: ${errorMessage}`);

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: ActivityActionType.WORKFLOW_FAILED,
			errorType: WorkflowErrorType.REPORT_SCHEDULE_WORKFLOW_ERROR
		});

		return { success: false, error: errorMessage };
	}
}

export const reportScheduleWorkflow_v1 = DBOS.registerWorkflow(reportScheduleWorkflow);

export async function startReportScheduleWorkflow(
	input: ReportScheduleWorkflowInput,
	idempotencyKey: string
): Promise<ReportScheduleWorkflowResult> {
	const workflowId = idempotencyKey || `report-schedule-${input.action}-${input.scheduleId || 'new'}-${Date.now()}`;
	const handle = await DBOS.startWorkflow(reportScheduleWorkflow_v1, { workflowID: idempotencyKey})(input);
	return handle.getResult();
}
