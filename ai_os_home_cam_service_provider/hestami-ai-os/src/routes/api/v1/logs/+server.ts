/**
 * Client Log Ingestion Endpoint
 * 
 * Receives batched logs from the client-side logger and forwards them
 * to the server-side Winston logger (which integrates with OpenTelemetry).
 * 
 * This acts as a proxy since the OTEL collector is not publicly accessible.
 * 
 * Features:
 * - Validates and sanitizes incoming logs
 * - Enriches with server-side context (user session, org)
 * - Rate limiting via request size limits
 * - Forwards to Winston logger for OTEL integration
 */

import { json, type RequestHandler } from '@sveltejs/kit';
import { z } from 'zod';
import { createModuleLogger } from '$lib/server/logger.js';

const log = createModuleLogger('ClientLogIngestion');

// =============================================================================
// Validation Schemas
// =============================================================================

const LogLevelSchema = z.enum(['debug', 'info', 'warn', 'error']);

const LogEntrySchema = z.object({
	level: LogLevelSchema,
	message: z.string().max(2000),
	timestamp: z.string(),
	context: z.record(z.string(), z.unknown()).optional(),
	url: z.string().max(2000).optional(),
	sessionId: z.string().max(100).optional()
});

const ClientInfoSchema = z.object({
	url: z.string().max(2000),
	userAgent: z.string().max(500),
	screenSize: z.string().max(20),
	timezone: z.string().max(100),
	sessionId: z.string().max(100)
});

const ClientLogPayloadSchema = z.object({
	logs: z.array(LogEntrySchema).max(50), // Limit batch size
	clientInfo: ClientInfoSchema
});

// =============================================================================
// Sensitive Data Redaction
// =============================================================================

const SENSITIVE_KEYS = [
	'password',
	'token',
	'secret',
	'authorization',
	'apiKey',
	'accessToken',
	'refreshToken',
	'creditCard',
	'ssn',
	'socialSecurity'
];

function redactSensitiveData(obj: unknown, depth = 0): unknown {
	if (depth > 10) return '[MAX_DEPTH]';
	
	if (obj === null || obj === undefined) return obj;
	
	if (typeof obj === 'string') {
		// Redact if it looks like a token/key
		if (obj.length > 20 && /^[A-Za-z0-9+/=_-]+$/.test(obj)) {
			return '[REDACTED_TOKEN]';
		}
		return obj;
	}
	
	if (Array.isArray(obj)) {
		return obj.map(item => redactSensitiveData(item, depth + 1));
	}
	
	if (typeof obj === 'object') {
		const result: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
			const lowerKey = key.toLowerCase();
			if (SENSITIVE_KEYS.some(sensitive => lowerKey.includes(sensitive.toLowerCase()))) {
				result[key] = '[REDACTED]';
			} else {
				result[key] = redactSensitiveData(value, depth + 1);
			}
		}
		return result;
	}
	
	return obj;
}

// =============================================================================
// Request Handler
// =============================================================================

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Check content length to prevent abuse
		const contentLength = request.headers.get('content-length');
		if (contentLength && parseInt(contentLength) > 100_000) {
			return json({ error: 'Payload too large' }, { status: 413 });
		}

		const body = await request.json();
		
		// Validate payload
		const parseResult = ClientLogPayloadSchema.safeParse(body);
		if (!parseResult.success) {
			log.warn('Invalid client log payload', {
				errors: parseResult.error.flatten()
			});
			return json({ error: 'Invalid payload' }, { status: 400 });
		}

		const { logs, clientInfo } = parseResult.data;

		// Get user context from session if available
		const user = locals.user;
		const userId = user?.id;
		const userEmail = user?.email;
		const orgId = locals.organization?.id;
		const orgSlug = locals.organization?.slug;

		// Process each log entry
		for (const entry of logs) {
			const enrichedContext = {
				...redactSensitiveData(entry.context) as Record<string, unknown>,
				source: 'client',
				clientUrl: entry.url || clientInfo.url,
				clientSessionId: entry.sessionId || clientInfo.sessionId,
				clientUserAgent: clientInfo.userAgent,
				clientScreenSize: clientInfo.screenSize,
				clientTimezone: clientInfo.timezone,
				// Add server-side context
				...(userId && { userId }),
				...(userEmail && { userEmail }),
				...(orgId && { orgId }),
				...(orgSlug && { orgSlug })
			};

			// Forward to server logger based on level
			switch (entry.level) {
				case 'debug':
					log.debug(`[CLIENT] ${entry.message}`, enrichedContext);
					break;
				case 'info':
					log.info(`[CLIENT] ${entry.message}`, enrichedContext);
					break;
				case 'warn':
					log.warn(`[CLIENT] ${entry.message}`, enrichedContext);
					break;
				case 'error':
					log.error(`[CLIENT] ${entry.message}`, enrichedContext);
					break;
			}
		}

		log.debug('Processed client logs', {
			count: logs.length,
			sessionId: clientInfo.sessionId,
			userId
		});

		return json({ success: true, processed: logs.length });
	} catch (error) {
		log.error('Failed to process client logs', {
			error: error instanceof Error ? error.message : String(error)
		});
		return json({ error: 'Internal error' }, { status: 500 });
	}
};

// Also support sendBeacon which sends as text/plain
export const OPTIONS: RequestHandler = async () => {
	return new Response(null, {
		status: 204,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type'
		}
	});
};
