import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { SVELTE_KIT_DJANGO_API_BASE_URL } from '$env/static/private';

export const POST: RequestHandler = async ({ request, fetch }) => {
	try {
		const userData = await request.json();
		
		// Forward the request to the backend API
		const response = await fetch(`${SVELTE_KIT_DJANGO_API_BASE_URL}/api/users/register/`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(userData)
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
