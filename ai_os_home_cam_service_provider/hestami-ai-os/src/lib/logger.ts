/**
 * Production-ready logger for client and server
 * 
 * Features:
 * - Environment-aware log levels
 * - Structured logging with context
 * - OpenTelemetry trace correlation (server-side)
 * - Tree-shakeable debug logs in production
 * 
 * Usage:
 *   import { logger } from '$lib/logger';
 *   logger.info('User logged in', { userId: '123' });
 *   logger.debug('Detailed info', { data }); // Stripped in production
 */

import { browser } from '$app/environment';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
	[key: string]: unknown;
}

interface LogEntry {
	level: LogLevel;
	message: string;
	timestamp: string;
	context?: LogContext;
	traceId?: string;
	spanId?: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3
};

function getLogLevel(): LogLevel {
	if (browser) {
		// Client-side: check localStorage or default based on hostname
		const stored = localStorage.getItem('LOG_LEVEL');
		if (stored && stored in LOG_LEVELS) return stored as LogLevel;
		// Enable debug on localhost/dev
		if (window.location.hostname === 'localhost' || window.location.hostname.includes('dev-')) {
			return 'debug';
		}
		return 'warn';
	}
	// Server-side: use environment variable
	const envLevel = process.env.LOG_LEVEL?.toLowerCase();
	if (envLevel && envLevel in LOG_LEVELS) return envLevel as LogLevel;
	return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

function shouldLog(level: LogLevel): boolean {
	return LOG_LEVELS[level] >= LOG_LEVELS[getLogLevel()];
}

function formatMessage(entry: LogEntry): string {
	const parts = [
		`[${entry.timestamp}]`,
		`[${entry.level.toUpperCase()}]`,
		entry.message
	];
	
	if (entry.traceId) {
		parts.push(`[trace:${entry.traceId.slice(0, 8)}]`);
	}
	
	return parts.join(' ');
}

function createLogEntry(level: LogLevel, message: string, context?: LogContext): LogEntry {
	const entry: LogEntry = {
		level,
		message,
		timestamp: new Date().toISOString(),
		context
	};

	// Add trace context on server if available
	if (!browser) {
		try {
			// Dynamic import to avoid bundling OTel in client
			const { trace } = require('@opentelemetry/api');
			const span = trace.getActiveSpan?.();
			if (span) {
				const spanContext = span.spanContext();
				entry.traceId = spanContext.traceId;
				entry.spanId = spanContext.spanId;
			}
		} catch {
			// OpenTelemetry not available
		}
	}

	return entry;
}

function log(level: LogLevel, message: string, context?: LogContext): void {
	if (!shouldLog(level)) return;

	const entry = createLogEntry(level, message, context);
	const formatted = formatMessage(entry);

	// Use appropriate console method
	const consoleFn = level === 'debug' ? console.debug
		: level === 'info' ? console.info
		: level === 'warn' ? console.warn
		: console.error;

	if (context && Object.keys(context).length > 0) {
		consoleFn(formatted, context);
	} else {
		consoleFn(formatted);
	}
}

/**
 * Create a child logger with preset context
 * Useful for adding component/module context to all logs
 */
function createLogger(baseContext: LogContext) {
	return {
		debug: (message: string, context?: LogContext) => 
			log('debug', message, { ...baseContext, ...context }),
		info: (message: string, context?: LogContext) => 
			log('info', message, { ...baseContext, ...context }),
		warn: (message: string, context?: LogContext) => 
			log('warn', message, { ...baseContext, ...context }),
		error: (message: string, context?: LogContext) => 
			log('error', message, { ...baseContext, ...context }),
		child: (additionalContext: LogContext) => 
			createLogger({ ...baseContext, ...additionalContext })
	};
}

/**
 * Main logger instance
 */
export const logger = {
	debug: (message: string, context?: LogContext) => log('debug', message, context),
	info: (message: string, context?: LogContext) => log('info', message, context),
	warn: (message: string, context?: LogContext) => log('warn', message, context),
	error: (message: string, context?: LogContext) => log('error', message, context),
	
	/**
	 * Create a child logger with preset context
	 * @example
	 * const log = logger.child({ component: 'OrganizationAPI' });
	 * log.info('Creating organization', { name: 'Acme' });
	 */
	child: createLogger
};

export type { LogLevel, LogContext, LogEntry };
