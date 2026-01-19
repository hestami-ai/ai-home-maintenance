/**
 * Workflow Schemas
 *
 * Centralized type definitions and Zod schemas for DBOS workflows.
 * 
 * ARCHITECTURE:
 * - Re-exports Prisma enums used by workflows
 * - Defines base types for common workflow patterns
 * - Provides Zod schemas for runtime validation
 * 
 * All Prisma-derived types are imported from generated files to ensure
 * compile-time validation against the schema.
 */

import { z } from 'zod';

// =============================================================================
// Re-export Prisma Enums Used by Workflows
// =============================================================================

// Case/Concierge
export {
	ConciergeCaseStatus,
	ConciergeCasePriority,
	OwnerIntentStatus,
	OwnerIntentCategory
} from '../../../../generated/prisma/enums.js';

// Violations
export {
	ViolationStatus,
	ViolationSeverity,
	NoticeType,
	NoticeDeliveryMethod,
	HearingOutcome,
	AppealStatus
} from '../../../../generated/prisma/enums.js';

// Documents
export {
	DocumentCategory,
	DocumentContextType,
	DocumentVisibility,
	DocumentStatus,
	StorageProvider
} from '../../../../generated/prisma/enums.js';

// Work Orders
export {
	WorkOrderStatus,
	WorkOrderPriority,
	WorkOrderCategory
} from '../../../../generated/prisma/enums.js';

// Jobs
export {
	JobStatus
} from '../../../../generated/prisma/enums.js';

// Checklists
export {
	ChecklistItemStatus
} from '../../../../generated/prisma/enums.js';

// Communication
export {
	CommunicationChannel,
	CommunicationTemplateType,
	DeliveryStatus,
	AnnouncementStatus,
	NotificationStatus,
	NotificationType,
	NotificationReadStatus,
	NotificationCategory
} from '../../../../generated/prisma/enums.js';

// ARC
export {
	ARCRequestStatus,
	ARCCategory,
	ARCReviewAction
} from '../../../../generated/prisma/enums.js';

// Estimates/Invoices
export {
	EstimateStatus,
	InvoiceStatus
} from '../../../../generated/prisma/enums.js';

// Phase 38: Organization Invitations & Join Requests
export {
	InvitationStatus,
	JoinRequestStatus,
	InvitationDeliveryMethod
} from '../../../../generated/prisma/enums.js';

// Activity Actions (for workflow tracing)
export {
	ActivityActionType
} from '../../../../generated/prisma/enums.js';

// =============================================================================
// Workflow Error Types (for tracing/observability)
// =============================================================================

/**
 * Error type discriminators for workflow error categorization.
 * Used in recordSpanError() for observability and filtering in SigNoz.
 */
export const WorkflowErrorType = {
	// Workflow-specific errors
	INVITATION_WORKFLOW_ERROR: 'INVITATION_WORKFLOW_ERROR',
	DOCUMENT_WORKFLOW_ERROR: 'DOCUMENT_WORKFLOW_ERROR',
	CASE_WORKFLOW_ERROR: 'CASE_WORKFLOW_ERROR',
	VIOLATION_WORKFLOW_ERROR: 'VIOLATION_WORKFLOW_ERROR',
	WORK_ORDER_WORKFLOW_ERROR: 'WORK_ORDER_WORKFLOW_ERROR',
	JOB_WORKFLOW_ERROR: 'JOB_WORKFLOW_ERROR',
	GOVERNANCE_WORKFLOW_ERROR: 'GOVERNANCE_WORKFLOW_ERROR',
	DISPATCH_WORKFLOW_ERROR: 'DISPATCH_WORKFLOW_ERROR',
	ESTIMATE_WORKFLOW_ERROR: 'ESTIMATE_WORKFLOW_ERROR',
	INVOICE_WORKFLOW_ERROR: 'INVOICE_WORKFLOW_ERROR',
	ARC_WORKFLOW_ERROR: 'ARC_WORKFLOW_ERROR',
	CONTRACT_WORKFLOW_ERROR: 'CONTRACT_WORKFLOW_ERROR',
	INVENTORY_WORKFLOW_ERROR: 'INVENTORY_WORKFLOW_ERROR',
	MEETING_WORKFLOW_ERROR: 'MEETING_WORKFLOW_ERROR',
	MOTION_WORKFLOW_ERROR: 'MOTION_WORKFLOW_ERROR',
	// Generic errors
	AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
	VALIDATION_ERROR: 'VALIDATION_ERROR',
	DATABASE_ERROR: 'DATABASE_ERROR',
	EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
	// API/Route-level errors
	ORPC_ERROR: 'ORPC_ERROR',
	INVITATION_ERROR: 'INVITATION_ERROR'
} as const;

export type WorkflowErrorType = (typeof WorkflowErrorType)[keyof typeof WorkflowErrorType];

// =============================================================================
// Cerbos Effect Kinds (for authorization policy evaluation)
// =============================================================================

/**
 * Cerbos policy effect kinds.
 * Used when evaluating authorization rules.
 */
export const CerbosEffectKind = {
	ALWAYS_ALLOWED: 'always_allowed',
	ALWAYS_DENIED: 'always_denied',
	CONDITIONAL: 'conditional'
} as const;

export type CerbosEffectKind = (typeof CerbosEffectKind)[keyof typeof CerbosEffectKind];

// =============================================================================
// Meeting Event Types (for real-time meeting updates)
// =============================================================================

/**
 * Event types for real-time meeting updates via SSE/WebSocket.
 */
export const MeetingEventType = {
	ATTENDANCE_UPDATE: 'attendance_update',
	VOTE_UPDATE: 'vote_update',
	MOTION_UPDATE: 'motion_update',
	MEETING_STATE: 'meeting_state',
	QUORUM_UPDATE: 'quorum_update',
	HEARTBEAT: 'heartbeat'
} as const;

export type MeetingEventType = (typeof MeetingEventType)[keyof typeof MeetingEventType];

// =============================================================================
// Vote Event Types (for real-time vote updates)
// =============================================================================

/**
 * Event types for real-time vote updates via SSE/WebSocket.
 */
export const VoteEventType = {
	BALLOT_CAST: 'ballot_cast',
	TALLY_UPDATE: 'tally_update',
	VOTE_CLOSED: 'vote_closed'
} as const;

export type VoteEventType = (typeof VoteEventType)[keyof typeof VoteEventType];

// =============================================================================
// Base Workflow Types
// =============================================================================

/**
 * Base interface for all workflow inputs.
 * All workflows receive organizationId and userId for context.
 */
export interface BaseWorkflowInput {
	organizationId: string;
	userId: string;
}

/**
 * Base interface for all workflow results.
 * Provides consistent success/error reporting.
 */
export interface BaseWorkflowResult {
	success: boolean;
	error?: string;
}

/**
 * Extended result with entity ID for create/update operations.
 */
export interface EntityWorkflowResult extends BaseWorkflowResult {
	entityId?: string;
}

/**
 * Processing metadata for Document Processing Queue (DPQ).
 */
export interface ProcessingMetadata {
	errorType: 'TRANSIENT' | 'PERMANENT' | 'INFECTED';
	errorCode: string;
	errorMessage: string;
	errorStack?: string;
	attemptCount: number;
	maxAttempts: number;
	lastAttemptAt: Date;
	nextRetryAt?: Date;
	malwareInfo?: {
		signature: string;
		engine: string;
		detectedAt: Date;
	};
}

/**
 * Extended result with action tracking for lifecycle workflows.
 */
export interface LifecycleWorkflowResult extends BaseWorkflowResult {
	action: string;
	timestamp: string;
}

// =============================================================================
// Zod Schemas for Base Types
// =============================================================================

export const BaseWorkflowInputSchema = z.object({
	organizationId: z.string().uuid(),
	userId: z.string().uuid()
});

export const BaseWorkflowResultSchema = z.object({
	success: z.boolean(),
	error: z.string().optional()
});

export const EntityWorkflowResultSchema = BaseWorkflowResultSchema.extend({
	entityId: z.string().optional()
});

export const LifecycleWorkflowResultSchema = BaseWorkflowResultSchema.extend({
	action: z.string(),
	timestamp: z.string()
});

// =============================================================================
// Common Action Patterns
// =============================================================================

/**
 * Standard CRUD actions used by many workflows.
 */
export const CrudAction = {
	CREATE: 'CREATE',
	UPDATE: 'UPDATE',
	DELETE: 'DELETE',
	ARCHIVE: 'ARCHIVE',
	RESTORE: 'RESTORE'
} as const;

export type CrudAction = (typeof CrudAction)[keyof typeof CrudAction];

export const CrudActionSchema = z.enum(['CREATE', 'UPDATE', 'DELETE', 'ARCHIVE', 'RESTORE']);

// =============================================================================
// Re-export Generated Zod Schemas
// =============================================================================

// Import and re-export generated Zod schemas for enum validation
export { ConciergeCaseStatusSchema } from '../../../../generated/zod/inputTypeSchemas/ConciergeCaseStatusSchema.js';
export { ConciergeCasePrioritySchema } from '../../../../generated/zod/inputTypeSchemas/ConciergeCasePrioritySchema.js';
export { ViolationStatusSchema } from '../../../../generated/zod/inputTypeSchemas/ViolationStatusSchema.js';
export { ViolationSeveritySchema } from '../../../../generated/zod/inputTypeSchemas/ViolationSeveritySchema.js';
export { DocumentCategorySchema } from '../../../../generated/zod/inputTypeSchemas/DocumentCategorySchema.js';
export { DocumentContextTypeSchema } from '../../../../generated/zod/inputTypeSchemas/DocumentContextTypeSchema.js';
export { DocumentVisibilitySchema } from '../../../../generated/zod/inputTypeSchemas/DocumentVisibilitySchema.js';
export { DocumentStatusSchema } from '../../../../generated/zod/inputTypeSchemas/DocumentStatusSchema.js';
export { WorkOrderStatusSchema } from '../../../../generated/zod/inputTypeSchemas/WorkOrderStatusSchema.js';
export { WorkOrderPrioritySchema } from '../../../../generated/zod/inputTypeSchemas/WorkOrderPrioritySchema.js';
export { WorkOrderCategorySchema } from '../../../../generated/zod/inputTypeSchemas/WorkOrderCategorySchema.js';
export { JobStatusSchema } from '../../../../generated/zod/inputTypeSchemas/JobStatusSchema.js';
export { ChecklistItemStatusSchema } from '../../../../generated/zod/inputTypeSchemas/ChecklistItemStatusSchema.js';
export { CommunicationChannelSchema } from '../../../../generated/zod/inputTypeSchemas/CommunicationChannelSchema.js';
export { ARCRequestStatusSchema } from '../../../../generated/zod/inputTypeSchemas/ARCRequestStatusSchema.js';
export { ARCCategorySchema } from '../../../../generated/zod/inputTypeSchemas/ARCCategorySchema.js';
export { EstimateStatusSchema } from '../../../../generated/zod/inputTypeSchemas/EstimateStatusSchema.js';
export { InvoiceStatusSchema } from '../../../../generated/zod/inputTypeSchemas/InvoiceStatusSchema.js';
export { NotificationTypeSchema } from '../../../../generated/zod/inputTypeSchemas/NotificationTypeSchema.js';
export { NotificationReadStatusSchema } from '../../../../generated/zod/inputTypeSchemas/NotificationReadStatusSchema.js';
export { NotificationCategorySchema } from '../../../../generated/zod/inputTypeSchemas/NotificationCategorySchema.js';

// =============================================================================
// Type Discriminator Const Objects
// =============================================================================

/**
 * Processing error types for Document Processing Queue (DPQ) and similar systems.
 * TRANSIENT errors can be retried, PERMANENT errors cannot, INFECTED indicates malware.
 */
export const ProcessingErrorType = {
	TRANSIENT: 'TRANSIENT',
	PERMANENT: 'PERMANENT',
	INFECTED: 'INFECTED'
} as const;

export type ProcessingErrorType = (typeof ProcessingErrorType)[keyof typeof ProcessingErrorType];

/**
 * Span error types for OpenTelemetry tracing observability.
 * Used with recordSpanError to categorize errors in traces.
 */
export const SpanErrorType = {
	DOCUMENT_UPLOAD_ERROR: 'DOCUMENT_UPLOAD_ERROR',
	DOCUMENT_LIST_ERROR: 'DOCUMENT_LIST_ERROR',
	STAFF_ACTIVATION_ERROR: 'STAFF_ACTIVATION_ERROR'
} as const;

export type SpanErrorType = (typeof SpanErrorType)[keyof typeof SpanErrorType];

/**
 * Health status values for health check endpoints.
 */
export const HealthStatus = {
	HEALTHY: 'healthy',
	UNHEALTHY: 'unhealthy'
} as const;

export type HealthStatus = (typeof HealthStatus)[keyof typeof HealthStatus];

/**
 * Governance item types for dashboard recent activity.
 */
export const GovernanceItemType = {
	ARC_APPROVED: 'ARC_APPROVED',
	VIOLATION_CLOSED: 'VIOLATION_CLOSED',
	MOTION_APPROVED: 'MOTION_APPROVED',
	POLICY_CREATED: 'POLICY_CREATED',
	RESOLUTION_ADOPTED: 'RESOLUTION_ADOPTED'
} as const;

export type GovernanceItemType = (typeof GovernanceItemType)[keyof typeof GovernanceItemType];

/**
 * Prisma sort order values.
 * While Prisma types narrow to 'asc' | 'desc', this provides runtime const values.
 */
export const SortOrder = {
	ASC: 'asc',
	DESC: 'desc'
} as const;

export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder];
