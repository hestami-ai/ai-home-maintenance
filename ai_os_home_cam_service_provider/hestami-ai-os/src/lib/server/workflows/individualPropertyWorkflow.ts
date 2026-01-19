/**
 * Individual Property Workflow (v1)
 *
 * DBOS durable workflow for individual property management (Phase 17 Concierge).
 * Handles: create, update, delete, portfolio management, and external HOA.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { orgTransaction } from '../db/rls.js';
import type { EntityWorkflowResult } from './schemas.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger, logWorkflowStart, logWorkflowEnd, logStepError } from './workflowLogger.js';
import {
	ActivityEntityType,
	ActivityActionType,
	ActivityEventCategory,
	ActivityActorType
} from '../../../../generated/prisma/enums.js';

// Workflow error types for tracing
const WorkflowErrorType = {
	INDIVIDUAL_PROPERTY_WORKFLOW_ERROR: 'INDIVIDUAL_PROPERTY_WORKFLOW_ERROR'
} as const;

const WORKFLOW_STATUS_EVENT = 'individual_property_workflow_status';
const WORKFLOW_ERROR_EVENT = 'individual_property_workflow_error';

// Action types for individual property operations
const IndividualPropertyAction = {
	CREATE: 'CREATE',
	UPDATE: 'UPDATE',
	DELETE: 'DELETE',
	ADD_TO_PORTFOLIO: 'ADD_TO_PORTFOLIO',
	REMOVE_FROM_PORTFOLIO: 'REMOVE_FROM_PORTFOLIO',
	UPDATE_EXTERNAL_HOA: 'UPDATE_EXTERNAL_HOA'
} as const;

export const IndividualPropertyWorkflowAction = IndividualPropertyAction;

export type IndividualPropertyWorkflowAction = (typeof IndividualPropertyWorkflowAction)[keyof typeof IndividualPropertyWorkflowAction];

export interface ExternalHoaInput {
	hoaName: string;
	hoaContactName?: string | null;
	hoaContactEmail?: string | null;
	hoaContactPhone?: string | null;
	hoaAddress?: string | null;
	notes?: string | null;
}

export interface IndividualPropertyWorkflowInput {
	action: IndividualPropertyWorkflowAction;
	organizationId: string;
	userId: string;
	// CREATE fields
	name?: string;
	propertyType?: string;
	addressLine1?: string;
	addressLine2?: string | null;
	city?: string;
	state?: string;
	postalCode?: string;
	country?: string;
	yearBuilt?: number | null;
	squareFeet?: number | null;
	lotSquareFeet?: number | null;
	bedrooms?: number | null;
	bathrooms?: number | null;
	portfolioId?: string;
	externalHoa?: ExternalHoaInput;
	// UPDATE/DELETE fields
	propertyId?: string;
	isActive?: boolean;
	// Portfolio fields
	portfolioPropertyId?: string;
	// UPDATE_EXTERNAL_HOA fields
	externalHoaContextId?: string;
	hoaName?: string;
	hoaContactName?: string | null;
	hoaContactEmail?: string | null;
	hoaContactPhone?: string | null;
	hoaAddress?: string | null;
	notes?: string | null;
}

export interface IndividualPropertyWorkflowResult extends EntityWorkflowResult {
	propertyId?: string;
	externalHoaId?: string;
	portfolioPropertyId?: string;
	property?: {
		id: string;
		name: string;
		propertyType: string;
		addressLine1: string;
		addressLine2: string | null;
		city: string;
		state: string;
		postalCode: string;
		country: string;
		yearBuilt: number | null;
		squareFeet: number | null;
		lotSquareFeet: number | null;
		bedrooms: number | null;
		bathrooms: number | null;
		isActive: boolean;
		linkedUnitId: string | null;
		ownerOrgId: string;
		createdAt: string;
		updatedAt: string;
	};
	externalHoa?: {
		id: string;
		hoaName: string;
		hoaContactName: string | null;
		hoaContactEmail: string | null;
		hoaContactPhone: string | null;
		hoaAddress: string | null;
		notes: string | null;
	} | null;
	added?: boolean;
	removed?: boolean;
	deleted?: boolean;
	[key: string]: unknown;
}

// Step functions

async function createProperty(
	input: IndividualPropertyWorkflowInput
): Promise<{
	propertyId: string;
	property: IndividualPropertyWorkflowResult['property'];
	externalHoa: IndividualPropertyWorkflowResult['externalHoa'];
}> {
	const result = await orgTransaction(input.organizationId, async (tx) => {
		// Create the property
		const property = await tx.individualProperty.create({
			data: {
				ownerOrgId: input.organizationId,
				name: input.name!,
				propertyType: input.propertyType as any,
				addressLine1: input.addressLine1!,
				addressLine2: input.addressLine2 ?? null,
				city: input.city!,
				state: input.state!,
				postalCode: input.postalCode!,
				country: input.country ?? 'US',
				yearBuilt: input.yearBuilt ?? null,
				squareFeet: input.squareFeet ?? null,
				lotSquareFeet: input.lotSquareFeet ?? null,
				bedrooms: input.bedrooms ?? null,
				bathrooms: input.bathrooms ?? null,
				isActive: true
			}
		});

		// Add to portfolio if specified
		if (input.portfolioId) {
			await tx.portfolioProperty.create({
				data: {
					portfolioId: input.portfolioId,
					propertyId: property.id,
					addedBy: input.userId
				}
			});
		}

		// Create external HOA context if provided
		let externalHoa = null;
		if (input.externalHoa?.hoaName) {
			externalHoa = await tx.externalHOAContext.create({
				data: {
					organizationId: input.organizationId,
					propertyId: property.id,
					hoaName: input.externalHoa.hoaName,
					hoaContactName: input.externalHoa.hoaContactName ?? null,
					hoaContactEmail: input.externalHoa.hoaContactEmail ?? null,
					hoaContactPhone: input.externalHoa.hoaContactPhone ?? null,
					hoaAddress: input.externalHoa.hoaAddress ?? null,
					notes: input.externalHoa.notes ?? null
				}
			});
		}

		return { property, externalHoa };
	}, { userId: input.userId, reason: 'CREATE_INDIVIDUAL_PROPERTY' });

	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: ActivityEntityType.INDIVIDUAL_PROPERTY,
		entityId: result.property.id,
		action: ActivityActionType.CREATE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: `Individual property created: ${input.name}`,
		performedById: input.userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'individualPropertyWorkflow_v1',
		workflowStep: IndividualPropertyAction.CREATE,
		workflowVersion: 'v1',
		newState: { name: input.name, propertyType: input.propertyType, city: input.city }
	});

	return {
		propertyId: result.property.id,
		property: {
			id: result.property.id,
			ownerOrgId: result.property.ownerOrgId,
			name: result.property.name,
			propertyType: result.property.propertyType,
			addressLine1: result.property.addressLine1,
			addressLine2: result.property.addressLine2,
			city: result.property.city,
			state: result.property.state,
			postalCode: result.property.postalCode,
			country: result.property.country,
			yearBuilt: result.property.yearBuilt,
			squareFeet: result.property.squareFeet,
			lotSquareFeet: result.property.lotSquareFeet,
			bedrooms: result.property.bedrooms,
			bathrooms: result.property.bathrooms,
			isActive: result.property.isActive,
			linkedUnitId: result.property.linkedUnitId,
			createdAt: result.property.createdAt.toISOString(),
			updatedAt: result.property.updatedAt.toISOString()
		},
		externalHoa: result.externalHoa ? {
			id: result.externalHoa.id,
			hoaName: result.externalHoa.hoaName,
			hoaContactName: result.externalHoa.hoaContactName,
			hoaContactEmail: result.externalHoa.hoaContactEmail,
			hoaContactPhone: result.externalHoa.hoaContactPhone,
			hoaAddress: result.externalHoa.hoaAddress,
			notes: result.externalHoa.notes
		} : null
	};
}

async function updateProperty(
	input: IndividualPropertyWorkflowInput
): Promise<{ propertyId: string; property: IndividualPropertyWorkflowResult['property'] }> {
	const updateData: Record<string, unknown> = {};
	if (input.name !== undefined) updateData.name = input.name;
	if (input.propertyType !== undefined) updateData.propertyType = input.propertyType;
	if (input.addressLine1 !== undefined) updateData.addressLine1 = input.addressLine1;
	if (input.addressLine2 !== undefined) updateData.addressLine2 = input.addressLine2;
	if (input.city !== undefined) updateData.city = input.city;
	if (input.state !== undefined) updateData.state = input.state;
	if (input.postalCode !== undefined) updateData.postalCode = input.postalCode;
	if (input.yearBuilt !== undefined) updateData.yearBuilt = input.yearBuilt;
	if (input.squareFeet !== undefined) updateData.squareFeet = input.squareFeet;
	if (input.lotSquareFeet !== undefined) updateData.lotSquareFeet = input.lotSquareFeet;
	if (input.bedrooms !== undefined) updateData.bedrooms = input.bedrooms;
	if (input.bathrooms !== undefined) updateData.bathrooms = input.bathrooms;
	if (input.isActive !== undefined) updateData.isActive = input.isActive;

	const property = await orgTransaction(input.organizationId, async (tx) => {
		return tx.individualProperty.update({
			where: { id: input.propertyId },
			data: updateData
		});
	}, { userId: input.userId, reason: 'UPDATE_INDIVIDUAL_PROPERTY' });

	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: ActivityEntityType.INDIVIDUAL_PROPERTY,
		entityId: property.id,
		action: ActivityActionType.UPDATE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: `Individual property updated: ${property.name}`,
		performedById: input.userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'individualPropertyWorkflow_v1',
		workflowStep: IndividualPropertyAction.UPDATE,
		workflowVersion: 'v1',
		newState: updateData
	});

	return {
		propertyId: property.id,
		property: {
			id: property.id,
			ownerOrgId: property.ownerOrgId,
			name: property.name,
			propertyType: property.propertyType,
			addressLine1: property.addressLine1,
			addressLine2: property.addressLine2,
			city: property.city,
			state: property.state,
			postalCode: property.postalCode,
			country: property.country,
			yearBuilt: property.yearBuilt,
			squareFeet: property.squareFeet,
			lotSquareFeet: property.lotSquareFeet,
			bedrooms: property.bedrooms,
			bathrooms: property.bathrooms,
			isActive: property.isActive,
			linkedUnitId: property.linkedUnitId,
			createdAt: property.createdAt.toISOString(),
			updatedAt: property.updatedAt.toISOString()
		}
	};
}

async function deleteProperty(
	propertyId: string,
	organizationId: string,
	userId: string
): Promise<{ deleted: boolean }> {
	await orgTransaction(organizationId, async (tx) => {
		return tx.individualProperty.update({
			where: { id: propertyId },
			data: { isActive: false }
		});
	}, { userId, reason: 'DELETE_INDIVIDUAL_PROPERTY' });

	await recordWorkflowEvent({
		organizationId,
		entityType: ActivityEntityType.INDIVIDUAL_PROPERTY,
		entityId: propertyId,
		action: ActivityActionType.DELETE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: `Individual property deactivated`,
		performedById: userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'individualPropertyWorkflow_v1',
		workflowStep: IndividualPropertyAction.DELETE,
		workflowVersion: 'v1',
		newState: { isActive: false }
	});

	return { deleted: true };
}

async function addToPortfolio(
	propertyId: string,
	portfolioId: string,
	organizationId: string,
	userId: string
): Promise<{ added: boolean; portfolioPropertyId?: string }> {
	// Check if already in portfolio and create if not - all in one transaction
	const result = await orgTransaction(organizationId, async (tx) => {
		const existing = await tx.portfolioProperty.findFirst({
			where: {
				propertyId,
				portfolioId,
				removedAt: null
			}
		});

		if (existing) {
			return { added: false, portfolioPropertyId: undefined };
		}

		const membership = await tx.portfolioProperty.create({
			data: {
				propertyId,
				portfolioId,
				addedBy: userId
			}
		});

		return { added: true, portfolioPropertyId: membership.id };
	}, { userId, reason: 'ADD_TO_PORTFOLIO' });

	if (!result.added) {
		return { added: false };
	}

	await recordWorkflowEvent({
		organizationId,
		entityType: ActivityEntityType.INDIVIDUAL_PROPERTY,
		entityId: propertyId,
		action: ActivityActionType.UPDATE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: `Property added to portfolio`,
		performedById: userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'individualPropertyWorkflow_v1',
		workflowStep: IndividualPropertyAction.ADD_TO_PORTFOLIO,
		workflowVersion: 'v1',
		newState: { portfolioId }
	});

	return { added: true, portfolioPropertyId: result.portfolioPropertyId };
}

async function removeFromPortfolio(
	propertyId: string,
	portfolioId: string,
	organizationId: string,
	userId: string,
	portfolioPropertyId?: string
): Promise<{ removed: boolean }> {
	// Look up and update in one transaction
	const removed = await orgTransaction(organizationId, async (tx) => {
		// Use provided portfolioPropertyId if available, otherwise look up
		let membershipId = portfolioPropertyId;
		if (!membershipId) {
			const membership = await tx.portfolioProperty.findFirst({
				where: {
					propertyId,
					portfolioId,
					removedAt: null
				}
			});

			if (!membership) {
				return false;
			}
			membershipId = membership.id;
		}

		await tx.portfolioProperty.update({
			where: { id: membershipId },
			data: { removedAt: new Date() }
		});

		return true;
	}, { userId, reason: 'REMOVE_FROM_PORTFOLIO' });

	if (!removed) {
		return { removed: false };
	}

	await recordWorkflowEvent({
		organizationId,
		entityType: ActivityEntityType.INDIVIDUAL_PROPERTY,
		entityId: propertyId,
		action: ActivityActionType.UPDATE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: `Property removed from portfolio`,
		performedById: userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'individualPropertyWorkflow_v1',
		workflowStep: IndividualPropertyAction.REMOVE_FROM_PORTFOLIO,
		workflowVersion: 'v1',
		newState: { portfolioId, removedAt: new Date().toISOString() }
	});

	return { removed: true };
}

async function updateExternalHoa(
	input: IndividualPropertyWorkflowInput
): Promise<{ externalHoa: IndividualPropertyWorkflowResult['externalHoa']; wasExisting: boolean }> {
	// Check for existing HOA context and update/create in one transaction
	const result = await orgTransaction(input.organizationId, async (tx) => {
		const existing = await tx.externalHOAContext.findFirst({
			where: { propertyId: input.propertyId }
		});

		let externalHoa;

		if (existing) {
			// Update existing
			externalHoa = await tx.externalHOAContext.update({
				where: { id: existing.id },
				data: {
					hoaName: input.hoaName!,
					hoaContactName: input.hoaContactName ?? null,
					hoaContactEmail: input.hoaContactEmail ?? null,
					hoaContactPhone: input.hoaContactPhone ?? null,
					hoaAddress: input.hoaAddress ?? null,
					notes: input.notes ?? null
				}
			});
		} else {
			// Create new
			externalHoa = await tx.externalHOAContext.create({
				data: {
					organizationId: input.organizationId,
					propertyId: input.propertyId!,
					hoaName: input.hoaName!,
					hoaContactName: input.hoaContactName ?? null,
					hoaContactEmail: input.hoaContactEmail ?? null,
					hoaContactPhone: input.hoaContactPhone ?? null,
					hoaAddress: input.hoaAddress ?? null,
					notes: input.notes ?? null
				}
			});
		}

		return { externalHoa, wasExisting: !!existing };
	}, { userId: input.userId, reason: 'UPDATE_EXTERNAL_HOA' });

	const { externalHoa, wasExisting } = result;

	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: ActivityEntityType.EXTERNAL_HOA,
		entityId: externalHoa.id,
		action: wasExisting ? ActivityActionType.UPDATE : ActivityActionType.CREATE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: `External HOA ${wasExisting ? 'updated' : 'created'}: ${input.hoaName}`,
		performedById: input.userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'individualPropertyWorkflow_v1',
		workflowStep: IndividualPropertyAction.UPDATE_EXTERNAL_HOA,
		workflowVersion: 'v1',
		newState: { hoaName: input.hoaName }
	});

	return {
		externalHoa: {
			id: externalHoa.id,
			hoaName: externalHoa.hoaName,
			hoaContactName: externalHoa.hoaContactName,
			hoaContactEmail: externalHoa.hoaContactEmail,
			hoaContactPhone: externalHoa.hoaContactPhone,
			hoaAddress: externalHoa.hoaAddress,
			notes: externalHoa.notes
		},
		wasExisting
	};
}

// Main workflow function

async function individualPropertyWorkflow(input: IndividualPropertyWorkflowInput): Promise<IndividualPropertyWorkflowResult> {
	const workflowName = 'individualPropertyWorkflow_v1';
	const log = createWorkflowLogger(workflowName, DBOS.workflowID, input.action);
	const startTime = logWorkflowStart(log, input.action, {
		organizationId: input.organizationId,
		userId: input.userId,
		propertyId: input.propertyId
	}, workflowName, DBOS.workflowID);

	try {
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'started', action: input.action });

		switch (input.action) {
			case IndividualPropertyWorkflowAction.CREATE: {
				if (!input.name || !input.addressLine1 || !input.city || !input.state || !input.postalCode || !input.propertyType) {
					const error = new Error('Missing required fields for CREATE');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: createProperty starting', { name: input.name });
				const result = await DBOS.runStep(
					() => createProperty(input),
					{ name: 'createProperty' }
				);
				log.info('Step: createProperty completed', { id: result.propertyId });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'property_created', propertyId: result.propertyId });
				const successResult: IndividualPropertyWorkflowResult = {
					success: true,
					entityId: result.propertyId,
					propertyId: result.propertyId,
					property: result.property,
					externalHoa: result.externalHoa
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case IndividualPropertyWorkflowAction.UPDATE: {
				if (!input.propertyId) {
					const error = new Error('Missing required field: propertyId for UPDATE');
					logStepError(log, 'validation', error, { propertyId: input.propertyId });
					throw error;
				}
				log.debug('Step: updateProperty starting', { propertyId: input.propertyId });
				const result = await DBOS.runStep(
					() => updateProperty(input),
					{ name: 'updateProperty' }
				);
				log.info('Step: updateProperty completed', { id: result.propertyId });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'property_updated', propertyId: result.propertyId });
				const successResult: IndividualPropertyWorkflowResult = {
					success: true,
					entityId: result.propertyId,
					propertyId: result.propertyId,
					property: result.property
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case IndividualPropertyWorkflowAction.DELETE: {
				if (!input.propertyId) {
					const error = new Error('Missing required field: propertyId for DELETE');
					logStepError(log, 'validation', error, { propertyId: input.propertyId });
					throw error;
				}
				log.debug('Step: deleteProperty starting', { propertyId: input.propertyId });
				const result = await DBOS.runStep(
					() => deleteProperty(input.propertyId!, input.organizationId, input.userId),
					{ name: 'deleteProperty' }
				);
				log.info('Step: deleteProperty completed', { propertyId: input.propertyId });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'property_deleted', propertyId: input.propertyId });
				const successResult: IndividualPropertyWorkflowResult = {
					success: true,
					entityId: input.propertyId,
					propertyId: input.propertyId,
					deleted: result.deleted
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case IndividualPropertyWorkflowAction.ADD_TO_PORTFOLIO: {
				if (!input.propertyId || !input.portfolioId) {
					const error = new Error('Missing required fields: propertyId and portfolioId for ADD_TO_PORTFOLIO');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: addToPortfolio starting', { propertyId: input.propertyId, portfolioId: input.portfolioId });
				const result = await DBOS.runStep(
					() => addToPortfolio(input.propertyId!, input.portfolioId!, input.organizationId, input.userId),
					{ name: 'addToPortfolio' }
				);
				log.info('Step: addToPortfolio completed', { added: result.added });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'added_to_portfolio', ...result });
				const successResult: IndividualPropertyWorkflowResult = {
					success: true,
					entityId: input.propertyId,
					propertyId: input.propertyId,
					portfolioPropertyId: result.portfolioPropertyId,
					added: result.added
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case IndividualPropertyWorkflowAction.REMOVE_FROM_PORTFOLIO: {
				if (!input.propertyId || !input.portfolioId) {
					const error = new Error('Missing required fields: propertyId and portfolioId for REMOVE_FROM_PORTFOLIO');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: removeFromPortfolio starting', { propertyId: input.propertyId, portfolioId: input.portfolioId });
				const result = await DBOS.runStep(
					() => removeFromPortfolio(input.propertyId!, input.portfolioId!, input.organizationId, input.userId, input.portfolioPropertyId),
					{ name: 'removeFromPortfolio' }
				);
				log.info('Step: removeFromPortfolio completed', { removed: result.removed });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'removed_from_portfolio', ...result });
				const successResult: IndividualPropertyWorkflowResult = {
					success: true,
					entityId: input.propertyId,
					propertyId: input.propertyId,
					removed: result.removed
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case IndividualPropertyWorkflowAction.UPDATE_EXTERNAL_HOA: {
				if (!input.propertyId || !input.hoaName) {
					const error = new Error('Missing required fields: propertyId and hoaName for UPDATE_EXTERNAL_HOA');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: updateExternalHoa starting', { propertyId: input.propertyId });
				const result = await DBOS.runStep(
					() => updateExternalHoa(input),
					{ name: 'updateExternalHoa' }
				);
				log.info('Step: updateExternalHoa completed', { externalHoaId: result.externalHoa?.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'external_hoa_updated', externalHoaId: result.externalHoa?.id });
				const successResult: IndividualPropertyWorkflowResult = {
					success: true,
					entityId: input.propertyId,
					propertyId: input.propertyId,
					externalHoaId: result.externalHoa?.id,
					externalHoa: result.externalHoa
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			default: {
				const errorResult: IndividualPropertyWorkflowResult = {
					success: false,
					error: `Unknown action: ${input.action}`
				};
				log.warn('Unknown workflow action', { action: input.action });
				logWorkflowEnd(log, input.action, false, startTime, errorResult);
				return errorResult;
			}
		}
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;

		log.error('Workflow failed', {
			action: input.action,
			propertyId: input.propertyId,
			error: errorMessage,
			stack: errorObj.stack
		});

		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		await recordSpanError(errorObj, {
			errorCode: ActivityActionType.WORKFLOW_FAILED,
			errorType: WorkflowErrorType.INDIVIDUAL_PROPERTY_WORKFLOW_ERROR
		});
		const errorResult: IndividualPropertyWorkflowResult = {
			success: false,
			error: errorMessage
		};
		logWorkflowEnd(log, input.action, false, startTime, errorResult);
		return errorResult;
	}
}

export const individualPropertyWorkflow_v1 = DBOS.registerWorkflow(individualPropertyWorkflow);

export async function startIndividualPropertyWorkflow(
	input: IndividualPropertyWorkflowInput,
	idempotencyKey: string
): Promise<IndividualPropertyWorkflowResult> {
	const handle = await DBOS.startWorkflow(individualPropertyWorkflow_v1, { workflowID: idempotencyKey })(input);
	return handle.getResult();
}
