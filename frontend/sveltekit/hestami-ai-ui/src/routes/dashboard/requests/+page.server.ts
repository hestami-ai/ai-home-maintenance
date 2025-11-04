import { apiRequest, handleApiError } from '$lib/server/auth';
import type { RequestEvent } from '@sveltejs/kit';

export const load = async ({ locals, url }: RequestEvent) => {
  const auth = locals.auth;
  
  if (!auth?.sessionId) {
    handleApiError(new Error('No authentication tokens available'), url.pathname);
  }
  
  try {
    // Build query parameters from URL search params
    const params = new URLSearchParams();
    
    // Add filters from URL
    const status = url.searchParams.get('status');
    const priority = url.searchParams.get('priority');
    const assigned_to = url.searchParams.get('assigned_to');
    const search = url.searchParams.get('search');
    const page = url.searchParams.get('page') || '1';
    
    if (status) params.append('status', status);
    if (priority) params.append('priority', priority);
    if (assigned_to) params.append('assigned_to', assigned_to);
    if (search) params.append('search', search);
    params.append('page', page);
    
    // Fetch service requests from the queue endpoint
    const queueResponse = await apiRequest(
      auth.sessionId,
      `/api/services/requests/queue/?${params.toString()}`
    );
    
    if (!queueResponse.ok) {
      throw new Error(`Failed to fetch queue: ${queueResponse.statusText}`);
    }
    
    const queueData = await queueResponse.json();
    
    // The queue endpoint returns everything we need:
    // - queue_counts (stats)
    // - priority_counts
    // - sla_indicators
    // - requests (the actual service requests)
    
    return {
      queueStats: {
        queue_counts: queueData.queue_counts || {},
        priority_counts: queueData.priority_counts || {},
        sla_indicators: queueData.sla_indicators || {}
      },
      serviceRequests: queueData.requests || [],
      pagination: {
        count: queueData.requests?.length || 0,
        next: null,
        previous: null,
        currentPage: parseInt(page)
      },
      filters: {
        status,
        priority,
        assigned_to,
        search
      }
    };
  } catch (err) {
    handleApiError(err, url.pathname);
  }
};
