import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { apiGet } from '$lib/server/api';
import type { ServiceRequest, Media } from '$lib/types';
import { rewriteStaticMediaUrls } from '$lib/server/utils';

/**
 * Server-side load function for service request details page
 * Fetches service request data and related media from Django backend
 */
export const load: PageServerLoad = async ({ params, cookies, url, depends }) => {
  // Create a dependency tag for this load function
  depends('app:requests:details');
  
  const requestId = params.id;
  
  if (!requestId) {
    throw error(400, 'Service Request ID is required');
  }
  
  try {
    // Use the centralized API utility to fetch service request details
    const requestResponse = await apiGet<ServiceRequest>(
      cookies, 
      `/api/services/requests/${requestId}/`, 
      {}, 
      url.pathname
    );
    
    // Log success for debugging
    console.log(`Successfully fetched service request details for ID: ${requestId}`);
    
    // Fetch media for this service request
    let mediaResponse;
    try {
      // Use the correct endpoint for service request media
      mediaResponse = await apiGet<Media[]>(
        cookies,
        `/api/media/services/requests/${requestId}/`,
        {},
        url.pathname
      );
      
      // Apply static media URL rewriting to media data
      const rewrittenMediaData = rewriteStaticMediaUrls(mediaResponse.data) as Media[];
      
      // Return both the service request and its media
      return {
        serviceRequest: requestResponse.data,
        media: rewrittenMediaData || [],
        error: null
      };
    } catch (mediaError) {
      console.error('Error fetching service request media:', mediaError);
      
      // Return service request without media
      return {
        serviceRequest: requestResponse.data,
        media: [],
        error: 'Failed to load media attachments'
      };
    }
  } catch (requestError: any) {
    console.error('Error fetching service request details:', requestError);
    
    // Handle authentication errors
    if (requestError?.status === 302 || requestError?.location || 
        requestError?.message?.includes('Authentication') || 
        requestError?.message?.includes('Unauthorized') || 
        requestError?.status === 401) {
      console.log('Authentication failed, redirecting to login page');
      throw redirect(302, `/login?returnUrl=${encodeURIComponent(url.pathname)}`);
    }
    
    // Handle specific error cases
    if (requestError.status === 404) {
      throw error(404, 'Service request not found');
    }
    
    // For other errors, throw a generic error
    throw error(500, 'Failed to load service request details');
  }
};
