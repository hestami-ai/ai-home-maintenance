import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiGet } from '$lib/server/api';

/**
 * GET /api/providers/nearby
 * Proxy to Django nearby providers endpoint
 */
export const GET: RequestHandler = async ({ url, cookies }) => {
	try {
		// Build query string from URL params
		const params = new URLSearchParams();
		url.searchParams.forEach((value, key) => {
			params.append(key, value);
		});

		// Make request to Django backend
		const endpoint = `/api/services/staff/providers/nearby/?${params.toString()}`;
		const response = await apiGet(
			cookies,
			endpoint,
			{},
			url.pathname
		);

		return json(response.data, { status: response.status });
	} catch (err: any) {
		console.error('Nearby providers error:', err);
		throw error(err.status || 500, err.body?.message || 'Search failed');
	}
};
