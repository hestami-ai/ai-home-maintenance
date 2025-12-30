/**
 * Phase 16.11: Case Review Routes
 * 
 * Manages post-completion reviews for institutional knowledge.
 */

import { z } from 'zod';
import { ResponseMetaSchema } from '../schemas.js';
import {
	orgProcedure,
	successResponse,
	IdempotencyKeySchema
} from '../router.js';
import { prisma } from '../../db.js';
import { recordExecution } from '../middleware/activityEvent.js';
import { createModuleLogger } from '../../logger.js';

const log = createModuleLogger('CaseReviewRoute');

// =============================================================================
// Schemas
// =============================================================================

const CaseReviewOutputSchema = z.object({
	id: z.string(),
	caseId: z.string(),
	outcomeSummary: z.string(),
	vendorPerformanceNotes: z.string().nullable(),
	issuesEncountered: z.string().nullable(),
	lessonsLearned: z.string().nullable(),
	vendorRating: z.number().nullable(),
	communicationRating: z.number().nullable(),
	timelinessRating: z.number().nullable(),
	overallSatisfaction: z.number().nullable(),
	reusableVendor: z.boolean(),
	reusableScope: z.boolean(),
	reusableProcess: z.boolean(),
	reviewedByUserId: z.string(),
	reviewedByUserName: z.string().nullable(),
	reviewedAt: z.string(),
	createdAt: z.string(),
	updatedAt: z.string()
});

// =============================================================================
// Helper Functions
// =============================================================================

function serializeCaseReview(review: any) {
	return {
		id: review.id,
		caseId: review.caseId,
		outcomeSummary: review.outcomeSummary,
		vendorPerformanceNotes: review.vendorPerformanceNotes,
		issuesEncountered: review.issuesEncountered,
		lessonsLearned: review.lessonsLearned,
		vendorRating: review.vendorRating,
		communicationRating: review.communicationRating,
		timelinessRating: review.timelinessRating,
		overallSatisfaction: review.overallSatisfaction,
		reusableVendor: review.reusableVendor,
		reusableScope: review.reusableScope,
		reusableProcess: review.reusableProcess,
		reviewedByUserId: review.reviewedByUserId,
		reviewedByUserName: review.reviewedBy?.name || null,
		reviewedAt: review.reviewedAt.toISOString(),
		createdAt: review.createdAt.toISOString(),
		updatedAt: review.updatedAt.toISOString()
	};
}

// =============================================================================
// Router
// =============================================================================

export const caseReviewRouter = {
	/**
	 * Create a case review
	 */
	create: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				caseId: z.string(),
				outcomeSummary: z.string().min(10).max(5000),
				vendorPerformanceNotes: z.string().max(2000).optional(),
				issuesEncountered: z.string().max(2000).optional(),
				lessonsLearned: z.string().max(2000).optional(),
				vendorRating: z.number().int().min(1).max(5).optional(),
				communicationRating: z.number().int().min(1).max(5).optional(),
				timelinessRating: z.number().int().min(1).max(5).optional(),
				overallSatisfaction: z.number().int().min(1).max(5).optional(),
				reusableVendor: z.boolean().optional(),
				reusableScope: z.boolean().optional(),
				reusableProcess: z.boolean().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					review: CaseReviewOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'ConciergeCase not found' },
			BAD_REQUEST: { message: 'A review already exists for this case' }
		})
		.handler(async ({ input, context, errors }) => {
			// Verify case exists and belongs to organization
			const caseRecord = await prisma.conciergeCase.findFirst({
				where: {
					id: input.caseId,
					organizationId: context.organization.id,
					deletedAt: null
				}
			});

			if (!caseRecord) {
				throw errors.NOT_FOUND({ message: 'ConciergeCase' });
			}

			// Check if review already exists
			const existingReview = await prisma.caseReview.findUnique({
				where: { caseId: input.caseId }
			});

			if (existingReview) {
				throw errors.BAD_REQUEST({ message: 'A review already exists for this case' });
			}

			await context.cerbos.authorize('create', 'case_review', 'new');

			const review = await prisma.caseReview.create({
				data: {
					caseId: input.caseId,
					outcomeSummary: input.outcomeSummary,
					vendorPerformanceNotes: input.vendorPerformanceNotes,
					issuesEncountered: input.issuesEncountered,
					lessonsLearned: input.lessonsLearned,
					vendorRating: input.vendorRating,
					communicationRating: input.communicationRating,
					timelinessRating: input.timelinessRating,
					overallSatisfaction: input.overallSatisfaction,
					reusableVendor: input.reusableVendor ?? false,
					reusableScope: input.reusableScope ?? false,
					reusableProcess: input.reusableProcess ?? false,
					reviewedByUserId: context.user.id,
					reviewedAt: new Date()
				},
				include: {
					reviewedBy: true
				}
			});

			await recordExecution(context, {
				entityType: 'CONCIERGE_CASE',
				entityId: input.caseId,
				action: 'UPDATE',
				summary: `Case review completed with overall satisfaction: ${input.overallSatisfaction || 'N/A'}/5`,
				caseId: input.caseId,
				newState: {
					reviewId: review.id,
					overallSatisfaction: input.overallSatisfaction,
					reusableVendor: input.reusableVendor,
					reusableScope: input.reusableScope
				}
			});

			return successResponse({ review: serializeCaseReview(review) }, context);
		}),

	/**
	 * Get case review by case ID
	 */
	getByCase: orgProcedure
		.input(z.object({ caseId: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					review: CaseReviewOutputSchema.nullable()
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'ConciergeCase not found' }
		})
		.handler(async ({ input, context, errors }) => {
			// Verify case belongs to organization
			const caseRecord = await prisma.conciergeCase.findFirst({
				where: {
					id: input.caseId,
					organizationId: context.organization.id
				}
			});

			if (!caseRecord) {
				throw errors.NOT_FOUND({ message: 'ConciergeCase' });
			}

			await context.cerbos.authorize('view', 'case_review', input.caseId);

			const review = await prisma.caseReview.findUnique({
				where: { caseId: input.caseId },
				include: { reviewedBy: true }
			});

			return successResponse(
				{ review: review ? serializeCaseReview(review) : null },
				context
			);
		}),

	/**
	 * Update case review
	 */
	update: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				caseId: z.string(),
				outcomeSummary: z.string().min(10).max(5000).optional(),
				vendorPerformanceNotes: z.string().max(2000).nullable().optional(),
				issuesEncountered: z.string().max(2000).nullable().optional(),
				lessonsLearned: z.string().max(2000).nullable().optional(),
				vendorRating: z.number().int().min(1).max(5).nullable().optional(),
				communicationRating: z.number().int().min(1).max(5).nullable().optional(),
				timelinessRating: z.number().int().min(1).max(5).nullable().optional(),
				overallSatisfaction: z.number().int().min(1).max(5).nullable().optional(),
				reusableVendor: z.boolean().optional(),
				reusableScope: z.boolean().optional(),
				reusableProcess: z.boolean().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					review: CaseReviewOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'CaseReview not found' }
		})
		.handler(async ({ input, context, errors }) => {
			const existing = await prisma.caseReview.findUnique({
				where: { caseId: input.caseId },
				include: { case: true }
			});

			if (!existing || existing.case?.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'CaseReview' });
			}

			await context.cerbos.authorize('update', 'case_review', existing.id);

			const review = await prisma.caseReview.update({
				where: { caseId: input.caseId },
				data: {
					...(input.outcomeSummary !== undefined && { outcomeSummary: input.outcomeSummary }),
					...(input.vendorPerformanceNotes !== undefined && { vendorPerformanceNotes: input.vendorPerformanceNotes }),
					...(input.issuesEncountered !== undefined && { issuesEncountered: input.issuesEncountered }),
					...(input.lessonsLearned !== undefined && { lessonsLearned: input.lessonsLearned }),
					...(input.vendorRating !== undefined && { vendorRating: input.vendorRating }),
					...(input.communicationRating !== undefined && { communicationRating: input.communicationRating }),
					...(input.timelinessRating !== undefined && { timelinessRating: input.timelinessRating }),
					...(input.overallSatisfaction !== undefined && { overallSatisfaction: input.overallSatisfaction }),
					...(input.reusableVendor !== undefined && { reusableVendor: input.reusableVendor }),
					...(input.reusableScope !== undefined && { reusableScope: input.reusableScope }),
					...(input.reusableProcess !== undefined && { reusableProcess: input.reusableProcess })
				},
				include: {
					reviewedBy: true
				}
			});

			await recordExecution(context, {
				entityType: 'CONCIERGE_CASE',
				entityId: input.caseId,
				action: 'UPDATE',
				summary: 'Case review updated',
				caseId: input.caseId
			});

			return successResponse({ review: serializeCaseReview(review) }, context);
		})
};
