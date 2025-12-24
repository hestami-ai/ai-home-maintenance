/**
 * Vendor Bid API client
 * Provides typed functions for bid management and comparison
 */

import { apiCall } from './client';

// =============================================================================
// Types
// =============================================================================

export type BidStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';

export interface VendorBid {
	id: string;
	vendorCandidateId: string;
	caseId: string;
	vendorName: string;
	scopeVersion: string | null;
	amount: string | null;
	currency: string;
	validUntil: string | null;
	laborCost: string | null;
	materialsCost: string | null;
	otherCosts: string | null;
	estimatedStartDate: string | null;
	estimatedDuration: number | null;
	estimatedEndDate: string | null;
	status: BidStatus;
	receivedAt: string;
	respondedAt: string | null;
	notes: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface VendorBidListItem {
	id: string;
	vendorCandidateId: string;
	vendorName: string;
	amount: string | null;
	currency: string;
	status: BidStatus;
	validUntil: string | null;
	estimatedDuration: number | null;
	receivedAt: string;
}

export interface BidComparisonItem {
	id: string;
	vendorName: string;
	amount: string | null;
	laborCost: string | null;
	materialsCost: string | null;
	otherCosts: string | null;
	estimatedDuration: number | null;
	status: BidStatus;
	validUntil: string | null;
	isLowest: boolean;
	isFastest: boolean;
}

export interface BidComparison {
	caseId: string;
	bids: BidComparisonItem[];
	lowestBidId: string | null;
	fastestBidId: string | null;
	averageAmount: string | null;
}

// =============================================================================
// API Functions
// =============================================================================

export const vendorBidApi = {
	/**
	 * Create a new bid
	 */
	create: (data: {
		vendorCandidateId: string;
		caseId: string;
		scopeVersion?: string;
		amount?: number;
		currency?: string;
		validUntil?: string;
		laborCost?: number;
		materialsCost?: number;
		otherCosts?: number;
		estimatedStartDate?: string;
		estimatedDuration?: number;
		estimatedEndDate?: string;
		notes?: string;
		idempotencyKey: string;
	}, organizationId: string) =>
		apiCall<{ bid: VendorBid }>('vendorBid/create', {
			body: data,
			organizationId
		}),

	/**
	 * Get bid by ID
	 */
	get: (id: string, organizationId: string) =>
		apiCall<{ bid: VendorBid }>('vendorBid/get', {
			body: { id },
			organizationId
		}),

	/**
	 * List bids for a case
	 */
	listByCase: (params: {
		caseId: string;
		status?: BidStatus;
		limit?: number;
		cursor?: string;
	}, organizationId: string) =>
		apiCall<{
			bids: VendorBidListItem[];
			pagination: { hasMore: boolean; nextCursor: string | null };
		}>('vendorBid/listByCase', {
			body: params,
			organizationId
		}),

	/**
	 * Update bid details
	 */
	update: (data: {
		id: string;
		scopeVersion?: string | null;
		amount?: number | null;
		validUntil?: string | null;
		laborCost?: number | null;
		materialsCost?: number | null;
		otherCosts?: number | null;
		estimatedStartDate?: string | null;
		estimatedDuration?: number | null;
		estimatedEndDate?: string | null;
		notes?: string | null;
		idempotencyKey: string;
	}, organizationId: string) =>
		apiCall<{ bid: VendorBid }>('vendorBid/update', {
			body: data,
			organizationId
		}),

	/**
	 * Accept a bid
	 */
	accept: (data: {
		id: string;
		reason?: string;
		idempotencyKey: string;
	}, organizationId: string) =>
		apiCall<{ bid: VendorBid }>('vendorBid/accept', {
			body: data,
			organizationId
		}),

	/**
	 * Reject a bid
	 */
	reject: (data: {
		id: string;
		reason?: string;
		idempotencyKey: string;
	}, organizationId: string) =>
		apiCall<{ bid: VendorBid }>('vendorBid/reject', {
			body: data,
			organizationId
		}),

	/**
	 * Get bid comparison for a case
	 */
	compare: (caseId: string, organizationId: string) =>
		apiCall<{ comparison: BidComparison }>('vendorBid/compare', {
			body: { caseId },
			organizationId
		})
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
