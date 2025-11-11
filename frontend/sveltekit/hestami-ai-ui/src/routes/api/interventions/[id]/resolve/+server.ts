import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiPost } from '$lib/server/api';

export const POST: RequestHandler = async ({ cookies, params, request, url }) => {
  const returnUrl = url.pathname;
  const body = await request.json();
  
  try {
    const response = await apiPost(
      cookies,
      `/api/services/providers/scraped/${params.id}/resolve/`,
      body,
      {},
      returnUrl
    );
    
    return json(response.data);
  } catch (err) {
    console.error('Error resolving intervention:', err);
    return json({ error: 'Failed to resolve intervention' }, { status: 500 });
  }
};
