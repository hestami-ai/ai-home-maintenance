import { error, redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { apiGet } from '$lib/server/api';
import * as auth from '$lib/server/auth';
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

/**
 * Server-side actions for service request details page
 * Handles media uploads for existing service requests
 */
export const actions: Actions = {
  /**
   * Upload media files to an existing service request
   */
  uploadMedia: async ({ params, cookies, request, url }) => {
    try {
      const requestId = params.id;
      
      if (!requestId) {
        return fail(400, {
          success: false,
          message: 'Service Request ID is required'
        });
      }
      
      const formData = await request.formData();
      
      // Get files from the form data - handle both single and multiple files
      const filesEntries = formData.getAll('files');
      const title = formData.get('title') || '';
      
      // Filter to ensure we only have valid File objects
      const files = filesEntries.filter(entry => entry instanceof File && entry.size > 0) as File[];
      
      if (files.length === 0) {
        return fail(400, {
          success: false,
          message: 'No files were uploaded'
        });
      }
      
      // Upload the files
      const uploadResults = [];
      let hasErrors = false;
      
      // Process each file
      for (const file of files) {
        // Create a new FormData for each file upload
        const mediaFormData = new FormData();
        mediaFormData.append('file', file);
        mediaFormData.append('title', title.toString() || file.name);
        
        try {
          // Upload the file to the service request media endpoint using FormData
          const sessionId = auth.checkAuthentication(cookies, url.pathname);
          const response = await auth.apiRequest(sessionId, `/api/media/services/requests/${requestId}/upload/`, {
            method: 'POST',
            body: mediaFormData,
            // Don't set Content-Type header - browser will set it with boundary
          });
          
          if (!response.ok) {
            uploadResults.push({
              fileName: file.name,
              success: false,
              message: `Failed to upload: ${response.statusText}`
            });
            hasErrors = true;
          } else {
            uploadResults.push({
              fileName: file.name,
              success: true
            });
          }
        } catch (uploadError) {
          console.error(`Error uploading file ${file.name}:`, uploadError);
          uploadResults.push({
            fileName: file.name,
            success: false,
            message: uploadError instanceof Error ? uploadError.message : 'Unknown error'
          });
          hasErrors = true;
        }
      }
      
      // Return results
      return {
        success: !hasErrors,
        message: hasErrors ? 'Some files failed to upload' : 'Files uploaded successfully',
        results: uploadResults
      };
    } catch (error: any) {
      console.error('Error uploading media:', error);
      
      // Handle authentication errors
      if (error?.status === 302 || error?.location || 
          error?.message?.includes('Authentication') || 
          error?.message?.includes('Unauthorized') || 
          error?.status === 401) {
        throw redirect(302, `/login?returnUrl=${encodeURIComponent(url.pathname)}`);
      }
      
      return fail(500, {
        success: false,
        message: error?.message || 'An unexpected error occurred'
      });
    }
  }
};
