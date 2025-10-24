import { json, type RequestEvent } from '@sveltejs/kit';
import { apiPost } from '$lib/server/api';
import type { PasswordChangeRequest } from '$lib/types';

/**
 * Password change endpoint proxy
 * Forwards password change requests from the SvelteKit frontend to the Django backend
 * Requires user to be authenticated and provide old password
 */

export const POST = async ({ cookies, request, url }: RequestEvent) => {
	try {
		const body = await request.json() as PasswordChangeRequest;
		
		// Validate required fields
		if (!body.old_password || !body.new_password) {
			return json(
				{ error: 'Old password and new password are required' },
				{ status: 400 }
			);
		}
		
		// Forward to Django API
		const response = await apiPost(
			cookies,
			'/api/users/password/change/',
			body,
			{},
			url.pathname
		);
		
		return json(response.data, { status: response.status });
	} catch (error) {
		console.error('Password change API proxy error:', error);
		return json(
			{ error: 'Failed to change password' },
			{ status: 500 }
		);
	}
};
