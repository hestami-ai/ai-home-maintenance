/**
 * Client-side hooks for SvelteKit
 * 
 * Handles client-side error reporting and logging initialization.
 */

import { logger } from '$lib/logger';

/**
 * Handle client-side errors that occur during navigation or rendering
 */
export function handleError({ error, event, status, message }: {
	error: unknown;
	event: { url: URL };
	status: number;
	message: string;
}) {
	// Log the error with full context
	logger.captureError(error, {
		type: 'sveltekit_client_error',
		url: event.url.href,
		status,
		message
	});

	// Return a user-friendly error message
	return {
		message: import.meta.env.DEV 
			? (error instanceof Error ? error.message : message)
			: 'An unexpected error occurred'
	};
}
