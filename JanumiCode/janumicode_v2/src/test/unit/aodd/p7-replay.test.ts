/**
 * P7 replay library + CLI tests.
 *
 * Verifies the read-side API in `src/lib/aodd/replay.ts` and end-to-end
 * behavior of `scripts/aodd.js` against synthetic on-disk fixtures.
 */

import { execFileSync, type ExecFileSyncOptions } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  closeStreams,
  emit as aoddEmit,
  endRun,
  initialize,
  listRuns,
  listSubPhaseSummaries,
  maybeSpillText,
  readCausedByChain,
  readEventsSync,
  readParentChain,
  readPayloadByUlid,
  readRunSummary,
  readRunSummaryMd,
  readSubPhaseSummary,
  readSubPhaseSummaryMd,
  startRun,
} from '../../../lib/aodd';
import { withTraceContext } from '../../../lib/trace/traceContext';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const CLI_PATH = path.join(REPO_ROOT, 'scripts', 'aodd.js');

function runCli(
  workspaceRoot: string,
  args: string[],
): { stdout: string; stderr: string; status: number } {
  const opts: ExecFileSyncOptions = { encoding: 'utf8' };
  try {
    const stdout = execFileSync(
      process.execPath,
      [CLI_PATH, ...args, '--workspace', workspaceRoot],
      opts,
    );
    return { stdout: String(stdout), stderr: '', status: 0 };
  } catch (err) {
    const e = err as { stdout?: Buffer; stderr?: Buffer; status?: number };
    return {
      stdout: e.stdout ? String(e.stdout) : '',
      stderr: e.stderr ? String(e.stderr) : '',
      status: e.status ?? 1,
    };
  }
}

/**
 * Create a fully-populated AODD run fixture: a run with one phase, one
 * sub-phase, prompt + LLM events, plus a parent chain via withAoddSpan
 * being simulated by an explicit parent_event_id in a follow-up emit.
 */
async function populateFixtureRun(workspaceRoot: string, runId: string): Promise<{
  invocationId: string;
}> {
  initialize({ workspaceRoot, janumicodeVersionSha: 'v2-test', enabled: true });
  startRun(runId);
  aoddEmit('run.started', { intent_brief: 'fixture' });

  let invocationId = 'inv-fix-1';

  await withTraceContext(
    { workflow_run_id: runId, phase_id: '1', sub_phase_id: null },
    async () => {
      aoddEmit('phase.entered', { phase_name: 'Intent Capture' });
    },
  );

  await withTraceContext(
    { workflow_run_id: runId, phase_id: '1', sub_phase_id: 'fixture_sub' },
    async () => {
      aoddEmit('prompt.template_rendered', {
        template_key: 'phase01/fixture',
        template_source_sha: 'sha-fix',
      });
      const matId = aoddEmit(
        'prompt.materialized',
        {
          invocation_id: invocationId,
          final_prompt: 'fixture prompt body',
        },
        { invocation_id: invocationId },
      );
      aoddEmit(
        'llm.invoked',
        {
          provider: 'anthropic',
          model: 'claude-sonnet-4-6',
          temperature: 0,
          prompt: 'fixture prompt body',
        },
        { invocation_id: invocationId, parent_event_id: matId ?? undefined },
      );
      aoddEmit(
        'llm.returned',
        {
          text: 'fixture response',
          thinking: null,
          input_tokens: 10,
          output_tokens: 5,
          duration_ms: 100,
          retry_attempts: 0,
        },
        { invocation_id: invocationId, parent_event_id: matId ?? undefined },
      );
    },
  );

  await withTraceContext(
    { workflow_run_id: runId, phase_id: '1', sub_phase_id: null },
    async () => {
      aoddEmit('phase.exited', {
        phase_name: 'Intent Capture',
        status: 'success',
        duration_ms: 120,
        artifact_count: 1,
      });
    },
  );

  endRun({ status: 'success' });
  return { invocationId };
}

// ── Library tests ───────────────────────────────────────────────────

describe('AODD replay library (P7)', () => {
  let workspaceRoot: string;

  beforeEach(() => {
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aodd-p7-'));
  });

  afterEach(() => {
    closeStreams();
    initialize(null);
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('listRuns surfaces the workspace’s AODD runs newest-first', async () => {
    await populateFixtureRun(workspaceRoot, 'wf-a');
    // Force the second run's started_at to be later.
    await new Promise((r) => setTimeout(r, 5));
    await populateFixtureRun(workspaceRoot, 'wf-b');

    const runs = listRuns(workspaceRoot);
    expect(runs.map((r) => r.run_id)).toEqual(['wf-b', 'wf-a']);
    expect(runs[0].status).toBe('success');
    expect(runs[0].duration_ms).not.toBeNull();
    expect(runs[0].has_keep).toBe(false);
  });

  it('readRunSummary + readSubPhaseSummary return the persisted JSON', async () => {
    await populateFixtureRun(workspaceRoot, 'wf-c');

    const run = readRunSummary(workspaceRoot, 'wf-c');
    expect(run).not.toBeNull();
    expect(run!.run_id).toBe('wf-c');
    expect(run!.status).toBe('success');

    const sub = readSubPhaseSummary(workspaceRoot, 'wf-c', 'fixture_sub');
    expect(sub).not.toBeNull();
    expect(sub!.phase_id).toBe('1');
    expect(sub!.sub_phase_id).toBe('fixture_sub');
    expect(sub!.who.model).toBe('claude-sonnet-4-6');
  });

  it('listSubPhaseSummaries returns sub-phases for a run (optionally per phase)', async () => {
    await populateFixtureRun(workspaceRoot, 'wf-d');
    const allSubs = listSubPhaseSummaries(workspaceRoot, 'wf-d');
    expect(allSubs.length).toBe(1);
    expect(allSubs[0].sub_phase_id).toBe('fixture_sub');

    const phase1Subs = listSubPhaseSummaries(workspaceRoot, 'wf-d', '1');
    expect(phase1Subs.length).toBe(1);

    const phase9Subs = listSubPhaseSummaries(workspaceRoot, 'wf-d', '9');
    expect(phase9Subs.length).toBe(0);
  });

  it('readEventsSync supports filtering by type and phase', async () => {
    await populateFixtureRun(workspaceRoot, 'wf-e');
    const all = readEventsSync(workspaceRoot, 'wf-e');
    expect(all.length).toBeGreaterThan(5);

    const llmReturned = readEventsSync(workspaceRoot, 'wf-e', {
      types: ['llm.returned'],
    });
    expect(llmReturned.length).toBe(1);

    const phase1Only = readEventsSync(workspaceRoot, 'wf-e', { phase_id: '1' });
    expect(phase1Only.length).toBeGreaterThan(0);
    for (const e of phase1Only) expect(e.phase_id).toBe('1');
  });

  it('readParentChain walks parent_event_id back to root', async () => {
    await populateFixtureRun(workspaceRoot, 'wf-f');
    const all = readEventsSync(workspaceRoot, 'wf-f');
    const llmReturned = all.find((e) => e.event_type === 'llm.returned')!;
    const chain = readParentChain(workspaceRoot, 'wf-f', llmReturned.event_id);
    // The first link is the event itself; the chain hops back via the
    // parent_event_id set to prompt.materialized's id.
    expect(chain[0].event_type).toBe('llm.returned');
    expect(chain[1].event_type).toBe('prompt.materialized');
  });

  it('readCausedByChain follows caused_by edges (empty chain when not set)', async () => {
    await populateFixtureRun(workspaceRoot, 'wf-g');
    const all = readEventsSync(workspaceRoot, 'wf-g');
    const some = all[0];
    const chain = readCausedByChain(workspaceRoot, 'wf-g', some.event_id);
    expect(chain.length).toBe(1); // just the event itself; no caused_by set
  });

  it('readPayloadByUlid loads the sidecar payload when present', async () => {
    initialize({ workspaceRoot, janumicodeVersionSha: 'v2-test', enabled: true });
    startRun('wf-payload');
    await withTraceContext(
      { workflow_run_id: 'wf-payload', phase_id: '1', sub_phase_id: 's' },
      async () => {
        // Route through maybeSpillText to mimic the production
        // llmCaller.ts pattern; >1KB forces the spill.
        aoddEmit('prompt.materialized', {
          invocation_id: 'inv-1',
          final_prompt: maybeSpillText('x'.repeat(2048)),
        });
      },
    );
    endRun({ status: 'success' });

    const all = readEventsSync(workspaceRoot, 'wf-payload');
    const mat = all.find((e) => e.event_type === 'prompt.materialized')!;
    const finalPrompt = (mat.payload as Record<string, unknown>).final_prompt;
    expect(typeof finalPrompt).toBe('object');
    const ref = finalPrompt as { payload_ref: string };

    const loaded = readPayloadByUlid(workspaceRoot, 'wf-payload', ref.payload_ref);
    expect(loaded).not.toBeNull();
    expect(loaded!.kind).toBe('text');
    expect(loaded!.content).toBe('x'.repeat(2048));
  });

  it('readRunSummaryMd + readSubPhaseSummaryMd return the markdown projections', async () => {
    await populateFixtureRun(workspaceRoot, 'wf-md');
    const runMd = readRunSummaryMd(workspaceRoot, 'wf-md');
    expect(runMd).toContain('Run summary: wf-md');
    const subMd = readSubPhaseSummaryMd(workspaceRoot, 'wf-md', '1', 'fixture_sub');
    expect(subMd).toContain('Sub-phase summary: phase 1 / fixture_sub');
  });
});

// ── CLI tests ────────────────────────────────────────────────────────

describe('AODD CLI (scripts/aodd.js)', () => {
  let workspaceRoot: string;

  beforeEach(() => {
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aodd-p7-cli-'));
  });

  afterEach(() => {
    closeStreams();
    initialize(null);
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('--help prints the usage block', () => {
    const r = runCli(workspaceRoot, ['--help']);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('usage: aodd');
    expect(r.stdout).toContain('ls');
  });

  it('ls lists the workspace runs', async () => {
    await populateFixtureRun(workspaceRoot, 'wf-cli-a');
    const r = runCli(workspaceRoot, ['ls']);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('wf-cli-a');
    expect(r.stdout).toContain('success');
  });

  it('show <run_id> prints the run summary', async () => {
    await populateFixtureRun(workspaceRoot, 'wf-cli-b');
    const r = runCli(workspaceRoot, ['show', 'wf-cli-b']);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('Run summary: wf-cli-b');
  });

  it('show --sub prints the named sub-phase summary', async () => {
    await populateFixtureRun(workspaceRoot, 'wf-cli-c');
    const r = runCli(workspaceRoot, [
      'show',
      'wf-cli-c',
      '--sub',
      'fixture_sub',
    ]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('Sub-phase summary: phase 1 / fixture_sub');
  });

  it('events <run_id> --type filters by event type', async () => {
    await populateFixtureRun(workspaceRoot, 'wf-cli-d');
    const r = runCli(workspaceRoot, [
      'events',
      'wf-cli-d',
      '--type',
      'llm.returned',
    ]);
    expect(r.status).toBe(0);
    const lines = r.stdout.trim().split('\n').filter(Boolean);
    expect(lines.length).toBe(1);
    expect(lines[0]).toContain('"event_type":"llm.returned"');
  });

  it('trail prints the parent_event_id chain', async () => {
    await populateFixtureRun(workspaceRoot, 'wf-cli-e');
    // Find the llm.returned event_id.
    const all = readEventsSync(workspaceRoot, 'wf-cli-e');
    const llmReturned = all.find((e) => e.event_type === 'llm.returned')!;
    const r = runCli(workspaceRoot, [
      'trail',
      'wf-cli-e',
      llmReturned.event_id,
    ]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('llm.returned');
    expect(r.stdout).toContain('prompt.materialized');
  });

  it('keep creates the .keep sentinel', async () => {
    await populateFixtureRun(workspaceRoot, 'wf-cli-f');
    const r = runCli(workspaceRoot, ['keep', 'wf-cli-f']);
    expect(r.status).toBe(0);
    expect(
      fs.existsSync(
        path.join(workspaceRoot, '.janumicode', 'runs', 'wf-cli-f', 'aodd', '.keep'),
      ),
    ).toBe(true);
  });

  it('grep matches across events.ndjson and payloads', async () => {
    await populateFixtureRun(workspaceRoot, 'wf-cli-g');
    const r = runCli(workspaceRoot, ['grep', 'wf-cli-g', 'phase01/fixture']);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('events.ndjson:');
  });

  it('returns exit code 3 when no runs exist', () => {
    const r = runCli(workspaceRoot, ['ls']);
    expect(r.status).toBe(3);
  });
});
