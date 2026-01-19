/**
 * Service Provider Team API client wrapper
 *
 * Provides a convenient wrapper around the oRPC serviceProviderTeam endpoints
 * with type exports and label mappings for UI usage.
 */

import { orpc } from './orpc.ts';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// Type Definitions
// =============================================================================

export type ServiceProviderRole =
	| 'OWNER'
	| 'ADMIN'
	| 'OFFICE_MANAGER'
	| 'DISPATCHER'
	| 'ESTIMATOR'
	| 'BOOKKEEPER'
	| 'TECHNICIAN';

export type ServiceProviderTeamMemberStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';

export interface ServiceProviderTeamMember {
	id: string;
	organizationId: string;
	userId: string;
	displayName: string;
	title: string | null;
	status: ServiceProviderTeamMemberStatus;
	roles: ServiceProviderRole[];
	technicianId: string | null;
	activatedAt: string | null;
	suspendedAt: string | null;
	deactivatedAt: string | null;
	createdAt: string;
	updatedAt: string;
	user?: {
		id: string;
		email: string;
		name: string | null;
	};
	technician?: {
		id: string;
		firstName: string;
		lastName: string;
	} | null;
}

export interface ServiceProviderTeamMemberListItem {
	id: string;
	userId: string;
	displayName: string;
	title: string | null;
	status: ServiceProviderTeamMemberStatus;
	roles: ServiceProviderRole[];
	technicianId: string | null;
	createdAt: string;
	user: {
		email: string;
		name: string | null;
	};
}

// =============================================================================
// Label Mappings for UI
// =============================================================================

export const SERVICE_PROVIDER_ROLE_LABELS: Record<ServiceProviderRole, string> = {
	OWNER: 'Owner',
	ADMIN: 'Administrator',
	OFFICE_MANAGER: 'Office Manager',
	DISPATCHER: 'Dispatcher',
	ESTIMATOR: 'Estimator',
	BOOKKEEPER: 'Bookkeeper',
	TECHNICIAN: 'Technician'
};

export const SERVICE_PROVIDER_ROLE_DESCRIPTIONS: Record<ServiceProviderRole, string> = {
	OWNER: 'Full access to all contractor features, can manage team and billing',
	ADMIN: 'Administrative access, can manage most features except billing settings',
	OFFICE_MANAGER: 'Scheduling, invoicing, customer communication',
	DISPATCHER: 'Job assignment, technician scheduling',
	ESTIMATOR: 'Create and send estimates',
	BOOKKEEPER: 'Invoicing, payments, financial reports',
	TECHNICIAN: 'Field work execution (links to Technician entity)'
};

export const SERVICE_PROVIDER_STATUS_LABELS: Record<ServiceProviderTeamMemberStatus, string> = {
	PENDING: 'Pending',
	ACTIVE: 'Active',
	SUSPENDED: 'Suspended',
	DEACTIVATED: 'Deactivated'
};

export const SERVICE_PROVIDER_STATUS_COLORS: Record<ServiceProviderTeamMemberStatus, string> = {
	PENDING: 'warning',
	ACTIVE: 'success',
	SUSPENDED: 'error',
	DEACTIVATED: 'surface'
};

// =============================================================================
// API Client Wrapper
// =============================================================================

export interface CreateTeamMemberInput {
	email: string;
	displayName: string;
	title?: string;
	roles: ServiceProviderRole[];
	technicianId?: string;
}

export interface UpdateTeamMemberInput {
	teamMemberId: string;
	displayName?: string;
	title?: string | null;
}

export interface UpdateRolesInput {
	teamMemberId: string;
	roles: ServiceProviderRole[];
}

export interface ListTeamMembersInput {
	status?: ServiceProviderTeamMemberStatus;
	role?: ServiceProviderRole;
	search?: string;
	cursor?: string;
	limit?: number;
}

export const serviceProviderTeamApi = {
	/**
	 * Create a new team member (invite)
	 */
	async create(input: CreateTeamMemberInput) {
		return orpc.serviceProviderTeam.create({
			email: input.email,
			displayName: input.displayName,
			title: input.title,
			roles: input.roles,
			technicianId: input.technicianId,
			idempotencyKey: uuidv4()
		});
	},

	/**
	 * Get a team member by ID
	 */
	async get(teamMemberId: string) {
		return orpc.serviceProviderTeam.get({ teamMemberId });
	},

	/**
	 * List all team members with optional filters
	 */
	async list(input: ListTeamMembersInput = {}) {
		return orpc.serviceProviderTeam.list({
			status: input.status,
			role: input.role,
			search: input.search,
			cursor: input.cursor,
			limit: input.limit
		});
	},

	/**
	 * Update a team member's basic info
	 */
	async update(input: UpdateTeamMemberInput) {
		return orpc.serviceProviderTeam.update({
			teamMemberId: input.teamMemberId,
			displayName: input.displayName,
			title: input.title,
			idempotencyKey: uuidv4()
		});
	},

	/**
	 * Update a team member's roles
	 */
	async updateRoles(input: UpdateRolesInput) {
		return orpc.serviceProviderTeam.updateRoles({
			teamMemberId: input.teamMemberId,
			roles: input.roles,
			idempotencyKey: uuidv4()
		});
	},

	/**
	 * Regenerate activation code for a pending team member
	 */
	async regenerateActivationCode(teamMemberId: string) {
		return orpc.serviceProviderTeam.regenerateActivationCode({
			teamMemberId,
			idempotencyKey: uuidv4()
		});
	},

	/**
	 * Activate account with code (self-service)
	 */
	async activateWithCode(code: string) {
		return orpc.serviceProviderTeam.activateWithCode({
			code,
			idempotencyKey: uuidv4()
		});
	},

	/**
	 * Activate a team member (admin override)
	 */
	async activate(teamMemberId: string) {
		return orpc.serviceProviderTeam.activate({
			teamMemberId,
			idempotencyKey: uuidv4()
		});
	},

	/**
	 * Suspend a team member
	 */
	async suspend(teamMemberId: string, reason: string) {
		return orpc.serviceProviderTeam.suspend({
			teamMemberId,
			reason,
			idempotencyKey: uuidv4()
		});
	},

	/**
	 * Deactivate a team member
	 */
	async deactivate(teamMemberId: string, reason: string) {
		return orpc.serviceProviderTeam.deactivate({
			teamMemberId,
			reason,
			idempotencyKey: uuidv4()
		});
	},

	/**
	 * Reactivate a suspended or deactivated team member
	 */
	async reactivate(teamMemberId: string) {
		return orpc.serviceProviderTeam.reactivate({
			teamMemberId,
			idempotencyKey: uuidv4()
		});
	},

	/**
	 * Link a team member to a technician
	 */
	async linkTechnician(teamMemberId: string, technicianId: string) {
		return orpc.serviceProviderTeam.linkTechnician({
			teamMemberId,
			technicianId,
			idempotencyKey: uuidv4()
		});
	},

	/**
	 * Unlink a team member from a technician
	 */
	async unlinkTechnician(teamMemberId: string) {
		return orpc.serviceProviderTeam.unlinkTechnician({
			teamMemberId,
			idempotencyKey: uuidv4()
		});
	}
};
