import { createAuthClient } from 'better-auth/svelte';

/**
 * Better-Auth client for frontend authentication
 */
export const authClient = createAuthClient({
	baseURL: typeof window !== 'undefined' ? window.location.origin : ''
});

// Export commonly used functions
export const { signIn, signUp, signOut, useSession } = authClient;
