/**
 * Logger - main logging class with levels, context, and handlers.
 */

import type { TraceContext } from './traceContext';
import type { LogCategory, LogEntry, LogLevel } from './formatters';
import { generateLogEntryId } from './formatters';
import type { LogHandler } from './handlers';
import { ConsoleHandler, OutputChannelHandler } from './handlers';

export interface LoggerOptions {
  /** Minimum log level (default: INFO) */
  level?: LogLevel;
  /** Enable console output (default: true) */
  consoleEnabled?: boolean;
  /** Enable VS Code Output Channel (default: true) */
  outputChannelEnabled?: boolean;
  /** Per-category log level overrides */
  categoryLevels?: Record<string, LogLevel>;
}

/**
 * Logger instance with context and handlers.
 */
export class Logger {
  private handlers: LogHandler[] = [];
  private level: LogLevel;
  private categoryLevels: Record<string, LogLevel>;
  private context: Partial<TraceContext> = {};

  private readonly levelPriority: Record<LogLevel, number> = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
  };

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? 'INFO';
    this.categoryLevels = options.categoryLevels ?? {};

    if (options.consoleEnabled !== false) {
      this.handlers.push(new ConsoleHandler());
    }
  }

  /**
   * Set the VS Code Output Channel handler.
   * Called during extension activation.
   */
  setOutputChannel(handler: OutputChannelHandler): void {
    // Remove any existing OutputChannelHandler
    this.handlers = this.handlers.filter(h => !(h instanceof OutputChannelHandler));
    this.handlers.push(handler);
  }

  /**
   * Set the default log level.
   */
  setLevel(level: LogLevel): void {
    this.level = level;
    for (const handler of this.handlers) {
      handler.setLevel(level);
    }
  }

  /**
   * Set per-category log level.
   */
  setCategoryLevel(category: LogCategory, level: LogLevel): void {
    this.categoryLevels[category] = level;
  }

  /**
   * Set context fields that will be included in all log entries.
   */
  setContext(context: Partial<TraceContext>): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * Clear context fields.
   */
  clearContext(): void {
    this.context = {};
  }

  /**
   * Create a child logger with additional context.
   */
  child(context: Partial<TraceContext>): Logger {
    const childLogger = new Logger({
      level: this.level,
      categoryLevels: { ...this.categoryLevels },
    });
    childLogger.handlers = this.handlers;
    childLogger.context = { ...this.context, ...context };
    return childLogger;
  }

  // ---------------------------------------------------------------------------
  // Logging methods
  // ---------------------------------------------------------------------------

  /**
   * Log a DEBUG message.
   */
  debug(category: LogCategory, message: string, data?: Record<string, unknown>, trace?: TraceContext): void {
    this.log('DEBUG', category, message, data, trace);
  }

  /**
   * Log an INFO message.
   */
  info(category: LogCategory, message: string, data?: Record<string, unknown>, trace?: TraceContext): void {
    this.log('INFO', category, message, data, trace);
  }

  /**
   * Log a WARN message.
   */
  warn(category: LogCategory, message: string, data?: Record<string, unknown>, trace?: TraceContext): void {
    this.log('WARN', category, message, data, trace);
  }

  /**
   * Log an ERROR message.
   */
  error(category: LogCategory, message: string, data?: Record<string, unknown>, trace?: TraceContext): void {
    this.log('ERROR', category, message, data, trace);
  }

  /**
   * Log an error with stack trace.
   */
  errorWithStack(category: LogCategory, message: string, err: Error, trace?: TraceContext): void {
    this.log('ERROR', category, message, {
      error: err.message,
      stack: err.stack,
    }, trace);
  }

  // ---------------------------------------------------------------------------
  // Timed operations
  // ---------------------------------------------------------------------------

  /**
   * Start a timed operation. Returns a function to call when done.
   */
  time(category: LogCategory, message: string, trace?: TraceContext): () => void {
    const startTime = Date.now();
    return () => {
      const durationMs = Date.now() - startTime;
      this.log('INFO', category, message, undefined, trace, durationMs);
    };
  }

  /**
   * Start a timed operation that logs on completion.
   */
  async timeAsync<T>(
    category: LogCategory,
    message: string,
    fn: () => Promise<T>,
    trace?: TraceContext
  ): Promise<T> {
    const startTime = Date.now();
    try {
      const result = await fn();
      const durationMs = Date.now() - startTime;
      this.log('INFO', category, message, undefined, trace, durationMs);
      return result;
    } catch (err) {
      const durationMs = Date.now() - startTime;
      this.log('ERROR', category, `${message} (failed)`, {
        error: err instanceof Error ? err.message : String(err),
      }, trace, durationMs);
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  log(
    level: LogLevel,
    category: LogCategory,
    message: string,
    data?: Record<string, unknown>,
    trace?: TraceContext,
    durationMs?: number
  ): void {
    // Check level
    const effectiveLevel = this.categoryLevels[category] ?? this.level;
    if (this.levelPriority[level] < this.levelPriority[effectiveLevel]) {
      return;
    }

    const entry: LogEntry = {
      id: generateLogEntryId(),
      timestamp: new Date().toISOString(),
      level,
      trace_id: trace?.trace_id ?? this.context.trace_id ?? '-',
      workflow_run_id: trace?.workflow_run_id ?? this.context.workflow_run_id ?? null,
      phase_id: trace?.phase_id ?? this.context.phase_id ?? null,
      sub_phase_id: trace?.sub_phase_id ?? this.context.sub_phase_id ?? null,
      agent_role: trace?.agent_role ?? this.context.agent_role ?? null,
      category,
      message,
      data: data ?? {},
      duration_ms: durationMs ?? null,
    };

    for (const handler of this.handlers) {
      handler.handle(entry);
    }
  }
}

// ---------------------------------------------------------------------------
// Global logger instance
// ---------------------------------------------------------------------------

let globalLogger: Logger | null = null;

/**
 * Get the global logger instance.
 */
export function getLogger(): Logger {
  if (!globalLogger) {
    globalLogger = new Logger();
  }
  return globalLogger;
}

/**
 * Set the global logger instance.
 */
export function setLogger(logger: Logger): void {
  globalLogger = logger;
}

/**
 * Convenience: log using the global logger.
 */
export function log(
  level: LogLevel,
  category: LogCategory,
  message: string,
  data?: Record<string, unknown>,
  trace?: TraceContext
): void {
  getLogger().log(level, category, message, data, trace);
}

/**
 * Convenience: log INFO using the global logger.
 */
export function logInfo(
  category: LogCategory,
  message: string,
  data?: Record<string, unknown>,
  trace?: TraceContext
): void {
  getLogger().info(category, message, data, trace);
}

/**
 * Convenience: log DEBUG using the global logger.
 */
export function logDebug(
  category: LogCategory,
  message: string,
  data?: Record<string, unknown>,
  trace?: TraceContext
): void {
  getLogger().debug(category, message, data, trace);
}

/**
 * Convenience: log WARN using the global logger.
 */
export function logWarn(
  category: LogCategory,
  message: string,
  data?: Record<string, unknown>,
  trace?: TraceContext
): void {
  getLogger().warn(category, message, data, trace);
}

/**
 * Convenience: log ERROR using the global logger.
 */
export function logError(
  category: LogCategory,
  message: string,
  data?: Record<string, unknown>,
  trace?: TraceContext
): void {
  getLogger().error(category, message, data, trace);
}
