import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiPost } from '$lib/server/api';

export const POST: RequestHandler = async ({ request, cookies, url }) => {
  const body = await request.json();
  
  const response = await apiPost(
    cookies,
    '/api/services/providers/add-to-roster/',
    body,
    {},
    url.pathname
  );
  
  return json(response.data, { status: response.status });
};
