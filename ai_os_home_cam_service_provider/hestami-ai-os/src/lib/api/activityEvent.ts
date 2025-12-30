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
	search: (params?: SearchInput) => orpc.activityEvent.search(params ?? {}),

	// =========================================================================
	// STAFF CROSS-ORG ENDPOINTS
	// =========================================================================

	/**
	 * Get all activity events across all organizations (staff only)
	 */
	staffList: (params?: {
		entityType?: ActivityEntityType;
		action?: ActivityActionType;
		eventCategory?: ActivityEventCategory;
		performedByType?: ActivityActorType;
		organizationId?: string;
		startDate?: string;
		endDate?: string;
		limit?: number;
		cursor?: string;
	}) => orpc.activityEvent.staffList(params ?? {}),

	/**
	 * Get activity events for a specific entity (staff cross-org access)
	 */
	staffGetByEntity: (params: {
		entityType: ActivityEntityType;
		entityId: string;
		limit?: number;
		cursor?: string;
	}) => orpc.activityEvent.staffGetByEntity(params)
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
	PURCHASE_ORDER: 'Purchase Order',
	CONCIERGE_CASE: 'Concierge Case',
	OWNER_INTENT: 'Owner Intent',
	INDIVIDUAL_PROPERTY: 'Property',
	PROPERTY_DOCUMENT: 'Property Document',
	MATERIAL_DECISION: 'Material Decision',
	EXTERNAL_HOA: 'External HOA',
	EXTERNAL_VENDOR: 'External Vendor',
	CONCIERGE_ACTION: 'Concierge Action',
	MEETING: 'Meeting',
	MOTION: 'Motion',
	VOTE: 'Vote',
	RESOLUTION: 'Resolution',
	USER: 'User',
	USER_ROLE: 'User Role',
	ORGANIZATION: 'Organization',
	DOCUMENT: 'Document',
	STAFF: 'Staff',
	STAFF_ASSIGNMENT: 'Staff Assignment',
	VENDOR_CANDIDATE: 'Vendor Candidate',
	VENDOR_BID: 'Vendor Bid',
	OTHER: 'Other'
};

export const ACTION_TYPE_LABELS: Record<ActivityActionType, string> = {
	CREATE: 'Created',
	UPDATE: 'Updated',
	DELETE: 'Deleted',
	STATUS_CHANGE: 'Status Changed',
	APPROVE: 'Approved',
	DENY: 'Denied',
	ASSIGN: 'Assigned',
	UNASSIGN: 'Unassigned',
	SUBMIT: 'Submitted',
	CANCEL: 'Cancelled',
	COMPLETE: 'Completed',
	SCHEDULE: 'Scheduled',
	DISPATCH: 'Dispatched',
	CLOSE: 'Closed',
	REOPEN: 'Reopened',
	ESCALATE: 'Escalated',
	ROLE_CHANGE: 'Role Changed',
	LOGIN: 'Logged In',
	LOGOUT: 'Logged Out',
	WORKFLOW_INITIATED: 'Workflow Started',
	WORKFLOW_COMPLETED: 'Workflow Completed',
	WORKFLOW_FAILED: 'Workflow Failed',
	CUSTOM: 'Custom Action',
	CLASSIFY: 'Classified',
	VERSION: 'Versioned',
	SUPERSEDE: 'Superseded',
	REFERENCED: 'Referenced',
	START_SESSION: 'Session Started',
	ADJOURN: 'Adjourned',
	APPROVE_MINUTES: 'Minutes Approved',
	ARCHIVE: 'Archived',
	PROPOSE: 'Proposed',
	SECOND: 'Seconded',
	OPEN_VOTING: 'Voting Opened',
	CLOSE_VOTING: 'Voting Closed',
	TABLE: 'Tabled',
	WITHDRAW: 'Withdrawn',
	CAST_BALLOT: 'Vote Cast',
	ADOPT: 'Adopted',
	REQUEST_INFO: 'Info Requested',
	RESPOND: 'Responded',
	LINK: 'Linked'
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
