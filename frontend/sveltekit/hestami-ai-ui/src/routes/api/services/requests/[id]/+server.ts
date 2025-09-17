import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { apiGet, apiPut, apiDelete } from '$lib/server/api';
import type { ServiceRequest } from '$lib/types';
import { logApiRequest, logApiResponse, logApiError } from '$lib/server/logger';
import { getClientInfo } from '$lib/server/utils';
import { processMobileSession } from '$lib/server/auth/mobile';

/**
 * GET endpoint to retrieve a specific service request
 * Maps to Django's /api/services/requests/<uuid:request_id>/ endpoint
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
    `Service request detail request (ID: ${params.id}) from ${clientInfo.isMobile ? 'mobile' : 'web'} client${isMobileSession ? ' (using header session)' : ''}`
  );
  
  try {
    // Use the centralized API utility to fetch service request details
    const serviceRequestResponse = await apiGet<ServiceRequest>(
      cookies,
      `/api/services/requests/${params.id}/`,
      {},
      url.pathname
    );
    
    // Log successful response
    logApiResponse(cookies, request, url, 200);
    
    return json({ serviceRequest: serviceRequestResponse.data });
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
 * PUT endpoint to update a service request
 * Maps to Django's /api/services/requests/<uuid:request_id>/ endpoint (PUT method)
 */
export async function PUT({ params, request, cookies, url }: RequestEvent) {
  // Process mobile session if applicable
  const isMobileSession = processMobileSession(request, cookies);
  
  // Get client information for logging
  const clientInfo = getClientInfo(request);
  
  // Log the request with appropriate context
  logApiRequest(
    cookies, 
    request, 
    url, 
    `Service request update (ID: ${params.id}) from ${clientInfo.isMobile ? 'mobile' : 'web'} client${isMobileSession ? ' (using header session)' : ''}`
  );
  
  try {
    // Extract service request data from request
    const serviceRequestData = await request.json();
    
    // Forward to Django backend using server-side apiPut
    const response = await apiPut(
      cookies,
      `/api/services/requests/${params.id}/`,
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
      : 'Failed to update service request';
    
    return json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * DELETE endpoint to delete a service request
 * Maps to Django's /api/services/requests/<uuid:request_id>/ endpoint (DELETE method)
 */
export async function DELETE({ params, cookies, url, request }: RequestEvent) {
  // Process mobile session if applicable
  const isMobileSession = processMobileSession(request, cookies);
  
  // Get client information for logging
  const clientInfo = getClientInfo(request);
  
  // Log the request with appropriate context
  logApiRequest(
    cookies, 
    request, 
    url, 
    `Service request deletion (ID: ${params.id}) from ${clientInfo.isMobile ? 'mobile' : 'web'} client${isMobileSession ? ' (using header session)' : ''}`
  );
  
  try {
    // Forward to Django backend using server-side apiDelete
    const response = await apiDelete(
      cookies,
      `/api/services/requests/${params.id}/`,
      {},
      url.pathname
    );
    
    // Log successful response
    logApiResponse(cookies, request, url, response.status);
    
    // Return success response
    return json(
      { success: true, message: 'Service request deleted successfully' },
      { status: response.status }
    );
  } catch (error) {
    // Log error with structured format
    logApiError(cookies, request, url, error);
    
    // Use type guard to safely access error properties
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Failed to delete service request';
    
    return json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
