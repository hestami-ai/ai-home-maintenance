/**
 * Case Review API client
 * Provides typed functions for post-completion case reviews
 */

import { apiCall } from './client';

// =============================================================================
// Types
// =============================================================================

export interface CaseReview {
	id: string;
	caseId: string;
	outcomeSummary: string;
	vendorPerformanceNotes: string | null;
	issuesEncountered: string | null;
	lessonsLearned: string | null;
	vendorRating: number | null;
	communicationRating: number | null;
	timelinessRating: number | null;
	overallSatisfaction: number | null;
	reusableVendor: boolean;
	reusableScope: boolean;
	reusableProcess: boolean;
	reviewedByUserId: string;
	reviewedByUserName: string | null;
	reviewedAt: string;
	createdAt: string;
	updatedAt: string;
}

// =============================================================================
// API Functions
// =============================================================================

export const caseReviewApi = {
	/**
	 * Create a case review
	 */
	create: (data: {
		caseId: string;
		outcomeSummary: string;
		vendorPerformanceNotes?: string;
		issuesEncountered?: string;
		lessonsLearned?: string;
		vendorRating?: number;
		communicationRating?: number;
		timelinessRating?: number;
		overallSatisfaction?: number;
		reusableVendor?: boolean;
		reusableScope?: boolean;
		reusableProcess?: boolean;
		idempotencyKey: string;
	}, organizationId: string) =>
		apiCall<{ review: CaseReview }>('caseReview/create', {
			body: data,
			organizationId
		}),

	/**
	 * Get case review by case ID
	 */
	getByCase: (caseId: string, organizationId: string) =>
		apiCall<{ review: CaseReview | null }>('caseReview/getByCase', {
			body: { caseId },
			organizationId
		}),

	/**
	 * Update case review
	 */
	update: (data: {
		caseId: string;
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
		idempotencyKey: string;
	}, organizationId: string) =>
		apiCall<{ review: CaseReview }>('caseReview/update', {
			body: data,
			organizationId
		})
};

// =============================================================================
// Helper Functions
// =============================================================================

export function generateIdempotencyKey(): string {
	return `review-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function formatRating(rating: number | null): string {
	if (rating === null) return 'Not rated';
	return '★'.repeat(rating) + '☆'.repeat(5 - rating);
}

export function getRatingLabel(rating: number | null): string {
	if (rating === null) return 'Not rated';
	const labels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];
	return labels[rating] || '';
}
