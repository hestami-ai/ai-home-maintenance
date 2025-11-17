/**
 * Unified Authentication Module
 * 
 * This module serves as the central point for all authentication-related functionality.
 * It combines JWT-based authentication with server-side session management to provide
 * a consistent and reliable authentication system.
 */
import { error, redirect } from '@sveltejs/kit';
import type { Cookies } from '@sveltejs/kit';
import { getRedisClient, SESSION_COOKIE_NAME, SESSION_DURATION } from '../redis';
import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';
import type { User, AuthTokens, AuthSession } from '$lib/types';
import { AUTH_ENDPOINTS } from '$lib/types';

// API base URL
export const API_BASE_URL = env.SVELTE_KIT_DJANGO_API_BASE_URL || 'http://localhost:8050';

/**
 * Create a new authenticated session
 * @param cookies - SvelteKit cookies object
 * @param userData - User data to store in session
 * @param tokens - Authentication tokens
 * @returns Session ID
 */
export async function createSession(
  cookies: Cookies,
  userData: User,
  tokens: AuthTokens
): Promise<string> {
  try {
    const redis = await getRedisClient();
    const sessionId = crypto.randomUUID();
    
    // Store user data
    await redis.set(
      `session:${sessionId}:user`,
      JSON.stringify(userData),
      { EX: SESSION_DURATION }
    );
    
    // Store tokens
    await redis.set(
      `session:${sessionId}:tokens`,
      JSON.stringify(tokens),
      { EX: SESSION_DURATION }
    );
    
    // Store session mapping (for lookup by user ID)
    await redis.set(
      `user:${userData.id}:session`,
      sessionId,
      { EX: SESSION_DURATION }
    );
    
    // Set session cookie
    cookies.set(SESSION_COOKIE_NAME, sessionId, {
      path: '/',
      httpOnly: true,
      secure: true, // Set to false for testing in non-HTTPS environments
      sameSite: 'strict',
      maxAge: SESSION_DURATION
    });
    
    return sessionId;
  } catch (error) {
    console.error('Error creating session:', error);
    throw new Error('Failed to create session');
  }
}

/**
 * Get user data from session
 * @param sessionId - Session ID
 * @returns User data or null if not found
 */
export async function getUserData(sessionId: string): Promise<User | null> {
  try {
    const redis = await getRedisClient();
    const userData = await redis.get(`session:${sessionId}:user`);
    
    if (!userData) {
      return null;
    }
    
    return JSON.parse(userData);
  } catch (error) {
    console.error('Error getting user data:', error);
    return null;
  }
}

/**
 * Get authentication tokens from session
 * @param sessionId - Session ID
 * @returns Authentication tokens or null if not found
 */
export async function getAuthTokens(sessionId: string): Promise<AuthTokens | null> {
  try {
    const redis = await getRedisClient();
    const tokens = await redis.get(`session:${sessionId}:tokens`);
    
    if (!tokens) {
      return null;
    }
    
    return JSON.parse(tokens);
  } catch (error) {
    console.error('Error getting auth tokens:', error);
    return null;
  }
}

/**
 * Update authentication tokens in session
 * @param sessionId - Session ID
 * @param tokens - New authentication tokens
 * @returns Success status
 */
export async function updateAuthTokens(sessionId: string, tokens: AuthTokens): Promise<boolean> {
  try {
    const redis = await getRedisClient();
    
    await redis.set(
      `session:${sessionId}:tokens`,
      JSON.stringify(tokens),
      { EX: SESSION_DURATION }
    );
    
    return true;
  } catch (error) {
    console.error('Error updating auth tokens:', error);
    return false;
  }
}

/**
 * Delete session
 * @param cookies - SvelteKit cookies object
 * @param sessionId - Session ID
 * @returns Success status
 */
export async function deleteSession(cookies: Cookies, sessionId: string): Promise<boolean> {
  try {
    const redis = await getRedisClient();
    
    // Get user ID for mapping cleanup
    const userData = await getUserData(sessionId);
    
    // Delete session data
    await redis.del(`session:${sessionId}:user`);
    await redis.del(`session:${sessionId}:tokens`);
    
    // Delete user mapping if we have user data
    if (userData?.id) {
      await redis.del(`user:${userData.id}:session`);
    }
    
    // Clear session cookie
    cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
    
    return true;
  } catch (error) {
    console.error('Error deleting session:', error);
    return false;
  }
}

/**
 * Refresh authentication tokens
 * @param sessionId - Session ID
 * @returns Success status
 */
export async function refreshTokens(sessionId: string): Promise<boolean> {
  try {
    // Get current tokens
    const tokens = await getAuthTokens(sessionId);
    
    if (!tokens?.refreshToken) {
      return false;
    }
    
    // Call refresh endpoint - using the centralized endpoint definition
    const response = await fetch(`${API_BASE_URL}${AUTH_ENDPOINTS.REFRESH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        refresh: tokens.refreshToken
      })
    });
    
    if (!response.ok) {
      return false;
    }
    
    // Get new tokens from response
    const data = await response.json();
    
    // Check if we have both new access and refresh tokens
    if (!data.access) {
      return false;
    }
    
    // Update tokens in session with both new access and refresh tokens
    return updateAuthTokens(sessionId, {
      accessToken: data.access,
      // Use the new refresh token if available, otherwise keep the old one
      // Django should return both tokens, but we're being defensive
      refreshToken: data.refresh || tokens.refreshToken
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    return false;
  }
}

/**
 * Check if the user is authenticated
 * @param cookies - SvelteKit cookies object
 * @param returnUrl - URL to return to after login
 * @returns The session ID if authenticated
 * @throws Redirect to login page if not authenticated
 */
export function checkAuthentication(cookies: Cookies, returnUrl: string): string {
  const sessionId = cookies.get(SESSION_COOKIE_NAME);
  console.log('Session ID:', sessionId);
  if (!sessionId) {
    console.log('No session found, redirecting to login page');
    throw redirect(302, `/login?returnUrl=${encodeURIComponent(returnUrl)}`);
  }
  
  return sessionId;
}

/**
 * Make authenticated API request to Django
 * @param sessionId - Session ID
 * @param path - API endpoint path
 * @param options - Fetch options
 * @returns Fetch response
 */
export async function apiRequest(
  sessionId: string,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  try {
    // Get tokens
    const tokens = await getAuthTokens(sessionId);
    
    if (!tokens) {
      throw new Error('No authentication tokens available');
    }
    
    // Prepare headers
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${tokens.accessToken}`);
    
    // Only set Content-Type to application/json if the body is not FormData
    // For FormData, browser will set the correct multipart/form-data Content-Type with boundary
    if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    
    // Make request
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers
    });
    
    // Handle token refresh if needed
    if (response.status === 401) {
      const refreshed = await refreshTokens(sessionId);
      
      if (refreshed) {
        // Get new tokens
        const newTokens = await getAuthTokens(sessionId);
        
        if (newTokens) {
          // Retry request with new token
          headers.set('Authorization', `Bearer ${newTokens.accessToken}`);
          
          return fetch(`${API_BASE_URL}${path}`, {
            ...options,
            headers
          });
        }
      }
      
      // If refresh failed, throw error
      throw new Error('Authentication failed');
    }
    
    return response;
  } catch (error) {
    console.error('API request error:', error);
    throw error;
  }
}

/**
 * Handle API errors consistently
 * @param err - Error object
 * @param returnUrl - URL to return to after login
 * @throws Appropriate SvelteKit error or redirect
 */
export function handleApiError(err: unknown, returnUrl: string): never {
  console.error('API error:', err);
  
  // Handle authentication errors
  if (err instanceof Error) {
    if (err.message === 'Authentication failed' || 
        err.message === 'No authentication tokens available') {
      console.log('Authentication failed, redirecting to login page');
      throw redirect(302, `/login?returnUrl=${encodeURIComponent(returnUrl)}`);
    }
    
    // Log the specific error message for debugging
    console.error('Error details:', err.message);
  }
  
  // For other errors, throw a generic error
  throw error(500, 'An error occurred while communicating with the server');
}

/**
 * Login user with credentials
 * @param email - User email
 * @param password - User password
 * @param cookies - SvelteKit cookies object
 * @returns Login success status and user data
 */
export async function loginWithCredentials(
  email: string,
  password: string,
  cookies: Cookies
): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    // 1. Authenticate with Django
    const response = await fetch(`${API_BASE_URL}${AUTH_ENDPOINTS.LOGIN}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.detail || 'Invalid credentials'
      };
    }
    
    const data = await response.json();
    
    // 2. Create Django session
    const sessionId = await createSession(
      cookies,
      data.user,
      {
        accessToken: data.access,
        refreshToken: data.refresh
      }
    );
    
    // 3. Authenticate with LibreChat (non-blocking, don't fail login if this fails)
    try {
      const { getLibreChatPasswordFromDjango, authenticateLibreChat, setLibreChatSession } = await import('../librechat');
      
      // Get LibreChat password from Django
      const librechatPassword = await getLibreChatPasswordFromDjango(data.access);
      
      if (librechatPassword) {
        // Authenticate with LibreChat
        const librechatSession = await authenticateLibreChat(email, librechatPassword);
        
        if (librechatSession) {
          // Store LibreChat session in Redis
          await setLibreChatSession(sessionId, librechatSession);
          console.log(`LibreChat session established for ${email}`);
        } else {
          console.warn(`LibreChat authentication failed for ${email}, chat features may not work`);
        }
      } else {
        console.warn(`Could not retrieve LibreChat password for ${email}, chat features may not work`);
      }
    } catch (librechatError) {
      console.error('LibreChat authentication error:', librechatError);
      // Don't fail the login if LibreChat authentication fails
    }
    
    return {
      success: true,
      user: data.user
    };
  } catch (error) {
    console.error('Login error:', error);
    return {
      success: false,
      error: 'An error occurred during login'
    };
  }
}

/**
 * Logout user
 * @param cookies - SvelteKit cookies object
 * @returns Logout success status
 */
export async function logout(cookies: Cookies): Promise<boolean> {
  try {
    const sessionId = cookies.get(SESSION_COOKIE_NAME);
    
    if (!sessionId) {
      return true; // Already logged out
    }
    
    return deleteSession(cookies, sessionId);
  } catch (error) {
    console.error('Logout error:', error);
    return false;
  }
}
