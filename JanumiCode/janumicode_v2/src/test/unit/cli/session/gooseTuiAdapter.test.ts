/**
 * GooseTuiAdapter — perception-driven policy loop over a scripted fake PTY
 * mimicking goose 1.37 frames (idle input box `> Enter to send …`, busy
 * spinner, question prompts).
 *
 * Contract (classifier-driven):
 *  - a turn completes when the screen is IDLE (input box) AND the
 *    echo-excluded agent content changed since our send;
 *  - PROMPT (question as trailing agent line + input box) → answered;
 *  - BUSY (spinner) extends waiting; a dead window (no busy, no content
 *    change) stalls; the overall session budget is the hard cap;
 *  - the task spec travels as a FILE (one short instruction in the TUI).
 *
 * Tests inject the synchronous TerminalScreen for deterministic interleaving
 * (production uses XtermScreen — covered by the replay tests).
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { GooseTuiAdapter } from '../../../../lib/cli/session/adapters/gooseTuiAdapter';
import { FakePtySpawner } from '../../../../lib/cli/session/fakePtySpawner';
import { TerminalScreen } from '../../../../lib/cli/session/terminalScreen';
import type { SessionLogEvent } from '../../../../lib/cli/session/sessionDriver';

function tmpWs(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'goose-tui-ws-'));
}

const INPUT_BOX = '> Enter to send · Ctrl+J newline';
const READY = `goose is ready\n${INPUT_BOX}\n`;
const syncScreen = { screenFactory: (): TerminalScreen => new TerminalScreen() };

describe('GooseTuiAdapter (default: prompt-level RPI, no /plan)', () => {
  it('drives ready → file-based task → clarification → completion without /plan', async () => {
    const cwd = tmpWs();
    const spawner = new FakePtySpawner({
      initial: [READY],
      rules: [
        // First response: a clarifying question, then back at the input box.
        { onInput: 'complete task specification', emit: [`Reviewing the workspace...\nWhich slug length should I use?\n${INPUT_BOX}\n`] },
        // After the answer: implementation result, back at the input box.
        { onInput: 'Proceed with the most reasonable', emit: [`Imported @/mapping-store/db.\nDone.\nTASK COMPLETE\n${INPUT_BOX}\n`] },
      ],
    });
    const events: SessionLogEvent[] = [];
    const adapter = new GooseTuiAdapter(spawner, { ...syncScreen, onLog: (e) => events.push(e) });

    const outcome = await adapter.run({
      command: 'goose', args: [], cwd,
      prompt: 'IMPLEMENT: build the click counter\nwith multiple\nlines',
    });

    expect(outcome.tier).toBe('full_tui');
    expect(outcome.finalText).toContain('Done');
    expect(outcome.timedOut).toBe(false);

    const writes = spawner.lastProcess!.writes.join('');
    expect(writes).not.toContain('/plan'); // no native plan mode by default
    expect(writes).toContain('task specification'); // file-based instruction
    expect(writes).toContain('RESEARCH'); // explicit RPI directive
    expect(writes).not.toContain('IMPLEMENT: build the click counter'); // raw prompt never typed
    expect(writes).toContain('Proceed with the most reasonable'); // clarification answered

    const specDir = path.join(cwd, '.janumicode', 'task-specs');
    const specs = fs.readdirSync(specDir);
    expect(specs.length).toBe(1);
    expect(fs.readFileSync(path.join(specDir, specs[0]), 'utf-8'))
      .toContain('IMPLEMENT: build the click counter\nwith multiple\nlines');

    expect(events.some((e) => e.kind === 'input' && e.label === 'task-prompt')).toBe(true);
    expect(events.some((e) => e.kind === 'input' && e.label === 'clarification-answer')).toBe(true);
  });

  it('completes on idle-with-new-content; pure input-box re-render does NOT settle (echo guard)', async () => {
    const cwd = tmpWs();
    const spawner = new FakePtySpawner({
      initial: [READY],
      rules: [
        // The TUI re-renders ONLY the input box (echo, no agent content) —
        // must NOT settle; then real content arrives and settles it.
        { onInput: 'complete task specification', emit: [`${INPUT_BOX}\n`, `did the work\nTASK COMPLETE\n${INPUT_BOX}\n`] },
      ],
    });
    const adapter = new GooseTuiAdapter(spawner, syncScreen);
    const outcome = await adapter.run({ command: 'goose', args: [], cwd, prompt: 'p' });
    expect(outcome.timedOut).toBe(false);
    expect(outcome.finalText).toContain('did the work');
  });

  it('stops at maxTurns instead of looping forever on endless questions', async () => {
    const cwd = tmpWs();
    const spawner = new FakePtySpawner({
      initial: [READY],
      rules: [{ onInput: /.*/, emit: [`And another question?\n${INPUT_BOX}\n`] }],
    });
    const adapter = new GooseTuiAdapter(spawner, { ...syncScreen, config: { maxTurns: 3 } });
    const outcome = await adapter.run({ command: 'goose', args: [], cwd, prompt: 'start' });
    const answers = spawner.lastProcess!.writes.filter((w) => w.includes('Proceed with the most reasonable')).length;
    expect(answers).toBeLessThanOrEqual(3);
    expect(outcome.timedOut).toBe(true); // gave up on the Q&A loop
  });

  it('threads GOOSE_PROVIDER/MODEL and mirrors them to GOOSE_PLANNER_* env', async () => {
    const prev = {
      p: process.env.JANUMICODE_GOOSE_PROVIDER, m: process.env.JANUMICODE_GOOSE_MODEL,
      pp: process.env.JANUMICODE_GOOSE_PLANNER_PROVIDER, pm: process.env.JANUMICODE_GOOSE_PLANNER_MODEL,
    };
    process.env.JANUMICODE_GOOSE_PROVIDER = 'ollama';
    process.env.JANUMICODE_GOOSE_MODEL = 'gpt-oss:20b';
    delete process.env.JANUMICODE_GOOSE_PLANNER_PROVIDER;
    delete process.env.JANUMICODE_GOOSE_PLANNER_MODEL;
    try {
      const cwd = tmpWs();
      const spawner = new FakePtySpawner({ initial: [READY], rules: [{ onInput: 'complete task specification', emit: [`ok\nTASK COMPLETE\n${INPUT_BOX}\n`] }] });
      const adapter = new GooseTuiAdapter(spawner, syncScreen);
      await adapter.run({ command: 'goose', args: [], cwd, prompt: 'p' });
      const env = spawner.spawns[0].env ?? {};
      expect(env.GOOSE_PROVIDER).toBe('ollama');
      expect(env.GOOSE_MODEL).toBe('gpt-oss:20b');
      expect(env.GOOSE_PLANNER_PROVIDER).toBe('ollama');
      expect(env.GOOSE_PLANNER_MODEL).toBe('gpt-oss:20b');
      // Reasoning-visibility defaults applied on every TUI session.
      expect(env.GOOSE_CLI_SHOW_THINKING).toBe('true');
      expect(env.GOOSE_RANDOM_THINKING_MESSAGES).toBe('false');
    } finally {
      const restore = (k: string, v: string | undefined): void => {
        if (v === undefined) delete process.env[k]; else process.env[k] = v;
      };
      restore('JANUMICODE_GOOSE_PROVIDER', prev.p);
      restore('JANUMICODE_GOOSE_MODEL', prev.m);
      restore('JANUMICODE_GOOSE_PLANNER_PROVIDER', prev.pp);
      restore('JANUMICODE_GOOSE_PLANNER_MODEL', prev.pm);
    }
  });
});

describe('GooseTuiAdapter — completion sentinel + continuation nudge', () => {
  it('an idle settle WITHOUT the sentinel gets a continue nudge; sentinel ends the exchange', async () => {
    const cwd = tmpWs();
    const spawner = new FakePtySpawner({
      initial: [READY],
      rules: [
        // First turn ends mid-thought (the live failure mode: text, no marker).
        { onInput: 'complete task specification', emit: [`I will research the modules first.\nLet me look around.\n${INPUT_BOX}\n`] },
        // The nudge produces the finished work with the sentinel.
        { onInput: 'Continue working', emit: [`Implemented and verified.\nTASK COMPLETE\n${INPUT_BOX}\n`] },
      ],
    });
    const events: SessionLogEvent[] = [];
    const adapter = new GooseTuiAdapter(spawner, { ...syncScreen, onLog: (e) => events.push(e) });
    const outcome = await adapter.run({ command: 'goose', args: [], cwd, prompt: 'p' });
    expect(outcome.timedOut).toBe(false);
    expect(outcome.finalText).toContain('TASK COMPLETE');
    expect(events.some((e) => e.kind === 'input' && e.label === 'continue-nudge')).toBe(true);
  });
});

describe('GooseTuiAdapter — sentinel echo-safety', () => {
  it('echoed instruction fragments containing the sentinel do NOT falsely complete', async () => {
    const cwd = tmpWs();
    // The TUI echoes our instruction; a wrapped fragment carries the marker
    // mid-sentence. This must be filtered as echo (NOT echo-exempt) and must
    // not satisfy the completion check — the live-killer the endsWith
    // exemption would have caused.
    const echoFragment = 'end your final message with the exact line: TASK COMPLETE';
    const spawner = new FakePtySpawner({
      initial: [READY],
      rules: [
        {
          onInput: 'complete task specification',
          emit: [`${echoFragment}\n${INPUT_BOX}\n`, `real work done\nTASK COMPLETE\n${INPUT_BOX}\n`],
        },
      ],
    });
    const adapter = new GooseTuiAdapter(spawner, syncScreen);
    const outcome = await adapter.run({ command: 'goose', args: [], cwd, prompt: 'p' });
    expect(outcome.timedOut).toBe(false);
    expect(outcome.finalText).toContain('real work done'); // settled on real content
    expect(outcome.finalText).not.toContain('exact line:'); // echo never became agent content
  });

  it('never types the marker as the final token of any instruction or nudge', async () => {
    const cwd = tmpWs();
    const spawner = new FakePtySpawner({
      initial: [READY],
      rules: [
        { onInput: 'complete task specification', emit: [`thinking about it.\n${INPUT_BOX}\n`] },
        { onInput: 'Continue working', emit: [`done.\nTASK COMPLETE\n${INPUT_BOX}\n`] },
      ],
    });
    const adapter = new GooseTuiAdapter(spawner, syncScreen);
    await adapter.run({ command: 'goose', args: [], cwd, prompt: 'p' });
    for (const w of spawner.lastProcess!.writes) {
      // A send ending in the bare marker can wrap so its FINAL fragment is
      // exactly the (echo-exempt) marker line → instant false completion.
      expect(w.trimEnd().endsWith('TASK COMPLETE')).toBe(false);
    }
  });
});

describe('GooseTuiAdapter — LLM session responder (spec-grounded answers)', () => {
  it('answers a clarifying question with the responder reply instead of the canned deflection', async () => {
    const cwd = tmpWs();
    const spawner = new FakePtySpawner({
      initial: [READY],
      rules: [
        { onInput: 'complete task specification', emit: [`Which slug length should I use?\n${INPUT_BOX}\n`] },
        { onInput: 'Use 7-character base62 slugs', emit: [`Implemented.\nTASK COMPLETE\n${INPUT_BOX}\n`] },
      ],
    });
    const seen: Array<{ kind: string; question: string; taskSpec: string; agentContext: string }> = [];
    const adapter = new GooseTuiAdapter(spawner, {
      ...syncScreen,
      responder: async (input) => {
        seen.push(input);
        return 'Use 7-character base62 slugs per the spec.';
      },
    });
    const outcome = await adapter.run({ command: 'goose', args: [], cwd, prompt: 'SPEC: slugs are 7-char base62' });

    expect(outcome.timedOut).toBe(false);
    const writes = spawner.lastProcess!.writes.join('');
    expect(writes).toContain('Use 7-character base62 slugs per the spec.');
    expect(writes).not.toContain('Proceed with the most reasonable'); // canned NOT used

    // The responder received the real question + the spec as grounding.
    expect(seen.length).toBe(1);
    expect(seen[0].kind).toBe('question');
    expect(seen[0].question).toContain('Which slug length');
    expect(seen[0].taskSpec).toContain('SPEC: slugs are 7-char base62');
    expect(seen[0].agentContext).toContain('Which slug length');
  });

  it('falls back to the canned response when the responder returns null or throws', async () => {
    for (const responder of [async () => null, async () => { throw new Error('llm down'); }]) {
      const cwd = tmpWs();
      const spawner = new FakePtySpawner({
        initial: [READY],
        rules: [
          { onInput: 'complete task specification', emit: [`Which framework should I pick?\n${INPUT_BOX}\n`] },
          { onInput: 'Proceed with the most reasonable', emit: [`Done.\nTASK COMPLETE\n${INPUT_BOX}\n`] },
        ],
      });
      const adapter = new GooseTuiAdapter(spawner, { ...syncScreen, responder });
      const outcome = await adapter.run({ command: 'goose', args: [], cwd, prompt: 'p' });
      expect(outcome.timedOut).toBe(false);
      expect(spawner.lastProcess!.writes.join('')).toContain('Proceed with the most reasonable');
    }
  });

  it('sanitizes responder replies: one line, no completion sentinel typed by us', async () => {
    const cwd = tmpWs();
    const spawner = new FakePtySpawner({
      initial: [READY],
      rules: [
        { onInput: 'complete task specification', emit: [`Anything else before I finish?\n${INPUT_BOX}\n`] },
        { onInput: 'No — verify the criteria. Then stop.', emit: [`Verified.\nTASK COMPLETE\n${INPUT_BOX}\n`] },
      ],
    });
    // Misbehaving responder: multi-line AND tries to type the sentinel.
    const adapter = new GooseTuiAdapter(spawner, {
      ...syncScreen,
      responder: async () => 'No — verify the criteria.\nThen stop. TASK COMPLETE',
    });
    const outcome = await adapter.run({ command: 'goose', args: [], cwd, prompt: 'p' });
    expect(outcome.timedOut).toBe(false);
    const answer = spawner.lastProcess!.writes.find((w) => w.startsWith('No — verify'));
    expect(answer).toBeDefined();
    expect(answer).toBe('No — verify the criteria. Then stop.\r'); // collapsed + sentinel stripped
  });

  it('composes a contextual continuation nudge and re-states the sentinel deterministically', async () => {
    const cwd = tmpWs();
    const spawner = new FakePtySpawner({
      initial: [READY],
      rules: [
        // Turn ends mid-thought (statement, not a question → idle, no marker).
        { onInput: 'complete task specification', emit: [`I should search for similar modules first.\n${INPUT_BOX}\n`] },
        { onInput: 'Yes — search src/lib for similar modules', emit: [`Implemented and verified.\nTASK COMPLETE\n${INPUT_BOX}\n`] },
      ],
    });
    const seen: string[] = [];
    const adapter = new GooseTuiAdapter(spawner, {
      ...syncScreen,
      responder: async (input) => {
        seen.push(input.kind);
        return input.kind === 'nudge' ? 'Yes — search src/lib for similar modules, then implement the counter there.' : null;
      },
    });
    const outcome = await adapter.run({ command: 'goose', args: [], cwd, prompt: 'p' });
    expect(outcome.timedOut).toBe(false);
    expect(seen).toContain('nudge');
    const nudge = spawner.lastProcess!.writes.find((w) => w.startsWith('Yes — search src/lib'));
    // Our deterministic sentinel re-statement is appended AFTER sanitize.
    expect(nudge).toContain('end your final message with the exact line: TASK COMPLETE');
  });

  it('protocol prompts (act-on-plan / clear-history) never consult the responder', async () => {
    const cwd = tmpWs();
    const spawner = new FakePtySpawner({
      initial: [READY],
      rules: [
        { onInput: 'summarize the task', emit: [`A click counter module.\n${INPUT_BOX}\n`] },
        { onInput: '/plan', emit: [`Entering plan mode. To exit early, type /endplan\n${INPUT_BOX}\n`] },
        { onInput: 'Create a plan for the task you just read', emit: [`PLAN: 1. build\nWould you like to act on this plan?\n${INPUT_BOX}\n`] },
        { onInput: 'act on the plan now', emit: [`Done.\nTASK COMPLETE\n${INPUT_BOX}\n`] },
        { onInput: '/endplan', emit: [`Plan mode disabled.\n${INPUT_BOX}\n`] },
      ],
    });
    const questionCalls: string[] = [];
    const adapter = new GooseTuiAdapter(spawner, {
      ...syncScreen,
      config: { usePlanMode: true },
      responder: async (input) => {
        if (input.kind === 'question') questionCalls.push(input.question);
        return null;
      },
    });
    await adapter.run({ command: 'goose', args: [], cwd, prompt: 'task' });
    expect(questionCalls).toEqual([]); // act-on-plan handled by the canned rail
    expect(spawner.lastProcess!.writes.join('')).toContain('act on the plan now');
  });
});

describe('GooseTuiAdapter — busy/stall semantics', () => {
  // Next-macrotask timers: waits "time out" almost instantly, AFTER pending
  // emissions are parsed (sync screen), exercising the timeout branches.
  const instantTimers = {
    setTimeoutFn: (cb: () => void): unknown => setImmediate(cb),
    clearTimeoutFn: (h: unknown): void => clearImmediate(h as NodeJS.Immediate),
  };

  it('content progress extends waiting; a dead window stalls', async () => {
    const cwd = tmpWs();
    const spawner = new FakePtySpawner({
      initial: [READY],
      // One frame of real output (no input box) — then silence forever.
      rules: [{ onInput: 'complete task specification', emit: ['working on step 1...\n'] }],
    });
    const events: SessionLogEvent[] = [];
    const adapter = new GooseTuiAdapter(spawner, { ...instantTimers, ...syncScreen, onLog: (e) => events.push(e) });
    const outcome = await adapter.run({ command: 'goose', args: [], cwd, prompt: 'p' });
    expect(outcome.timedOut).toBe(true); // eventually a dead window
    // More than one drive window ran: first timed out but saw the new content
    // line → continued; the next saw nothing → stalled. (≥1 ready wait + ≥2 drive waits.)
    const waits = events.filter((e) => e.kind === 'wait').length;
    expect(waits).toBeGreaterThanOrEqual(3);
  });

  it('busy spinner extends waiting until the session budget, never a premature stall', async () => {
    const cwd = tmpWs();
    const spawner = new FakePtySpawner({
      initial: [READY],
      // Only an animated spinner — classifier reads BUSY forever.
      rules: [{ onInput: 'complete task specification', emit: ['•  Initializing clever mode...  (Ctrl+C to interrupt)'] }],
    });
    // Clock advances 400s per reading → the 1800s budget trips after a few
    // loop iterations (busy keeps extending, the DEADLINE ends it).
    let t = 0;
    const adapter = new GooseTuiAdapter(spawner, {
      ...instantTimers, ...syncScreen, nowFn: () => (t += 400_000),
    });
    const outcome = await adapter.run({ command: 'goose', args: [], cwd, prompt: 'p' });
    expect(outcome.timedOut).toBe(true); // ended by budget, not by stall
  });
});

describe('GooseTuiAdapter (native /plan mode, opt-in)', () => {
  it('pre-reads the spec, enters /plan, answers act-on-plan, exits with /endplan', async () => {
    const cwd = tmpWs();
    const spawner = new FakePtySpawner({
      initial: [READY],
      rules: [
        // Pre-read in normal mode (tools available).
        { onInput: 'summarize the task', emit: [`The task asks for a click counter module.\n${INPUT_BOX}\n`] },
        { onInput: '/plan', emit: [`Entering plan mode. To exit early, type /endplan\n${INPUT_BOX}\n`] },
        // Planner produces a plan and asks whether to act on it.
        { onInput: 'Create a plan for the task you just read', emit: [`PLAN:\n1. do things\nWould you like to act on this plan?\n${INPUT_BOX}\n`] },
        { onInput: 'act on the plan now', emit: [`Acting on plan... done.\nTASK COMPLETE\n${INPUT_BOX}\n`] },
        { onInput: '/endplan', emit: [`Plan mode disabled.\n${INPUT_BOX}\n`] },
      ],
    });
    const adapter = new GooseTuiAdapter(spawner, { ...syncScreen, config: { usePlanMode: true } });
    const outcome = await adapter.run({ command: 'goose', args: [], cwd, prompt: 'task' });
    const writes = spawner.lastProcess!.writes.join('');
    expect(writes).toContain('summarize the task'); // pre-read sequencing
    expect(writes).toContain('/plan\r');
    expect(writes).toContain('act on the plan now');
    expect(writes).toContain('/endplan\r');
    expect(outcome.finalText).toContain('done');
  });
});
