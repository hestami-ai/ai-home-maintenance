/**
 * Dashboard Workflow (v1)
 *
 * DBOS durable workflow for managing dashboard widget operations.
 * Handles: create, update, delete, reorder.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import { orgTransaction } from '../db/rls.js';
import type { WidgetType } from '../../../../generated/prisma/client.js';
import { type EntityWorkflowResult } from './schemas.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger } from './workflowLogger.js';

const log = createWorkflowLogger('DashboardWorkflow');

// Action types for the unified workflow
export const DashboardAction = {
	CREATE_WIDGET: 'CREATE_WIDGET',
	UPDATE_WIDGET: 'UPDATE_WIDGET',
	DELETE_WIDGET: 'DELETE_WIDGET',
	REORDER_WIDGETS: 'REORDER_WIDGETS'
} as const;

export type DashboardAction = (typeof DashboardAction)[keyof typeof DashboardAction];

export interface DashboardWorkflowInput {
	action: DashboardAction;
	organizationId: string;
	userId: string;
	associationId: string;
	widgetId?: string;
	data: Record<string, unknown>;
}

export interface DashboardWorkflowResult extends EntityWorkflowResult {
	// Inherits success, error, entityId from EntityWorkflowResult
}

// Step functions for each operation
async function createWidget(
	organizationId: string,
	userId: string,
	associationId: string,
	data: Record<string, unknown>
): Promise<string> {
	const widgetUserId = data.userId as string | undefined;

	// Get max position for ordering
	const maxPos = await prisma.dashboardWidget.aggregate({
		where: { associationId, userId: widgetUserId ?? null },
		_max: { position: true }
	});

	const widget = await orgTransaction(organizationId, async (tx) => {
		return tx.dashboardWidget.create({
			data: {
				associationId,
				userId: widgetUserId,
				widgetType: data.widgetType as WidgetType,
				title: data.title as string,
				configJson: data.configJson as string | undefined,
				position: (data.position as number | undefined) ?? (maxPos._max.position ?? 0) + 1,
				width: (data.width as number | undefined) ?? 1,
				height: (data.height as number | undefined) ?? 1
			}
		});
	}, { userId, reason: 'Create dashboard widget' });

	log.info(`CREATE_WIDGET widget:${widget.id} by user ${userId}`);
	return widget.id;
}

async function updateWidget(
	organizationId: string,
	userId: string,
	associationId: string,
	widgetId: string,
	data: Record<string, unknown>
): Promise<string> {
	const existing = await prisma.dashboardWidget.findFirst({
		where: { id: widgetId, associationId }
	});
	if (!existing) throw new Error('Dashboard widget not found');

	await orgTransaction(organizationId, async (tx) => {
		return tx.dashboardWidget.update({
			where: { id: widgetId },
			data: {
				title: data.title as string | undefined,
				configJson: data.configJson as string | null | undefined,
				position: data.position as number | undefined,
				width: data.width as number | undefined,
				height: data.height as number | undefined,
				isActive: data.isActive as boolean | undefined
			}
		});
	}, { userId, reason: 'Update dashboard widget' });

	log.info(`UPDATE_WIDGET widget:${widgetId} by user ${userId}`);
	return widgetId;
}

async function deleteWidget(
	organizationId: string,
	userId: string,
	associationId: string,
	widgetId: string
): Promise<string> {
	const existing = await prisma.dashboardWidget.findFirst({
		where: { id: widgetId, associationId }
	});
	if (!existing) throw new Error('Dashboard widget not found');

	await orgTransaction(organizationId, async (tx) => {
		return tx.dashboardWidget.delete({ where: { id: widgetId } });
	}, { userId, reason: 'Delete dashboard widget' });

	log.info(`DELETE_WIDGET widget:${widgetId} by user ${userId}`);
	return widgetId;
}

async function reorderWidgets(
	organizationId: string,
	userId: string,
	associationId: string,
	data: Record<string, unknown>
): Promise<string> {
	const widgetIds = data.widgetIds as string[];

	// Verify all widgets belong to this association
	const widgets = await prisma.dashboardWidget.findMany({
		where: { id: { in: widgetIds }, associationId }
	});

	if (widgets.length !== widgetIds.length) {
		throw new Error('Some widgets not found or not accessible');
	}

	// Update positions in order using orgTransaction
	await orgTransaction(organizationId, async (tx) => {
		for (let index = 0; index < widgetIds.length; index++) {
			await tx.dashboardWidget.update({
				where: { id: widgetIds[index] },
				data: { position: index }
			});
		}
	}, { userId, reason: 'Reorder dashboard widgets' });

	log.info(`REORDER_WIDGETS ${widgetIds.length} widgets by user ${userId}`);
	return 'reordered';
}

// Main workflow function
async function dashboardWorkflow(input: DashboardWorkflowInput): Promise<DashboardWorkflowResult> {
	try {
		let entityId: string | undefined;

		switch (input.action) {
			case 'CREATE_WIDGET':
				entityId = await DBOS.runStep(
					() => createWidget(input.organizationId, input.userId, input.associationId, input.data),
					{ name: 'createWidget' }
				);
				break;

			case 'UPDATE_WIDGET':
				entityId = await DBOS.runStep(
					() => updateWidget(input.organizationId, input.userId, input.associationId, input.widgetId!, input.data),
					{ name: 'updateWidget' }
				);
				break;

			case 'DELETE_WIDGET':
				entityId = await DBOS.runStep(
					() => deleteWidget(input.organizationId, input.userId, input.associationId, input.widgetId!),
					{ name: 'deleteWidget' }
				);
				break;

			case 'REORDER_WIDGETS':
				entityId = await DBOS.runStep(
					() => reorderWidgets(input.organizationId, input.userId, input.associationId, input.data),
					{ name: 'reorderWidgets' }
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
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'DASHBOARD_WORKFLOW_ERROR'
		});

		return { success: false, error: errorMessage };
	}
}

export const dashboardWorkflow_v1 = DBOS.registerWorkflow(dashboardWorkflow);

export async function startDashboardWorkflow(
	input: DashboardWorkflowInput,
	idempotencyKey: string
): Promise<DashboardWorkflowResult> {
	const workflowId = idempotencyKey || `dashboard-${input.action}-${input.widgetId || 'new'}-${Date.now()}`;
	const handle = await DBOS.startWorkflow(dashboardWorkflow_v1, { workflowID: idempotencyKey})(input);
	return handle.getResult();
}
