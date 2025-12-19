/**
 * Work Queue API client
 * Provides typed functions for calling work queue oRPC backend endpoints
 */

import { apiCall } from './client';

// =============================================================================
// Types
// =============================================================================

export type WorkQueuePillar = 'CONCIERGE' | 'CAM' | 'CONTRACTOR' | 'ALL';
export type WorkQueueUrgency = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';
export type SLAStatus = 'ON_TRACK' | 'AT_RISK' | 'BREACHED';

export interface WorkQueueItem {
	id: string;
	pillar: string;
	itemType: string;
	itemId: string;
	itemNumber: string;
	title: string;
	currentState: string;
	timeInState: number;
	timeInStateFormatted: string;
	requiredAction: string;
	priority: string;
	urgency: WorkQueueUrgency;
	slaStatus: SLAStatus | null;
	slaDeadline: string | null;
	assignedToId: string | null;
	assignedToName: string | null;
	propertyName: string | null;
	associationName: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface WorkQueueSummary {
	total: number;
	critical: number;
	high: number;
	normal: number;
	low: number;
	unassigned: number;
}

export interface WorkQueueDashboardSummary {
	concierge: {
		total: number;
		intake: number;
		inProgress: number;
		pendingExternal: number;
		pendingOwner: number;
	};
	cam: {
		workOrders: number;
		violations: number;
		arcRequests: number;
	};
	urgency: {
		critical: number;
		high: number;
		normal: number;
	};
}

// =============================================================================
// API Functions
// =============================================================================

export const workQueueApi = {
	/**
	 * List work queue items
	 */
	list: (params?: {
		pillar?: WorkQueuePillar;
		urgency?: WorkQueueUrgency;
		assignedToMe?: boolean;
		unassignedOnly?: boolean;
		state?: string;
		limit?: number;
		cursor?: string;
	}) =>
		apiCall<{
			items: WorkQueueItem[];
			summary: WorkQueueSummary;
			pagination: {
				nextCursor: string | null;
				hasMore: boolean;
			};
		}>('workQueue/list', {
			body: params || {}
		}),

	/**
	 * Get work queue summary counts
	 */
	summary: () => apiCall<WorkQueueDashboardSummary>('workQueue/summary')
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
