/**
 * Utility functions for server-side operations
 */

import { env } from '$env/dynamic/private';

/**
 * Performs URL rewriting on JSON data based on environment variables
 * Converts JSON to string, performs literal string replacement, and parses back
 * @param data - The data to rewrite (typically JSON response data)
 * @returns The rewritten data with URLs replaced
 */
export function rewriteStaticMediaUrls(data: unknown): unknown {
  const searchPattern = env.STATIC_MEDIA_SERVER_URL_REWRITE_PATTERN;
  const replaceTarget = env.STATIC_MEDIA_SERVER_URL_PATTERN_TARGET;
  
  // Skip replacement if either environment variable is not set
  if (!searchPattern || !replaceTarget) {
    console.warn(
      'Static media URL rewriting skipped: ' +
      `STATIC_MEDIA_SERVER_URL_REWRITE_PATTERN=${searchPattern ? 'set' : 'not set'}, ` +
      `STATIC_MEDIA_SERVER_URL_PATTERN_TARGET=${replaceTarget ? 'set' : 'not set'}`
    );
    return data;
  }
  
  try {
    // Convert to JSON string, perform replacement, and parse back
    const jsonString = JSON.stringify(data);
    const rewrittenString = jsonString.replaceAll(searchPattern, replaceTarget);
    return JSON.parse(rewrittenString);
  } catch (err) {
    console.error('Error during static media URL rewriting:', err);
    // Return original data if rewriting fails
    return data;
  }
}

/**
 * Detect if a request is coming from a mobile client
 * @param userAgent - The User-Agent header from the request
 * @returns boolean indicating if the request is from a mobile client
 */
export function isMobileClient(userAgent: string | null): boolean {
  if (!userAgent) return false;
  
  // Common mobile device identifiers
  const mobileIdentifiers = [
    'iPhone', 'iPad', 'iPod',
    'Android', 'BlackBerry',
    'Windows Phone', 'Mobile',
    'HestamiiOS', 'HestamiAndroid' // Custom identifiers for our apps
  ];
  
  return mobileIdentifiers.some(identifier => 
    userAgent.includes(identifier)
  );
}

/**
 * Extract client information from a request
 * @param request - The Request object
 * @returns Object with client information
 */
export function getClientInfo(request: Request) {
  const userAgent = request.headers.get('user-agent') || 'unknown';
  
  return {
    userAgent,
    isMobile: isMobileClient(userAgent),
    isIOS: userAgent.includes('iPhone') || 
           userAgent.includes('iPad') || 
           userAgent.includes('iPod') ||
           userAgent.includes('HestamiiOS'),
    isAndroid: userAgent.includes('Android') || 
               userAgent.includes('HestamiAndroid')
  };
}
