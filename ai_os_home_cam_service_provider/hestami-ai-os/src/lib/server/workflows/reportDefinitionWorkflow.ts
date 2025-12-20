/**
 * Report Definition Workflow (v1)
 *
 * DBOS durable workflow for managing report definition operations.
 * Handles: create, update, delete.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import type { ReportCategory, ReportFormat } from '../../../../generated/prisma/client.js';

// Action types for the unified workflow
export type ReportDefinitionAction =
	| 'CREATE_REPORT'
	| 'UPDATE_REPORT'
	| 'DELETE_REPORT';

export interface ReportDefinitionWorkflowInput {
	action: ReportDefinitionAction;
	organizationId: string;
	userId: string;
	associationId: string;
	reportId?: string;
	data: Record<string, unknown>;
}

export interface ReportDefinitionWorkflowResult {
	success: boolean;
	entityId?: string;
	error?: string;
}

// Step functions for each operation
async function createReport(
	organizationId: string,
	userId: string,
	associationId: string,
	data: Record<string, unknown>
): Promise<string> {
	const code = data.code as string;

	// Check for duplicate code
	const existing = await prisma.reportDefinition.findFirst({
		where: { associationId, code }
	});
	if (existing) {
		throw new Error('Report with this code already exists');
	}

	const report = await prisma.reportDefinition.create({
		data: {
			associationId,
			code,
			name: data.name as string,
			description: data.description as string | undefined,
			category: data.category as ReportCategory,
			queryTemplate: data.queryTemplate as string,
			parametersJson: data.parametersJson as string | undefined,
			columnsJson: data.columnsJson as string | undefined,
			defaultFormat: (data.defaultFormat as ReportFormat) || 'PDF',
			allowedFormats: (data.allowedFormats as ReportFormat[]) || ['PDF', 'EXCEL', 'CSV'],
			isSystemReport: false
		}
	});

	console.log(`[ReportDefinitionWorkflow] CREATE_REPORT report:${report.id} by user ${userId}`);
	return report.id;
}

async function updateReport(
	organizationId: string,
	userId: string,
	associationId: string,
	reportId: string,
	data: Record<string, unknown>
): Promise<string> {
	const existing = await prisma.reportDefinition.findFirst({
		where: { id: reportId, associationId }
	});
	if (!existing) throw new Error('Report definition not found');
	if (existing.isSystemReport) {
		throw new Error('Cannot modify system reports');
	}

	await prisma.reportDefinition.update({
		where: { id: reportId },
		data: {
			name: data.name as string | undefined,
			description: data.description as string | null | undefined,
			queryTemplate: data.queryTemplate as string | undefined,
			parametersJson: data.parametersJson as string | null | undefined,
			columnsJson: data.columnsJson as string | null | undefined,
			defaultFormat: data.defaultFormat as ReportFormat | undefined,
			allowedFormats: data.allowedFormats as ReportFormat[] | undefined,
			isActive: data.isActive as boolean | undefined
		}
	});

	console.log(`[ReportDefinitionWorkflow] UPDATE_REPORT report:${reportId} by user ${userId}`);
	return reportId;
}

async function deleteReport(
	organizationId: string,
	userId: string,
	associationId: string,
	reportId: string
): Promise<string> {
	const existing = await prisma.reportDefinition.findFirst({
		where: { id: reportId, associationId }
	});
	if (!existing) throw new Error('Report definition not found');
	if (existing.isSystemReport) {
		throw new Error('Cannot delete system reports');
	}

	await prisma.reportDefinition.delete({ where: { id: reportId } });

	console.log(`[ReportDefinitionWorkflow] DELETE_REPORT report:${reportId} by user ${userId}`);
	return reportId;
}

// Main workflow function
async function reportDefinitionWorkflow(input: ReportDefinitionWorkflowInput): Promise<ReportDefinitionWorkflowResult> {
	try {
		let entityId: string | undefined;

		switch (input.action) {
			case 'CREATE_REPORT':
				entityId = await DBOS.runStep(
					() => createReport(input.organizationId, input.userId, input.associationId, input.data),
					{ name: 'createReport' }
				);
				break;

			case 'UPDATE_REPORT':
				entityId = await DBOS.runStep(
					() => updateReport(input.organizationId, input.userId, input.associationId, input.reportId!, input.data),
					{ name: 'updateReport' }
				);
				break;

			case 'DELETE_REPORT':
				entityId = await DBOS.runStep(
					() => deleteReport(input.organizationId, input.userId, input.associationId, input.reportId!),
					{ name: 'deleteReport' }
				);
				break;

			default:
				return { success: false, error: `Unknown action: ${input.action}` };
		}

		return { success: true, entityId };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`[ReportDefinitionWorkflow] Error in ${input.action}:`, errorMessage);
		return { success: false, error: errorMessage };
	}
}

export const reportDefinitionWorkflow_v1 = DBOS.registerWorkflow(reportDefinitionWorkflow);

export async function startReportDefinitionWorkflow(
	input: ReportDefinitionWorkflowInput,
	idempotencyKey?: string
): Promise<ReportDefinitionWorkflowResult> {
	const workflowId = idempotencyKey || `report-def-${input.action}-${input.reportId || 'new'}-${Date.now()}`;
	const handle = await DBOS.startWorkflow(reportDefinitionWorkflow_v1, { workflowID: workflowId })(input);
	return handle.getResult();
}
