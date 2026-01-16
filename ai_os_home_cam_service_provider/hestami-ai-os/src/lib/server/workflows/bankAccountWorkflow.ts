/**
 * Bank Account Workflow (v1)
 *
 * DBOS durable workflow for bank account management.
 * Handles: create, update, deactivate, and update balance operations.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import type { EntityWorkflowResult } from './schemas.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger, logWorkflowStart, logWorkflowEnd, logStepError } from './workflowLogger.js';
import { orgTransaction } from '../db/rls.js';
import type { BankAccountType, FundType } from '../../../../generated/prisma/client.js';

const WORKFLOW_STATUS_EVENT = 'bank_account_workflow_status';
const WORKFLOW_ERROR_EVENT = 'bank_account_workflow_error';

// Action types for bank account operations
export const BankAccountWorkflowAction = {
	CREATE: 'CREATE',
	UPDATE: 'UPDATE',
	DEACTIVATE: 'DEACTIVATE',
	UPDATE_BALANCE: 'UPDATE_BALANCE'
} as const;

export type BankAccountWorkflowAction = (typeof BankAccountWorkflowAction)[keyof typeof BankAccountWorkflowAction];

export interface BankAccountWorkflowInput {
	action: BankAccountWorkflowAction;
	organizationId: string;
	userId: string;
	// CREATE fields
	associationId?: string;
	glAccountId?: string;
	bankName?: string;
	accountName?: string;
	accountNumber?: string;
	routingNumber?: string | null;
	accountType?: BankAccountType;
	fundType?: FundType;
	isPrimary?: boolean;
	// UPDATE/DEACTIVATE/UPDATE_BALANCE fields
	bankAccountId?: string;
	isActive?: boolean;
	// UPDATE_BALANCE fields
	bankBalance?: number;
	reconcileDate?: string | null;
}

export interface BankAccountWorkflowResult extends EntityWorkflowResult {
	bankAccountId?: string;
	bankName?: string;
	accountName?: string;
	accountNumber?: string;
	fundType?: string;
	isPrimary?: boolean;
	isActive?: boolean;
	bookBalance?: string;
	bankBalance?: string;
	difference?: string;
	lastReconciled?: string | null;
	[key: string]: unknown;
}

// Step functions

async function createBankAccount(
	input: BankAccountWorkflowInput
): Promise<{ id: string; bankName: string; accountName: string; accountNumber: string; accountType: string; fundType: string; isPrimary: boolean }> {
	return orgTransaction(input.organizationId, async (tx) => {
		// If setting as primary, unset other primary accounts of same fund type
		if (input.isPrimary) {
			await tx.bankAccount.updateMany({
				where: {
					associationId: input.associationId,
					fundType: input.fundType,
					isPrimary: true
				},
				data: { isPrimary: false }
			});
		}

		const bankAccount = await tx.bankAccount.create({
			data: {
				organizationId: input.organizationId,
				associationId: input.associationId!,
				glAccountId: input.glAccountId!,
				bankName: input.bankName!,
				accountName: input.accountName!,
				accountNumber: input.accountNumber!,
				routingNumber: input.routingNumber,
				accountType: input.accountType!,
				fundType: input.fundType ?? 'OPERATING',
				isPrimary: input.isPrimary ?? false
			}
		});

		// Record activity event
		await recordWorkflowEvent({
			organizationId: input.organizationId,
			entityType: 'ORGANIZATION',
			entityId: bankAccount.id,
			action: 'CREATE',
			eventCategory: 'EXECUTION',
			summary: `Bank account created: ${bankAccount.bankName} - ${bankAccount.accountName}`,
			performedById: input.userId,
			performedByType: 'HUMAN',
			workflowId: 'bankAccountWorkflow_v1',
			workflowStep: 'CREATE',
			workflowVersion: 'v1',
			newState: { bankName: bankAccount.bankName, accountName: bankAccount.accountName, fundType: bankAccount.fundType }
		});

		return {
			id: bankAccount.id,
			bankName: bankAccount.bankName,
			accountName: bankAccount.accountName,
			accountNumber: bankAccount.accountNumber,
			accountType: bankAccount.accountType,
			fundType: bankAccount.fundType,
			isPrimary: bankAccount.isPrimary
		};
	}, { userId: input.userId, reason: 'Creating bank account' });
}

async function updateBankAccount(
	input: BankAccountWorkflowInput,
	existingFundType: FundType
): Promise<{ id: string; bankName: string; accountName: string; isPrimary: boolean; isActive: boolean }> {
	return orgTransaction(input.organizationId, async (tx) => {
		// If setting as primary, unset other primary accounts of same fund type
		if (input.isPrimary === true) {
			await tx.bankAccount.updateMany({
				where: {
					associationId: input.associationId,
					fundType: existingFundType,
					isPrimary: true,
					id: { not: input.bankAccountId }
				},
				data: { isPrimary: false }
			});
		}

		const updateData: Record<string, unknown> = {};
		if (input.bankName !== undefined) updateData.bankName = input.bankName;
		if (input.accountName !== undefined) updateData.accountName = input.accountName;
		if (input.accountNumber !== undefined) updateData.accountNumber = input.accountNumber;
		if (input.routingNumber !== undefined) updateData.routingNumber = input.routingNumber;
		if (input.isPrimary !== undefined) updateData.isPrimary = input.isPrimary;
		if (input.isActive !== undefined) updateData.isActive = input.isActive;

		const bankAccount = await tx.bankAccount.update({
			where: { id: input.bankAccountId },
			data: updateData
		});

		// Record activity event
		await recordWorkflowEvent({
			organizationId: input.organizationId,
			entityType: 'ORGANIZATION',
			entityId: bankAccount.id,
			action: 'UPDATE',
			eventCategory: 'EXECUTION',
			summary: `Bank account updated: ${bankAccount.bankName}`,
			performedById: input.userId,
			performedByType: 'HUMAN',
			workflowId: 'bankAccountWorkflow_v1',
			workflowStep: 'UPDATE',
			workflowVersion: 'v1',
			newState: updateData
		});

		return {
			id: bankAccount.id,
			bankName: bankAccount.bankName,
			accountName: bankAccount.accountName,
			isPrimary: bankAccount.isPrimary,
			isActive: bankAccount.isActive
		};
	}, { userId: input.userId, reason: 'Updating bank account' });
}

async function deactivateBankAccount(
	bankAccountId: string,
	organizationId: string,
	userId: string
): Promise<{ success: boolean }> {
	return orgTransaction(organizationId, async (tx) => {
		await tx.bankAccount.update({
			where: { id: bankAccountId },
			data: { isActive: false, isPrimary: false }
		});

		// Record activity event
		await recordWorkflowEvent({
			organizationId,
			entityType: 'ORGANIZATION',
			entityId: bankAccountId,
			action: 'DELETE',
			eventCategory: 'EXECUTION',
			summary: `Bank account deactivated`,
			performedById: userId,
			performedByType: 'HUMAN',
			workflowId: 'bankAccountWorkflow_v1',
			workflowStep: 'DEACTIVATE',
			workflowVersion: 'v1',
			newState: { isActive: false, isPrimary: false }
		});

		return { success: true };
	}, { userId, reason: 'Deactivating bank account' });
}

async function updateBankBalance(
	input: BankAccountWorkflowInput
): Promise<{ id: string; bookBalance: string; bankBalance: string; difference: string; lastReconciled: string | null }> {
	return orgTransaction(input.organizationId, async (tx) => {
		const bankAccount = await tx.bankAccount.update({
			where: { id: input.bankAccountId },
			data: {
				bankBalance: input.bankBalance,
				lastReconciled: input.reconcileDate ? new Date(input.reconcileDate) : new Date()
			}
		});

		const difference = Number(bankAccount.bookBalance) - Number(bankAccount.bankBalance);

		// Record activity event
		await recordWorkflowEvent({
			organizationId: input.organizationId,
			entityType: 'ORGANIZATION',
			entityId: bankAccount.id,
			action: 'UPDATE',
			eventCategory: 'EXECUTION',
			summary: `Bank balance updated for reconciliation`,
			performedById: input.userId,
			performedByType: 'HUMAN',
			workflowId: 'bankAccountWorkflow_v1',
			workflowStep: 'UPDATE_BALANCE',
			workflowVersion: 'v1',
			newState: { bankBalance: bankAccount.bankBalance.toString(), lastReconciled: bankAccount.lastReconciled?.toISOString() }
		});

		return {
			id: bankAccount.id,
			bookBalance: bankAccount.bookBalance.toString(),
			bankBalance: bankAccount.bankBalance.toString(),
			difference: difference.toFixed(2),
			lastReconciled: bankAccount.lastReconciled?.toISOString() ?? null
		};
	}, { userId: input.userId, reason: 'Updating bank balance for reconciliation' });
}

// Main workflow function

async function bankAccountWorkflow(input: BankAccountWorkflowInput & { existingFundType?: FundType }): Promise<BankAccountWorkflowResult> {
	const workflowName = 'bankAccountWorkflow_v1';
	const log = createWorkflowLogger(workflowName, DBOS.workflowID, input.action);
	const startTime = logWorkflowStart(log, input.action, {
		organizationId: input.organizationId,
		userId: input.userId,
		bankAccountId: input.bankAccountId
	}, workflowName, DBOS.workflowID);

	try {
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'started', action: input.action });

		switch (input.action) {
			case 'CREATE': {
				if (!input.associationId || !input.glAccountId || !input.bankName || !input.accountName || !input.accountNumber || !input.accountType) {
					const error = new Error('Missing required fields for CREATE');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: createBankAccount starting', { bankName: input.bankName });
				const result = await DBOS.runStep(
					() => createBankAccount(input),
					{ name: 'createBankAccount' }
				);
				log.info('Step: createBankAccount completed', { id: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'bank_account_created', ...result });
				const successResult: BankAccountWorkflowResult = {
					success: true,
					entityId: result.id,
					bankAccountId: result.id,
					bankName: result.bankName,
					accountName: result.accountName,
					accountNumber: result.accountNumber,
					fundType: result.fundType,
					isPrimary: result.isPrimary
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'UPDATE': {
				if (!input.bankAccountId) {
					const error = new Error('Missing required field: bankAccountId for UPDATE');
					logStepError(log, 'validation', error, { bankAccountId: input.bankAccountId });
					throw error;
				}
				log.debug('Step: updateBankAccount starting', { bankAccountId: input.bankAccountId });
				const result = await DBOS.runStep(
					() => updateBankAccount(input, input.existingFundType!),
					{ name: 'updateBankAccount' }
				);
				log.info('Step: updateBankAccount completed', { id: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'bank_account_updated', ...result });
				const successResult: BankAccountWorkflowResult = {
					success: true,
					entityId: result.id,
					bankAccountId: result.id,
					bankName: result.bankName,
					accountName: result.accountName,
					isPrimary: result.isPrimary,
					isActive: result.isActive
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'DEACTIVATE': {
				if (!input.bankAccountId) {
					const error = new Error('Missing required field: bankAccountId for DEACTIVATE');
					logStepError(log, 'validation', error, { bankAccountId: input.bankAccountId });
					throw error;
				}
				log.debug('Step: deactivateBankAccount starting', { bankAccountId: input.bankAccountId });
				const result = await DBOS.runStep(
					() => deactivateBankAccount(input.bankAccountId!, input.organizationId, input.userId),
					{ name: 'deactivateBankAccount' }
				);
				log.info('Step: deactivateBankAccount completed', { bankAccountId: input.bankAccountId });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'bank_account_deactivated', bankAccountId: input.bankAccountId });
				const successResult: BankAccountWorkflowResult = {
					success: true,
					entityId: input.bankAccountId,
					bankAccountId: input.bankAccountId
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'UPDATE_BALANCE': {
				if (!input.bankAccountId || input.bankBalance === undefined) {
					const error = new Error('Missing required fields for UPDATE_BALANCE');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: updateBankBalance starting', { bankAccountId: input.bankAccountId });
				const result = await DBOS.runStep(
					() => updateBankBalance(input),
					{ name: 'updateBankBalance' }
				);
				log.info('Step: updateBankBalance completed', { id: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'bank_balance_updated', ...result });
				const successResult: BankAccountWorkflowResult = {
					success: true,
					entityId: result.id,
					bankAccountId: result.id,
					bookBalance: result.bookBalance,
					bankBalance: result.bankBalance,
					difference: result.difference,
					lastReconciled: result.lastReconciled
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			default: {
				const errorResult: BankAccountWorkflowResult = {
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
			bankAccountId: input.bankAccountId,
			error: errorMessage,
			stack: errorObj.stack
		});

		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'BANK_ACCOUNT_WORKFLOW_ERROR'
		});
		const errorResult: BankAccountWorkflowResult = {
			success: false,
			error: errorMessage
		};
		logWorkflowEnd(log, input.action, false, startTime, errorResult);
		return errorResult;
	}
}

export const bankAccountWorkflow_v1 = DBOS.registerWorkflow(bankAccountWorkflow);

export async function startBankAccountWorkflow(
	input: BankAccountWorkflowInput & { existingFundType?: FundType },
	idempotencyKey: string
): Promise<BankAccountWorkflowResult> {
	const handle = await DBOS.startWorkflow(bankAccountWorkflow_v1, { workflowID: idempotencyKey })(input);
	return handle.getResult();
}
