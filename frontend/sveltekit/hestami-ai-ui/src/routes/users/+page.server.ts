import type { PageServerLoad } from './$types';
import { apiGet } from '$lib/server/api';
import { redirect } from '@sveltejs/kit';

// Use the direct API response type
export type ApiUserResponse = any; // Using 'any' temporarily to match whatever the API returns

/**
 * Server-side load function for the users page
 */
export const load = (async ({ cookies, url, fetch }) => {
    try {
        // First try using the centralized API utility
        try {
            console.log('Fetching users with API utility');
            const response = await apiGet(
                cookies,
                '/api/users/list/',
                {
                    headers: {
                        'Accept': 'application/json'
                    }
                },
                url.pathname
            );
            
            console.log('API response from server component:', response);
            
            if (response.status === 200 && response.data) {
                return { users: response.data };
            }
            
            throw new Error('Invalid API response format');
        } catch (apiError) {
            // If API utility fails, try direct fetch as fallback
            console.log('API utility failed, trying direct fetch');
            const response = await fetch('/api/users/list/');
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            
            const userData = await response.json();
            console.log('Direct fetch response:', userData);
            
            // Return the raw data directly
            console.log('Returning direct fetch data to client');
            console.log('Direct fetch data:', userData);
            return { users: userData };
            
            throw new Error('Invalid direct fetch response format');
        }
    } catch (error: any) {
        console.error('Error fetching users:', error);
        
        // Redirect to login if unauthorized
        if (error?.status === 401 || error?.status === 403) {
            throw redirect(303, `/login?redirectTo=${url.pathname}`);
        }
        
        // If all API calls failed, return an empty array instead of mock data
        console.log('API calls failed, returning empty users array');
        return { users: [] };
    }
}) satisfies PageServerLoad;
