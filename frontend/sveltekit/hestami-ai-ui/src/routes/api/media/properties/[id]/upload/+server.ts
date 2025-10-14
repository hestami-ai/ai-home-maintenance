import { json, error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import * as auth from '$lib/server/auth';

/**
 * POST endpoint to upload media for a property
 * Maps to Django's /api/media/properties/<property_id>/upload/ endpoint
 */
export async function POST({ params, request, cookies, url }: RequestEvent) {
  console.log(`[UPLOAD] Received upload request for property ${params.id}`);
  console.log(`[UPLOAD] Content-Type: ${request.headers.get('content-type')}`);
  console.log(`[UPLOAD] Content-Length: ${request.headers.get('content-length')}`);
  
  try {
    const propertyId = params.id;
    const returnUrl = url.pathname;
    
    // Check authentication
    const sessionId = auth.checkAuthentication(cookies, returnUrl);
    
    console.log(`[UPLOAD] Parsing FormData...`);
    const formData = await request.formData();
    console.log(`[UPLOAD] FormData parsed successfully`);
    
    // Log FormData contents (without file data)
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        console.log(`[UPLOAD] FormData field: ${key} = File(${value.name}, ${value.size} bytes)`);
      } else {
        console.log(`[UPLOAD] FormData field: ${key} = ${value}`);
      }
    }
    
    console.log(`[UPLOAD] Forwarding to Django...`);
    // Use apiRequest directly (same as service request upload)
    const endpoint = `/api/media/properties/${propertyId}/upload/`;
    const response = await auth.apiRequest(sessionId, endpoint, {
      method: 'POST',
      // Don't set Content-Type here, it will be set automatically with the correct boundary
      body: formData
    });
    
    console.log(`[UPLOAD] Django response status: ${response.status}`);
    
    if (!response.ok) {
      throw error(response.status, response.statusText || 'Failed to upload media');
    }
    
    const data = await response.json();
    console.log(`[UPLOAD] Django response data:`, data);
    return json(data);
  } catch (err) {
    console.error(`[UPLOAD] Error uploading media for property ${params.id}:`, err);
    return auth.handleApiError(err, url.pathname);
  }
}
