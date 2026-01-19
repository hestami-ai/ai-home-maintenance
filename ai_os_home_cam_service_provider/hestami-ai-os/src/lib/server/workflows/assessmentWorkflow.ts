/**
 * Assessment Workflow (v1)
 *
 * DBOS durable workflow for assessment type and charge management.
 * Handles: create assessment type, create assessment charge.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { orgTransaction } from '../db/rls.js';
import { postAssessmentChargeToGL } from '../accounting/index.js';
import type { EntityWorkflowResult } from './schemas.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger, logWorkflowStart, logWorkflowEnd, logStepError } from './workflowLogger.js';
import { createModuleLogger } from '../logger.js';
import type { AssessmentFrequency } from '../../../../generated/prisma/client.js';
import {
	ActivityEntityType,
	ActivityActionType,
	ActivityEventCategory,
	ActivityActorType,
	ChargeStatus
} from '../../../../generated/prisma/enums.js';

// Alias for backward compatibility
const AssessmentChargeStatus = ChargeStatus;

// Workflow error types for tracing
const WorkflowErrorType = {
	ASSESSMENT_WORKFLOW_ERROR: 'ASSESSMENT_WORKFLOW_ERROR',
	ASSESSMENT_CHARGE_GL_ERROR: 'AssessmentCharge_GL_Error'
} as const;

const log = createModuleLogger('assessmentWorkflow');
const WORKFLOW_STATUS_EVENT = 'assessment_workflow_status';
const WORKFLOW_ERROR_EVENT = 'assessment_workflow_error';

// Action types for assessment operations
export const AssessmentWorkflowAction = {
	CREATE_TYPE: 'CREATE_TYPE',
	CREATE_CHARGE: 'CREATE_CHARGE'
} as const;

export type AssessmentWorkflowAction = (typeof AssessmentWorkflowAction)[keyof typeof AssessmentWorkflowAction];

export interface AssessmentWorkflowInput {
	action: AssessmentWorkflowAction;
	organizationId: string;
	userId: string;
	// CREATE_TYPE fields
	associationId?: string;
	name?: string;
	description?: string | null;
	code?: string;
	frequency?: AssessmentFrequency;
	defaultAmount?: number;
	revenueAccountId?: string;
	lateFeeAccountId?: string | null;
	lateFeeAmount?: number | null;
	lateFeePercent?: number | null;
	gracePeriodDays?: number;
	prorateOnTransfer?: boolean;
	// CREATE_CHARGE fields
	unitId?: string;
	assessmentTypeId?: string;
	chargeDate?: string;
	dueDate?: string;
	periodStart?: string | null;
	periodEnd?: string | null;
	amount?: number;
	postToGL?: boolean;
}

export interface AssessmentWorkflowResult extends EntityWorkflowResult {
	assessmentTypeId?: string;
	assessmentTypeName?: string;
	assessmentTypeCode?: string;
	chargeId?: string;
	chargeAmount?: string;
	chargeDueDate?: string;
	chargeStatus?: string;
	[key: string]: unknown;
}

// Step functions

async function createAssessmentType(
	input: AssessmentWorkflowInput
): Promise<{ id: string; name: string; code: string; frequency: string; defaultAmount: string }> {
	const assessmentType = await orgTransaction(input.organizationId, async (tx) => {
		return tx.assessmentType.create({
			data: {
				organizationId: input.organizationId,
				associationId: input.associationId!,
				name: input.name!,
				description: input.description,
				code: input.code!,
				frequency: input.frequency!,
				defaultAmount: input.defaultAmount!,
				revenueAccountId: input.revenueAccountId!,
				lateFeeAccountId: input.lateFeeAccountId,
				lateFeeAmount: input.lateFeeAmount,
				lateFeePercent: input.lateFeePercent,
				gracePeriodDays: input.gracePeriodDays ?? 15,
				prorateOnTransfer: input.prorateOnTransfer ?? true
			}
		});
	}, { userId: input.userId, reason: 'Create assessment type' });

	// Record activity event
	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: ActivityEntityType.ASSESSMENT,
		entityId: assessmentType.id,
		action: ActivityActionType.CREATE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: `Assessment type created: ${assessmentType.name}`,
		performedById: input.userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'assessmentWorkflow_v1',
		workflowStep: AssessmentWorkflowAction.CREATE_TYPE,
		workflowVersion: 'v1',
		newState: { name: assessmentType.name, code: assessmentType.code, frequency: assessmentType.frequency }
	});

	return {
		id: assessmentType.id,
		name: assessmentType.name,
		code: assessmentType.code,
		frequency: assessmentType.frequency,
		defaultAmount: assessmentType.defaultAmount.toString()
	};
}

async function createAssessmentCharge(
	input: AssessmentWorkflowInput
): Promise<{ id: string; amount: string; dueDate: string; status: string }> {
	const charge = await orgTransaction(input.organizationId, async (tx) => {
		return tx.assessmentCharge.create({
			data: {
				associationId: input.associationId!,
				unitId: input.unitId!,
				assessmentTypeId: input.assessmentTypeId!,
				chargeDate: new Date(input.chargeDate!),
				dueDate: new Date(input.dueDate!),
				periodStart: input.periodStart ? new Date(input.periodStart) : null,
				periodEnd: input.periodEnd ? new Date(input.periodEnd) : null,
				amount: input.amount!,
				totalAmount: input.amount!,
				balanceDue: input.amount!,
				description: input.description,
				status: AssessmentChargeStatus.BILLED
			}
		});
	}, { userId: input.userId, reason: 'Create assessment charge' });

	// Post to GL if requested
	if (input.postToGL) {
		try {
			await postAssessmentChargeToGL(charge.id, input.userId);
		} catch (error) {
			const errorObj = error instanceof Error ? error : new Error(String(error));
			// Log but don't fail - GL posting can be done later
			console.warn(`Failed to post charge ${charge.id} to GL:`, error);
			await recordSpanError(errorObj, {
				errorCode: 'GL_POSTING_FAILED',
				errorType: WorkflowErrorType.ASSESSMENT_CHARGE_GL_ERROR
			});
		}
	}

	// Record activity event
	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: ActivityEntityType.ASSESSMENT,
		entityId: charge.id,
		action: ActivityActionType.CREATE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: `Assessment charge created: ${charge.amount}`,
		performedById: input.userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'assessmentWorkflow_v1',
		workflowStep: AssessmentWorkflowAction.CREATE_CHARGE,
		workflowVersion: 'v1',
		newState: { amount: charge.amount.toString(), dueDate: charge.dueDate.toISOString(), status: charge.status }
	});

	return {
		id: charge.id,
		amount: charge.amount.toString(),
		dueDate: charge.dueDate.toISOString(),
		status: charge.status
	};
}

// Main workflow function

async function assessmentWorkflow(input: AssessmentWorkflowInput): Promise<AssessmentWorkflowResult> {
	const workflowName = 'assessmentWorkflow_v1';
	const log = createWorkflowLogger(workflowName, DBOS.workflowID, input.action);
	const startTime = logWorkflowStart(log, input.action, {
		organizationId: input.organizationId,
		userId: input.userId
	}, workflowName, DBOS.workflowID);

	try {
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'started', action: input.action });

		switch (input.action) {
			case AssessmentWorkflowAction.CREATE_TYPE: {
				if (!input.associationId || !input.name || !input.code || !input.frequency || !input.defaultAmount || !input.revenueAccountId) {
					const error = new Error('Missing required fields for CREATE_TYPE');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: createAssessmentType starting', { name: input.name, code: input.code });
				const result = await DBOS.runStep(
					() => createAssessmentType(input),
					{ name: 'createAssessmentType' }
				);
				log.info('Step: createAssessmentType completed', { id: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'type_created', ...result });
				const successResult: AssessmentWorkflowResult = {
					success: true,
					entityId: result.id,
					assessmentTypeId: result.id,
					assessmentTypeName: result.name,
					assessmentTypeCode: result.code
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case AssessmentWorkflowAction.CREATE_CHARGE: {
				if (!input.associationId || !input.unitId || !input.assessmentTypeId || !input.chargeDate || !input.dueDate || !input.amount) {
					const error = new Error('Missing required fields for CREATE_CHARGE');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: createAssessmentCharge starting', { unitId: input.unitId, amount: input.amount });
				const result = await DBOS.runStep(
					() => createAssessmentCharge(input),
					{ name: 'createAssessmentCharge' }
				);
				log.info('Step: createAssessmentCharge completed', { id: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'charge_created', ...result });
				const successResult: AssessmentWorkflowResult = {
					success: true,
					entityId: result.id,
					chargeId: result.id,
					chargeAmount: result.amount,
					chargeDueDate: result.dueDate,
					chargeStatus: result.status
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			default: {
				const errorResult: AssessmentWorkflowResult = {
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
			error: errorMessage,
			stack: errorObj.stack
		});

		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: ActivityActionType.WORKFLOW_FAILED,
			errorType: WorkflowErrorType.ASSESSMENT_WORKFLOW_ERROR
		});
		const errorResult: AssessmentWorkflowResult = {
			success: false,
			error: errorMessage
		};
		logWorkflowEnd(log, input.action, false, startTime, errorResult);
		return errorResult;
	}
}

export const assessmentWorkflow_v1 = DBOS.registerWorkflow(assessmentWorkflow);

export async function startAssessmentWorkflow(
	input: AssessmentWorkflowInput,
	idempotencyKey: string
): Promise<AssessmentWorkflowResult> {
	const handle = await DBOS.startWorkflow(assessmentWorkflow_v1, { workflowID: idempotencyKey })(input);
	return handle.getResult();
}
