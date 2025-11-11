import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiGet, apiDelete } from '$lib/server/api';

// GET /api/services/scrape-groups/[id]/ - Get scrape group details
export const GET: RequestHandler = async ({ params, url, cookies }) => {
	const response = await apiGet(
		cookies,
		`/api/services/scrape-groups/${params.id}/`,
		{},
		url.pathname
	);
	
	return json(response.data);
};

// DELETE /api/services/scrape-groups/[id]/delete/ - Delete scrape group
export const DELETE: RequestHandler = async ({ params, url, cookies }) => {
	const response = await apiDelete(
		cookies,
		`/api/services/scrape-groups/${params.id}/delete/`,
		{},
		url.pathname
	);
	
	return new Response(null, { status: response.status });
};
