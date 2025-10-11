import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { apiGet } from '$lib/server/api';
import type { Property, Media } from '$lib/types';
import { rewriteStaticMediaUrls } from '$lib/server/utils';

/**
 * Server-side load function for property details page
 * Fetches property data and media from Django backend
 */
export const load: PageServerLoad = async ({ params, cookies, url }) => {
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
    console.log(`Successfully fetched property details for ID: ${propertyId}`);
    
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
      
      // Find the preferred exterior street view image for the main image
      const exteriorStreetViewImage = rewrittenMediaData.find(
        (media: Media) => 
          media.media_type === 'IMAGE' && 
          media.location_type === 'EXTERIOR' && 
          media.location_sub_type === 'STREET_VIEW' && 
          !media.is_deleted
      );
      
      // If no exterior street view, fall back to any exterior image
      const exteriorImage = !exteriorStreetViewImage ? rewrittenMediaData.find(
        (media: Media) => 
          media.media_type === 'IMAGE' && 
          media.location_type === 'EXTERIOR' && 
          !media.is_deleted
      ) : null;
      
      // If no exterior image at all, fall back to any image
      const anyImage = (!exteriorStreetViewImage && !exteriorImage) ? rewrittenMediaData.find(
        (media: Media) => 
          media.media_type === 'IMAGE' && 
          !media.is_deleted
      ) : null;
      
      // Select the best available image based on our priority
      const featuredImage = exteriorStreetViewImage || exteriorImage || anyImage;
      
      // Return property with media information
      return { 
        property: {
          ...propertyResponse.data,
          // Use file_url which already contains the full URL with authentication tokens
          featuredImage: featuredImage ? featuredImage.file_url : null,
          // Keep all media items for use in the property details page
          media: rewrittenMediaData
        }
      };
    } catch (mediaErr) {
      console.error(`Error fetching media for property ${propertyId}:`, mediaErr);
      // If media fetch fails, return property without media
      return { 
        property: {
          ...propertyResponse.data,
          featuredImage: null,
          media: []
        }
      };
    }
  } catch (err) {
    // The apiGet function will handle authentication errors and redirects
    // This catch block is only for unexpected errors that weren't handled
    console.error(`Error fetching property details for ID ${propertyId}:`, err);
    throw error(500, 'An unexpected error occurred while loading property details');
  }
};
