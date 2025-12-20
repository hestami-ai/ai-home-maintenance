/**
 * Report Execution Workflow (v1)
 *
 * DBOS durable workflow for managing report execution operations.
 * Handles: generate, cancel.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import type { ReportFormat } from '../../../../generated/prisma/client.js';

// Action types for the unified workflow
export type ReportExecutionAction = 'GENERATE_REPORT' | 'CANCEL_EXECUTION';

export interface ReportExecutionWorkflowInput {
	action: ReportExecutionAction;
	organizationId: string;
	userId: string;
	associationId: string;
	executionId?: string;
	data: Record<string, unknown>;
}

export interface ReportExecutionWorkflowResult {
	success: boolean;
	entityId?: string;
	error?: string;
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

	// Create execution record
	const execution = await prisma.reportExecution.create({
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
	await prisma.reportExecution.update({
		where: { id: execution.id },
		data: {
			status: 'RUNNING',
			startedAt: new Date()
		}
	});

	// Stub: Mark as completed (real implementation would be async)
	setTimeout(async () => {
		try {
			await prisma.reportExecution.update({
				where: { id: execution.id },
				data: {
					status: 'COMPLETED',
					completedAt: new Date(),
					outputUrl: `/reports/${execution.id}.${format.toLowerCase()}`,
					rowCount: 0
				}
			});
		} catch {
			// Ignore errors in stub
		}
	}, 1000);

	console.log(`[ReportExecutionWorkflow] GENERATE_REPORT execution:${execution.id} by user ${userId}`);
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
	if (!['PENDING', 'RUNNING'].includes(execution.status)) {
		throw new Error('Can only cancel pending or running executions');
	}

	await prisma.reportExecution.update({
		where: { id: executionId },
		data: { status: 'CANCELLED' }
	});

	console.log(`[ReportExecutionWorkflow] CANCEL_EXECUTION execution:${executionId} by user ${userId}`);
	return executionId;
}

// Main workflow function
async function reportExecutionWorkflow(input: ReportExecutionWorkflowInput): Promise<ReportExecutionWorkflowResult> {
	try {
		let entityId: string | undefined;

		switch (input.action) {
			case 'GENERATE_REPORT':
				entityId = await DBOS.runStep(
					() => generateReport(input.organizationId, input.userId, input.associationId, input.data),
					{ name: 'generateReport' }
				);
				break;

			case 'CANCEL_EXECUTION':
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
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`[ReportExecutionWorkflow] Error in ${input.action}:`, errorMessage);
		return { success: false, error: errorMessage };
	}
}

export const reportExecutionWorkflow_v1 = DBOS.registerWorkflow(reportExecutionWorkflow);

export async function startReportExecutionWorkflow(
	input: ReportExecutionWorkflowInput,
	idempotencyKey?: string
): Promise<ReportExecutionWorkflowResult> {
	const workflowId = idempotencyKey || `report-exec-${input.action}-${input.executionId || 'new'}-${Date.now()}`;
	const handle = await DBOS.startWorkflow(reportExecutionWorkflow_v1, { workflowID: workflowId })(input);
	return handle.getResult();
}
