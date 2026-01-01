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
