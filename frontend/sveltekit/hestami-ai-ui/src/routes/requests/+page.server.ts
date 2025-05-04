import { apiGet, apiPost } from '$lib/server/api';
import type { Property, ServiceRequest } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ cookies, depends, url }) => {
    // Create a dependency tag for this load function
    depends('app:requests');
    
    try {
        // Let the API utility handle authentication
        // It will automatically redirect if not authenticated
        // No need to manually check for session cookie
        const resp = await apiGet<Property[]>(cookies, '/api/properties/', {}, '/requests');
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
            const priority = formData.get('priority')?.toString() || 'medium';
            
            // Validate required fields
            if (!title || !description || !propertyId) {
                return fail(400, {
                    success: false,
                    message: 'Missing required fields',
                    fields: { title, description, propertyId }
                });
            }
            
            // Create the service request payload with properly formatted values
            // Convert values to uppercase to match Django's TextChoices format
            const serviceRequestData = {
                title,
                description,
                // Convert category to uppercase to match Django's ServiceCategory choices
                category: category.toUpperCase(),
                property: propertyId,
                // Convert priority to uppercase to match Django's Priority choices
                priority: priority.toUpperCase(),
                // Use PENDING instead of 'pending' to match Django's Status choices
                status: 'PENDING'
            };
            
            // Send the request to the backend API
            await apiPost<ServiceRequest>(
                cookies,
                `/api/services/requests/create/`,
                serviceRequestData,
                {},
                url.pathname
            );
            
            // Invalidate the requests data to refresh the list
            return {
                success: true,
                message: 'Service request created successfully',
                // Add a timestamp to force SvelteKit to invalidate the data
                timestamp: new Date().getTime()
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
