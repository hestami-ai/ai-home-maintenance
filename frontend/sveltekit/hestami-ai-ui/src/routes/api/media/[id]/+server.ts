import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiDelete } from '$lib/server/api';

/**
 * DELETE /api/media/[id]
 * Soft delete a media file
 */
export const DELETE: RequestHandler = async ({ params, cookies }) => {
	const { id } = params;

	try {
		// Forward the DELETE request to Django
		await apiDelete(cookies, `/api/media/${id}/`, {}, '/properties');

		return json({ success: true, message: 'Media deleted successfully' });
	} catch (err: any) {
		console.error('Error deleting media:', err);
		throw error(err.status || 500, err.message || 'Failed to delete media');
	}
};
