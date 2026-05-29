/**
 * AODD log handler.
 *
 * Per design memo §6: `Logger` (src/lib/logging/logger.ts) becomes an
 * AODD capture surface. This handler translates each `LogEntry` into a
 * `log.<level>` AODD trace event.
 *
 * Wiring: in P2, this handler is registered via the new
 * `logger.addHandler()` seam at orchestrator boot. It runs alongside
 * the existing ConsoleHandler / OutputChannelHandler — none of those
 * are removed.
 *
 * Default level: DEBUG (capture more, prune at retention; principle 3).
 * Override via `JANUMICODE_AODD_LOG_LEVEL` env var.
 */

import type { LogEntry, LogLevel } from '../logging/formatters';
import type { LogHandler } from '../logging/handlers';
import type { Logger } from '../logging/logger';
import { emit, isAoddEnabled } from './emit';
import type { AoddEventType, LogPayload } from './types';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

function levelToEventType(level: LogLevel): AoddEventType {
  switch (level) {
    case 'DEBUG':
      return 'log.debug';
    case 'INFO':
      return 'log.info';
    case 'WARN':
      return 'log.warn';
    case 'ERROR':
      return 'log.error';
  }
}

export class AoddLogHandler implements LogHandler {
  private level: LogLevel;

  constructor(initialLevel?: LogLevel) {
    const envLevel = process.env.JANUMICODE_AODD_LOG_LEVEL as
      | LogLevel
      | undefined;
    this.level = envLevel ?? initialLevel ?? 'DEBUG';
  }

  handle(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) return;
    if (!isAoddEnabled()) return;

    const payload: LogPayload = {
      trace_id: entry.trace_id,
      category: entry.category,
      message: entry.message,
      data: entry.data,
      duration_ms: entry.duration_ms,
    };

    emit(levelToEventType(entry.level), payload);
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[this.level];
  }
}

// ── Registration helper (idempotent) ────────────────────────────────

let registeredHandler: AoddLogHandler | null = null;
let registeredDispose: (() => void) | null = null;

/**
 * Register an AoddLogHandler with the given Logger. Idempotent — a
 * second call returns the dispose for the existing registration rather
 * than adding a duplicate handler.
 *
 * Called once from orchestrator boot (orchestratorEngine.ts). Tests
 * that want a fresh registration should call `unregisterAoddLogHandler()`
 * first.
 */
export function registerAoddLogHandler(logger: Logger): () => void {
  if (registeredHandler && registeredDispose) {
    return registeredDispose;
  }
  const handler = new AoddLogHandler();
  const removeFromLogger = logger.addHandler(handler);
  registeredHandler = handler;
  registeredDispose = () => {
    removeFromLogger();
    registeredHandler = null;
    registeredDispose = null;
  };
  return registeredDispose;
}

/** Detach the registered AoddLogHandler from its Logger (if any). */
export function unregisterAoddLogHandler(): void {
  registeredDispose?.();
}
