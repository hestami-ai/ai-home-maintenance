import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { SESSION_COOKIE_NAME } from '$lib/server/redis';
import { getAuthTokens, deleteSession, apiRequest } from '$lib/server/auth';
import { env } from '$env/dynamic/private';

// Django API base URL
const API_BASE_URL = env.SVELTE_KIT_DJANGO_API_BASE_URL || 'http://localhost:8050';

/**
 * Logout endpoint with server-side session management
 * This proxy forwards logout requests to Django and deletes the server-side session
 */
export const POST: RequestHandler = async ({ cookies, locals }) => {
    try {
        console.log('Logout endpoint called');
        
        // Get session ID from cookie
        const sessionId = cookies.get(SESSION_COOKIE_NAME);
        
        if (sessionId) {
            try {
                // Get tokens from Redis
                const tokens = await getAuthTokens(sessionId);
                
                if (tokens) {
                    console.log('Found auth tokens for session, notifying Django about logout');
                    
                    // Notify Django about logout
                    await fetch(`${API_BASE_URL}/api/users/logout/`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${tokens.accessToken}`
                        },
                        body: JSON.stringify({ refresh_token: tokens.refreshToken })
                    }).catch(err => {
                        // Log error but continue with logout process
                        console.error('Error notifying Django about logout:', err);
                    });
                }
                
                // Delete session regardless of Django response
                await deleteSession(cookies, sessionId);
                console.log('Session deleted successfully');
            } catch (err) {
                console.error('Error during logout process:', err);
                // Still try to delete the session cookie
                cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
            }
        } else {
            console.log('No session found for logout');
        }
        
        // For backward compatibility, also clear any old cookies
        console.log('Clearing any legacy cookies');
        cookies.delete('user_data', { path: '/' });
        cookies.delete('access_token', { path: '/' });
        cookies.delete('refresh_token', { path: '/' });
        
        return json({ success: true });
    } catch (error) {
        console.error('Logout API proxy error:', error);
        
        // Even if there's an error, try to clear cookies
        cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
        cookies.delete('user_data', { path: '/' });
        cookies.delete('access_token', { path: '/' });
        cookies.delete('refresh_token', { path: '/' });
        
        return json({ error: 'Failed to process logout request', success: false }, { status: 500 });
    }
};
