import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { apiGet } from '$lib/server/api';
import type { Property, ServiceRequest } from '$lib/types';

// Define types for staff dashboard statistics
interface StaffDashboardStats {
  total_users: number;
  active_providers: number;
  pending_requests: number;
}

// GET dashboard data
export async function GET({ cookies, url }: RequestEvent) {
  try {
    // Get user profile to determine role
    const userProfileResponse = await apiGet(cookies, '/api/users/profile/', {}, url.pathname);
    const userRole = userProfileResponse.data.user_role?.toLowerCase();
    
    // If user is staff, fetch staff dashboard statistics
    let staffStats = null;
    if (userRole === 'staff') {
      const staffStatsResponse = await apiGet<StaffDashboardStats>(
        cookies,
        '/api/users/dashboard/stats/',
        {},
        url.pathname
      );
      
      staffStats = staffStatsResponse.data;
    }
    
    // Fetch properties data
    const propertiesResponse = await apiGet<Property[]>(cookies, '/api/properties/', {}, url.pathname);
    
    // Fetch service requests data
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
    return json({ 
      properties: propertiesResponse.data,
      serviceRequests: serviceRequestsResponse.data,
      ownerStats,
      recentRequests,
      staffStats,
      userRole
    });
  } catch (err) {
    console.error('Error fetching dashboard data:', err);
    return json(
      { error: err instanceof Error ? err.message : 'An unexpected error occurred' },
      { status: 500 }
    );
  }
};
