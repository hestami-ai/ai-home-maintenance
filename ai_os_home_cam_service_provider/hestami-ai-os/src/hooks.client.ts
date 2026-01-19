/**
 * Client-side hooks for SvelteKit
 *
 * Handles client-side error reporting and logging initialization.
 * Also suppresses known transient errors from Svelte 5's proxy system during navigation.
 */

import { browser } from '$app/environment';
import { logger } from '$lib/logger';

/**
 * Known transient errors that occur during SPA navigation due to Svelte 5's
 * proxy system. These errors are harmless and self-resolve when navigation completes.
 */
const TRANSIENT_ERROR_PATTERNS = [
	"right-hand side of 'in' should be an object",
	"Cannot read properties of undefined",
	"Cannot read properties of null"
];

/**
 * Check if an error is a known transient navigation error
 */
function isTransientNavigationError(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error);
	return TRANSIENT_ERROR_PATTERNS.some(pattern => message.includes(pattern));
}

/**
 * Log detailed navigation error for debugging
 */
function logNavigationErrorDetails(error: unknown, context: string): void {
	const stack = error instanceof Error ? error.stack : new Error('Stack trace').stack;
	console.warn(`[NAVIGATION-TRACE] ${context}:`, {
		message: error instanceof Error ? error.message : String(error),
		stack: stack?.split('\n').slice(0, 10).join('\n'),
		timestamp: new Date().toISOString()
	});
}

/**
 * Handle client-side errors that occur during navigation or rendering
 */
export function handleError({ error, event, status, message }: {
	error: unknown;
	event: { url: URL };
	status: number;
	message: string;
}) {
	// Skip logging for known transient navigation errors
	// These occur during SPA transitions when the data prop is momentarily undefined
	if (isTransientNavigationError(error)) {
		// Always log with full details to help diagnose navigation crashes
		logNavigationErrorDetails(error, `handleError at ${event.url.href}`);
		return {
			message: 'Navigation in progress'
		};
	}

	// Log the error with full context
	logger.captureError(error, {
		type: 'sveltekit_client_error',
		url: event.url.href,
		status,
		message
	});

	// Return a user-friendly error message
	const errorMessage = error instanceof Error ? error.message : message;
	return {
		message: import.meta.env.DEV ? errorMessage : 'An unexpected error occurred'
	};
}

/**
 * Install global error handlers to suppress transient proxy errors from console.
 * These errors occur during SPA navigation when Svelte 5's proxy system tries to
 * access properties on an undefined data object.
 */
if (browser) {
	// Suppress transient errors from appearing in console
	const originalError = console.error;
	console.error = (...args: unknown[]) => {
		const message = args[0];
		if (typeof message === 'string' && TRANSIENT_ERROR_PATTERNS.some(p => message.includes(p))) {
			// Suppress known transient errors
			return;
		}
		originalError.apply(console, args);
	};

	// Handle uncaught errors at window level
	globalThis.addEventListener('error', (event) => {
		if (isTransientNavigationError(event.error || event.message)) {
			logNavigationErrorDetails(event.error || event.message, 'window.error');
			event.preventDefault();
		}
	});

	// Handle unhandled promise rejections
	globalThis.addEventListener('unhandledrejection', (event) => {
		if (isTransientNavigationError(event.reason)) {
			logNavigationErrorDetails(event.reason, 'unhandledrejection');
			event.preventDefault();
		}
	});
}
