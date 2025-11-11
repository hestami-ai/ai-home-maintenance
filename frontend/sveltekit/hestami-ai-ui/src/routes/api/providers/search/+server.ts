import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiPost } from '$lib/server/api';

/**
 * POST /api/providers/search
 * Proxy to Django provider search endpoint
 */
export const POST: RequestHandler = async ({ request, cookies, url }) => {
	try {
		const body = await request.json();
		
		// Make request to Django backend
		const response = await apiPost(
			cookies,
			'/api/services/staff/providers/search/',
			body,
			{},
			url.pathname
		);

		return json(response.data, { status: response.status });
	} catch (err: any) {
		console.error('Provider search error:', err);
		throw error(err.status || 500, err.body?.message || 'Search failed');
	}
};

/**
 * GET /api/providers/search
 * Support GET requests with query parameters
 */
export const GET: RequestHandler = async ({ url, cookies }) => {
	try {
		// Build query string from URL params
		const params = new URLSearchParams();
		url.searchParams.forEach((value, key) => {
			params.append(key, value);
		});

		// Make request to Django backend
		const endpoint = `/api/services/staff/providers/search/?${params.toString()}`;
		const response = await apiPost(
			cookies,
			endpoint,
			{},
			{},
			url.pathname
		);

		return json(response.data, { status: response.status });
	} catch (err: any) {
		console.error('Provider search error:', err);
		throw error(err.status || 500, err.body?.message || 'Search failed');
	}
};
