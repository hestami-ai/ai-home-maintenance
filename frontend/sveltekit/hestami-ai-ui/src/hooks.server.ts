import { sequence } from '@sveltejs/kit/hooks';
import type { Handle } from '@sveltejs/kit';
import type { User } from '$lib/types';
import { SESSION_COOKIE_NAME } from '$lib/server/redis';
import { getUserData } from '$lib/server/auth';
import { redirect, error } from '@sveltejs/kit';

// Authentication handler using server-side sessions
const authHandler: Handle = async ({ event, resolve }) => {
  try {
    // Get session ID from cookie
    const sessionId = event.cookies.get(SESSION_COOKIE_NAME);
    
    if (sessionId) {
      // Get user data from Redis
      const userData = await getUserData(sessionId);
      
      if (userData) {
        // Set up auth in locals
        const user: User = {
          id: userData.id,
          email: userData.email,
          first_name: userData.first_name,
          last_name: userData.last_name,
          user_role: userData.user_role,
          phone_number: userData.phone_number
        };
        
        event.locals.auth = { sessionId, user };
      } else {
        // Session exists but no user data found
        event.locals.auth = null;
        // Clear invalid session cookie
        event.cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
      }
    } else {
      // No session
      event.locals.auth = null;
    }
    
    // Continue with the request
    return resolve(event);
  } catch (err) {
    console.error('Session handling error:', err);
    // Clear potentially corrupted session
    event.cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
    event.locals.auth = null;
    
    // Continue with the request, but without auth
    return resolve(event);
  }
};

// Error handler for Redis connection issues
const errorHandler: Handle = async ({ event, resolve }) => {
  try {
    return await resolve(event);
  } catch (err) {
    if (err instanceof Error && err.message.includes('Redis connection')) {
      // Redirect to error page for Redis connection issues
      throw redirect(307, '/error?type=server');
    }
    throw err;
  }
};

// Export the sequence of handlers
export const handle = sequence(authHandler, errorHandler);
