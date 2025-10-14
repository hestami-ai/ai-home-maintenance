import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { apiGet } from '$lib/server/api';

/**
 * GET endpoint to list media for a property
 * Maps to Django's /api/media/properties/<property_id>/ endpoint
 */
export async function GET({ params, cookies, url }: RequestEvent) {
  try {
    const propertyId = params.id;
    
    // Forward to Django backend
    const response = await apiGet(
      cookies,
      `/api/media/properties/${propertyId}/`,
      {},
      url.pathname
    );
    
    return json(response.data, { status: response.status });
  } catch (error) {
    console.error(`Error fetching media for property ${params.id}:`, error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Failed to fetch media';
      
    return json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
