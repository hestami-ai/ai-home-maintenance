import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  buildCrossConfigReport,
  writeConfigResult,
  writeCrossConfigReport,
} from '../../../../../scripts/model-bakeoff/reportGenerator';
import type { ConfigMetrics } from '../../../../../scripts/model-bakeoff/metricsCollector';
import type { CandidateSpec } from '../../../../../scripts/model-bakeoff/bakeoffConfig';

const CANDIDATES: CandidateSpec[] = [
  {
    slug: 'gemma4-12b-fa',
    modelTag: 'gemma4:12b-it-qat',
    server: { flashAttention: true, kvCacheType: 'q8_0', contextLength: 65536 },
    goose: { contextLimit: 65536 },
    notes: 'smoke variant',
  },
  { slug: 'gptoss-20b', modelTag: 'gpt-oss:20b', server: {} },
];

function metrics(overrides: Partial<ConfigMetrics> = {}): ConfigMetrics {
  return {
    configSlug: 'gemma4-12b-fa',
    modelTag: 'gemma4:12b-it-qat',
    ollamaVersion: '0.30.0',
    effectiveNumCtx: 65536,
    contextFit: 'ok',
    vramAfterLoadMb: 16000,
    vramPeakMb: 18000,
    vramTotalMb: 24576,
    tasks: [
      {
        taskId: 'T-1',
        outcome: 'pass',
        durationMs: 90_000,
        bytesStdout: 30_000,
        exitCode: 0,
        timedOut: false,
        idledOut: false,
        retryAttempts: 0,
        testPassedCount: 5,
        testFailedCount: 0,
        errorMessage: null,
      },
      {
        taskId: 'T-2',
        outcome: 'goose_error',
        durationMs: 30_000,
        bytesStdout: 100,
        exitCode: 1,
        timedOut: false,
        idledOut: false,
        retryAttempts: 2,
        testPassedCount: null,
        testFailedCount: null,
        errorMessage: 'goose exploded | with a pipe',
      },
    ],
    taskPassRate: 0.5,
    meanTaskWallMs: 60_000,
    p95TaskWallMs: 90_000,
    meanCharsPerSec: 168,
    totalRetries: 2,
    timeoutCount: 0,
    stallCount: 0,
    tscErrorCount: 2,
    divergentDuplicateCount: 0,
    layoutViolationCount: 0,
    phase10OverallPass: false,
    forcedStack: 'node',
    stabilizationGatesPassed: false,
    stabilizationFailingGates: ['node:tsc'],
    stabilizationRepairAttempts: 1,
    leafTasksAttempted: 4,
    leafTasksCompleted: 2,
    leafTasksFailed: 0,
    leafTasksQuarantined: 0,
    cliExitCode: 0,
    servedModel: 'gemma4:12b-it-qat',
    servedHost: 'http://127.0.0.1:11434',
    servedModelMatches: true,
    notes: ['something noteworthy'],
    ...overrides,
  };
}

describe('buildCrossConfigReport', () => {
  it('renders the summary row with server + goose dimensions', () => {
    const report = buildCrossConfigReport({
      sweepId: 'tier1-test',
      generatedAt: '2026-06-11T00:00:00Z',
      referenceWorkspace: '/ref/ws',
      candidates: CANDIDATES,
      results: [metrics()],
    });
    expect(report).toContain('# Phase-9 Executor Model Bakeoff — tier1-test');
    expect(report).toContain('Configs completed: 1/2');
    const summaryRow = report.split('\n').find((l) => l.startsWith('| gemma4-12b-fa |'));
    expect(summaryRow).toBeDefined();
    expect(summaryRow).toContain('| 65536 |'); // num_ctx + goose ctx
    expect(summaryRow).toContain('| on |'); // flash attention
    expect(summaryRow).toContain('| q8_0 |');
    expect(summaryRow).toContain('| 0.30.0 |');
    expect(summaryRow).toContain('| 50% |');
    expect(summaryRow).toContain('| ok |');
    // Caveat columns: served-model verified, leaf completion, stabilization.
    expect(summaryRow).toContain('| ✓ |');            // servedModelMatches === true
    expect(summaryRow).toContain('| 2/4 |');          // leaves completed/attempted
    expect(summaryRow).toContain('| FAIL:node:tsc |'); // stabilization failing gate
  });

  it('flags a served-model mismatch up front and in the row', () => {
    const report = buildCrossConfigReport({
      sweepId: 's', generatedAt: 'now', referenceWorkspace: '/ref',
      candidates: CANDIDATES,
      results: [metrics({ servedModel: 'gpt-oss:20b', servedModelMatches: false })],
    });
    expect(report).toContain('SERVED-MODEL MISMATCH');
    expect(report).toContain("ran 'gpt-oss:20b'");
    const row = report.split('\n').find((l) => l.startsWith('| gemma4-12b-fa |'));
    expect(row).toContain('✗ gpt-oss:20b');
  });

  it('renders per-task rows, escaping pipes in error messages', () => {
    const report = buildCrossConfigReport({
      sweepId: 's',
      generatedAt: 'now',
      referenceWorkspace: '/ref',
      candidates: CANDIDATES,
      results: [metrics()],
    });
    expect(report).toContain('| T-1 | pass |');
    expect(report).toContain('| T-2 | goose_error |');
    expect(report).toContain('goose exploded \\| with a pipe');
    expect(report).toContain('NOTE: something noteworthy');
    expect(report).toContain('> smoke variant');
  });

  it('handles a config with no tasks', () => {
    const report = buildCrossConfigReport({
      sweepId: 's',
      generatedAt: 'now',
      referenceWorkspace: '/ref',
      candidates: CANDIDATES,
      results: [metrics({ tasks: [], taskPassRate: null, meanTaskWallMs: null, p95TaskWallMs: null, meanCharsPerSec: null })],
    });
    expect(report).toContain('_No executor tasks recorded._');
    expect(report).toContain('| — |'); // null pass rate renders as em dash
  });
});

describe('file writers', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'bakeoff-report-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('writeConfigResult writes results/<slug>.result.json', () => {
    const path = writeConfigResult(dir, metrics());
    expect(path).toBe(join(dir, 'results', 'gemma4-12b-fa.result.json'));
    const parsed = JSON.parse(readFileSync(path, 'utf-8')) as ConfigMetrics;
    expect(parsed.configSlug).toBe('gemma4-12b-fa');
    expect(parsed.tasks).toHaveLength(2);
  });

  it('writeCrossConfigReport writes bakeoff-report.md', () => {
    const path = writeCrossConfigReport(dir, '# hello');
    expect(readFileSync(path, 'utf-8')).toBe('# hello');
  });
});
