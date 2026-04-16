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

  constructor(private readonly logDir: string, invocationId: string) {
    this.filePath = path.join(logDir, `${invocationId}.log`);
  }

  get path(): string { return this.filePath; }

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
      fs.writeFileSync(this.filePath, lines + '\n', { flag: 'w' });
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
      fs.appendFileSync(this.filePath, parts + '\n');
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
      fs.appendFileSync(this.filePath, parts + '\n');
    } catch {
      // Best-effort.
    }
  }
}

// ── Streaming loop detector (B4) ───────────────────────────────────

/**
 * Rolling-buffer n-gram repetition detector. Catches the qwen3
 * thinking-mode pathology where the model produces fluent tokens that
 * cycle through the same self-correction phrase (e.g. "Wait, let me
 * check…") without converging. Idle-timer detection misses this case
 * because tokens ARE arriving — they're just semantically stuck.
 *
 * Algorithm: keep the last N chars of streamed text. When the buffer
 * is full, count how many times the most-recent K-char window appears
 * in the buffer. If ≥ THRESHOLD, declare a loop.
 *
 * Defaults are tuned for thinking-mode prose: 50-char window, 4KB
 * buffer, 6 occurrences. A real (non-loop) stream rarely repeats the
 * same 50-char substring more than twice in 4KB even when discussing
 * the same topic. Tunable via env so capture runs on slow models can
 * relax the threshold.
 */
export class LoopDetector {
  private readonly buffer: string[] = [];
  private cumulativeChars = 0;

  constructor(
    // Window widened from 50→80 chars so JSON schema fragments
    // (e.g. `"field": "present", "severity": "none"`) don't register
    // as loops. 80 chars forces the repeated content to be prose-like.
    private readonly windowChars: number = Number.parseInt(
      process.env.JANUMICODE_LOOP_WINDOW ?? '80', 10),
    private readonly bufferChars: number = Number.parseInt(
      process.env.JANUMICODE_LOOP_BUFFER ?? '4096', 10),
    // Threshold raised from 6→15 after observing that qwen3's healthy
    // thinking repeats "Wait, check:" style phrases 3-5× naturally when
    // listing fields in a JSON schema. 15× within a 4KB window means
    // the model is genuinely stuck in a cycle of the same long phrase.
    private readonly threshold: number = Number.parseInt(
      process.env.JANUMICODE_LOOP_THRESHOLD ?? '15', 10),
    /**
     * Don't run detection until the stream has produced at least this
     * many chars. Avoids false positives during the model's natural
     * preamble (`{`, `"completeness_findings": [` etc.) which can
     * recur across short outputs. Raised from 8KB→16KB because qwen3
     * thinking-mode emits 4-6KB of structured planning before the real
     * content begins; tripping during that phase is a false alarm.
     */
    private readonly warmupChars: number = Number.parseInt(
      process.env.JANUMICODE_LOOP_WARMUP ?? '16384', 10),
  ) {}

  /**
   * Append a chunk and check for loop. Returns a non-null reason
   * string when a loop is detected — the caller should abort the
   * in-flight request.
   */
  observe(text: string): string | null {
    if (!text) return null;
    this.cumulativeChars += text.length;
    this.buffer.push(text);
    let bufLen = this.buffer.reduce((n, s) => n + s.length, 0);
    while (bufLen > this.bufferChars && this.buffer.length > 1) {
      bufLen -= this.buffer.shift()!.length;
    }
    if (this.cumulativeChars < this.warmupChars) return null;

    const joined = this.buffer.join('');
    if (joined.length < this.windowChars * 2) return null;

    const recent = joined.slice(-this.windowChars);
    let count = 0;
    let idx = 0;
    while ((idx = joined.indexOf(recent, idx)) !== -1) {
      count++;
      if (count >= this.threshold) {
        return (
          `Loop suspected: ${this.windowChars}-char window appeared ` +
          `${count}× in last ${this.bufferChars} chars — ` +
          `recent="${recent.replace(/\n/g, '\\n').slice(0, 60)}…"`
        );
      }
      idx += 1;
    }
    return null;
  }
}
