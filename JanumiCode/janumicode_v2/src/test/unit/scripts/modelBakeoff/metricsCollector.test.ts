import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  classifyOutcome,
  collectMetrics,
  type RunEnvironment,
} from '../../../../../scripts/model-bakeoff/metricsCollector';
import type { CandidateSpec } from '../../../../../scripts/model-bakeoff/bakeoffConfig';

const CANDIDATE: CandidateSpec = { slug: 'c1', modelTag: 'gemma4:12b-it-qat', server: {} };

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
      content TEXT NOT NULL
    )`);
    seq = 0;
  });

  afterEach(() => {
    db.close();
  });

  function insert(recordType: string, subPhaseId: string | null, content: unknown): void {
    seq++;
    db.prepare(
      `INSERT INTO governed_stream (id, record_type, sub_phase_id, produced_at, content)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(`r${seq}`, recordType, subPhaseId, `2026-06-11T00:00:${String(seq).padStart(2, '0')}Z`, JSON.stringify(content));
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

  it('later attempts supersede earlier rows for the same task', () => {
    executorOutput('T-1', { exit_code: 1, status: 'error' });
    testResult('T-1', 0, 3);
    executorOutput('T-1', { exit_code: 0, status: 'success' }); // retry succeeded
    testResult('T-1', 3, 0);
    const m = collectMetrics({ db, candidate: CANDIDATE, env: env() });
    expect(m.tasks).toHaveLength(1);
    expect(m.tasks[0].outcome).toBe('pass');
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

  it('excludes executor rows without task_id from per-task metrics, with a note', () => {
    insert('agent_output', 'implementation_task_execution', { status: 'success', duration_ms: 1000 });
    executorOutput('T-1');
    testResult('T-1', 1, 0);
    const m = collectMetrics({ db, candidate: CANDIDATE, env: env() });
    expect(m.tasks).toHaveLength(1);
    expect(m.notes.some((n) => n.includes('no task_id'))).toBe(true);
  });
});
