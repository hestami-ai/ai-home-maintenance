import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { apiGet } from '$lib/server/api';
import type { Property, Media } from '$lib/types';
import { rewriteStaticMediaUrls } from '$lib/server/utils';

/**
 * Server-side load function for property edit page
 * Fetches property data, media, and metadata options from Django backend
 */
export const load: PageServerLoad = async ({ params, cookies, url, parent }) => {
  const propertyId = params.id;
  
  if (!propertyId) {
    throw error(400, 'Property ID is required');
  }

  // Get parent data to check authentication
  const parentData = await parent();
  
  if (!parentData.user) {
    throw redirect(302, `/auth/login?redirect=${encodeURIComponent(url.pathname)}`);
  }
  
  try {
    // Fetch property details
    const propertyResponse = await apiGet<Property>(
      cookies, 
      `/api/properties/${propertyId}/`, 
      {}, 
      url.pathname
    );
    
    const property = propertyResponse.data;
    
    // Check if user has edit permission
    // Property owner always has edit permission
    // Other users need explicit can_edit permission (checked by backend)
    
    console.log(`Loading property edit page for ID: ${propertyId}`);
    
    // Fetch media for this property
    let media: Media[] = [];
    try {
      const mediaResponse = await apiGet<Media[]>(
        cookies, 
        `/api/media/properties/${propertyId}/`, 
        {}, 
        url.pathname
      );
      
      // Apply static media URL rewriting
      media = rewriteStaticMediaUrls(mediaResponse.data) as Media[];
      console.log(`Loaded ${media.length} media items for property edit`);
    } catch (mediaErr) {
      console.error(`Error fetching media for property ${propertyId}:`, mediaErr);
      // Continue without media if fetch fails
    }
    
    // Fetch media type and location options for dropdowns
    let mediaTypes: any[] = [];
    let locationTypes: any[] = [];
    let descriptivesSchema: any = {};
    let fieldChoices: any = {};
    
    try {
      const [typesResponse, locationsResponse, schemaResponse, choicesResponse] = await Promise.all([
        apiGet(cookies, '/api/media/types/', {}, url.pathname),
        apiGet(cookies, '/api/media/locations/', {}, url.pathname),
        apiGet(cookies, '/api/properties/schema/descriptives/', {}, url.pathname),
        apiGet(cookies, '/api/properties/schema/descriptives/choices/', {}, url.pathname)
      ]);
      
      mediaTypes = typesResponse.data;
      locationTypes = locationsResponse.data;
      descriptivesSchema = schemaResponse.data.schema;
      fieldChoices = choicesResponse.data;
    } catch (optionsErr) {
      console.error('Error fetching options:', optionsErr);
      // Continue with empty options if fetch fails
    }
    
    return { 
      property,
      media,
      mediaTypes,
      locationTypes,
      descriptivesSchema,
      fieldChoices
    };
  } catch (err: any) {
    console.error(`Error loading property edit page for ID ${propertyId}:`, err);
    
    // Handle specific error cases
    if (err.status === 403) {
      throw error(403, 'You do not have permission to edit this property');
    }
    if (err.status === 404) {
      throw error(404, 'Property not found');
    }
    
    throw error(500, 'An unexpected error occurred while loading property for editing');
  }
};
