/**
 * Regression tests for Phase 9.2's test-suite extractor.
 *
 * Background — TestRunner ran zero suites:
 *   Phase 7 emits the test plan as
 *     { kind: 'test_plan',
 *       test_suites: [ { suite_id, component_id, test_type,
 *                       test_cases: [ { test_case_id, type,
 *                                       acceptance_criterion_ids,
 *                                       preconditions, expected_outcome } ] } ] }
 *   The extractor read `plan.test_cases` (a flat path that doesn't
 *   exist in that shape) and found zero. cal-22b reported
 *   `suite_results: []` no matter what the executor wrote.
 *
 * The fix walks `test_suites[].test_cases[]` and inherits the
 * suite's `test_type` onto each case so grouping works. These tests
 * pin both the production shape and the legacy flat shape.
 */

import { describe, it, expect } from 'vitest';
import { Phase9Handler } from '../../../../lib/orchestrator/phases/phase9';
import type { TestSuite } from '../../../../lib/orchestrator/testRunner';

let counter = 0;
const generateId = () => `t-${++counter}`;

function extract(plan: object): TestSuite[] {
  const handler = new Phase9Handler();
  return (handler as unknown as {
    extractTestSuites: (raw: string, gen: () => string) => TestSuite[];
  }).extractTestSuites(JSON.stringify(plan), generateId);
}

describe('Phase9Handler.extractTestSuites', () => {
  it('walks the production nested shape (test_suites[].test_cases[])', () => {
    // Exact shape Phase 7's prompt template emits.
    const out = extract({
      kind: 'test_plan',
      test_suites: [
        {
          suite_id: 'SUITE-WOL-001',
          component_id: 'comp-work-order-lifecycle',
          test_type: 'integration',
          test_cases: [
            { test_case_id: 'TC-WOL-1', type: 'functional', acceptance_criterion_ids: ['US-001-A'] },
            { test_case_id: 'TC-WOL-2', type: 'functional', acceptance_criterion_ids: ['US-001-B'] },
          ],
        },
        {
          suite_id: 'SUITE-WOL-002',
          component_id: 'comp-work-order-lifecycle',
          test_type: 'unit',
          test_cases: [
            { test_case_id: 'TC-UNIT-1', acceptance_criterion_ids: ['US-002'] },
          ],
        },
      ],
    });
    // Test cases inherit the suite's test_type, then group by type.
    expect(out).toHaveLength(2);
    const integration = out.find(s => s.type === 'integration');
    const unit = out.find(s => s.type === 'unit');
    expect(integration).toBeDefined();
    expect(unit).toBeDefined();
    expect(integration?.coversCriteriaIds).toEqual(['US-001-A', 'US-001-B']);
    expect(unit?.coversCriteriaIds).toEqual(['US-002']);
  });

  it('falls back to the legacy flat test_cases shape', () => {
    // Backward compat: fixtures that pre-date Phase 7's nested shape
    // continue to work after the dispatcher lands.
    const out = extract({
      test_cases: [
        { suite_type: 'unit', acceptance_criterion_id: 'US-X-1' },
        { suite_type: 'unit', acceptance_criterion_id: 'US-X-2' },
        { suite_type: 'e2e', acceptance_criterion_id: 'US-Y-1' },
      ],
    });
    expect(out).toHaveLength(2);
    const unit = out.find(s => s.type === 'unit');
    const e2e = out.find(s => s.type === 'end_to_end'); // 'e2e' normalized
    expect(unit?.coversCriteriaIds).toEqual(['US-X-1', 'US-X-2']);
    expect(e2e?.coversCriteriaIds).toEqual(['US-Y-1']);
  });

  it('normalizes test_type variants (e2e / endToEnd / end_to_end) onto end_to_end', () => {
    const a = extract({
      test_suites: [{ test_type: 'e2e', test_cases: [{ test_case_id: 'A' }] }],
    });
    const b = extract({
      test_suites: [{ test_type: 'endToEnd', test_cases: [{ test_case_id: 'B' }] }],
    });
    const c = extract({
      test_suites: [{ test_type: 'end_to_end', test_cases: [{ test_case_id: 'C' }] }],
    });
    expect(a[0].type).toBe('end_to_end');
    expect(b[0].type).toBe('end_to_end');
    expect(c[0].type).toBe('end_to_end');
  });

  it('handles acceptance_criterion_ids array shape', () => {
    // Phase 7 emits this as an array. Old fixtures used singular
    // acceptance_criterion_id.
    const out = extract({
      test_suites: [{
        test_type: 'integration',
        test_cases: [
          { test_case_id: 'TC-1', acceptance_criterion_ids: ['US-A', 'US-B', 'US-C'] },
        ],
      }],
    });
    expect(out[0].coversCriteriaIds).toEqual(['US-A', 'US-B', 'US-C']);
  });

  it('returns [] for unparseable JSON', () => {
    const handler = new Phase9Handler();
    const out = (handler as unknown as {
      extractTestSuites: (raw: string, gen: () => string) => TestSuite[];
    }).extractTestSuites('{not json', generateId);
    expect(out).toEqual([]);
  });

  it('returns [] for empty test_suites array', () => {
    expect(extract({ kind: 'test_plan', test_suites: [] })).toEqual([]);
  });
});
