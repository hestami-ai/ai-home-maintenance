/**
 * Cerbos Authorization Service
 *
 * Provides integration with Cerbos PDP for fine-grained authorization.
 * Supports both single-resource checks (isAllowed) and collection filtering (planResources).
 */

import { GRPC } from '@cerbos/grpc';
import type { Value } from '@cerbos/core';
import type { User, UserRole } from '../../../../generated/prisma/client.js';
import { createModuleLogger } from '../logger.js';

const log = createModuleLogger('Cerbos');
import { recordSpanError } from '../api/middleware/tracing.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Principal (user) attributes for Cerbos authorization
 */
export interface CerbosPrincipal {
	id: string;
	roles: string[];
	attr: {
		/** Map of organizationId -> UserRole */
		orgRoles: Record<string, UserRole>;
		/** Vendor ID if user is a vendor */
		vendorId?: string;
		/** Staff roles for Hestami platform staff (e.g., PLATFORM_ADMIN, CONCIERGE_OPERATOR) */
		staffRoles?: string[];
		/** Pillar access for Hestami platform staff (e.g., CONCIERGE, CAM, ADMIN) */
		pillarAccess?: string[];
	};
	/** Scope for tenant-specific policies (organization slug) */
	scope?: string;
}

/**
 * Resource attributes for Cerbos authorization
 */
/**
 * Resource attributes for Cerbos - all values must be Cerbos-compatible
 */
export interface CerbosResourceAttr {
	organizationId: string;
	/** User IDs who own this resource */
	ownerIds?: string[];
	/** User IDs who are members of this resource */
	memberIds?: string[];
	/** User IDs who are tenants of this unit */
	tenantIds?: string[];
	/** User IDs who own the unit (for work orders) */
	unitOwnerIds?: string[];
	/** User IDs who are tenants of the unit (for work orders) */
	unitTenantIds?: string[];
	/** Vendor ID assigned to this resource */
	assignedVendorId?: string;
	/** User ID who created this resource */
	createdByUserId?: string;
	/** User ID linked to this party */
	userId?: string;
	/** User ID linked to the party (for ownership records) */
	partyUserId?: string;
}

export interface CerbosResource {
	kind: string;
	id: string;
	attr: CerbosResourceAttr;
	/** Scope for tenant-specific policies (organization slug) */
	scope?: string;
}

/**
 * Query plan filter result from Cerbos
 */
export type QueryPlanResult =
	| { kind: 'always_allowed' }
	| { kind: 'always_denied' }
	| { kind: 'conditional'; filter: PrismaWhereFilter };

/**
 * Prisma-compatible where filter
 */
export type PrismaWhereFilter = Record<string, unknown>;

// ============================================================================
// Client Singleton
// ============================================================================

let cerbosClient: GRPC | null = null;

/**
 * Get or create the Cerbos gRPC client singleton
 */
export function getCerbos(): GRPC {
	if (!cerbosClient) {
		const host = process.env.CERBOS_HOST || 'localhost:3593';
		cerbosClient = new GRPC(host, { tls: false });
	}
	return cerbosClient;
}

/**
 * Close the Cerbos client connection (for graceful shutdown)
 */
export async function closeCerbos(): Promise<void> {
	if (cerbosClient) {
		// GRPC client doesn't have explicit close, but we can null it
		cerbosClient = null;
	}
}

// ============================================================================
// Principal Builder
// ============================================================================

/**
 * Build a Cerbos principal from user context
 *
 * @param user - The authenticated user
 * @param orgRoles - Map of organizationId -> UserRole for all user's memberships
 * @param currentOrgSlug - Current organization slug for scoped policies
 * @param vendorId - Optional vendor ID if user is a vendor
 * @param currentOrgId - Current organization ID
 * @param staffRoles - Staff roles for Hestami platform staff (e.g., PLATFORM_ADMIN)
 * @param pillarAccess - Pillar access for Hestami platform staff (e.g., CONCIERGE, ADMIN)
 */
export function buildPrincipal(
	user: User,
	orgRoles: Record<string, UserRole>,
	currentOrgSlug?: string,
	vendorId?: string,
	currentOrgId?: string,
	staffRoles?: string[],
	pillarAccess?: string[]
): CerbosPrincipal {
	// Build roles array - always include 'user', plus org-specific role if in org context
	const roles: string[] = ['user'];

	// Add the current organization's role if we have org context
	if (currentOrgId && orgRoles[currentOrgId]) {
		const orgRole = orgRoles[currentOrgId];
		// Map UserRole enum to Cerbos role format (e.g., ADMIN -> org_admin)
		const cerbosRole = `org_${orgRole.toLowerCase()}`;
		roles.push(cerbosRole);
	}

	// Add staff role if user is Hestami staff
	if (staffRoles && staffRoles.length > 0) {
		roles.push('hestami_staff');
		if (staffRoles.includes('PLATFORM_ADMIN')) {
			roles.push('hestami_platform_admin');
		}
	}

	const principal: CerbosPrincipal = {
		id: user.id,
		roles,
		attr: {
			orgRoles,
			...(vendorId && { vendorId }),
			...(staffRoles && staffRoles.length > 0 && { staffRoles }),
			...(pillarAccess && pillarAccess.length > 0 && { pillarAccess })
		},
		scope: currentOrgSlug
	};

	log.debug('Principal constructed', {
		userId: user.id,
		email: user.email,
		roles: principal.roles,
		scope: principal.scope,
		orgRolesCount: Object.keys(orgRoles).length,
		hasVendorId: !!vendorId,
		currentOrgId,
		staffRoles: staffRoles ?? [],
		pillarAccess: pillarAccess ?? []
	});

	return principal;
}

// ============================================================================
// Single Resource Authorization
// ============================================================================

/**
 * Check if a principal can perform an action on a resource
 *
 * @param principal - The user principal
 * @param resource - The resource to check
 * @param action - The action to perform
 * @returns true if allowed, false otherwise
 */
export async function isAllowed(
	principal: CerbosPrincipal,
	resource: CerbosResource,
	action: string
): Promise<boolean> {
	const cerbos = getCerbos();

	try {
		const result = await cerbos.isAllowed({
			principal: {
				id: principal.id,
				roles: principal.roles,
				attr: principal.attr,
				scope: principal.scope
			},
			resource: {
				kind: resource.kind,
				id: resource.id,
				attr: resource.attr as unknown as Record<string, Value>,
				scope: resource.scope
			},
			action
		});

		const allowed = result === true;
		log.debug('Authorization check', {
			principalId: principal.id,
			roles: principal.roles,
			staffRoles: principal.attr.staffRoles,
			pillarAccess: principal.attr.pillarAccess,
			resourceKind: resource.kind,
			resourceId: resource.id,
			resourceAttr: resource.attr,
			action,
			allowed
		});

		return allowed;
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));

		await recordSpanError(errorObj, {
			errorCode: 'AUTHORIZATION_FAILED',
			errorType: 'AUTHORIZATION_ERROR'
		});

		log.error('Authorization check failed', {
			principalId: principal.id,
			resourceKind: resource.kind,
			resourceId: resource.id,
			action,
			error: errorObj.message
		});
		throw error;
	}
}

/**
 * Check multiple actions on a single resource
 *
 * @param principal - The user principal
 * @param resource - The resource to check
 * @param actions - Array of actions to check
 * @returns Map of action -> allowed
 */
export async function checkResource(
	principal: CerbosPrincipal,
	resource: CerbosResource,
	actions: string[]
): Promise<Record<string, boolean>> {
	const cerbos = getCerbos();

	const result = await cerbos.checkResource({
		principal: {
			id: principal.id,
			roles: principal.roles,
			attr: principal.attr,
			scope: principal.scope
		},
		resource: {
			kind: resource.kind,
			id: resource.id,
			attr: resource.attr as unknown as Record<string, Value>,
			scope: resource.scope
		},
		actions
	});

	// Convert to simple boolean map
	const permissions: Record<string, boolean> = {};
	for (const action of actions) {
		permissions[action] = result.isAllowed(action) === true;
	}
	return permissions;
}

/**
 * Require authorization - throws Error if not allowed
 *
 * @param principal - The user principal
 * @param resource - The resource to check
 * @param action - The action to perform
 * @throws Error with FORBIDDEN status if not allowed
 */
export async function requireAuthorization(
	principal: CerbosPrincipal,
	resource: CerbosResource,
	action: string
): Promise<void> {
	const allowed = await isAllowed(principal, resource, action);
	if (!allowed) {
		throw new Error(`Permission denied: ${action} on ${resource.kind}`);
	}
}

// ============================================================================
// Collection Authorization (Query Planning)
// ============================================================================

/**
 * Get a query plan for filtering a collection of resources
 *
 * This is the key method for efficient list/search operations.
 * Instead of checking each resource individually, Cerbos returns
 * a filter that can be applied to the database query.
 *
 * @param principal - The user principal
 * @param resourceKind - The type of resource (e.g., "property", "unit")
 * @param action - The action to perform (usually "view")
 * @param scope - Optional scope for tenant-specific policies
 * @returns Query plan result
 */
/**
 * Type for Cerbos planResources response
 */
type PlanResourcesResult = Awaited<ReturnType<GRPC['planResources']>>;

export async function planResources(
	principal: CerbosPrincipal,
	resourceKind: string,
	action: string,
	scope?: string
): Promise<PlanResourcesResult> {
	const cerbos = getCerbos();

	const response = await cerbos.planResources({
		principal: {
			id: principal.id,
			roles: principal.roles,
			attr: principal.attr,
			scope: principal.scope
		},
		resource: {
			kind: resourceKind,
			scope: scope || principal.scope
		},
		action
	});

	return response;
}

/**
 * Convert Cerbos query plan to Prisma where filter
 *
 * This is a simplified implementation. For complex policies,
 * you may need to extend this based on your specific attribute mappings.
 *
 * @param plan - The Cerbos plan resources response
 * @param fieldMapper - Map Cerbos attribute paths to Prisma field names
 * @param principalId - The principal ID for ownership checks
 * @returns Query plan result with Prisma filter
 */
export function queryPlanToPrismaWhere(
	plan: PlanResourcesResult,
	fieldMapper: Record<string, string>,
	principalId: string
): QueryPlanResult {
	// Check if unconditionally allowed or denied
	if (plan.kind === 'KIND_ALWAYS_ALLOWED') {
		return { kind: 'always_allowed' };
	}

	if (plan.kind === 'KIND_ALWAYS_DENIED') {
		return { kind: 'always_denied' };
	}

	// For conditional plans, we need to convert the filter
	// This is a simplified implementation - extend as needed
	if (plan.kind === 'KIND_CONDITIONAL') {
		// Cast to access condition property which exists on conditional plans
		const conditionalPlan = plan as unknown as { condition?: QueryPlanCondition };
		if (conditionalPlan.condition) {
			const filter = convertConditionToPrisma(conditionalPlan.condition, fieldMapper, principalId);
			return { kind: 'conditional', filter };
		}
	}

	// Default to always denied for safety
	return { kind: 'always_denied' };
}

/**
 * Convert a Cerbos condition to Prisma where clause
 *
 * This handles common patterns. Extend for more complex conditions.
 */
/**
 * Internal condition type for query plan parsing
 */
interface QueryPlanCondition {
	expression?: unknown;
	operand?: {
		expressions?: unknown[];
	};
}

function convertConditionToPrisma(
	condition: QueryPlanCondition | undefined,
	fieldMapper: Record<string, string>,
	principalId: string
): PrismaWhereFilter {
	if (!condition) {
		return {};
	}

	// Handle expression-based conditions
	if (condition.expression) {
		return convertExpressionToPrisma(condition.expression, fieldMapper, principalId);
	}

	// Handle operand-based conditions (AND, OR, NOT)
	if (condition.operand?.expressions) {
		// Multiple expressions combined
		const filters = condition.operand.expressions.map((expr: unknown) =>
			convertConditionToPrisma({ expression: expr }, fieldMapper, principalId)
		);

		// Determine if AND or OR based on the condition type
		// Default to AND for safety
		return { AND: filters };
	}

	return {};
}

/**
 * Convert a CEL expression to Prisma where clause
 *
 * Common patterns:
 * - "P.id in R.attr.ownerIds" -> { ownerIds: { has: principalId } }
 * - "R.attr.organizationId == 'xxx'" -> { organizationId: 'xxx' }
 */
function convertExpressionToPrisma(
	expression: unknown,
	fieldMapper: Record<string, string>,
	principalId: string
): PrismaWhereFilter {
	// The expression structure varies based on Cerbos version
	// This is a simplified handler for common patterns

	if (typeof expression === 'object' && expression !== null) {
		const expr = expression as Record<string, unknown>;

		// Handle "in" operator (e.g., P.id in R.attr.ownerIds)
		if (expr.operator === 'in' || expr.call === 'in') {
			const args = (expr.args || expr.operands) as unknown[];
			if (args && args.length === 2) {
				// Check if this is a principal ID in resource attribute check
				const [left, right] = args;
				if (isPrincipalIdRef(left) && isResourceAttrRef(right)) {
					const attrPath = getResourceAttrPath(right);
					const prismaField = fieldMapper[attrPath] || attrPath.split('.').pop();
					if (prismaField) {
						return { [prismaField]: { has: principalId } };
					}
				}
			}
		}

		// Handle equality operator
		if (expr.operator === '==' || expr.call === 'eq') {
			const args = (expr.args || expr.operands) as unknown[];
			if (args && args.length === 2) {
				const [left, right] = args;
				if (isResourceAttrRef(left) && isLiteralValue(right)) {
					const attrPath = getResourceAttrPath(left);
					const prismaField = fieldMapper[attrPath] || attrPath.split('.').pop();
					const value = getLiteralValue(right);
					if (prismaField && value !== undefined) {
						return { [prismaField]: value };
					}
				}
			}
		}
	}

	// For unhandled expressions, return empty (will need manual handling)
	return {};
}

// Helper functions for expression parsing
function isPrincipalIdRef(node: unknown): boolean {
	if (typeof node === 'object' && node !== null) {
		const n = node as Record<string, unknown>;
		return n.name === 'P' || n.ident === 'P' || String(n.value).includes('P.id');
	}
	return false;
}

function isResourceAttrRef(node: unknown): boolean {
	if (typeof node === 'object' && node !== null) {
		const n = node as Record<string, unknown>;
		return n.name === 'R' || n.ident === 'R' || String(n.value).includes('R.attr');
	}
	return false;
}

function getResourceAttrPath(node: unknown): string {
	if (typeof node === 'object' && node !== null) {
		const n = node as Record<string, unknown>;
		if (typeof n.value === 'string') {
			// Extract attribute path from "R.attr.ownerIds" -> "ownerIds"
			const match = String(n.value).match(/R\.attr\.(\w+)/);
			return match ? match[1] : '';
		}
	}
	return '';
}

function isLiteralValue(node: unknown): boolean {
	if (typeof node === 'object' && node !== null) {
		const n = node as Record<string, unknown>;
		return 'value' in n || 'const' in n || 'literal' in n;
	}
	return typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean';
}

function getLiteralValue(node: unknown): unknown {
	if (typeof node === 'object' && node !== null) {
		const n = node as Record<string, unknown>;
		return n.value ?? n.const ?? n.literal;
	}
	return node;
}

// ============================================================================
// Convenience Helpers
// ============================================================================

/**
 * Create a resource object for authorization checks
 */
export function createResource(
	kind: string,
	id: string,
	organizationId: string,
	attrs?: Partial<CerbosResource['attr']>,
	scope?: string
): CerbosResource {
	return {
		kind,
		id,
		attr: {
			organizationId,
			...attrs
		},
		scope
	};
}

/**
 * Standard field mappings for Prisma
 */
export const STANDARD_FIELD_MAPPINGS: Record<string, string> = {
	'R.attr.organizationId': 'organizationId',
	'R.attr.ownerIds': 'ownerIds',
	'R.attr.memberIds': 'memberIds',
	'R.attr.tenantIds': 'tenantIds',
	'R.attr.unitOwnerIds': 'unitOwnerIds',
	'R.attr.unitTenantIds': 'unitTenantIds',
	'R.attr.assignedVendorId': 'assignedVendorId',
	'R.attr.createdByUserId': 'createdByUserId',
	'R.attr.userId': 'userId',
	'R.attr.partyUserId': 'partyUserId'
};
