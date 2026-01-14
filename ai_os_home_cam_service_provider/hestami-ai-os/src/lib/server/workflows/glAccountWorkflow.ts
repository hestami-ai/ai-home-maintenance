/**
 * GL Account Workflow (v1)
 *
 * DBOS durable workflow for GL Account management.
 * Handles: create, update, and soft delete operations.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import type { EntityWorkflowResult } from './schemas.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger, logWorkflowStart, logWorkflowEnd, logStepError } from './workflowLogger.js';
import type { AccountType, AccountCategory, FundType } from '../../../../generated/prisma/client.js';

const WORKFLOW_STATUS_EVENT = 'gl_account_workflow_status';
const WORKFLOW_ERROR_EVENT = 'gl_account_workflow_error';

// Action types for GL account operations
export const GLAccountWorkflowAction = {
	CREATE: 'CREATE',
	UPDATE: 'UPDATE',
	DELETE: 'DELETE'
} as const;

export type GLAccountWorkflowAction = (typeof GLAccountWorkflowAction)[keyof typeof GLAccountWorkflowAction];

export interface GLAccountWorkflowInput {
	action: GLAccountWorkflowAction;
	organizationId: string;
	userId: string;
	associationId?: string;
	// CREATE fields
	accountNumber?: string;
	name?: string;
	description?: string | null;
	accountType?: AccountType;
	category?: AccountCategory;
	fundType?: FundType;
	parentId?: string | null;
	isActive?: boolean;
	// UPDATE/DELETE fields
	accountId?: string;
}

export interface GLAccountWorkflowResult extends EntityWorkflowResult {
	accountId?: string;
	accountNumber?: string;
	name?: string;
	accountType?: string;
	category?: string;
	fundType?: string;
	isActive?: boolean;
	[key: string]: unknown;
}

// Step functions

async function createGLAccount(
	input: GLAccountWorkflowInput
): Promise<{ id: string; accountNumber: string; name: string; accountType: string; category: string; fundType: string; isActive: boolean }> {
	// Determine normal balance based on account type
	const normalDebit = ['ASSET', 'EXPENSE'].includes(input.accountType!);

	const account = await prisma.gLAccount.create({
		data: {
			organizationId: input.organizationId,
			associationId: input.associationId!,
			accountNumber: input.accountNumber!,
			name: input.name!,
			description: input.description,
			accountType: input.accountType!,
			category: input.category!,
			fundType: input.fundType ?? 'OPERATING',
			parentId: input.parentId,
			isActive: input.isActive ?? true,
			normalDebit
		}
	});

	// Record activity event
	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: 'GL_ACCOUNT',
		entityId: account.id,
		action: 'CREATE',
		eventCategory: 'EXECUTION',
		summary: `GL Account created: ${account.accountNumber} - ${account.name}`,
		performedById: input.userId,
		performedByType: 'HUMAN',
		workflowId: 'glAccountWorkflow_v1',
		workflowStep: 'CREATE',
		workflowVersion: 'v1',
		newState: { accountNumber: account.accountNumber, name: account.name, accountType: account.accountType }
	});

	return {
		id: account.id,
		accountNumber: account.accountNumber,
		name: account.name,
		accountType: account.accountType,
		category: account.category,
		fundType: account.fundType,
		isActive: account.isActive
	};
}

async function updateGLAccount(
	input: GLAccountWorkflowInput
): Promise<{ id: string; accountNumber: string; name: string; isActive: boolean }> {
	const updateData: Record<string, unknown> = {};
	if (input.name !== undefined) updateData.name = input.name;
	if (input.description !== undefined) updateData.description = input.description;
	if (input.isActive !== undefined) updateData.isActive = input.isActive;
	if (input.parentId !== undefined) updateData.parentId = input.parentId;

	const account = await prisma.gLAccount.update({
		where: { id: input.accountId },
		data: updateData
	});

	// Record activity event
	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: 'GL_ACCOUNT',
		entityId: account.id,
		action: 'UPDATE',
		eventCategory: 'EXECUTION',
		summary: `GL Account updated: ${account.accountNumber}`,
		performedById: input.userId,
		performedByType: 'HUMAN',
		workflowId: 'glAccountWorkflow_v1',
		workflowStep: 'UPDATE',
		workflowVersion: 'v1',
		newState: updateData
	});

	return {
		id: account.id,
		accountNumber: account.accountNumber,
		name: account.name,
		isActive: account.isActive
	};
}

async function deleteGLAccount(
	accountId: string,
	organizationId: string,
	userId: string
): Promise<{ success: boolean }> {
	await prisma.gLAccount.update({
		where: { id: accountId },
		data: { deletedAt: new Date() }
	});

	// Record activity event
	await recordWorkflowEvent({
		organizationId,
		entityType: 'GL_ACCOUNT',
		entityId: accountId,
		action: 'DELETE',
		eventCategory: 'EXECUTION',
		summary: `GL Account soft deleted`,
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'glAccountWorkflow_v1',
		workflowStep: 'DELETE',
		workflowVersion: 'v1',
		newState: { deletedAt: new Date().toISOString() }
	});

	return { success: true };
}

// Main workflow function

async function glAccountWorkflow(input: GLAccountWorkflowInput): Promise<GLAccountWorkflowResult> {
	const workflowName = 'glAccountWorkflow_v1';
	const log = createWorkflowLogger(workflowName, DBOS.workflowID, input.action);
	const startTime = logWorkflowStart(log, input.action, {
		organizationId: input.organizationId,
		userId: input.userId,
		accountId: input.accountId
	}, workflowName, DBOS.workflowID);

	try {
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'started', action: input.action });

		switch (input.action) {
			case 'CREATE': {
				if (!input.associationId || !input.accountNumber || !input.name || !input.accountType || !input.category) {
					const error = new Error('Missing required fields for CREATE');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: createGLAccount starting', { accountNumber: input.accountNumber });
				const result = await DBOS.runStep(
					() => createGLAccount(input),
					{ name: 'createGLAccount' }
				);
				log.info('Step: createGLAccount completed', { id: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'account_created', ...result });
				const successResult: GLAccountWorkflowResult = {
					success: true,
					entityId: result.id,
					accountId: result.id,
					accountNumber: result.accountNumber,
					name: result.name,
					accountType: result.accountType,
					category: result.category,
					fundType: result.fundType,
					isActive: result.isActive
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'UPDATE': {
				if (!input.accountId) {
					const error = new Error('Missing required field: accountId for UPDATE');
					logStepError(log, 'validation', error, { accountId: input.accountId });
					throw error;
				}
				log.debug('Step: updateGLAccount starting', { accountId: input.accountId });
				const result = await DBOS.runStep(
					() => updateGLAccount(input),
					{ name: 'updateGLAccount' }
				);
				log.info('Step: updateGLAccount completed', { id: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'account_updated', ...result });
				const successResult: GLAccountWorkflowResult = {
					success: true,
					entityId: result.id,
					accountId: result.id,
					accountNumber: result.accountNumber,
					name: result.name,
					isActive: result.isActive
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'DELETE': {
				if (!input.accountId) {
					const error = new Error('Missing required field: accountId for DELETE');
					logStepError(log, 'validation', error, { accountId: input.accountId });
					throw error;
				}
				log.debug('Step: deleteGLAccount starting', { accountId: input.accountId });
				const result = await DBOS.runStep(
					() => deleteGLAccount(input.accountId!, input.organizationId, input.userId),
					{ name: 'deleteGLAccount' }
				);
				log.info('Step: deleteGLAccount completed', { accountId: input.accountId });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'account_deleted', accountId: input.accountId });
				const successResult: GLAccountWorkflowResult = {
					success: true,
					entityId: input.accountId,
					accountId: input.accountId
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			default: {
				const errorResult: GLAccountWorkflowResult = {
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
			accountId: input.accountId,
			error: errorMessage,
			stack: errorObj.stack
		});

		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'GL_ACCOUNT_WORKFLOW_ERROR'
		});
		const errorResult: GLAccountWorkflowResult = {
			success: false,
			error: errorMessage
		};
		logWorkflowEnd(log, input.action, false, startTime, errorResult);
		return errorResult;
	}
}

export const glAccountWorkflow_v1 = DBOS.registerWorkflow(glAccountWorkflow);

export async function startGLAccountWorkflow(
	input: GLAccountWorkflowInput,
	idempotencyKey: string
): Promise<GLAccountWorkflowResult> {
	return DBOS.startWorkflow(glAccountWorkflow_v1, { workflowID: idempotencyKey })(input);
}
