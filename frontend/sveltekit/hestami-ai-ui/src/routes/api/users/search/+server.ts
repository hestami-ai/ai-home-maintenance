import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiGet } from '$lib/server/api';

// GET user search for @mentions
export const GET: RequestHandler = async ({ url, cookies }) => {
    try {
        // Get search query from URL
        const query = url.searchParams.get('q') || '';
        const endpoint = `/users/search/?q=${encodeURIComponent(query)}`;
        const returnUrl = url.pathname;
        
        const response = await apiGet(cookies, endpoint, {}, returnUrl);
        
        return json(response.data);
    } catch (err) {
        console.error('Error searching users:', err);
        throw err; // apiGet already handles error formatting
    }
};
