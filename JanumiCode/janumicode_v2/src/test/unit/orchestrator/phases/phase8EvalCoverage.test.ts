/**
 * Phase 8 eval-target canonicalization + coverage report (normalize-only).
 * The eval-gen LLM emits a mix of root + scattered-leaf `functional_requirement_id`s;
 * canonicalization collapses them to the decomposition-tree root (structural, no
 * regex) so each story with any eval is covered at root, and the coverage report
 * surfaces genuinely un-evaluated US/NFR as honest gaps (no fabricated backfill).
 */
import { describe, it, expect } from 'vitest';
import { canonicalizeFunctionalEvalTargets, computeEvalCoverage } from '../../../../lib/orchestrator/phases/phase8';

// Structural canonicalizer stub — a Map standing in for lineage.canonicalize
// (the real decomposition-tree walk). No regex.
const canon = (map: Record<string, string>) => (id: string): string => map[id] ?? id;

describe('canonicalizeFunctionalEvalTargets', () => {
  it('reduces scattered leaf targets to their root and dedupes by (root, method)', () => {
    const tree = canon({ 'US-007-1-1': 'US-007', 'US-007-2-1-D': 'US-007', 'US-001-1': 'US-001' });
    const out = canonicalizeFunctionalEvalTargets([
      { functional_requirement_id: 'US-007-1-1', evaluation_method: 'API test', success_condition: 'ok' },
      { functional_requirement_id: 'US-007-2-1-D', evaluation_method: 'API test', success_condition: 'ok2' }, // dup (US-007/API test)
      { functional_requirement_id: 'US-001-1', evaluation_method: 'Manual', success_condition: 'ok3' },
      { functional_requirement_id: 'US-003', evaluation_method: 'Manual', success_condition: 'ok4' }, // already root
    ], tree);
    expect(out.map((c) => c.functional_requirement_id)).toEqual(['US-007', 'US-001', 'US-003']);
  });

  it('leaves unresolvable / hallucinated ids unchanged (honest, may fail P7 downstream)', () => {
    const out = canonicalizeFunctionalEvalTargets(
      [{ functional_requirement_id: 'US-999-BOGUS', evaluation_method: 'm', success_condition: 's' }],
      canon({}),
    );
    expect(out[0].functional_requirement_id).toBe('US-999-BOGUS');
  });
});

describe('computeEvalCoverage', () => {
  it('reports root US / NFR with no eval as gaps', () => {
    const r = computeEvalCoverage(
      ['US-001', 'US-002', 'US-003'],
      ['NFR-001', 'NFR-002'],
      [{ functional_requirement_id: 'US-001', evaluation_method: 'm', success_condition: 's' }],
      [{ nfr_id: 'NFR-001', category: 'perf', evaluation_tool: 't', threshold: 'x', measurement_method: 'mm' }],
    );
    expect(r.gaps.map((g) => g.requirement_id).sort()).toEqual(['NFR-002', 'US-002', 'US-003']);
    expect(r.gaps.find((g) => g.requirement_id === 'NFR-002')!.kind).toBe('quality');
    expect(r.coverage_percentage).toBe(40); // 2 of 5 covered
  });

  it('reports empty gaps + 100% when fully covered', () => {
    const r = computeEvalCoverage(
      ['US-001'], ['NFR-001'],
      [{ functional_requirement_id: 'US-001', evaluation_method: 'm', success_condition: 's' }],
      [{ nfr_id: 'NFR-001', category: 'c', evaluation_tool: 't', threshold: 'x', measurement_method: 'mm' }],
    );
    expect(r.gaps).toEqual([]);
    expect(r.coverage_percentage).toBe(100);
  });
});
