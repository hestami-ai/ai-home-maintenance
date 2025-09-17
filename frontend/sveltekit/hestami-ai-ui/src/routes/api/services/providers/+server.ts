import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { apiGet } from '$lib/server/api';
import { logApiRequest, logApiResponse, logApiError } from '$lib/server/logger';
import { getClientInfo } from '$lib/server/utils';
import { processMobileSession } from '$lib/server/auth/mobile';

/**
 * GET endpoint to retrieve service providers
 * Maps to Django's /api/services/providers/ endpoint
 */
export async function GET({ cookies, url, request }: RequestEvent) {
  // Process mobile session if applicable
  const isMobileSession = processMobileSession(request, cookies);
  
  // Get client information for logging
  const clientInfo = getClientInfo(request);
  
  // Log the request with appropriate context
  logApiRequest(
    cookies, 
    request, 
    url, 
    `Service providers list request from ${clientInfo.isMobile ? 'mobile' : 'web'} client${isMobileSession ? ' (using header session)' : ''}`
  );
  
  try {
    // Use the centralized API utility to fetch service providers
    const providersResponse = await apiGet(
      cookies,
      '/api/services/providers/',
      {},
      url.pathname
    );
    
    // Log successful response
    logApiResponse(
      cookies, 
      request, 
      url, 
      200, 
      { count: providersResponse.data.length }
    );
    
    return json({ providers: providersResponse.data });
  } catch (err) {
    // Log error with structured format
    logApiError(cookies, request, url, err);
    
    return json(
      { error: err instanceof Error ? err.message : 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
