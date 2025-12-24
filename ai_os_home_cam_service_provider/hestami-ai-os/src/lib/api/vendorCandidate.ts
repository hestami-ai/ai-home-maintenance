/**
 * Vendor Candidate API client
 * Provides typed functions for vendor discovery and management
 */

import { apiCall } from './client';

// =============================================================================
// Types
// =============================================================================

export type VendorCandidateStatus =
	| 'IDENTIFIED'
	| 'CONTACTED'
	| 'RESPONDED'
	| 'QUOTED'
	| 'SELECTED'
	| 'REJECTED'
	| 'ARCHIVED';

export interface VendorCandidate {
	id: string;
	caseId: string;
	vendorName: string;
	vendorContactName: string | null;
	vendorContactEmail: string | null;
	vendorContactPhone: string | null;
	vendorAddress: string | null;
	vendorWebsite: string | null;
	serviceCategories: string[] | null;
	coverageArea: string | null;
	licensesAndCerts: string[] | null;
	status: VendorCandidateStatus;
	statusChangedAt: string | null;
	sourceUrl: string | null;
	extractedAt: string | null;
	extractionConfidence: number | null;
	notes: string | null;
	riskFlags: string[] | null;
	createdAt: string;
	updatedAt: string;
}

export interface VendorCandidateListItem {
	id: string;
	caseId: string;
	vendorName: string;
	vendorContactEmail: string | null;
	vendorContactPhone: string | null;
	serviceCategories: string[] | null;
	status: VendorCandidateStatus;
	extractionConfidence: number | null;
	createdAt: string;
}

export interface ExtractedVendorData {
	vendorName: string | null;
	vendorContactName: string | null;
	vendorContactEmail: string | null;
	vendorContactPhone: string | null;
	vendorAddress: string | null;
	vendorWebsite: string | null;
	serviceCategories: string[];
	coverageArea: string | null;
	licensesAndCerts: string[];
	confidence: number;
	fieldConfidences: Record<string, number>;
}

// =============================================================================
// API Functions
// =============================================================================

export const vendorCandidateApi = {
	/**
	 * Create a new vendor candidate
	 */
	create: (data: {
		caseId: string;
		vendorName: string;
		vendorContactName?: string;
		vendorContactEmail?: string;
		vendorContactPhone?: string;
		vendorAddress?: string;
		vendorWebsite?: string;
		serviceCategories?: string[];
		coverageArea?: string;
		licensesAndCerts?: string[];
		notes?: string;
		sourceUrl?: string;
		sourceHtml?: string;
		sourcePlainText?: string;
		extractionConfidence?: number;
		extractionMetadata?: Record<string, unknown>;
		idempotencyKey: string;
	}, organizationId: string) =>
		apiCall<{ vendorCandidate: VendorCandidate }>('vendorCandidate/create', {
			body: data,
			organizationId
		}),

	/**
	 * Get vendor candidate by ID
	 */
	get: (id: string, organizationId: string) =>
		apiCall<{ vendorCandidate: VendorCandidate }>('vendorCandidate/get', {
			body: { id },
			organizationId
		}),

	/**
	 * List vendor candidates for a case
	 */
	listByCase: (params: {
		caseId: string;
		status?: VendorCandidateStatus;
		limit?: number;
		cursor?: string;
	}, organizationId: string) =>
		apiCall<{
			vendorCandidates: VendorCandidateListItem[];
			pagination: { hasMore: boolean; nextCursor: string | null };
		}>('vendorCandidate/listByCase', {
			body: params,
			organizationId
		}),

	/**
	 * Update vendor candidate details
	 */
	update: (data: {
		id: string;
		vendorName?: string;
		vendorContactName?: string | null;
		vendorContactEmail?: string | null;
		vendorContactPhone?: string | null;
		vendorAddress?: string | null;
		vendorWebsite?: string | null;
		serviceCategories?: string[];
		coverageArea?: string | null;
		licensesAndCerts?: string[];
		notes?: string | null;
		riskFlags?: string[];
		idempotencyKey: string;
	}, organizationId: string) =>
		apiCall<{ vendorCandidate: VendorCandidate }>('vendorCandidate/update', {
			body: data,
			organizationId
		}),

	/**
	 * Update vendor candidate status
	 */
	updateStatus: (data: {
		id: string;
		status: VendorCandidateStatus;
		reason?: string;
		idempotencyKey: string;
	}, organizationId: string) =>
		apiCall<{ vendorCandidate: VendorCandidate }>('vendorCandidate/updateStatus', {
			body: data,
			organizationId
		}),

	/**
	 * Delete vendor candidate
	 */
	delete: (data: {
		id: string;
		idempotencyKey: string;
	}, organizationId: string) =>
		apiCall<{ success: boolean }>('vendorCandidate/delete', {
			body: data,
			organizationId
		}),

	/**
	 * Extract vendor information from source
	 */
	extract: (data: {
		caseId: string;
		sourceUrl?: string;
		sourceHtml?: string;
		sourcePlainText?: string;
	}, organizationId: string) =>
		apiCall<{
			extracted: ExtractedVendorData;
			multipleVendorsDetected: boolean;
			rawSource: string | null;
		}>('vendorCandidate/extract', {
			body: data,
			organizationId
		})
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
