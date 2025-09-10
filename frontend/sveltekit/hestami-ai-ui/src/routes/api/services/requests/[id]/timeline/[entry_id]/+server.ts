import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiPut, apiDelete } from '$lib/server/api';

// PATCH to update a timeline entry (edit comment)
export const PATCH: RequestHandler = async ({ params, request, cookies, url }) => {
    try {
        const { id: requestId, entry_id: entryId } = params;
        const body = await request.json();
        const endpoint = `/api/services/requests/${requestId}/timeline/${entryId}/`;
        const returnUrl = url.pathname;
        
        const response = await apiPut(cookies, endpoint, body, {}, returnUrl);
        
        return json(response.data);
    } catch (err) {
        console.error('Error updating timeline entry:', err);
        throw err; // apiPut already handles error formatting
    }
};

// DELETE to soft delete a timeline entry
export const DELETE: RequestHandler = async ({ params, cookies, url }) => {
    try {
        const { id: requestId, entry_id: entryId } = params;
        const endpoint = `/api/services/requests/${requestId}/timeline/${entryId}/`;
        const returnUrl = url.pathname;
        
        const response = await apiDelete(cookies, endpoint, {}, returnUrl);
        
        return json({ success: true });
    } catch (err) {
        console.error('Error deleting timeline entry:', err);
        throw err; // apiDelete already handles error formatting
    }
};
