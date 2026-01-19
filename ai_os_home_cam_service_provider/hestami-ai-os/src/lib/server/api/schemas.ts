/**
 * API Schemas
 *
 * Centralized Zod schemas and type definitions for oRPC API routes.
 *
 * ARCHITECTURE:
 * - Re-exports generated Zod enum schemas from generated/zod
 * - Defines response shape schemas for API endpoints
 * - Provides helper functions for common response patterns
 *
 * All enum schemas are imported from generated files to ensure
 * they stay in sync with Prisma schema changes.
 */

import { z } from 'zod';

// =============================================================================
// Re-export Generated Enum Schemas
// =============================================================================

// Accounting
export { FundTypeSchema } from '../../../../generated/zod/inputTypeSchemas/FundTypeSchema.js';
export type { FundTypeType } from '../../../../generated/zod/inputTypeSchemas/FundTypeSchema.js';
export { BankAccountTypeSchema } from '../../../../generated/zod/inputTypeSchemas/BankAccountTypeSchema.js';
export type { BankAccountTypeType } from '../../../../generated/zod/inputTypeSchemas/BankAccountTypeSchema.js';
export { AccountTypeSchema } from '../../../../generated/zod/inputTypeSchemas/AccountTypeSchema.js';
export type { AccountTypeType } from '../../../../generated/zod/inputTypeSchemas/AccountTypeSchema.js';
export { AccountCategorySchema } from '../../../../generated/zod/inputTypeSchemas/AccountCategorySchema.js';
export type { AccountCategoryType } from '../../../../generated/zod/inputTypeSchemas/AccountCategorySchema.js';
export { AssessmentFrequencySchema } from '../../../../generated/zod/inputTypeSchemas/AssessmentFrequencySchema.js';
export type { AssessmentFrequencyType } from '../../../../generated/zod/inputTypeSchemas/AssessmentFrequencySchema.js';
export { ChargeStatusSchema } from '../../../../generated/zod/inputTypeSchemas/ChargeStatusSchema.js';
export type { ChargeStatusType } from '../../../../generated/zod/inputTypeSchemas/ChargeStatusSchema.js';
export { InvoiceStatusSchema } from '../../../../generated/zod/inputTypeSchemas/InvoiceStatusSchema.js';
export type { InvoiceStatusType } from '../../../../generated/zod/inputTypeSchemas/InvoiceStatusSchema.js';
export { JournalEntryStatusSchema } from '../../../../generated/zod/inputTypeSchemas/JournalEntryStatusSchema.js';
export type { JournalEntryStatusType } from '../../../../generated/zod/inputTypeSchemas/JournalEntryStatusSchema.js';
export { PaymentMethodSchema } from '../../../../generated/zod/inputTypeSchemas/PaymentMethodSchema.js';
export type { PaymentMethodType } from '../../../../generated/zod/inputTypeSchemas/PaymentMethodSchema.js';
export { PaymentStatusSchema } from '../../../../generated/zod/inputTypeSchemas/PaymentStatusSchema.js';
export type { PaymentStatusType } from '../../../../generated/zod/inputTypeSchemas/PaymentStatusSchema.js';

// ARC
export { ARCReviewActionSchema } from '../../../../generated/zod/inputTypeSchemas/ARCReviewActionSchema.js';
export type { ARCReviewActionType } from '../../../../generated/zod/inputTypeSchemas/ARCReviewActionSchema.js';

// Association
export { AssociationStatusSchema } from '../../../../generated/zod/inputTypeSchemas/AssociationStatusSchema.js';
export type { AssociationStatusType } from '../../../../generated/zod/inputTypeSchemas/AssociationStatusSchema.js';

// Communication
export { CommunicationChannelSchema } from '../../../../generated/zod/inputTypeSchemas/CommunicationChannelSchema.js';
export type { CommunicationChannelType } from '../../../../generated/zod/inputTypeSchemas/CommunicationChannelSchema.js';
export { CommunicationDirectionSchema } from '../../../../generated/zod/inputTypeSchemas/CommunicationDirectionSchema.js';
export type { CommunicationDirectionType } from '../../../../generated/zod/inputTypeSchemas/CommunicationDirectionSchema.js';
export { CommunicationTemplateTypeSchema } from '../../../../generated/zod/inputTypeSchemas/CommunicationTemplateTypeSchema.js';
export type { CommunicationTemplateTypeType } from '../../../../generated/zod/inputTypeSchemas/CommunicationTemplateTypeSchema.js';
export { CommunicationStatusSchema } from '../../../../generated/zod/inputTypeSchemas/CommunicationStatusSchema.js';
export type { CommunicationStatusType } from '../../../../generated/zod/inputTypeSchemas/CommunicationStatusSchema.js';
export { AnnouncementStatusSchema } from '../../../../generated/zod/inputTypeSchemas/AnnouncementStatusSchema.js';
export type { AnnouncementStatusType } from '../../../../generated/zod/inputTypeSchemas/AnnouncementStatusSchema.js';
export { CalendarEventTypeSchema } from '../../../../generated/zod/inputTypeSchemas/CalendarEventTypeSchema.js';
export type { CalendarEventTypeType } from '../../../../generated/zod/inputTypeSchemas/CalendarEventTypeSchema.js';
export { DeliveryStatusSchema } from '../../../../generated/zod/inputTypeSchemas/DeliveryStatusSchema.js';
export type { DeliveryStatusType } from '../../../../generated/zod/inputTypeSchemas/DeliveryStatusSchema.js';
export { NotificationStatusSchema } from '../../../../generated/zod/inputTypeSchemas/NotificationStatusSchema.js';
export type { NotificationStatusType } from '../../../../generated/zod/inputTypeSchemas/NotificationStatusSchema.js';
export { TemplateVersionStatusSchema } from '../../../../generated/zod/inputTypeSchemas/TemplateVersionStatusSchema.js';
export type { TemplateVersionStatusType } from '../../../../generated/zod/inputTypeSchemas/TemplateVersionStatusSchema.js';

// Compliance
export { ComplianceRequirementTypeSchema } from '../../../../generated/zod/inputTypeSchemas/ComplianceRequirementTypeSchema.js';
export type { ComplianceRequirementTypeType } from '../../../../generated/zod/inputTypeSchemas/ComplianceRequirementTypeSchema.js';
export { ComplianceStatusSchema } from '../../../../generated/zod/inputTypeSchemas/ComplianceStatusSchema.js';
export type { ComplianceStatusType } from '../../../../generated/zod/inputTypeSchemas/ComplianceStatusSchema.js';
export { RecurrencePatternSchema } from '../../../../generated/zod/inputTypeSchemas/RecurrencePatternSchema.js';
export type { RecurrencePatternType } from '../../../../generated/zod/inputTypeSchemas/RecurrencePatternSchema.js';

// Governance
export { BoardRoleSchema } from '../../../../generated/zod/inputTypeSchemas/BoardRoleSchema.js';
export type { BoardRoleType } from '../../../../generated/zod/inputTypeSchemas/BoardRoleSchema.js';
export { BoardMotionCategorySchema } from '../../../../generated/zod/inputTypeSchemas/BoardMotionCategorySchema.js';
export type { BoardMotionCategoryType } from '../../../../generated/zod/inputTypeSchemas/BoardMotionCategorySchema.js';
export { BoardMotionStatusSchema } from '../../../../generated/zod/inputTypeSchemas/BoardMotionStatusSchema.js';
export type { BoardMotionStatusType } from '../../../../generated/zod/inputTypeSchemas/BoardMotionStatusSchema.js';
export { BoardMotionOutcomeSchema } from '../../../../generated/zod/inputTypeSchemas/BoardMotionOutcomeSchema.js';
export type { BoardMotionOutcomeType } from '../../../../generated/zod/inputTypeSchemas/BoardMotionOutcomeSchema.js';
export { CommitteeTypeSchema } from '../../../../generated/zod/inputTypeSchemas/CommitteeTypeSchema.js';
export type { CommitteeTypeType } from '../../../../generated/zod/inputTypeSchemas/CommitteeTypeSchema.js';
export { CommitteeRoleSchema } from '../../../../generated/zod/inputTypeSchemas/CommitteeRoleSchema.js';
export type { CommitteeRoleType } from '../../../../generated/zod/inputTypeSchemas/CommitteeRoleSchema.js';
export { MeetingTypeSchema } from '../../../../generated/zod/inputTypeSchemas/MeetingTypeSchema.js';
export type { MeetingTypeType } from '../../../../generated/zod/inputTypeSchemas/MeetingTypeSchema.js';
export { MeetingStatusSchema } from '../../../../generated/zod/inputTypeSchemas/MeetingStatusSchema.js';
export type { MeetingStatusType } from '../../../../generated/zod/inputTypeSchemas/MeetingStatusSchema.js';
export { MeetingAttendanceStatusSchema } from '../../../../generated/zod/inputTypeSchemas/MeetingAttendanceStatusSchema.js';
export type { MeetingAttendanceStatusType } from '../../../../generated/zod/inputTypeSchemas/MeetingAttendanceStatusSchema.js';
export { VoteMethodSchema } from '../../../../generated/zod/inputTypeSchemas/VoteMethodSchema.js';
export type { VoteMethodType } from '../../../../generated/zod/inputTypeSchemas/VoteMethodSchema.js';
export { VoteChoiceSchema } from '../../../../generated/zod/inputTypeSchemas/VoteChoiceSchema.js';
export type { VoteChoiceType } from '../../../../generated/zod/inputTypeSchemas/VoteChoiceSchema.js';
export { ResolutionStatusSchema } from '../../../../generated/zod/inputTypeSchemas/ResolutionStatusSchema.js';
export type { ResolutionStatusType } from '../../../../generated/zod/inputTypeSchemas/ResolutionStatusSchema.js';
export { PolicyStatusSchema } from '../../../../generated/zod/inputTypeSchemas/PolicyStatusSchema.js';
export type { PolicyStatusType } from '../../../../generated/zod/inputTypeSchemas/PolicyStatusSchema.js';

// Unit
export { UnitTypeSchema } from '../../../../generated/zod/inputTypeSchemas/UnitTypeSchema.js';
export type { UnitTypeType } from '../../../../generated/zod/inputTypeSchemas/UnitTypeSchema.js';

// Contractor
export { VendorApprovalStatusSchema } from '../../../../generated/zod/inputTypeSchemas/VendorApprovalStatusSchema.js';
export type { VendorApprovalStatusType } from '../../../../generated/zod/inputTypeSchemas/VendorApprovalStatusSchema.js';
export { InsuranceTypeSchema } from '../../../../generated/zod/inputTypeSchemas/InsuranceTypeSchema.js';
export type { InsuranceTypeType } from '../../../../generated/zod/inputTypeSchemas/InsuranceTypeSchema.js';
export { InsuranceStatusSchema } from '../../../../generated/zod/inputTypeSchemas/InsuranceStatusSchema.js';
export type { InsuranceStatusType } from '../../../../generated/zod/inputTypeSchemas/InsuranceStatusSchema.js';
export { LicenseStatusSchema } from '../../../../generated/zod/inputTypeSchemas/LicenseStatusSchema.js';
export type { LicenseStatusType } from '../../../../generated/zod/inputTypeSchemas/LicenseStatusSchema.js';

// Owner Portal
export { ContactPreferenceChannelSchema } from '../../../../generated/zod/inputTypeSchemas/ContactPreferenceChannelSchema.js';
export type { ContactPreferenceChannelType } from '../../../../generated/zod/inputTypeSchemas/ContactPreferenceChannelSchema.js';
export { NotificationCategorySchema } from '../../../../generated/zod/inputTypeSchemas/NotificationCategorySchema.js';
export type { NotificationCategoryType } from '../../../../generated/zod/inputTypeSchemas/NotificationCategorySchema.js';
export { OwnerRequestStatusSchema } from '../../../../generated/zod/inputTypeSchemas/OwnerRequestStatusSchema.js';
export type { OwnerRequestStatusType } from '../../../../generated/zod/inputTypeSchemas/OwnerRequestStatusSchema.js';
export { OwnerRequestCategorySchema } from '../../../../generated/zod/inputTypeSchemas/OwnerRequestCategorySchema.js';
export type { OwnerRequestCategoryType } from '../../../../generated/zod/inputTypeSchemas/OwnerRequestCategorySchema.js';
export { PaymentMethodTypeSchema } from '../../../../generated/zod/inputTypeSchemas/PaymentMethodTypeSchema.js';
export type { PaymentMethodTypeType } from '../../../../generated/zod/inputTypeSchemas/PaymentMethodTypeSchema.js';
export { AutoPayFrequencySchema } from '../../../../generated/zod/inputTypeSchemas/AutoPayFrequencySchema.js';
export type { AutoPayFrequencyType } from '../../../../generated/zod/inputTypeSchemas/AutoPayFrequencySchema.js';

// Party / Property
export { PartyTypeSchema } from '../../../../generated/zod/inputTypeSchemas/PartyTypeSchema.js';
export type { PartyTypeType } from '../../../../generated/zod/inputTypeSchemas/PartyTypeSchema.js';
export { PropertyTypeSchema } from '../../../../generated/zod/inputTypeSchemas/PropertyTypeSchema.js';
export type { PropertyTypeType } from '../../../../generated/zod/inputTypeSchemas/PropertyTypeSchema.js';

// Violation
export { AppealStatusSchema } from '../../../../generated/zod/inputTypeSchemas/AppealStatusSchema.js';
export type { AppealStatusType } from '../../../../generated/zod/inputTypeSchemas/AppealStatusSchema.js';
export { AppealDecisionSchema } from '../../../../generated/zod/inputTypeSchemas/AppealDecisionSchema.js';
export type { AppealDecisionType } from '../../../../generated/zod/inputTypeSchemas/AppealDecisionSchema.js';
export { ReporterTypeSchema } from '../../../../generated/zod/inputTypeSchemas/ReporterTypeSchema.js';
export type { ReporterTypeType } from '../../../../generated/zod/inputTypeSchemas/ReporterTypeSchema.js';

// Media
export { MediaTypeSchema } from '../../../../generated/zod/inputTypeSchemas/MediaTypeSchema.js';
export type { MediaTypeType } from '../../../../generated/zod/inputTypeSchemas/MediaTypeSchema.js';

// Document
export { DocumentCategorySchema } from '../../../../generated/zod/inputTypeSchemas/DocumentCategorySchema.js';
export type { DocumentCategoryType } from '../../../../generated/zod/inputTypeSchemas/DocumentCategorySchema.js';

// Reserve
export { FundingPlanTypeSchema } from '../../../../generated/zod/inputTypeSchemas/FundingPlanTypeSchema.js';
export type { FundingPlanTypeType } from '../../../../generated/zod/inputTypeSchemas/FundingPlanTypeSchema.js';
export { ReserveComponentCategorySchema } from '../../../../generated/zod/inputTypeSchemas/ReserveComponentCategorySchema.js';
export type { ReserveComponentCategoryType } from '../../../../generated/zod/inputTypeSchemas/ReserveComponentCategorySchema.js';
export { ReserveStudyTypeSchema } from '../../../../generated/zod/inputTypeSchemas/ReserveStudyTypeSchema.js';
export type { ReserveStudyTypeType } from '../../../../generated/zod/inputTypeSchemas/ReserveStudyTypeSchema.js';

// Work Order / Asset
export { AssetCategorySchema } from '../../../../generated/zod/inputTypeSchemas/AssetCategorySchema.js';
export type { AssetCategoryType } from '../../../../generated/zod/inputTypeSchemas/AssetCategorySchema.js';
export { AssetStatusSchema } from '../../../../generated/zod/inputTypeSchemas/AssetStatusSchema.js';
export type { AssetStatusType } from '../../../../generated/zod/inputTypeSchemas/AssetStatusSchema.js';
export { BidStatusSchema } from '../../../../generated/zod/inputTypeSchemas/BidStatusSchema.js';
export type { BidStatusType } from '../../../../generated/zod/inputTypeSchemas/BidStatusSchema.js';

// Report
export { ReportCategorySchema } from '../../../../generated/zod/inputTypeSchemas/ReportCategorySchema.js';
export type { ReportCategoryType } from '../../../../generated/zod/inputTypeSchemas/ReportCategorySchema.js';
export { ReportFormatSchema } from '../../../../generated/zod/inputTypeSchemas/ReportFormatSchema.js';
export type { ReportFormatType } from '../../../../generated/zod/inputTypeSchemas/ReportFormatSchema.js';
export { ReportExecutionStatusSchema } from '../../../../generated/zod/inputTypeSchemas/ReportExecutionStatusSchema.js';
export type { ReportExecutionStatusType } from '../../../../generated/zod/inputTypeSchemas/ReportExecutionStatusSchema.js';
export { ScheduleFrequencySchema } from '../../../../generated/zod/inputTypeSchemas/ScheduleFrequencySchema.js';
export type { ScheduleFrequencyType } from '../../../../generated/zod/inputTypeSchemas/ScheduleFrequencySchema.js';
export { ReportDeliveryMethodSchema } from '../../../../generated/zod/inputTypeSchemas/ReportDeliveryMethodSchema.js';
export type { ReportDeliveryMethodType } from '../../../../generated/zod/inputTypeSchemas/ReportDeliveryMethodSchema.js';

// Ownership
export { OwnershipTypeSchema } from '../../../../generated/zod/inputTypeSchemas/OwnershipTypeSchema.js';
export type { OwnershipTypeType } from '../../../../generated/zod/inputTypeSchemas/OwnershipTypeSchema.js';

// Dashboard
export { WidgetTypeSchema } from '../../../../generated/zod/inputTypeSchemas/WidgetTypeSchema.js';
export type { WidgetTypeType } from '../../../../generated/zod/inputTypeSchemas/WidgetTypeSchema.js';

// Vendor
export { VendorCandidateStatusSchema } from '../../../../generated/zod/inputTypeSchemas/VendorCandidateStatusSchema.js';
export type { VendorCandidateStatusType } from '../../../../generated/zod/inputTypeSchemas/VendorCandidateStatusSchema.js';
export { VendorInteractionTypeSchema } from '../../../../generated/zod/inputTypeSchemas/VendorInteractionTypeSchema.js';
export type { VendorInteractionTypeType } from '../../../../generated/zod/inputTypeSchemas/VendorInteractionTypeSchema.js';

// Job
export { JobPrioritySchema } from '../../../../generated/zod/inputTypeSchemas/JobPrioritySchema.js';
export type { JobPriorityType } from '../../../../generated/zod/inputTypeSchemas/JobPrioritySchema.js';
export { JobVisitStatusSchema } from '../../../../generated/zod/inputTypeSchemas/JobVisitStatusSchema.js';
export type { JobVisitStatusType } from '../../../../generated/zod/inputTypeSchemas/JobVisitStatusSchema.js';

// Phase 38: Organization Invitations & Join Requests
export { InvitationStatusSchema } from '../../../../generated/zod/inputTypeSchemas/InvitationStatusSchema.js';
export type { InvitationStatusType } from '../../../../generated/zod/inputTypeSchemas/InvitationStatusSchema.js';
export { JoinRequestStatusSchema } from '../../../../generated/zod/inputTypeSchemas/JoinRequestStatusSchema.js';
export type { JoinRequestStatusType } from '../../../../generated/zod/inputTypeSchemas/JoinRequestStatusSchema.js';
export { InvitationDeliveryMethodSchema } from '../../../../generated/zod/inputTypeSchemas/InvitationDeliveryMethodSchema.js';
export type { InvitationDeliveryMethodType } from '../../../../generated/zod/inputTypeSchemas/InvitationDeliveryMethodSchema.js';

// =============================================================================
// Response Metadata Schema
// =============================================================================

export const ResponseMetaSchema = z.object({
	timestamp: z.string(),
	requestId: z.string().optional(),
	apiVersion: z.string().optional()
});

// =============================================================================
// Response Helper Functions
// =============================================================================

/**
 * Creates a success response schema with data payload
 */
export function successResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
	return z.object({
		ok: z.literal(true),
		data: dataSchema,
		meta: ResponseMetaSchema
	});
}
