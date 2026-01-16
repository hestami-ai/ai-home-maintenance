/**
 * Phase 37: Organization Admin API client
 *
 * Provides type-safe access to organization admin endpoints for the Staff Portal.
 * Types will be extracted from generated OpenAPI types after type generation.
 *
 * NOTE: After running `bun run openapi:generate && bun run types:generate`,
 * update this file to extract types from types.generated.ts
 */

import { orpc } from './orpc.js';

// =============================================================================
// Type Definitions
// =============================================================================
// These types will be extracted from types.generated.ts after generation.
// For now, define them manually to enable frontend development.

export const ORGANIZATION_TYPES = [
	'COMMUNITY_ASSOCIATION',
	'MANAGEMENT_COMPANY',
	'SERVICE_PROVIDER',
	'INDIVIDUAL_PROPERTY_OWNER',
	'TRUST_OR_LLC',
	'COMMERCIAL_CLIENT',
	'EXTERNAL_SERVICE_PROVIDER',
	'PLATFORM_OPERATOR'
] as const;

export type OrganizationType = (typeof ORGANIZATION_TYPES)[number];

export const ORGANIZATION_STATUSES = ['ACTIVE', 'SUSPENDED', 'INACTIVE'] as const;
export type OrganizationStatus = (typeof ORGANIZATION_STATUSES)[number];

// Manual type definitions (to be replaced with generated types)
export interface OrganizationListItem {
	id: string;
	name: string;
	slug: string;
	type: OrganizationType;
	status: OrganizationStatus;
	externalContactName: string | null;
	externalContactEmail: string | null;
	externalContactPhone: string | null;
	memberCount: number;
	activeCaseCount: number;
	propertyCount: number;
	createdAt: string;
	updatedAt: string;
}

export interface OrganizationDetail {
	id: string;
	name: string;
	slug: string;
	type: OrganizationType;
	status: OrganizationStatus;
	settings: Record<string, unknown> | null;
	externalContactName: string | null;
	externalContactEmail: string | null;
	externalContactPhone: string | null;
	createdAt: string;
	updatedAt: string;
	memberCount: number;
	activeCaseCount: number;
	totalCaseCount: number;
	propertyCount: number;
	associationCount: number;
	workOrderCount: number;
	contractorProfile: {
		id: string;
		legalName: string | null;
		isActive: boolean;
	} | null;
}

export interface OrganizationMember {
	id: string;
	userId: string;
	userEmail: string;
	userName: string | null;
	role: string;
	isDefault: boolean;
	joinedAt: string;
}

export interface OrganizationSummary {
	total: number;
	byStatus: {
		active: number;
		suspended: number;
		inactive: number;
	};
	byType: {
		communityAssociation: number;
		managementCompany: number;
		serviceProvider: number;
		individualPropertyOwner: number;
		trustOrLlc: number;
		commercialClient: number;
		externalServiceProvider: number;
		platformOperator: number;
	};
}

// =============================================================================
// Label Mappings
// =============================================================================

export const ORGANIZATION_TYPE_LABELS: Record<OrganizationType, string> = {
	COMMUNITY_ASSOCIATION: 'Community Association',
	MANAGEMENT_COMPANY: 'Management Company',
	SERVICE_PROVIDER: 'Service Provider',
	INDIVIDUAL_PROPERTY_OWNER: 'Property Owner',
	TRUST_OR_LLC: 'Trust / LLC',
	COMMERCIAL_CLIENT: 'Commercial Client',
	EXTERNAL_SERVICE_PROVIDER: 'External Vendor',
	PLATFORM_OPERATOR: 'Platform Operator'
};

export const ORGANIZATION_TYPE_DESCRIPTIONS: Record<OrganizationType, string> = {
	COMMUNITY_ASSOCIATION: 'Self-managed HOA using the CAM pillar',
	MANAGEMENT_COMPANY: 'Property management company managing multiple associations',
	SERVICE_PROVIDER: 'Contractor organization using the Contractor pillar',
	INDIVIDUAL_PROPERTY_OWNER: 'Individual property owner using Concierge services',
	TRUST_OR_LLC: 'Trust, LLC, or other entity owning properties',
	COMMERCIAL_CLIENT: 'Commercial property client',
	EXTERNAL_SERVICE_PROVIDER: 'External vendor (not on platform)',
	PLATFORM_OPERATOR: 'Hestami staff organization'
};

export const ORGANIZATION_STATUS_LABELS: Record<OrganizationStatus, string> = {
	ACTIVE: 'Active',
	SUSPENDED: 'Suspended',
	INACTIVE: 'Inactive'
};

export const ORGANIZATION_STATUS_COLORS: Record<OrganizationStatus, string> = {
	ACTIVE: 'success',
	SUSPENDED: 'error',
	INACTIVE: 'surface'
};

// Badge class mappings for Skeleton UI
export const ORGANIZATION_STATUS_BADGE_CLASSES: Record<OrganizationStatus, string> = {
	ACTIVE: 'preset-filled-success-500',
	SUSPENDED: 'preset-filled-error-500',
	INACTIVE: 'preset-filled-surface-500'
};

export const ORGANIZATION_TYPE_BADGE_CLASSES: Record<OrganizationType, string> = {
	COMMUNITY_ASSOCIATION: 'preset-outlined-primary-500',
	MANAGEMENT_COMPANY: 'preset-outlined-secondary-500',
	SERVICE_PROVIDER: 'preset-outlined-tertiary-500',
	INDIVIDUAL_PROPERTY_OWNER: 'preset-outlined-success-500',
	TRUST_OR_LLC: 'preset-outlined-warning-500',
	COMMERCIAL_CLIENT: 'preset-outlined-error-500',
	EXTERNAL_SERVICE_PROVIDER: 'preset-outlined-surface-500',
	PLATFORM_OPERATOR: 'preset-filled-primary-500'
};

// Tab configurations per organization type
export const ORGANIZATION_TYPE_TABS: Record<OrganizationType, string[]> = {
	COMMUNITY_ASSOCIATION: ['overview', 'members', 'associations', 'activity'],
	MANAGEMENT_COMPANY: ['overview', 'members', 'managed-associations', 'activity'],
	SERVICE_PROVIDER: ['overview', 'members', 'contractor-profile', 'activity'],
	INDIVIDUAL_PROPERTY_OWNER: ['overview', 'members', 'properties', 'cases', 'activity'],
	TRUST_OR_LLC: ['overview', 'members', 'properties', 'cases', 'activity'],
	COMMERCIAL_CLIENT: ['overview', 'members', 'properties', 'activity'],
	EXTERNAL_SERVICE_PROVIDER: ['overview', 'contact', 'activity'],
	PLATFORM_OPERATOR: ['overview', 'members', 'staff', 'activity']
};

export const TAB_LABELS: Record<string, string> = {
	overview: 'Overview',
	members: 'Members',
	associations: 'Associations',
	'managed-associations': 'Managed Associations',
	'contractor-profile': 'Contractor Profile',
	properties: 'Properties',
	cases: 'Cases',
	contact: 'Contact',
	staff: 'Staff',
	activity: 'Activity'
};

// User role labels
export const USER_ROLE_LABELS: Record<string, string> = {
	OWNER: 'Owner',
	TENANT: 'Tenant',
	MANAGER: 'Manager',
	VENDOR: 'Vendor',
	BOARD_MEMBER: 'Board Member',
	ADMIN: 'Admin'
};

// =============================================================================
// API Client
// =============================================================================

export interface ListOrganizationsInput {
	type?: OrganizationType;
	status?: OrganizationStatus;
	search?: string;
	limit?: number;
	cursor?: string;
}

export interface UpdateOrganizationInput {
	organizationId: string;
	name?: string;
	externalContactName?: string | null;
	externalContactEmail?: string | null;
	externalContactPhone?: string | null;
}

export interface UpdateStatusInput {
	organizationId: string;
	status: OrganizationStatus;
	reason: string;
}

export const organizationAdminApi = {
	/**
	 * List all organizations with optional filtering
	 */
	list: (params?: ListOrganizationsInput) => orpc.organizationAdmin.list(params ?? {}),

	/**
	 * Get organization details by ID
	 */
	get: (organizationId: string) => orpc.organizationAdmin.get({ organizationId }),

	/**
	 * Get organization members
	 */
	getMembers: (organizationId: string, params?: { limit?: number; cursor?: string }) =>
		orpc.organizationAdmin.getMembers({
			organizationId,
			limit: params?.limit ?? 50,
			cursor: params?.cursor
		}),

	/**
	 * Update organization info (Platform Admin only)
	 */
	update: (input: UpdateOrganizationInput) =>
		orpc.organizationAdmin.update({
			...input,
			idempotencyKey: crypto.randomUUID()
		}),

	/**
	 * Update organization status (Platform Admin only)
	 */
	updateStatus: (input: UpdateStatusInput) =>
		orpc.organizationAdmin.updateStatus({
			...input,
			idempotencyKey: crypto.randomUUID()
		}),

	/**
	 * Suspend an organization (convenience wrapper)
	 */
	suspend: (organizationId: string, reason: string) =>
		organizationAdminApi.updateStatus({
			organizationId,
			status: 'SUSPENDED',
			reason
		}),

	/**
	 * Activate an organization (convenience wrapper)
	 */
	activate: (organizationId: string, reason: string) =>
		organizationAdminApi.updateStatus({
			organizationId,
			status: 'ACTIVE',
			reason
		})
};
