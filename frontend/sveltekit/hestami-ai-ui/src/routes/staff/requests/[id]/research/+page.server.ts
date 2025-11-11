import { apiRequest, handleApiError } from '$lib/server/auth';
import type { RequestEvent } from '@sveltejs/kit';

export const load = async ({ locals, params, url }: RequestEvent) => {
	const auth = locals.auth;
	
	if (!auth?.sessionId) {
		handleApiError(new Error('No authentication tokens available'), url.pathname);
	}
	
	try {
		// Fetch existing providers near the service request
		const providersResponse = await apiRequest(
			auth.sessionId,
			`/api/services/providers/?service_request_id=${params.id}`
		);
		
		let existingProviders = [];
		if (providersResponse.ok) {
			const providersData = await providersResponse.json();
			existingProviders = providersData.results || providersData || [];
		}
		
		// Fetch existing outreach records for this service request
		const outreachResponse = await apiRequest(
			auth.sessionId,
			`/api/services/requests/${params.id}/outreach/`
		);
		
		let outreachRecords = [];
		if (outreachResponse.ok) {
			outreachRecords = await outreachResponse.json();
		}
		
		// Create a map of provider_id -> outreach record for quick lookup
		const outreachMap = new Map();
		outreachRecords.forEach((record: any) => {
			outreachMap.set(record.provider, record);
		});
		
		// Add outreach status to each provider
		existingProviders = existingProviders.map((provider: any) => ({
			...provider,
			outreach: outreachMap.get(provider.id) || null
		}));
		
		return {
			existingProviders,
			serviceRequestId: params.id
		};
	} catch (err) {
		handleApiError(err, url.pathname);
	}
};
