import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { apiPatch } from '$lib/server/api';

/**
 * PATCH endpoint to update media metadata
 * Maps to Django's /api/media/<media_id>/update/ endpoint
 */
export async function PATCH({ params, request, cookies, url }: RequestEvent) {
  try {
    const mediaId = params.id;
    const updateData = await request.json();
    
    // Forward to Django backend
    const response = await apiPatch(
      cookies,
      `/api/media/${mediaId}/update/`,
      updateData,
      {},
      url.pathname
    );
    
    return json(response.data, { status: response.status });
  } catch (error) {
    console.error(`Error updating media ${params.id}:`, error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Failed to update media';
      
    return json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
