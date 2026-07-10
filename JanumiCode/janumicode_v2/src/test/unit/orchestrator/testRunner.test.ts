/**
 * Characterization tests for TestRunner.parseVitestOutput (Phase 9.2).
 *
 * Pins the CURRENT observable behavior of the (private) output parser
 * across its two branches:
 *   - Structured Vitest/Jest JSON (`testResults[].assertionResults[]`),
 *     including status mapping (passed/failed/skipped, todo/pending →
 *     skipped, unknown → failed), name fallback (fullName ?? title),
 *     duration defaulting, and error/stack derived from failureMessages.
 *   - The text fallback for vitest / node:test summary shapes, including
 *     the invariant that synthetic test cases are created for passed and
 *     failed counts only (skipped is counted but NOT synthesized), and
 *     the all-zeros no-match result.
 *
 * Added while decomposing parseVitestOutput to reduce cognitive
 * complexity; assertions are derived from the pre-refactor logic so they
 * guard behavior across the refactor.
 */
import { describe, it, expect } from 'vitest';
import { TestRunner, type TestCaseResult } from '../../../lib/orchestrator/testRunner';
import type { Database } from '../../../lib/database/init';
import type { GovernedStreamWriter } from '../../../lib/orchestrator/governedStreamWriter';
import type { EventBus } from '../../../lib/events/eventBus';

type ParsedOutput = {
  passed: number;
  failed: number;
  skipped: number;
  testCases: TestCaseResult[];
};

/** Fresh runner with a deterministic id generator (id-1, id-2, ...). */
const makeRunner = (): TestRunner => {
  let n = 0;
  return new TestRunner(
    {} as unknown as Database,
    { writeRecord: () => {} } as unknown as GovernedStreamWriter,
    { emit: () => {} } as unknown as EventBus,
    () => `id-${++n}`,
  );
};

const parse = (runner: TestRunner, output: string, suiteId: string): ParsedOutput =>
  (runner as unknown as {
    parseVitestOutput: (o: string, s: string) => ParsedOutput;
  }).parseVitestOutput(output, suiteId);

describe('TestRunner.parseVitestOutput — structured JSON branch', () => {
  it('parses mixed passed/failed/skipped assertions with correct shapes', () => {
    const output = JSON.stringify({
      testResults: [
        {
          assertionResults: [
            { status: 'passed', fullName: 'a passes', duration: 5 },
            { status: 'failed', title: 'b fails', failureMessages: ['boom', 'trace'] },
            { status: 'skipped', fullName: 'c skipped' },
          ],
        },
      ],
    });
    const result = parse(makeRunner(), output, 'suite-1');

    expect(result.passed).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.testCases).toEqual([
      { id: 'id-1', suiteId: 'suite-1', name: 'a passes', status: 'passed', durationMs: 5, error: undefined, stack: undefined },
      { id: 'id-2', suiteId: 'suite-1', name: 'b fails', status: 'failed', durationMs: 0, error: 'boom\ntrace', stack: 'boom\ntrace' },
      { id: 'id-3', suiteId: 'suite-1', name: 'c skipped', status: 'skipped', durationMs: 0, error: undefined, stack: undefined },
    ]);
  });

  it('extracts the JSON blob even when embedded in surrounding reporter text', () => {
    const inner = JSON.stringify({
      testResults: [{ assertionResults: [{ status: 'passed', fullName: 't', duration: 0 }] }],
    });
    const output = `RUN v1.0\n${inner}\n\ntrailing default reporter noise`;
    const result = parse(makeRunner(), output, 'suite-5');

    expect(result).toMatchObject({ passed: 1, failed: 0, skipped: 0 });
    expect(result.testCases).toHaveLength(1);
    expect(result.testCases[0]).toMatchObject({ name: 't', status: 'passed', durationMs: 0 });
  });

  it('maps todo/pending to skipped and unknown status to failed', () => {
    const output = JSON.stringify({
      testResults: [
        {
          assertionResults: [
            { status: 'todo', fullName: 't1' },
            { status: 'pending', fullName: 't2' },
            { status: 'bogus', fullName: 't3' },
          ],
        },
      ],
    });
    const result = parse(makeRunner(), output, 'suite-4');

    expect(result).toMatchObject({ passed: 0, failed: 1, skipped: 2 });
    expect(result.testCases).toHaveLength(3);
    const failedCase = result.testCases.find((tc) => tc.status === 'failed');
    expect(failedCase?.name).toBe('t3');
    // Unknown-status → failed, but with no failureMessages error/stack stay undefined.
    expect(failedCase?.error).toBeUndefined();
    expect(failedCase?.stack).toBeUndefined();
  });
});

describe('TestRunner.parseVitestOutput — text fallback branch', () => {
  it('parses a vitest-style summary and synthesizes passed+failed cases only', () => {
    const result = parse(makeRunner(), 'Tests  3 passed | 1 failed | 2 skipped', 'suite-2');

    expect(result).toMatchObject({ passed: 3, failed: 1, skipped: 2 });
    // Synthetic cases are created for passed + failed only (not skipped).
    expect(result.testCases).toHaveLength(4);
    expect(result.testCases.filter((tc) => tc.status === 'passed')).toHaveLength(3);
    expect(result.testCases.filter((tc) => tc.status === 'failed')).toHaveLength(1);
    expect(result.testCases.some((tc) => tc.status === 'skipped')).toBe(false);

    expect(result.testCases[0]).toMatchObject({
      id: 'id-1',
      suiteId: 'suite-2',
      name: 'Test 1',
      status: 'passed',
      durationMs: 0,
    });
    const failedCase = result.testCases.find((tc) => tc.status === 'failed');
    expect(failedCase).toMatchObject({
      name: 'Failed Test 1',
      status: 'failed',
      durationMs: 0,
      error: 'Test failed (details in Vitest output)',
    });
  });

  it('parses node:test style "pass/fail/skipped N" counters', () => {
    const output = ['ℹ pass 5', 'ℹ fail 2', 'ℹ skipped 1'].join('\n');
    const result = parse(makeRunner(), output, 'suite-6');

    expect(result).toMatchObject({ passed: 5, failed: 2, skipped: 1 });
    // 5 passed + 2 failed synthesized; skipped not synthesized.
    expect(result.testCases).toHaveLength(7);
  });

  it('returns all-zeros with no test cases when nothing matches', () => {
    const result = parse(makeRunner(), 'no recognizable test output here', 'suite-3');
    expect(result).toEqual({ passed: 0, failed: 0, skipped: 0, testCases: [] });
  });
});
