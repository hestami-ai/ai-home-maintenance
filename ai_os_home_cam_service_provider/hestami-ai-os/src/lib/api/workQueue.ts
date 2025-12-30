/**
 * Work Queue API client
 * Provides typed functions for calling work queue oRPC backend endpoints
 * 
 * Types are extracted from the generated OpenAPI types to follow
 * the type generation pipeline: Prisma → Zod → oRPC → OpenAPI → types.generated.ts
 */

import { orpc } from './orpc.js';
import type { operations } from './types.generated.js';

// =============================================================================
// Type Definitions (extracted from generated types)
// =============================================================================

// Extract WorkQueueItem from list response
export type WorkQueueItem = operations['workQueue.list']['responses']['200']['content']['application/json']['data']['items'][number];

// Extract WorkQueueSummary from list response
export type WorkQueueSummary = operations['workQueue.list']['responses']['200']['content']['application/json']['data']['summary'];

// Extract WorkQueueDashboardSummary from summary response
export type WorkQueueDashboardSummary = operations['workQueue.summary']['responses']['200']['content']['application/json']['data'];

// Extract enum types from list request body
type ListInput = NonNullable<operations['workQueue.list']['requestBody']>['content']['application/json'];
export type WorkQueuePillar = NonNullable<ListInput['pillar']>;
export type WorkQueueUrgency = NonNullable<ListInput['urgency']>;

// Extract SLAStatus from WorkQueueItem
export type SLAStatus = NonNullable<WorkQueueItem['slaStatus']>;

// =============================================================================
// API Functions
// =============================================================================

export const workQueueApi = {
	/**
	 * List work queue items
	 */
	list: (params?: ListInput) => orpc.workQueue.list(params ?? {}),

	/**
	 * Get work queue summary counts
	 */
	summary: () => orpc.workQueue.summary({}),

	/**
	 * Get the organization ID for a work item
	 * Used by staff to get org context before calling org-scoped APIs
	 */
	getItemOrg: (params: { itemType: 'CONCIERGE_CASE' | 'WORK_ORDER' | 'VIOLATION' | 'ARC_REQUEST'; itemId: string }) =>
		orpc.workQueue.getItemOrg(params)
};

// =============================================================================
// Helper Functions
// =============================================================================

export const PILLAR_LABELS: Record<WorkQueuePillar, string> = {
	ALL: 'All Pillars',
	CONCIERGE: 'Concierge',
	CAM: 'CAM / Governance',
	CONTRACTOR: 'Contractor'
};

export const URGENCY_LABELS: Record<WorkQueueUrgency, string> = {
	CRITICAL: 'Critical',
	HIGH: 'High',
	NORMAL: 'Normal',
	LOW: 'Low'
};

export const URGENCY_COLORS: Record<WorkQueueUrgency, string> = {
	CRITICAL: 'error',
	HIGH: 'warning',
	NORMAL: 'primary',
	LOW: 'surface'
};

export const ITEM_TYPE_LABELS: Record<string, string> = {
	CONCIERGE_CASE: 'Case',
	WORK_ORDER: 'Work Order',
	VIOLATION: 'Violation',
	ARC_REQUEST: 'ARC Request'
};

export const ITEM_TYPE_ROUTES: Record<string, string> = {
	CONCIERGE_CASE: '/app/admin/cases',
	WORK_ORDER: '/app/cam/work-orders',
	VIOLATION: '/app/cam/violations',
	ARC_REQUEST: '/app/cam/arc'
};

export function getItemRoute(itemType: string, itemId: string): string {
	const baseRoute = ITEM_TYPE_ROUTES[itemType] || '/app';
	return `${baseRoute}/${itemId}`;
}
