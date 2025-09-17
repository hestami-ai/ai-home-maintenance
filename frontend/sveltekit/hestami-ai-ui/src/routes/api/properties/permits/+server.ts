import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { apiGet } from '$lib/server/api';

/**
 * GET endpoint to retrieve all permit history
 * Maps to Django's /permits/ endpoint
 */
export async function GET({ cookies, url }: RequestEvent) {
  try {
    // Fetch all permit history
    const response = await apiGet(
      cookies,
      '/api/properties/permits/',
      {},
      url.pathname
    );
    
    return json(response.data);
  } catch (err) {
    console.error('Error fetching permit history:', err);
    return json(
      { error: err instanceof Error ? err.message : 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
