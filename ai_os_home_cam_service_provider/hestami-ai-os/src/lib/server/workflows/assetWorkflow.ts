/**
 * Asset Workflow (v1)
 *
 * DBOS durable workflow for asset management operations.
 * Handles: create, update, delete, logMaintenance.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { orgTransaction } from '../db/rls.js';
import { type EntityWorkflowResult } from './schemas.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger } from './workflowLogger.js';
import { ActivityActionType } from '../../../../generated/prisma/enums.js';

// Workflow error types for tracing
const WorkflowErrorType = {
	ASSET_WORKFLOW_ERROR: 'ASSET_WORKFLOW_ERROR'
} as const;

const log = createWorkflowLogger('AssetWorkflow');

// Action types for the unified workflow
export const AssetWorkflowAction = {
	CREATE: 'CREATE',
	UPDATE: 'UPDATE',
	DELETE: 'DELETE',
	LOG_MAINTENANCE: 'LOG_MAINTENANCE'
} as const;

export type AssetWorkflowAction = (typeof AssetWorkflowAction)[keyof typeof AssetWorkflowAction];

export interface AssetWorkflowInput {
	action: AssetWorkflowAction;
	organizationId: string;
	userId: string;
	associationId: string;
	assetId?: string;
	data: {
		// CREATE fields
		assetNumber?: string;
		name?: string;
		description?: string | null;
		category?: string;
		unitId?: string | null;
		commonAreaName?: string | null;
		locationDetails?: string | null;
		manufacturer?: string | null;
		model?: string | null;
		serialNumber?: string | null;
		purchaseDate?: Date | null;
		installDate?: Date | null;
		warrantyExpires?: Date | null;
		warrantyDetails?: string | null;
		purchaseCost?: number | null;
		currentValue?: number | null;
		maintenanceFrequencyDays?: number | null;
		// UPDATE fields
		status?: string;
		// LOG_MAINTENANCE fields
		maintenanceDate?: Date;
		maintenanceType?: string;
		maintenanceDescription?: string;
		performedBy?: string | null;
		cost?: number | null;
		workOrderId?: string | null;
		notes?: string | null;
		nextMaintenanceDate?: Date | null;
	};
}

export interface AssetWorkflowResult extends EntityWorkflowResult {
	assetNumber?: string;
	maintenanceLogId?: string;
}

// Step functions

async function createAsset(
	organizationId: string,
	associationId: string,
	userId: string,
	data: AssetWorkflowInput['data']
): Promise<{ id: string; assetNumber: string; name: string; category: string; status: string }> {
	const asset = await orgTransaction(organizationId, async (tx) => {
		return tx.asset.create({
			data: {
				organizationId,
				associationId,
				assetNumber: data.assetNumber!,
				name: data.name!,
				description: data.description,
				category: data.category as any,
				unitId: data.unitId,
				commonAreaName: data.commonAreaName,
				locationDetails: data.locationDetails,
				manufacturer: data.manufacturer,
				model: data.model,
				serialNumber: data.serialNumber,
				purchaseDate: data.purchaseDate,
				installDate: data.installDate,
				warrantyExpires: data.warrantyExpires,
				warrantyDetails: data.warrantyDetails,
				purchaseCost: data.purchaseCost,
				currentValue: data.currentValue,
				maintenanceFrequencyDays: data.maintenanceFrequencyDays
			}
		});
	}, { userId, reason: 'Create asset' });

	log.info('CREATE completed', { assetId: asset.id, assetNumber: asset.assetNumber, userId });
	return {
		id: asset.id,
		assetNumber: asset.assetNumber,
		name: asset.name,
		category: asset.category,
		status: asset.status
	};
}

async function updateAsset(
	organizationId: string,
	assetId: string,
	userId: string,
	data: AssetWorkflowInput['data']
): Promise<{ id: string; name: string; status: string }> {
	const asset = await orgTransaction(organizationId, async (tx) => {
		return tx.asset.update({
			where: { id: assetId },
			data: {
				...(data.name !== undefined && { name: data.name }),
				...(data.description !== undefined && { description: data.description }),
				...(data.status !== undefined && { status: data.status as any }),
				...(data.unitId !== undefined && { unitId: data.unitId }),
				...(data.commonAreaName !== undefined && { commonAreaName: data.commonAreaName }),
				...(data.locationDetails !== undefined && { locationDetails: data.locationDetails }),
				...(data.manufacturer !== undefined && { manufacturer: data.manufacturer }),
				...(data.model !== undefined && { model: data.model }),
				...(data.serialNumber !== undefined && { serialNumber: data.serialNumber }),
				...(data.warrantyExpires !== undefined && { warrantyExpires: data.warrantyExpires }),
				...(data.warrantyDetails !== undefined && { warrantyDetails: data.warrantyDetails }),
				...(data.currentValue !== undefined && { currentValue: data.currentValue }),
				...(data.maintenanceFrequencyDays !== undefined && { maintenanceFrequencyDays: data.maintenanceFrequencyDays })
			}
		});
	}, { userId, reason: 'Update asset' });

	log.info('UPDATE completed', { assetId, userId });
	return {
		id: asset.id,
		name: asset.name,
		status: asset.status
	};
}

async function deleteAsset(
	organizationId: string,
	assetId: string,
	userId: string
): Promise<{ success: boolean }> {
	await orgTransaction(organizationId, async (tx) => {
		return tx.asset.update({
			where: { id: assetId },
			data: { deletedAt: new Date(), status: 'DISPOSED' }
		});
	}, { userId, reason: 'Delete asset (soft delete)' });

	log.info('DELETE completed', { assetId, userId });
	return { success: true };
}

async function logMaintenance(
	organizationId: string,
	assetId: string,
	userId: string,
	data: AssetWorkflowInput['data']
): Promise<{ maintenanceLogId: string; maintenanceDate: string; maintenanceType: string }> {
	const maintenanceDate = data.maintenanceDate!;

	const maintenanceLog = await orgTransaction(organizationId, async (tx) => {
		const log = await tx.assetMaintenanceLog.create({
			data: {
				assetId,
				maintenanceDate,
				maintenanceType: data.maintenanceType!,
				description: data.maintenanceDescription!,
				performedBy: data.performedBy,
				cost: data.cost,
				workOrderId: data.workOrderId,
				notes: data.notes,
				createdBy: userId
			}
		});
		await tx.asset.update({
			where: { id: assetId },
			data: {
				lastMaintenanceDate: maintenanceDate,
				nextMaintenanceDate: data.nextMaintenanceDate
			}
		});
		return log;
	}, { userId, reason: 'Log asset maintenance' });

	log.info('LOG_MAINTENANCE completed', { assetId, maintenanceLogId: maintenanceLog.id, userId });
	return {
		maintenanceLogId: maintenanceLog.id,
		maintenanceDate: maintenanceLog.maintenanceDate.toISOString(),
		maintenanceType: maintenanceLog.maintenanceType
	};
}

// Main workflow function
async function assetWorkflow(input: AssetWorkflowInput): Promise<AssetWorkflowResult> {
	try {
		switch (input.action) {
			case AssetWorkflowAction.CREATE: {
				const result = await DBOS.runStep(
					() => createAsset(input.organizationId, input.associationId, input.userId, input.data),
					{ name: 'createAsset' }
				);
				return {
					success: true,
					entityId: result.id,
					assetNumber: result.assetNumber
				};
			}

			case AssetWorkflowAction.UPDATE: {
				const result = await DBOS.runStep(
					() => updateAsset(input.organizationId, input.assetId!, input.userId, input.data),
					{ name: 'updateAsset' }
				);
				return { success: true, entityId: result.id };
			}

			case AssetWorkflowAction.DELETE: {
				await DBOS.runStep(
					() => deleteAsset(input.organizationId, input.assetId!, input.userId),
					{ name: 'deleteAsset' }
				);
				return { success: true, entityId: input.assetId };
			}

			case AssetWorkflowAction.LOG_MAINTENANCE: {
				const result = await DBOS.runStep(
					() => logMaintenance(input.organizationId, input.assetId!, input.userId, input.data),
					{ name: 'logMaintenance' }
				);
				return {
					success: true,
					entityId: input.assetId,
					maintenanceLogId: result.maintenanceLogId
				};
			}

			default:
				return { success: false, error: `Unknown action: ${input.action}` };
		}
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;
		console.error(`[AssetWorkflow] Error in ${input.action}:`, errorMessage);

		await recordSpanError(errorObj, {
			errorCode: ActivityActionType.WORKFLOW_FAILED,
			errorType: WorkflowErrorType.ASSET_WORKFLOW_ERROR
		});

		return { success: false, error: errorMessage };
	}
}

export const assetWorkflow_v1 = DBOS.registerWorkflow(assetWorkflow);

export async function startAssetWorkflow(
	input: AssetWorkflowInput,
	idempotencyKey: string
): Promise<AssetWorkflowResult> {
	const handle = await DBOS.startWorkflow(assetWorkflow_v1, { workflowID: idempotencyKey })(input);
	return handle.getResult();
}
