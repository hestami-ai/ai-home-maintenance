import { error } from '@sveltejs/kit';
import { apiGet } from '$lib/server/api';
import type { Property, Media } from '$lib/types';
import { rewriteStaticMediaUrls } from '$lib/server/utils';

/**
 * Server-side load function for virtual tour page
 * Fetches property data and filters for panorama media
 */
export const load = async ({ params, cookies, url, parent }) => {
  // Get parent data (includes user auth info)
  const parentData = await parent();
  const propertyId = params.id;
  
  if (!propertyId) {
    throw error(400, 'Property ID is required');
  }
  
  try {
    // Use the centralized API utility to fetch property details
    const propertyResponse = await apiGet<Property>(
      cookies, 
      `/api/properties/${propertyId}/`, 
      {}, 
      url.pathname
    );
    
    // Log success for debugging
    console.log(`Successfully fetched property details for virtual tour, ID: ${propertyId}`);
    
    // Fetch media for this property
    try {
      const mediaResponse = await apiGet<Media[]>(
        cookies, 
        `/api/media/properties/${propertyId}/`, 
        {}, 
        url.pathname
      );
      
      console.log(`Successfully fetched ${mediaResponse.data.length} media items for property ID: ${propertyId}`);
      
      // Apply static media URL rewriting to media data
      const rewrittenMediaData = rewriteStaticMediaUrls(mediaResponse.data) as Media[];
      
      // Filter for panorama/360 images only
      // Panoramas are typically IMAGE type with specific sub_types like 'PANORAMA', '360', 'VIRTUAL_TOUR'
      const panoramaMedia = rewrittenMediaData.filter(
        (media: Media) => 
          media.media_type === 'IMAGE' &&
          (media.media_sub_type?.toUpperCase().includes('PANORAMA') || 
           media.media_sub_type?.toUpperCase().includes('360') || 
           media.media_sub_type?.toUpperCase().includes('VIRTUAL_TOUR')) &&
          !media.is_deleted
      );
      
      console.log(`Found ${panoramaMedia.length} panorama images for property ID: ${propertyId}`);
      
      // Return property with panorama media, spread parent data
      return { 
        ...parentData,
        property: propertyResponse.data,
        panoramas: panoramaMedia
      };
    } catch (mediaErr) {
      console.error(`Error fetching media for property ${propertyId}:`, mediaErr);
      // If media fetch fails, return property without panoramas
      return { 
        ...parentData,
        property: propertyResponse.data,
        panoramas: []
      };
    }
  } catch (err) {
    // The apiGet function will handle authentication errors and redirects
    // This catch block is only for unexpected errors that weren't handled
    console.error(`Error fetching property details for virtual tour, ID ${propertyId}:`, err);
    throw error(500, 'An unexpected error occurred while loading virtual tour');
  }
};
