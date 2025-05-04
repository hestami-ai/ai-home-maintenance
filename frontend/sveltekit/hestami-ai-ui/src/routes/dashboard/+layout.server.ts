import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import type { User } from '$lib/types';

export const load = async ({ locals, fetch, cookies }) => {
  // Check if user is authenticated
  const auth = locals.auth;
  
  // If not authenticated, redirect to login
  if (!auth) {
    throw redirect(303, '/login');
  }
  
  // Fetch user profile if we don't have it yet
  if (!auth.user) {
    try {
      // Use the SvelteKit API proxy instead of direct API calls
      const response = await fetch('/api/users/profile/', {
        headers: {
          'Authorization': `Bearer ${auth.accessToken}`
        }
      });
      
      if (response.ok) {
        const userData = await response.json() as User;
        
        // Update the auth object
        auth.user = userData;
        
        // Also update the user_data cookie
        cookies.set('user_data', encodeURIComponent(JSON.stringify(userData)), {
          path: '/',
          httpOnly: false, // Allow JavaScript access
          secure: false, // Set to true in production
          sameSite: 'strict',
          maxAge: 60 * 60 * 24 // 1 day
        });
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  }
  
  // Return user data to the client
  return {
    user: auth.user
  };
};
