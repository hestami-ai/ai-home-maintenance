/**
 * Case Review Workflow (v1)
 *
 * DBOS durable workflow for case review operations.
 * Handles: CREATE, UPDATE.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { type EntityWorkflowResult } from './schemas.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger } from './workflowLogger.js';
import { orgTransaction } from '../db/rls.js';

const log = createWorkflowLogger('CaseReviewWorkflow');

// Action types for the unified workflow
export const CaseReviewAction = {
	CREATE: 'CREATE',
	UPDATE: 'UPDATE'
} as const;

export type CaseReviewAction = (typeof CaseReviewAction)[keyof typeof CaseReviewAction];

export interface CaseReviewWorkflowInput {
	action: CaseReviewAction;
	organizationId: string;
	userId: string;
	caseId: string;
	data: {
		outcomeSummary?: string;
		vendorPerformanceNotes?: string | null;
		issuesEncountered?: string | null;
		lessonsLearned?: string | null;
		vendorRating?: number | null;
		communicationRating?: number | null;
		timelinessRating?: number | null;
		overallSatisfaction?: number | null;
		reusableVendor?: boolean;
		reusableScope?: boolean;
		reusableProcess?: boolean;
	};
}

export interface CaseReviewWorkflowResult extends EntityWorkflowResult {
	reviewId?: string;
}

// Step functions
async function createCaseReview(
	organizationId: string,
	userId: string,
	caseId: string,
	data: CaseReviewWorkflowInput['data']
): Promise<{ reviewId: string }> {
	const review = await orgTransaction(organizationId, async (tx) => {
		return tx.caseReview.create({
			data: {
				caseId,
				outcomeSummary: data.outcomeSummary!,
				vendorPerformanceNotes: data.vendorPerformanceNotes,
				issuesEncountered: data.issuesEncountered,
				lessonsLearned: data.lessonsLearned,
				vendorRating: data.vendorRating,
				communicationRating: data.communicationRating,
				timelinessRating: data.timelinessRating,
				overallSatisfaction: data.overallSatisfaction,
				reusableVendor: data.reusableVendor ?? false,
				reusableScope: data.reusableScope ?? false,
				reusableProcess: data.reusableProcess ?? false,
				reviewedByUserId: userId,
				reviewedAt: new Date()
			}
		});
	}, { userId, reason: 'Create case review' });

	log.info('CREATE completed', { reviewId: review.id, caseId });
	return { reviewId: review.id };
}

async function updateCaseReview(
	organizationId: string,
	userId: string,
	caseId: string,
	data: CaseReviewWorkflowInput['data']
): Promise<{ reviewId: string }> {
	const review = await orgTransaction(organizationId, async (tx) => {
		return tx.caseReview.update({
			where: { caseId },
			data: {
				...(data.outcomeSummary !== undefined && { outcomeSummary: data.outcomeSummary }),
				...(data.vendorPerformanceNotes !== undefined && { vendorPerformanceNotes: data.vendorPerformanceNotes }),
				...(data.issuesEncountered !== undefined && { issuesEncountered: data.issuesEncountered }),
				...(data.lessonsLearned !== undefined && { lessonsLearned: data.lessonsLearned }),
				...(data.vendorRating !== undefined && { vendorRating: data.vendorRating }),
				...(data.communicationRating !== undefined && { communicationRating: data.communicationRating }),
				...(data.timelinessRating !== undefined && { timelinessRating: data.timelinessRating }),
				...(data.overallSatisfaction !== undefined && { overallSatisfaction: data.overallSatisfaction }),
				...(data.reusableVendor !== undefined && { reusableVendor: data.reusableVendor }),
				...(data.reusableScope !== undefined && { reusableScope: data.reusableScope }),
				...(data.reusableProcess !== undefined && { reusableProcess: data.reusableProcess })
			}
		});
	}, { userId, reason: 'Update case review' });

	log.info('UPDATE completed', { reviewId: review.id, caseId });
	return { reviewId: review.id };
}

// Main workflow function
async function caseReviewWorkflow(input: CaseReviewWorkflowInput): Promise<CaseReviewWorkflowResult> {
	try {
		switch (input.action) {
			case 'CREATE': {
				const result = await DBOS.runStep(
					() => createCaseReview(input.organizationId, input.userId, input.caseId, input.data),
					{ name: 'createCaseReview' }
				);
				return {
					success: true,
					entityId: result.reviewId,
					reviewId: result.reviewId
				};
			}

			case 'UPDATE': {
				const result = await DBOS.runStep(
					() => updateCaseReview(input.organizationId, input.userId, input.caseId, input.data),
					{ name: 'updateCaseReview' }
				);
				return { success: true, entityId: result.reviewId, reviewId: result.reviewId };
			}

			default:
				return { success: false, error: `Unknown action: ${input.action}` };
		}
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;
		log.error(`Error in ${input.action}:`, { error: errorMessage });

		await recordSpanError(errorObj, {
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'CASE_REVIEW_WORKFLOW_ERROR'
		});

		return { success: false, error: errorMessage };
	}
}

export const caseReviewWorkflow_v1 = DBOS.registerWorkflow(caseReviewWorkflow);

export async function startCaseReviewWorkflow(
	input: CaseReviewWorkflowInput,
	idempotencyKey: string
): Promise<CaseReviewWorkflowResult> {
	const handle = await DBOS.startWorkflow(caseReviewWorkflow_v1, { workflowID: idempotencyKey })(input);
	return handle.getResult();
}
