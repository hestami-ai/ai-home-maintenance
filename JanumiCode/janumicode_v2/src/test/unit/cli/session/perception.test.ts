/**
 * Perception layer (P2) — detectors + classifier + guard, asserted against
 * BOTH real goose 1.37 frame replays (ground truth) and synthetic screens.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { XtermScreen } from '../../../../lib/cli/session/xtermScreen';
import { classifyScreen } from '../../../../lib/cli/session/perception/classifier';
import { agentContentLines, detectActions, detectBoxRegions, GOOSE_MARKERS } from '../../../../lib/cli/session/perception/detectors';
import { checkAction } from '../../../../lib/cli/session/perception/actionGuard';
import { diffScreens } from '../../../../lib/cli/session/perception/diffEngine';
import { TerminalScreen } from '../../../../lib/cli/session/terminalScreen';
import type { ScreenSnapshot } from '../../../../lib/cli/session/types';

const FIXTURES = path.resolve(__dirname, '..', '..', '..', 'fixtures', 'goose-frames');

async function replayFixture(name: string, upTo?: number): Promise<ScreenSnapshot> {
  const raw = fs.readFileSync(path.join(FIXTURES, name), 'utf-8').slice(0, upTo);
  const screen = new XtermScreen({ cols: 210, rows: 40 });
  for (let i = 0; i < raw.length; i += 8192) await screen.write(raw.slice(i, i + 8192));
  return screen.snapshot();
}

function synth(lines: string[]): ScreenSnapshot {
  const s = new TerminalScreen();
  s.write(lines.join('\n') + '\n');
  return s.snapshot();
}

describe('classifier — real goose frames', () => {
  it('mid-spinner → BUSY; capture END → clarification PROMPT (the state the old adapter timed out on)', async () => {
    const raw = fs.readFileSync(path.join(FIXTURES, 'session-plan-echo-spinner.bin'), 'utf-8');
    const spinnerAt = raw.indexOf('Searching solution space');
    expect(spinnerAt).toBeGreaterThan(0);
    const sMid = await replayFixture('session-plan-echo-spinner.bin', spinnerAt + 2000);
    const dMid = classifyScreen(null, sMid, { recentSends: [] });
    expect(dMid.kind).toBe('busy');
    // The full capture ends with the agent AWAITING numbered clarification
    // answers ("Reply with clarification points above…") — discovered via
    // replay: the planner had finished and was waiting on US.
    const sEnd = await replayFixture('session-plan-echo-spinner.bin');
    const dEnd = classifyScreen(null, sEnd, { recentSends: [] });
    expect(dEnd.kind).toBe('prompt');
    expect(dEnd.line).toMatch(/reply with|clarification|\?\s*$/i);
  });

  it('echo of OUR instruction is EXCLUDED from agent content (fast-settle killer)', async () => {
    const s = await replayFixture('session-task-toolcall.bin');
    const sent = 'Read the file "E:\\Projects\\hestami-ai\\JanumiCode\\janumicode_v2\\test-and-evaluation\\thin-slice-workspaces\\thin-slice-workspace-142\\.janumicode\\task-specs\\task-spec-1781043695045-gv6oba.md" now — it is your complete task specification. Work in three steps: (1) RESEARCH — read the spec, then inspect the workspace: the write-scope directory, the canonical shared-module paths it names, and any existing implementations you should import or extend; (2) PLAN — state a short plan consistent with what you found; (3) IMPLEMENT — write the code and tests, honoring the write scope and the Shared Module Ownership rules, and verify the completion criteria. Do not ask me questions; make reasonable decisions and proceed to completion.';
    const withEcho = agentContentLines(s, GOOSE_MARKERS, [sent]);
    const withoutFilter = agentContentLines(s, GOOSE_MARKERS, []);
    // The echo wraps into continuation lines that LOOK like content; the
    // recent-send filter removes them.
    expect(withoutFilter.join('\n')).toContain('complete task specification');
    expect(withEcho.join('\n')).not.toContain('complete task specification');
    // Genuine agent activity (the tool call) survives the filter.
    expect(withEcho.join('\n')).toContain('read_resource');
  });

  it('ready banner screen classifies as IDLE with the input box', async () => {
    // Anchor to the first idle input box (banner painted, task not yet sent).
    const raw = fs.readFileSync(path.join(FIXTURES, 'session-early-banner.bin'), 'utf-8');
    const at = raw.indexOf('Enter to send');
    expect(at).toBeGreaterThan(0);
    // +40 ends just after the input box paints — BEFORE the /plan echo lands
    // (any later and the screen is mid-exchange, where 'normal' is correct).
    const s = await replayFixture('session-early-banner.bin', at + 40);
    const d = classifyScreen(null, s, { recentSends: [] });
    expect(['idle', 'prompt']).toContain(d.kind);
    expect(d.inputReady).toBe(true);
  });
});

describe('classifier — synthetic screens', () => {
  it('question as last agent line + input box → PROMPT with the question line', () => {
    const s = synth([
      'agent output...',
      'Which slug length should I use?',
      '> Enter to send · Ctrl+J newline',
    ]);
    const d = classifyScreen(null, s, { recentSends: [] });
    expect(d.kind).toBe('prompt');
    expect(d.line).toContain('Which slug length');
  });

  it('idle input box with NO new content → IDLE (agentContentSig empty)', () => {
    const s = synth(['> Enter to send · Ctrl+J newline']);
    const d = classifyScreen(null, s, { recentSends: [] });
    expect(d.kind).toBe('idle');
    expect(d.agentContentSig).toBe('');
  });

  it('bordered confirm dialog → MODAL with extracted actions', () => {
    const s = synth([
      'some background content',
      '   ┌──────────── Confirm ────────────┐',
      '   │ Are you sure you want to apply? │',
      '   │        [ Cancel ]   [ OK ]      │',
      '   └─────────────────────────────────┘',
    ]);
    const d = classifyScreen(null, s, { recentSends: [] });
    expect(d.kind).toBe('modal');
    expect(d.actions).toContain('ok');
    expect(d.actions).toContain('cancel');
  });

  it('box detector finds the rectangle bounds', () => {
    const s = synth([
      '┌─────────┐',
      '│ hello   │',
      '│ [ OK ]  │',
      '└─────────┘',
    ]);
    const boxes = detectBoxRegions(s);
    expect(boxes.length).toBeGreaterThanOrEqual(1);
    expect(boxes[0].region.top).toBe(0);
    expect(boxes[0].actions).toContain('ok');
  });

  it('diff engine reports a localized bounding box', () => {
    const a = synth(['line one', 'line two', 'line three']);
    const b = synth(['line one', 'line CHANGED', 'line three']);
    const d = diffScreens(a, b);
    expect(d.bounds).not.toBeNull();
    expect(d.bounds!.top).toBe(1);
    expect(d.bounds!.bottom).toBe(1);
  });
});

describe('action guard', () => {
  const busy = { kind: 'busy' as const, confidence: 0.9, agentContentSig: '', inputReady: false };
  const modal = { kind: 'modal' as const, confidence: 0.8, agentContentSig: '', inputReady: true, actions: ['ok', 'cancel'] };
  const idle = { kind: 'idle' as const, confidence: 0.9, agentContentSig: '', inputReady: true };

  it('refuses free text while busy; allows ctrl-c', () => {
    expect(checkAction(busy, { type: 'text', text: 'do something' }).allowed).toBe(false);
    expect(checkAction(busy, { type: 'key', key: 'ctrl-c' }).allowed).toBe(true);
  });

  it('modal: allows navigation keys + single-word answers, refuses paragraphs', () => {
    expect(checkAction(modal, { type: 'key', key: 'tab' }).allowed).toBe(true);
    expect(checkAction(modal, { type: 'text', text: 'yes' }).allowed).toBe(true);
    expect(checkAction(modal, { type: 'text', text: 'long free-form response here' }).allowed).toBe(false);
  });

  it('idle allows text', () => {
    expect(checkAction(idle, { type: 'text', text: 'next task instruction' }).allowed).toBe(true);
  });

  it('detectActions extracts bracketed and angle actions', () => {
    expect(detectActions('[ OK ]  < Yes >  ( Cancel )')).toEqual(expect.arrayContaining(['ok', 'yes', 'cancel']));
  });
});
