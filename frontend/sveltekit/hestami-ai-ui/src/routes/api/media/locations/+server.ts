import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { apiGet } from '$lib/server/api';

/**
 * GET endpoint to retrieve all available location types and their subtypes
 * Maps to Django's /api/media/locations/ endpoint
 * 
 * Response format:
 * {
 *   types: [{ value: string, label: string }],
 *   subTypes: { [typeValue: string]: [{ value: string, label: string }] }
 * }
 */
export async function GET({ cookies, url }: RequestEvent) {
  try {
    // Forward to Django backend
    const response = await apiGet(
      cookies,
      '/api/media/locations/',
      {},
      url.pathname
    );
    
    return json(response.data, { status: response.status });
  } catch (error) {
    console.error('Error fetching location types:', error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Failed to fetch location types';
      
    return json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
