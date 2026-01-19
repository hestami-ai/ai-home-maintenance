/**
 * Report Execution Workflow (v1)
 *
 * DBOS durable workflow for managing report execution operations.
 * Handles: generate, cancel.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import { orgTransaction } from '../db/rls.js';
import type { ReportFormat } from '../../../../generated/prisma/client.js';
import { type EntityWorkflowResult } from './schemas.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger } from './workflowLogger.js';
import { ActivityActionType, ReportExecutionStatus } from '../../../../generated/prisma/enums.js';

// Workflow error types for tracing
const WorkflowErrorType = {
	REPORT_EXECUTION_WORKFLOW_ERROR: 'REPORT_EXECUTION_WORKFLOW_ERROR'
} as const;

const log = createWorkflowLogger('ReportExecutionWorkflow');

// Action types for the unified workflow
export const ReportExecutionAction = {
	GENERATE_REPORT: 'GENERATE_REPORT',
	CANCEL_EXECUTION: 'CANCEL_EXECUTION'
} as const;

export type ReportExecutionAction = (typeof ReportExecutionAction)[keyof typeof ReportExecutionAction];

export interface ReportExecutionWorkflowInput {
	action: ReportExecutionAction;
	organizationId: string;
	userId: string;
	associationId: string;
	executionId?: string;
	data: Record<string, unknown>;
}

export interface ReportExecutionWorkflowResult extends EntityWorkflowResult {
	// Inherits success, error, entityId from EntityWorkflowResult
}

// Step functions for each operation
async function generateReport(
	organizationId: string,
	userId: string,
	associationId: string,
	data: Record<string, unknown>
): Promise<string> {
	const reportId = data.reportId as string;

	// Verify report exists and is accessible
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

	const format = (data.format as ReportFormat) || report.defaultFormat;
	if (!report.allowedFormats.includes(format as ReportFormat)) {
		throw new Error(`Format ${format} is not allowed for this report`);
	}

	// Create execution record and update status within RLS-protected transaction
	const execution = await orgTransaction(organizationId, async (tx) => {
		const exec = await tx.reportExecution.create({
			data: {
				reportId,
				associationId,
				status: 'PENDING',
				parametersJson: data.parametersJson as string | undefined,
				format: format as ReportFormat,
				executedBy: userId
			}
		});

		// In a full implementation, this would trigger async report generation
		// For now, we'll simulate immediate completion with stub data
		await tx.reportExecution.update({
			where: { id: exec.id },
			data: {
				status: 'RUNNING',
				startedAt: new Date()
			}
		});

		return exec;
	}, { userId, reason: 'Generate report execution' });

	// Stub: Mark as completed (real implementation would be async)
	// Note: This async update also needs RLS protection
	setTimeout(async () => {
		try {
			await orgTransaction(organizationId, async (tx) => {
				await tx.reportExecution.update({
					where: { id: execution.id },
					data: {
						status: 'COMPLETED',
						completedAt: new Date(),
						outputUrl: `/reports/${execution.id}.${format.toLowerCase()}`,
						rowCount: 0
					}
				});
			}, { userId, reason: 'Complete report execution (stub)' });
		} catch {
			// Ignore errors in stub
		}
	}, 1000);

	log.info(`GENERATE_REPORT execution:${execution.id} by user ${userId}`);
	return execution.id;
}

async function cancelExecution(
	organizationId: string,
	userId: string,
	associationId: string,
	executionId: string
): Promise<string> {
	const execution = await prisma.reportExecution.findFirst({
		where: { id: executionId, associationId }
	});

	if (!execution) throw new Error('Report execution not found');
	if (!([ReportExecutionStatus.PENDING, ReportExecutionStatus.RUNNING] as ReportExecutionStatus[]).includes(execution.status)) {
		throw new Error('Can only cancel pending or running executions');
	}

	await orgTransaction(organizationId, async (tx) => {
		await tx.reportExecution.update({
			where: { id: executionId },
			data: { status: 'CANCELLED' }
		});
	}, { userId, reason: 'Cancel report execution' });

	log.info(`CANCEL_EXECUTION execution:${executionId} by user ${userId}`);
	return executionId;
}

// Main workflow function
async function reportExecutionWorkflow(input: ReportExecutionWorkflowInput): Promise<ReportExecutionWorkflowResult> {
	try {
		let entityId: string | undefined;

		switch (input.action) {
			case ReportExecutionAction.GENERATE_REPORT:
				entityId = await DBOS.runStep(
					() => generateReport(input.organizationId, input.userId, input.associationId, input.data),
					{ name: 'generateReport' }
				);
				break;

			case ReportExecutionAction.CANCEL_EXECUTION:
				entityId = await DBOS.runStep(
					() => cancelExecution(input.organizationId, input.userId, input.associationId, input.executionId!),
					{ name: 'cancelExecution' }
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
			errorType: WorkflowErrorType.REPORT_EXECUTION_WORKFLOW_ERROR
		});

		return { success: false, error: errorMessage };
	}
}

export const reportExecutionWorkflow_v1 = DBOS.registerWorkflow(reportExecutionWorkflow);

export async function startReportExecutionWorkflow(
	input: ReportExecutionWorkflowInput,
	idempotencyKey: string
): Promise<ReportExecutionWorkflowResult> {
	const workflowId = idempotencyKey || `report-exec-${input.action}-${input.executionId || 'new'}-${Date.now()}`;
	const handle = await DBOS.startWorkflow(reportExecutionWorkflow_v1, { workflowID: idempotencyKey})(input);
	return handle.getResult();
}
