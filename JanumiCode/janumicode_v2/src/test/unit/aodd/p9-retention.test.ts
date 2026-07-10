/**
 * P9 retention + diff tests.
 *
 * Covers:
 *   - pruneAoddRuns honors max_runs (count cap)
 *   - pruneAoddRuns honors ttl_days (time cap), with min_runs floor
 *   - .keep sentinel preserves a run even when it's a candidate
 *   - dry-run reports candidates without deleting
 *   - the DB / non-AODD files within `runs/<id>/` are NOT touched
 *   - CLI: aodd prune --dry-run, aodd prune, aodd diff
 */

import { execFileSync, type ExecFileSyncOptions } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  closeStreams,
  DEFAULT_RETENTION,
  emit as aoddEmit,
  endRun,
  initialize,
  pruneAoddRuns,
  startRun,
} from '../../../lib/aodd';
import { withTraceContext } from '../../../lib/trace/traceContext';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const CLI_PATH = path.join(REPO_ROOT, 'scripts', 'aodd.js');

function runCli(workspaceRoot: string, args: string[]): {
  stdout: string;
  stderr: string;
  status: number;
} {
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
 * Create a fake AODD run directory tree without going through emit().
 * Lets us seed many runs cheaply, with explicit `started_at` /
 * `completed_at` for TTL testing. `extraFiles` lets a test deposit a
 * non-AODD file at `runs/<id>/<name>` to verify it survives a prune.
 */
function seedRun(
  workspaceRoot: string,
  runId: string,
  startedAt: Date,
  completedAt: Date,
  options: { hasKeep?: boolean; extraFiles?: Record<string, string> } = {},
): void {
  const runDir = path.join(workspaceRoot, '.janumicode', 'runs', runId);
  const aodd = path.join(runDir, 'aodd');
  fs.mkdirSync(aodd, { recursive: true });
  fs.writeFileSync(
    path.join(aodd, 'index.json'),
    JSON.stringify(
      {
        schema_version: 1,
        run_id: runId,
        started_at: startedAt.toISOString(),
        completed_at: completedAt.toISOString(),
        status: 'success',
        events: { first_event_id: 'a', last_event_id: 'b', count: 0 },
      },
      null,
      2,
    ),
  );
  fs.writeFileSync(path.join(aodd, 'events.ndjson'), '');
  if (options.hasKeep) {
    fs.writeFileSync(path.join(aodd, '.keep'), '');
  }
  for (const [name, content] of Object.entries(options.extraFiles ?? {})) {
    fs.writeFileSync(path.join(runDir, name), content);
  }
}

function aoddExists(workspaceRoot: string, runId: string): boolean {
  return fs.existsSync(
    path.join(workspaceRoot, '.janumicode', 'runs', runId, 'aodd'),
  );
}

describe('pruneAoddRuns (P9)', () => {
  let workspaceRoot: string;

  beforeEach(() => {
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aodd-p9-'));
  });

  afterEach(() => {
    closeStreams();
    initialize(null);
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('returns empty result when no runs exist', () => {
    const r = pruneAoddRuns(workspaceRoot, DEFAULT_RETENTION);
    expect(r.candidates).toEqual([]);
    expect(r.pruned).toEqual([]);
    expect(r.kept_by_sentinel).toEqual([]);
  });

  it('honors max_runs (count cap) keeping newest', () => {
    const now = Date.now();
    // 5 runs, 1 hour apart, all recent.
    for (let i = 0; i < 5; i++) {
      const t = new Date(now - i * 60 * 60 * 1000);
      seedRun(workspaceRoot, `run-${i}`, t, t);
    }
    const r = pruneAoddRuns(workspaceRoot, {
      max_runs: 3,
      ttl_days: 365,
      min_runs: 0,
    });
    // Newest 3 (run-0, run-1, run-2) kept; run-3 and run-4 pruned.
    expect(r.candidates.sort()).toEqual(['run-3', 'run-4']);
    expect(r.pruned.sort()).toEqual(['run-3', 'run-4']);
    expect(aoddExists(workspaceRoot, 'run-0')).toBe(true);
    expect(aoddExists(workspaceRoot, 'run-2')).toBe(true);
    expect(aoddExists(workspaceRoot, 'run-3')).toBe(false);
    expect(aoddExists(workspaceRoot, 'run-4')).toBe(false);
  });

  it('honors ttl_days with min_runs floor', () => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    // 5 runs: 0d, 10d, 40d, 60d, 90d ago.
    seedRun(workspaceRoot, 'fresh', new Date(now), new Date(now));
    seedRun(workspaceRoot, 'd10', new Date(now - 10 * day), new Date(now - 10 * day));
    seedRun(workspaceRoot, 'd40', new Date(now - 40 * day), new Date(now - 40 * day));
    seedRun(workspaceRoot, 'd60', new Date(now - 60 * day), new Date(now - 60 * day));
    seedRun(workspaceRoot, 'd90', new Date(now - 90 * day), new Date(now - 90 * day));

    // TTL 30d. min_runs=3 means newest 3 survive regardless of TTL.
    const r = pruneAoddRuns(workspaceRoot, {
      max_runs: 100,
      ttl_days: 30,
      min_runs: 3,
    });
    // fresh / d10 / d40 are the 3 newest → floor protects them.
    // d60 and d90 are over TTL and outside floor → pruned.
    expect(r.pruned.sort()).toEqual(['d60', 'd90']);
    expect(aoddExists(workspaceRoot, 'fresh')).toBe(true);
    expect(aoddExists(workspaceRoot, 'd10')).toBe(true);
    expect(aoddExists(workspaceRoot, 'd40')).toBe(true);
    expect(aoddExists(workspaceRoot, 'd60')).toBe(false);
    expect(aoddExists(workspaceRoot, 'd90')).toBe(false);
  });

  it('.keep sentinel preserves a run even when it would be pruned', () => {
    const now = Date.now();
    for (let i = 0; i < 5; i++) {
      const t = new Date(now - i * 60 * 60 * 1000);
      seedRun(workspaceRoot, `run-${i}`, t, t, { hasKeep: i === 4 });
    }
    const r = pruneAoddRuns(workspaceRoot, {
      max_runs: 3,
      ttl_days: 365,
      min_runs: 0,
    });
    expect(r.candidates.sort()).toEqual(['run-3', 'run-4']);
    expect(r.pruned).toEqual(['run-3']);
    expect(r.kept_by_sentinel).toEqual(['run-4']);
    expect(aoddExists(workspaceRoot, 'run-4')).toBe(true);
    expect(aoddExists(workspaceRoot, 'run-3')).toBe(false);
  });

  it('dry-run reports candidates without deleting anything', () => {
    const now = Date.now();
    for (let i = 0; i < 5; i++) {
      const t = new Date(now - i * 60 * 60 * 1000);
      seedRun(workspaceRoot, `run-${i}`, t, t);
    }
    const r = pruneAoddRuns(
      workspaceRoot,
      { max_runs: 3, ttl_days: 365, min_runs: 0 },
      { dryRun: true },
    );
    expect(r.candidates.sort()).toEqual(['run-3', 'run-4']);
    expect(r.pruned).toEqual([]);
    expect(aoddExists(workspaceRoot, 'run-3')).toBe(true);
    expect(aoddExists(workspaceRoot, 'run-4')).toBe(true);
  });

  it('does NOT touch non-AODD files within runs/<id>/', () => {
    const now = Date.now();
    seedRun(workspaceRoot, 'recent', new Date(now), new Date(now));
    seedRun(workspaceRoot, 'old', new Date(now - 60 * 60 * 1000), new Date(now - 60 * 60 * 1000), {
      extraFiles: {
        'transforms.jsonl': 'legacy production trace\n',
        'lifecycle.ndjson': 'legacy lifecycle log\n',
      },
    });
    pruneAoddRuns(workspaceRoot, { max_runs: 1, ttl_days: 365, min_runs: 0 });

    // 'old' had its aodd/ subdir pruned but the legacy production
    // files in runs/old/ must survive.
    expect(aoddExists(workspaceRoot, 'old')).toBe(false);
    expect(
      fs.existsSync(
        path.join(workspaceRoot, '.janumicode', 'runs', 'old', 'transforms.jsonl'),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(workspaceRoot, '.janumicode', 'runs', 'old', 'lifecycle.ndjson'),
      ),
    ).toBe(true);
  });

  // --- Characterization tests for discoverRuns() fallback branches ---
  // discoverRuns is private; these pin its behavior through pruneAoddRuns
  // for the paths seedRun() never produces: a run dir with no aodd/ subdir,
  // and index.json that is missing / malformed / partial / has invalid
  // timestamp fields (all of which fall back to the aodd/ dir mtime for the
  // sort key while leaving completedAt null unless completed_at parses).

  it('ignores run directories that lack an aodd/ subdir', () => {
    // A run dir with production files but no aodd/ trace subdir is invisible
    // to retention regardless of how aggressive the policy is.
    const runDir = path.join(workspaceRoot, '.janumicode', 'runs', 'no-aodd');
    fs.mkdirSync(runDir, { recursive: true });
    fs.writeFileSync(path.join(runDir, 'transforms.jsonl'), 'legacy\n');

    const r = pruneAoddRuns(workspaceRoot, {
      max_runs: 0,
      ttl_days: 0,
      min_runs: 0,
    });
    expect(r.candidates).toEqual([]);
    expect(r.pruned).toEqual([]);
    expect(r.kept_by_sentinel).toEqual([]);
    expect(fs.existsSync(path.join(runDir, 'transforms.jsonl'))).toBe(true);
  });

  it('falls back to aodd/ dir mtime when index.json is missing/malformed/partial', () => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    // Baseline: a valid, old run that IS over TTL and must be pruned.
    seedRun(workspaceRoot, 'old', new Date(now - 60 * day), new Date(now - 60 * day));

    // Helper to make an aodd/ dir with an optional index.json body.
    const mkAodd = (runId: string, indexBody?: string): void => {
      const aodd = path.join(workspaceRoot, '.janumicode', 'runs', runId, 'aodd');
      fs.mkdirSync(aodd, { recursive: true });
      if (indexBody !== undefined) {
        fs.writeFileSync(path.join(aodd, 'index.json'), indexBody);
      }
    };

    // No index.json at all -> sortKey falls back to dir mtime (~now),
    // completedAt is null so the TTL check uses that mtime -> NOT over TTL.
    mkAodd('no-index');
    // Malformed index.json -> JSON.parse throws -> same mtime fallback.
    mkAodd('bad-index', '{ not valid json');
    // Valid JSON but no timestamp fields -> mtime fallback, completedAt null.
    mkAodd('empty-index', '{}');
    // Valid JSON with non-parseable timestamp strings -> mtime fallback.
    mkAodd(
      'invalid-dates',
      JSON.stringify({ started_at: 'nope', completed_at: 'also-nope' }),
    );

    const r = pruneAoddRuns(workspaceRoot, {
      max_runs: 100,
      ttl_days: 30,
      min_runs: 0,
    });

    // Only the genuinely-old run is over TTL; every mtime-fallback run is
    // recent (created just now) so it survives.
    expect(r.pruned).toEqual(['old']);
    expect(aoddExists(workspaceRoot, 'old')).toBe(false);
    expect(aoddExists(workspaceRoot, 'no-index')).toBe(true);
    expect(aoddExists(workspaceRoot, 'bad-index')).toBe(true);
    expect(aoddExists(workspaceRoot, 'empty-index')).toBe(true);
    expect(aoddExists(workspaceRoot, 'invalid-dates')).toBe(true);
  });

  it('parses completed_at independently of the started_at mtime fallback', () => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    // A recent run to occupy a fresh slot (not over TTL, not over cap).
    seedRun(workspaceRoot, 'fresh', new Date(now), new Date(now));

    // index.json with ONLY completed_at (60d ago) and no started_at.
    // started_at is absent -> sortKey falls back to the aodd/ dir mtime
    // (~now, so it sorts near the top), but completed_at IS parsed, so the
    // TTL check sees 60d ago -> over TTL -> pruned.
    const aodd = path.join(workspaceRoot, '.janumicode', 'runs', 'partial-old', 'aodd');
    fs.mkdirSync(aodd, { recursive: true });
    fs.writeFileSync(
      path.join(aodd, 'index.json'),
      JSON.stringify({ completed_at: new Date(now - 60 * day).toISOString() }),
    );

    const r = pruneAoddRuns(workspaceRoot, {
      max_runs: 100,
      ttl_days: 30,
      min_runs: 0,
    });
    expect(r.pruned).toEqual(['partial-old']);
    expect(aoddExists(workspaceRoot, 'partial-old')).toBe(false);
    expect(aoddExists(workspaceRoot, 'fresh')).toBe(true);
  });
});

describe('AODD CLI prune + diff (P9)', () => {
  let workspaceRoot: string;

  beforeEach(() => {
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aodd-p9-cli-'));
  });

  afterEach(() => {
    closeStreams();
    initialize(null);
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('aodd prune --dry-run prints candidates and changes nothing', () => {
    const now = Date.now();
    // Seed 15 runs so we exceed the CLI's hardcoded default (max_runs=10).
    for (let i = 0; i < 15; i++) {
      const t = new Date(now - i * 60 * 60 * 1000);
      seedRun(workspaceRoot, `run-${i}`, t, t);
    }
    const r = runCli(workspaceRoot, ['prune', '--dry-run']);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('dry-run:');
    // 15 - 10 cap = 5 candidates (run-10..run-14).
    for (let i = 10; i < 15; i++) {
      expect(r.stdout).toContain(`run-${i}`);
    }
    expect(aoddExists(workspaceRoot, 'run-14')).toBe(true);
  });

  it('aodd prune actually deletes the candidates', () => {
    const now = Date.now();
    for (let i = 0; i < 15; i++) {
      const t = new Date(now - i * 60 * 60 * 1000);
      seedRun(workspaceRoot, `run-${i}`, t, t);
    }
    const r = runCli(workspaceRoot, ['prune']);
    expect(r.status).toBe(0);
    expect(aoddExists(workspaceRoot, 'run-0')).toBe(true);
    expect(aoddExists(workspaceRoot, 'run-9')).toBe(true);
    expect(aoddExists(workspaceRoot, 'run-10')).toBe(false);
    expect(aoddExists(workspaceRoot, 'run-14')).toBe(false);
  });

  it('aodd diff compares two run summaries', async () => {
    // Produce two runs with real emit so they have summaries.
    initialize({ workspaceRoot, janumicodeVersionSha: 'test', enabled: true });
    startRun('run-x');
    aoddEmit('run.started', { intent_brief: 'x' });
    await withTraceContext(
      { workflow_run_id: 'run-x', phase_id: '1', sub_phase_id: 'a' },
      async () => {
        aoddEmit(
          'llm.invoked',
          { provider: 'a', model: 'claude-sonnet-4-6', prompt: 'p' },
          { invocation_id: 'i1' },
        );
        aoddEmit(
          'llm.returned',
          {
            text: 't',
            thinking: null,
            input_tokens: 1,
            output_tokens: 1,
            duration_ms: 10,
            retry_attempts: 0,
          },
          { invocation_id: 'i1' },
        );
      },
    );
    endRun({ status: 'success' });

    startRun('run-y');
    aoddEmit('run.started', { intent_brief: 'y' });
    await withTraceContext(
      { workflow_run_id: 'run-y', phase_id: '1', sub_phase_id: 'a' },
      async () => {
        aoddEmit(
          'llm.failed',
          {
            error: { message: 'boom' },
            duration_ms: 50,
            retry_attempts: 2,
          },
          { invocation_id: 'i2' },
        );
      },
    );
    endRun({ status: 'failed', error: { message: 'phase 1 failed' } });

    const r = runCli(workspaceRoot, ['diff', 'run-x', 'run-y']);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('AODD run diff: run-x vs run-y');
    expect(r.stdout).toContain('status:        success → failed');
    expect(r.stdout).toContain('retries:       0 → 2');
  });
});
