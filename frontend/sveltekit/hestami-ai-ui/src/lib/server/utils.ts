/**
 * Utility functions for server-side operations
 */

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
