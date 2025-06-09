import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Cookies } from '@sveltejs/kit';
import { apiGet } from '$lib/server/api';
import type { Property, ServiceRequest } from '$lib/types';

// Define types for staff dashboard statistics
interface StaffDashboardStats {
  total_users: number;
  active_providers: number;
  pending_requests: number;
}

/**
 * Server-side load function for dashboard page
 * This ensures API calls to Django backend happen only on the server
 */
export const load: PageServerLoad = async ({ cookies, url, depends }: { cookies: Cookies; url: URL; depends: Function }) => {
  // Mark this load function as depending on dashboard data
  // This allows it to be invalidated when data changes
  depends('dashboard');
  
  console.log('Fetching dashboard data from Django API');
  
  try {
    // Get user profile to determine role
    const userProfileResponse = await apiGet(cookies, '/api/users/profile/', {}, url.pathname);
    const userRole = userProfileResponse.data.user_role?.toLowerCase();
    
    // If user is staff, fetch staff dashboard statistics
    let staffStats = null;
    if (userRole === 'staff') {
      console.log('Fetching staff dashboard statistics');
      const staffStatsResponse = await apiGet<StaffDashboardStats>(
        cookies,
        '/api/users/dashboard/stats/',
        {},
        url.pathname
      );
      
      // Log the API response for debugging
      console.log('Staff dashboard API response:', staffStatsResponse);
      console.log('Staff dashboard API data:', staffStatsResponse.data);
      
      staffStats = staffStatsResponse.data;
      
      // Log the processed staffStats
      console.log('Processed staffStats:', staffStats);
    }
    
    // Fetch properties data
    const propertiesResponse = await apiGet<Property[]>(cookies, '/api/properties/', {}, url.pathname);
    
    // Fetch service requests data - we'll get all service requests for the user
    const serviceRequestsResponse = await apiGet<ServiceRequest[]>(
      cookies, 
      '/api/services/requests/', 
      {}, 
      url.pathname
    );
    
    // Calculate dashboard stats for owner
    const ownerStats = {
      totalProperties: propertiesResponse.data.length,
      activeRequests: serviceRequestsResponse.data.filter(
        req => ['PENDING', 'IN_RESEARCH', 'BIDDING', 'ACCEPTED', 'SCHEDULED', 'IN_PROGRESS'].includes(req.status)
      ).length,
      completedServices: serviceRequestsResponse.data.filter(
        req => req.status === 'COMPLETED'
      ).length,
      scheduledServices: serviceRequestsResponse.data.filter(
        req => req.status === 'SCHEDULED'
      ).length
    };
    
    // Get recent service requests (last 5)
    const recentRequests = serviceRequestsResponse.data
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5)
      .map(request => {
        // Find the property details for this request
        const property = propertiesResponse.data.find(p => p.id === request.property);
        
        return {
          ...request,
          propertyTitle: property?.title || 'Unknown Property'
        };
      });
    
    // Return the dashboard data
    return { 
      properties: propertiesResponse.data,
      serviceRequests: serviceRequestsResponse.data,
      ownerStats,
      recentRequests,
      staffStats,
      userRole
    };
  } catch (err) {
    console.error('Error fetching dashboard data:', err);
    throw error(500, 'An unexpected error occurred while loading dashboard data');
  }
};
