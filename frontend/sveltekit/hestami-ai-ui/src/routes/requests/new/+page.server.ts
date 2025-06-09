import { apiGet, apiPost } from '$lib/server/api';
import * as auth from '$lib/server/auth';
import type { Property, ServiceRequest } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { ServiceCategory, ServicePriority, ServiceStatus } from '$lib/types';

/**
 * Server-side load function for new service request page
 * Fetches properties for the property selection dropdown
 */
export const load: PageServerLoad = async ({ cookies, depends, url }) => {
    // Create a dependency tag for this load function
    depends('app:requests:new');
    
    try {
        // Fetch properties for the dropdown
        const resp = await apiGet<Property[]>(cookies, '/api/properties/', {}, url.pathname);
        return {
            properties: resp.data || [],
            error: null
        };
    } catch (e: any) {
        // Check if this is an authentication error
        if (e?.status === 302 || e?.location || 
            e?.message?.includes('Authentication') || 
            e?.message?.includes('Unauthorized') || 
            e?.status === 401) {
            console.log('Authentication failed, redirecting to login page');
            throw redirect(302, `/login?returnUrl=${encodeURIComponent(url.pathname)}`);
        }
        
        // For other errors, return empty properties with error message
        return {
            properties: [],
            error: e?.message || 'Failed to load data'
        };
    }
};

export const actions: Actions = {
    createServiceRequest: async ({ cookies, request, url }) => {
        try {
            const formData = await request.formData();
            const title = formData.get('title')?.toString() || '';
            const description = formData.get('description')?.toString() || '';
            const category = formData.get('category')?.toString() || '';
            const propertyId = formData.get('property_id')?.toString() || '';
            const priority = formData.get('priority')?.toString() || '';
            
            // Get the files from the form data
            const fileEntries = Array.from(formData.entries())
                .filter(([key, value]) => value instanceof File && (value as File).size > 0);
            
            // Validate required fields
            if (!title || !description || !propertyId) {
                return fail(400, {
                    success: false,
                    message: 'Missing required fields',
                    fields: { title, description, propertyId }
                });
            }
            
            // Create the service request payload
            const serviceRequestData = {
                title,
                description,
                category,
                property: propertyId,
                priority,
                status: ServiceStatus.PENDING
            };
            
            // Step 1: Create the service request
            const response = await apiPost<ServiceRequest>(
                cookies,
                `/api/services/requests/create/`,
                serviceRequestData,
                {},
                url.pathname
            );
            
            // If we have a valid service request ID and files to upload
            if (response.data?.id && fileEntries.length > 0) {
                // Step 2: Upload media files
                const serviceRequestId = response.data.id;
                
                // Upload each file
                for (const [_, file] of fileEntries) {
                    if (file instanceof File) {
                        // Create a new FormData for each file upload
                        const mediaFormData = new FormData();
                        mediaFormData.append('file', file);
                        mediaFormData.append('title', file.name);
                        
                        try {
                            // Upload the file to the service request media endpoint using FormData
                            // The correct endpoint is /api/media/services/requests/{id}/upload/
                            const sessionId = auth.checkAuthentication(cookies, url.pathname);
                            const response = await auth.apiRequest(sessionId, `/api/media/services/requests/${serviceRequestId}/upload/`, {
                                method: 'POST',
                                body: mediaFormData,
                                // Don't set Content-Type header - browser will set it with boundary
                            });
                            
                            if (!response.ok) {
                                throw new Error(`Failed to upload media: ${response.statusText}`);
                            }
                        } catch (uploadError) {
                            console.error(`Error uploading file ${file.name}:`, uploadError);
                            // Continue with other files even if one fails
                        }
                    }
                }
                
                // Redirect to the service request details page with success message
                return {
                    success: true,
                    message: 'Service request created successfully',
                    requestId: serviceRequestId,
                    redirect: `/requests/${serviceRequestId}`
                };
            }
            
            // If no files to upload but we have a service request ID
            if (response.data?.id) {
                // Redirect to the service request details page
                return {
                    success: true,
                    message: 'Service request created successfully',
                    requestId: response.data.id,
                    redirect: `/requests/${response.data.id}`
                };
            }
            
            // If no ID was returned, return a generic success
            return {
                success: true,
                message: 'Service request created successfully',
                redirect: '/requests'
            };
        } catch (error: any) {
            console.error('Error creating service request:', error);
            
            // Handle authentication errors
            if (error?.status === 302 || error?.location || 
                error?.message?.includes('Authentication') || 
                error?.message?.includes('Unauthorized') || 
                error?.status === 401) {
                console.log('Authentication failed, redirecting to login page');
                throw redirect(302, `/login?returnUrl=${encodeURIComponent(url.pathname)}`);
            }
            
            // Handle other specific error cases
            if (error instanceof Error) {
                // Log the specific error for debugging
                console.error('Error details:', error.message);
                
                return fail(500, {
                    success: false,
                    message: error.message
                });
            }
            return fail(500, {
                success: false,
                message: 'An unexpected error occurred'
            });
        }
    }
};
