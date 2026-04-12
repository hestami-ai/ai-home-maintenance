/**
 * Log formatters - transform LogEntry into string output.
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
export type LogCategory =
  | 'activation'
  | 'workflow'
  | 'governed_stream'
  | 'agent'
  | 'cli'
  | 'llm'
  | 'context'
  | 'validation'
  | 'invariant'
  | 'phase_gate'
  | 'event'
  | 'ui'
  | 'embedding'
  | 'capability'
  | 'decision'
  | 'error';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  trace_id: string;
  workflow_run_id: string | null;
  phase_id: string | null;
  sub_phase_id: string | null;
  agent_role: string | null;
  category: LogCategory;
  message: string;
  data: Record<string, unknown>;
  duration_ms: number | null;
}

export interface LogFormatter {
  format(entry: LogEntry): string;
}

/**
 * Human-readable formatter for console output.
 * Format: [timestamp] LEVEL [trace_id] category: message {data}
 */
export class HumanReadableFormatter implements LogFormatter {
  format(entry: LogEntry): string {
    const parts: string[] = [];

    // Timestamp (HH:MM:SS.mmm)
    const ts = entry.timestamp.substring(11, 23);
    parts.push(`[${ts}]`);

    // Level with padding
    const level = entry.level.padEnd(5);
    parts.push(level);

    // Trace ID
    parts.push(`[${entry.trace_id}]`);

    // Context (phase/sub-phase/agent)
    const context = this.formatContext(entry);
    if (context) {
      parts.push(`(${context})`);
    }

    // Category
    parts.push(`${entry.category}:`);

    // Message
    parts.push(entry.message);

    // Duration
    if (entry.duration_ms !== null) {
      parts.push(`(${entry.duration_ms}ms)`);
    }

    // Data (if non-empty)
    const dataStr = this.formatData(entry.data);
    if (dataStr) {
      parts.push(dataStr);
    }

    return parts.join(' ');
  }

  private formatContext(entry: LogEntry): string {
    const parts: string[] = [];
    if (entry.phase_id) {
      parts.push(`P${entry.phase_id}`);
      if (entry.sub_phase_id) {
        parts.push(`.${entry.sub_phase_id}`);
      }
    }
    if (entry.agent_role) {
      parts.push(`[${entry.agent_role}]`);
    }
    return parts.join(' ');
  }

  private formatData(data: Record<string, unknown>): string {
    if (Object.keys(data).length === 0) return '';
    try {
      const json = JSON.stringify(data);
      if (json.length > 200) {
        return `{${json.substring(0, 197)}...}`;
      }
      return json;
    } catch {
      return '{[non-serializable]}';
    }
  }
}

/**
 * JSON formatter for structured log output.
 */
export class JsonFormatter implements LogFormatter {
  format(entry: LogEntry): string {
    return JSON.stringify(entry);
  }
}

/**
 * Color-coded console formatter with ANSI colors.
 */
export class ColorConsoleFormatter implements LogFormatter {
  private readonly humanFormatter = new HumanReadableFormatter();

  private readonly levelColors: Record<LogLevel, string> = {
    DEBUG: '\x1b[36m', // Cyan
    INFO: '\x1b[32m',  // Green
    WARN: '\x1b[33m',  // Yellow
    ERROR: '\x1b[31m', // Red
  };

  private readonly reset = '\x1b[0m';
  private readonly dim = '\x1b[2m';

  format(entry: LogEntry): string {
    const formatted = this.humanFormatter.format(entry);
    
    // Color the level
    const levelColor = this.levelColors[entry.level];
    const colored = formatted.replace(
      entry.level.padEnd(5),
      `${levelColor}${entry.level}${this.reset} `
    );

    // Dim the timestamp
    const ts = entry.timestamp.substring(11, 23);
    const dimmed = colored.replace(
      `[${ts}]`,
      `${this.dim}[${ts}]${this.reset}`
    );

    return dimmed;
  }
}

/**
 * Generate a unique log entry ID.
 */
export function generateLogEntryId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
