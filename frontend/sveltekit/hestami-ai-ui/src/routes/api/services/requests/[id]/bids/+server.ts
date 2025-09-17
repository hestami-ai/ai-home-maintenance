import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { apiGet, apiPost } from '$lib/server/api';
import { logApiRequest, logApiResponse, logApiError } from '$lib/server/logger';
import { getClientInfo } from '$lib/server/utils';
import { processMobileSession } from '$lib/server/auth/mobile';

/**
 * GET endpoint to list bids for a service request
 * Maps to Django's /api/services/requests/<uuid:request_id>/bids/ endpoint
 */
export async function GET({ params, cookies, url, request }: RequestEvent) {
  // Process mobile session if applicable
  const isMobileSession = processMobileSession(request, cookies);
  
  // Get client information for logging
  const clientInfo = getClientInfo(request);
  
  // Log the request with appropriate context
  logApiRequest(
    cookies, 
    request, 
    url, 
    `List bids for service request (ID: ${params.id}) from ${clientInfo.isMobile ? 'mobile' : 'web'} client${isMobileSession ? ' (using header session)' : ''}`
  );
  
  try {
    // Use the centralized API utility to fetch bids
    const bidsResponse = await apiGet(
      cookies,
      `/api/services/requests/${params.id}/bids/`,
      {},
      url.pathname
    );
    
    // Log successful response
    logApiResponse(
      cookies, 
      request, 
      url, 
      200, 
      { count: bidsResponse.data.length }
    );
    
    return json({ bids: bidsResponse.data });
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
 * POST endpoint to submit a bid for a service request
 * Maps to Django's /api/services/requests/<uuid:request_id>/bids/submit/ endpoint
 */
export async function POST({ params, request, cookies, url }: RequestEvent) {
  // Process mobile session if applicable
  const isMobileSession = processMobileSession(request, cookies);
  
  // Get client information for logging
  const clientInfo = getClientInfo(request);
  
  // Log the request with appropriate context
  logApiRequest(
    cookies, 
    request, 
    url, 
    `Submit bid for service request (ID: ${params.id}) from ${clientInfo.isMobile ? 'mobile' : 'web'} client${isMobileSession ? ' (using header session)' : ''}`
  );
  
  try {
    // Extract bid data from request
    const bidData = await request.json();
    
    // Forward to Django backend using server-side apiPost
    const response = await apiPost(
      cookies,
      `/api/services/requests/${params.id}/bids/submit/`,
      bidData,
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
      : 'Failed to submit bid';
    
    return json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
