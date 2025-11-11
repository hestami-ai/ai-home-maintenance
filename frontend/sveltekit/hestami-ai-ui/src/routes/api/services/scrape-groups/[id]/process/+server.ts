import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiPost } from '$lib/server/api';

// POST /api/services/scrape-groups/[id]/process/ - Process scrape group
export const POST: RequestHandler = async ({ params, url, cookies }) => {
	const response = await apiPost(
		cookies,
		`/api/services/scrape-groups/${params.id}/process/`,
		{},
		{},
		url.pathname
	);
	
	return json(response.data, { status: response.status });
};
