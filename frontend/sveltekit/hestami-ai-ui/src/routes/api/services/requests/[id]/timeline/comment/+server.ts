import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiPost } from '$lib/server/api';

/**
 * Handle POST requests to create a new comment in the timeline
 */
export const POST: RequestHandler = async ({ params, cookies, url, request }) => {
    try {
        const requestId = params.id;
        const body = await request.json();
        const endpoint = `/api/services/requests/${requestId}/timeline/comment/`;
        const returnUrl = url.pathname;
        
        const response = await apiPost(cookies, endpoint, body, {}, returnUrl);
        
        // Return just the data part of the response to match client expectations
        return json(response.data, { status: 201 });
    } catch (error) {
        console.error('Error creating timeline comment:', error);
        return json({ error: 'Failed to create timeline comment' }, { status: 500 });
    }
};
