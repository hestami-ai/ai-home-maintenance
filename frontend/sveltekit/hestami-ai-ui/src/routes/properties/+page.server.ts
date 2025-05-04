import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { Cookies } from '@sveltejs/kit';
import { apiGet, apiPost, apiDelete } from '$lib/server/api';
import type { Property, PropertyInput, Media } from '$lib/types';
import { SVELTE_KIT_DJANGO_API_BASE_URL } from '$env/static/private';

// Use the environment variable for the Django API base URL
const DJANGO_BASE_URL = SVELTE_KIT_DJANGO_API_BASE_URL || 'http://localhost:8050';

// Using centralized API utility for Django backend communication

/**
 * Server-side load function for properties page
 * This ensures API calls to Django backend happen only on the server
 */
export const load: PageServerLoad = async ({ cookies, url, depends }: { cookies: Cookies; url: URL; depends: Function }) => {
  // Mark this load function as depending on 'properties' data
  // This allows it to be invalidated when properties change
  depends('properties');
  
  console.log('Attempting to fetch properties from Django API');
  
  try {
    // Use the centralized API utility to fetch properties
    // This handles authentication, error handling, and redirects automatically
    const propertiesResponse = await apiGet<Property[]>(cookies, '/api/properties/', {}, url.pathname);
    
    // Log success for debugging
    console.log(`Successfully fetched ${propertiesResponse.data.length} properties`);
    
    // Fetch media for each property
    const propertiesWithMedia = await Promise.all(
      propertiesResponse.data.map(async (property) => {
        try {
          // Fetch media for this property
          const mediaResponse = await apiGet(
            cookies, 
            `/api/media/properties/${property.id}/`, 
            {}, 
            url.pathname
          );
          
          // Find the preferred exterior street view image
          const exteriorStreetViewImage = mediaResponse.data.find(
            (media: Media) => 
              media.media_type === 'IMAGE' && 
              media.location_type === 'EXTERIOR' && 
              media.location_sub_type === 'STREET_VIEW' && 
              !media.is_deleted
          );
          
          // If no exterior street view, fall back to any exterior image
          const exteriorImage = !exteriorStreetViewImage ? mediaResponse.data.find(
            (media: Media) => 
              media.media_type === 'IMAGE' && 
              media.location_type === 'EXTERIOR' && 
              !media.is_deleted
          ) : null;
          
          // If no exterior image at all, fall back to any image
          const anyImage = (!exteriorStreetViewImage && !exteriorImage) ? mediaResponse.data.find(
            (media: Media) => 
              media.media_type === 'IMAGE' && 
              !media.is_deleted
          ) : null;
          
          // Select the best available image based on our priority
          const featuredImage = exteriorStreetViewImage || exteriorImage || anyImage;
          
          // Return property with media information
          return {
            ...property,
            // Use file_url which already contains the full URL with authentication tokens
            featuredImage: featuredImage ? featuredImage.file_url : null,
            // Keep all media items for potential use in the property details page
            media: mediaResponse.data
          };
        } catch (mediaErr) {
          console.error(`Error fetching media for property ${property.id}:`, mediaErr);
          // If media fetch fails, return property without media
          return {
            ...property,
            featuredImage: null,
            media: []
          };
        }
      })
    );
    
    // Return the properties data with media
    return { properties: propertiesWithMedia };
  } catch (err) {
    // The apiGet function will handle authentication errors and redirects
    // This catch block is only for unexpected errors that weren't handled
    console.error('Unexpected error in properties load function:', err);
    throw error(500, 'An unexpected error occurred while loading properties');
  }
};

/**
 * Server actions for properties page
 */
export const actions: Actions = {
  // Create a new property
  createProperty: async ({ cookies, request, url }: { cookies: Cookies; request: Request; url: URL }) => {
    try {
      // Get the form data and parse the property data JSON
      const formData = await request.formData();
      const propertyData = JSON.parse(formData.get('propertyData') as string);
      
      // Use the server-side API utility to create the property
      const response = await apiPost(
        cookies,
        '/api/properties/create/',
        propertyData,
        {},
        url.pathname
      );
      
      // Return success response with the created property
      return {
        success: true,
        property: response.data
      };
    } catch (error) {
      console.error('Error creating property:', error);
      
      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message.includes('Authentication') || error.message.includes('Unauthorized')) {
          return fail(401, { 
            success: false, 
            message: 'Authentication required' 
          });
        }
      }
      
      // Return error response
      return fail(500, {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create property'
      });
    }
  },
  
  // Delete a property
  deleteProperty: async ({ cookies, request, url }: { cookies: Cookies; request: Request; url: URL }) => {
    try {
      // Get the property ID from the form data
      const formData = await request.formData();
      const propertyId = formData.get('propertyId') as string;
      
      if (!propertyId) {
        return fail(400, {
          success: false,
          message: 'Property ID is required'
        });
      }
      
      // Use the server-side API utility to delete the property
      // The correct endpoint for deleting a property is /api/properties/{id}/delete/
      await apiDelete(
        cookies,
        `/api/properties/${propertyId}/delete/`,
        {},
        url.pathname
      );
      
      // Return success response
      return {
        success: true,
        message: 'Property deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting property:', error);
      
      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message.includes('Authentication') || error.message.includes('Unauthorized')) {
          return fail(401, { 
            success: false, 
            message: 'Authentication required' 
          });
        }
      }
      
      // Return error response
      return fail(500, {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete property'
      });
    }
  }
};
