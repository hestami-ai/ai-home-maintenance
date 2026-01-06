/**
 * Document Category Utilities
 *
 * Provides pillar-specific category mappings derived from the canonical
 * DocumentCategory enum generated from the Prisma schema.
 * 
 * ARCHITECTURE:
 * - Prisma schema (source of truth) -> generated/prisma/enums.ts
 * - Generated Zod schema -> generated/zod/inputTypeSchemas/DocumentCategorySchema.ts
 * - This file provides UI-friendly mappings and pillar-specific subsets
 * 
 * All category values are validated at compile-time against the generated enum.
 */

import { DocumentCategory } from '../../../generated/prisma/enums.js';
import { DocumentCategorySchema } from '../../../generated/zod/inputTypeSchemas/DocumentCategorySchema.js';

// Re-export for convenience - consumers should use these instead of importing directly
export { DocumentCategory, DocumentCategorySchema };
export type DocumentCategoryType = DocumentCategory;

// Compile-time validation: all enum values from generated schema
const ALL_DOCUMENT_CATEGORIES = DocumentCategorySchema.options;

/**
 * Canonical CAM document categories for UI display and filtering.
 * These are UI groupings that map multiple DocumentCategory values.
 */
export const CAM_DOCUMENT_CATEGORIES = [
	'GOVERNING_DOCUMENTS',
	'ARCHITECTURAL_GUIDELINES',
	'POLICIES_RESOLUTIONS',
	'MEETING_MINUTES',
	'CONTRACTS_AGREEMENTS',
	'FINANCIAL_RECORDS',
	'EVIDENCE_INSPECTIONS',
	'CORRESPONDENCE',
	'OTHER'
] as const;

export type CamDocumentCategory = (typeof CAM_DOCUMENT_CATEGORIES)[number];

/**
 * Human-readable labels for CAM document categories
 */
export const CAM_CATEGORY_LABELS: Record<CamDocumentCategory, string> = {
	GOVERNING_DOCUMENTS: 'Governing Documents',
	ARCHITECTURAL_GUIDELINES: 'Architectural Guidelines',
	POLICIES_RESOLUTIONS: 'Policies & Resolutions',
	MEETING_MINUTES: 'Meeting Minutes',
	CONTRACTS_AGREEMENTS: 'Contracts & Agreements',
	FINANCIAL_RECORDS: 'Financial Records',
	EVIDENCE_INSPECTIONS: 'Evidence & Inspections',
	CORRESPONDENCE: 'Correspondence',
	OTHER: 'Other'
};

/**
 * Maps system DocumentCategory values to CAM UI categories.
 * Uses DocumentCategory enum values for compile-time validation.
 */
export const DOCUMENT_CATEGORY_TO_CAM: Record<DocumentCategory, CamDocumentCategory> = {
	// CAM / HOA categories
	[DocumentCategory.GOVERNING_DOCS]: 'GOVERNING_DOCUMENTS',
	[DocumentCategory.FINANCIAL]: 'FINANCIAL_RECORDS',
	[DocumentCategory.MEETING]: 'MEETING_MINUTES',
	[DocumentCategory.LEGAL]: 'POLICIES_RESOLUTIONS',
	[DocumentCategory.INSURANCE]: 'CONTRACTS_AGREEMENTS',
	[DocumentCategory.MAINTENANCE]: 'EVIDENCE_INSPECTIONS',
	[DocumentCategory.ARCHITECTURAL]: 'ARCHITECTURAL_GUIDELINES',
	[DocumentCategory.RESERVE_STUDY]: 'FINANCIAL_RECORDS',
	[DocumentCategory.INSPECTION]: 'EVIDENCE_INSPECTIONS',
	[DocumentCategory.CONTRACT]: 'CONTRACTS_AGREEMENTS',

	// Property Owner / Concierge categories
	[DocumentCategory.CC_AND_RS]: 'GOVERNING_DOCUMENTS',
	[DocumentCategory.PERMIT]: 'POLICIES_RESOLUTIONS',
	[DocumentCategory.APPROVAL]: 'POLICIES_RESOLUTIONS',
	[DocumentCategory.CORRESPONDENCE]: 'CORRESPONDENCE',
	[DocumentCategory.TITLE_DEED]: 'GOVERNING_DOCUMENTS',
	[DocumentCategory.SURVEY]: 'EVIDENCE_INSPECTIONS',
	[DocumentCategory.WARRANTY]: 'CONTRACTS_AGREEMENTS',

	// Contractor / Service Provider categories
	[DocumentCategory.LICENSE]: 'CONTRACTS_AGREEMENTS',
	[DocumentCategory.CERTIFICATION]: 'CONTRACTS_AGREEMENTS',
	[DocumentCategory.BOND]: 'CONTRACTS_AGREEMENTS',
	[DocumentCategory.PROPOSAL]: 'CONTRACTS_AGREEMENTS',
	[DocumentCategory.ESTIMATE]: 'FINANCIAL_RECORDS',
	[DocumentCategory.INVOICE]: 'FINANCIAL_RECORDS',
	[DocumentCategory.WORK_ORDER]: 'EVIDENCE_INSPECTIONS',
	[DocumentCategory.VOICE_NOTE]: 'CORRESPONDENCE',
	[DocumentCategory.SIGNATURE]: 'CONTRACTS_AGREEMENTS',
	[DocumentCategory.CHECKLIST]: 'EVIDENCE_INSPECTIONS',

	// Cross-pillar
	[DocumentCategory.PHOTO]: 'EVIDENCE_INSPECTIONS',
	[DocumentCategory.VIDEO]: 'EVIDENCE_INSPECTIONS',
	[DocumentCategory.AUDIO]: 'CORRESPONDENCE',
	[DocumentCategory.GENERAL]: 'OTHER',

	// Phase 30: Deprecated categories (migrated to unified Document model)
	[DocumentCategory.ARC_ATTACHMENT]: 'EVIDENCE_INSPECTIONS',
	[DocumentCategory.VIOLATION_EVIDENCE]: 'EVIDENCE_INSPECTIONS'
};

/**
 * Maps CAM UI categories back to primary DocumentCategory values for uploads.
 * Uses DocumentCategory enum values for compile-time validation.
 */
export const CAM_TO_PRIMARY_DOCUMENT_CATEGORY: Record<CamDocumentCategory, DocumentCategory> = {
	GOVERNING_DOCUMENTS: DocumentCategory.GOVERNING_DOCS,
	ARCHITECTURAL_GUIDELINES: DocumentCategory.ARCHITECTURAL,
	POLICIES_RESOLUTIONS: DocumentCategory.LEGAL,
	MEETING_MINUTES: DocumentCategory.MEETING,
	CONTRACTS_AGREEMENTS: DocumentCategory.CONTRACT,
	FINANCIAL_RECORDS: DocumentCategory.FINANCIAL,
	EVIDENCE_INSPECTIONS: DocumentCategory.INSPECTION,
	CORRESPONDENCE: DocumentCategory.CORRESPONDENCE,
	OTHER: DocumentCategory.GENERAL
};

/**
 * Get the CAM category for a given DocumentCategory
 */
export function getCamCategory(category: DocumentCategory): CamDocumentCategory {
	return DOCUMENT_CATEGORY_TO_CAM[category];
}

/**
 * Get the human-readable label for a CAM category
 */
export function getCamCategoryLabel(category: CamDocumentCategory): string {
	return CAM_CATEGORY_LABELS[category];
}

/**
 * Get the primary DocumentCategory for a CAM category (for uploads)
 */
export function getPrimaryDocumentCategory(camCategory: CamDocumentCategory): DocumentCategory {
	return CAM_TO_PRIMARY_DOCUMENT_CATEGORY[camCategory];
}

/**
 * Check if a category is the discouraged "Other" category
 */
export function isOtherCategory(category: CamDocumentCategory | DocumentCategory): boolean {
	if (category === 'OTHER' || category === 'GENERAL') {
		return true;
	}
	return false;
}

/**
 * Get all CAM categories as options for dropdowns
 */
export function getCamCategoryOptions(): Array<{ value: CamDocumentCategory; label: string }> {
	return CAM_DOCUMENT_CATEGORIES.map((category) => ({
		value: category,
		label: CAM_CATEGORY_LABELS[category]
	}));
}

// =============================================================================
// Concierge Document Categories
// =============================================================================

/**
 * Document categories relevant to Concierge/Property Owner pillar.
 * These are actual DocumentCategory enum values (not UI groupings like CAM).
 * Using enum values ensures compile-time validation against Prisma schema.
 */
export const CONCIERGE_DOCUMENT_CATEGORIES = [
	DocumentCategory.TITLE_DEED,
	DocumentCategory.INSURANCE,
	DocumentCategory.WARRANTY,
	DocumentCategory.INSPECTION,
	DocumentCategory.INVOICE,
	DocumentCategory.CONTRACT,
	DocumentCategory.PHOTO,
	DocumentCategory.VIDEO,
	DocumentCategory.CORRESPONDENCE,
	DocumentCategory.PERMIT,
	DocumentCategory.SURVEY,
	DocumentCategory.GENERAL
] as const;

export type ConciergeDocumentCategory = (typeof CONCIERGE_DOCUMENT_CATEGORIES)[number];

/**
 * Human-readable labels for Concierge document categories
 */
export const CONCIERGE_CATEGORY_LABELS: Record<ConciergeDocumentCategory, string> = {
	[DocumentCategory.TITLE_DEED]: 'Property Deed',
	[DocumentCategory.INSURANCE]: 'Insurance Policy',
	[DocumentCategory.WARRANTY]: 'Warranty',
	[DocumentCategory.INSPECTION]: 'Inspection Report',
	[DocumentCategory.INVOICE]: 'Receipt/Invoice',
	[DocumentCategory.CONTRACT]: 'Contract',
	[DocumentCategory.PHOTO]: 'Photo',
	[DocumentCategory.VIDEO]: 'Video',
	[DocumentCategory.CORRESPONDENCE]: 'Correspondence',
	[DocumentCategory.PERMIT]: 'Permit',
	[DocumentCategory.SURVEY]: 'Survey',
	[DocumentCategory.GENERAL]: 'Other'
};

/**
 * Get all Concierge categories as options for dropdowns
 */
export function getConciergeDocumentCategoryOptions(): Array<{ value: ConciergeDocumentCategory; label: string }> {
	return CONCIERGE_DOCUMENT_CATEGORIES.map((category) => ({
		value: category,
		label: CONCIERGE_CATEGORY_LABELS[category]
	}));
}

