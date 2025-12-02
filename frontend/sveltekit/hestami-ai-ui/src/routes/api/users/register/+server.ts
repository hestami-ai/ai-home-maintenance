import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { SVELTE_KIT_DJANGO_API_BASE_URL, TURNSTILE_SECRET_KEY } from '$env/static/private';

interface TurnstileVerifyResponse {
	success: boolean;
	'error-codes'?: string[];
	challenge_ts?: string;
	hostname?: string;
}

async function verifyTurnstileToken(token: string): Promise<{ success: boolean; error?: string }> {
	try {
		const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			body: new URLSearchParams({
				secret: TURNSTILE_SECRET_KEY,
				response: token
			})
		});
		
		const data: TurnstileVerifyResponse = await response.json();
		
		if (!data.success) {
			return {
				success: false,
				error: data['error-codes']?.join(', ') || 'Turnstile verification failed'
			};
		}
		
		return { success: true };
	} catch (error) {
		console.error('Turnstile verification error:', error);
		return { success: false, error: 'Failed to verify CAPTCHA' };
	}
}

export const POST: RequestHandler = async ({ request, fetch }) => {
	try {
		const userData = await request.json();
		
		// Extract and verify Turnstile token
		const { cf_turnstile_response, ...registrationData } = userData;
		
		if (!cf_turnstile_response) {
			return json({ error: 'CAPTCHA verification required' }, { status: 400 });
		}
		
		const turnstileResult = await verifyTurnstileToken(cf_turnstile_response);
		if (!turnstileResult.success) {
			return json({ error: turnstileResult.error || 'CAPTCHA verification failed' }, { status: 400 });
		}
		
		// Forward the request to the backend API (without the Turnstile token)
		const response = await fetch(`${SVELTE_KIT_DJANGO_API_BASE_URL}/api/users/register/`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(registrationData)
		});
		
		// Get the response data
		const responseData = await response.json();
		
		// Return the response with the same status code
		return json(responseData, { status: response.status });
	} catch (error) {
		console.error('Registration API error:', error);
		return json({ error: 'An error occurred during registration' }, { status: 500 });
	}
};
