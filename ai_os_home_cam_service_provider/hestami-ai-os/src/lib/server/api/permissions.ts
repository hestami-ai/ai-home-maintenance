import type { UserRole } from '../../../../generated/prisma/client.js';
import { ApiException } from './errors.js';

/**
 * @deprecated This static permission system is deprecated.
 * Use Cerbos authorization via `context.cerbos.authorize()` or `context.cerbos.queryFilter()` instead.
 *
 * Migration guide:
 * - Replace `requirePermission(context.role, Permission.X)` with `await context.cerbos.authorize(action, resource, id)`
 * - For list operations, use `context.cerbos.queryFilter(action, resource)` to get Prisma-compatible filters
 *
 * @see src/lib/server/cerbos/index.ts for Cerbos integration
 * @see src/lib/server/api/router.ts for OrgContext with cerbos helpers
 */

/**
 * @deprecated Use Cerbos policies instead
 * Permission definitions by domain
 */
export const Permission = {
	// Organization management
	ORG_VIEW: 'org:view',
	ORG_EDIT: 'org:edit',
	ORG_DELETE: 'org:delete',
	ORG_MANAGE_MEMBERS: 'org:manage_members',

	// Association management
	ASSOCIATION_VIEW: 'association:view',
	ASSOCIATION_EDIT: 'association:edit',
	ASSOCIATION_CREATE: 'association:create',
	ASSOCIATION_DELETE: 'association:delete',

	// Property management
	PROPERTY_VIEW: 'property:view',
	PROPERTY_EDIT: 'property:edit',
	PROPERTY_CREATE: 'property:create',
	PROPERTY_DELETE: 'property:delete',

	// Party management
	PARTY_VIEW: 'party:view',
	PARTY_EDIT: 'party:edit',
	PARTY_CREATE: 'party:create',
	PARTY_DELETE: 'party:delete',

	// Ownership management
	OWNERSHIP_VIEW: 'ownership:view',
	OWNERSHIP_EDIT: 'ownership:edit',
	OWNERSHIP_CREATE: 'ownership:create',
	OWNERSHIP_DELETE: 'ownership:delete',

	// Work orders
	WORK_ORDER_VIEW: 'work_order:view',
	WORK_ORDER_CREATE: 'work_order:create',
	WORK_ORDER_EDIT: 'work_order:edit',
	WORK_ORDER_ASSIGN: 'work_order:assign',
	WORK_ORDER_CLOSE: 'work_order:close',

	// Violations
	VIOLATION_VIEW: 'violation:view',
	VIOLATION_CREATE: 'violation:create',
	VIOLATION_EDIT: 'violation:edit',
	VIOLATION_CLOSE: 'violation:close',

	// ARC
	ARC_VIEW: 'arc:view',
	ARC_CREATE: 'arc:create',
	ARC_REVIEW: 'arc:review',

	// Accounting
	ACCOUNTING_VIEW: 'accounting:view',
	ACCOUNTING_EDIT: 'accounting:edit',
	ACCOUNTING_APPROVE: 'accounting:approve',

	// Governance
	GOVERNANCE_VIEW: 'governance:view',
	GOVERNANCE_EDIT: 'governance:edit',
	GOVERNANCE_VOTE: 'governance:vote',

	// Documents
	DOCUMENT_VIEW: 'document:view',
	DOCUMENT_UPLOAD: 'document:upload',
	DOCUMENT_DELETE: 'document:delete',

	// Communications
	COMMUNICATION_VIEW: 'communication:view',
	COMMUNICATION_SEND: 'communication:send',

	// Reports
	REPORT_VIEW: 'report:view',
	REPORT_GENERATE: 'report:generate'
} as const;

export type PermissionType = (typeof Permission)[keyof typeof Permission];

/**
 * Role-to-permission mapping
 */
const rolePermissions: Record<UserRole, PermissionType[]> = {
	ADMIN: Object.values(Permission), // Admin has all permissions

	MANAGER: [
		Permission.ORG_VIEW,
		Permission.ORG_EDIT,
		Permission.ORG_MANAGE_MEMBERS,
		Permission.ASSOCIATION_VIEW,
		Permission.ASSOCIATION_EDIT,
		Permission.PROPERTY_VIEW,
		Permission.PROPERTY_EDIT,
		Permission.PROPERTY_CREATE,
		Permission.WORK_ORDER_VIEW,
		Permission.WORK_ORDER_CREATE,
		Permission.WORK_ORDER_EDIT,
		Permission.WORK_ORDER_ASSIGN,
		Permission.WORK_ORDER_CLOSE,
		Permission.VIOLATION_VIEW,
		Permission.VIOLATION_CREATE,
		Permission.VIOLATION_EDIT,
		Permission.VIOLATION_CLOSE,
		Permission.ARC_VIEW,
		Permission.ARC_REVIEW,
		Permission.ACCOUNTING_VIEW,
		Permission.ACCOUNTING_EDIT,
		Permission.ACCOUNTING_APPROVE,
		Permission.GOVERNANCE_VIEW,
		Permission.GOVERNANCE_EDIT,
		Permission.DOCUMENT_VIEW,
		Permission.DOCUMENT_UPLOAD,
		Permission.DOCUMENT_DELETE,
		Permission.COMMUNICATION_VIEW,
		Permission.COMMUNICATION_SEND,
		Permission.REPORT_VIEW,
		Permission.REPORT_GENERATE
	],

	BOARD_MEMBER: [
		Permission.ORG_VIEW,
		Permission.ASSOCIATION_VIEW,
		Permission.PROPERTY_VIEW,
		Permission.WORK_ORDER_VIEW,
		Permission.VIOLATION_VIEW,
		Permission.ARC_VIEW,
		Permission.ARC_REVIEW,
		Permission.ACCOUNTING_VIEW,
		Permission.ACCOUNTING_APPROVE,
		Permission.GOVERNANCE_VIEW,
		Permission.GOVERNANCE_EDIT,
		Permission.GOVERNANCE_VOTE,
		Permission.DOCUMENT_VIEW,
		Permission.COMMUNICATION_VIEW,
		Permission.REPORT_VIEW
	],

	OWNER: [
		Permission.ORG_VIEW,
		Permission.PROPERTY_VIEW,
		Permission.WORK_ORDER_VIEW,
		Permission.WORK_ORDER_CREATE,
		Permission.VIOLATION_VIEW,
		Permission.ARC_VIEW,
		Permission.ARC_CREATE,
		Permission.ACCOUNTING_VIEW,
		Permission.GOVERNANCE_VIEW,
		Permission.GOVERNANCE_VOTE,
		Permission.DOCUMENT_VIEW,
		Permission.COMMUNICATION_VIEW
	],

	TENANT: [
		Permission.ORG_VIEW,
		Permission.PROPERTY_VIEW,
		Permission.WORK_ORDER_VIEW,
		Permission.WORK_ORDER_CREATE,
		Permission.DOCUMENT_VIEW,
		Permission.COMMUNICATION_VIEW
	],

	VENDOR: [
		Permission.ORG_VIEW,
		Permission.WORK_ORDER_VIEW,
		Permission.WORK_ORDER_EDIT,
		Permission.DOCUMENT_VIEW,
		Permission.DOCUMENT_UPLOAD
	]
};

/**
 * @deprecated Use Cerbos authorization instead
 * Check if a role has a specific permission
 */
export function hasPermission(role: UserRole, permission: PermissionType): boolean {
	return rolePermissions[role]?.includes(permission) ?? false;
}

/**
 * Check if a role has all specified permissions
 */
export function hasAllPermissions(role: UserRole, permissions: PermissionType[]): boolean {
	return permissions.every((p) => hasPermission(role, p));
}

/**
 * Check if a role has any of the specified permissions
 */
export function hasAnyPermission(role: UserRole, permissions: PermissionType[]): boolean {
	return permissions.some((p) => hasPermission(role, p));
}

/**
 * Get all permissions for a role
 */
export function getPermissionsForRole(role: UserRole): PermissionType[] {
	return rolePermissions[role] ?? [];
}

/**
 * @deprecated Use `context.cerbos.authorize()` instead
 * Throws ApiException if role doesn't have required permission
 */
export function requirePermission(role: UserRole | null, permission: PermissionType): void {
	if (!role || !hasPermission(role, permission)) {
		throw ApiException.forbidden(`Permission denied: ${permission}`);
	}
}

/**
 * Throws ApiException if role doesn't have all required permissions
 */
export function requireAllPermissions(role: UserRole | null, permissions: PermissionType[]): void {
	if (!role || !hasAllPermissions(role, permissions)) {
		throw ApiException.forbidden(`Permission denied: requires ${permissions.join(', ')}`);
	}
}
