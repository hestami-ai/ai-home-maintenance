/**
 * Activity Event API client
 * Provides typed functions for querying activity events (audit trail)
 * 
 * Types are extracted from the generated OpenAPI types to follow
 * the type generation pipeline: Prisma → Zod → oRPC → OpenAPI → types.generated.ts
 */

import { orpc } from './orpc.js';
import type { operations } from './types.generated.js';

// =============================================================================
// Type Definitions (extracted from generated types)
// =============================================================================

// Extract ActivityEvent type from getByEntity response
export type ActivityEvent = operations['activityEvent.getByEntity']['responses']['200']['content']['application/json']['data']['events'][number];

// Extract enum types from search request body (has all the enum options)
type SearchInput = NonNullable<operations['activityEvent.search']['requestBody']>['content']['application/json'];
export type ActivityEntityType = NonNullable<SearchInput['entityType']>;
export type ActivityActionType = NonNullable<SearchInput['action']>;
export type ActivityEventCategory = NonNullable<SearchInput['eventCategory']>;
export type ActivityActorType = NonNullable<SearchInput['performedByType']>;

// =============================================================================
// API Functions
// =============================================================================

export const activityEventApi = {
	/**
	 * Get activity events for a specific entity
	 */
	getByEntity: (params: {
		entityType: ActivityEntityType;
		entityId: string;
		limit?: number;
		cursor?: string;
	}) => orpc.activityEvent.getByEntity(params),

	/**
	 * Get activity events for the organization
	 */
	getByOrganization: (params?: {
		entityType?: ActivityEntityType;
		action?: ActivityActionType;
		eventCategory?: ActivityEventCategory;
		performedByType?: ActivityActorType;
		startDate?: string;
		endDate?: string;
		limit?: number;
		cursor?: string;
	}) => orpc.activityEvent.getByOrganization(params ?? {}),

	/**
	 * Get activity events for a case
	 */
	getByCase: (params: {
		caseId: string;
		limit?: number;
		cursor?: string;
	}) => orpc.activityEvent.getByCase(params),

	/**
	 * Get activity events for a job
	 */
	getByJob: (params: {
		jobId: string;
		limit?: number;
		cursor?: string;
	}) => orpc.activityEvent.getByJob(params),

	/**
	 * Get activity events by actor
	 */
	getByActor: (params: {
		actorId: string;
		actorType?: ActivityActorType;
		limit?: number;
		cursor?: string;
	}) => orpc.activityEvent.getByActor(params),

	/**
	 * Search activity events with filters
	 */
	search: (params?: SearchInput) => orpc.activityEvent.search(params ?? {})
};

// =============================================================================
// Helper Functions
// =============================================================================

export const ENTITY_TYPE_LABELS: Record<ActivityEntityType, string> = {
	ASSOCIATION: 'Association',
	UNIT: 'Unit',
	OWNER: 'Owner',
	VIOLATION: 'Violation',
	ARC_REQUEST: 'ARC Request',
	ASSESSMENT: 'Assessment',
	GOVERNING_DOCUMENT: 'Governing Document',
	BOARD_ACTION: 'Board Action',
	JOB: 'Job',
	WORK_ORDER: 'Work Order',
	ESTIMATE: 'Estimate',
	INVOICE: 'Invoice',
	TECHNICIAN: 'Technician',
	CONTRACTOR: 'Contractor',
	INVENTORY: 'Inventory',
	CONCIERGE_CASE: 'Concierge Case',
	OWNER_INTENT: 'Owner Intent',
	INDIVIDUAL_PROPERTY: 'Property',
	PROPERTY_DOCUMENT: 'Property Document',
	MATERIAL_DECISION: 'Material Decision',
	EXTERNAL_HOA: 'External HOA',
	EXTERNAL_VENDOR: 'External Vendor',
	CONCIERGE_ACTION: 'Concierge Action',
	USER: 'User',
	USER_ROLE: 'User Role',
	ORGANIZATION: 'Organization',
	DOCUMENT: 'Document',
	OTHER: 'Other'
};

export const ACTION_TYPE_LABELS: Record<ActivityActionType, string> = {
	CREATE: 'Created',
	UPDATE: 'Updated',
	DELETE: 'Deleted',
	ARCHIVE: 'Archived',
	RESTORE: 'Restored',
	STATUS_CHANGE: 'Status Changed',
	ASSIGN: 'Assigned',
	UNASSIGN: 'Unassigned',
	APPROVE: 'Approved',
	DENY: 'Denied',
	SUBMIT: 'Submitted',
	CANCEL: 'Cancelled',
	COMPLETE: 'Completed',
	CLOSE: 'Closed',
	REOPEN: 'Reopened',
	ESCALATE: 'Escalated',
	COMMENT: 'Commented',
	ATTACH: 'Attached',
	DETACH: 'Detached',
	TRANSFER: 'Transferred',
	SCHEDULE: 'Scheduled',
	DISPATCH: 'Dispatched',
	START: 'Started',
	PAUSE: 'Paused',
	RESUME: 'Resumed',
	INVOICE: 'Invoiced',
	PAY: 'Paid',
	REFUND: 'Refunded',
	ADJUST: 'Adjusted',
	VERIFY: 'Verified',
	REJECT: 'Rejected',
	EXPIRE: 'Expired',
	RENEW: 'Renewed',
	LOGIN: 'Logged In',
	LOGOUT: 'Logged Out',
	PASSWORD_CHANGE: 'Password Changed',
	ROLE_CHANGE: 'Role Changed',
	PERMISSION_CHANGE: 'Permission Changed',
	OTHER: 'Other'
};

export const ACTOR_TYPE_LABELS: Record<ActivityActorType, string> = {
	HUMAN: 'User',
	AI: 'AI Agent',
	SYSTEM: 'System'
};

export const EVENT_CATEGORY_LABELS: Record<ActivityEventCategory, string> = {
	INTENT: 'Intent',
	DECISION: 'Decision',
	EXECUTION: 'Execution',
	SYSTEM: 'System'
};

export const EVENT_CATEGORY_COLORS: Record<ActivityEventCategory, string> = {
	INTENT: 'primary',
	DECISION: 'warning',
	EXECUTION: 'success',
	SYSTEM: 'surface'
};

export function getActionColor(action: ActivityActionType): string {
	const positiveActions = ['CREATE', 'APPROVE', 'COMPLETE', 'CLOSE', 'VERIFY', 'PAY'];
	const negativeActions = ['DELETE', 'DENY', 'CANCEL', 'REJECT', 'EXPIRE'];
	const warningActions = ['ESCALATE', 'PAUSE', 'ARCHIVE'];

	if (positiveActions.includes(action)) return 'success';
	if (negativeActions.includes(action)) return 'error';
	if (warningActions.includes(action)) return 'warning';
	return 'primary';
}
