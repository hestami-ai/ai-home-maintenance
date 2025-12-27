/**
 * oRPC Logging Middleware
 * 
 * Provides automatic request/response logging for all oRPC procedures.
 * 
 * Features:
 * - Request start logging (method, path, user, org)
 * - Request end logging (duration, status)
 * - Error logging with full context and stack traces
 * - Input validation failure logging
 * - Sensitive field redaction
 */

import { logger, createLogger, type LogContext } from '../../logger.js';
import type { RequestContext } from '../context.js';

/**
 * Summarize input for logging (avoid logging large payloads)
 */
function summarizeInput(input: unknown): unknown {
	if (input === null || input === undefined) return input;
	if (typeof input !== 'object') return input;

	// Handle File objects specially
	if (input instanceof File) {
		return {
			_type: 'File',
			name: input.name,
			size: input.size,
			type: input.type
		};
	}

	if (Array.isArray(input)) {
		if (input.length > 10) {
			return {
				_type: 'Array',
				length: input.length,
				sample: input.slice(0, 3).map(summarizeInput)
			};
		}
		return input.map(summarizeInput);
	}

	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
		if (value instanceof File) {
			result[key] = {
				_type: 'File',
				name: value.name,
				size: value.size,
				type: value.type
			};
		} else if (typeof value === 'string' && value.length > 500) {
			result[key] = `${value.slice(0, 100)}... [${value.length} chars]`;
		} else if (typeof value === 'object' && value !== null) {
			result[key] = summarizeInput(value);
		} else {
			result[key] = value;
		}
	}
	return result;
}

/**
 * Extract procedure path from oRPC request
 */
function extractProcedurePath(url: string, prefix: string): string {
	try {
		const urlObj = new URL(url);
		const path = urlObj.pathname;
		if (path.startsWith(prefix)) {
			return path.slice(prefix.length);
		}
		return path;
	} catch {
		return url;
	}
}

/**
 * Log context for oRPC requests
 */
export interface ORPCLogContext extends LogContext {
	method: string;
	path: string;
	procedurePath: string;
}

/**
 * Create logging context from request and context
 */
export function createORPCLogContext(
	request: Request,
	context: RequestContext,
	prefix = '/api/v1/rpc'
): ORPCLogContext {
	return {
		requestId: context.requestId,
		trace_id: context.traceId,
		span_id: context.spanId,
		userId: context.user?.id,
		userEmail: context.user?.email,
		orgId: context.organization?.id,
		orgSlug: context.organization?.slug ?? undefined,
		method: request.method,
		path: new URL(request.url).pathname,
		procedurePath: extractProcedurePath(request.url, prefix)
	};
}

/**
 * Log request start
 */
export function logRequestStart(logContext: ORPCLogContext): void {
	logger.info('oRPC request started', logContext, {
		event: 'request_start'
	});
}

/**
 * Log request completion
 */
export function logRequestEnd(
	logContext: ORPCLogContext,
	statusCode: number,
	durationMs: number
): void {
	const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
	const message = statusCode >= 400 ? 'oRPC request failed' : 'oRPC request completed';

	logger[level](message, logContext, {
		event: 'request_end',
		statusCode,
		durationMs
	});
}

/**
 * Log request error with full context
 */
export function logRequestError(
	logContext: ORPCLogContext,
	error: unknown,
	input?: unknown
): void {
	const errorObj = error instanceof Error ? error : new Error(String(error));
	
	logger.exception(errorObj, logContext, {
		event: 'request_error',
		input: input ? summarizeInput(input) : undefined
	});
}

/**
 * Log validation error
 */
export function logValidationError(
	logContext: ORPCLogContext,
	errors: unknown,
	input?: unknown
): void {
	logger.warn('oRPC validation failed', logContext, {
		event: 'validation_error',
		validationErrors: errors,
		input: input ? summarizeInput(input) : undefined
	});
}

/**
 * Log authorization failure
 */
export function logAuthorizationFailure(
	logContext: ORPCLogContext,
	action: string,
	resource: string,
	resourceId: string
): void {
	logger.warn('Authorization denied', logContext, {
		event: 'authorization_denied',
		action,
		resource,
		resourceId
	});
}

/**
 * Log workflow invocation
 */
export function logWorkflowStart(
	logContext: LogContext,
	workflowName: string,
	workflowId: string,
	action: string,
	input?: unknown
): void {
	logger.info('Workflow started', logContext, {
		event: 'workflow_start',
		workflow: workflowName,
		workflowId,
		action,
		input: input ? summarizeInput(input) : undefined
	});
}

/**
 * Log workflow completion
 */
export function logWorkflowEnd(
	logContext: LogContext,
	workflowName: string,
	workflowId: string,
	success: boolean,
	durationMs?: number,
	error?: string
): void {
	const level = success ? 'info' : 'error';
	const message = success ? 'Workflow completed' : 'Workflow failed';

	logger[level](message, logContext, {
		event: 'workflow_end',
		workflow: workflowName,
		workflowId,
		success,
		durationMs,
		error
	});
}

/**
 * Create a request-scoped logger for use in handlers
 */
export function createRequestLogger(context: RequestContext) {
	return createLogger(context);
}

/**
 * Utility to wrap an async handler with logging
 */
export async function withRequestLogging<T>(
	request: Request,
	context: RequestContext,
	handler: () => Promise<T>,
	options: { prefix?: string; logInput?: unknown } = {}
): Promise<T> {
	const logContext = createORPCLogContext(request, context, options.prefix);
	const startTime = Date.now();

	logRequestStart(logContext);

	try {
		const result = await handler();
		const durationMs = Date.now() - startTime;
		
		// Determine status from result if it's a Response
		let statusCode = 200;
		if (result instanceof Response) {
			statusCode = result.status;
		}
		
		logRequestEnd(logContext, statusCode, durationMs);
		return result;
	} catch (error) {
		const durationMs = Date.now() - startTime;
		logRequestError(logContext, error, options.logInput);
		logRequestEnd(logContext, 500, durationMs);
		throw error;
	}
}
