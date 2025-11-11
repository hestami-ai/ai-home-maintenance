import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiGet, apiPost } from '$lib/server/api';

// GET /api/services/scrape-groups/ - List scrape groups
export const GET: RequestHandler = async ({ url, cookies }) => {
	const limit = url.searchParams.get('limit') || '20';
	const offset = url.searchParams.get('offset') || '0';
	
	const response = await apiGet(
		cookies,
		`/api/services/scrape-groups/?limit=${limit}&offset=${offset}`,
		{},
		url.pathname
	);
	
	return json(response.data);
};

// POST /api/services/scrape-groups/ - Create scrape group
export const POST: RequestHandler = async ({ request, url, cookies }) => {
	const body = await request.json();
	
	// Django endpoint for creating scrape groups
	const response = await apiPost(
		cookies,
		'/api/services/scrape-groups/create/',
		body,
		{},
		url.pathname
	);
	
	return json(response.data, { status: response.status });
};
