import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiPost } from '$lib/server/api';

// POST /api/services/scrape-groups/[id]/sources/ - Add source to group
export const POST: RequestHandler = async ({ params, request, url, cookies }) => {
	const body = await request.json();
	
	const response = await apiPost(
		cookies,
		`/api/services/scrape-groups/${params.id}/sources/`,
		body,
		{},
		url.pathname
	);
	
	return json(response.data, { status: response.status });
};
