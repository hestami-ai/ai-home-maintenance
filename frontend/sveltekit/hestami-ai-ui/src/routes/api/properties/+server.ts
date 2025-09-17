import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { apiGet, apiPost } from '$lib/server/api';
import type { Property, Media } from '$lib/types';
import { logApiRequest, logApiResponse, logApiError } from '$lib/server/logger';
import { getClientInfo } from '$lib/server/utils';
import { processMobileSession } from '$lib/server/auth/mobile';

/**
 * GET endpoint to retrieve properties with media
 * This can be used by both the web UI and iOS app
 */
export async function GET({ cookies, url, request }: RequestEvent) {
  // Process mobile session if applicable
  const isMobileSession = processMobileSession(request, cookies);
  
  // Get client information for logging
  const clientInfo = getClientInfo(request);
  
  // Log the request with appropriate context
  logApiRequest(
    cookies, 
    request, 
    url, 
    `Properties list request from ${clientInfo.isMobile ? 'mobile' : 'web'} client${isMobileSession ? ' (using header session)' : ''}`
  );
  
  try {
    // Use the centralized API utility to fetch properties
    const propertiesResponse = await apiGet<Property[]>(cookies, '/api/properties/', {}, url.pathname);
    
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
            featuredImage: featuredImage ? featuredImage.file_url : null,
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
    
    // Log successful response
    logApiResponse(cookies, request, url, 200, { count: propertiesWithMedia.length });
    return json({ properties: propertiesWithMedia });
  } catch (err) {
    // Log error with structured format
    logApiError(cookies, request, url, err);
    return json(
      { error: err instanceof Error ? err.message : 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

/**
 * POST endpoint to create a new property
 * Maps to Django's /api/properties/create/ endpoint
 */
export async function POST({ request, cookies, url }: RequestEvent) {
  // Process mobile session if applicable
  const isMobileSession = processMobileSession(request, cookies);
  
  // Get client information for logging
  const clientInfo = getClientInfo(request);
  
  // Log the request with appropriate context
  logApiRequest(
    cookies, 
    request, 
    url, 
    `Property creation request from ${clientInfo.isMobile ? 'mobile' : 'web'} client${isMobileSession ? ' (using header session)' : ''}`
  );
  
  try {
    // Extract property data from request
    const propertyData = await request.json();
    
    // Forward to Django backend using server-side apiPost
    const response = await apiPost(
      cookies,
      '/api/properties/create/',
      propertyData,
      {},
      url.pathname // Return URL if authentication fails
    );
    
    // Log successful response
    logApiResponse(cookies, request, url, response.status);
    
    // Return the response with appropriate status
    return json(response.data, { status: response.status });
  } catch (error) {
    // Log error with structured format
    logApiError(cookies, request, url, error);
    
    // Use type guard to safely access error properties
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Failed to create property';
      
    return json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
