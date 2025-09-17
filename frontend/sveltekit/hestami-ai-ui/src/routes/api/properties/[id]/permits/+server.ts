import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { apiGet, apiPost } from '$lib/server/api';

/**
 * GET endpoint to retrieve permit history for a specific property
 * Maps to Django's /<uuid:property_id>/permits/ endpoint
 */
export async function GET({ params, cookies, url }: RequestEvent) {
  try {
    const propertyId = params.id;
    
    // Fetch permit history for this property
    const response = await apiGet(
      cookies,
      `/api/properties/${propertyId}/permits/`,
      {},
      url.pathname
    );
    
    return json(response.data);
  } catch (err) {
    console.error(`Error fetching permit history for property ${params.id}:`, err);
    return json(
      { error: err instanceof Error ? err.message : 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

/**
 * POST endpoint to create a new permit history for a property
 * Maps to Django's /<uuid:property_id>/permits/create/ endpoint
 */
export async function POST({ params, request, cookies, url }: RequestEvent) {
  try {
    const propertyId = params.id;
    const permitData = await request.json();
    
    // Create permit history
    const response = await apiPost(
      cookies,
      `/api/properties/${propertyId}/permits/create/`,
      permitData,
      {},
      url.pathname
    );
    
    return json(response.data, { status: response.status });
  } catch (error) {
    console.error(`Error creating permit for property ${params.id}:`, error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Failed to create permit';
      
    return json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
