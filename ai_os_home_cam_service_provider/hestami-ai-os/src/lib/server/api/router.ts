import { os } from '@orpc/server';
import { z } from 'zod';
import type { RequestContext } from './context.js';
import { ApiException, ResponseMetaSchema } from './errors.js';
import {
	buildPrincipal,
	isAllowed,
	requireAuthorization,
	planResources,
	queryPlanToPrismaWhere,
	createResource,
	STANDARD_FIELD_MAPPINGS,
	type CerbosPrincipal,
	type CerbosResource,
	type CerbosResourceAttr,
	type QueryPlanResult
} from '../cerbos/index.js';
import type { User, Organization, UserRole } from '../../../../generated/prisma/client.js';

/**
 * Base oRPC instance with context type
 */
export const orpc = os.$context<RequestContext>();

/**
 * Public procedure - no authentication required
 */
export const publicProcedure = orpc;

/**
 * Authenticated procedure - requires valid session
 */
export const authedProcedure = orpc.use(async ({ context, next }) => {
	if (!context.user) {
		throw ApiException.unauthenticated();
	}
	return next({
		context: {
			...context,
			user: context.user
		}
	});
});

/**
 * Extended context for organization-scoped procedures with Cerbos helpers
 */
export interface OrgContext extends RequestContext {
	user: User;
	organization: Organization;
	role: UserRole;
	cerbos: {
		/** The Cerbos principal for this request */
		principal: CerbosPrincipal;
		/**
		 * Check if user can perform action on a resource
		 * @param action - The action to check (e.g., 'view', 'create', 'edit', 'delete')
		 * @param resourceKind - The type of resource (e.g., 'association', 'property')
		 * @param resourceId - The ID of the resource
		 * @param attrs - Additional resource attributes for fine-grained checks
		 */
		can: (
			action: string,
			resourceKind: string,
			resourceId: string,
			attrs?: Partial<CerbosResourceAttr>
		) => Promise<boolean>;
		/**
		 * Require authorization - throws 403 if not allowed
		 * @param action - The action to check
		 * @param resourceKind - The type of resource
		 * @param resourceId - The ID of the resource
		 * @param attrs - Additional resource attributes
		 */
		authorize: (
			action: string,
			resourceKind: string,
			resourceId: string,
			attrs?: Partial<CerbosResourceAttr>
		) => Promise<void>;
		/**
		 * Get a Prisma where filter for list operations
		 * Returns the filter to apply, or throws if access is denied
		 * @param action - The action (usually 'view')
		 * @param resourceKind - The type of resource
		 * @param fieldMapper - Optional custom field mappings
		 */
		queryFilter: (
			action: string,
			resourceKind: string,
			fieldMapper?: Record<string, string>
		) => Promise<QueryPlanResult>;
	};
}

/**
 * Organization-scoped procedure - requires auth + active org context
 * Includes Cerbos authorization helpers
 */
export const orgProcedure = authedProcedure.use(async ({ context, next }) => {
	if (!context.organization) {
		throw ApiException.forbidden('Organization context required. Set X-Org-Id header.');
	}

	const user = context.user!;
	const organization = context.organization;
	const role = context.role!;

	// Build Cerbos principal from context
	const principal = buildPrincipal(
		user,
		context.orgRoles,
		organization.slug ?? undefined
	);

	// Create Cerbos helper functions
	const cerbosHelpers = {
		principal,

		can: async (
			action: string,
			resourceKind: string,
			resourceId: string,
			attrs?: Partial<CerbosResourceAttr>
		): Promise<boolean> => {
			const resource = createResource(
				resourceKind,
				resourceId,
				organization.id,
				attrs,
				organization.slug ?? undefined
			);
			return isAllowed(principal, resource, action);
		},

		authorize: async (
			action: string,
			resourceKind: string,
			resourceId: string,
			attrs?: Partial<CerbosResourceAttr>
		): Promise<void> => {
			const resource = createResource(
				resourceKind,
				resourceId,
				organization.id,
				attrs,
				organization.slug ?? undefined
			);
			await requireAuthorization(principal, resource, action);
		},

		queryFilter: async (
			action: string,
			resourceKind: string,
			fieldMapper?: Record<string, string>
		): Promise<QueryPlanResult> => {
			const plan = await planResources(
				principal,
				resourceKind,
				action,
				organization.slug ?? undefined
			);
			return queryPlanToPrismaWhere(
				plan,
				fieldMapper || STANDARD_FIELD_MAPPINGS,
				user.id
			);
		}
	};

	return next({
		context: {
			...context,
			organization,
			role,
			cerbos: cerbosHelpers
		} as OrgContext
	});
});

/**
 * Admin procedure - requires ADMIN role in org
 */
export const adminProcedure = orgProcedure.use(async ({ context, next }) => {
	if (context.role !== 'ADMIN') {
		throw ApiException.forbidden('Admin access required');
	}
	return next({ context });
});

/**
 * Idempotency key schema for mutating operations
 */
export const IdempotencyKeySchema = z.object({
	idempotencyKey: z.string().uuid()
});

/**
 * Standard pagination input schema
 */
export const PaginationInputSchema = z.object({
	cursor: z.string().optional(),
	limit: z.number().int().min(1).max(100).default(20)
});

/**
 * Standard pagination output schema
 */
export const PaginationOutputSchema = z.object({
	nextCursor: z.string().nullable(),
	hasMore: z.boolean()
});

/**
 * Creates response metadata from context
 */
export function createResponseMeta(context: RequestContext) {
	return {
		requestId: context.requestId,
		traceId: context.traceId,
		spanId: context.spanId,
		timestamp: context.timestamp.toISOString(),
		locale: 'en-US'
	};
}

/**
 * Wraps data in standard success envelope
 */
export function successResponse<T>(data: T, context: RequestContext) {
	return {
		ok: true as const,
		data,
		meta: createResponseMeta(context)
	};
}
