import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiGet, apiPost } from '$lib/server/api';

// GET timeline entries
export const GET: RequestHandler = async ({ params, cookies, url }) => {
    try {
        const requestId = params.id;
        const endpoint = `/api/services/requests/${requestId}/timeline/`;
        const returnUrl = url.pathname;
        
        const response = await apiGet(cookies, endpoint, {}, returnUrl);
        
        return json(response.data);
    } catch (err) {
        console.error('Error fetching timeline entries:', err);
        throw err; // apiGet already handles error formatting
    }
};

// POST new timeline entry (comment)
export const POST: RequestHandler = async ({ params, request, cookies, url }) => {
    try {
        const requestId = params.id;
        const body = await request.json();
        const endpoint = `/api/services/requests/${requestId}/timeline/`;
        const returnUrl = url.pathname;
        
        const response = await apiPost(cookies, endpoint, body, {}, returnUrl);
        
        return json(response.data);
    } catch (err) {
        console.error('Error creating timeline entry:', err);
        throw err; // apiPost already handles error formatting
    }
};
