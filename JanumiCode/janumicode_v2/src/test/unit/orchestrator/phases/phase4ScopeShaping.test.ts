/**
 * Unit tests for Phase 4 scope-shaping (Levers 1a + 1b).
 *
 * 1a — NFR/cross-cutting components are partitioned out of the functional
 *      set and reified as constraints (not built as services).
 * 1b — the functional component count is right-sized to a budget keyed to
 *      intent scale (accepted user stories + domains), consolidating
 *      within-domain while preserving user-story coverage.
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeComponentKinds,
  partitionComponentsByKind,
  buildCrossCuttingConstraints,
  computeComponentBudget,
  consolidateToBudget,
  type ShapingComponent,
} from '../../../../lib/orchestrator/phases/phase4ScopeShaping';

function comp(id: string, domain: string, traces: string[], kind?: 'functional' | 'cross_cutting'): ShapingComponent {
  return {
    id, name: id, domain_id: domain,
    responsibilities: [{ id: `res-${id}`, statement: `do ${id}` }],
    dependencies: [],
    traces_to: traces,
    satisfies_requirement_ids: traces,
    component_kind: kind,
  };
}

describe('1a — normalizeComponentKinds (robustness when LLM omits the field)', () => {
  it('keeps an explicit component_kind untouched', () => {
    const c = [comp('comp-x', 'd', ['US-1'], 'functional'), comp('comp-y', 'd', [], 'cross_cutting')];
    const { components, inferred } = normalizeComponentKinds(c);
    expect(inferred).toBe(0);
    expect(components.map(x => x.component_kind)).toEqual(['functional', 'cross_cutting']);
  });

  it('infers cross_cutting from empty traces_to, functional from non-empty', () => {
    const c = [
      { id: 'a', name: 'a', responsibilities: [], traces_to: ['US-1'] },           // → functional
      { id: 'b', name: 'b', responsibilities: [], traces_to: [] },                  // → cross_cutting
      { id: 'c', name: 'c', responsibilities: [], applies_to_components: ['a'] },   // → cross_cutting
    ];
    const { components, inferred } = normalizeComponentKinds(c);
    expect(inferred).toBe(3);
    expect(components.map(x => x.component_kind)).toEqual(['functional', 'cross_cutting', 'cross_cutting']);
  });

  it('never mutates the input array', () => {
    const c = [{ id: 'a', name: 'a', responsibilities: [], traces_to: [] as string[] }];
    normalizeComponentKinds(c);
    expect(c[0].component_kind).toBeUndefined();
  });
});

describe('1a — partitionComponentsByKind', () => {
  it('routes cross_cutting components out of the functional set; absent kind defaults functional', () => {
    const components = [
      comp('comp-url', 'domain-core', ['US-1'], 'functional'),
      comp('comp-encryption', 'domain-core', [], 'cross_cutting'),
      comp('comp-redirect', 'domain-core', ['US-2']), // no kind ⇒ functional
    ];
    const { functional, crossCutting } = partitionComponentsByKind(components);
    expect(functional.map(c => c.id)).toEqual(['comp-url', 'comp-redirect']);
    expect(crossCutting.map(c => c.id)).toEqual(['comp-encryption']);
  });

  it('buildCrossCuttingConstraints maps applies_to_components (falls back to traces_to)', () => {
    const cc: ShapingComponent[] = [
      { ...comp('comp-encryption', 'd', [], 'cross_cutting'), applies_to_components: ['comp-url'] },
      { ...comp('comp-logging', 'd', ['US-2'], 'cross_cutting') }, // no applies_to ⇒ fall back to traces_to
    ];
    const out = buildCrossCuttingConstraints(cc);
    expect(out.kind).toBe('cross_cutting_constraints');
    expect(out.concerns[0].applies_to_components).toEqual(['comp-url']);
    expect(out.concerns[1].applies_to_components).toEqual(['US-2']);
  });
});

describe('1b — computeComponentBudget', () => {
  it('is max(domains, ceil(ratio × stories), 1)', () => {
    expect(computeComponentBudget(10, 3, 1.0)).toBe(10); // stories dominate
    expect(computeComponentBudget(2, 5, 1.0)).toBe(5);   // domain floor dominates
    expect(computeComponentBudget(4, 2, 0.5)).toBe(2);   // ceil(0.5×4)=2 == domains
  });
  it('ratio <= 0 disables the gate (Infinity)', () => {
    expect(computeComponentBudget(100, 1, 0)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('1b — consolidateToBudget', () => {
  const accepted = new Set(['US-1', 'US-2', 'US-3', 'US-4']);

  it('returns the set untouched when already within budget', () => {
    const input = [comp('a', 'd1', ['US-1']), comp('b', 'd2', ['US-2'])];
    const r = consolidateToBudget(input, 5, accepted);
    expect(r.merges).toEqual([]);
    expect(r.components).toHaveLength(2);
    expect(r.coveragePreserved).toBe(true);
  });

  it('merges within the largest domain and preserves user-story coverage', () => {
    const input = [
      comp('a', 'd1', ['US-1']),
      comp('b', 'd1', ['US-2']),
      comp('c', 'd1', ['US-3']),
      comp('d', 'd2', ['US-4']),
    ];
    const r = consolidateToBudget(input, 2, accepted);
    expect(r.components.length).toBeLessThanOrEqual(2);
    expect(r.merges.length).toBeGreaterThan(0);
    expect(r.coveragePreserved).toBe(true);
    // Union of all surviving traces_to still covers every accepted story.
    const covered = new Set(r.components.flatMap(c => c.traces_to ?? []));
    for (const us of accepted) expect(covered.has(us)).toBe(true);
  });

  it('cannot reduce below the number of distinct domains (the floor)', () => {
    const input = [
      comp('a', 'd1', ['US-1']),
      comp('b', 'd2', ['US-2']),
      comp('c', 'd3', ['US-3']),
    ];
    // Budget below domain count: each domain has 1 component, so no merge possible.
    const r = consolidateToBudget(input, 1, accepted);
    expect(r.components).toHaveLength(3); // floor at #domains
    expect(r.merges).toEqual([]);
  });

  it('remaps dependency edges that targeted a merged component to the survivor', () => {
    const a = comp('a', 'd1', ['US-1']);
    const b = comp('b', 'd1', ['US-2']);
    const dep = comp('d', 'd2', ['US-3']);
    dep.dependencies = [{ target_component_id: 'b', dependency_type: 'sync_call' }];
    const r = consolidateToBudget([a, b, dep], 2, accepted);
    // b merged into a; dep's edge to b must now point to a (the survivor).
    const depAfter = r.components.find(c => c.id === 'd');
    expect(depAfter?.dependencies?.some(e => e.target_component_id === 'a')).toBe(true);
    expect(depAfter?.dependencies?.some(e => e.target_component_id === 'b')).toBe(false);
  });

  it('does not mutate the caller’s input array', () => {
    const input = [comp('a', 'd1', ['US-1']), comp('b', 'd1', ['US-2']), comp('c', 'd1', ['US-3'])];
    const before = input.map(c => c.responsibilities.length);
    consolidateToBudget(input, 1, accepted);
    expect(input.map(c => c.responsibilities.length)).toEqual(before);
  });
});
