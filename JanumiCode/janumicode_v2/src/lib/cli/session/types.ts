/**
 * Cross-CLI interactive-session substrate — core types.
 *
 * Today's executor is one-shot ([CLIInvoker] writes stdin once and `.end()`s
 * it). To drive coding-agent TUIs through research → plan → implement (Goose
 * `/plan`/RPI, Claude Code plan mode, …) we need a multi-turn session over a
 * pseudo-terminal. These interfaces define the substrate so the driver and
 * adapters are testable without the native `node-pty` module (tests inject a
 * scripted fake PTY; production injects the node-pty spawner).
 */

/** Named non-text keys the driver can inject (TUIs respond to these, not text). */
export type SpecialKey =
  | 'enter' | 'escape' | 'tab' | 'backspace' | 'space'
  | 'up' | 'down' | 'left' | 'right'
  | 'ctrl-c' | 'ctrl-d' | 'ctrl-u';

/** A live pseudo-terminal process. Production = node-pty; tests = fake. */
export interface PtyProcess {
  /** Subscribe to raw output bytes (already decoded to string). */
  onData(listener: (chunk: string) => void): void;
  /** Subscribe to process exit. */
  onExit(listener: (info: { exitCode: number; signal?: number }) => void): void;
  /** Write raw bytes (text or an encoded key sequence) to the PTY. */
  write(data: string): void;
  /** Resize the terminal (many TUIs repaint on resize). */
  resize(cols: number, rows: number): void;
  /** Terminate the process (and its tree, on the production spawner). */
  kill(): void;
  /** Best-effort PID for tree-kill / telemetry. */
  readonly pid?: number;
}

export interface PtySpawnOptions {
  command: string;
  args: string[];
  cwd: string;
  env?: Record<string, string>;
  cols?: number;
  rows?: number;
}

/** Spawns a {@link PtyProcess}. Injected so the driver is substrate-agnostic. */
export interface PtySpawner {
  spawn(opts: PtySpawnOptions): PtyProcess;
}

/** Minimal cell attributes for perception detectors (box/overlay/dim). */
export interface ScreenCell {
  ch: string;
  bold: boolean;
  inverse: boolean;
}

/** A normalized snapshot of the terminal screen (cursor + visible lines). */
export interface ScreenSnapshot {
  /**
   * Normalized text lines — the full transcript (scrollback + viewport),
   * trailing blank lines trimmed. Index space for `viewportTop`, `cursor.row`
   * and `getCell(row, …)`.
   */
  lines: string[];
  /** The whole normalized text (lines joined with \n). */
  text: string;
  /** True when the app is in the alternate screen buffer (full-screen TUI). */
  altScreen: boolean;
  /** Index into `lines` where the VISIBLE screen begins (perception layers
   *  operate on `lines.slice(viewportTop)`). Absent on the legacy line-buffer
   *  model (treat the whole buffer as visible). */
  viewportTop?: number;
  /** Terminal dimensions (cell-grid models only). */
  rows?: number;
  cols?: number;
  /** Cursor in `lines` coordinates (row = absolute line index). */
  cursor?: { row: number; col: number; visible: boolean };
  /** Lazy cell accessor (row in `lines` coordinates). Cell-grid models only —
   *  returns null for out-of-range or when attributes are unavailable. */
  getCell?: (row: number, col: number) => ScreenCell | null;
}

/** A terminal screen model fed by raw PTY bytes. `write` MAY be async
 *  (xterm-headless parses via callback); the driver serializes writes and
 *  notifies watchers only after the chunk is fully parsed. */
export interface ScreenModel {
  write(chunk: string): void | Promise<void>;
  snapshot(): ScreenSnapshot;
}

/** Outcome of a {@link SessionDriver.waitFor}. */
export interface WaitResult {
  matched: boolean;
  /** Why the wait ended. */
  reason: 'matched' | 'timeout' | 'exit';
  /** Screen at the moment the wait resolved. */
  snapshot: ScreenSnapshot;
}

/** A predicate over the live screen, or a literal/substring to await. */
export type WaitCondition = string | RegExp | ((screen: ScreenSnapshot) => boolean);
