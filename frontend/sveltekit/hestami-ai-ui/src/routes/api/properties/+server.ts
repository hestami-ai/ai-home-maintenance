import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiPost } from '$lib/server/api';

export const POST: RequestHandler = async ({ request, cookies }) => {
    try {
        // Extract property data from request
        const propertyData = await request.json();
        
        // Forward to Django backend using server-side apiPost
        const response = await apiPost(
            cookies,
            '/api/properties/create/',
            propertyData,
            {},
            '/properties' // Return URL if authentication fails
        );
        
        // Return the response with appropriate status
        return json(response.data, { status: response.status });
    } catch (error) {
        console.error('Error creating property:', error);
        
        // Use type guard to safely access error properties
        const errorMessage = error instanceof Error 
            ? error.message 
            : 'Failed to create property';
            
        return json(
            { error: errorMessage },
            { status: 500 }
        );
    }
};
