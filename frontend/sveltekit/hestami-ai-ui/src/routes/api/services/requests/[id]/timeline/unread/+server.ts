import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiGet } from '$lib/server/api';

// GET unread timeline entries count
export const GET: RequestHandler = async ({ params, cookies, url }) => {
    try {
        const requestId = params.id;
        const endpoint = `/api/services/requests/${requestId}/timeline/unread/`;
        const returnUrl = url.pathname;
        
        const response = await apiGet(cookies, endpoint, {}, returnUrl);
        
        return json(response.data);
    } catch (err) {
        console.error('Error fetching unread count:', err);
        throw err; // apiGet already handles error formatting
    }
};
