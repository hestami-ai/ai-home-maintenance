import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiPost, apiGet } from '$lib/server/api';

/**
 * POST /api/providers/semantic
 * Proxy to Django semantic search endpoint
 */
export const POST: RequestHandler = async ({ request, cookies, url }) => {
	try {
		const body = await request.json();
		
		// Make request to Django backend
		const response = await apiPost(
			cookies,
			'/api/services/staff/providers/semantic/',
			body,
			{},
			url.pathname
		);

		return json(response.data, { status: response.status });
	} catch (err: any) {
		console.error('Semantic search error:', err);
		throw error(err.status || 500, err.body?.message || 'Search failed');
	}
};

/**
 * GET /api/providers/semantic
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
		const endpoint = `/api/services/staff/providers/semantic/?${params.toString()}`;
		const response = await apiGet(
			cookies,
			endpoint,
			{},
			url.pathname
		);

		return json(response.data, { status: response.status });
	} catch (err: any) {
		console.error('Semantic search error:', err);
		throw error(err.status || 500, err.body?.message || 'Search failed');
	}
};
