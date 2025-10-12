import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { apiGet, apiPut, apiPatch, apiDelete } from '$lib/server/api';
import type { Property, Media } from '$lib/types';

/**
 * GET endpoint to retrieve a specific property with its media
 * Maps to Django's /<uuid:property_id>/ endpoint
 */
export async function GET({ params, cookies, url }: RequestEvent) {
  try {
    const propertyId = params.id;
    
    // Fetch property details
    const propertyResponse = await apiGet<Property>(
      cookies,
      `/api/properties/${propertyId}/`,
      {},
      url.pathname
    );
    
    // Fetch media for this property
    const mediaResponse = await apiGet(
      cookies, 
      `/api/media/properties/${propertyId}/`, 
      {}, 
      url.pathname
    );
    
    // Process media to find featured image using the same logic as the list endpoint
    const exteriorStreetViewImage = mediaResponse.data.find(
      (media: Media) => 
        media.media_type === 'IMAGE' && 
        media.location_type === 'EXTERIOR' && 
        media.location_sub_type === 'STREET_VIEW' && 
        !media.is_deleted
    );
    
    const exteriorImage = !exteriorStreetViewImage ? mediaResponse.data.find(
      (media: Media) => 
        media.media_type === 'IMAGE' && 
        media.location_type === 'EXTERIOR' && 
        !media.is_deleted
    ) : null;
    
    const anyImage = (!exteriorStreetViewImage && !exteriorImage) ? mediaResponse.data.find(
      (media: Media) => 
        media.media_type === 'IMAGE' && 
        !media.is_deleted
    ) : null;
    
    const featuredImage = exteriorStreetViewImage || exteriorImage || anyImage;
    
    // Return property with media information
    return json({
      property: {
        ...propertyResponse.data,
        featuredImage: featuredImage ? featuredImage.file_url : null,
        media: mediaResponse.data
      }
    });
  } catch (err) {
    console.error(`Error fetching property ${params.id}:`, err);
    return json(
      { error: err instanceof Error ? err.message : 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

/**
 * PUT endpoint to update a property
 * Maps to Django's /<uuid:property_id>/update/ endpoint
 */
export async function PUT({ params, request, cookies, url }: RequestEvent) {
  try {
    const propertyId = params.id;
    const propertyData = await request.json();
    
    // Forward to Django backend
    const response = await apiPut(
      cookies,
      `/api/properties/${propertyId}/update/`,
      propertyData,
      {},
      url.pathname
    );
    
    return json(response.data, { status: response.status });
  } catch (error) {
    console.error(`Error updating property ${params.id}:`, error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Failed to update property';
      
    return json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * PATCH endpoint to partially update a property
 * Maps to Django's /<uuid:property_id>/update/ endpoint
 */
export async function PATCH({ params, request, cookies, url }: RequestEvent) {
  try {
    const propertyId = params.id;
    const propertyData = await request.json();
    
    // Forward to Django backend
    const response = await apiPatch(
      cookies,
      `/api/properties/${propertyId}/update/`,
      propertyData,
      {},
      url.pathname
    );
    
    return json(response.data, { status: response.status });
  } catch (error) {
    console.error(`Error updating property ${params.id}:`, error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Failed to update property';
      
    return json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * DELETE endpoint to delete a property
 * Maps to Django's /<uuid:property_id>/delete/ endpoint
 */
export async function DELETE({ params, cookies, url }: RequestEvent) {
  try {
    const propertyId = params.id;
    
    // Forward to Django backend
    const response = await apiDelete(
      cookies,
      `/api/properties/${propertyId}/delete/`,
      {},
      url.pathname
    );
    
    return json(
      { success: true, message: 'Property deleted successfully' },
      { status: response.status }
    );
  } catch (error) {
    console.error(`Error deleting property ${params.id}:`, error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Failed to delete property';
      
    return json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
