import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiGet } from '$lib/server/api';

/**
 * Specific handler for the user profile endpoint
 * This proxy forwards profile requests from the SvelteKit frontend to the Django backend
 * to avoid CORS issues with direct browser-to-Django API calls
 */

export const GET: RequestHandler = async ({ cookies, url }) => {
    try {
        console.log('Profile endpoint called');
        
        // Use the apiGet function to make the request
        // This will handle authentication and error handling
        const response = await apiGet(cookies, '/api/users/profile/', {}, url.pathname);
        
        // Return the data from the response
        return json(response.data, { status: response.status });
    } catch (error) {
        console.error('Profile API proxy error:', error);
        
        // If this is an authentication error, it will be handled by apiGet
        // For other errors, return a generic error response
        return json({ error: 'Failed to fetch user profile' }, { status: 500 });
    }
};

