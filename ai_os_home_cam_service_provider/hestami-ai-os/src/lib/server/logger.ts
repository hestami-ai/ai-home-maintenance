import type { RequestContext } from './api/context.js';

/**
 * Log levels
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Structured log entry
 */
export interface LogEntry {
	level: LogLevel;
	message: string;
	timestamp: string;
	requestId?: string;
	traceId?: string | null;
	spanId?: string | null;
	organizationId?: string;
	userId?: string;
	[key: string]: unknown;
}

/**
 * Current log level based on environment
 */
const LOG_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 
	(process.env.NODE_ENV === 'production' ? 'info' : 'debug');

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3
};

/**
 * Check if a log level should be output
 */
function shouldLog(level: LogLevel): boolean {
	return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[LOG_LEVEL];
}

/**
 * Format and output a log entry
 */
function output(entry: LogEntry): void {
	if (!shouldLog(entry.level)) return;

	const json = JSON.stringify(entry);
	
	switch (entry.level) {
		case 'error':
			console.error(json);
			break;
		case 'warn':
			console.warn(json);
			break;
		default:
			console.log(json);
	}
}

/**
 * Create a log entry with common fields
 */
function createEntry(
	level: LogLevel,
	message: string,
	context?: RequestContext,
	extra?: Record<string, unknown>
): LogEntry {
	return {
		level,
		message,
		timestamp: new Date().toISOString(),
		requestId: context?.requestId,
		traceId: context?.traceId,
		spanId: context?.spanId,
		organizationId: context?.organization?.id,
		userId: context?.user?.id,
		...extra
	};
}

/**
 * Logger with context support
 */
export const logger = {
	debug(message: string, context?: RequestContext, extra?: Record<string, unknown>): void {
		output(createEntry('debug', message, context, extra));
	},

	info(message: string, context?: RequestContext, extra?: Record<string, unknown>): void {
		output(createEntry('info', message, context, extra));
	},

	warn(message: string, context?: RequestContext, extra?: Record<string, unknown>): void {
		output(createEntry('warn', message, context, extra));
	},

	error(message: string, context?: RequestContext, extra?: Record<string, unknown>): void {
		output(createEntry('error', message, context, extra));
	},

	/**
	 * Log an error with stack trace
	 */
	exception(error: Error, context?: RequestContext, extra?: Record<string, unknown>): void {
		output(createEntry('error', error.message, context, {
			...extra,
			errorName: error.name,
			stack: error.stack
		}));
	}
};

/**
 * Create a child logger with bound context
 */
export function createLogger(context: RequestContext) {
	return {
		debug: (message: string, extra?: Record<string, unknown>) => 
			logger.debug(message, context, extra),
		info: (message: string, extra?: Record<string, unknown>) => 
			logger.info(message, context, extra),
		warn: (message: string, extra?: Record<string, unknown>) => 
			logger.warn(message, context, extra),
		error: (message: string, extra?: Record<string, unknown>) => 
			logger.error(message, context, extra),
		exception: (error: Error, extra?: Record<string, unknown>) => 
			logger.exception(error, context, extra)
	};
}
