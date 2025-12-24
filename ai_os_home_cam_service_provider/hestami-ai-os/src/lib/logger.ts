/**
 * Production-ready logger for client-side with server proxy
 * 
 * Features:
 * - Environment-aware log levels
 * - Structured logging with context
 * - Batched log shipping to server (proxied to OTEL)
 * - sendBeacon for reliable delivery on page unload
 * - Error boundary integration
 * - Tree-shakeable debug logs in production
 * 
 * Usage:
 *   import { logger } from '$lib/logger';
 *   logger.info('User logged in', { userId: '123' });
 *   logger.debug('Detailed info', { data }); // Stripped in production
 *   logger.captureError(error, { component: 'MyComponent' }); // For error boundaries
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
	url?: string;
	userAgent?: string;
	sessionId?: string;
}

interface ClientLogPayload {
	logs: LogEntry[];
	clientInfo: {
		url: string;
		userAgent: string;
		screenSize: string;
		timezone: string;
		sessionId: string;
	};
}

const LOG_LEVELS: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3
};

// =============================================================================
// Client-side log buffer and shipping
// =============================================================================

const LOG_BUFFER: LogEntry[] = [];
const BATCH_SIZE = 10;
const BATCH_INTERVAL_MS = 5000;
const LOG_ENDPOINT = '/api/v1/logs';

let batchTimer: ReturnType<typeof setTimeout> | null = null;
let sessionId: string | null = null;

function getSessionId(): string {
	if (!browser) return 'server';
	if (sessionId) return sessionId;
	
	// Try to get from sessionStorage, or create new
	sessionId = sessionStorage.getItem('log_session_id');
	if (!sessionId) {
		sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
		sessionStorage.setItem('log_session_id', sessionId);
	}
	return sessionId;
}

function getClientInfo(): ClientLogPayload['clientInfo'] {
	if (!browser) {
		return {
			url: 'server',
			userAgent: 'server',
			screenSize: 'server',
			timezone: 'UTC',
			sessionId: 'server'
		};
	}
	return {
		url: window.location.href,
		userAgent: navigator.userAgent,
		screenSize: `${window.innerWidth}x${window.innerHeight}`,
		timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
		sessionId: getSessionId()
	};
}

function flushLogs(): void {
	if (!browser || LOG_BUFFER.length === 0) return;

	const logsToSend = LOG_BUFFER.splice(0, LOG_BUFFER.length);
	const payload: ClientLogPayload = {
		logs: logsToSend,
		clientInfo: getClientInfo()
	};

	const body = JSON.stringify(payload);

	// Use sendBeacon if available (works on page unload)
	if (navigator.sendBeacon) {
		const blob = new Blob([body], { type: 'application/json' });
		const sent = navigator.sendBeacon(LOG_ENDPOINT, blob);
		if (!sent) {
			// Fallback to fetch if sendBeacon fails
			sendViaFetch(body);
		}
	} else {
		sendViaFetch(body);
	}
}

function sendViaFetch(body: string): void {
	fetch(LOG_ENDPOINT, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body,
		keepalive: true // Allows request to outlive the page
	}).catch(() => {
		// Silently fail - we don't want logging to break the app
	});
}

function scheduleBatch(): void {
	if (batchTimer) return;
	
	batchTimer = setTimeout(() => {
		batchTimer = null;
		flushLogs();
	}, BATCH_INTERVAL_MS);
}

function addToBuffer(entry: LogEntry): void {
	if (!browser) return;
	
	LOG_BUFFER.push(entry);
	
	// Flush immediately if buffer is full or if it's an error
	if (LOG_BUFFER.length >= BATCH_SIZE || entry.level === 'error') {
		if (batchTimer) {
			clearTimeout(batchTimer);
			batchTimer = null;
		}
		flushLogs();
	} else {
		scheduleBatch();
	}
}

// Register page unload handler to flush remaining logs
if (browser) {
	window.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden') {
			flushLogs();
		}
	});
	
	window.addEventListener('pagehide', () => {
		flushLogs();
	});
}

// =============================================================================
// Log level and formatting
// =============================================================================

function getLogLevel(): LogLevel {
	if (browser) {
		// Client-side: check localStorage or default based on hostname
		try {
			const stored = localStorage.getItem('LOG_LEVEL');
			if (stored && stored in LOG_LEVELS) return stored as LogLevel;
		} catch {
			// localStorage not available
		}
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

function shouldShipToServer(level: LogLevel): boolean {
	// Only ship warn and error to server to reduce noise
	return browser && LOG_LEVELS[level] >= LOG_LEVELS['warn'];
}

function formatMessage(entry: LogEntry): string {
	const parts = [
		`[${entry.timestamp}]`,
		`[${entry.level.toUpperCase()}]`,
		entry.message
	];
	
	return parts.join(' ');
}

function createLogEntry(level: LogLevel, message: string, context?: LogContext): LogEntry {
	const entry: LogEntry = {
		level,
		message,
		timestamp: new Date().toISOString(),
		context
	};

	if (browser) {
		entry.url = window.location.href;
		entry.sessionId = getSessionId();
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

	// Ship to server if appropriate
	if (shouldShipToServer(level)) {
		addToBuffer(entry);
	}
}

// =============================================================================
// Error capture utilities
// =============================================================================

/**
 * Serialize an error object for logging
 */
function serializeError(error: unknown): Record<string, unknown> {
	if (error instanceof Error) {
		return {
			name: error.name,
			message: error.message,
			stack: error.stack,
			...(error.cause ? { cause: serializeError(error.cause) } : {})
		};
	}
	if (typeof error === 'string') {
		return { message: error };
	}
	return { value: String(error) };
}

/**
 * Capture and log an error with full context
 * Use this in error boundaries and catch blocks
 */
function captureError(error: unknown, context?: LogContext): void {
	const errorInfo = serializeError(error);
	log('error', errorInfo.message as string || 'Unknown error', {
		...context,
		error: errorInfo
	});
}

/**
 * Capture unhandled promise rejections
 */
function captureUnhandledRejection(event: PromiseRejectionEvent): void {
	captureError(event.reason, {
		type: 'unhandledRejection',
		promise: String(event.promise)
	});
}

/**
 * Capture global errors
 */
function captureGlobalError(event: ErrorEvent): void {
	captureError(event.error || event.message, {
		type: 'globalError',
		filename: event.filename,
		lineno: event.lineno,
		colno: event.colno
	});
}

// Register global error handlers
if (browser) {
	window.addEventListener('unhandledrejection', captureUnhandledRejection);
	window.addEventListener('error', captureGlobalError);
}

// =============================================================================
// Logger API
// =============================================================================

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
		captureError: (error: unknown, context?: LogContext) =>
			captureError(error, { ...baseContext, ...context }),
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
	 * Capture and log an error with full context
	 * @example
	 * try { ... } catch (e) { logger.captureError(e, { component: 'MyComponent' }); }
	 */
	captureError,
	
	/**
	 * Manually flush all buffered logs to server
	 * Useful before navigation or when you need immediate delivery
	 */
	flush: flushLogs,
	
	/**
	 * Create a child logger with preset context
	 * @example
	 * const log = logger.child({ component: 'OrganizationAPI' });
	 * log.info('Creating organization', { name: 'Acme' });
	 */
	child: createLogger
};

export type { LogLevel, LogContext, LogEntry, ClientLogPayload };
