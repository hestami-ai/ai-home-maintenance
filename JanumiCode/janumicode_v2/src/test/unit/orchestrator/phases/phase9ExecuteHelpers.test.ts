/**
 * Characterization tests for the pure helpers extracted from
 * Phase9Handler.execute() during the S3776 cognitive-complexity refactor
 * (execute went from complexity 45 → decomposed helpers).
 *
 * These pin the ORIGINAL inline behaviour so the extraction stays
 * behaviour-preserving:
 *   - indexPacketsByTaskId: last packet wins on duplicate task id.
 *   - buildSchedulerLeaves: `_leaf_*` release fields win over legacy, then
 *     null — via `??` so an ordinal of 0 is PRESERVED (not treated as absent).
 *   - computeBakeoffLeafCap: cap only when env parses to a finite positive int
 *     AND the current set is strictly larger.
 *   - buildSchedulerOptions: exact defaults + `??` false-preservation.
 *   - buildTestSuitesFromLeaves: name/type/path-filter/criteria projection.
 *   - computeExecutionGateSeverity: the high-severity OR set, and the
 *     deliberate exclusion of quarantine count from high severity.
 */

import { describe, it, expect } from 'vitest';
import {
  indexPacketsByTaskId,
  buildSchedulerLeaves,
  computeBakeoffLeafCap,
  buildSchedulerOptions,
  buildTestSuitesFromLeaves,
  computeExecutionGateSeverity,
} from '../../../../lib/orchestrator/phases/phase9';

type SchedulerOptsCfg = Parameters<typeof buildSchedulerOptions>[0];
type LeafSuites = Parameters<typeof buildTestSuitesFromLeaves>[0];

describe('indexPacketsByTaskId', () => {
  it('indexes packets by task id', () => {
    const packets = [
      { task: { id: 't1' }, marker: 'a' },
      { task: { id: 't2' }, marker: 'b' },
    ] as unknown as Parameters<typeof indexPacketsByTaskId>[0];
    const m = indexPacketsByTaskId(packets);
    expect(m.size).toBe(2);
    expect((m.get('t1') as { marker: string }).marker).toBe('a');
    expect((m.get('t2') as { marker: string }).marker).toBe('b');
  });

  it('last packet wins on duplicate task id', () => {
    const packets = [
      { task: { id: 't1' }, marker: 'first' },
      { task: { id: 't1' }, marker: 'second' },
    ] as unknown as Parameters<typeof indexPacketsByTaskId>[0];
    const m = indexPacketsByTaskId(packets);
    expect(m.size).toBe(1);
    expect((m.get('t1') as { marker: string }).marker).toBe('second');
  });

  it('returns an empty map for no packets', () => {
    expect(indexPacketsByTaskId([]).size).toBe(0);
  });
});

describe('buildSchedulerLeaves', () => {
  const build = (t: Record<string, unknown>) =>
    buildSchedulerLeaves([t] as unknown as Parameters<typeof buildSchedulerLeaves>[0])[0];

  it('prefers _leaf_release_* over legacy fields', () => {
    const leaf = build({ id: 'x', _leaf_release_id: 'R-leaf', release_id: 'R-legacy', _leaf_release_ordinal: 1, release_ordinal: 9 });
    expect(leaf.release_id).toBe('R-leaf');
    expect(leaf.release_ordinal).toBe(1);
  });

  it('falls back to legacy fields when leaf fields absent', () => {
    const leaf = build({ id: 'x', release_id: 'R-legacy', release_ordinal: 7 });
    expect(leaf.release_id).toBe('R-legacy');
    expect(leaf.release_ordinal).toBe(7);
  });

  it('falls back to null when neither is present', () => {
    const leaf = build({ id: 'x' });
    expect(leaf.release_id).toBeNull();
    expect(leaf.release_ordinal).toBeNull();
  });

  it('preserves an ordinal of 0 (nullish, not falsy)', () => {
    const leaf = build({ id: 'x', _leaf_release_ordinal: 0, release_ordinal: 5 });
    expect(leaf.release_ordinal).toBe(0);
  });

  it('surfaces _leaf_node_id and spreads other task fields', () => {
    const leaf = build({ id: 'x', _leaf_node_id: 'node-1', component_id: 'comp-a' }) as unknown as Record<string, unknown>;
    expect(leaf._leaf_node_id).toBe('node-1');
    expect(leaf.id).toBe('x');
    expect(leaf.component_id).toBe('comp-a');
  });
});

describe('computeBakeoffLeafCap', () => {
  it('caps when env is a finite positive int and set is larger', () => {
    expect(computeBakeoffLeafCap('3', 5)).toBe(3);
    expect(computeBakeoffLeafCap('2', 10)).toBe(2);
  });

  it('does not cap when set is not strictly larger than the cap', () => {
    expect(computeBakeoffLeafCap('3', 3)).toBeNull();
    expect(computeBakeoffLeafCap('3', 2)).toBeNull();
  });

  it('returns null for unset / non-numeric / non-positive env', () => {
    expect(computeBakeoffLeafCap(undefined, 5)).toBeNull();
    expect(computeBakeoffLeafCap('', 5)).toBeNull();
    expect(computeBakeoffLeafCap('abc', 5)).toBeNull();
    expect(computeBakeoffLeafCap('0', 5)).toBeNull();
    expect(computeBakeoffLeafCap('-2', 5)).toBeNull();
  });
});

describe('buildSchedulerOptions', () => {
  it('applies the original defaults when config is empty', () => {
    const opts = buildSchedulerOptions({} as unknown as SchedulerOptsCfg, false);
    expect(opts.leafRetryBudget).toBe(2);
    expect(opts.deferredRetryBudget).toBe(2);
    expect(opts.autoApproveWaveGates).toBe(false);
    expect(opts.testsPerLeaf.enabled).toBe(true);
    expect(opts.testsPerLeaf.resolution).toBe('package_json_scripts');
    expect(opts.testsPerLeaf.timeoutMs).toBe(120_000);
    expect(opts.stabilizationBudget).toBe(2);
    expect(opts.attended).toBe(true);
  });

  it('attended is the inverse of unattendedSkipPermissions', () => {
    expect(buildSchedulerOptions({} as unknown as SchedulerOptsCfg, true).attended).toBe(false);
  });

  it('reads configured values and preserves explicit false (?? semantics)', () => {
    const cfg = {
      execution: {
        leaf_retry_budget: 5,
        deferred_retry_budget: 7,
        auto_approve_wave_gates: true,
        stabilization_budget: 4,
        tests_per_leaf: {
          enabled: false,
          test_command_resolution: 'custom',
          timeout_ms: 999,
        },
      },
    } as unknown as SchedulerOptsCfg;
    const opts = buildSchedulerOptions(cfg, false);
    expect(opts.leafRetryBudget).toBe(5);
    expect(opts.deferredRetryBudget).toBe(7);
    expect(opts.autoApproveWaveGates).toBe(true);
    expect(opts.stabilizationBudget).toBe(4);
    expect(opts.testsPerLeaf.enabled).toBe(false); // explicit false preserved
    expect(opts.testsPerLeaf.resolution).toBe('custom');
    expect(opts.testsPerLeaf.timeoutMs).toBe(999);
  });
});

describe('buildTestSuitesFromLeaves', () => {
  it('projects name/type/paths/criteria and drops empty file paths', () => {
    const suites = [
      {
        suite_id: 'SUITE-1',
        component_id: 'comp-a',
        test_type: 'unit',
        test_cases: [
          { test_file_path: 'a.test.ts', acceptance_criterion_ids: ['AC1'] },
          { test_file_path: '', acceptance_criterion_ids: ['AC2'] },
          { acceptance_criterion_ids: ['AC3'] },
        ],
      },
    ] as unknown as LeafSuites;
    const [suite] = buildTestSuitesFromLeaves(suites);
    expect(suite.id).toBe('SUITE-1');
    expect(suite.name).toBe('Unit Tests (comp-a)');
    expect(suite.type).toBe('unit');
    expect(suite.testFilePaths).toEqual(['a.test.ts']);
    expect(suite.coversCriteriaIds).toEqual(['AC1', 'AC2', 'AC3']);
    expect(suite.validatesTaskIds).toEqual([]);
  });

  it('returns [] for no suites', () => {
    expect(buildTestSuitesFromLeaves([] as unknown as LeafSuites)).toEqual([]);
  });
});

describe('computeExecutionGateSeverity', () => {
  const clean = {
    schedule: { terminallyDeferredLeafCount: 0, rejectedWaveCount: 0, stabilizationResidual: null, quarantinedLeafCount: 0 },
    tests: { totalFailed: 0, totalSkipped: 0 },
    evals: { overallPass: true },
  };

  it('is all-clean when nothing is unresolved', () => {
    const r = computeExecutionGateSeverity(clean.schedule, clean.tests, clean.evals);
    expect(r.hasHighSeverityFlaws).toBe(false);
    expect(r.hasUnresolvedWarnings).toBe(false);
  });

  it('flags high severity for each of the five triggers', () => {
    expect(computeExecutionGateSeverity({ ...clean.schedule, terminallyDeferredLeafCount: 1 }, clean.tests, clean.evals).hasHighSeverityFlaws).toBe(true);
    expect(computeExecutionGateSeverity({ ...clean.schedule, rejectedWaveCount: 1 }, clean.tests, clean.evals).hasHighSeverityFlaws).toBe(true);
    expect(computeExecutionGateSeverity({ ...clean.schedule, stabilizationResidual: { failingGateNames: ['x'] } }, clean.tests, clean.evals).hasHighSeverityFlaws).toBe(true);
    expect(computeExecutionGateSeverity(clean.schedule, { totalFailed: 1, totalSkipped: 0 }, clean.evals).hasHighSeverityFlaws).toBe(true);
    expect(computeExecutionGateSeverity(clean.schedule, clean.tests, { overallPass: false }).hasHighSeverityFlaws).toBe(true);
  });

  it('does NOT flag high severity for a (possibly-rescued) quarantine — only a warning', () => {
    const r = computeExecutionGateSeverity({ ...clean.schedule, quarantinedLeafCount: 5 }, clean.tests, clean.evals);
    expect(r.hasHighSeverityFlaws).toBe(false);
    expect(r.hasUnresolvedWarnings).toBe(true);
  });

  it('flags a warning for skipped tests', () => {
    const r = computeExecutionGateSeverity(clean.schedule, { totalFailed: 0, totalSkipped: 3 }, clean.evals);
    expect(r.hasHighSeverityFlaws).toBe(false);
    expect(r.hasUnresolvedWarnings).toBe(true);
  });

  it('treats a null stabilization residual as not-high', () => {
    const r = computeExecutionGateSeverity({ ...clean.schedule, stabilizationResidual: null }, clean.tests, clean.evals);
    expect(r.hasHighSeverityFlaws).toBe(false);
  });
});
