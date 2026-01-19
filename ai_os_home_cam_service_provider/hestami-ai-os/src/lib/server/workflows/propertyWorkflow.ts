/**
 * Property Workflow (v1)
 *
 * DBOS durable workflow for property management operations.
 * Handles: create, update, delete.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { type EntityWorkflowResult } from './schemas.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger } from './workflowLogger.js';
import type { PropertyType } from '../../../../generated/prisma/client.js';
import { orgTransaction } from '../db/rls.js';
import { ActivityActionType } from '../../../../generated/prisma/enums.js';

// Workflow error types for tracing
const WorkflowErrorType = {
	PROPERTY_WORKFLOW_ERROR: 'PROPERTY_WORKFLOW_ERROR'
} as const;

const log = createWorkflowLogger('PropertyWorkflow');

// Action types for the unified workflow
export const PropertyWorkflowAction = {
	CREATE: 'CREATE',
	UPDATE: 'UPDATE',
	DELETE: 'DELETE'
} as const;

export type PropertyWorkflowAction = (typeof PropertyWorkflowAction)[keyof typeof PropertyWorkflowAction];

export interface PropertyWorkflowInput {
	action: PropertyWorkflowAction;
	organizationId: string;
	userId: string;
	propertyId?: string;
	data: {
		// CREATE/UPDATE fields
		associationId?: string;
		name?: string;
		propertyType?: string;
		addressLine1?: string;
		addressLine2?: string | null;
		city?: string;
		state?: string;
		postalCode?: string;
		country?: string;
		latitude?: number | null;
		longitude?: number | null;
		yearBuilt?: number | null;
		totalUnits?: number;
		totalAcres?: number | null;
	};
}

export interface PropertyWorkflowResult extends EntityWorkflowResult {
	propertyId?: string;
}

// Step functions

async function createPropertyStep(
	organizationId: string,
	userId: string,
	data: PropertyWorkflowInput['data']
): Promise<{ propertyId: string }> {
	const property = await orgTransaction(organizationId, async (tx) => {
		return tx.property.create({
			data: {
				organizationId,
				associationId: data.associationId!,
				name: data.name!,
				propertyType: data.propertyType as PropertyType,
				addressLine1: data.addressLine1!,
				addressLine2: data.addressLine2,
				city: data.city!,
				state: data.state!,
				postalCode: data.postalCode!,
				country: data.country ?? 'US',
				latitude: data.latitude,
				longitude: data.longitude,
				yearBuilt: data.yearBuilt,
				totalUnits: data.totalUnits ?? 0,
				totalAcres: data.totalAcres
			}
		});
	}, { userId, reason: 'Create property' });

	log.info('CREATE completed', { propertyId: property.id, associationId: data.associationId });
	return { propertyId: property.id };
}

async function updatePropertyStep(
	organizationId: string,
	userId: string,
	propertyId: string,
	data: PropertyWorkflowInput['data']
): Promise<{ propertyId: string }> {
	const { associationId, ...updateData } = data;
	await orgTransaction(organizationId, async (tx) => {
		return tx.property.update({
			where: { id: propertyId },
			data: {
				...(updateData.name !== undefined && { name: updateData.name }),
				...(updateData.propertyType !== undefined && { propertyType: updateData.propertyType as PropertyType }),
				...(updateData.addressLine1 !== undefined && { addressLine1: updateData.addressLine1 }),
				...(updateData.addressLine2 !== undefined && { addressLine2: updateData.addressLine2 }),
				...(updateData.city !== undefined && { city: updateData.city }),
				...(updateData.state !== undefined && { state: updateData.state }),
				...(updateData.postalCode !== undefined && { postalCode: updateData.postalCode }),
				...(updateData.country !== undefined && { country: updateData.country }),
				...(updateData.latitude !== undefined && { latitude: updateData.latitude }),
				...(updateData.longitude !== undefined && { longitude: updateData.longitude }),
				...(updateData.yearBuilt !== undefined && { yearBuilt: updateData.yearBuilt }),
				...(updateData.totalUnits !== undefined && { totalUnits: updateData.totalUnits }),
				...(updateData.totalAcres !== undefined && { totalAcres: updateData.totalAcres })
			}
		});
	}, { userId, reason: 'Update property' });

	log.info('UPDATE completed', { propertyId });
	return { propertyId };
}

async function deletePropertyStep(
	organizationId: string,
	userId: string,
	propertyId: string
): Promise<{ propertyId: string; deletedAt: Date }> {
	const now = new Date();
	await orgTransaction(organizationId, async (tx) => {
		return tx.property.update({
			where: { id: propertyId },
			data: { deletedAt: now }
		});
	}, { userId, reason: 'Delete property (soft delete)' });

	log.info('DELETE completed', { propertyId });
	return { propertyId, deletedAt: now };
}

// Main workflow function
async function propertyWorkflow(input: PropertyWorkflowInput): Promise<PropertyWorkflowResult> {
	try {
		switch (input.action) {
			case PropertyWorkflowAction.CREATE: {
				const result = await DBOS.runStep(
					() => createPropertyStep(input.organizationId, input.userId, input.data),
					{ name: 'createProperty' }
				);
				return {
					success: true,
					entityId: result.propertyId,
					propertyId: result.propertyId
				};
			}

			case PropertyWorkflowAction.UPDATE: {
				const result = await DBOS.runStep(
					() => updatePropertyStep(input.organizationId, input.userId, input.propertyId!, input.data),
					{ name: 'updateProperty' }
				);
				return { success: true, entityId: result.propertyId, propertyId: result.propertyId };
			}

			case PropertyWorkflowAction.DELETE: {
				const result = await DBOS.runStep(
					() => deletePropertyStep(input.organizationId, input.userId, input.propertyId!),
					{ name: 'deleteProperty' }
				);
				return { success: true, entityId: result.propertyId, propertyId: result.propertyId };
			}

			default:
				return { success: false, error: `Unknown action: ${input.action}` };
		}
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;
		console.error(`[PropertyWorkflow] Error in ${input.action}:`, errorMessage);

		await recordSpanError(errorObj, {
			errorCode: ActivityActionType.WORKFLOW_FAILED,
			errorType: WorkflowErrorType.PROPERTY_WORKFLOW_ERROR
		});

		return { success: false, error: errorMessage };
	}
}

export const propertyWorkflow_v1 = DBOS.registerWorkflow(propertyWorkflow);

export async function startPropertyWorkflow(
	input: PropertyWorkflowInput,
	idempotencyKey: string
): Promise<PropertyWorkflowResult> {
	const handle = await DBOS.startWorkflow(propertyWorkflow_v1, { workflowID: idempotencyKey })(input);
	return handle.getResult();
}
