/**
 * API client for making requests to the oRPC backend
 */

const API_BASE = '/api/v1/rpc';

interface ApiResponse<T> {
	ok: boolean;
	data?: T;
	error?: {
		code: string;
		message: string;
	};
	meta?: Record<string, unknown>;
}

interface RequestOptions {
	method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
	body?: unknown;
	headers?: Record<string, string>;
	organizationId?: string;
}

export async function apiCall<T>(
	path: string,
	options: RequestOptions = {}
): Promise<ApiResponse<T>> {
	const { method = 'POST', body, headers = {}, organizationId } = options;

	const requestHeaders: Record<string, string> = {
		'Content-Type': 'application/json',
		...headers
	};

	if (organizationId) {
		requestHeaders['X-Organization-ID'] = organizationId;
	}

	try {
		const response = await fetch(`${API_BASE}/${path}`, {
			method,
			headers: requestHeaders,
			body: body ? JSON.stringify(body) : undefined,
			credentials: 'include'
		});

		const data = await response.json();

		if (!response.ok) {
			return {
				ok: false,
				error: {
					code: data.error?.code || 'UNKNOWN_ERROR',
					message: data.error?.message || 'An unexpected error occurred'
				}
			};
		}

		return data;
	} catch (error) {
		return {
			ok: false,
			error: {
				code: 'NETWORK_ERROR',
				message: error instanceof Error ? error.message : 'Network error'
			}
		};
	}
}

/**
 * Organization API calls
 */
export const organizationApi = {
	list: () =>
		apiCall<{
			organizations: Array<{
				id: string;
				name: string;
				slug: string;
				type: string;
				role: string;
				isDefault: boolean;
			}>;
		}>('organization/list'),

	create: (data: { name: string; slug: string; type: string }) =>
		apiCall<{
			organization: {
				id: string;
				name: string;
				slug: string;
				type: string;
				status: string;
			};
		}>('organization/create', { body: data }),

	setDefault: (organizationId: string) =>
		apiCall<{ success: boolean }>('organization/setDefault', {
			body: { organizationId }
		}),

	current: (organizationId: string) =>
		apiCall<{
			organization: {
				id: string;
				name: string;
				slug: string;
				type: string;
				status: string;
			};
			role: string;
		}>('organization/current', { organizationId })
};
