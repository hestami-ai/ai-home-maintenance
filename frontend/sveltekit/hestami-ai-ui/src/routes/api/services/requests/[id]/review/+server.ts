import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { apiPost } from '$lib/server/api';
import { logApiRequest, logApiResponse, logApiError } from '$lib/server/logger';
import { getClientInfo } from '$lib/server/utils';
import { processMobileSession } from '$lib/server/auth/mobile';

/**
 * POST endpoint to create a review for a service
 * Maps to Django's /api/services/requests/<uuid:request_id>/review/ endpoint
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
    `Create review for service request (ID: ${params.id}) from ${clientInfo.isMobile ? 'mobile' : 'web'} client${isMobileSession ? ' (using header session)' : ''}`
  );
  
  try {
    // Extract review data from request
    const reviewData = await request.json();
    
    // Forward to Django backend using server-side apiPost
    const response = await apiPost(
      cookies,
      `/api/services/requests/${params.id}/review/`,
      reviewData,
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
      : 'Failed to create review';
    
    return json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
