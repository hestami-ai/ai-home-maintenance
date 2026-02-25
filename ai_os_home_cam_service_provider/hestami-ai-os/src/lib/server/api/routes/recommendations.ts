/**
 * ML Recommendations API Routes
 *
 * Provides access to ML-based recommendations for cases.
 * Currently contains stubs that will be connected to actual ML services.
 */

import { z } from 'zod';
import { ResponseMetaSchema } from '$lib/schemas/index.js';
import { orgProcedure, successResponse } from '../router.js';
import {
	getVendorRecommendations,
	getStrategyRecommendation,
	exportTrainingData,
	recordRecommendationFeedback
} from '../../ml/recommendations.js';

// =============================================================================
// Schemas
// =============================================================================

const VendorRecommendationSchema = z.object({
	vendorCandidateId: z.string(),
	vendorName: z.string(),
	confidenceScore: z.number(),
	matchReasons: z.array(z.string()),
	estimatedCost: z.number().nullable(),
	estimatedDuration: z.number().nullable(),
	historicalPerformance: z
		.object({
			completedJobs: z.number(),
			avgRating: z.number().nullable(),
			onTimeRate: z.number().nullable()
		})
		.nullable()
});

const StrategyRecommendationSchema = z.object({
	recommendedApproach: z.string(),
	confidenceScore: z.number(),
	similarCaseIds: z.array(z.string()),
	suggestedVendors: z.array(VendorRecommendationSchema),
	estimatedTimeline: z
		.object({
			minDays: z.number(),
			maxDays: z.number(),
			avgDays: z.number()
		})
		.nullable(),
	budgetGuidance: z
		.object({
			minBudget: z.number(),
			maxBudget: z.number(),
			avgBudget: z.number()
		})
		.nullable(),
	riskFactors: z.array(z.string())
});

// =============================================================================
// Router
// =============================================================================

export const recommendationsRouter = {
	/**
	 * Get vendor recommendations for a case
	 */
	getVendorRecommendations: orgProcedure
		.input(
			z.object({
				caseId: z.string(),
				limit: z.number().int().min(1).max(20).default(5)
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					recommendations: z.array(VendorRecommendationSchema),
					isMLPowered: z.boolean()
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Case not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'concierge_case', input.caseId);

			const recommendations = await getVendorRecommendations(input.caseId, input.limit);

			return successResponse(
				{
					recommendations,
					isMLPowered: false // Will be true when connected to actual ML service
				},
				context
			);
		}),

	/**
	 * Get strategy recommendation for a case
	 */
	getStrategyRecommendation: orgProcedure
		.input(
			z.object({
				caseId: z.string()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					recommendation: StrategyRecommendationSchema.nullable(),
					isMLPowered: z.boolean()
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Case not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'concierge_case', input.caseId);

			const recommendation = await getStrategyRecommendation(input.caseId);

			return successResponse(
				{
					recommendation,
					isMLPowered: false // Will be true when connected to actual ML service
				},
				context
			);
		}),

	/**
	 * Record feedback on a recommendation
	 */
	recordFeedback: orgProcedure
		.input(
			z.object({
				caseId: z.string(),
				recommendationType: z.enum(['vendor', 'strategy']),
				recommendationId: z.string().optional(),
				wasHelpful: z.boolean(),
				userFeedback: z.string().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					recorded: z.boolean()
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			FORBIDDEN: { message: 'Access denied' }
		})
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'concierge_case', input.caseId);

			await recordRecommendationFeedback({
				caseId: input.caseId,
				recommendationType: input.recommendationType,
				recommendationId: input.recommendationId,
				wasHelpful: input.wasHelpful,
				userFeedback: input.userFeedback
			});

			return successResponse({ recorded: true }, context);
		}),

	/**
	 * Export training data (admin/staff only)
	 */
	exportTrainingData: orgProcedure
		.input(
			z.object({
				includeAllOrganizations: z.boolean().default(false)
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					recordCount: z.number(),
					exportedAt: z.string(),
					// The actual data is returned as JSON to avoid schema complexity
					trainingData: z.array(z.record(z.string(), z.unknown()))
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			FORBIDDEN: { message: 'Admin access required' }
		})
		.handler(async ({ input, context }) => {
			// Only staff with admin access can export training data
			await context.cerbos.authorize('export', 'ml_training_data', 'export');

			const organizationId = input.includeAllOrganizations ? undefined : context.organization.id;
			const trainingData = await exportTrainingData(organizationId);

			return successResponse(
				{
					recordCount: trainingData.length,
					exportedAt: new Date().toISOString(),
					trainingData: trainingData as unknown as Record<string, unknown>[]
				},
				context
			);
		})
};
