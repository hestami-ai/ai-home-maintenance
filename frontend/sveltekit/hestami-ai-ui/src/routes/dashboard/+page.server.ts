import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Cookies } from '@sveltejs/kit';

/**
 * Server-side load function for dashboard page
 * This uses the consolidated API endpoint instead of directly calling Django
 */
export const load: PageServerLoad = async ({ cookies, url, fetch, depends }) => {
  // Mark this load function as depending on dashboard data
  // This allows it to be invalidated when data changes
  depends('dashboard');
  
  console.log('Fetching dashboard data from API endpoint');
  
  try {
    // Call our consolidated API endpoint
    const response = await fetch('/api/dashboard', {
      headers: {
        // Pass cookies for authentication
        cookie: Object.entries(cookies.getAll())
          .map(([name, value]) => `${name}=${value}`)
          .join('; ')
      }
    });
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }
    
    // Parse and return the dashboard data
    const dashboardData = await response.json();
    return dashboardData;
  } catch (err) {
    console.error('Error fetching dashboard data:', err);
    throw error(500, 'An unexpected error occurred while loading dashboard data');
  }
};
