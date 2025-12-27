/**
 * Vendor Candidate API client
 * Provides typed functions for vendor discovery and management
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

// Extract VendorCandidate type from get response
export type VendorCandidate = operations['vendorCandidate.get']['responses']['200']['content']['application/json']['data']['vendorCandidate'];

// Extract VendorCandidateListItem from listByCase response
export type VendorCandidateListItem = operations['vendorCandidate.listByCase']['responses']['200']['content']['application/json']['data']['vendorCandidates'][number];

// Extract ExtractedVendorData from extract response
export type ExtractedVendorData = operations['vendorCandidate.extract']['responses']['200']['content']['application/json']['data']['extracted'];

// Extract VendorCandidateStatus from VendorCandidate
export type VendorCandidateStatus = VendorCandidate['status'];

// Extract input types
type CreateInput = operations['vendorCandidate.create']['requestBody']['content']['application/json'];
type UpdateInput = operations['vendorCandidate.update']['requestBody']['content']['application/json'];
type UpdateStatusInput = operations['vendorCandidate.updateStatus']['requestBody']['content']['application/json'];

// =============================================================================
// API Functions
// =============================================================================

export const vendorCandidateApi = {
	/**
	 * Create a new vendor candidate
	 */
	create: (data: Omit<CreateInput, 'idempotencyKey'>) =>
		orpc.vendorCandidate.create({
			...data,
			idempotencyKey: uuidv4()
		}),

	/**
	 * Get vendor candidate by ID
	 */
	get: (id: string) =>
		orpc.vendorCandidate.get({ id }),

	/**
	 * List vendor candidates for a case
	 */
	listByCase: (params: {
		caseId: string;
		status?: VendorCandidateStatus;
		limit?: number;
		cursor?: string;
	}) => orpc.vendorCandidate.listByCase(params),

	/**
	 * Update vendor candidate details
	 */
	update: (data: Omit<UpdateInput, 'idempotencyKey'>) =>
		orpc.vendorCandidate.update({
			...data,
			idempotencyKey: uuidv4()
		}),

	/**
	 * Update vendor candidate status
	 */
	updateStatus: (data: Omit<UpdateStatusInput, 'idempotencyKey'>) =>
		orpc.vendorCandidate.updateStatus({
			...data,
			idempotencyKey: uuidv4()
		}),

	/**
	 * Delete vendor candidate
	 */
	delete: (id: string) =>
		orpc.vendorCandidate.delete({
			id,
			idempotencyKey: uuidv4()
		}),

	/**
	 * Extract vendor information from source
	 */
	extract: (data: {
		caseId: string;
		sourceUrl?: string;
		sourceHtml?: string;
		sourcePlainText?: string;
	}) => orpc.vendorCandidate.extract(data)
};

// =============================================================================
// Helper Functions
// =============================================================================

export const STATUS_LABELS: Record<VendorCandidateStatus, string> = {
	IDENTIFIED: 'Identified',
	CONTACTED: 'Contacted',
	RESPONDED: 'Responded',
	QUOTED: 'Quoted',
	SELECTED: 'Selected',
	REJECTED: 'Rejected',
	ARCHIVED: 'Archived'
};

export const STATUS_COLORS: Record<VendorCandidateStatus, string> = {
	IDENTIFIED: 'preset-outlined-primary-500',
	CONTACTED: 'preset-outlined-secondary-500',
	RESPONDED: 'preset-outlined-tertiary-500',
	QUOTED: 'preset-filled-warning-500',
	SELECTED: 'preset-filled-success-500',
	REJECTED: 'preset-filled-error-500',
	ARCHIVED: 'preset-outlined-surface-500'
};

export const VALID_STATUS_TRANSITIONS: Record<VendorCandidateStatus, VendorCandidateStatus[]> = {
	IDENTIFIED: ['CONTACTED', 'REJECTED', 'ARCHIVED'],
	CONTACTED: ['RESPONDED', 'REJECTED', 'ARCHIVED'],
	RESPONDED: ['QUOTED', 'REJECTED', 'ARCHIVED'],
	QUOTED: ['SELECTED', 'REJECTED', 'ARCHIVED'],
	SELECTED: ['ARCHIVED'],
	REJECTED: ['ARCHIVED'],
	ARCHIVED: []
};

export function getConfidenceBadgeClass(confidence: number | null): string {
	if (confidence === null) return 'preset-outlined-surface-500';
	if (confidence >= 0.8) return 'preset-filled-success-500';
	if (confidence >= 0.5) return 'preset-filled-warning-500';
	return 'preset-filled-error-500';
}

export function formatConfidence(confidence: number | null): string {
	if (confidence === null) return 'N/A';
	return `${Math.round(confidence * 100)}%`;
}

export function generateIdempotencyKey(): string {
	return `vendor-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
