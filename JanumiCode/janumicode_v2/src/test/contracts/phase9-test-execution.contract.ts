/**
 * Contract for Phase 9.2 — test_execution (artifact kind: `test_results`).
 *
 * Test runner emits one test_results per task (or per suite). Reports
 * pass/fail counts that the evaluation phase reads.
 */

import type { ContractSuite } from './types';

// ── Producer artifact shape ─────────────────────────────────────

export interface TestCaseResult {
  test_case_id: string;
  status: 'passed' | 'failed' | 'skipped' | 'error';
  duration_ms?: number;
  message?: string;
}

export interface TestResultsArtifact {
  kind: 'test_results';
  task_id?: string;
  suite_id?: string;
  passed: number;
  failed: number;
  skipped?: number;
  total?: number;
  cases?: TestCaseResult[];
}

// ── Contract suite ───────────────────────────────────────────────

const VALID_STATUSES = new Set<string>(['passed', 'failed', 'skipped', 'error']);

export const phase9TestExecutionContract: ContractSuite<TestResultsArtifact> = {
  boundaryId: '9.2_test_execution',
  phaseId: '9',
  subPhaseId: 'test_execution',
  producerArtifactKind: 'test_results',
  description:
    'Phase 9 test execution — non-negative pass/fail counts; total reconciles; case statuses are valid.',
  clauses: [
    {
      id: 'C-9.2.1',
      description: 'test_results carries task_id or suite_id.',
      severity: 'blocking',
      check: (artifact) => {
        if (!artifact.task_id && !artifact.suite_id) {
          return { message: 'neither task_id nor suite_id is set' };
        }
        return true;
      },
    },
    {
      id: 'C-9.2.2',
      description: 'passed and failed counts are non-negative integers.',
      severity: 'blocking',
      check: (artifact) => {
        const bad: string[] = [];
        if (typeof artifact.passed !== 'number' || artifact.passed < 0 || !Number.isInteger(artifact.passed)) {
          bad.push(`passed=${artifact.passed}`);
        }
        if (typeof artifact.failed !== 'number' || artifact.failed < 0 || !Number.isInteger(artifact.failed)) {
          bad.push(`failed=${artifact.failed}`);
        }
        if (bad.length === 0) return true;
        return { message: `invalid counts: ${bad.join(', ')}` };
      },
    },
    {
      id: 'C-9.2.3',
      description: 'When total is set, it equals passed + failed + skipped.',
      severity: 'blocking',
      check: (artifact) => {
        if (artifact.total === undefined) return true;
        const expected = artifact.passed + artifact.failed + (artifact.skipped ?? 0);
        if (artifact.total !== expected) {
          return { message: `total (${artifact.total}) != passed+failed+skipped (${expected})` };
        }
        return true;
      },
    },
    {
      id: 'C-9.2.4',
      description: 'Every case has a valid status.',
      severity: 'blocking',
      check: (artifact) => {
        const bad: Array<{ id: string; status: string }> = [];
        for (const c of artifact.cases ?? []) {
          if (!VALID_STATUSES.has(c.status)) bad.push({ id: c.test_case_id, status: c.status });
        }
        if (bad.length === 0) return true;
        return { message: `${bad.length} case(s) have invalid status`, details: { bad: bad.slice(0, 10) } };
      },
    },
    {
      id: 'C-9.2.5',
      description: 'When cases[] is populated, count of cases matches total (sanity).',
      severity: 'advisory',
      check: (artifact) => {
        const cs = artifact.cases ?? [];
        if (cs.length === 0) return true;
        if (artifact.total !== undefined && cs.length !== artifact.total) {
          return { message: `cases length (${cs.length}) != total (${artifact.total})` };
        }
        return true;
      },
    },
  ],
};
