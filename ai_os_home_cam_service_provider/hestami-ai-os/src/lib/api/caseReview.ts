/**
 * Case Review API client
 * Provides typed functions for post-completion case reviews
 * 
 * Types are extracted from the generated OpenAPI types to follow
 * the type generation pipeline: Prisma → Zod → oRPC → OpenAPI → types.generated.ts
 */

import { orpc } from './orpc.js';
import { v4 as uuidv4 } from 'uuid';
import type { operations } from './types.generated.js';

// =============================================================================
// Type Definitions (extracted from generated types)
// =============================================================================

// Extract CaseReview type from getByCase response
export type CaseReview = NonNullable<operations['caseReview.getByCase']['responses']['200']['content']['application/json']['data']['review']>;

// Extract input types
type CreateInput = operations['caseReview.create']['requestBody']['content']['application/json'];
type UpdateInput = operations['caseReview.update']['requestBody']['content']['application/json'];

// =============================================================================
// API Functions
// =============================================================================

export const caseReviewApi = {
	/**
	 * Create a case review
	 */
	create: (data: Omit<CreateInput, 'idempotencyKey'>) =>
		orpc.caseReview.create({
			...data,
			idempotencyKey: uuidv4()
		}),

	/**
	 * Get case review by case ID
	 */
	getByCase: (caseId: string) =>
		orpc.caseReview.getByCase({ caseId }),

	/**
	 * Update case review
	 */
	update: (data: Omit<UpdateInput, 'idempotencyKey'>) =>
		orpc.caseReview.update({
			...data,
			idempotencyKey: uuidv4()
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
