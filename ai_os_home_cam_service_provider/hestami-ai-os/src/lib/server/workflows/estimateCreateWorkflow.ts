/**
 * Estimate Create Workflow (v1)
 *
 * DBOS durable workflow for creating estimates.
 * Provides idempotency, durability, and trace correlation for estimate creation.
 *
 * This is separate from estimateGeneration_v1 which handles status transitions.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import { EstimateStatus, type BaseWorkflowResult } from './schemas.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger } from './workflowLogger.js';
import {
	ActivityEntityType,
	ActivityActionType,
	ActivityEventCategory,
	ActivityActorType
} from '../../../../generated/prisma/enums.js';

// Workflow error types for tracing
const WorkflowErrorType = {
	ESTIMATE_CREATE_WORKFLOW_ERROR: 'ESTIMATE_CREATE_WORKFLOW_ERROR'
} as const;

// Workflow step constants
const EstimateCreateStep = {
	CREATE_ESTIMATE: 'CREATE_ESTIMATE'
} as const;

const log = createWorkflowLogger('EstimateCreateWorkflow');

const WORKFLOW_STATUS_EVENT = 'estimate_create_status';
const WORKFLOW_ERROR_EVENT = 'estimate_create_error';

export interface EstimateLine {
	description: string;
	quantity: number;
	unitPrice: number;
	pricebookItemId?: string;
	isTaxable?: boolean;
	taxRate?: number;
}

export interface EstimateCreateInput {
	organizationId: string;
	userId: string;
	jobId: string;
	customerId: string;
	title?: string;
	description?: string;
	notes?: string;
	terms?: string;
	validUntil?: string;
	discount?: number;
	lines?: EstimateLine[];
}

export interface EstimateCreateResult extends BaseWorkflowResult {
	estimateId?: string;
	estimateNumber?: string;
	status?: EstimateStatus;
	timestamp: string;
}

async function generateEstimateNumber(organizationId: string): Promise<string> {
	const year = new Date().getFullYear();
	const prefix = `EST-${year}-`;
	const count = await prisma.estimate.count({
		where: {
			organizationId,
			estimateNumber: { startsWith: prefix }
		}
	});
	return `${prefix}${String(count + 1).padStart(6, '0')}`;
}

function recalculateEstimateTotals(
	lines: Array<{ quantity: number; unitPrice: number; isTaxable?: boolean; taxRate?: number }>,
	discount?: number
): { subtotal: number; taxAmount: number; totalAmount: number } {
	let subtotal = 0;
	let taxAmount = 0;

	for (const line of lines) {
		const lineTotal = line.quantity * line.unitPrice;
		subtotal += lineTotal;
		if (line.isTaxable && line.taxRate) {
			taxAmount += lineTotal * (line.taxRate / 100);
		}
	}

	const discountAmount = discount ?? 0;
	const totalAmount = subtotal - discountAmount + taxAmount;

	return { subtotal, taxAmount, totalAmount };
}

async function createEstimate(input: EstimateCreateInput): Promise<{
	id: string;
	estimateNumber: string;
	status: EstimateStatus;
}> {
	const estimateNumber = await generateEstimateNumber(input.organizationId);

	const estimate = await prisma.$transaction(async (tx) => {
		// Calculate line totals
		const linesWithTotals = (input.lines ?? []).map((line, idx) => ({
			...line,
			lineNumber: idx + 1,
			lineTotal: line.quantity * line.unitPrice
		}));

		const { subtotal, taxAmount, totalAmount } = recalculateEstimateTotals(
			linesWithTotals,
			input.discount
		);

		const createdEstimate = await tx.estimate.create({
			data: {
				organizationId: input.organizationId,
				jobId: input.jobId,
				customerId: input.customerId,
				estimateNumber,
				title: input.title,
				description: input.description,
				notes: input.notes,
				terms: input.terms,
				validUntil: input.validUntil ? new Date(input.validUntil) : null,
				discount: input.discount,
				subtotal,
				taxAmount,
				totalAmount,
				createdBy: input.userId
			}
		});

		// Create lines
		if (linesWithTotals.length > 0) {
			await tx.estimateLine.createMany({
				data: linesWithTotals.map((line) => ({
					estimateId: createdEstimate.id,
					lineNumber: line.lineNumber,
					description: line.description,
					quantity: line.quantity,
					unitPrice: line.unitPrice,
					lineTotal: line.lineTotal,
					pricebookItemId: line.pricebookItemId,
					isTaxable: line.isTaxable,
					taxRate: line.taxRate
				}))
			});
		}

		return createdEstimate;
	});

	// Record activity event
	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: ActivityEntityType.ESTIMATE,
		entityId: estimate.id,
		action: ActivityActionType.CREATE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: `Estimate created: ${estimate.estimateNumber}`,
		performedById: input.userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'estimateCreateWorkflow_v1',
		workflowStep: EstimateCreateStep.CREATE_ESTIMATE,
		workflowVersion: 'v1',
		jobId: input.jobId,
		newState: {
			estimateNumber: estimate.estimateNumber,
			status: estimate.status
		}
	});

	return {
		id: estimate.id,
		estimateNumber: estimate.estimateNumber,
		status: estimate.status as EstimateStatus
	};
}

async function estimateCreateWorkflow(input: EstimateCreateInput): Promise<EstimateCreateResult> {
	try {
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'started' });

		const result = await DBOS.runStep(() => createEstimate(input), { name: 'createEstimate' });

		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, {
			step: 'completed',
			estimateId: result.id,
			estimateNumber: result.estimateNumber
		});

		return {
			success: true,
			estimateId: result.id,
			estimateNumber: result.estimateNumber,
			status: result.status,
			timestamp: new Date().toISOString()
		};
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;
		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: ActivityActionType.WORKFLOW_FAILED,
			errorType: WorkflowErrorType.ESTIMATE_CREATE_WORKFLOW_ERROR
		});

		return {
			success: false,
			timestamp: new Date().toISOString(),
			error: errorMessage
		};
	}
}

export const estimateCreateWorkflow_v1 = DBOS.registerWorkflow(estimateCreateWorkflow);

export async function startEstimateCreateWorkflow(
	input: EstimateCreateInput,
	idempotencyKey: string
): Promise<EstimateCreateResult> {
	const handle = await DBOS.startWorkflow(estimateCreateWorkflow_v1, {
		workflowID: idempotencyKey})(input);

	return handle.getResult();
}

export async function getEstimateCreateWorkflowStatus(
	workflowId: string
): Promise<{ step: string;[key: string]: unknown } | null> {
	const status = await DBOS.getEvent(workflowId, WORKFLOW_STATUS_EVENT, 0);
	return status as { step: string;[key: string]: unknown } | null;
}

