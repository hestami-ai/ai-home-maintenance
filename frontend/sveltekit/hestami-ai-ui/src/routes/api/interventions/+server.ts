import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiGet } from '$lib/server/api';

export const GET: RequestHandler = async ({ cookies, url }) => {
  const returnUrl = url.pathname;
  
  try {
    const response = await apiGet(
      cookies,
      '/api/services/providers/interventions/',
      {},
      returnUrl
    );
    
    return json(response.data);
  } catch (err) {
    console.error('Error fetching interventions:', err);
    return json({ error: 'Failed to fetch interventions' }, { status: 500 });
  }
};
