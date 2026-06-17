/**
 * XtermScreen — full VT-emulated screen model backed by `@xterm/headless`.
 *
 * Replaces the minimal line-buffer {@link TerminalScreen} as the default
 * perception substrate: a real cell grid with cursor tracking, alternate-
 * screen awareness, and per-cell attributes — the foundation the perception
 * detectors (box/overlay/input-region) need and that a strip-and-append line
 * buffer cannot provide (wrapped echo lines, cursor-addressed repaints, and
 * full-screen redraws all parse correctly here).
 *
 * Snapshot semantics: `lines` is the full transcript (scrollback + viewport,
 * trailing blanks trimmed); `viewportTop` marks where the visible screen
 * begins; `cursor.row` is in `lines` coordinates. `write` is callback-async in
 * xterm — callers (the SessionDriver) serialize writes and snapshot after
 * flush via the returned promise.
 */

import { Terminal } from '@xterm/headless';
import type { ScreenCell, ScreenModel, ScreenSnapshot } from './types';

// DECTCEM cursor show/hide — xterm headless does not expose cursor visibility
// publicly, so track it from the raw stream (same approach the legacy screen
// used for the alt-screen flag).
const CURSOR_HIDE = /\x1b\[\?25l/;
const CURSOR_SHOW = /\x1b\[\?25h/;

export interface XtermScreenOptions {
  cols?: number;
  rows?: number;
  /** Scrollback lines retained for transcript-level perception. */
  scrollback?: number;
}

export class XtermScreen implements ScreenModel {
  private readonly term: Terminal;
  private cursorVisible = true;
  private rawLen = 0;

  constructor(opts: XtermScreenOptions = {}) {
    this.term = new Terminal({
      cols: opts.cols ?? 120,
      rows: opts.rows ?? 40,
      scrollback: opts.scrollback ?? 5000,
      allowProposedApi: true,
    });
  }

  write(chunk: string): Promise<void> {
    this.rawLen += chunk.length;
    // Order matters for interleaved hide/show in one chunk — last wins.
    const hide = chunk.lastIndexOf('\x1b[?25l');
    const show = chunk.lastIndexOf('\x1b[?25h');
    if (hide !== -1 || show !== -1) this.cursorVisible = show > hide;
    else if (CURSOR_HIDE.test(chunk)) this.cursorVisible = false;
    else if (CURSOR_SHOW.test(chunk)) this.cursorVisible = true;
    return new Promise<void>((resolve) => this.term.write(chunk, resolve));
  }

  snapshot(): ScreenSnapshot {
    const buf = this.term.buffer.active;
    const total = buf.length;
    const lines: string[] = new Array(total);
    for (let y = 0; y < total; y++) {
      lines[y] = buf.getLine(y)?.translateToString(true) ?? '';
    }
    // Trim trailing blank lines (parity with the legacy model).
    let end = total;
    while (end > 0 && lines[end - 1].trim() === '') end -= 1;
    const trimmed = lines.slice(0, end);

    const viewportTop = Math.min(buf.baseY, Math.max(0, end - 1));
    const cursorRow = buf.baseY + buf.cursorY;

    const getCell = (row: number, col: number): ScreenCell | null => {
      const line = buf.getLine(row);
      if (!line) return null;
      const cell = line.getCell(col);
      if (!cell) return null;
      return {
        ch: cell.getChars() || ' ',
        bold: cell.isBold() !== 0,
        inverse: cell.isInverse() !== 0,
      };
    };

    return {
      lines: trimmed,
      text: trimmed.join('\n'),
      altScreen: buf.type === 'alternate',
      viewportTop,
      rows: this.term.rows,
      cols: this.term.cols,
      cursor: { row: cursorRow, col: buf.cursorX, visible: this.cursorVisible },
      getCell,
    };
  }

  get rawLength(): number { return this.rawLen; }

  resize(cols: number, rows: number): void {
    try { this.term.resize(cols, rows); } catch { /* best effort */ }
  }

  dispose(): void {
    try { this.term.dispose(); } catch { /* best effort */ }
  }
}
