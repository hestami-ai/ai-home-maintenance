import { json, type RequestEvent } from '@sveltejs/kit';
import type { PasswordResetConfirmRequest } from '$lib/types';
import { DJANGO_API_URL } from '$env/static/private';

/**
 * Password reset confirmation endpoint proxy
 * Completes password reset process with token from email
 * Does NOT require authentication (public endpoint)
 */

export const POST = async ({ request, fetch }: RequestEvent) => {
	try {
		const body = await request.json() as PasswordResetConfirmRequest;
		
		// Validate required fields
		if (!body.token || !body.new_password) {
			return json(
				{ error: 'Token and new password are required' },
				{ status: 400 }
			);
		}
		
		// Forward to Django API (no authentication needed)
		const apiUrl = DJANGO_API_URL || 'http://api:8000';
		const response = await fetch(`${apiUrl}/api/users/password/reset/confirm/`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Accept': 'application/json'
			},
			body: JSON.stringify(body)
		});
		
		const data = await response.json();
		
		return json(data, { status: response.status });
	} catch (error) {
		console.error('Password reset confirm API proxy error:', error);
		return json(
			{ error: 'Failed to confirm password reset' },
			{ status: 500 }
		);
	}
};
