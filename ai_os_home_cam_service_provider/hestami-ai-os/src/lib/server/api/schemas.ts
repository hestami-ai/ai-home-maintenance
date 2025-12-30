/**
 * Shared API response schemas
 * 
 * This file provides typed Zod schemas for API responses.
 * 
 * These schemas are used in route `.output()` definitions to ensure:
 * 1. Runtime validation of responses
 * 2. Accurate OpenAPI specification generation
 * 3. Type-safe frontend code generation
 * 
 * ARCHITECTURE:
 * - Enum schemas are imported from generated Zod schemas (single source of truth)
 * - Model schemas are defined here for API response shaping
 */

import { z } from 'zod';
import { ResponseMetaSchema } from './errors.js';

// Import generated enum schemas from Prisma/Zod generation
import { ARCCategorySchema as GeneratedARCCategorySchema } from '../../../../generated/zod/inputTypeSchemas/ARCCategorySchema.js';
import { ARCRequestStatusSchema as GeneratedARCRequestStatusSchema } from '../../../../generated/zod/inputTypeSchemas/ARCRequestStatusSchema.js';
import { ARCReviewActionSchema as GeneratedARCReviewActionSchema } from '../../../../generated/zod/inputTypeSchemas/ARCReviewActionSchema.js';
import { ARCDocumentTypeSchema as GeneratedARCDocumentTypeSchema } from '../../../../generated/zod/inputTypeSchemas/ARCDocumentTypeSchema.js';
import { ViolationStatusSchema as GeneratedViolationStatusSchema } from '../../../../generated/zod/inputTypeSchemas/ViolationStatusSchema.js';
import { ViolationSeveritySchema as GeneratedViolationSeveritySchema } from '../../../../generated/zod/inputTypeSchemas/ViolationSeveritySchema.js';
import { NoticeTypeSchema as GeneratedNoticeTypeSchema } from '../../../../generated/zod/inputTypeSchemas/NoticeTypeSchema.js';
import { NoticeDeliveryMethodSchema as GeneratedNoticeDeliveryMethodSchema } from '../../../../generated/zod/inputTypeSchemas/NoticeDeliveryMethodSchema.js';
import { HearingOutcomeSchema as GeneratedHearingOutcomeSchema } from '../../../../generated/zod/inputTypeSchemas/HearingOutcomeSchema.js';
import { AppealStatusSchema as GeneratedAppealStatusSchema } from '../../../../generated/zod/inputTypeSchemas/AppealStatusSchema.js';
import { DocumentCategorySchema as GeneratedDocumentCategorySchema } from '../../../../generated/zod/inputTypeSchemas/DocumentCategorySchema.js';
import { DocumentContextTypeSchema as GeneratedDocumentContextTypeSchema } from '../../../../generated/zod/inputTypeSchemas/DocumentContextTypeSchema.js';
import { DocumentVisibilitySchema as GeneratedDocumentVisibilitySchema } from '../../../../generated/zod/inputTypeSchemas/DocumentVisibilitySchema.js';
import { DocumentStatusSchema as GeneratedDocumentStatusSchema } from '../../../../generated/zod/inputTypeSchemas/DocumentStatusSchema.js';
import { StorageProviderSchema as GeneratedStorageProviderSchema } from '../../../../generated/zod/inputTypeSchemas/StorageProviderSchema.js';
import { WorkOrderStatusSchema as GeneratedWorkOrderStatusSchema } from '../../../../generated/zod/inputTypeSchemas/WorkOrderStatusSchema.js';
import { WorkOrderPrioritySchema as GeneratedWorkOrderPrioritySchema } from '../../../../generated/zod/inputTypeSchemas/WorkOrderPrioritySchema.js';
import { WorkOrderCategorySchema as GeneratedWorkOrderCategorySchema } from '../../../../generated/zod/inputTypeSchemas/WorkOrderCategorySchema.js';
import { WorkOrderOriginTypeSchema as GeneratedWorkOrderOriginTypeSchema } from '../../../../generated/zod/inputTypeSchemas/WorkOrderOriginTypeSchema.js';
import { BidStatusSchema as GeneratedBidStatusSchema } from '../../../../generated/zod/inputTypeSchemas/BidStatusSchema.js';
import { FundTypeSchema as GeneratedFundTypeSchema } from '../../../../generated/zod/inputTypeSchemas/FundTypeSchema.js';
import { StaffStatusSchema as GeneratedStaffStatusSchema } from '../../../../generated/zod/inputTypeSchemas/StaffStatusSchema.js';
import { StaffRoleSchema as GeneratedStaffRoleSchema } from '../../../../generated/zod/inputTypeSchemas/StaffRoleSchema.js';
import { PillarAccessSchema as GeneratedPillarAccessSchema } from '../../../../generated/zod/inputTypeSchemas/PillarAccessSchema.js';
import { ActivityEntityTypeSchema as GeneratedActivityEntityTypeSchema } from '../../../../generated/zod/inputTypeSchemas/ActivityEntityTypeSchema.js';
import { ActivityActionTypeSchema as GeneratedActivityActionTypeSchema } from '../../../../generated/zod/inputTypeSchemas/ActivityActionTypeSchema.js';
import { ActivityActorTypeSchema as GeneratedActivityActorTypeSchema } from '../../../../generated/zod/inputTypeSchemas/ActivityActorTypeSchema.js';
import { ActivityEventCategorySchema as GeneratedActivityEventCategorySchema } from '../../../../generated/zod/inputTypeSchemas/ActivityEventCategorySchema.js';
import { OrganizationTypeSchema as GeneratedOrganizationTypeSchema } from '../../../../generated/zod/inputTypeSchemas/OrganizationTypeSchema.js';
import { OrganizationStatusSchema as GeneratedOrganizationStatusSchema } from '../../../../generated/zod/inputTypeSchemas/OrganizationStatusSchema.js';
import { UserRoleSchema as GeneratedUserRoleSchema } from '../../../../generated/zod/inputTypeSchemas/UserRoleSchema.js';

// Re-export for convenience
export { ResponseMetaSchema };

// =============================================================================
// Common Type Schemas (Decimal, JSON)
// =============================================================================

/**
 * Schema for Prisma Decimal type.
 * 
 * Accepts string or number input, always outputs string for precision preservation.
 * Use with .nullish() for optional decimal fields.
 * 
 * @example
 * estimatedCost: DecimalSchema.nullish()
 */
export const DecimalSchema = z.union([z.string(), z.number()]).transform(String);
export type Decimal = z.infer<typeof DecimalSchema>;

/**
 * Recursive JSON value type for Prisma Json fields.
 */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/**
 * Schema for Prisma Json type.
 * 
 * Validates arbitrary JSON structures (objects, arrays, primitives).
 * Use with .nullish() for optional JSON fields.
 * 
 * Note: Uses z.unknown() with runtime JSON validation for Zod 4 compatibility.
 * 
 * @example
 * metadata: JsonSchema.nullish()
 */
export const JsonSchema = z.unknown().transform((val): JsonValue => {
	// Runtime validation for JSON-compatible types
	if (val === null || typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
		return val;
	}
	if (Array.isArray(val)) {
		return val as JsonValue[];
	}
	if (typeof val === 'object') {
		return val as { [key: string]: JsonValue };
	}
	throw new Error('Invalid JSON value');
});

// =============================================================================
// Base Response Helpers
// =============================================================================

/**
 * Creates a standard success response schema with typed data
 */
export function successResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
	return z.object({
		ok: z.literal(true),
		data: dataSchema,
		meta: ResponseMetaSchema
	});
}

/**
 * Creates a paginated list response schema
 */
export function paginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T, itemsKey: string) {
	return successResponseSchema(
		z.object({
			[itemsKey]: z.array(itemSchema),
			pagination: z.object({
				nextCursor: z.string().nullable(),
				hasMore: z.boolean()
			})
		})
	);
}

// =============================================================================
// Enum Schemas (re-exported from generated Zod schemas)
// =============================================================================

export const ARCCategorySchema = GeneratedARCCategorySchema;
export type ARCCategory = z.infer<typeof ARCCategorySchema>;

export const ARCRequestStatusSchema = GeneratedARCRequestStatusSchema;
export type ARCRequestStatus = z.infer<typeof ARCRequestStatusSchema>;

export const ARCReviewActionSchema = GeneratedARCReviewActionSchema;
export type ARCReviewAction = z.infer<typeof ARCReviewActionSchema>;

export const ARCDocumentTypeSchema = GeneratedARCDocumentTypeSchema;
export type ARCDocumentType = z.infer<typeof ARCDocumentTypeSchema>;

// =============================================================================
// ARC Domain Schemas
// =============================================================================

/**
 * ARC Request base schema (matches Prisma ARCRequest model)
 */
export const ARCRequestSchema = z.object({
	id: z.string(),
	organizationId: z.string(),
	associationId: z.string(),
	committeeId: z.string().nullish(),
	unitId: z.string().nullish(),
	requesterPartyId: z.string(),
	requestNumber: z.string(),
	title: z.string(),
	description: z.string(),
	category: ARCCategorySchema,
	status: ARCRequestStatusSchema,
	estimatedCost: DecimalSchema.nullish(),
	proposedStartDate: z.coerce.date().nullish(),
	proposedEndDate: z.coerce.date().nullish(),
	conditions: z.string().nullish(),
	submittedAt: z.coerce.date().nullish(),
	reviewedAt: z.coerce.date().nullish(),
	decisionDate: z.coerce.date().nullish(),
	expiresAt: z.coerce.date().nullish(),
	withdrawnAt: z.coerce.date().nullish(),
	cancellationReason: z.string().nullish(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date()
});
export type ARCRequest = z.infer<typeof ARCRequestSchema>;

/**
 * ARC Document schema (matches Prisma ARCDocument model)
 */
export const ARCDocumentSchema = z.object({
	id: z.string(),
	requestId: z.string(),
	documentType: ARCDocumentTypeSchema,
	fileName: z.string(),
	fileUrl: z.string(),
	fileSize: z.number().nullish(),
	mimeType: z.string().nullish(),
	description: z.string().nullish(),
	version: z.string().nullish(),
	uploadedBy: z.string(),
	uploadedAt: z.coerce.date(),
	createdAt: z.coerce.date()
});
export type ARCDocument = z.infer<typeof ARCDocumentSchema>;

/**
 * ARC Review schema
 */
export const ARCReviewSchema = z.object({
	id: z.string(),
	requestId: z.string(),
	reviewerId: z.string(),
	action: ARCReviewActionSchema,
	notes: z.string().nullish(),
	conditions: z.string().nullish(),
	createdAt: z.coerce.date()
});
export type ARCReview = z.infer<typeof ARCReviewSchema>;

/**
 * ARC Committee schema
 */
export const ARCCommitteeSchema = z.object({
	id: z.string(),
	organizationId: z.string(),
	associationId: z.string(),
	name: z.string(),
	description: z.string().nullish(),
	isActive: z.boolean(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date()
});
export type ARCCommittee = z.infer<typeof ARCCommitteeSchema>;

// =============================================================================
// Association Domain Schemas
// =============================================================================

export const AssociationSchema = z.object({
	id: z.string(),
	organizationId: z.string(),
	name: z.string(),
	legalName: z.string().nullish(),
	status: z.string(),
	fiscalYearEnd: z.number(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date()
});
export type Association = z.infer<typeof AssociationSchema>;

export const UnitSchema = z.object({
	id: z.string(),
	organizationId: z.string(),
	propertyId: z.string(),
	unitNumber: z.string(),
	unitType: z.string().nullish(),
	bedrooms: z.number().nullish(),
	bathrooms: z.number().nullish(),
	squareFeet: z.number().nullish(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date()
});
export type Unit = z.infer<typeof UnitSchema>;

export const PartySchema = z.object({
	id: z.string(),
	organizationId: z.string(),
	partyType: z.string(),
	firstName: z.string().nullish(),
	lastName: z.string().nullish(),
	companyName: z.string().nullish(),
	email: z.string().nullish(),
	phone: z.string().nullish(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date()
});
export type Party = z.infer<typeof PartySchema>;

// =============================================================================
// ARC Domain Response Schemas
// =============================================================================

/**
 * ARC Request with related entities for detail views
 */
export const ARCRequestDetailSchema = ARCRequestSchema.extend({
	association: AssociationSchema.optional(),
	unit: UnitSchema.nullish(),
	committee: ARCCommitteeSchema.nullish(),
	requesterParty: PartySchema.optional(),
	documents: z.array(ARCDocumentSchema).optional(),
	reviews: z.array(ARCReviewSchema).optional()
});
export type ARCRequestDetail = z.infer<typeof ARCRequestDetailSchema>;

/**
 * ARC Request summary for list views
 */
export const ARCRequestSummarySchema = z.object({
	id: z.string(),
	requestNumber: z.string(),
	title: z.string(),
	status: z.string(),
	category: z.string(),
	unitNumber: z.string().nullish(),
	submitterName: z.string().nullish(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date()
});

export type ARCRequestSummary = z.infer<typeof ARCRequestSummarySchema>;

/**
 * ARC Precedent for similar request lookups
 */
export const ARCPrecedentSchema = z.object({
	id: z.string(),
	requestNumber: z.string(),
	title: z.string(),
	status: z.string(),
	category: z.string(),
	decisionDate: z.coerce.date().nullable(),
	similarity: z.number().optional()
});

export type ARCPrecedent = z.infer<typeof ARCPrecedentSchema>;

// =============================================================================
// ARC Route Response Schemas
// =============================================================================

export const ARCRequestCreateResponseSchema = successResponseSchema(
	z.object({
		request: z.object({
			id: z.string(),
			requestNumber: z.string(),
			title: z.string(),
			status: z.string(),
			category: z.string()
		})
	})
);

export const ARCRequestGetResponseSchema = successResponseSchema(
	z.object({
		request: ARCRequestDetailSchema
	})
);

export const ARCRequestListResponseSchema = successResponseSchema(
	z.object({
		requests: z.array(ARCRequestSummarySchema),
		pagination: z.object({
			nextCursor: z.string().nullable(),
			hasMore: z.boolean()
		})
	})
);

export const ARCRequestUpdateResponseSchema = successResponseSchema(
	z.object({
		request: z.object({
			id: z.string(),
			status: z.string()
		})
	})
);

export const ARCRequestSubmitResponseSchema = successResponseSchema(
	z.object({
		request: z.object({
			id: z.string(),
			status: z.string(),
			submittedAt: z.string().nullable()
		})
	})
);

export const ARCRequestWithdrawResponseSchema = successResponseSchema(
	z.object({
		request: z.object({
			id: z.string(),
			status: z.string(),
			withdrawnAt: z.string().nullable()
		})
	})
);

export const ARCDocumentAddResponseSchema = successResponseSchema(
	z.object({
		document: z.object({
			id: z.string(),
			requestId: z.string()
		})
	})
);

export const ARCReviewSubmitResponseSchema = successResponseSchema(
	z.object({
		request: z.object({
			id: z.string(),
			status: z.string()
		})
	})
);

export const ARCPrecedentsResponseSchema = successResponseSchema(
	z.object({
		precedents: z.array(ARCPrecedentSchema),
		total: z.number()
	})
);

export const ARCRequestFinalizeResponseSchema = successResponseSchema(
	z.object({
		request: z.object({
			id: z.string(),
			status: z.string()
		})
	})
);

// =============================================================================
// Violation Domain Enum Schemas (re-exported from generated Zod schemas)
// =============================================================================

export const ViolationStatusSchema = GeneratedViolationStatusSchema;
export type ViolationStatus = z.infer<typeof ViolationStatusSchema>;

export const ViolationSeveritySchema = GeneratedViolationSeveritySchema;
export type ViolationSeverity = z.infer<typeof ViolationSeveritySchema>;

export const NoticeTypeSchema = GeneratedNoticeTypeSchema;
export type NoticeType = z.infer<typeof NoticeTypeSchema>;

export const NoticeDeliveryMethodSchema = GeneratedNoticeDeliveryMethodSchema;
export type NoticeDeliveryMethod = z.infer<typeof NoticeDeliveryMethodSchema>;

export const HearingOutcomeSchema = GeneratedHearingOutcomeSchema;
export type HearingOutcome = z.infer<typeof HearingOutcomeSchema>;

export const AppealStatusSchema = GeneratedAppealStatusSchema;
export type AppealStatus = z.infer<typeof AppealStatusSchema>;

// =============================================================================
// Violation Domain Schemas
// =============================================================================

/**
 * ViolationType schema (matches Prisma ViolationType model)
 */
export const ViolationTypeSchema = z.object({
	id: z.string(),
	organizationId: z.string(),
	associationId: z.string(),
	code: z.string(),
	name: z.string(),
	description: z.string().nullish(),
	category: z.string(),
	ccnrSection: z.string().nullish(),
	ruleReference: z.string().nullish(),
	defaultSeverity: ViolationSeveritySchema,
	defaultCurePeriodDays: z.number(),
	firstFineAmount: DecimalSchema.nullish(),
	secondFineAmount: DecimalSchema.nullish(),
	subsequentFineAmount: DecimalSchema.nullish(),
	maxFineAmount: DecimalSchema.nullish(),
	warningTemplateId: z.string().nullish(),
	noticeTemplateId: z.string().nullish(),
	isActive: z.boolean(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date()
});
export type ViolationType = z.infer<typeof ViolationTypeSchema>;

/**
 * Violation schema (matches Prisma Violation model)
 */
export const ViolationSchema = z.object({
	id: z.string(),
	organizationId: z.string(),
	associationId: z.string(),
	violationNumber: z.string(),
	violationTypeId: z.string(),
	unitId: z.string().nullish(),
	commonAreaName: z.string().nullish(),
	locationDetails: z.string().nullish(),
	title: z.string(),
	description: z.string().nullish(),
	severity: ViolationSeveritySchema,
	status: ViolationStatusSchema,
	observedDate: z.coerce.date(),
	reportedDate: z.coerce.date(),
	curePeriodEnds: z.coerce.date().nullish(),
	curedDate: z.coerce.date().nullish(),
	closedDate: z.coerce.date().nullish(),
	responsiblePartyId: z.string().nullish(),
	reportedBy: z.string(),
	reporterType: z.string().nullish(),
	totalFinesAssessed: DecimalSchema,
	totalFinesPaid: DecimalSchema,
	totalFinesWaived: DecimalSchema,
	noticeCount: z.number(),
	lastNoticeDate: z.coerce.date().nullish(),
	lastNoticeType: NoticeTypeSchema.nullish(),
	resolutionNotes: z.string().nullish(),
	closedBy: z.string().nullish(),
	deletedAt: z.coerce.date().nullish(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date()
});
export type Violation = z.infer<typeof ViolationSchema>;

/**
 * ViolationEvidence schema
 */
export const ViolationEvidenceSchema = z.object({
	id: z.string(),
	violationId: z.string(),
	evidenceType: z.string(),
	fileName: z.string(),
	fileUrl: z.string(),
	fileSize: z.number().nullish(),
	mimeType: z.string().nullish(),
	description: z.string().nullish(),
	capturedAt: z.coerce.date().nullish(),
	capturedBy: z.string().nullish(),
	gpsLatitude: DecimalSchema.nullish(),
	gpsLongitude: DecimalSchema.nullish(),
	uploadedBy: z.string(),
	uploadedAt: z.coerce.date(),
	createdAt: z.coerce.date()
});
export type ViolationEvidence = z.infer<typeof ViolationEvidenceSchema>;

/**
 * ViolationNotice schema
 */
export const ViolationNoticeSchema = z.object({
	id: z.string(),
	violationId: z.string(),
	noticeType: NoticeTypeSchema,
	noticeNumber: z.number(),
	templateId: z.string().nullish(),
	subject: z.string(),
	body: z.string(),
	recipientPartyId: z.string().nullish(),
	recipientName: z.string().nullish(),
	recipientEmail: z.string().nullish(),
	recipientAddress: z.string().nullish(),
	deliveryMethod: NoticeDeliveryMethodSchema,
	sentAt: z.coerce.date().nullish(),
	deliveredAt: z.coerce.date().nullish(),
	curePeriodDays: z.number().nullish(),
	curePeriodEnds: z.coerce.date().nullish(),
	fineAmount: DecimalSchema.nullish(),
	createdBy: z.string(),
	createdAt: z.coerce.date()
});
export type ViolationNotice = z.infer<typeof ViolationNoticeSchema>;

/**
 * ViolationHearing schema
 */
export const ViolationHearingSchema = z.object({
	id: z.string(),
	violationId: z.string(),
	hearingDate: z.coerce.date(),
	location: z.string().nullish(),
	virtualMeetingUrl: z.string().nullish(),
	scheduledBy: z.string(),
	outcome: HearingOutcomeSchema.nullish(),
	outcomeNotes: z.string().nullish(),
	fineAmount: DecimalSchema.nullish(),
	reducedFineAmount: DecimalSchema.nullish(),
	decidedAt: z.coerce.date().nullish(),
	decidedBy: z.string().nullish(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date()
});
export type ViolationHearing = z.infer<typeof ViolationHearingSchema>;

/**
 * ViolationFine schema
 */
export const ViolationFineSchema = z.object({
	id: z.string(),
	violationId: z.string(),
	fineNumber: z.number(),
	amount: DecimalSchema,
	reason: z.string(),
	dueDate: z.coerce.date(),
	paidAmount: DecimalSchema,
	paidDate: z.coerce.date().nullish(),
	waivedAmount: DecimalSchema,
	waivedReason: z.string().nullish(),
	waivedBy: z.string().nullish(),
	waivedAt: z.coerce.date().nullish(),
	assessedBy: z.string(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date()
});
export type ViolationFine = z.infer<typeof ViolationFineSchema>;

/**
 * ViolationAppeal schema
 */
export const ViolationAppealSchema = z.object({
	id: z.string(),
	hearingId: z.string(),
	filedDate: z.coerce.date(),
	filedBy: z.string(),
	reason: z.string(),
	status: AppealStatusSchema,
	reviewDate: z.coerce.date().nullish(),
	reviewedBy: z.string().nullish(),
	decision: z.string().nullish(),
	decisionNotes: z.string().nullish(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date()
});
export type ViolationAppeal = z.infer<typeof ViolationAppealSchema>;

// =============================================================================
// Violation Domain Response Schemas
// =============================================================================

/**
 * Violation with related entities for detail views
 */
export const ViolationDetailSchema = ViolationSchema.extend({
	association: AssociationSchema.optional(),
	violationType: ViolationTypeSchema.optional(),
	unit: UnitSchema.nullish(),
	responsibleParty: PartySchema.nullish(),
	evidence: z.array(ViolationEvidenceSchema).optional(),
	notices: z.array(ViolationNoticeSchema).optional(),
	hearings: z.array(ViolationHearingSchema).optional(),
	fines: z.array(ViolationFineSchema).optional()
});
export type ViolationDetail = z.infer<typeof ViolationDetailSchema>;

/**
 * Violation summary for list views
 */
export const ViolationSummarySchema = z.object({
	id: z.string(),
	violationNumber: z.string(),
	title: z.string(),
	status: ViolationStatusSchema,
	severity: ViolationSeveritySchema,
	observedDate: z.coerce.date(),
	unitNumber: z.string().nullish(),
	responsiblePartyName: z.string().nullish(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date()
});
export type ViolationSummary = z.infer<typeof ViolationSummarySchema>;

// =============================================================================
// Document Domain Enum Schemas (re-exported from generated Zod schemas)
// =============================================================================

export const DocumentCategorySchema = GeneratedDocumentCategorySchema;
export type DocumentCategory = z.infer<typeof DocumentCategorySchema>;

export const DocumentContextTypeSchema = GeneratedDocumentContextTypeSchema;
export type DocumentContextType = z.infer<typeof DocumentContextTypeSchema>;

export const DocumentVisibilitySchema = GeneratedDocumentVisibilitySchema;
export type DocumentVisibility = z.infer<typeof DocumentVisibilitySchema>;

export const DocumentStatusSchema = GeneratedDocumentStatusSchema;
export type DocumentStatus = z.infer<typeof DocumentStatusSchema>;

export const StorageProviderSchema = GeneratedStorageProviderSchema;
export type StorageProvider = z.infer<typeof StorageProviderSchema>;

// =============================================================================
// Document Domain Schemas
// =============================================================================

/**
 * Document schema (matches Prisma Document model)
 */
export const DocumentSchema = z.object({
	id: z.string(),
	organizationId: z.string(),
	title: z.string(),
	description: z.string().nullish(),
	category: DocumentCategorySchema,
	visibility: DocumentVisibilitySchema,
	status: DocumentStatusSchema,
	storageProvider: StorageProviderSchema,
	storagePath: z.string(),
	fileUrl: z.string(),
	fileName: z.string(),
	fileSize: z.number(),
	mimeType: z.string(),
	checksum: z.string().nullish(),
	pageCount: z.number().nullish(),
	thumbnailUrl: z.string().nullish(),
	extractedText: z.string().nullish(),
	metadata: JsonSchema.nullish(),
	version: z.number(),
	parentDocumentId: z.string().nullish(),
	supersededById: z.string().nullish(),
	effectiveDate: z.coerce.date().nullish(),
	expirationDate: z.coerce.date().nullish(),
	uploadedBy: z.string(),
	tags: z.array(z.string()),
	archivedAt: z.coerce.date().nullish(),
	archivedBy: z.string().nullish(),
	archiveReason: z.string().nullish(),
	malwareScanStatus: z.string().nullish(),
	contentModerationStatus: z.string().nullish(),
	processingCompletedAt: z.coerce.date().nullish(),
	latitude: DecimalSchema.nullish(),
	longitude: DecimalSchema.nullish(),
	capturedAt: z.coerce.date().nullish(),
	transcription: z.string().nullish(),
	isTranscribed: z.boolean(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
	deletedAt: z.coerce.date().nullish()
});
export type Document = z.infer<typeof DocumentSchema>;

/**
 * DocumentContextBinding schema
 */
export const DocumentContextBindingSchema = z.object({
	id: z.string(),
	documentId: z.string(),
	contextType: DocumentContextTypeSchema,
	contextId: z.string(),
	isPrimary: z.boolean(),
	bindingNotes: z.string().nullish(),
	createdAt: z.coerce.date(),
	createdBy: z.string()
});
export type DocumentContextBinding = z.infer<typeof DocumentContextBindingSchema>;

/**
 * Document summary for list views
 */
export const DocumentSummarySchema = z.object({
	id: z.string(),
	title: z.string(),
	category: DocumentCategorySchema,
	status: DocumentStatusSchema,
	visibility: DocumentVisibilitySchema,
	fileName: z.string(),
	fileSize: z.number(),
	mimeType: z.string(),
	version: z.number(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date()
});
export type DocumentSummary = z.infer<typeof DocumentSummarySchema>;

// =============================================================================
// WorkOrder Domain Enum Schemas (re-exported from generated Zod schemas)
// =============================================================================

export const WorkOrderStatusSchema = GeneratedWorkOrderStatusSchema;
export type WorkOrderStatus = z.infer<typeof WorkOrderStatusSchema>;

export const WorkOrderPrioritySchema = GeneratedWorkOrderPrioritySchema;
export type WorkOrderPriority = z.infer<typeof WorkOrderPrioritySchema>;

export const WorkOrderCategorySchema = GeneratedWorkOrderCategorySchema;
export type WorkOrderCategory = z.infer<typeof WorkOrderCategorySchema>;

export const WorkOrderOriginTypeSchema = GeneratedWorkOrderOriginTypeSchema;
export type WorkOrderOriginType = z.infer<typeof WorkOrderOriginTypeSchema>;

export const BidStatusSchema = GeneratedBidStatusSchema;
export type BidStatus = z.infer<typeof BidStatusSchema>;

export const FundTypeSchema = GeneratedFundTypeSchema;
export type FundType = z.infer<typeof FundTypeSchema>;

// =============================================================================
// WorkOrder Domain Schemas
// =============================================================================

/**
 * WorkOrder schema (matches Prisma WorkOrder model - simplified)
 */
export const WorkOrderSchema = z.object({
	id: z.string(),
	organizationId: z.string(),
	associationId: z.string().nullish(),
	workOrderNumber: z.string(),
	title: z.string(),
	description: z.string().nullish(),
	category: WorkOrderCategorySchema,
	priority: WorkOrderPrioritySchema,
	status: WorkOrderStatusSchema,
	originType: WorkOrderOriginTypeSchema.nullish(),
	originId: z.string().nullish(),
	estimatedCost: DecimalSchema.nullish(),
	actualCost: DecimalSchema.nullish(),
	scheduledStart: z.coerce.date().nullish(),
	scheduledEnd: z.coerce.date().nullish(),
	actualStart: z.coerce.date().nullish(),
	actualEnd: z.coerce.date().nullish(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date()
});
export type WorkOrder = z.infer<typeof WorkOrderSchema>;

/**
 * WorkOrder summary for list views
 */
export const WorkOrderSummarySchema = z.object({
	id: z.string(),
	workOrderNumber: z.string(),
	title: z.string(),
	category: WorkOrderCategorySchema,
	priority: WorkOrderPrioritySchema,
	status: WorkOrderStatusSchema,
	scheduledStart: z.coerce.date().nullish(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date()
});
export type WorkOrderSummary = z.infer<typeof WorkOrderSummarySchema>;

// =============================================================================
// Staff Domain Enum Schemas (re-exported from generated Zod schemas)
// =============================================================================

export const StaffStatusSchema = GeneratedStaffStatusSchema;
export type StaffStatus = z.infer<typeof StaffStatusSchema>;

export const StaffRoleSchema = GeneratedStaffRoleSchema;
export type StaffRole = z.infer<typeof StaffRoleSchema>;

export const PillarAccessSchema = GeneratedPillarAccessSchema;
export type PillarAccess = z.infer<typeof PillarAccessSchema>;

// =============================================================================
// Activity Event Domain Enum Schemas (re-exported from generated Zod schemas)
// =============================================================================

export const ActivityEntityTypeSchema = GeneratedActivityEntityTypeSchema;
export type ActivityEntityType = z.infer<typeof ActivityEntityTypeSchema>;

export const ActivityActionTypeSchema = GeneratedActivityActionTypeSchema;
export type ActivityActionType = z.infer<typeof ActivityActionTypeSchema>;

export const ActivityActorTypeSchema = GeneratedActivityActorTypeSchema;
export type ActivityActorType = z.infer<typeof ActivityActorTypeSchema>;

export const ActivityEventCategorySchema = GeneratedActivityEventCategorySchema;
export type ActivityEventCategory = z.infer<typeof ActivityEventCategorySchema>;

export const OrganizationTypeSchema = GeneratedOrganizationTypeSchema;
export type OrganizationType = z.infer<typeof OrganizationTypeSchema>;

export const OrganizationStatusSchema = GeneratedOrganizationStatusSchema;
export type OrganizationStatus = z.infer<typeof OrganizationStatusSchema>;

export const UserRoleSchema = GeneratedUserRoleSchema;
export type UserRole = z.infer<typeof UserRoleSchema>;
