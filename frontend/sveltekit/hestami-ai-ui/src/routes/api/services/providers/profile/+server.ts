import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { apiGet, apiPut } from '$lib/server/api';
import { logApiRequest, logApiResponse, logApiError } from '$lib/server/logger';
import { getClientInfo } from '$lib/server/utils';
import { processMobileSession } from '$lib/server/auth/mobile';

/**
 * GET endpoint to retrieve provider profile
 * Maps to Django's /api/services/providers/profile/ endpoint
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
    `Provider profile request from ${clientInfo.isMobile ? 'mobile' : 'web'} client${isMobileSession ? ' (using header session)' : ''}`
  );
  
  try {
    // Use the centralized API utility to fetch provider profile
    const profileResponse = await apiGet(
      cookies,
      '/api/services/providers/profile/',
      {},
      url.pathname
    );
    
    // Log successful response
    logApiResponse(cookies, request, url, 200);
    
    return json({ profile: profileResponse.data });
  } catch (err) {
    // Log error with structured format
    logApiError(cookies, request, url, err);
    
    return json(
      { error: err instanceof Error ? err.message : 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

/**
 * PUT endpoint to update provider profile
 * Maps to Django's /api/services/providers/profile/ endpoint (PUT method)
 */
export async function PUT({ request, cookies, url }: RequestEvent) {
  // Process mobile session if applicable
  const isMobileSession = processMobileSession(request, cookies);
  
  // Get client information for logging
  const clientInfo = getClientInfo(request);
  
  // Log the request with appropriate context
  logApiRequest(
    cookies, 
    request, 
    url, 
    `Update provider profile from ${clientInfo.isMobile ? 'mobile' : 'web'} client${isMobileSession ? ' (using header session)' : ''}`
  );
  
  try {
    // Extract profile data from request
    const profileData = await request.json();
    
    // Forward to Django backend using server-side apiPut
    const response = await apiPut(
      cookies,
      '/api/services/providers/profile/',
      profileData,
      {},
      url.pathname
    );
    
    // Log successful response
    logApiResponse(cookies, request, url, response.status);
    
    // Return the response with appropriate status
    return json(response.data, { status: response.status });
  } catch (error) {
    // Log error with structured format
    logApiError(cookies, request, url, error);
    
    // Use type guard to safely access error properties
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Failed to update provider profile';
    
    return json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
