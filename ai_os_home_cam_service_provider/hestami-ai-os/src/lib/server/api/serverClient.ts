/**
 * Server-side oRPC client for direct procedure calls without HTTP.
 * This module is server-only and should only be imported in +page.server.ts files.
 */

import { createRouterClient, type RouterClient } from '@orpc/server';
import { appRouter, type AppRouter, type RequestContext, createEmptyContext } from './index.js';
import type { Organization, Association } from '../../../../generated/prisma/client.js';
import { nanoid } from 'nanoid';

/**
 * Create a direct server-side oRPC client that calls procedures without HTTP.
 * This is more efficient than HTTP calls and properly handles authentication context.
 * 
 * @param context - The RequestContext built from SvelteKit locals
 * @returns A type-safe oRPC client for server-side use
 */
export function createDirectClient(context: RequestContext): RouterClient<AppRouter> {
	return createRouterClient(appRouter, {
		context
	});
}

/**
 * Build a RequestContext from SvelteKit locals for direct server-side oRPC calls.
 * This avoids HTTP round-trips and cookie forwarding issues in SSR.
 * 
 * @param locals - SvelteKit event.locals from the load function
 * @param options - Additional context options (orgRoles, staffRoles, pillarAccess, organization, association)
 * @returns RequestContext for use with createDirectClient
 */
export function buildServerContext(
	locals: App.Locals,
	options?: {
		orgRoles?: Record<string, import('../../../../generated/prisma/client.js').UserRole>;
		staffRoles?: import('../../../../generated/prisma/client.js').StaffRole[];
		pillarAccess?: import('../../../../generated/prisma/client.js').PillarAccess[];
		/** Full Prisma Organization object */
		organization?: Organization | null;
		/** Full Prisma Association object */
		association?: Association | null;
		/** User's role in the organization */
		role?: import('../../../../generated/prisma/client.js').UserRole;
		/** Whether the user is Hestami staff */
		isStaff?: boolean;
	}
): RequestContext {
	const context = createEmptyContext(nanoid());

	context.traceId = locals.traceId;
	context.spanId = locals.spanId;

	if (locals.user) {
		context.user = {
			...locals.user,
			name: locals.user.name ?? null,
			image: locals.user.image ?? null
		} as RequestContext['user'];
	}

	// Use organization from options first, then fall back to locals
	if (options?.organization) {
		context.organization = options.organization;
		context.role = options.role ?? null;
	} else if (locals.organization) {
		context.organization = locals.organization;
		context.role = locals.role;
	}

	// Association context
	if (options?.association) {
		context.association = options.association;
		context.associationId = options.association.id;
	} else if (locals.association) {
		context.association = locals.association;
		context.associationId = locals.association.id;
	}

	context.isStaff = options?.isStaff ?? locals.isStaff ?? false;

	if (options?.orgRoles) {
		context.orgRoles = options.orgRoles;
	}

	if (options?.staffRoles) {
		context.staffRoles = options.staffRoles;
	}

	if (options?.pillarAccess) {
		context.pillarAccess = options.pillarAccess;
	}

	return context;
}

export type { AppRouter, RequestContext };
