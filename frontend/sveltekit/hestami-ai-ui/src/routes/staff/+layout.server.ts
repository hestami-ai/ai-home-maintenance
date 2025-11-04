import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

/**
 * CRITICAL: STAFF Role Check Enforcement
 * This layout protects all /staff/* routes and ensures ONLY users with STAFF role can access them.
 * This check cannot be bypassed or skipped.
 */
export const load: LayoutServerLoad = async ({ locals, url }) => {
  // Check if user is authenticated
  const auth = locals.auth;
  
  // If not authenticated, redirect to login with return URL
  if (!auth || !auth.user) {
    throw redirect(303, `/login?returnUrl=${encodeURIComponent(url.pathname)}`);
  }
  
  // CRITICAL: Check if user has STAFF role - this is mandatory and cannot be skipped
  if (auth.user.user_role !== 'STAFF') {
    // Non-STAFF users are redirected to their dashboard
    throw redirect(303, '/dashboard');
  }
  
  // Return user data to child routes
  return {
    user: auth.user
  };
};
