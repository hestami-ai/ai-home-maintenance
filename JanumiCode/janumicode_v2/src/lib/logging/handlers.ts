/**
 * Log handlers - destinations for log entries.
 */

import type * as vscode from 'vscode';
import type { LogEntry, LogLevel } from './formatters';
import { ColorConsoleFormatter, HumanReadableFormatter } from './formatters';

export interface LogHandler {
  handle(entry: LogEntry): void;
  setLevel(level: LogLevel): void;
  dispose?(): void;
}

/**
 * Console handler - writes to stdout/stderr with colors.
 */
export class ConsoleHandler implements LogHandler {
  private level: LogLevel = 'DEBUG';
  private readonly formatter = new ColorConsoleFormatter();

  private readonly levelPriority: Record<LogLevel, number> = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
  };

  handle(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) return;

    const formatted = this.formatter.format(entry);

    // JANUMICODE_LOG_TO_STDERR=1 routes INFO/DEBUG to stderr so programmatic
    // CLI consumers (--json mode) get a clean stdout containing only the
    // HarnessResult. WARN/ERROR already go to stderr via console.warn.
    if (entry.level === 'ERROR' || entry.level === 'WARN') {
      console.warn(formatted);
    } else if (process.env.JANUMICODE_LOG_TO_STDERR === '1') {
      process.stderr.write(formatted + '\n');
    } else {
      console.log(formatted);
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levelPriority[level] >= this.levelPriority[this.level];
  }
}

/**
 * VS Code Output Channel handler.
 */
export class OutputChannelHandler implements LogHandler {
  private level: LogLevel = 'DEBUG';
  private readonly formatter = new HumanReadableFormatter();
  private channel: vscode.OutputChannel | null = null;

  private readonly levelPriority: Record<LogLevel, number> = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
  };

  /**
   * Set the VS Code Output Channel instance.
   * Called during extension activation.
   */
  setChannel(channel: vscode.OutputChannel): void {
    this.channel = channel;
  }

  handle(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) return;
    if (!this.channel) return;

    const formatted = this.formatter.format(entry);
    this.channel.appendLine(formatted);
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Show the output channel in VS Code.
   */
  show(): void {
    this.channel?.show(true);
  }

  /**
   * Clear the output channel.
   */
  clear(): void {
    this.channel?.clear();
  }

  dispose(): void {
    this.channel?.dispose();
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levelPriority[level] >= this.levelPriority[this.level];
  }
}

/**
 * No-op handler for testing or disabling logging.
 */
export class NullHandler implements LogHandler {
  handle(_entry: LogEntry): void {}
  setLevel(_level: LogLevel): void {}
}
