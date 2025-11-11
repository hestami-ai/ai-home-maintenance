import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { apiGet, apiPost } from '$lib/server/api';

/**
 * GET: List all provider outreach records for a service request
 * POST: Create a new provider outreach record
 */
export async function GET({ params, cookies, url }: RequestEvent) {
	try {
		const response = await apiGet(
			cookies,
			`/api/services/requests/${params.id}/outreach/`,
			{},
			url.pathname
		);
		return json(response.data);
	} catch (err) {
		return json(
			{ error: err instanceof Error ? err.message : 'Failed to fetch outreach records' },
			{ status: 500 }
		);
	}
}

export async function POST({ params, request, cookies, url }: RequestEvent) {
	try {
		const body = await request.json();
		const response = await apiPost(
			cookies,
			`/api/services/requests/${params.id}/outreach/`,
			body,
			{},
			url.pathname
		);
		return json(response.data, { status: 201 });
	} catch (err) {
		return json(
			{ error: err instanceof Error ? err.message : 'Failed to create outreach record' },
			{ status: 500 }
		);
	}
}
