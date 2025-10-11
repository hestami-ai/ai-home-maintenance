import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { Cookies } from '@sveltejs/kit';
import { apiPost, apiDelete } from '$lib/server/api';
import type { Property } from '$lib/types';
import { rewriteStaticMediaUrls } from '$lib/server/utils';

/**
 * Server-side load function for properties page
 * This uses the consolidated API endpoint instead of directly calling Django
 */
export const load: PageServerLoad = async ({ cookies, url, fetch, depends }) => {
  // Mark this load function as depending on 'properties' data
  // This allows it to be invalidated when properties change
  depends('properties');
  
  console.log('Fetching properties from API endpoint');
  
  try {
    // Call our consolidated API endpoint
    const response = await fetch('/api/properties', {
      headers: {
        // Pass cookies for authentication
        cookie: Object.entries(cookies.getAll())
          .map(([name, value]) => `${name}=${value}`)
          .join('; ')
      }
    });
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }
    
    // Parse the properties data
    const data = await response.json();
    
    // Apply static media URL rewriting
    const rewrittenData = rewriteStaticMediaUrls(data);
    
    return rewrittenData;
  } catch (err) {
    console.error('Error fetching properties:', err);
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
