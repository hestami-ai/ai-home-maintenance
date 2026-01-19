/**
 * Journal Entry Workflow (v1)
 *
 * DBOS durable workflow for Journal Entry management.
 * Handles: create, post, and reverse operations.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import { orgTransaction } from '../db/rls.js';
import type { EntityWorkflowResult } from './schemas.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger, logWorkflowStart, logWorkflowEnd, logStepError } from './workflowLogger.js';
import {
	ActivityEntityType,
	ActivityActionType,
	ActivityEventCategory,
	ActivityActorType,
	JournalEntryStatus
} from '../../../../generated/prisma/enums.js';

// Workflow error types for tracing
const WorkflowErrorType = {
	JOURNAL_ENTRY_WORKFLOW_ERROR: 'JOURNAL_ENTRY_WORKFLOW_ERROR'
} as const;

const WORKFLOW_STATUS_EVENT = 'journal_entry_workflow_status';
const WORKFLOW_ERROR_EVENT = 'journal_entry_workflow_error';

// Action types for journal entry operations
export const JournalEntryWorkflowAction = {
	CREATE: 'CREATE',
	POST: 'POST',
	REVERSE: 'REVERSE'
} as const;

export type JournalEntryWorkflowAction = (typeof JournalEntryWorkflowAction)[keyof typeof JournalEntryWorkflowAction];

export interface JournalEntryLineInput {
	accountId: string;
	debitAmount?: number;
	creditAmount?: number;
	description?: string;
	referenceType?: string;
	referenceId?: string;
}

export interface JournalEntryWorkflowInput {
	action: JournalEntryWorkflowAction;
	organizationId: string;
	userId: string;
	associationId?: string;
	// CREATE fields
	entryDate?: string;
	description?: string;
	memo?: string | null;
	lines?: JournalEntryLineInput[];
	entryNumber?: string;
	totalDebits?: number;
	totalCredits?: number;
	// POST/REVERSE fields
	entryId?: string;
	// REVERSE fields
	reversalDate?: string;
	originalEntry?: {
		id: string;
		entryNumber: string;
		description: string;
		lines: Array<{
			accountId: string;
			debitAmount: number | null;
			creditAmount: number | null;
			description: string | null;
			referenceType: string | null;
			referenceId: string | null;
		}>;
	};
}

export interface JournalEntryWorkflowResult extends EntityWorkflowResult {
	entryId?: string;
	entryNumber?: string;
	entryDate?: string;
	description?: string;
	status?: string;
	postedAt?: string;
	totalDebits?: string;
	totalCredits?: string;
	[key: string]: unknown;
}

// Step functions

async function createJournalEntry(
	input: JournalEntryWorkflowInput
): Promise<{ id: string; entryNumber: string; entryDate: string; description: string; status: string }> {
	const journalEntry = await orgTransaction(input.organizationId, async (tx) => {
		return tx.journalEntry.create({
			data: {
				associationId: input.associationId!,
				entryNumber: input.entryNumber!,
				entryDate: new Date(input.entryDate!),
				description: input.description!,
				memo: input.memo,
				createdBy: input.userId,
				status: JournalEntryStatus.DRAFT,
				lines: {
					create: input.lines!.map((line, index) => ({
						accountId: line.accountId,
						debitAmount: line.debitAmount,
						creditAmount: line.creditAmount,
						description: line.description,
						referenceType: line.referenceType,
						referenceId: line.referenceId,
						lineNumber: index + 1
					}))
				}
			}
		});
	}, { userId: input.userId, reason: 'Creating journal entry' });

	// Record activity event
	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: ActivityEntityType.ORGANIZATION,
		entityId: journalEntry.id,
		action: ActivityActionType.CREATE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: `Journal entry created: ${journalEntry.entryNumber}`,
		performedById: input.userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'journalEntryWorkflow_v1',
		workflowStep: JournalEntryWorkflowAction.CREATE,
		workflowVersion: 'v1',
		newState: { entryNumber: journalEntry.entryNumber, description: journalEntry.description }
	});

	return {
		id: journalEntry.id,
		entryNumber: journalEntry.entryNumber,
		entryDate: journalEntry.entryDate.toISOString(),
		description: journalEntry.description,
		status: journalEntry.status
	};
}

async function postJournalEntry(
	input: JournalEntryWorkflowInput
): Promise<{ id: string; status: string; postedAt: string }> {
	const now = new Date();

	// Update GL account balances and post entry in a transaction with RLS context
	await orgTransaction(input.organizationId, async (tx) => {
		const entry = await tx.journalEntry.findUnique({
			where: { id: input.entryId },
			include: { lines: true }
		});

		if (!entry) {
			throw new Error('Journal entry not found');
		}

		for (const line of entry.lines) {
			const account = await tx.gLAccount.findUnique({
				where: { id: line.accountId }
			});

			if (account) {
				const debit = Number(line.debitAmount || 0);
				const credit = Number(line.creditAmount || 0);
				// For normal debit accounts: debits increase, credits decrease
				// For normal credit accounts: credits increase, debits decrease
				const change = account.normalDebit ? debit - credit : credit - debit;

				await tx.gLAccount.update({
					where: { id: line.accountId },
					data: {
						currentBalance: { increment: change }
					}
				});
			}
		}

		await tx.journalEntry.update({
			where: { id: input.entryId },
			data: {
				status: JournalEntryStatus.POSTED,
				postedAt: now,
				approvedBy: input.userId,
				approvedAt: now
			}
		});
	}, { userId: input.userId, reason: 'Posting journal entry and updating GL balances' });

	// Record activity event
	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: ActivityEntityType.ORGANIZATION,
		entityId: input.entryId!,
		action: ActivityActionType.UPDATE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: `Journal entry posted`,
		performedById: input.userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'journalEntryWorkflow_v1',
		workflowStep: JournalEntryWorkflowAction.POST,
		workflowVersion: 'v1',
		newState: { status: JournalEntryStatus.POSTED, postedAt: now.toISOString() }
	});

	return {
		id: input.entryId!,
		status: JournalEntryStatus.POSTED,
		postedAt: now.toISOString()
	};
}

async function reverseJournalEntry(
	input: JournalEntryWorkflowInput
): Promise<{ id: string; entryNumber: string }> {
	const originalEntry = input.originalEntry!;
	const now = new Date();

	// Create reversal entry and update GL balances in a transaction with RLS context
	const reversalEntry = await orgTransaction(input.organizationId, async (tx) => {
		const reversal = await tx.journalEntry.create({
			data: {
				associationId: input.associationId!,
				entryNumber: input.entryNumber!,
				entryDate: new Date(input.reversalDate!),
				description: `Reversal of ${originalEntry.entryNumber}: ${originalEntry.description}`,
				createdBy: input.userId,
				status: JournalEntryStatus.POSTED,
				isReversal: true,
				reversedEntryId: originalEntry.id,
				postedAt: now,
				approvedBy: input.userId,
				approvedAt: now,
				lines: {
					create: originalEntry.lines.map((line, index) => ({
						accountId: line.accountId,
						// Swap debits and credits
						debitAmount: line.creditAmount,
						creditAmount: line.debitAmount,
						description: `Reversal: ${line.description || ''}`,
						referenceType: line.referenceType,
						referenceId: line.referenceId,
						lineNumber: index + 1
					}))
				}
			}
		});

		// Update original entry status
		await tx.journalEntry.update({
			where: { id: originalEntry.id },
			data: { status: JournalEntryStatus.REVERSED }
		});

		// Update GL balances (reverse the original posting)
		for (const line of originalEntry.lines) {
			const account = await tx.gLAccount.findUnique({
				where: { id: line.accountId }
			});

			if (account) {
				const debit = Number(line.debitAmount || 0);
				const credit = Number(line.creditAmount || 0);
				// Reverse: subtract what was added
				const change = account.normalDebit ? credit - debit : debit - credit;

				await tx.gLAccount.update({
					where: { id: line.accountId },
					data: {
						currentBalance: { increment: change }
					}
				});
			}
		}

		return reversal;
	}, { userId: input.userId, reason: 'Reversing journal entry and updating GL balances' });

	// Record activity event
	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: ActivityEntityType.ORGANIZATION,
		entityId: reversalEntry.id,
		action: ActivityActionType.CREATE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: `Journal entry reversed: ${originalEntry.entryNumber}`,
		performedById: input.userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'journalEntryWorkflow_v1',
		workflowStep: JournalEntryWorkflowAction.REVERSE,
		workflowVersion: 'v1',
		newState: { reversalEntryNumber: reversalEntry.entryNumber, originalEntryId: originalEntry.id }
	});

	return {
		id: reversalEntry.id,
		entryNumber: reversalEntry.entryNumber
	};
}

// Main workflow function

async function journalEntryWorkflow(input: JournalEntryWorkflowInput): Promise<JournalEntryWorkflowResult> {
	const workflowName = 'journalEntryWorkflow_v1';
	const log = createWorkflowLogger(workflowName, DBOS.workflowID, input.action);
	const startTime = logWorkflowStart(log, input.action, {
		organizationId: input.organizationId,
		userId: input.userId,
		entryId: input.entryId
	}, workflowName, DBOS.workflowID);

	try {
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'started', action: input.action });

		switch (input.action) {
			case JournalEntryWorkflowAction.CREATE: {
				if (!input.associationId || !input.entryDate || !input.description || !input.lines || !input.entryNumber) {
					const error = new Error('Missing required fields for CREATE');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: createJournalEntry starting', { entryNumber: input.entryNumber });
				const result = await DBOS.runStep(
					() => createJournalEntry(input),
					{ name: 'createJournalEntry' }
				);
				log.info('Step: createJournalEntry completed', { id: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'entry_created', ...result });
				const successResult: JournalEntryWorkflowResult = {
					success: true,
					entityId: result.id,
					entryId: result.id,
					entryNumber: result.entryNumber,
					entryDate: result.entryDate,
					description: result.description,
					status: result.status,
					totalDebits: input.totalDebits?.toFixed(2),
					totalCredits: input.totalCredits?.toFixed(2)
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case JournalEntryWorkflowAction.POST: {
				if (!input.entryId) {
					const error = new Error('Missing required field: entryId for POST');
					logStepError(log, 'validation', error, { entryId: input.entryId });
					throw error;
				}
				log.debug('Step: postJournalEntry starting', { entryId: input.entryId });
				const result = await DBOS.runStep(
					() => postJournalEntry(input),
					{ name: 'postJournalEntry' }
				);
				log.info('Step: postJournalEntry completed', { id: result.id, postedAt: result.postedAt });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'entry_posted', ...result });
				const successResult: JournalEntryWorkflowResult = {
					success: true,
					entityId: result.id,
					entryId: result.id,
					status: result.status,
					postedAt: result.postedAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case JournalEntryWorkflowAction.REVERSE: {
				if (!input.originalEntry || !input.reversalDate || !input.entryNumber || !input.associationId) {
					const error = new Error('Missing required fields for REVERSE');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: reverseJournalEntry starting', { originalEntryId: input.originalEntry.id });
				const result = await DBOS.runStep(
					() => reverseJournalEntry(input),
					{ name: 'reverseJournalEntry' }
				);
				log.info('Step: reverseJournalEntry completed', { id: result.id, entryNumber: result.entryNumber });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'entry_reversed', ...result });
				const successResult: JournalEntryWorkflowResult = {
					success: true,
					entityId: result.id,
					entryId: result.id,
					entryNumber: result.entryNumber
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			default: {
				const errorResult: JournalEntryWorkflowResult = {
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
			entryId: input.entryId,
			error: errorMessage,
			stack: errorObj.stack
		});

		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: ActivityActionType.WORKFLOW_FAILED,
			errorType: WorkflowErrorType.JOURNAL_ENTRY_WORKFLOW_ERROR
		});
		const errorResult: JournalEntryWorkflowResult = {
			success: false,
			error: errorMessage
		};
		logWorkflowEnd(log, input.action, false, startTime, errorResult);
		return errorResult;
	}
}

export const journalEntryWorkflow_v1 = DBOS.registerWorkflow(journalEntryWorkflow);

export async function startJournalEntryWorkflow(
	input: JournalEntryWorkflowInput,
	idempotencyKey: string
): Promise<JournalEntryWorkflowResult> {
	const handle = await DBOS.startWorkflow(journalEntryWorkflow_v1, { workflowID: idempotencyKey })(input);
	return handle.getResult();
}
