/**
 * Property Portfolio Workflow (v1)
 *
 * DBOS durable workflow for property portfolio management (Phase 17 Concierge).
 * Handles: create, update, delete, getOrCreateDefault.
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
	PROPERTY_PORTFOLIO_WORKFLOW_ERROR: 'PROPERTY_PORTFOLIO_WORKFLOW_ERROR'
} as const;

const WORKFLOW_STATUS_EVENT = 'property_portfolio_workflow_status';
const WORKFLOW_ERROR_EVENT = 'property_portfolio_workflow_error';

// Action types for property portfolio operations
export const PropertyPortfolioWorkflowAction = {
	CREATE: 'CREATE',
	UPDATE: 'UPDATE',
	DELETE: 'DELETE',
	GET_OR_CREATE_DEFAULT: 'GET_OR_CREATE_DEFAULT'
} as const;

export type PropertyPortfolioWorkflowAction = (typeof PropertyPortfolioWorkflowAction)[keyof typeof PropertyPortfolioWorkflowAction];

export interface PropertyPortfolioWorkflowInput {
	action: PropertyPortfolioWorkflowAction;
	organizationId: string;
	userId: string;
	// CREATE fields
	name?: string;
	description?: string | null;
	// UPDATE/DELETE fields
	portfolioId?: string;
	isActive?: boolean;
}

export interface PropertyPortfolioWorkflowResult extends EntityWorkflowResult {
	portfolioId?: string;
	name?: string;
	description?: string | null;
	isActive?: boolean;
	propertyCount?: number;
	createdAt?: string;
	updatedAt?: string;
	deleted?: boolean;
	created?: boolean;
	[key: string]: unknown;
}

// Step functions

async function createPortfolio(
	input: PropertyPortfolioWorkflowInput
): Promise<{
	portfolioId: string;
	name: string;
	description: string | null;
	isActive: boolean;
	propertyCount: number;
	createdAt: string;
	updatedAt: string;
}> {
	const portfolio = await orgTransaction(
		input.organizationId,
		async (tx) => {
			return tx.propertyPortfolio.create({
				data: {
					organizationId: input.organizationId,
					name: input.name!,
					description: input.description ?? null,
					isActive: true
				}
			});
		},
		{ userId: input.userId, reason: 'Create property portfolio' }
	);

	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: ActivityEntityType.INDIVIDUAL_PROPERTY,
		entityId: portfolio.id,
		action: ActivityActionType.CREATE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: `Property portfolio created: ${input.name}`,
		performedById: input.userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'propertyPortfolioWorkflow_v1',
		workflowStep: PropertyPortfolioWorkflowAction.CREATE,
		workflowVersion: 'v1',
		newState: { name: input.name }
	});

	return {
		portfolioId: portfolio.id,
		name: portfolio.name,
		description: portfolio.description,
		isActive: portfolio.isActive,
		propertyCount: 0,
		createdAt: portfolio.createdAt.toISOString(),
		updatedAt: portfolio.updatedAt.toISOString()
	};
}

async function updatePortfolio(
	input: PropertyPortfolioWorkflowInput
): Promise<{
	portfolioId: string;
	name: string;
	description: string | null;
	isActive: boolean;
	propertyCount: number;
	createdAt: string;
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
					...(input.isActive !== undefined && { isActive: input.isActive })
				},
				include: {
					_count: {
						select: { properties: true }
					}
				}
			});
		},
		{ userId: input.userId, reason: 'Update property portfolio' }
	);

	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: ActivityEntityType.INDIVIDUAL_PROPERTY,
		entityId: portfolio.id,
		action: ActivityActionType.UPDATE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: `Property portfolio updated: ${portfolio.name}`,
		performedById: input.userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'propertyPortfolioWorkflow_v1',
		workflowStep: PropertyPortfolioWorkflowAction.UPDATE,
		workflowVersion: 'v1',
		newState: { name: input.name, isActive: input.isActive }
	});

	return {
		portfolioId: portfolio.id,
		name: portfolio.name,
		description: portfolio.description,
		isActive: portfolio.isActive,
		propertyCount: portfolio._count.properties,
		createdAt: portfolio.createdAt.toISOString(),
		updatedAt: portfolio.updatedAt.toISOString()
	};
}

async function deletePortfolio(
	portfolioId: string,
	organizationId: string,
	userId: string
): Promise<{ deleted: boolean }> {
	await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.propertyPortfolio.update({
				where: { id: portfolioId },
				data: { deletedAt: new Date() }
			});
		},
		{ userId, reason: 'Delete property portfolio' }
	);

	await recordWorkflowEvent({
		organizationId,
		entityType: ActivityEntityType.INDIVIDUAL_PROPERTY,
		entityId: portfolioId,
		action: ActivityActionType.DELETE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: 'Property portfolio deleted',
		performedById: userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'propertyPortfolioWorkflow_v1',
		workflowStep: PropertyPortfolioWorkflowAction.DELETE,
		workflowVersion: 'v1',
		newState: { deletedAt: new Date().toISOString() }
	});

	return { deleted: true };
}

async function getOrCreateDefaultPortfolio(
	organizationId: string,
	userId: string
): Promise<{
	portfolioId: string;
	name: string;
	description: string | null;
	isActive: boolean;
	propertyCount: number;
	createdAt: string;
	updatedAt: string;
	created: boolean;
}> {
	const result = await orgTransaction(
		organizationId,
		async (tx) => {
			// Check for existing default portfolio
			let portfolio = await tx.propertyPortfolio.findFirst({
				where: {
					organizationId,
					deletedAt: null,
					isActive: true
				},
				orderBy: { createdAt: 'asc' },
				include: {
					_count: {
						select: { properties: true }
					}
				}
			});

			let created = false;

			if (!portfolio) {
				// Create default portfolio
				portfolio = await tx.propertyPortfolio.create({
					data: {
						organizationId,
						name: 'My Properties',
						description: 'Default property portfolio',
						isActive: true
					},
					include: {
						_count: {
							select: { properties: true }
						}
					}
				});
				created = true;
			}

			return { portfolio, created };
		},
		{ userId, reason: 'Get or create default property portfolio' }
	);

	if (result.created) {
		await recordWorkflowEvent({
			organizationId,
			entityType: ActivityEntityType.INDIVIDUAL_PROPERTY,
			entityId: result.portfolio.id,
			action: ActivityActionType.CREATE,
			eventCategory: ActivityEventCategory.EXECUTION,
			summary: 'Default property portfolio created',
			performedById: userId,
			performedByType: ActivityActorType.HUMAN,
			workflowId: 'propertyPortfolioWorkflow_v1',
			workflowStep: PropertyPortfolioWorkflowAction.GET_OR_CREATE_DEFAULT,
			workflowVersion: 'v1',
			newState: { name: 'My Properties', isDefault: true }
		});
	}

	return {
		portfolioId: result.portfolio.id,
		name: result.portfolio.name,
		description: result.portfolio.description,
		isActive: result.portfolio.isActive,
		propertyCount: result.portfolio._count.properties,
		createdAt: result.portfolio.createdAt.toISOString(),
		updatedAt: result.portfolio.updatedAt.toISOString(),
		created: result.created
	};
}

// Main workflow function

async function propertyPortfolioWorkflow(input: PropertyPortfolioWorkflowInput): Promise<PropertyPortfolioWorkflowResult> {
	const workflowName = 'propertyPortfolioWorkflow_v1';
	const log = createWorkflowLogger(workflowName, DBOS.workflowID, input.action);
	const startTime = logWorkflowStart(log, input.action, {
		organizationId: input.organizationId,
		userId: input.userId,
		portfolioId: input.portfolioId
	}, workflowName, DBOS.workflowID);

	try {
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'started', action: input.action });

		switch (input.action) {
			case PropertyPortfolioWorkflowAction.CREATE: {
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
				const successResult: PropertyPortfolioWorkflowResult = {
					success: true,
					entityId: result.portfolioId,
					portfolioId: result.portfolioId,
					name: result.name,
					description: result.description,
					isActive: result.isActive,
					propertyCount: result.propertyCount,
					createdAt: result.createdAt,
					updatedAt: result.updatedAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case PropertyPortfolioWorkflowAction.UPDATE: {
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
				const successResult: PropertyPortfolioWorkflowResult = {
					success: true,
					entityId: result.portfolioId,
					portfolioId: result.portfolioId,
					name: result.name,
					description: result.description,
					isActive: result.isActive,
					propertyCount: result.propertyCount,
					createdAt: result.createdAt,
					updatedAt: result.updatedAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case PropertyPortfolioWorkflowAction.DELETE: {
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
				const successResult: PropertyPortfolioWorkflowResult = {
					success: true,
					entityId: input.portfolioId,
					portfolioId: input.portfolioId,
					deleted: result.deleted
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case PropertyPortfolioWorkflowAction.GET_OR_CREATE_DEFAULT: {
				log.debug('Step: getOrCreateDefaultPortfolio starting');
				const result = await DBOS.runStep(
					() => getOrCreateDefaultPortfolio(input.organizationId, input.userId),
					{ name: 'getOrCreateDefaultPortfolio' }
				);
				log.info('Step: getOrCreateDefaultPortfolio completed', { id: result.portfolioId, created: result.created });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'default_portfolio_ready', portfolioId: result.portfolioId });
				const successResult: PropertyPortfolioWorkflowResult = {
					success: true,
					entityId: result.portfolioId,
					portfolioId: result.portfolioId,
					name: result.name,
					description: result.description,
					isActive: result.isActive,
					propertyCount: result.propertyCount,
					createdAt: result.createdAt,
					updatedAt: result.updatedAt,
					created: result.created
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			default: {
				const errorResult: PropertyPortfolioWorkflowResult = {
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
			errorCode: ActivityActionType.WORKFLOW_FAILED,
			errorType: WorkflowErrorType.PROPERTY_PORTFOLIO_WORKFLOW_ERROR
		});
		const errorResult: PropertyPortfolioWorkflowResult = {
			success: false,
			error: errorMessage
		};
		logWorkflowEnd(log, input.action, false, startTime, errorResult);
		return errorResult;
	}
}

export const propertyPortfolioWorkflow_v1 = DBOS.registerWorkflow(propertyPortfolioWorkflow);

export async function startPropertyPortfolioWorkflow(
	input: PropertyPortfolioWorkflowInput,
	idempotencyKey: string
): Promise<PropertyPortfolioWorkflowResult> {
	const handle = await DBOS.startWorkflow(propertyPortfolioWorkflow_v1, { workflowID: idempotencyKey })(input);
	return handle.getResult();
}
