/**
 * ML Recommendations Infrastructure
 *
 * Prepares data pipeline for machine learning-based case recommendations.
 * This module provides:
 * - Data extraction functions for ML training
 * - Recommendation schema definitions
 * - Placeholder for ML service integration
 *
 * Future integration points:
 * - Connect to external ML service (AWS SageMaker, Vertex AI, custom)
 * - Feed case review outcomes back for model training
 * - Real-time recommendation scoring
 */

import { prisma } from '../db.js';
import { createModuleLogger } from '../logger.js';
import type {
	ConciergeCase,
	CaseReview,
	VendorCandidate,
	VendorBid
} from '../../../../generated/prisma/client.js';

const log = createModuleLogger('MLRecommendations');

// =============================================================================
// Types & Schemas
// =============================================================================

/**
 * Feature vector for a case - used for ML training and inference
 */
export interface CaseFeatureVector {
	// Case characteristics
	caseId: string;
	organizationId: string;
	priority: string;

	// Property context
	propertyType: string | null;
	propertySize: number | null;
	propertyAge: number | null;
	hasLinkedHoaUnit: boolean;

	// Historical data
	previousVendorCount: number;
	previousBidCount: number;
	avgBidAmount: number | null;
	avgBidDuration: number | null;

	// Outcome (for training)
	outcome: CaseOutcome | null;
}

/**
 * Case outcome data for supervised learning
 */
export interface CaseOutcome {
	wasSuccessful: boolean;
	overallSatisfaction: number | null;
	lessonsLearned: string | null;
	reusableVendor: boolean;
	reusableScope: boolean;
	reusableProcess: boolean;
}

/**
 * Vendor recommendation from ML model
 */
export interface VendorRecommendation {
	vendorCandidateId: string;
	vendorName: string;
	confidenceScore: number; // 0-1
	matchReasons: string[];
	estimatedCost: number | null;
	estimatedDuration: number | null;
	historicalPerformance: {
		completedJobs: number;
		avgRating: number | null;
		onTimeRate: number | null;
	} | null;
}

/**
 * Case strategy recommendation
 */
export interface StrategyRecommendation {
	recommendedApproach: string;
	confidenceScore: number;
	similarCaseIds: string[];
	suggestedVendors: VendorRecommendation[];
	estimatedTimeline: {
		minDays: number;
		maxDays: number;
		avgDays: number;
	} | null;
	budgetGuidance: {
		minBudget: number;
		maxBudget: number;
		avgBudget: number;
	} | null;
	riskFactors: string[];
}

// =============================================================================
// Data Extraction Functions
// =============================================================================

/**
 * Extract feature vector from a case for ML processing
 */
export async function extractCaseFeatures(caseId: string): Promise<CaseFeatureVector | null> {
	const conciergeCase = await prisma.conciergeCase.findUnique({
		where: { id: caseId },
		include: {
			property: true,
			vendorCandidates: {
				include: {
					bids: true
				}
			},
			review: true
		}
	});

	if (!conciergeCase) {
		return null;
	}

	// Calculate bid statistics
	const allBids = conciergeCase.vendorCandidates.flatMap(vc => vc.bids);
	const bidAmounts = allBids
		.map(b => b.amount?.toNumber())
		.filter((a): a is number => a !== null && a !== undefined);
	const bidDurations = allBids
		.map(b => b.estimatedDuration)
		.filter((d): d is number => d !== null && d !== undefined);

	const avgBidAmount = bidAmounts.length > 0
		? bidAmounts.reduce((a, b) => a + b, 0) / bidAmounts.length
		: null;
	const avgBidDuration = bidDurations.length > 0
		? bidDurations.reduce((a, b) => a + b, 0) / bidDurations.length
		: null;

	// Extract property age (if available)
	let propertyAge: number | null = null;
	if (conciergeCase.property?.yearBuilt) {
		propertyAge = new Date().getFullYear() - conciergeCase.property.yearBuilt;
	}

	// Extract outcome from review if available
	let outcome: CaseOutcome | null = null;
	const review = conciergeCase.review;
	if (review) {
		outcome = {
			wasSuccessful: review.overallSatisfaction !== null && review.overallSatisfaction >= 3,
			overallSatisfaction: review.overallSatisfaction,
			lessonsLearned: review.lessonsLearned,
			reusableVendor: review.reusableVendor,
			reusableScope: review.reusableScope,
			reusableProcess: review.reusableProcess
		};
	}

	return {
		caseId: conciergeCase.id,
		organizationId: conciergeCase.organizationId,
		priority: conciergeCase.priority,
		propertyType: conciergeCase.property?.propertyType ?? null,
		propertySize: conciergeCase.property?.squareFeet ?? null,
		propertyAge,
		hasLinkedHoaUnit: conciergeCase.property?.linkedUnitId !== null,
		previousVendorCount: conciergeCase.vendorCandidates.length,
		previousBidCount: allBids.length,
		avgBidAmount,
		avgBidDuration,
		outcome
	};
}

/**
 * Export all completed cases for ML training
 */
export async function exportTrainingData(organizationId?: string): Promise<CaseFeatureVector[]> {
	const cases = await prisma.conciergeCase.findMany({
		where: {
			...(organizationId && { organizationId }),
			closedAt: { not: null },
			review: { isNot: null }
		},
		select: {
			id: true
		}
	});

	log.info('Exporting training data', {
		organizationId,
		caseCount: cases.length
	});

	const features: CaseFeatureVector[] = [];
	for (const c of cases) {
		const featureVector = await extractCaseFeatures(c.id);
		if (featureVector && featureVector.outcome) {
			features.push(featureVector);
		}
	}

	log.info('Training data export complete', {
		exportedCount: features.length
	});

	return features;
}

// =============================================================================
// Recommendation Functions (Stubs for ML Integration)
// =============================================================================

/**
 * Get vendor recommendations for a case
 * Currently returns placeholder data - to be connected to ML service
 */
export async function getVendorRecommendations(
	caseId: string,
	_limit = 5
): Promise<VendorRecommendation[]> {
	// TODO: Connect to ML service for actual recommendations
	// For now, return vendors ordered by extraction confidence

	const vendorCandidates = await prisma.vendorCandidate.findMany({
		where: {
			caseId,
			status: { not: 'ARCHIVED' },
			deletedAt: null
		},
		orderBy: [
			{ extractionConfidence: 'desc' },
			{ createdAt: 'asc' }
		],
		take: _limit
	});

	return vendorCandidates.map(vc => ({
		vendorCandidateId: vc.id,
		vendorName: vc.vendorName,
		confidenceScore: vc.extractionConfidence ?? 0.5,
		matchReasons: ['Based on extraction confidence'],
		estimatedCost: null,
		estimatedDuration: null,
		historicalPerformance: null
	}));
}

/**
 * Get strategy recommendation for a case
 * Currently returns placeholder data - to be connected to ML service
 */
export async function getStrategyRecommendation(
	caseId: string
): Promise<StrategyRecommendation | null> {
	// TODO: Connect to ML service for actual strategy recommendations

	const features = await extractCaseFeatures(caseId);
	if (!features) {
		return null;
	}

	// Find similar cases based on priority and property type
	const similarCases = await prisma.conciergeCase.findMany({
		where: {
			id: { not: caseId },
			organizationId: features.organizationId,
			closedAt: { not: null },
			priority: features.priority as 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
		},
		select: { id: true },
		take: 5
	});

	const vendors = await getVendorRecommendations(caseId);

	return {
		recommendedApproach: 'Standard vendor selection process',
		confidenceScore: 0.6, // Placeholder
		similarCaseIds: similarCases.map(c => c.id),
		suggestedVendors: vendors,
		estimatedTimeline: features.avgBidDuration
			? {
					minDays: Math.floor(features.avgBidDuration * 0.8),
					maxDays: Math.ceil(features.avgBidDuration * 1.5),
					avgDays: Math.round(features.avgBidDuration)
				}
			: null,
		budgetGuidance: features.avgBidAmount
			? {
					minBudget: Math.floor(features.avgBidAmount * 0.8),
					maxBudget: Math.ceil(features.avgBidAmount * 1.3),
					avgBudget: Math.round(features.avgBidAmount)
				}
			: null,
		riskFactors: []
	};
}

/**
 * Record feedback on a recommendation for model improvement
 */
export async function recordRecommendationFeedback(input: {
	caseId: string;
	recommendationType: 'vendor' | 'strategy';
	recommendationId?: string;
	wasHelpful: boolean;
	userFeedback?: string;
}): Promise<void> {
	// TODO: Store feedback for model retraining

	log.info('Recommendation feedback recorded', {
		caseId: input.caseId,
		recommendationType: input.recommendationType,
		wasHelpful: input.wasHelpful
	});

	// In a real implementation, this would:
	// 1. Store the feedback in a dedicated table
	// 2. Potentially trigger model retraining
	// 3. Update recommendation weights
}
