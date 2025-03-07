'use client';

import { useCallback } from 'react';
import { signOut, useSession } from 'next-auth/react';

/**
 * A simplified hook for basic authentication functions
 * This replaces the complex session manager with just the essential functions
 */
export function useAuth() {
  const { data: session, update } = useSession();

  /**
   * Refresh the access token
   */
  const refreshToken = useCallback(async (): Promise<boolean> => {
    try {
      console.log('Refreshing token...');
      
      if (!session) {
        console.error('No session found');
        return false;
      }
      
      // Use the NextJS API route for token refresh
      const apiUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const tokenUrl = `${apiUrl}/api/auth/token`;
      
      console.log(`Calling token refresh endpoint: ${tokenUrl}`);
      
      // Make a POST request to the NextJS API route
      const response = await fetch(tokenUrl, {
        method: 'POST',
        credentials: 'include', // Important: include cookies in the request
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      
      if (response.ok) {
        console.log('Token refreshed successfully');
        
        // Update the session to reflect the new token
        await update();
        
        return true;
      } else {
        console.error('Failed to refresh token:', response.status);
        return false;
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      return false;
    }
  }, [session, update]);

  /**
   * Get the current session data
   */
  const getSession = useCallback(async (): Promise<any> => {
    try {
      const apiUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const sessionUrl = `${apiUrl}/api/auth/session`;
      
      const response = await fetch(sessionUrl);
      if (!response.ok) {
        console.error('Failed to get session data');
        return null;
      }
      
      const sessionData = await response.json();
      return sessionData;
    } catch (error) {
      console.error('Error getting session data:', error);
      return null;
    }
  }, []);

  /**
   * Log the user out
   */
  const logout = useCallback(async () => {
    await signOut({ callbackUrl: '/login' });
  }, []);

  return { refreshToken, getSession, logout };
}
