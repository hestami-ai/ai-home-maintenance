import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { apiPost } from '$lib/server/api';
import { logApiRequest, logApiResponse, logApiError } from '$lib/server/logger';
import { getClientInfo } from '$lib/server/utils';
import { processMobileSession } from '$lib/server/auth/mobile';

/**
 * GET endpoint to list research entries for a service request
 * Maps to Django's /api/services/requests/<uuid:request_id>/research/ endpoint
 */
export async function GET({ params, request, cookies, url }: RequestEvent) {
  // Log the request
  logApiRequest(cookies, request, url, `List research entries for service request (ID: ${params.id})`);
  
  try {
    // Forward to Django backend
    const response = await apiPost(
      cookies,
      `/api/services/requests/${params.id}/research/`,
      null,
      { method: 'GET' },
      url.pathname
    );
    
    // Log successful response
    logApiResponse(cookies, request, url, response.status);
    
    return json(response.data, { status: response.status });
  } catch (error) {
    // Log error
    logApiError(cookies, request, url, error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Failed to list research entries';
    
    return json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
