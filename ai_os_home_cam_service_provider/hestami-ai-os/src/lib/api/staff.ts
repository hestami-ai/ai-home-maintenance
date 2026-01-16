/**
 * Staff API client wrapper
 * 
 * Provides a convenient wrapper around the oRPC staff endpoints
 * with type exports and label mappings for UI usage.
 * 
 * Types are extracted from the generated OpenAPI types to follow
 * the type generation pipeline: Prisma → Zod → oRPC → OpenAPI → types.generated.ts
 */

import { orpc } from './orpc.ts';
import { v4 as uuidv4 } from 'uuid';
import type { operations } from './types.generated.js';

// =============================================================================
// Type Definitions (extracted from generated types)
// =============================================================================

// Extract Staff type from staff.get response
export type Staff = operations['staff.get']['responses']['200']['content']['application/json']['data']['staff'];

// Extract StaffListItem type from staff.list response (array element)
export type StaffListItem = operations['staff.list']['responses']['200']['content']['application/json']['data']['staff'][number];

// Extract enum types from staff.create request body
type StaffCreateInput = operations['staff.create']['requestBody']['content']['application/json'];
export type StaffRole = StaffCreateInput['roles'][number];
export type PillarAccess = StaffCreateInput['pillarAccess'][number];

// Extract status from Staff type
export type StaffStatus = Staff['status'];

// =============================================================================
// Label Mappings for UI
// =============================================================================

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
	CONCIERGE: 'Concierge',
	CAM: 'CAM',
	CONTRACTOR: 'Contractor',
	VENDOR: 'Vendor',
	ADMIN: 'Admin'
};

export const STAFF_STATUS_LABELS: Record<StaffStatus, string> = {
	PENDING: 'Pending',
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

// =============================================================================
// API Client Wrapper
// =============================================================================

export interface CreateStaffInput {
	email: string;
	displayName: string;
	title?: string;
	roles: StaffRole[];
	pillarAccess: PillarAccess[];
	canBeAssignedCases?: boolean;
}

export interface UpdateStaffInput {
	staffId: string;
	displayName?: string;
	title?: string | null;
	canBeAssignedCases?: boolean;
}

export const staffApi = {
	/**
	 * Create a new staff member
	 */
	async create(input: CreateStaffInput) {
		return orpc.staff.create({
			email: input.email,
			displayName: input.displayName,
			title: input.title,
			roles: input.roles,
			pillarAccess: input.pillarAccess,
			canBeAssignedCases: input.canBeAssignedCases ?? true,
			idempotencyKey: uuidv4()
		});
	},

	/**
	 * Get a staff member by ID
	 */
	async get(staffId: string) {
		return orpc.staff.get({ staffId });
	},

	/**
	 * List all staff members with optional filters
	 */
	async list(params?: { status?: StaffStatus; role?: StaffRole; pillar?: PillarAccess; limit?: number; cursor?: string }) {
		return orpc.staff.list(params ?? {});
	},

	/**
	 * Update a staff member
	 */
	async update(input: UpdateStaffInput) {
		return orpc.staff.update({
			staffId: input.staffId,
			displayName: input.displayName,
			title: input.title,
			canBeAssignedCases: input.canBeAssignedCases,
			idempotencyKey: uuidv4()
		});
	},

	/**
	 * Regenerate activation code (Admin only)
	 */
	async regenerateActivationCode(staffId: string) {
		return orpc.staff.regenerateActivationCode({
			staffId,
			idempotencyKey: uuidv4()
		});
	},

	/**
	 * Activate account with code (Self-service)
	 */
	async activateWithCode(input: { code: string }) {
		return orpc.staff.activateWithCode({
			code: input.code,
			idempotencyKey: uuidv4()
		});
	},

	/**
	 * Activate a staff member (Admin override - mostly for legacy or manual fix)
	 */
	async activate(staffId: string) {
		return orpc.staff.activate({ staffId, idempotencyKey: uuidv4() });
	},

	/**
	 * Suspend a staff member
	 */
	async suspend(staffId: string, reason: string) {
		return orpc.staff.suspend({ staffId, reason, idempotencyKey: uuidv4() });
	},

	/**
	 * Deactivate a staff member
	 */
	async deactivate(staffId: string, reason: string) {
		return orpc.staff.deactivate({ staffId, reason, idempotencyKey: uuidv4() });
	},

	/**
	 * Reactivate a deactivated staff member (alias for activate)
	 */
	async reactivate(staffId: string) {
		return orpc.staff.activate({ staffId, idempotencyKey: uuidv4() });
	}
};
