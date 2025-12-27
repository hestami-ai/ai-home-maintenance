/**
 * Vendor Bid API client
 * Provides typed functions for bid management and comparison
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

// Extract VendorBid type from get response
export type VendorBid = operations['vendorBid.get']['responses']['200']['content']['application/json']['data']['bid'];

// Extract VendorBidListItem from listByCase response
export type VendorBidListItem = operations['vendorBid.listByCase']['responses']['200']['content']['application/json']['data']['bids'][number];

// Extract BidComparison from compare response
export type BidComparison = operations['vendorBid.compare']['responses']['200']['content']['application/json']['data']['comparison'];

// Extract BidComparisonItem from BidComparison
export type BidComparisonItem = BidComparison['bids'][number];

// Extract BidStatus from VendorBid
export type BidStatus = VendorBid['status'];

// Extract input types
type CreateInput = operations['vendorBid.create']['requestBody']['content']['application/json'];
type UpdateInput = operations['vendorBid.update']['requestBody']['content']['application/json'];

// =============================================================================
// API Functions
// =============================================================================

export const vendorBidApi = {
	/**
	 * Create a new bid
	 */
	create: (data: Omit<CreateInput, 'idempotencyKey'>) =>
		orpc.vendorBid.create({
			...data,
			idempotencyKey: uuidv4()
		}),

	/**
	 * Get bid by ID
	 */
	get: (id: string) =>
		orpc.vendorBid.get({ id }),

	/**
	 * List bids for a case
	 */
	listByCase: (params: {
		caseId: string;
		status?: BidStatus;
		limit?: number;
		cursor?: string;
	}) => orpc.vendorBid.listByCase(params),

	/**
	 * Update bid details
	 */
	update: (data: Omit<UpdateInput, 'idempotencyKey'>) =>
		orpc.vendorBid.update({
			...data,
			idempotencyKey: uuidv4()
		}),

	/**
	 * Accept a bid
	 */
	accept: (id: string, reason?: string) =>
		orpc.vendorBid.accept({
			id,
			reason,
			idempotencyKey: uuidv4()
		}),

	/**
	 * Reject a bid
	 */
	reject: (id: string, reason?: string) =>
		orpc.vendorBid.reject({
			id,
			reason,
			idempotencyKey: uuidv4()
		}),

	/**
	 * Get bid comparison for a case
	 */
	compare: (caseId: string) =>
		orpc.vendorBid.compare({ caseId })
};

// =============================================================================
// Helper Functions
// =============================================================================

export const STATUS_LABELS: Record<BidStatus, string> = {
	PENDING: 'Pending',
	ACCEPTED: 'Accepted',
	REJECTED: 'Rejected',
	EXPIRED: 'Expired'
};

export const STATUS_COLORS: Record<BidStatus, string> = {
	PENDING: 'preset-outlined-warning-500',
	ACCEPTED: 'preset-filled-success-500',
	REJECTED: 'preset-filled-error-500',
	EXPIRED: 'preset-outlined-surface-500'
};

export function formatCurrency(amount: string | null, currency = 'USD'): string {
	if (!amount) return 'TBD';
	const num = parseFloat(amount);
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency
	}).format(num);
}

export function formatDuration(days: number | null): string {
	if (days === null) return 'TBD';
	if (days === 1) return '1 day';
	if (days < 7) return `${days} days`;
	const weeks = Math.floor(days / 7);
	const remainingDays = days % 7;
	if (remainingDays === 0) return weeks === 1 ? '1 week' : `${weeks} weeks`;
	return `${weeks}w ${remainingDays}d`;
}

export function generateIdempotencyKey(): string {
	return `bid-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
