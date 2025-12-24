/**
 * Production-ready Winston logger with OpenTelemetry integration
 * 
 * Features:
 * - Structured JSON logging for SigNoz ingestion
 * - Automatic OpenTelemetry trace correlation (traceId, spanId)
 * - Request context binding (userId, orgId, requestId)
 * - Sensitive field redaction
 * - Child logger factory for module-specific logging
 * - Error serialization with stack traces
 */

import winston from 'winston';
import { trace } from '@opentelemetry/api';
import type { RequestContext } from './api/context.js';

// Re-export types for consumers
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Fields that should be redacted from logs
 */
const SENSITIVE_FIELDS = new Set([
	'password',
	'token',
	'secret',
	'authorization',
	'apiKey',
	'accessToken',
	'refreshToken',
	'cookie',
	'sessionId'
]);

/**
 * Recursively redact sensitive fields from an object
 */
function redactSensitive(obj: unknown, depth = 0): unknown {
	if (depth > 10) return '[MAX_DEPTH]';
	if (obj === null || obj === undefined) return obj;
	if (typeof obj !== 'object') return obj;

	if (Array.isArray(obj)) {
		return obj.map((item) => redactSensitive(item, depth + 1));
	}

	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
		const lowerKey = key.toLowerCase();
		if (SENSITIVE_FIELDS.has(lowerKey) || lowerKey.includes('password') || lowerKey.includes('secret')) {
			result[key] = '[REDACTED]';
		} else if (typeof value === 'object' && value !== null) {
			result[key] = redactSensitive(value, depth + 1);
		} else {
			result[key] = value;
		}
	}
	return result;
}

/**
 * Serialize an error object for logging
 */
function serializeError(error: Error): Record<string, unknown> {
	const serialized: Record<string, unknown> = {
		name: error.name,
		message: error.message,
		stack: error.stack
	};

	// Include any additional properties on the error
	for (const key of Object.keys(error)) {
		if (!(key in serialized)) {
			serialized[key] = (error as unknown as Record<string, unknown>)[key];
		}
	}

	return serialized;
}

/**
 * Get current OpenTelemetry trace context
 */
function getTraceContext(): { traceId: string | null; spanId: string | null } {
	try {
		const span = trace.getActiveSpan();
		if (span) {
			const spanContext = span.spanContext();
			return {
				traceId: spanContext.traceId,
				spanId: spanContext.spanId
			};
		}
	} catch {
		// OpenTelemetry not available
	}
	return { traceId: null, spanId: null };
}

/**
 * Custom format that adds trace context and service metadata
 */
const traceFormat = winston.format((info) => {
	const traceContext = getTraceContext();
	return {
		...info,
		service: process.env.OTEL_SERVICE_NAME || 'hestami-ai-os',
		traceId: info.traceId || traceContext.traceId,
		spanId: info.spanId || traceContext.spanId
	};
});

/**
 * Custom format that redacts sensitive fields
 */
const redactFormat = winston.format((info) => {
	// Redact sensitive fields in the info object
	if (info.meta && typeof info.meta === 'object') {
		info.meta = redactSensitive(info.meta);
	}
	if (info.input && typeof info.input === 'object') {
		info.input = redactSensitive(info.input);
	}
	if (info.data && typeof info.data === 'object') {
		info.data = redactSensitive(info.data);
	}
	return info;
});

/**
 * Determine log level from environment
 */
function getLogLevel(): string {
	const envLevel = process.env.LOG_LEVEL?.toLowerCase();
	if (envLevel && ['debug', 'info', 'warn', 'error'].includes(envLevel)) {
		return envLevel;
	}
	return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

/**
 * Create the Winston logger instance
 */
const winstonLogger = winston.createLogger({
	level: getLogLevel(),
	format: winston.format.combine(
		winston.format.timestamp(),
		traceFormat(),
		redactFormat(),
		winston.format.errors({ stack: true }),
		process.env.NODE_ENV === 'production'
			? winston.format.json()
			: winston.format.combine(
					winston.format.colorize(),
					winston.format.printf(({ level, message, timestamp, ...meta }) => {
						const metaStr = Object.keys(meta).length > 0 
							? ` ${JSON.stringify(meta, null, 2)}` 
							: '';
						return `${timestamp} [${level}] ${message}${metaStr}`;
					})
				)
	),
	transports: [new winston.transports.Console()],
	// Don't exit on handled exceptions
	exitOnError: false
});

/**
 * Context for logging - can be RequestContext or partial context
 */
export interface LogContext {
	requestId?: string;
	traceId?: string | null;
	spanId?: string | null;
	userId?: string;
	userEmail?: string;
	orgId?: string;
	orgSlug?: string;
	[key: string]: unknown;
}

/**
 * Extract logging context from RequestContext
 */
function extractContext(context?: RequestContext | LogContext): LogContext {
	if (!context) return {};

	// Check if it's a full RequestContext
	if ('user' in context && 'organization' in context) {
		const reqContext = context as RequestContext;
		return {
			requestId: reqContext.requestId,
			traceId: reqContext.traceId,
			spanId: reqContext.spanId,
			userId: reqContext.user?.id,
			userEmail: reqContext.user?.email,
			orgId: reqContext.organization?.id,
			orgSlug: reqContext.organization?.slug ?? undefined
		};
	}

	// It's already a LogContext
	return context as LogContext;
}

/**
 * Main logger interface
 */
export const logger = {
	/**
	 * Log at debug level
	 */
	debug(message: string, context?: RequestContext | LogContext, meta?: Record<string, unknown>): void {
		const ctx = extractContext(context);
		winstonLogger.debug(message, { ...ctx, ...meta });
	},

	/**
	 * Log at info level
	 */
	info(message: string, context?: RequestContext | LogContext, meta?: Record<string, unknown>): void {
		const ctx = extractContext(context);
		winstonLogger.info(message, { ...ctx, ...meta });
	},

	/**
	 * Log at warn level
	 */
	warn(message: string, context?: RequestContext | LogContext, meta?: Record<string, unknown>): void {
		const ctx = extractContext(context);
		winstonLogger.warn(message, { ...ctx, ...meta });
	},

	/**
	 * Log at error level
	 */
	error(message: string, context?: RequestContext | LogContext, meta?: Record<string, unknown>): void {
		const ctx = extractContext(context);
		winstonLogger.error(message, { ...ctx, ...meta });
	},

	/**
	 * Log an error with full serialization
	 */
	exception(
		error: Error,
		context?: RequestContext | LogContext,
		meta?: Record<string, unknown>
	): void {
		const ctx = extractContext(context);
		winstonLogger.error(error.message, {
			...ctx,
			...meta,
			error: serializeError(error)
		});
	},

	/**
	 * Get the underlying Winston logger for advanced use cases
	 */
	getWinstonLogger(): winston.Logger {
		return winstonLogger;
	}
};

/**
 * Child logger interface with bound context
 */
export interface ChildLogger {
	debug(message: string, meta?: Record<string, unknown>): void;
	info(message: string, meta?: Record<string, unknown>): void;
	warn(message: string, meta?: Record<string, unknown>): void;
	error(message: string, meta?: Record<string, unknown>): void;
	exception(error: Error, meta?: Record<string, unknown>): void;
	child(additionalContext: LogContext): ChildLogger;
}

/**
 * Create a child logger with bound context
 * Useful for adding module/component context to all logs
 * 
 * @example
 * const log = createLogger({ module: 'DocumentWorkflow' });
 * log.info('Processing document', { documentId: '123' });
 */
export function createLogger(context: RequestContext | LogContext): ChildLogger {
	const boundContext = extractContext(context);

	return {
		debug: (message: string, meta?: Record<string, unknown>) =>
			logger.debug(message, boundContext, meta),
		info: (message: string, meta?: Record<string, unknown>) =>
			logger.info(message, boundContext, meta),
		warn: (message: string, meta?: Record<string, unknown>) =>
			logger.warn(message, boundContext, meta),
		error: (message: string, meta?: Record<string, unknown>) =>
			logger.error(message, boundContext, meta),
		exception: (error: Error, meta?: Record<string, unknown>) =>
			logger.exception(error, boundContext, meta),
		child: (additionalContext: LogContext) =>
			createLogger({ ...boundContext, ...additionalContext })
	};
}

/**
 * Create a module-specific logger
 * 
 * @example
 * const log = createModuleLogger('oRPC');
 * log.info('Request started', { path: '/api/v1/rpc/document/upload' });
 */
export function createModuleLogger(module: string): ChildLogger {
	return createLogger({ module });
}
