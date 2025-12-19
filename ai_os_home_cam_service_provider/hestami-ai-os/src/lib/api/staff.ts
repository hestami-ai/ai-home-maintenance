/**
 * Staff Management API client
 * Provides typed functions for calling staff oRPC backend endpoints
 */

import { apiCall } from './client';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Types
// ============================================================================

export type StaffStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';

export type StaffRole =
	| 'CONCIERGE_OPERATOR'
	| 'OPERATIONS_COORDINATOR'
	| 'CAM_SPECIALIST'
	| 'VENDOR_LIAISON'
	| 'PLATFORM_ADMIN';

export type PillarAccess = 'CONCIERGE' | 'CAM' | 'CONTRACTOR' | 'VENDOR' | 'ADMIN';

export interface StaffUser {
	id: string;
	email: string;
	name: string | null;
}

export interface Staff {
	id: string;
	userId: string;
	displayName: string;
	title: string | null;
	status: StaffStatus;
	roles: StaffRole[];
	pillarAccess: PillarAccess[];
	canBeAssignedCases: boolean;
	activatedAt: string | null;
	suspendedAt: string | null;
	deactivatedAt: string | null;
	createdAt: string;
	updatedAt: string;
	user?: StaffUser;
}

export interface StaffListItem {
	id: string;
	userId: string;
	displayName: string;
	title: string | null;
	status: StaffStatus;
	roles: StaffRole[];
	pillarAccess: PillarAccess[];
	canBeAssignedCases: boolean;
	createdAt: string;
	user: {
		email: string;
		name: string | null;
	};
}

export interface StaffCaseAssignment {
	id: string;
	caseId: string;
	isPrimary: boolean;
	assignedAt: string;
	unassignedAt: string | null;
	justification: string | null;
}

// ============================================================================
// API Functions
// ============================================================================

export const staffApi = {
	/**
	 * Create a new staff member
	 */
	create: (data: {
		userId: string;
		displayName: string;
		title?: string;
		roles: StaffRole[];
		pillarAccess: PillarAccess[];
		canBeAssignedCases?: boolean;
	}) =>
		apiCall<{ staff: Staff }>('staff/create', {
			body: {
				...data,
				idempotencyKey: uuidv4()
			}
		}),

	/**
	 * Get a staff member by ID
	 */
	get: (staffId: string) =>
		apiCall<{ staff: Staff }>('staff/get', {
			body: { staffId }
		}),

	/**
	 * Get current user's staff profile
	 */
	me: () => apiCall<{ staff: Staff | null }>('staff/me'),

	/**
	 * List all staff members
	 */
	list: (params?: {
		status?: StaffStatus;
		role?: StaffRole;
		pillar?: PillarAccess;
		limit?: number;
		cursor?: string;
	}) =>
		apiCall<{
			staff: StaffListItem[];
			nextCursor: string | null;
			hasMore: boolean;
		}>('staff/list', {
			body: params || {}
		}),

	/**
	 * Update staff member details
	 */
	update: (data: {
		staffId: string;
		displayName?: string;
		title?: string | null;
		canBeAssignedCases?: boolean;
	}) =>
		apiCall<{ staff: Staff }>('staff/update', {
			body: {
				...data,
				idempotencyKey: uuidv4()
			}
		}),

	/**
	 * Activate a pending staff member
	 */
	activate: (staffId: string) =>
		apiCall<{ staff: Staff }>('staff/activate', {
			body: {
				staffId,
				idempotencyKey: uuidv4()
			}
		}),

	/**
	 * Suspend a staff member (emergency)
	 */
	suspend: (staffId: string, reason: string) =>
		apiCall<{ staff: Staff; escalatedCaseCount: number }>('staff/suspend', {
			body: {
				staffId,
				reason,
				idempotencyKey: uuidv4()
			}
		}),

	/**
	 * Deactivate a staff member (normal offboarding)
	 */
	deactivate: (staffId: string, reason: string) =>
		apiCall<{ staff: Staff; activeCaseCount: number }>('staff/deactivate', {
			body: {
				staffId,
				reason,
				idempotencyKey: uuidv4()
			}
		}),

	/**
	 * Reactivate a suspended or deactivated staff member
	 */
	reactivate: (staffId: string) =>
		apiCall<{ staff: Staff }>('staff/reactivate', {
			body: {
				staffId,
				idempotencyKey: uuidv4()
			}
		}),

	/**
	 * Update staff roles
	 */
	updateRoles: (staffId: string, roles: StaffRole[]) =>
		apiCall<{ staff: Staff }>('staff/updateRoles', {
			body: {
				staffId,
				roles,
				idempotencyKey: uuidv4()
			}
		}),

	/**
	 * Update staff pillar access
	 */
	updatePillarAccess: (staffId: string, pillarAccess: PillarAccess[]) =>
		apiCall<{ staff: Staff }>('staff/updatePillarAccess', {
			body: {
				staffId,
				pillarAccess,
				idempotencyKey: uuidv4()
			}
		}),

	/**
	 * Get case assignments for a staff member
	 */
	getAssignments: (staffId: string, includeUnassigned?: boolean) =>
		apiCall<{ assignments: StaffCaseAssignment[] }>('staff/getAssignments', {
			body: {
				staffId,
				includeUnassigned: includeUnassigned ?? false
			}
		})
};

// ============================================================================
// Helper Functions
// ============================================================================

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
	CONCIERGE_OPERATOR: 'Concierge Operator',
	OPERATIONS_COORDINATOR: 'Operations Coordinator',
	CAM_SPECIALIST: 'CAM Specialist',
	VENDOR_LIAISON: 'Vendor Liaison',
	PLATFORM_ADMIN: 'Platform Admin'
};

export const STAFF_ROLE_DESCRIPTIONS: Record<StaffRole, string> = {
	CONCIERGE_OPERATOR: 'Manages property issue resolution and vendor discovery',
	OPERATIONS_COORDINATOR: 'Oversees case queues, escalations, and SLA risks',
	CAM_SPECIALIST: 'Manages HOA governance workflows and compliance',
	VENDOR_LIAISON: 'Manages vendor entities, credentials, and performance',
	PLATFORM_ADMIN: 'System configuration, permissions, and access control'
};

export const PILLAR_ACCESS_LABELS: Record<PillarAccess, string> = {
	CONCIERGE: 'Concierge Operations',
	CAM: 'CAM / Governance',
	CONTRACTOR: 'Contractor Operations',
	VENDOR: 'Vendor Management',
	ADMIN: 'System Administration'
};

export const STAFF_STATUS_LABELS: Record<StaffStatus, string> = {
	PENDING: 'Pending Activation',
	ACTIVE: 'Active',
	SUSPENDED: 'Suspended',
	DEACTIVATED: 'Deactivated'
};

export const STAFF_STATUS_COLORS: Record<StaffStatus, string> = {
	PENDING: 'warning',
	ACTIVE: 'success',
	SUSPENDED: 'error',
	DEACTIVATED: 'surface'
};
