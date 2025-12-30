/**
 * Permissions Admin API Client
 * 
 * Staff-only endpoints for cross-org permission visibility and audit.
 * 
 * Types are extracted from the generated OpenAPI types to follow
 * the type generation pipeline: Prisma → Zod → oRPC → OpenAPI → types.generated.ts
 */

import { orpc } from './orpc.js';
import type { operations } from './types.generated.js';

// =============================================================================
// Type Definitions (extracted from generated types)
// =============================================================================

// Extract PermissionStats from getStats response
export type PermissionStats = operations['permissionsAdmin.getStats']['responses']['200']['content']['application/json']['data'];

// Extract OrganizationListItem from listOrganizations response
export type OrganizationListItem = operations['permissionsAdmin.listOrganizations']['responses']['200']['content']['application/json']['data']['organizations'][number];

// Extract OrganizationDetail from getOrganization response
export type OrganizationDetail = operations['permissionsAdmin.getOrganization']['responses']['200']['content']['application/json']['data'];

// Extract OrganizationMember from getOrganization response
export type OrganizationMember = operations['permissionsAdmin.getOrganization']['responses']['200']['content']['application/json']['data']['members'][number];

// Extract AuditLogEvent from getAuditLog response
export type AuditLogEvent = operations['permissionsAdmin.getAuditLog']['responses']['200']['content']['application/json']['data']['events'][number];

// Extract RecentChange from getRecentChanges response
export type RecentChange = operations['permissionsAdmin.getRecentChanges']['responses']['200']['content']['application/json']['data']['changes'][number];

// Extract enum types from listOrganizations input
type ListOrganizationsInput = operations['permissionsAdmin.listOrganizations']['requestBody']['content']['application/json'];
export type OrganizationType = NonNullable<ListOrganizationsInput['type']>;
export type OrganizationStatus = NonNullable<ListOrganizationsInput['status']>;

/**
 * Permissions Admin API
 */
export const permissionsAdminApi = {
	/**
	 * Get permission statistics for dashboard
	 */
	getStats: () => orpc.permissionsAdmin.getStats({}),

	/**
	 * List all organizations with member counts
	 */
	listOrganizations: (params?: {
		type?: OrganizationType;
		status?: OrganizationStatus;
		search?: string;
		limit?: number;
		cursor?: string;
	}) => orpc.permissionsAdmin.listOrganizations(params ?? {}),

	/**
	 * Get organization detail with member roles
	 */
	getOrganization: (organizationId: string) =>
		orpc.permissionsAdmin.getOrganization({ organizationId }),

	/**
	 * Get permission audit log
	 */
	getAuditLog: (params?: {
		organizationId?: string;
		actorId?: string;
		targetUserId?: string;
		startDate?: string;
		endDate?: string;
		limit?: number;
		cursor?: string;
	}) => orpc.permissionsAdmin.getAuditLog(params ?? {}),

	/**
	 * Get recent permission changes for dashboard
	 */
	getRecentChanges: (limit?: number) =>
		orpc.permissionsAdmin.getRecentChanges(limit ? { limit } : undefined)
};

// Helper labels
export const ORGANIZATION_TYPE_LABELS: Record<string, string> = {
	INDIVIDUAL_PROPERTY_OWNER: 'Individual Property Owner',
	TRUST_OR_LLC: 'Trust or LLC',
	COMMUNITY_ASSOCIATION: 'Community Association',
	MANAGEMENT_COMPANY: 'Management Company',
	SERVICE_PROVIDER: 'Service Provider',
	COMMERCIAL_CLIENT: 'Commercial Client'
};

export const ORGANIZATION_STATUS_LABELS: Record<string, string> = {
	ACTIVE: 'Active',
	SUSPENDED: 'Suspended',
	INACTIVE: 'Inactive'
};

export const USER_ROLE_LABELS: Record<string, string> = {
	ADMIN: 'Administrator',
	MANAGER: 'Manager',
	BOARD_MEMBER: 'Board Member',
	OWNER: 'Owner',
	TENANT: 'Tenant',
	VENDOR: 'Vendor',
	MEMBER: 'Member',
	AUDITOR: 'Auditor'
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
	CREATE: 'Created',
	UPDATE: 'Updated',
	DELETE: 'Deleted',
	ROLE_CHANGE: 'Role Changed',
	ASSIGN: 'Assigned',
	UNASSIGN: 'Unassigned'
};
