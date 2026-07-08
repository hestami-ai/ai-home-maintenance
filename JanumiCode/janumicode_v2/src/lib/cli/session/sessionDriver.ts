/**
 * SessionDriver — the deterministic state machine that drives an interactive
 * coding-agent TUI over a pseudo-terminal.
 *
 * Built on an injected {@link PtySpawner} (production = node-pty; tests = a
 * scripted fake), it maintains a {@link TerminalScreen} from the live byte
 * stream and exposes the operations the adapters need: send text / special
 * keys, wait for a screen pattern or predicate (with timeout + exit handling),
 * snapshot the screen, resize, and end. Raw bytes and screen snapshots are
 * surfaced via an optional logging hook so the orchestrator can persist the
 * session trace into the governed stream.
 */

import { TerminalScreen } from './terminalScreen';
import { XtermScreen } from './xtermScreen';
import { classifyScreen, type Detection } from './perception/classifier';
import type { PerceptionMarkers } from './perception/detectors';
import type {
  PtyProcess, PtySpawner, PtySpawnOptions, ScreenModel, ScreenSnapshot, SpecialKey, WaitCondition, WaitResult,
} from './types';

const KEY_SEQUENCES: Record<SpecialKey, string> = {
  enter: '\r',
  escape: '\x1b',
  tab: '\t',
  backspace: '\x7f',
  space: ' ',
  up: '\x1b[A',
  down: '\x1b[B',
  right: '\x1b[C',
  left: '\x1b[D',
  'ctrl-c': '\x03',
  'ctrl-d': '\x04',
  'ctrl-u': '\x15',
};

export interface SessionDriverOptions {
  /** Default wait timeout (ms) when a call omits one. */
  defaultTimeoutMs?: number;
  /** Default terminal size. */
  cols?: number;
  rows?: number;
  /**
   * Screen model. Default: the full VT-emulated {@link XtermScreen} (cell
   * grid + cursor — required by the perception detectors). Inject the legacy
   * {@link TerminalScreen} for lightweight plain-text tests.
   */
  screen?: ScreenModel;
  /** Sink for raw chunks + lifecycle events (e.g. governed-stream logging). */
  onLog?: (event: SessionLogEvent) => void;
  /**
   * Injected clock — Date.now()/setTimeout are not available in workflow
   * scripts and are awkward to fake. Defaults to real timers in production.
   */
  setTimeoutFn?: (cb: () => void, ms: number) => unknown;
  clearTimeoutFn?: (handle: unknown) => void;
}

export type SessionLogEvent =
  | { kind: 'spawn'; command: string; args: string[] }
  | { kind: 'data'; chunk: string }
  | { kind: 'input'; data: string; label?: string }
  | { kind: 'exit'; exitCode: number }
  | { kind: 'wait'; result: WaitResult; condition: string };

export class SessionDriver {
  private readonly screen: ScreenModel;
  private readonly rawChunks: string[] = [];
  private pty: PtyProcess | null = null;
  private exitInfo: { exitCode: number } | null = null;
  /** Subscribers re-evaluated on each data chunk / exit (waitFor watchers). */
  private readonly watchers = new Set<() => void>();
  /** Serializes (possibly async) screen writes so snapshots and watcher
   *  notifications always observe fully-parsed state, in arrival order. */
  private writeChain: Promise<void> = Promise.resolve();
  /** Text lines sent by US recently — perception layers use these to exclude
   *  the TUI's echo of our own input from "agent content". */
  readonly recentSends: string[] = [];
  private readonly defaultTimeoutMs: number;
  private readonly cols: number;
  private readonly rows: number;
  private readonly onLog?: (e: SessionLogEvent) => void;
  private readonly setTimeoutFn: (cb: () => void, ms: number) => unknown;
  private readonly clearTimeoutFn: (handle: unknown) => void;

  constructor(private readonly spawner: PtySpawner, opts: SessionDriverOptions = {}) {
    this.defaultTimeoutMs = opts.defaultTimeoutMs ?? 120_000;
    this.cols = opts.cols ?? 120;
    this.rows = opts.rows ?? 40;
    this.screen = opts.screen ?? new XtermScreen({ cols: this.cols, rows: this.rows });
    this.onLog = opts.onLog;
    this.setTimeoutFn = opts.setTimeoutFn ?? ((cb, ms) => setTimeout(cb, ms));
    this.clearTimeoutFn = opts.clearTimeoutFn ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  }

  /** Spawn the PTY and begin capturing output. */
  start(opts: Omit<PtySpawnOptions, 'cols' | 'rows'> & { cols?: number; rows?: number }): void {
    if (this.pty) throw new Error('SessionDriver already started');
    this.pty = this.spawner.spawn({ cols: this.cols, rows: this.rows, ...opts });
    this.onLog?.({ kind: 'spawn', command: opts.command, args: opts.args });
    this.pty.onData((chunk) => {
      // Serialize the (possibly async) parse, then record + notify so watcher
      // predicates never observe a half-parsed screen.
      this.writeChain = this.writeChain
        .then(() => this.screen.write(chunk))
        .then(() => {
          this.rawChunks.push(chunk);
          this.onLog?.({ kind: 'data', chunk });
          for (const w of [...this.watchers]) w();
        });
    });
    this.pty.onExit((info) => {
      this.writeChain = this.writeChain.then(() => {
        this.exitInfo = { exitCode: info.exitCode };
        this.onLog?.({ kind: 'exit', exitCode: info.exitCode });
        for (const w of [...this.watchers]) w();
      });
    });
  }

  get started(): boolean { return this.pty !== null; }
  get exited(): boolean { return this.exitInfo !== null; }
  get exitCode(): number | null { return this.exitInfo?.exitCode ?? null; }

  /** Write raw text to the PTY (no trailing newline). */
  sendText(text: string, label?: string): void {
    this.requirePty().write(text);
    this.onLog?.({ kind: 'input', data: text, label });
  }

  /** Type text and press Enter (the common "answer a prompt" action). */
  sendLine(text: string, label?: string): void {
    // Keep ALL of a session's sends for echo discrimination (sessions type
    // tens of lines, not thousands). A small window (originally 4) let old
    // nudge text age out and re-enter "agent content" — the responder then
    // saw its own earlier instructions as agent output and amplified them
    // (slice-142 live review). The cap is only a runaway guard.
    this.recentSends.push(text);
    if (this.recentSends.length > 64) this.recentSends.shift();
    this.sendText(text + KEY_SEQUENCES.enter, label ?? text);
  }

  /** Send a named special key (Enter/Esc/arrows/Ctrl-C/…). */
  sendKey(key: SpecialKey): void {
    this.requirePty().write(KEY_SEQUENCES[key]);
    this.onLog?.({ kind: 'input', data: KEY_SEQUENCES[key], label: key });
  }

  /** Current normalized screen snapshot. */
  snapshot(): ScreenSnapshot { return this.screen.snapshot(); }

  /** All raw bytes captured so far. */
  rawOutput(): string { return this.rawChunks.join(''); }

  /** Cumulative raw byte count — cheap monotonic progress signal for callers
   *  that must distinguish a fresh agent response from a stale on-screen prompt. */
  get rawLength(): number {
    let n = 0;
    for (const c of this.rawChunks) n += c.length;
    return n;
  }

  resize(cols: number, rows: number): void { this.pty?.resize(cols, rows); }

  /**
   * Resolve when the screen satisfies `condition`, the process exits, or the
   * timeout elapses — whichever first. Re-evaluated on every output chunk, with
   * an immediate initial check so an already-satisfied condition returns at once.
   */
  waitFor(condition: WaitCondition, timeoutMs?: number): Promise<WaitResult> {
    const predicate = toPredicate(condition);
    const condStr = describeCondition(condition);
    return new Promise<WaitResult>((resolve) => {
      let done = false;
      let timer: unknown = null;
      const finish = (reason: WaitResult['reason']): void => {
        if (done) return;
        done = true;
        this.watchers.delete(check);
        if (timer !== null) this.clearTimeoutFn(timer);
        const result: WaitResult = { matched: reason === 'matched', reason, snapshot: this.snapshot() };
        this.onLog?.({ kind: 'wait', result, condition: condStr });
        resolve(result);
      };
      const check = (): void => {
        if (done) return;
        if (predicate(this.snapshot())) finish('matched');
        else if (this.exitInfo) finish('exit');
      };
      this.watchers.add(check);
      timer = this.setTimeoutFn(() => finish('timeout'), timeoutMs ?? this.defaultTimeoutMs);
      check(); // immediate
    });
  }

  /**
   * Classify the current screen via the perception layer (busy / modal /
   * prompt / idle / normal + echo-excluded agent-content signature). `prev`
   * for overlay detection is the snapshot from the previous classify() call.
   */
  classify(markers?: PerceptionMarkers): Detection {
    const curr = this.snapshot();
    const d = classifyScreen(this.prevSnapshot, curr, { recentSends: this.recentSends, markers });
    this.prevSnapshot = curr;
    return d;
  }
  private prevSnapshot: ScreenSnapshot | null = null;

  /**
   * Resolve when the classified Detection satisfies `pred`, the process
   * exits, or the timeout elapses. Same watcher machinery as waitFor — the
   * predicate is re-evaluated after each fully-parsed data chunk.
   */
  waitForDetection(
    pred: (d: Detection) => boolean,
    timeoutMs?: number,
    markers?: PerceptionMarkers,
  ): Promise<{ detection: Detection; reason: WaitResult['reason'] }> {
    return new Promise((resolve) => {
      let done = false;
      let timer: unknown = null;
      const finish = (reason: WaitResult['reason'], detection: Detection): void => {
        if (done) return;
        done = true;
        this.watchers.delete(check);
        if (timer !== null) this.clearTimeoutFn(timer);
        this.onLog?.({ kind: 'wait', result: { matched: reason === 'matched', reason, snapshot: this.snapshot() }, condition: `<detection:${detection.kind}>` });
        resolve({ detection, reason });
      };
      const check = (): void => {
        if (done) return;
        const d = this.classify(markers);
        if (pred(d)) finish('matched', d);
        else if (this.exitInfo) finish('exit', d);
      };
      this.watchers.add(check);
      timer = this.setTimeoutFn(() => { if (!done) finish('timeout', this.classify(markers)); }, timeoutMs ?? this.defaultTimeoutMs);
      check();
    });
  }

  /** End the session: kill the process and drop watchers. */
  end(): void {
    try { this.pty?.kill(); } catch { /* best effort */ }
    this.watchers.clear();
  }

  private requirePty(): PtyProcess {
    if (!this.pty) throw new Error('SessionDriver not started');
    return this.pty;
  }
}

function toPredicate(c: WaitCondition): (s: ScreenSnapshot) => boolean {
  if (typeof c === 'function') return c;
  if (c instanceof RegExp) return (s) => c.test(s.text);
  return (s) => s.text.includes(c);
}

function describeCondition(c: WaitCondition): string {
  if (typeof c === 'function') return '<predicate>';
  if (c instanceof RegExp) return c.toString();
  return JSON.stringify(c);
}
