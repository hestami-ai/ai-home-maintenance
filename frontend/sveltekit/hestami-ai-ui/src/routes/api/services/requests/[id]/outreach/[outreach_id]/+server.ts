import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { apiGet, apiPatch, apiDelete } from '$lib/server/api';

/**
 * GET: Retrieve a specific outreach record
 * PATCH: Update an outreach record
 * DELETE: Delete an outreach record
 */
export async function GET({ params, cookies, url }: RequestEvent) {
	try {
		const response = await apiGet(
			cookies,
			`/api/services/requests/${params.id}/outreach/${params.outreach_id}/`,
			{},
			url.pathname
		);
		return json(response.data);
	} catch (err) {
		return json(
			{ error: err instanceof Error ? err.message : 'Failed to fetch outreach record' },
			{ status: 500 }
		);
	}
}

export async function PATCH({ params, request, cookies, url }: RequestEvent) {
	try {
		const body = await request.json();
		const response = await apiPatch(
			cookies,
			`/api/services/requests/${params.id}/outreach/${params.outreach_id}/`,
			body,
			{},
			url.pathname
		);
		return json(response.data);
	} catch (err) {
		return json(
			{ error: err instanceof Error ? err.message : 'Failed to update outreach record' },
			{ status: 500 }
		);
	}
}

export async function DELETE({ params, cookies, url }: RequestEvent) {
	try {
		await apiDelete(
			cookies,
			`/api/services/requests/${params.id}/outreach/${params.outreach_id}/`,
			{},
			url.pathname
		);
		return new Response(null, { status: 204 });
	} catch (err) {
		return json(
			{ error: err instanceof Error ? err.message : 'Failed to delete outreach record' },
			{ status: 500 }
		);
	}
}
