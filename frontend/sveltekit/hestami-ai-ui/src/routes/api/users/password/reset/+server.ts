import { json, type RequestEvent } from '@sveltejs/kit';
import type { PasswordResetRequest } from '$lib/types';
import { DJANGO_API_URL } from '$env/static/private';

/**
 * Password reset request endpoint proxy
 * Initiates password reset process by sending reset email
 * Does NOT require authentication (public endpoint)
 */

export const POST = async ({ request, fetch }: RequestEvent) => {
	try {
		const body = await request.json() as PasswordResetRequest;
		
		// Validate required fields
		if (!body.email) {
			return json(
				{ error: 'Email is required' },
				{ status: 400 }
			);
		}
		
		// Forward to Django API (no authentication needed)
		const apiUrl = DJANGO_API_URL || 'http://api:8000';
		const response = await fetch(`${apiUrl}/api/users/password/reset/`, {
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
		console.error('Password reset request API proxy error:', error);
		return json(
			{ error: 'Failed to request password reset' },
			{ status: 500 }
		);
	}
};
