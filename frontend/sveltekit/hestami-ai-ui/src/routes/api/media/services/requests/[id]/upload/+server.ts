import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as auth from '$lib/server/auth';

// POST to upload media for a service request
export const POST: RequestHandler = async ({ params, request, cookies, url }) => {
    try {
        const requestId = params.id;
        const returnUrl = url.pathname;
        
        // Check authentication
        const sessionId = auth.checkAuthentication(cookies, returnUrl);
        
        // Forward the multipart form data to the backend
        const formData = await request.formData();
        
        // Use apiRequest directly since we need to handle FormData
        const endpoint = `/api/media/services/requests/${requestId}/upload/`;
        const response = await auth.apiRequest(sessionId, endpoint, {
            method: 'POST',
            // Don't set Content-Type here, it will be set automatically with the correct boundary
            body: formData
        });

        if (!response.ok) {
            throw error(response.status, response.statusText || 'Failed to upload media');
        }

        const data = await response.json();
        return json(data);
    } catch (err) {
        console.error('Error uploading media:', err);
        return auth.handleApiError(err, url.pathname);
    }
};
