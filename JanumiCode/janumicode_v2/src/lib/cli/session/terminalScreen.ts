/**
 * Minimal ANSI-aware terminal screen model.
 *
 * Maintains a normalized line buffer from a raw PTY byte stream so the session
 * driver can wait on VISIBLE text/prompts rather than regex-matching raw bytes
 * (which a TUI's cursor moves, repaints, and color codes make brittle). It
 * interprets the common subset — CSI/OSC stripping, CR/LF/BS, erase-display,
 * cursor-home, and the alternate-screen DEC private modes — which is enough to
 * detect slash-command prompts and menu states. A full VT100 emulator
 * (xterm headless) can replace this behind the same `ScreenSnapshot` shape if a
 * future TUI needs precise grid/cursor fidelity.
 */

import type { ScreenSnapshot } from './types';

// eslint-disable-next-line no-control-regex
const CSI = /\x1b\[[0-9;?]*[ -/]*[@-~]/g;
// eslint-disable-next-line no-control-regex
const OSC = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;
// Alt-screen + erase-display detected before stripping (they change state).
const ALT_ON = /\x1b\[\?(?:1049|47|1047)h/;
const ALT_OFF = /\x1b\[\?(?:1049|47|1047)l/;
const ERASE_DISPLAY = /\x1b\[[23]J/;
const CURSOR_HOME = /\x1b\[(?:0;0|1;1)?[Hf]/;

export class TerminalScreen {
  private lines: string[] = [];
  private cur = '';
  private col = 0;
  private alt = false;
  private rawLen = 0;

  /** Feed a chunk of decoded PTY output. */
  write(chunk: string): void {
    this.rawLen += chunk.length;

    // State-changing escapes are observed, then all escapes are stripped so the
    // remaining text can be laid out with CR/LF/BS handling.
    if (ALT_ON.test(chunk)) this.alt = true;
    if (ALT_OFF.test(chunk)) this.alt = false;
    const cleared = ERASE_DISPLAY.test(chunk);
    const homed = CURSOR_HOME.test(chunk);
    if (cleared) this.reset();
    else if (homed) { this.flushCur(); this.col = 0; }

    const text = chunk.replace(OSC, '').replace(CSI, '');
    for (const ch of text) {
      switch (ch) {
        case '\n':
          this.lines.push(this.cur);
          this.cur = '';
          this.col = 0;
          break;
        case '\r':
          this.col = 0;
          break;
        case '\b':
          this.col = Math.max(0, this.col - 1);
          break;
        case '\x07': // BEL — ignore
        case '\x00':
          break;
        default: {
          if (ch < ' ' && ch !== '\t') break; // drop stray control chars
          // Overwrite at the cursor column (CR-repaint), padding if needed.
          if (this.col >= this.cur.length) this.cur = this.cur.padEnd(this.col) + ch;
          else this.cur = this.cur.slice(0, this.col) + ch + this.cur.slice(this.col + 1);
          this.col += 1;
        }
      }
    }
  }

  /** Current normalized snapshot (trailing blank lines trimmed). */
  snapshot(): ScreenSnapshot {
    const all = this.cur.length > 0 || this.col > 0 ? [...this.lines, this.cur] : [...this.lines];
    let end = all.length;
    while (end > 0 && all[end - 1].trim() === '') end -= 1;
    const lines = all.slice(0, end).map((l) => l.trimEnd());
    return { lines, text: lines.join('\n'), altScreen: this.alt };
  }

  get rawLength(): number { return this.rawLen; }

  private flushCur(): void {
    if (this.cur.length > 0) { this.lines.push(this.cur); this.cur = ''; }
  }

  private reset(): void {
    this.lines = [];
    this.cur = '';
    this.col = 0;
  }
}
