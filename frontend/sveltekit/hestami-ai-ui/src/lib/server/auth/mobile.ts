/**
 * Mobile Authentication Utilities
 * 
 * Helper functions for handling authentication with mobile clients
 */
import type { Cookies } from '@sveltejs/kit';
import { SESSION_COOKIE_NAME } from '../redis';
import { getClientInfo } from '../utils';
import logger from '../logger';

/**
 * Process request for mobile authentication
 * Handles session cookies from headers for iOS clients
 * 
 * @param request - The incoming request
 * @param cookies - SvelteKit cookies object
 * @returns boolean - Whether a mobile session was processed
 */
export function processMobileSession(request: Request, cookies: Cookies): boolean {
  // Get client information
  const clientInfo = getClientInfo(request);
  
  // Only process for mobile clients
  if (!clientInfo.isMobile) {
    return false;
  }
  
  // Check for session cookie in headers (for iOS app)
  const sessionCookie = request.headers.get('x-session-id');
  
  // If we have a session cookie in headers but not in cookies, use it
  if (sessionCookie && !cookies.get(SESSION_COOKIE_NAME)) {
    // Log the session transfer
    logger.info(`Using session from headers for mobile client: ${clientInfo.userAgent.substring(0, 50)}...`, {
      data: {
        isMobile: true,
        isIOS: clientInfo.isIOS,
        isAndroid: clientInfo.isAndroid
      }
    });
    
    // Set the session cookie
    cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
      path: '/',
      httpOnly: true,
      secure: false, // Set to false for testing in non-HTTPS environments
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7 // 1 week in seconds
    });
    
    return true;
  }
  
  return false;
}
