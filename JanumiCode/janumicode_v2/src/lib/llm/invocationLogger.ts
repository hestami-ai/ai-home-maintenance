/**
 * InvocationLogger — per-LLM-call live log file for debugging hangs
 * and loops during live Ollama runs.
 *
 * The runner opens one `<invocation_id>.log` per call under
 * `<workspace>/.janumicode/live/`. Each file contains, in order:
 *
 *   1. A human-readable header with provider/model/role/sub-phase plus
 *      the full rendered prompt and system message. Lets you see
 *      exactly what was sent to the model WITHOUT waiting for the
 *      governed_stream DB to commit and without opening SQLite.
 *
 *   2. A streaming tail: one line per chunk as it arrives, timestamped
 *      and annotated with channel (response/thinking). `tail -f` on
 *      the file shows token-level progress in real time.
 *
 *   3. A trailer written on completion: final text, thinking chain,
 *      token counts, duration, status. If the call hangs or errors,
 *      the trailer is replaced with an error marker so the file always
 *      tells you what happened.
 *
 * The file is flushed on every chunk so an aborted process still
 * leaves a useful artifact — the previous capture run lost 1h of
 * qwen3 output because nothing was persisted until the CLI exited.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export interface InvocationLogHeader {
  invocationId: string;
  provider: string;
  model: string;
  agentRole: string | null;
  phaseId: string | null;
  subPhaseId: string | null;
  label: string | null;
  prompt: string;
  system: string | null;
  startedAt: string;
}

export interface InvocationLogFinal {
  status: 'success' | 'error' | 'aborted';
  text: string;
  thinking: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  durationMs: number;
  retryAttempts: number;
  errorMessage?: string;
}

/**
 * Append-only writer for a single invocation log file. Thread-safe as
 * long as only one call runs at a time for a given invocationId —
 * which is the LLMCaller's own invariant.
 */
export class InvocationLogFile {
  private readonly filePath: string;
  private opened = false;
  private _bytesWritten = 0;

  constructor(private readonly logDir: string, invocationId: string) {
    this.filePath = path.join(logDir, `${invocationId}.log`);
  }

  get path(): string { return this.filePath; }

  /**
   * Running total of bytes appended to the log file across header +
   * chunks + trailer. Exposed so LLMCaller can trip a retryable abort
   * when a single invocation's log balloons past a sanity ceiling —
   * that's the surest signal a thinking-mode loop is stuck, since the
   * log grows monotonically whenever the model keeps streaming.
   */
  get bytesWritten(): number { return this._bytesWritten; }

  /** Write the header block. Call once at invocation start. */
  writeHeader(header: InvocationLogHeader): void {
    try {
      fs.mkdirSync(this.logDir, { recursive: true });
      const lines = [
        '═'.repeat(72),
        `  invocation_id   : ${header.invocationId}`,
        `  started_at      : ${header.startedAt}`,
        `  provider/model  : ${header.provider}/${header.model}`,
        `  agent_role      : ${header.agentRole ?? '(none)'}`,
        `  phase/sub_phase : ${header.phaseId ?? '-'} / ${header.subPhaseId ?? '-'}`,
        `  label           : ${header.label ?? '(none)'}`,
        '─'.repeat(72),
        header.system ? `SYSTEM:\n${header.system}\n${'─'.repeat(72)}` : '',
        'PROMPT:',
        header.prompt,
        '═'.repeat(72),
        'STREAM (channel | ms-since-start | cumulative-chars | text):',
        '',
      ].filter((s) => s !== '').join('\n');
      const payload = lines + '\n';
      fs.writeFileSync(this.filePath, payload, { flag: 'w' });
      this._bytesWritten = Buffer.byteLength(payload);
      this.opened = true;
    } catch {
      // Best-effort — logging must never break the call path.
    }
  }

  /** Append one streaming chunk. Called once per provider frame. */
  writeChunk(params: {
    channel: string;
    msSinceStart: number;
    cumulativeChars: number;
    text: string;
  }): void {
    if (!this.opened) return;
    try {
      // Clip individual chunk text so thinking-mode token streams
      // don't render as multi-hundred-char log lines. Intermediate
      // context stays readable via `tail -f`; the full chain is
      // preserved in the trailer at the end.
      const preview = params.text.replace(/\n/g, '\\n').slice(0, 120);
      const line = `[${params.channel.padEnd(9)}] +${params.msSinceStart
        .toString()
        .padStart(6)}ms  chars=${params.cumulativeChars
        .toString()
        .padStart(6)}  ${preview}\n`;
      fs.appendFileSync(this.filePath, line);
      this._bytesWritten += Buffer.byteLength(line);
    } catch {
      // Best-effort.
    }
  }

  /** Write the trailer with final text, thinking, and metrics. */
  writeFinal(final: InvocationLogFinal): void {
    if (!this.opened) return;
    try {
      const parts = [
        '',
        '═'.repeat(72),
        `  status          : ${final.status}`,
        `  duration_ms     : ${final.durationMs}`,
        `  input_tokens    : ${final.inputTokens ?? '-'}`,
        `  output_tokens   : ${final.outputTokens ?? '-'}`,
        `  retry_attempts  : ${final.retryAttempts}`,
        final.errorMessage ? `  error           : ${final.errorMessage}` : '',
        '─'.repeat(72),
        'FINAL TEXT:',
        final.text,
        '─'.repeat(72),
        final.thinking ? 'THINKING:' : '',
        final.thinking ?? '',
        '═'.repeat(72),
      ].filter((s) => s !== '').join('\n');
      const payload = parts + '\n';
      fs.appendFileSync(this.filePath, payload);
      this._bytesWritten += Buffer.byteLength(payload);
    } catch {
      // Best-effort.
    }
  }

  /**
   * Mark the log as aborted when the caller gives up before a final
   * result arrives (stall timeout, process signal). Leaves enough
   * breadcrumb in the file that a post-mortem reader can tell this
   * call was interrupted rather than failed to start.
   */
  writeAborted(reason: string, durationMs: number): void {
    if (!this.opened) return;
    try {
      const parts = [
        '',
        '═'.repeat(72),
        `  status          : aborted`,
        `  duration_ms     : ${durationMs}`,
        `  abort_reason    : ${reason}`,
        '═'.repeat(72),
      ].join('\n');
      const payload = parts + '\n';
      fs.appendFileSync(this.filePath, payload);
      this._bytesWritten += Buffer.byteLength(payload);
    } catch {
      // Best-effort.
    }
  }
}

