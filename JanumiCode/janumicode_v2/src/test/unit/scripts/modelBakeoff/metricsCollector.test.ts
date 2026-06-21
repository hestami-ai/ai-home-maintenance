import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  classifyOutcome,
  collectMetrics,
  readGooseServedModel,
  type RunEnvironment,
} from '../../../../../scripts/model-bakeoff/metricsCollector';
import type { CandidateSpec } from '../../../../../scripts/model-bakeoff/bakeoffConfig';

const CANDIDATE: CandidateSpec = { slug: 'c1', modelTag: 'gemma4:12b-it-qat', server: {} };

describe('readGooseServedModel', () => {
  let root: string;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'goose-root-')); });
  afterEach(() => { rmSync(root, { recursive: true, force: true }); });

  it('parses model + OLLAMA_HOST from the goose config.yaml', () => {
    mkdirSync(join(root, 'config'), { recursive: true });
    writeFileSync(join(root, 'config', 'config.yaml'),
      'OLLAMA_HOST: http://127.0.0.1:11434\nactive_provider: ollama\nproviders:\n    model: gemma4:26b-a4b-it-qat\n', 'utf-8');
    expect(readGooseServedModel(root)).toEqual({ model: 'gemma4:26b-a4b-it-qat', host: 'http://127.0.0.1:11434' });
  });

  it('returns nulls when no config.yaml exists', () => {
    expect(readGooseServedModel(root)).toEqual({ model: null, host: null });
  });
});

function env(overrides: Partial<RunEnvironment> = {}): RunEnvironment {
  return {
    contextFit: { verdict: 'ok', numCtx: 65536, size: 1000, sizeVram: 1000 },
    ollamaVersion: '0.30.0',
    vramAfterLoad: { usedMb: 16000, totalMb: 24576 },
    vramPeak: { usedMb: 18000, totalMb: 24576 },
    cliExitCode: 0,
    ...overrides,
  };
}

describe('classifyOutcome precedence', () => {
  const executorOk = { task_id: 't', status: 'success', exit_code: 0 };

  it('infra verdicts outrank quality verdicts', () => {
    expect(
      classifyOutcome({ executor: executorOk, test: { failed_count: 3 }, contextFit: 'cpu_offload', vramPeakFraction: 0.5 }),
    ).toBe('context_overflow');
    expect(
      classifyOutcome({ executor: executorOk, test: { failed_count: 3 }, contextFit: 'ok', vramPeakFraction: 0.99 }),
    ).toBe('oom_suspected');
    expect(
      classifyOutcome({ executor: { ...executorOk, timed_out: true }, test: null, contextFit: 'ok', vramPeakFraction: 0.5 }),
    ).toBe('timeout');
    expect(
      classifyOutcome({ executor: { ...executorOk, idled_out: true }, test: null, contextFit: 'ok', vramPeakFraction: 0.5 }),
    ).toBe('stall');
  });

  it('goose_error on bad exit, then test results decide', () => {
    expect(
      classifyOutcome({ executor: { ...executorOk, exit_code: 1 }, test: { failed_count: 0 }, contextFit: 'ok', vramPeakFraction: null }),
    ).toBe('goose_error');
    expect(
      classifyOutcome({ executor: executorOk, test: { passed_count: 4, failed_count: 1 }, contextFit: 'ok', vramPeakFraction: null }),
    ).toBe('test_fail');
    expect(
      classifyOutcome({ executor: executorOk, test: { passed_count: 4, failed_count: 0 }, contextFit: 'ok', vramPeakFraction: null }),
    ).toBe('pass');
    expect(classifyOutcome({ executor: executorOk, test: null, contextFit: 'ok', vramPeakFraction: null })).toBe(
      'no_test_result',
    );
  });
});

describe('collectMetrics', () => {
  let db: Database.Database;
  let seq = 0;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(`CREATE TABLE governed_stream (
      id TEXT PRIMARY KEY,
      record_type TEXT NOT NULL,
      sub_phase_id TEXT,
      produced_at TEXT NOT NULL,
      derived_from_record_ids TEXT,
      content TEXT NOT NULL
    )`);
    seq = 0;
  });

  afterEach(() => {
    db.close();
  });

  function insert(recordType: string, subPhaseId: string | null, content: unknown, derivedFrom?: string[], id?: string): string {
    seq++;
    const rid = id ?? `r${seq}`;
    db.prepare(
      `INSERT INTO governed_stream (id, record_type, sub_phase_id, produced_at, derived_from_record_ids, content)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(rid, recordType, subPhaseId, `2026-06-11T00:00:${String(seq).padStart(2, '0')}Z`,
      derivedFrom ? JSON.stringify(derivedFrom) : null, JSON.stringify(content));
    return rid;
  }

  function executorOutput(taskId: string, overrides: Record<string, unknown> = {}): void {
    insert('agent_output', 'implementation_task_execution', {
      task_id: taskId,
      status: 'success',
      duration_ms: 60_000,
      exit_code: 0,
      timed_out: false,
      idled_out: false,
      bytes_stdout: 30_000,
      ...overrides,
    });
  }

  function testResult(taskId: string, passed: number, failed: number): void {
    insert('task_test_result', '9.1', {
      kind: 'task_test_result',
      leaf_task_id: taskId,
      attempt_number: 1,
      passed_count: passed,
      failed_count: failed,
    });
  }

  it('joins executor outputs with test results per task and aggregates', () => {
    executorOutput('T-1');
    testResult('T-1', 5, 0);
    executorOutput('T-2', { duration_ms: 120_000, bytes_stdout: 60_000 });
    testResult('T-2', 2, 1);
    executorOutput('T-3', { timed_out: true, exit_code: null });
    insert('artifact_produced', 'pre_commit_consistency_check', {
      kind: 'consistency_report',
      overall_pass: false,
      tsc_error_count: 4,
      divergent_duplicate_count: 1,
      layout_violation_count: 0,
    });

    const m = collectMetrics({ db, candidate: CANDIDATE, env: env() });
    expect(m.tasks).toHaveLength(3);
    expect(m.tasks.map((t) => [t.taskId, t.outcome])).toEqual([
      ['T-1', 'pass'],
      ['T-2', 'test_fail'],
      ['T-3', 'timeout'],
    ]);
    expect(m.taskPassRate).toBeCloseTo(1 / 3);
    expect(m.timeoutCount).toBe(1);
    expect(m.meanTaskWallMs).toBeCloseTo(80_000);
    expect(m.p95TaskWallMs).toBe(120_000);
    // 30000 bytes / 60s and 60000 / 120s — both 500 chars/s.
    expect(m.meanCharsPerSec).toBeCloseTo(500);
    expect(m.tscErrorCount).toBe(4);
    expect(m.divergentDuplicateCount).toBe(1);
    expect(m.phase10OverallPass).toBe(false);
    expect(m.ollamaVersion).toBe('0.30.0');
    expect(m.vramPeakMb).toBe(18000);
  });

  it('reads the language-agnostic stabilization outcome + forcedStack from execution_summary', () => {
    executorOutput('T-1');
    testResult('T-1', 3, 0);
    // green closing act
    insert('artifact_produced', 'implementation_task_execution', {
      kind: 'execution_summary',
      tasks_attempted: 3,
      tasks_completed: 2,
      tasks_failed: 1,
      tasks_quarantined: 0,
      stabilization_gates_passed: true,
      stabilization_residual: null,
    });
    const green = collectMetrics({ db, candidate: { ...CANDIDATE, forceStack: 'python' }, env: env() });
    expect(green.forcedStack).toBe('python');
    expect(green.stabilizationGatesPassed).toBe(true);
    expect(green.stabilizationFailingGates).toEqual([]);
    // authoritative leaf rollup (the headline language-comparison signal)
    expect(green.leafTasksAttempted).toBe(3);
    expect(green.leafTasksCompleted).toBe(2);
    expect(green.leafTasksFailed).toBe(1);

    // red closing act with residual (supersedes — latest by produced_at)
    insert('artifact_produced', 'implementation_task_execution', {
      kind: 'execution_summary',
      stabilization_gates_passed: false,
      stabilization_residual: { failingGateNames: ['python:test'], repairAttempts: 2, evidence: 'x' },
    });
    const red = collectMetrics({ db, candidate: { ...CANDIDATE, forceStack: 'python' }, env: env() });
    expect(red.stabilizationGatesPassed).toBe(false);
    expect(red.stabilizationFailingGates).toEqual(['python:test']);
    expect(red.stabilizationRepairAttempts).toBe(2);
  });

  it('leaves stabilization fields null and notes the gap when no execution_summary exists', () => {
    executorOutput('T-1');
    testResult('T-1', 1, 0);
    const m = collectMetrics({ db, candidate: CANDIDATE, env: env() });
    expect(m.forcedStack).toBeNull();
    expect(m.stabilizationGatesPassed).toBeNull();
    expect(m.notes.some(n => n.includes('no execution_summary'))).toBe(true);
  });

  it('later attempts supersede earlier rows for the same task', () => {
    executorOutput('T-1', { exit_code: 1, status: 'error' });
    testResult('T-1', 0, 3);
    executorOutput('T-1', { exit_code: 0, status: 'success' }); // retry succeeded
    testResult('T-1', 3, 0);
    const m = collectMetrics({ db, candidate: CANDIDATE, env: env() });
    expect(m.tasks).toHaveLength(1);
    expect(m.tasks[0].outcome).toBe('pass');
  });

  it('binds CLI-executor outputs to tasks via the invocation→output join (no task_id on the output)', () => {
    // The goose/CLI executor: invocation carries task_id; the derived output
    // carries the timing (duration/bytes/timed_out) under sub_phase '9.1' with
    // NO task_id inside the output content. This is the real-run shape that the
    // old `implementation_task_execution` + content.task_id query missed.
    const invId = insert('agent_invocation', '9.1', { task_id: 'task-deletion-1', model: 'goose_cli', provider: 'goose_cli' });
    insert('agent_output', '9.1',
      { model: 'goose_cli', status: 'success', duration_ms: 245_000, bytes_stdout: 190_000, exit_code: 0, timed_out: false },
      [invId]);
    // A timed-out scaffolding task (also CLI-executor, also no content.task_id).
    const invId2 = insert('agent_invocation', '9.1', { task_id: 'task-scaffold-1', model: 'goose_cli', provider: 'goose_cli' });
    insert('agent_output', '9.1',
      { model: 'goose_cli', status: 'error', duration_ms: 1_800_000, bytes_stdout: 500_000, exit_code: 0, timed_out: true },
      [invId2]);
    // A session-responder direct call (gpt-oss, no task_id, no derived task) — must be ignored.
    insert('agent_output', '9.1', { model: 'gpt-oss:20b', status: 'success', duration_ms: 20_000 });
    testResult('task-deletion-1', 4, 0);

    const m = collectMetrics({ db, candidate: CANDIDATE, env: env() });
    const byId = new Map(m.tasks.map((t) => [t.taskId, t]));
    expect(byId.get('task-deletion-1')?.outcome).toBe('pass');
    expect(byId.get('task-deletion-1')?.durationMs).toBe(245_000);
    expect(byId.get('task-scaffold-1')?.outcome).toBe('timeout'); // timed_out wins
    expect(m.timeoutCount).toBe(1);
    // The anonymous session-responder output created no phantom task.
    expect(m.tasks).toHaveLength(2);
    expect(m.meanCharsPerSec).not.toBeNull(); // bytes_stdout/duration now measurable
  });

  it('classes every task context_overflow when the pre-check failed', () => {
    executorOutput('T-1');
    testResult('T-1', 5, 0);
    const m = collectMetrics({
      db,
      candidate: CANDIDATE,
      env: env({ contextFit: { verdict: 'cpu_offload', numCtx: 262144, size: 1000, sizeVram: 500 } }),
    });
    expect(m.tasks[0].outcome).toBe('context_overflow');
    expect(m.taskPassRate).toBe(0);
  });

  it('notes a missing Phase-10 report and excludes task-less runs gracefully', () => {
    const m = collectMetrics({ db, candidate: CANDIDATE, env: env() });
    expect(m.tasks).toEqual([]);
    expect(m.taskPassRate).toBeNull();
    expect(m.meanTaskWallMs).toBeNull();
    expect(m.tscErrorCount).toBeNull();
    expect(m.notes.some((n) => n.includes('consistency_report'))).toBe(true);
  });

  it('silently excludes anonymous phase-9 outputs (e.g. session-responder) from per-task metrics', () => {
    // A phase-9 agent_output with neither a task_id nor a derived-from invocation
    // (the session responder / DMR direct calls) must NOT become a phantom task.
    insert('agent_output', '9.1', { model: 'gpt-oss:20b', status: 'success', duration_ms: 1000 });
    executorOutput('T-1');
    testResult('T-1', 1, 0);
    const m = collectMetrics({ db, candidate: CANDIDATE, env: env() });
    expect(m.tasks).toHaveLength(1);
    expect(m.tasks[0].taskId).toBe('T-1');
  });
});
