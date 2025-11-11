import type { RequestHandler } from './$types';
import { apiDelete } from '$lib/server/api';

// DELETE /api/services/scrape-groups/[id]/sources/[scraped_data_id]/ - Remove source
export const DELETE: RequestHandler = async ({ params, url, cookies }) => {
	const response = await apiDelete(
		cookies,
		`/api/services/scrape-groups/${params.id}/sources/${params.scraped_data_id}/`,
		{},
		url.pathname
	);
	
	return new Response(null, { status: response.status });
};
