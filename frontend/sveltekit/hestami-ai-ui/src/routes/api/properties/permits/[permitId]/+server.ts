import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { apiGet, apiPut, apiDelete } from '$lib/server/api';

/**
 * GET endpoint to retrieve a specific permit history
 * Maps to Django's /permits/<uuid:permit_id>/ endpoint
 */
export async function GET({ params, cookies, url }: RequestEvent) {
  try {
    const permitId = params.permitId;
    
    // Fetch permit details
    const response = await apiGet(
      cookies,
      `/api/properties/permits/${permitId}/`,
      {},
      url.pathname
    );
    
    return json(response.data);
  } catch (err) {
    console.error(`Error fetching permit ${params.permitId}:`, err);
    return json(
      { error: err instanceof Error ? err.message : 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

/**
 * PUT endpoint to update a permit history
 * Maps to Django's /permits/<uuid:permit_id>/update/ endpoint
 */
export async function PUT({ params, request, cookies, url }: RequestEvent) {
  try {
    const permitId = params.permitId;
    const permitData = await request.json();
    
    // Update permit
    const response = await apiPut(
      cookies,
      `/api/properties/permits/${permitId}/update/`,
      permitData,
      {},
      url.pathname
    );
    
    return json(response.data, { status: response.status });
  } catch (error) {
    console.error(`Error updating permit ${params.permitId}:`, error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Failed to update permit';
      
    return json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * DELETE endpoint to delete a permit history
 * Maps to Django's /permits/<uuid:permit_id>/delete/ endpoint
 */
export async function DELETE({ params, cookies, url }: RequestEvent) {
  try {
    const permitId = params.permitId;
    
    // Delete permit
    const response = await apiDelete(
      cookies,
      `/api/properties/permits/${permitId}/delete/`,
      {},
      url.pathname
    );
    
    return json(
      { success: true, message: 'Permit deleted successfully' },
      { status: response.status }
    );
  } catch (error) {
    console.error(`Error deleting permit ${params.permitId}:`, error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Failed to delete permit';
      
    return json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
