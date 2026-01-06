/**
 * Type-safe oRPC client for browser/client-side usage
 * 
 * This client provides full type inference from the server's AppRouter,
 * eliminating the need for manual type definitions and ensuring type safety.
 * 
 * NOTE: For server-side direct calls (without HTTP), use createDirectClient
 * from '$lib/server/api/serverClient' instead.
 */

import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { RouterClient } from '@orpc/server';
import type { AppRouter } from '$server/api';
import { browser } from '$app/environment';
import { logger } from '$lib/logger';
import { get } from 'svelte/store';
import { currentOrganization } from '$lib/stores/organization.js';
import { currentAssociationId } from '$lib/stores/association.js';

const log = logger.child({ component: 'oRPC' });

/**
 * Create the RPC link with proper configuration
 * - Uses dynamic URL function to resolve at request time (not module load time)
 * - Includes credentials for session cookies
 * - Supports dynamic headers for organization context
 */
function createLink(
	context?: {
		organizationId?: string | (() => string | undefined);
		associationId?: string | (() => string | undefined);
	},
	customFetch?: typeof fetch
) {
	return new RPCLink({
		// Use a function to resolve URL at request time, not module load time
		// This ensures window.location.origin is available in the browser
		url: () => {
			if (browser) {
				return `${window.location.origin}/api/v1/rpc`;
			}
			// SSR: oRPC's RPCLink uses new URL() which requires absolute URL
			// In SSR context, the server calls itself on localhost:3000
			return 'http://127.0.0.1:3000/api/v1/rpc';
		},
		headers: () => {
			const headers: Record<string, string> = {};

			// Support both static string and dynamic function for org ID
			const orgId = typeof context?.organizationId === 'function'
				? context.organizationId()
				: context?.organizationId;
			if (orgId) {
				headers['X-Org-Id'] = orgId;
			}

			// Support both static string and dynamic function for assoc ID
			const assocId = typeof context?.associationId === 'function'
				? context.associationId()
				: context?.associationId;
			if (assocId) {
				headers['X-Assoc-Id'] = assocId;
			}

			return headers;
		},
		fetch: (request, init) => {
			log.debug('Request', { url: request.url, method: request.method });
			const fetcher = customFetch || fetch;
			return fetcher(request, {
				...init,
				credentials: 'include' // Include session cookies
			}).then(response => {
				log.debug('Response', { url: request.url, status: response.status });
				return response;
			});
		}
	});
}

/**
 * Default oRPC client instance that automatically includes organization context
 * from the currentOrganization store. This is the recommended client for most use cases.
 * 
 * The organization ID is resolved dynamically at request time, so it will always
 * use the current organization from the store.
 */
export const orpc: RouterClient<AppRouter> = createORPCClient(
	createLink({
		organizationId: () => get(currentOrganization)?.id,
		associationId: () => get(currentAssociationId)
	})
);

/**
 * Create an oRPC client with a specific organization context
 * Use this when you need to explicitly specify an organization ID
 * 
 * @param organizationId - The organization ID to include in requests
 * @param customFetch - Optional custom fetch function (e.g. SvelteKit's fetch in SSR)
 * @returns A type-safe oRPC client with organization context
 */
export function createOrgClient(
	organizationId: string,
	associationId?: string,
	customFetch?: typeof fetch
): RouterClient<AppRouter> {
	return createORPCClient(createLink({ organizationId, associationId }, customFetch));
}

/**
 * Create an oRPC client for server-side usage in SvelteKit's load functions.
 * 
 * NOTE: For direct server-side calls without HTTP (recommended), use:
 * - createDirectClient from '$lib/server/api/serverClient'
 * - buildServerContext from '$lib/server/api/serverClient'
 * 
 * This HTTP-based client is kept for backwards compatibility but may have
 * authentication issues in SSR due to cookie forwarding limitations.
 * 
 * @param options - Configuration for the server client
 * @returns A type-safe oRPC client for SSR
 */
export function createServerClient(options: {
	fetch: typeof fetch,
	organizationId?: string,
	associationId?: string
}): RouterClient<AppRouter> {
	return createORPCClient(createLink({
		organizationId: options.organizationId,
		associationId: options.associationId
	}, options.fetch));
}

/**
 * Re-export types for convenience
 */
export type { AppRouter };
