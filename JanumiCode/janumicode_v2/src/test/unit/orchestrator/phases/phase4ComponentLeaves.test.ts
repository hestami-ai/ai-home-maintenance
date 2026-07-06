/**
 * Wave 7 — regression tests for component-leaf projection helpers.
 *
 * Pins the contract that downstream phases (5/6/4.3/4.5) consume:
 *   - getFrozenComponentLeaves walks component_decomposition_node
 *     records and returns nodes whose latest revision is status='atomic'.
 *   - buildEffectiveComponentView prefers leaves when present, falls
 *     back to flat root component_model otherwise.
 *   - Supersession handling: a node with multiple revisions returns the
 *     latest (e.g. pending → atomic).
 *   - Release-ordinal sort orders leaves with lower ordinals first;
 *     nulls sort last (backlog).
 */

import { describe, it, expect } from 'vitest';
import type { GovernedStreamRecord, ComponentDecompositionNodeContent } from '../../../../lib/types/records';
import {
  getFrozenComponentLeaves,
  buildEffectiveComponentView,
  type PriorPhaseContext,
} from '../../../../lib/orchestrator/phases/phaseContext';

let recCounter = 0;
const tsBase = Date.parse('2026-04-28T12:00:00Z');

function rec(content: ComponentDecompositionNodeContent, secondsOffset = 0): GovernedStreamRecord {
  recCounter++;
  const ts = new Date(tsBase + secondsOffset * 1000).toISOString();
  return {
    id: `rec-${recCounter}`,
    record_type: 'component_decomposition_node',
    schema_version: '1.0',
    workflow_run_id: 'run-1',
    phase_id: '4',
    sub_phase_id: 'component_saturation',
    produced_by_agent_role: 'domain_interpreter',
    produced_by_record_id: null,
    produced_at: ts,
    effective_at: ts,
    janumicode_version_sha: 'dev',
    authority_level: 'commitment',
    derived_from_system_proposal: false,
    is_current_version: true,
    superseded_by_id: null,
    superseded_at: null,
    superseded_by_record_id: null,
    source_workflow_run_id: 'run-1',
    derived_from_record_ids: [],
    quarantined: false,
    sanitized: false,
    sanitized_fields: [],
    content: content as unknown as Record<string, unknown>,
  };
}

function compNode(o: {
  id: string;
  rootId: string;
  parent?: string | null;
  depth: number;
  status: ComponentDecompositionNodeContent['status'];
  tier?: 'A' | 'B' | 'C' | 'D';
  name?: string;
  releaseOrdinal?: number | null;
}): ComponentDecompositionNodeContent {
  return {
    kind: 'component_decomposition_node',
    node_id: o.id,
    parent_node_id: o.parent ?? null,
    display_key: o.id,
    root_component_id: o.rootId,
    depth: o.depth,
    pass_number: 0,
    status: o.status,
    tier: o.tier,
    component: {
      id: o.id,
      name: o.name ?? `Component ${o.id}`,
      responsibilities: [{ id: `resp-${o.id}`, description: `do thing for ${o.id}` }],
      dependencies: [],
    },
    surfaced_assumption_ids: [],
    release_id: o.releaseOrdinal != null ? `release-${o.releaseOrdinal}` : null,
    release_ordinal: o.releaseOrdinal ?? null,
  };
}

function emptyPrior(): PriorPhaseContext {
  return {
    intentStatement: null, functionalRequirements: null, nonFunctionalRequirements: null,
    systemBoundary: null, systemRequirements: null, interfaceContracts: null,
    softwareDomains: null, componentModel: null, architecturalDecisions: null,
    dataModels: null, apiDefinitions: null, errorHandlingStrategies: null, configurationParameters: null,
    implementationPlan: null, testPlan: null, testCoverageReport: null,
    functionalEvalPlan: null, qualityEvalPlan: null,
    allRecordIds: [], projectTypeDescription: 'test',
  };
}

describe('getFrozenComponentLeaves', () => {
  it('returns only nodes whose latest revision is status=atomic', () => {
    const records = [
      rec(compNode({ id: 'root-a', rootId: 'root-a', depth: 0, status: 'decomposed' })),
      rec(compNode({ id: 'leaf-a-1', rootId: 'root-a', parent: 'root-a', depth: 1, status: 'atomic', tier: 'D' })),
      rec(compNode({ id: 'leaf-a-2', rootId: 'root-a', parent: 'root-a', depth: 1, status: 'atomic', tier: 'D' })),
      rec(compNode({ id: 'pruned-a', rootId: 'root-a', parent: 'root-a', depth: 1, status: 'pruned', tier: 'B' })),
      rec(compNode({ id: 'pending-a', rootId: 'root-a', parent: 'root-a', depth: 1, status: 'pending', tier: 'C' })),
    ];
    const leaves = getFrozenComponentLeaves(records);
    expect(leaves).toHaveLength(2);
    const ids = leaves.map(l => l.node_id).sort();
    expect(ids).toEqual(['leaf-a-1', 'leaf-a-2']);
  });

  it('uses the latest revision per node_id for supersession handling', () => {
    // Same node_id appears as pending then atomic — latest wins.
    const records = [
      rec(compNode({ id: 'n1', rootId: 'n1', depth: 0, status: 'pending' }), 0),
      rec(compNode({ id: 'n1', rootId: 'n1', depth: 0, status: 'atomic', tier: 'D' }), 60),
    ];
    const leaves = getFrozenComponentLeaves(records);
    expect(leaves).toHaveLength(1);
    expect(leaves[0].node_id).toBe('n1');
  });

  it('drops superseded atomic if newer revision is non-atomic', () => {
    // Atomic at t=0, superseded by pending at t=60 — latest wins (no leaf).
    const records = [
      rec(compNode({ id: 'n1', rootId: 'n1', depth: 0, status: 'atomic', tier: 'D' }), 0),
      rec(compNode({ id: 'n1', rootId: 'n1', depth: 0, status: 'downgraded' }), 60),
    ];
    const leaves = getFrozenComponentLeaves(records);
    expect(leaves).toHaveLength(0);
  });

  it('resolves root_display_key from depth-0 nodes when available', () => {
    const records = [
      rec(compNode({ id: 'root-a', rootId: 'root-a', depth: 0, status: 'decomposed', name: 'Auth Subsystem' })),
      rec(compNode({ id: 'leaf-1', rootId: 'root-a', parent: 'root-a', depth: 1, status: 'atomic', tier: 'D' })),
    ];
    const leaves = getFrozenComponentLeaves(records);
    expect(leaves[0].root_display_key).toBe('root-a');
  });

  it('returns empty array when no component_decomposition_node records exist', () => {
    expect(getFrozenComponentLeaves([])).toEqual([]);
  });

  it('ignores records of other types', () => {
    const records: GovernedStreamRecord[] = [
      {
        ...rec(compNode({ id: 'leaf-1', rootId: 'leaf-1', depth: 0, status: 'atomic', tier: 'D' })),
        record_type: 'requirement_decomposition_node',
      },
    ];
    expect(getFrozenComponentLeaves(records)).toEqual([]);
  });
});

describe('buildEffectiveComponentView', () => {
  it('returns source=leaves when leaves exist; sorted by release_ordinal then display', () => {
    const records = [
      rec(compNode({ id: 'leaf-r2', rootId: 'r2', depth: 1, status: 'atomic', tier: 'D', releaseOrdinal: 2 })),
      rec(compNode({ id: 'leaf-r1', rootId: 'r1', depth: 1, status: 'atomic', tier: 'D', releaseOrdinal: 1 })),
      rec(compNode({ id: 'leaf-bk', rootId: 'rb', depth: 1, status: 'atomic', tier: 'D', releaseOrdinal: null })),
    ];
    const view = buildEffectiveComponentView(records, emptyPrior());
    expect(view.source).toBe('leaves');
    expect(view.leafCount).toBe(3);
    expect(view.components.map(c => c.id)).toEqual(['leaf-r1', 'leaf-r2', 'leaf-bk']);
  });

  it('returns source=roots when no leaves exist but flat component_model present', () => {
    const prior = emptyPrior();
    prior.componentModel = {
      recordId: 'cm-1',
      content: {
        components: [{ id: 'flat-1', name: 'Flat A' }, { id: 'flat-2', name: 'Flat B' }],
      },
      summary: 'flat component summary',
    };
    const view = buildEffectiveComponentView([], prior);
    expect(view.source).toBe('roots');
    expect(view.leafCount).toBe(0);
    expect(view.rootCount).toBe(2);
    expect(view.summary).toBe('flat component summary');
  });

  it('returns source=none when neither tree nor flat component_model exists', () => {
    const view = buildEffectiveComponentView([], emptyPrior());
    expect(view.source).toBe('none');
    expect(view.leafCount).toBe(0);
    expect(view.rootCount).toBe(0);
    expect(view.components).toEqual([]);
  });

  it('preserves backward-compat field names (statement, target_component_id, dependency_type)', () => {
    // Phase 5/6 call sites already iterate `responsibilities[].statement`
    // and `dependencies[].target_component_id` / `dependency_type`. The
    // leaf projection must surface those names so the downstream prompt
    // building stays unchanged.
    const records = [rec({
      ...compNode({ id: 'l1', rootId: 'l1', depth: 0, status: 'atomic', tier: 'D' }),
      component: {
        id: 'l1', name: 'Leaf 1',
        responsibilities: [{ id: 'resp-1', description: 'do work' }],
        dependencies: [{ component_id: 'dep-1', kind: 'sync_call' }],
      },
    })];
    const view = buildEffectiveComponentView(records, emptyPrior());
    const c = view.components[0];
    const resps = c.responsibilities as Array<Record<string, unknown>>;
    const deps = c.dependencies as Array<Record<string, unknown>>;
    expect(resps[0].statement).toBe('do work');
    expect(resps[0].description).toBe('do work');
    expect(deps[0].target_component_id).toBe('dep-1');
    expect(deps[0].component_id).toBe('dep-1');
    expect(deps[0].dependency_type).toBe('sync_call');
    expect(deps[0].kind).toBe('sync_call');
  });

  // PA-3 regression (2026-07-05): the pre-fix producer seeded the leaf view's
  // `satisfies_requirement_ids` from the leaf's OWN `traces_to`, which are `res-*`
  // RESPONSIBILITY ids, not requirement ids. That made phase6's per-component AC-menu
  // scoping intersect `{res-*}` against `US-*` leaf-AC roots → 0 overlap → 100%
  // fail-open (cal-38: 30/30 unscoped, undetected). The real US linkage lives on the
  // ROOT component_model; the view must surface THAT, joined via root_display_key.
  it('PA-3: leaf satisfies_requirement_ids resolves to the ROOT US traces, not the leaf res-* responsibilities', () => {
    const records = [
      rec(compNode({ id: 'comp-x', rootId: 'comp-x', depth: 0, status: 'decomposed' })),
      rec({
        ...compNode({ id: 'leaf-x', rootId: 'comp-x', parent: 'comp-x', depth: 1, status: 'atomic', tier: 'D' }),
        component: {
          id: 'leaf-x',
          name: 'Leaf X',
          responsibilities: [{ id: 'res-x-1', description: 'do x' }],
          dependencies: [],
          // The pre-fix mis-seed: leaf carries responsibility-id traces.
          traces_to: ['res-x-1'],
        },
      }),
    ];
    const prior = emptyPrior();
    prior.componentModel = {
      recordId: 'cm-1',
      content: { components: [{ id: 'comp-x', traces_to: ['US-001', 'US-010'] }] },
      summary: 'root component summary',
    };
    const view = buildEffectiveComponentView(records, prior);
    const c = view.components.find(x => x.id === 'leaf-x');
    expect(c).toBeDefined();
    expect(c?.satisfies_requirement_ids).toEqual(['US-001', 'US-010']);
    // Never the responsibility ids (the pre-fix bug).
    expect(c?.satisfies_requirement_ids).not.toContain('res-x-1');
  });

  it('PA-3: falls back to [] (never res-*) when the root component has no US traces', () => {
    const records = [
      rec(compNode({ id: 'comp-y', rootId: 'comp-y', depth: 0, status: 'decomposed' })),
      rec({
        ...compNode({ id: 'leaf-y', rootId: 'comp-y', parent: 'comp-y', depth: 1, status: 'atomic', tier: 'D' }),
        component: {
          id: 'leaf-y',
          name: 'Leaf Y',
          responsibilities: [{ id: 'res-y-1', description: 'do y' }],
          dependencies: [],
          traces_to: ['res-y-1'],
        },
      }),
    ];
    const prior = emptyPrior();
    prior.componentModel = {
      recordId: 'cm-2',
      content: { components: [{ id: 'comp-y' }] }, // no traces_to on the root
      summary: 'root component summary',
    };
    const view = buildEffectiveComponentView(records, prior);
    const c = view.components.find(x => x.id === 'leaf-y');
    expect(c).toBeDefined();
    expect(c?.satisfies_requirement_ids).toEqual([]);
  });
});
