/**
 * Service Area Workflow (v1)
 *
 * DBOS durable workflow for managing service area operations.
 * Handles: create, update, delete.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import { type EntityWorkflowResult } from './schemas.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger } from './workflowLogger.js';

const log = createWorkflowLogger('ServiceAreaWorkflow');

// Action types for the unified workflow
export const ServiceAreaAction = {
	CREATE_AREA: 'CREATE_AREA',
	UPDATE_AREA: 'UPDATE_AREA',
	DELETE_AREA: 'DELETE_AREA'
} as const;

export type ServiceAreaAction = (typeof ServiceAreaAction)[keyof typeof ServiceAreaAction];

export interface ServiceAreaWorkflowInput {
	action: ServiceAreaAction;
	organizationId: string;
	userId: string;
	serviceAreaId?: string;
	data: Record<string, unknown>;
}

export interface ServiceAreaWorkflowResult extends EntityWorkflowResult {
	// Inherits success, error, entityId from EntityWorkflowResult
}

// Step functions for each operation
async function createArea(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const serviceArea = await prisma.serviceArea.create({
		data: {
			serviceProviderOrgId: organizationId,
			name: data.name as string,
			zipCodes: data.zipCodes as string[],
			serviceCategories: data.serviceCategories as string[],
			radius: data.radius as number | undefined,
			centerLat: data.centerLat as number | undefined,
			centerLng: data.centerLng as number | undefined
		}
	});

	console.log(`[ServiceAreaWorkflow] CREATE_AREA area:${serviceArea.id} by user ${userId}`);
	return serviceArea.id;
}

async function updateArea(
	organizationId: string,
	userId: string,
	serviceAreaId: string,
	data: Record<string, unknown>
): Promise<string> {
	const existing = await prisma.serviceArea.findFirst({
		where: { id: serviceAreaId, serviceProviderOrgId: organizationId }
	});
	if (!existing) throw new Error('Service area not found');

	await prisma.serviceArea.update({
		where: { id: serviceAreaId },
		data: {
			name: data.name as string | undefined,
			zipCodes: data.zipCodes as string[] | undefined,
			serviceCategories: data.serviceCategories as string[] | undefined,
			radius: data.radius as number | null | undefined,
			centerLat: data.centerLat as number | null | undefined,
			centerLng: data.centerLng as number | null | undefined,
			isActive: data.isActive as boolean | undefined
		}
	});

	console.log(`[ServiceAreaWorkflow] UPDATE_AREA area:${serviceAreaId} by user ${userId}`);
	return serviceAreaId;
}

async function deleteArea(
	organizationId: string,
	userId: string,
	serviceAreaId: string
): Promise<string> {
	const existing = await prisma.serviceArea.findFirst({
		where: { id: serviceAreaId, serviceProviderOrgId: organizationId }
	});
	if (!existing) throw new Error('Service area not found');

	await prisma.serviceArea.delete({ where: { id: serviceAreaId } });

	console.log(`[ServiceAreaWorkflow] DELETE_AREA area:${serviceAreaId} by user ${userId}`);
	return serviceAreaId;
}

// Main workflow function
async function serviceAreaWorkflow(input: ServiceAreaWorkflowInput): Promise<ServiceAreaWorkflowResult> {
	try {
		let entityId: string | undefined;

		switch (input.action) {
			case 'CREATE_AREA':
				entityId = await DBOS.runStep(
					() => createArea(input.organizationId, input.userId, input.data),
					{ name: 'createArea' }
				);
				break;

			case 'UPDATE_AREA':
				entityId = await DBOS.runStep(
					() => updateArea(input.organizationId, input.userId, input.serviceAreaId!, input.data),
					{ name: 'updateArea' }
				);
				break;

			case 'DELETE_AREA':
				entityId = await DBOS.runStep(
					() => deleteArea(input.organizationId, input.userId, input.serviceAreaId!),
					{ name: 'deleteArea' }
				);
				break;

			default:
				return { success: false, error: `Unknown action: ${input.action}` };
		}

		return { success: true, entityId };
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;
		console.error(`[ServiceAreaWorkflow] Error in ${input.action}:`, errorMessage);

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'SERVICE_AREA_WORKFLOW_ERROR'
		});

		return { success: false, error: errorMessage };
	}
}

export const serviceAreaWorkflow_v1 = DBOS.registerWorkflow(serviceAreaWorkflow);

export async function startServiceAreaWorkflow(
	input: ServiceAreaWorkflowInput,
	idempotencyKey?: string
): Promise<ServiceAreaWorkflowResult> {
	const workflowId = idempotencyKey || `service-area-${input.action}-${input.serviceAreaId || 'new'}-${Date.now()}`;
	const handle = await DBOS.startWorkflow(serviceAreaWorkflow_v1, { workflowID: workflowId })(input);
	return handle.getResult();
}
