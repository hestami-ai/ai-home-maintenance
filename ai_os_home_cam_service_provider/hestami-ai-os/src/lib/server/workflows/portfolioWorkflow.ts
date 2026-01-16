/**
 * Portfolio Workflow (v1)
 *
 * DBOS durable workflow for portfolio management (Phase 3 Concierge).
 * Handles: create, update, delete, addProperty, removeProperty.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { orgTransaction } from '../db/rls.js';
import type { EntityWorkflowResult } from './schemas.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger, logWorkflowStart, logWorkflowEnd, logStepError } from './workflowLogger.js';
import type { Prisma } from '../../../../generated/prisma/client.js';

const WORKFLOW_STATUS_EVENT = 'portfolio_workflow_status';
const WORKFLOW_ERROR_EVENT = 'portfolio_workflow_error';

// Action types for portfolio operations
export const PortfolioWorkflowAction = {
	CREATE: 'CREATE',
	UPDATE: 'UPDATE',
	DELETE: 'DELETE',
	ADD_PROPERTY: 'ADD_PROPERTY',
	REMOVE_PROPERTY: 'REMOVE_PROPERTY'
} as const;

export type PortfolioWorkflowAction = (typeof PortfolioWorkflowAction)[keyof typeof PortfolioWorkflowAction];

export interface PortfolioWorkflowInput {
	action: PortfolioWorkflowAction;
	organizationId: string;
	userId: string;
	// CREATE/UPDATE fields
	portfolioId?: string;
	name?: string;
	description?: string | null;
	settings?: Record<string, unknown>;
	isActive?: boolean;
	// ADD_PROPERTY/REMOVE_PROPERTY fields
	propertyId?: string;
	portfolioPropertyId?: string;
	displayOrder?: number;
	notes?: string;
}

export interface PortfolioWorkflowResult extends EntityWorkflowResult {
	portfolioId?: string;
	portfolioPropertyId?: string;
	name?: string;
	description?: string | null;
	isActive?: boolean;
	propertyCount?: number;
	displayOrder?: number | null;
	createdAt?: string;
	updatedAt?: string;
	addedAt?: string;
	deletedAt?: string;
	removedAt?: string;
	[key: string]: unknown;
}

// Step functions

async function createPortfolio(
	input: PortfolioWorkflowInput
): Promise<{
	portfolioId: string;
	name: string;
	description: string | null;
	isActive: boolean;
	createdAt: string;
}> {
	const portfolio = await orgTransaction(
		input.organizationId,
		async (tx) => {
			return tx.propertyPortfolio.create({
				data: {
					organizationId: input.organizationId,
					name: input.name!,
					description: input.description ?? null,
					settings: (input.settings ?? {}) as Prisma.InputJsonValue
				}
			});
		},
		{ userId: input.userId, reason: 'Create portfolio' }
	);

	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: 'INDIVIDUAL_PROPERTY',
		entityId: portfolio.id,
		action: 'CREATE',
		eventCategory: 'EXECUTION',
		summary: `Portfolio created: ${input.name}`,
		performedById: input.userId,
		performedByType: 'HUMAN',
		workflowId: 'portfolioWorkflow_v1',
		workflowStep: 'CREATE',
		workflowVersion: 'v1',
		newState: { name: input.name }
	});

	return {
		portfolioId: portfolio.id,
		name: portfolio.name,
		description: portfolio.description,
		isActive: portfolio.isActive,
		createdAt: portfolio.createdAt.toISOString()
	};
}

async function updatePortfolio(
	input: PortfolioWorkflowInput
): Promise<{
	portfolioId: string;
	name: string;
	description: string | null;
	isActive: boolean;
	updatedAt: string;
}> {
	const portfolio = await orgTransaction(
		input.organizationId,
		async (tx) => {
			return tx.propertyPortfolio.update({
				where: { id: input.portfolioId },
				data: {
					...(input.name !== undefined && { name: input.name }),
					...(input.description !== undefined && { description: input.description }),
					...(input.settings !== undefined && { settings: input.settings as Prisma.InputJsonValue }),
					...(input.isActive !== undefined && { isActive: input.isActive })
				}
			});
		},
		{ userId: input.userId, reason: 'Update portfolio' }
	);

	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: 'INDIVIDUAL_PROPERTY',
		entityId: portfolio.id,
		action: 'UPDATE',
		eventCategory: 'EXECUTION',
		summary: `Portfolio updated: ${portfolio.name}`,
		performedById: input.userId,
		performedByType: 'HUMAN',
		workflowId: 'portfolioWorkflow_v1',
		workflowStep: 'UPDATE',
		workflowVersion: 'v1',
		newState: { name: input.name, isActive: input.isActive }
	});

	return {
		portfolioId: portfolio.id,
		name: portfolio.name,
		description: portfolio.description,
		isActive: portfolio.isActive,
		updatedAt: portfolio.updatedAt.toISOString()
	};
}

async function deletePortfolio(
	portfolioId: string,
	organizationId: string,
	userId: string
): Promise<{ deletedAt: string }> {
	const now = new Date();
	await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.propertyPortfolio.update({
				where: { id: portfolioId },
				data: { deletedAt: now }
			});
		},
		{ userId, reason: 'Delete portfolio' }
	);

	await recordWorkflowEvent({
		organizationId,
		entityType: 'INDIVIDUAL_PROPERTY',
		entityId: portfolioId,
		action: 'DELETE',
		eventCategory: 'EXECUTION',
		summary: 'Portfolio deleted',
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'portfolioWorkflow_v1',
		workflowStep: 'DELETE',
		workflowVersion: 'v1',
		newState: { deletedAt: now.toISOString() }
	});

	return { deletedAt: now.toISOString() };
}

async function addPropertyToPortfolio(
	input: PortfolioWorkflowInput
): Promise<{
	portfolioPropertyId: string;
	portfolioId: string;
	propertyId: string;
	displayOrder: number | null;
	addedAt: string;
}> {
	const portfolioProperty = await orgTransaction(
		input.organizationId,
		async (tx) => {
			return tx.portfolioProperty.create({
				data: {
					portfolioId: input.portfolioId!,
					propertyId: input.propertyId!,
					displayOrder: input.displayOrder,
					notes: input.notes,
					addedBy: input.userId
				}
			});
		},
		{ userId: input.userId, reason: 'Add property to portfolio' }
	);

	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: 'INDIVIDUAL_PROPERTY',
		entityId: portfolioProperty.id,
		action: 'CREATE',
		eventCategory: 'EXECUTION',
		summary: `Property added to portfolio`,
		performedById: input.userId,
		performedByType: 'HUMAN',
		workflowId: 'portfolioWorkflow_v1',
		workflowStep: 'ADD_PROPERTY',
		workflowVersion: 'v1',
		newState: { portfolioId: input.portfolioId, propertyId: input.propertyId }
	});

	return {
		portfolioPropertyId: portfolioProperty.id,
		portfolioId: portfolioProperty.portfolioId,
		propertyId: portfolioProperty.propertyId,
		displayOrder: portfolioProperty.displayOrder,
		addedAt: portfolioProperty.addedAt.toISOString()
	};
}

async function removePropertyFromPortfolio(
	portfolioPropertyId: string,
	organizationId: string,
	userId: string
): Promise<{ removedAt: string }> {
	const now = new Date();
	await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.portfolioProperty.update({
				where: { id: portfolioPropertyId },
				data: { removedAt: now }
			});
		},
		{ userId, reason: 'Remove property from portfolio' }
	);

	await recordWorkflowEvent({
		organizationId,
		entityType: 'INDIVIDUAL_PROPERTY',
		entityId: portfolioPropertyId,
		action: 'UPDATE',
		eventCategory: 'EXECUTION',
		summary: 'Property removed from portfolio',
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'portfolioWorkflow_v1',
		workflowStep: 'REMOVE_PROPERTY',
		workflowVersion: 'v1',
		newState: { removedAt: now.toISOString() }
	});

	return { removedAt: now.toISOString() };
}

// Main workflow function

async function portfolioWorkflow(input: PortfolioWorkflowInput): Promise<PortfolioWorkflowResult> {
	const workflowName = 'portfolioWorkflow_v1';
	const log = createWorkflowLogger(workflowName, DBOS.workflowID, input.action);
	const startTime = logWorkflowStart(log, input.action, {
		organizationId: input.organizationId,
		userId: input.userId,
		portfolioId: input.portfolioId
	}, workflowName, DBOS.workflowID);

	try {
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'started', action: input.action });

		switch (input.action) {
			case 'CREATE': {
				if (!input.name) {
					const error = new Error('Missing required field: name for CREATE');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: createPortfolio starting', { name: input.name });
				const result = await DBOS.runStep(
					() => createPortfolio(input),
					{ name: 'createPortfolio' }
				);
				log.info('Step: createPortfolio completed', { id: result.portfolioId });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'portfolio_created', portfolioId: result.portfolioId });
				const successResult: PortfolioWorkflowResult = {
					success: true,
					entityId: result.portfolioId,
					portfolioId: result.portfolioId,
					name: result.name,
					description: result.description,
					isActive: result.isActive,
					createdAt: result.createdAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'UPDATE': {
				if (!input.portfolioId) {
					const error = new Error('Missing required field: portfolioId for UPDATE');
					logStepError(log, 'validation', error, { portfolioId: input.portfolioId });
					throw error;
				}
				log.debug('Step: updatePortfolio starting', { portfolioId: input.portfolioId });
				const result = await DBOS.runStep(
					() => updatePortfolio(input),
					{ name: 'updatePortfolio' }
				);
				log.info('Step: updatePortfolio completed', { id: result.portfolioId });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'portfolio_updated', portfolioId: result.portfolioId });
				const successResult: PortfolioWorkflowResult = {
					success: true,
					entityId: result.portfolioId,
					portfolioId: result.portfolioId,
					name: result.name,
					description: result.description,
					isActive: result.isActive,
					updatedAt: result.updatedAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'DELETE': {
				if (!input.portfolioId) {
					const error = new Error('Missing required field: portfolioId for DELETE');
					logStepError(log, 'validation', error, { portfolioId: input.portfolioId });
					throw error;
				}
				log.debug('Step: deletePortfolio starting', { portfolioId: input.portfolioId });
				const result = await DBOS.runStep(
					() => deletePortfolio(input.portfolioId!, input.organizationId, input.userId),
					{ name: 'deletePortfolio' }
				);
				log.info('Step: deletePortfolio completed', { portfolioId: input.portfolioId });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'portfolio_deleted', portfolioId: input.portfolioId });
				const successResult: PortfolioWorkflowResult = {
					success: true,
					entityId: input.portfolioId,
					portfolioId: input.portfolioId,
					deletedAt: result.deletedAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'ADD_PROPERTY': {
				if (!input.portfolioId || !input.propertyId) {
					const error = new Error('Missing required fields: portfolioId and propertyId for ADD_PROPERTY');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: addPropertyToPortfolio starting', { portfolioId: input.portfolioId, propertyId: input.propertyId });
				const result = await DBOS.runStep(
					() => addPropertyToPortfolio(input),
					{ name: 'addPropertyToPortfolio' }
				);
				log.info('Step: addPropertyToPortfolio completed', { id: result.portfolioPropertyId });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'property_added', portfolioPropertyId: result.portfolioPropertyId });
				const successResult: PortfolioWorkflowResult = {
					success: true,
					entityId: result.portfolioPropertyId,
					portfolioPropertyId: result.portfolioPropertyId,
					portfolioId: result.portfolioId,
					propertyId: result.propertyId,
					displayOrder: result.displayOrder,
					addedAt: result.addedAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'REMOVE_PROPERTY': {
				if (!input.portfolioPropertyId) {
					const error = new Error('Missing required field: portfolioPropertyId for REMOVE_PROPERTY');
					logStepError(log, 'validation', error, { portfolioPropertyId: input.portfolioPropertyId });
					throw error;
				}
				log.debug('Step: removePropertyFromPortfolio starting', { portfolioPropertyId: input.portfolioPropertyId });
				const result = await DBOS.runStep(
					() => removePropertyFromPortfolio(input.portfolioPropertyId!, input.organizationId, input.userId),
					{ name: 'removePropertyFromPortfolio' }
				);
				log.info('Step: removePropertyFromPortfolio completed', { portfolioPropertyId: input.portfolioPropertyId });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'property_removed', portfolioPropertyId: input.portfolioPropertyId });
				const successResult: PortfolioWorkflowResult = {
					success: true,
					entityId: input.portfolioPropertyId,
					portfolioPropertyId: input.portfolioPropertyId,
					removedAt: result.removedAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			default: {
				const errorResult: PortfolioWorkflowResult = {
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
			portfolioId: input.portfolioId,
			error: errorMessage,
			stack: errorObj.stack
		});

		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		await recordSpanError(errorObj, {
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'PORTFOLIO_WORKFLOW_ERROR'
		});
		const errorResult: PortfolioWorkflowResult = {
			success: false,
			error: errorMessage
		};
		logWorkflowEnd(log, input.action, false, startTime, errorResult);
		return errorResult;
	}
}

export const portfolioWorkflow_v1 = DBOS.registerWorkflow(portfolioWorkflow);

export async function startPortfolioWorkflow(
	input: PortfolioWorkflowInput,
	idempotencyKey: string
): Promise<PortfolioWorkflowResult> {
	const handle = await DBOS.startWorkflow(portfolioWorkflow_v1, { workflowID: idempotencyKey })(input);
	return handle.getResult();
}
