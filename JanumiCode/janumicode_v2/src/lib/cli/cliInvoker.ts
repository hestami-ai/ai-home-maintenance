/**
 * CLIInvoker — spawns CLI-backed agents as child processes.
 * Based on JanumiCode Spec v2.3, §16.
 *
 * Pipes stdin content, streams stdout via OutputParser,
 * handles process lifecycle (timeout, idle timeout, SIGTERM/SIGKILL).
 */

import { spawn, type ChildProcess } from 'child_process';
import { type OutputParser, type ParsedEvent } from './outputParser';

// ── Types ───────────────────────────────────────────────────────────

export interface CLIInvocationOptions {
  /** Command to execute (e.g., 'claude') */
  command: string;
  /** Command arguments */
  args: string[];
  /** Stdin content to pipe */
  stdinContent: string;
  /** Working directory */
  cwd: string;
  /** Environment variables (merged with process.env) */
  env?: Record<string, string>;
  /** Process timeout in seconds (default: 600) */
  timeoutSeconds?: number;
  /** Idle timeout in seconds — no stdout for this long (default: 120) */
  idleTimeoutSeconds?: number;
  /** Maximum buffered events before backpressure (default: 1000) */
  bufferMaxEvents?: number;
  /** Output parser for this backing tool */
  outputParser: OutputParser;
  /**
   * Optional live-chunk callbacks. When provided, every stdout/stderr byte
   * arriving on the pipe is reported before the process exits, so the
   * webview card can render live output. The governed-stream write
   * happens inside AgentInvoker, which adapts these chunks into
   * `agent_output_chunk` records.
   */
  onStdoutChunk?: (text: string) => void;
  onStderrChunk?: (text: string) => void;
}

export interface CLIInvocationResult {
  /** Process exit code */
  exitCode: number | null;
  /** Whether the process was killed by timeout */
  timedOut: boolean;
  /** Whether the process was killed by idle timeout */
  idledOut: boolean;
  /** All parsed events from stdout */
  events: ParsedEvent[];
  /** Raw stderr output */
  stderr: string;
  /** Duration in milliseconds */
  durationMs: number;
}

// ── CLIInvoker ──────────────────────────────────────────────────────

export class CLIInvoker {
  /**
   * Invoke a CLI-backed agent and capture its execution trace.
   */
  async invoke(options: CLIInvocationOptions): Promise<CLIInvocationResult> {
    const timeoutMs = (options.timeoutSeconds ?? 600) * 1000;
    const idleTimeoutMs = (options.idleTimeoutSeconds ?? 120) * 1000;
    const startTime = Date.now();

    return new Promise<CLIInvocationResult>((resolve) => {
      const events: ParsedEvent[] = [];
      let stderr = '';
      let timedOut = false;
      let idledOut = false;
      let idleTimer: ReturnType<typeof setTimeout> | null = null;
      let processTimer: ReturnType<typeof setTimeout> | null = null;

      // Merge environment
      const env = { ...process.env, ...options.env };

      // Spawn child process
      const child: ChildProcess = spawn(options.command, options.args, {
        cwd: options.cwd,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: process.platform === 'win32', // Use shell on Windows for PATH resolution
      });

      // ── Stdout handling ──────────────────────────────────────

      let stdoutBuffer = '';

      child.stdout?.on('data', (chunk: Buffer) => {
        // Reset idle timer on any output
        resetIdleTimer();

        const chunkText = chunk.toString('utf-8');
        stdoutBuffer += chunkText;

        // Forward the raw chunk to the live callback so the webview card
        // sees it immediately, before parsing / record-type classification.
        options.onStdoutChunk?.(chunkText);

        // Process complete lines
        const lines = stdoutBuffer.split('\n');
        stdoutBuffer = lines.pop() ?? ''; // Keep incomplete last line

        for (const line of lines) {
          if (!line.trim()) continue;
          const parsed = options.outputParser.parseLine(line);
          // parseLine now returns an array — a single Claude Code
          // envelope can carry multiple logical events (a text block
          // plus N tool_use blocks). Treat each one independently.
          for (const event of parsed) events.push(event);
        }
      });

      // ── Stderr handling ──────────────────────────────────────

      child.stderr?.on('data', (chunk: Buffer) => {
        const chunkText = chunk.toString('utf-8');
        stderr += chunkText;
        options.onStderrChunk?.(chunkText);
      });

      // ── Process exit ─────────────────────────────────────────

      child.on('close', (code) => {
        clearTimers();

        // Process any remaining buffered stdout
        if (stdoutBuffer.trim()) {
          const parsed = options.outputParser.parseLine(stdoutBuffer);
          for (const event of parsed) events.push(event);
        }

        resolve({
          exitCode: code,
          timedOut,
          idledOut,
          events,
          stderr,
          durationMs: Date.now() - startTime,
        });
      });

      child.on('error', (err) => {
        clearTimers();
        stderr += `\nProcess error: ${err.message}`;
        resolve({
          exitCode: null,
          timedOut,
          idledOut,
          events,
          stderr,
          durationMs: Date.now() - startTime,
        });
      });

      // ── Pipe stdin ───────────────────────────────────────────

      if (child.stdin) {
        child.stdin.write(options.stdinContent);
        child.stdin.end();
      }

      // ── Timeouts ─────────────────────────────────────────────

      // Process timeout
      processTimer = setTimeout(() => {
        timedOut = true;
        killProcess(child);
      }, timeoutMs);

      // Idle timeout
      function resetIdleTimer() {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          idledOut = true;
          killProcess(child);
        }, idleTimeoutMs);
      }

      resetIdleTimer();

      function clearTimers() {
        if (processTimer) clearTimeout(processTimer);
        if (idleTimer) clearTimeout(idleTimer);
      }

      function killProcess(proc: ChildProcess) {
        try {
          if (process.platform === 'win32') {
            proc.kill(); // SIGTERM equivalent on Windows
          } else {
            proc.kill('SIGTERM');
            // SIGKILL after 10s if still running
            setTimeout(() => {
              try { proc.kill('SIGKILL'); } catch { /* already dead */ }
            }, 10000);
          }
        } catch { /* already dead */ }
      }
    });
  }
}
