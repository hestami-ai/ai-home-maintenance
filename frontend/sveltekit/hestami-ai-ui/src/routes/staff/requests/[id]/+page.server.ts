import { apiRequest, handleApiError } from '$lib/server/auth';
import { error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

export const load = async ({ locals, params, url }: RequestEvent) => {
  const auth = locals.auth;
  
  if (!auth?.sessionId) {
    handleApiError(new Error('No authentication tokens available'), url.pathname);
  }
  
  try {
    // Fetch service request details
    const requestResponse = await apiRequest(
      auth.sessionId,
      `/api/services/requests/${params.id}/`
    );
    
    if (!requestResponse.ok) {
      if (requestResponse.status === 404) {
        throw error(404, 'Service request not found');
      }
      throw new Error(`Failed to fetch request: ${requestResponse.statusText}`);
    }
    
    const serviceRequest = await requestResponse.json();
    
    // Fetch research entries for this request
    const researchResponse = await apiRequest(
      auth.sessionId,
      `/api/services/requests/${params.id}/research/`
    );
    
    let researchEntries = [];
    if (researchResponse.ok) {
      const researchData = await researchResponse.json();
      researchEntries = researchData.results || researchData || [];
    }
    
    // Fetch bids for this request (Phase 2: Enhanced with summary)
    const bidsResponse = await apiRequest(
      auth.sessionId,
      `/api/services/requests/${params.id}/bids/`
    );
    
    let bids = [];
    let bidsSummary = {};
    if (bidsResponse.ok) {
      const bidsData = await bidsResponse.json();
      // Phase 2: API now returns {bids: [], summary: {}}
      bids = bidsData.bids || bidsData.results || bidsData || [];
      bidsSummary = bidsData.summary || {};
    }
    
    // Fetch provider outreach records (Phase 2)
    const outreachResponse = await apiRequest(
      auth.sessionId,
      `/api/services/requests/${params.id}/outreach/`
    );
    
    let providerOutreach = [];
    if (outreachResponse.ok) {
      providerOutreach = await outreachResponse.json();
    }
    
    return {
      serviceRequest,
      researchEntries,
      bids,
      bidsSummary,
      providerOutreach
    };
  } catch (err) {
    handleApiError(err, url.pathname);
  }
};
