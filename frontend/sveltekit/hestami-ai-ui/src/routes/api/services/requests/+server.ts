import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { apiGet, apiPost } from '$lib/server/api';
import type { ServiceRequest } from '$lib/types';
import { logApiRequest, logApiResponse, logApiError } from '$lib/server/logger';
import { getClientInfo } from '$lib/server/utils';
import { processMobileSession } from '$lib/server/auth/mobile';

/**
 * GET endpoint to retrieve service requests
 * Maps to Django's /api/services/requests/ endpoint
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
    `Service requests list request from ${clientInfo.isMobile ? 'mobile' : 'web'} client${isMobileSession ? ' (using header session)' : ''}`
  );
  
  try {
    // Use the centralized API utility to fetch service requests
    const serviceRequestsResponse = await apiGet<ServiceRequest[]>(
      cookies, 
      '/api/services/requests/', 
      {}, 
      url.pathname
    );
    
    // Log successful response
    logApiResponse(
      cookies, 
      request, 
      url, 
      200, 
      { count: serviceRequestsResponse.data.length }
    );
    
    return json({ serviceRequests: serviceRequestsResponse.data });
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
 * POST endpoint to create a new service request
 * Maps to Django's /api/services/requests/create/ endpoint
 */
export async function POST({ request, cookies, url }: RequestEvent) {
  // Process mobile session if applicable
  const isMobileSession = processMobileSession(request, cookies);
  
  // Get client information for logging
  const clientInfo = getClientInfo(request);
  
  // Log the request with appropriate context
  logApiRequest(
    cookies, 
    request, 
    url, 
    `Service request creation from ${clientInfo.isMobile ? 'mobile' : 'web'} client${isMobileSession ? ' (using header session)' : ''}`
  );
  
  try {
    // Extract service request data from request
    const serviceRequestData = await request.json();
    
    // Forward to Django backend using server-side apiPost
    const response = await apiPost(
      cookies,
      '/api/services/requests/create/',
      serviceRequestData,
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
      : 'Failed to create service request';
    
    return json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
