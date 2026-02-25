/**
 * Structured Logger Service
 * Provides structured, leveled logging with VS Code OutputChannel integration,
 * child loggers for component scoping, and contextual metadata propagation.
 *
 * Usage:
 *   import { getLogger } from '../logging';
 *   const logger = getLogger();                         // root logger
 *   const cliLog = logger.child({ component: 'cli' }); // scoped child
 *   cliLog.info('Provider resolved', { role: 'executor', providerId: 'claude-code' });
 */

import * as vscode from 'vscode';
import { LogLevel, logLevelLabel, parseLogLevel } from './levels';

/**
 * Contextual metadata attached to every log entry produced by a logger or its children.
 * Fields are merged: child context overrides parent context for same-named keys.
 */
export interface LogContext {
	/** Scoped component name, e.g. 'cli', 'cli:gemini', 'orchestrator' */
	component?: string;
	/** Active dialogue ID for correlation */
	dialogueId?: string;
	/** Active workflow role */
	role?: string;
	/** Active workflow phase */
	phase?: string;
	/** CLI provider ID */
	providerId?: string;
	/** Arbitrary extra fields */
	[key: string]: unknown;
}

/**
 * A single structured log entry.
 */
export interface LogEntry {
	timestamp: string;
	level: LogLevel;
	levelLabel: string;
	component: string;
	message: string;
	data?: Record<string, unknown>;
	context: LogContext;
}

/**
 * Logger class — the core structured logging primitive.
 *
 * - Writes formatted messages to a VS Code OutputChannel (visible in Output panel).
 * - Supports configurable minimum log level.
 * - Supports child loggers that inherit and extend parent context.
 * - Keeps a bounded in-memory ring buffer of recent entries for diagnostics.
 */
export class Logger {
	private readonly _context: LogContext;
	private readonly _parent: Logger | null;

	/** Shared mutable state across the logger tree */
	private readonly _shared: SharedLoggerState;

	private constructor(
		shared: SharedLoggerState,
		context: LogContext,
		parent: Logger | null
	) {
		this._shared = shared;
		this._context = context;
		this._parent = parent;
	}

	/**
	 * Create the root logger.
	 * Called once during extension activation.
	 */
	static createRoot(outputChannel: vscode.OutputChannel): Logger {
		const shared: SharedLoggerState = {
			outputChannel,
			minLevel: parseLogLevel(
				vscode.workspace.getConfiguration('janumicode').get<string>('logLevel')
			),
			buffer: [],
			bufferMaxSize: 2000,
		};
		return new Logger(shared, { component: 'janumicode' }, null);
	}

	/**
	 * Create a child logger with additional/overridden context.
	 * The child inherits all parent context and merges the provided fields.
	 */
	child(context: LogContext): Logger {
		const merged: LogContext = { ...this.resolvedContext(), ...context };
		return new Logger(this._shared, merged, this);
	}

	/**
	 * Update the minimum log level at runtime (e.g. when config changes).
	 */
	setLevel(level: LogLevel): void {
		this._shared.minLevel = level;
	}

	/**
	 * Get the current minimum log level.
	 */
	getLevel(): LogLevel {
		return this._shared.minLevel;
	}

	// ── Public log methods ────────────────────────────────────────────

	debug(message: string, data?: Record<string, unknown>): void {
		this.log(LogLevel.DEBUG, message, data);
	}

	info(message: string, data?: Record<string, unknown>): void {
		this.log(LogLevel.INFO, message, data);
	}

	warn(message: string, data?: Record<string, unknown>): void {
		this.log(LogLevel.WARN, message, data);
	}

	error(message: string, data?: Record<string, unknown>): void {
		this.log(LogLevel.ERROR, message, data);
	}

	// ── Diagnostics ───────────────────────────────────────────────────

	/**
	 * Return the most recent N log entries from the ring buffer.
	 */
	getRecentEntries(count: number = 50): readonly LogEntry[] {
		const buf = this._shared.buffer;
		return buf.slice(Math.max(0, buf.length - count));
	}

	/**
	 * Return the underlying VS Code OutputChannel (e.g. for the error handler to share).
	 */
	getOutputChannel(): vscode.OutputChannel {
		return this._shared.outputChannel;
	}

	// ── Internal ──────────────────────────────────────────────────────

	private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
		if (level < this._shared.minLevel) {
			return;
		}

		const ctx = this.resolvedContext();
		const entry: LogEntry = {
			timestamp: new Date().toISOString(),
			level,
			levelLabel: logLevelLabel(level),
			component: (ctx.component as string) ?? 'janumicode',
			message,
			data,
			context: ctx,
		};

		// Write to OutputChannel
		this._shared.outputChannel.appendLine(formatLogEntry(entry));

		// Ring buffer
		this._shared.buffer.push(entry);
		if (this._shared.buffer.length > this._shared.bufferMaxSize) {
			this._shared.buffer.splice(0, this._shared.buffer.length - this._shared.bufferMaxSize);
		}
	}

	/**
	 * Walk the parent chain and merge all context, child overriding parent.
	 */
	private resolvedContext(): LogContext {
		if (!this._parent) {
			return { ...this._context };
		}
		return { ...this._parent.resolvedContext(), ...this._context };
	}
}

// ── Shared mutable state ──────────────────────────────────────────────

interface SharedLoggerState {
	outputChannel: vscode.OutputChannel;
	minLevel: LogLevel;
	buffer: LogEntry[];
	bufferMaxSize: number;
}

// ── Formatting ────────────────────────────────────────────────────────

/**
 * Format a log entry into a human-readable line for the OutputChannel.
 *
 * Format:
 *   [2026-02-17T15:35:43.123Z] [WARN] [cli:gemini] Message here  {key=value, ...}
 */
function stringifyValue(val: unknown): string {
	if (val === undefined || val === null) {
		return '';
	}
	return typeof val === 'object' ? JSON.stringify(val) : String(val);
}

function formatKeyValuePairs(obj: Record<string, unknown>): string {
	return Object.entries(obj)
		.filter(([, v]) => v !== undefined && v !== null && v !== '')
		.map(([k, v]) => `${k}=${stringifyValue(v)}`)
		.join(', ');
}

function formatLogEntry(entry: LogEntry): string {
	const ts = entry.timestamp;
	const lvl = entry.levelLabel.padEnd(5);
	const comp = entry.component;

	// Build context suffix — only include correlation fields, skip 'component'
	const { component: _comp, ...contextRest } = entry.context;
	const ctxStr = formatKeyValuePairs(contextRest);
	const dataStr = entry.data ? formatKeyValuePairs(entry.data) : '';

	let line = `[${ts}] [${lvl}] [${comp}]  ${entry.message}`;
	if (ctxStr) {
		line += `  {${ctxStr}}`;
	}
	if (dataStr) {
		line += `  ${dataStr}`;
	}
	return line;
}

// ── Singleton ─────────────────────────────────────────────────────────

let rootLogger: Logger | null = null;

/**
 * Initialize the root logger. Must be called once during extension activation.
 * Returns the root logger instance.
 */
export function initializeLogger(outputChannel: vscode.OutputChannel): Logger {
	rootLogger = Logger.createRoot(outputChannel);
	return rootLogger;
}

/**
 * Get the root logger. Throws if called before `initializeLogger()`.
 *
 * Prefer creating a child logger for each module:
 *   const logger = getLogger().child({ component: 'myModule' });
 */
export function getLogger(): Logger {
	if (!rootLogger) {
		throw new Error(
			'Logger not initialized. Call initializeLogger() during extension activation.'
		);
	}
	return rootLogger;
}

/**
 * Check whether the logger has been initialized.
 * Useful for guard clauses in code that may run before activation.
 */
export function isLoggerInitialized(): boolean {
	return rootLogger !== null;
}
