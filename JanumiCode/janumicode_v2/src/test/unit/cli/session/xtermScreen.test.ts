/**
 * XtermScreen (P1 perception substrate) — replay of REAL goose 1.37 TUI frames
 * captured from slice-142 live sessions (raw ANSI preserved). Verifies the
 * cell-grid screen model renders what a human saw: banner, ready marker,
 * input box, echo region, spinner — the ground truth the perception
 * detectors are built against.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { XtermScreen } from '../../../../lib/cli/session/xtermScreen';

const FIXTURES = path.resolve(__dirname, '..', '..', '..', 'fixtures', 'goose-frames');

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES, name), 'latin1');
}

async function replay(screen: XtermScreen, raw: string, chunkSize = 4096): Promise<void> {
  for (let i = 0; i < raw.length; i += chunkSize) {
    await screen.write(raw.slice(i, i + chunkSize));
  }
}

describe('XtermScreen — real goose frame replay', () => {
  it('renders the goose banner, ready marker, and model line (plan/echo/spinner capture)', async () => {
    const screen = new XtermScreen({ cols: 210, rows: 40 });
    await replay(screen, loadFixture('session-early-banner.bin'));
    const s = screen.snapshot();

    expect(s.text).toContain('goose is ready');
    expect(s.text).toContain('qwen3.5:9b'); // session model line parsed
    // Plan-mode entry response was rendered.
    expect(s.text).toContain('Entering plan mode');
    // Cursor + grid metadata present (cell-grid model).
    expect(s.rows).toBe(40);
    expect(s.cols).toBe(210);
    expect(s.cursor).toBeDefined();
    expect(s.viewportTop).toBeGreaterThanOrEqual(0);
    expect(typeof s.getCell).toBe('function');
  });

  it('the spinner phase renders as a SINGLE repainted line, not thousands of appended lines', async () => {
    const screen = new XtermScreen({ cols: 210, rows: 40 });
    await replay(screen, loadFixture('session-plan-echo-spinner.bin'));
    const s = screen.snapshot();
    // The raw capture contains hundreds of spinner repaints; a correct VT
    // emulation collapses them via cursor-addressing into few lines.
    const spinnerLines = s.lines.filter((l) => l.includes('(Ctrl+C to interrupt)'));
    expect(spinnerLines.length).toBeLessThan(40);
    expect(s.text).toMatch(/Initializing clever mode|Searching solution space/);
  });

  it('renders the task-send + tool-call capture with the read_resource marker', async () => {
    const screen = new XtermScreen({ cols: 210, rows: 40 });
    await replay(screen, loadFixture('session-task-toolcall.bin'));
    const s = screen.snapshot();
    expect(s.text).toContain('goose is ready');
    // The agent began tool execution (the working session, pre-timeout).
    expect(s.text).toContain('read_resource');
    // The echoed instruction is on-screen (input region) — perception layers
    // must be able to see it to EXCLUDE it from agent content.
    expect(s.text).toContain('complete task specification');
  });

  it('getCell exposes per-cell data on a rendered row', async () => {
    const screen = new XtermScreen({ cols: 210, rows: 40 });
    await replay(screen, loadFixture('session-task-toolcall.bin'));
    const s = screen.snapshot();
    const rowIdx = s.lines.findIndex((l) => l.includes('goose is ready'));
    expect(rowIdx).toBeGreaterThanOrEqual(0);
    const col = s.lines[rowIdx].indexOf('g');
    const cell = s.getCell!(rowIdx, col);
    expect(cell).not.toBeNull();
    expect(cell!.ch).toBe('g');
  });
});
