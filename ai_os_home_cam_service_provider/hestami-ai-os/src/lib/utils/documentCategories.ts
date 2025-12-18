/**
 * CAM Document Category Mapping
 *
 * Maps the system-wide DocumentCategory enum to the 9 canonical CAM categories
 * as defined in the UX specification.
 */

import type { DocumentCategory } from '../../../generated/prisma/client.js';

/**
 * Canonical CAM document categories for UI display and filtering
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
 * Maps system DocumentCategory values to CAM categories
 */
export const DOCUMENT_CATEGORY_TO_CAM: Record<DocumentCategory, CamDocumentCategory> = {
	// CAM / HOA categories
	GOVERNING_DOCS: 'GOVERNING_DOCUMENTS',
	FINANCIAL: 'FINANCIAL_RECORDS',
	MEETING: 'MEETING_MINUTES',
	LEGAL: 'POLICIES_RESOLUTIONS',
	INSURANCE: 'CONTRACTS_AGREEMENTS',
	MAINTENANCE: 'EVIDENCE_INSPECTIONS',
	ARCHITECTURAL: 'ARCHITECTURAL_GUIDELINES',
	RESERVE_STUDY: 'FINANCIAL_RECORDS',
	INSPECTION: 'EVIDENCE_INSPECTIONS',
	CONTRACT: 'CONTRACTS_AGREEMENTS',

	// Property Owner / Concierge categories
	CC_AND_RS: 'GOVERNING_DOCUMENTS',
	PERMIT: 'POLICIES_RESOLUTIONS',
	APPROVAL: 'POLICIES_RESOLUTIONS',
	CORRESPONDENCE: 'CORRESPONDENCE',
	TITLE_DEED: 'GOVERNING_DOCUMENTS',
	SURVEY: 'EVIDENCE_INSPECTIONS',
	WARRANTY: 'CONTRACTS_AGREEMENTS',

	// Contractor / Service Provider categories
	LICENSE: 'CONTRACTS_AGREEMENTS',
	CERTIFICATION: 'CONTRACTS_AGREEMENTS',
	BOND: 'CONTRACTS_AGREEMENTS',
	PROPOSAL: 'CONTRACTS_AGREEMENTS',
	ESTIMATE: 'FINANCIAL_RECORDS',
	INVOICE: 'FINANCIAL_RECORDS',
	WORK_ORDER: 'EVIDENCE_INSPECTIONS',
	JOB_PHOTO: 'EVIDENCE_INSPECTIONS',
	JOB_VIDEO: 'EVIDENCE_INSPECTIONS',
	VOICE_NOTE: 'CORRESPONDENCE',
	SIGNATURE: 'CONTRACTS_AGREEMENTS',
	CHECKLIST: 'EVIDENCE_INSPECTIONS',

	// Cross-pillar
	GENERAL: 'OTHER'
};

/**
 * Maps CAM categories back to primary DocumentCategory values for uploads
 */
export const CAM_TO_PRIMARY_DOCUMENT_CATEGORY: Record<CamDocumentCategory, DocumentCategory> = {
	GOVERNING_DOCUMENTS: 'GOVERNING_DOCS',
	ARCHITECTURAL_GUIDELINES: 'ARCHITECTURAL',
	POLICIES_RESOLUTIONS: 'LEGAL',
	MEETING_MINUTES: 'MEETING',
	CONTRACTS_AGREEMENTS: 'CONTRACT',
	FINANCIAL_RECORDS: 'FINANCIAL',
	EVIDENCE_INSPECTIONS: 'INSPECTION',
	CORRESPONDENCE: 'CORRESPONDENCE',
	OTHER: 'GENERAL'
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
