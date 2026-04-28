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
 * Per-call options for shaping live-log output. Defined here so
 * LLMCaller can override based on env vars / settings.
 */
export interface InvocationLogOptions {
  /**
   * When true, every streaming chunk is appended to the .log file.
   * When false (the new default), the per-chunk lines are skipped on
   * disk but `bytesWritten` is still incremented. The bytesWritten
   * counter is what feeds runaway-thinking detection in LLMCaller —
   * it's a JS-memory counter, not a stat() of the file on disk —
   * so disabling the per-chunk write does NOT weaken loop detection.
   *
   * Why default off: the chunk lines balloon the file size dramatically
   * during long thinking-mode streams (cal-21 produced 700 MB of live
   * logs) without adding much value once the trailer is written. The
   * trailer includes the full final text and full thinking chain.
   * Operators who want the live tail-f view can opt back in via env.
   */
  writeRawTokenStream?: boolean;
  /** Optional phase/sub-phase prefix for the filename (e.g. 'phase06_1'). */
  filenamePrefix?: string | null;
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
  private readonly writeRawTokenStream: boolean;

  constructor(
    private readonly logDir: string,
    invocationId: string,
    options: InvocationLogOptions = {},
  ) {
    // Filename shape:
    //   - With prefix: `<prefix>__<invocationId>.log`
    //     (e.g. `phase06_1__abc-123.log`) — operators scanning the
    //     live dir can find all calls for a given sub-phase by glob.
    //   - Without prefix: `<invocationId>.log` (legacy shape).
    const base = options.filenamePrefix
      ? `${options.filenamePrefix}__${invocationId}.log`
      : `${invocationId}.log`;
    this.filePath = path.join(logDir, base);
    this.writeRawTokenStream = options.writeRawTokenStream ?? false;
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
        this.writeRawTokenStream
          ? 'STREAM (channel | ms-since-start | cumulative-chars | text):'
          : 'STREAM: omitted (writeRawTokenStream=false). Final text is in trailer below.',
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

  /**
   * Append one streaming chunk. Called once per provider frame.
   *
   * `_bytesWritten` is bumped on every call regardless of disk write —
   * it's the runaway-thinking detection signal LLMCaller checks in
   * `onChunk`. Disabling the disk write (default) preserves loop
   * detection while keeping the live-log file compact.
   */
  writeChunk(params: {
    channel: string;
    msSinceStart: number;
    cumulativeChars: number;
    text: string;
  }): void {
    if (!this.opened) return;
    // Always count bytes so runaway-thinking detection remains
    // accurate. The "would-have-written" line length is computed
    // once and used both for the counter bump and (optionally) for
    // the actual append.
    const preview = params.text.replaceAll('\n', '\\n').slice(0, 120);
    const line = `[${params.channel.padEnd(9)}] +${params.msSinceStart
      .toString()
      .padStart(6)}ms  chars=${params.cumulativeChars
      .toString()
      .padStart(6)}  ${preview}\n`;
    this._bytesWritten += Buffer.byteLength(line);
    if (!this.writeRawTokenStream) return;
    try {
      fs.appendFileSync(this.filePath, line);
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

