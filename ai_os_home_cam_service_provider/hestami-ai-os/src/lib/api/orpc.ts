/**
 * Type-safe oRPC client for browser/client-side usage
 * 
 * This client provides full type inference from the server's AppRouter,
 * eliminating the need for manual type definitions and ensuring type safety.
 */

import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { RouterClient } from '@orpc/server';
import type { AppRouter } from '$server/api';
import { browser } from '$app/environment';
import { logger } from '$lib/logger';
import { get } from 'svelte/store';
import { currentOrganization } from '$lib/stores';

const log = logger.child({ component: 'oRPC' });

/**
 * Create the RPC link with proper configuration
 * - Uses dynamic URL function to resolve at request time (not module load time)
 * - Includes credentials for session cookies
 * - Supports dynamic headers for organization context
 */
function createLink(organizationId?: string | (() => string | undefined)) {
	return new RPCLink({
		// Use a function to resolve URL at request time, not module load time
		// This ensures window.location.origin is available in the browser
		url: () => {
			if (browser) {
				return `${window.location.origin}/api/v1/rpc`;
			}
			// SSR fallback - this client shouldn't be used server-side
			return 'http://localhost:3000/api/v1/rpc';
		},
		headers: () => {
			const headers: Record<string, string> = {};
			// Support both static string and dynamic function for org ID
			const orgId = typeof organizationId === 'function' ? organizationId() : organizationId;
			if (orgId) {
				headers['X-Org-Id'] = orgId;
			}
			return headers;
		},
		fetch: (request, init) => {
			log.debug('Request', { url: request.url, method: request.method });
			return fetch(request, {
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
	createLink(() => get(currentOrganization)?.id)
);

/**
 * Create an oRPC client with a specific organization context
 * Use this when you need to explicitly specify an organization ID
 * 
 * @param organizationId - The organization ID to include in requests
 * @returns A type-safe oRPC client with organization context
 * 
 * @example
 * const orgClient = createOrgClient('org_123');
 * const workOrders = await orgClient.workOrder.list();
 */
export function createOrgClient(organizationId: string): RouterClient<AppRouter> {
	return createORPCClient(createLink(organizationId));
}

/**
 * Re-export types for convenience
 */
export type { AppRouter };
