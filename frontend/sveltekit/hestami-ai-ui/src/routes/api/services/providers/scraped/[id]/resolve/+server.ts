import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiPost } from '$lib/server/api';

export const POST: RequestHandler = async ({ request, cookies, params, url }) => {
  const body = await request.json();
  const { id } = params;
  
  const response = await apiPost(
    cookies,
    `/api/services/providers/scraped/${id}/resolve/`,
    body,
    {},
    url.pathname
  );
  
  return json(response.data, { status: response.status });
};
