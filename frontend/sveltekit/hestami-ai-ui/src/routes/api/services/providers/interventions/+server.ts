import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiGet } from '$lib/server/api';

export const GET: RequestHandler = async ({ cookies, url }) => {
  const response = await apiGet(
    cookies,
    '/api/services/providers/interventions/',
    {},
    url.pathname
  );
  
  return json(response.data, { status: response.status });
};
