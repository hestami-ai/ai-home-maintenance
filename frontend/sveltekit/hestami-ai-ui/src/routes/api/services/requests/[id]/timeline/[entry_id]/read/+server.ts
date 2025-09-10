import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiPost } from '$lib/server/api';

// POST to mark a timeline entry as read
export const POST: RequestHandler = async ({ params, cookies, url }) => {
    try {
        const { id: requestId, entry_id: entryId } = params;
        const endpoint = `/api/services/requests/${requestId}/timeline/${entryId}/read/`;
        const returnUrl = url.pathname;
        
        // Empty body for read receipt
        await apiPost(cookies, endpoint, {}, {}, returnUrl);
        
        return json({ success: true });
    } catch (err) {
        console.error('Error marking timeline entry as read:', err);
        throw err; // apiPost already handles error formatting
    }
};
