/**
 * Wave 10 — regression tests for test-leaf projection helpers.
 */

import { describe, it, expect } from 'vitest';
import type {
  GovernedStreamRecord,
  TestDecompositionNodeContent,
} from '../../../../lib/types/records';
import {
  getFrozenTestLeaves,
  buildEffectiveTestPlanView,
  type PriorPhaseContext,
} from '../../../../lib/orchestrator/phases/phaseContext';

let recCounter = 0;
const tsBase = Date.parse('2026-04-28T12:00:00Z');

function rec(content: TestDecompositionNodeContent, secondsOffset = 0): GovernedStreamRecord {
  recCounter++;
  const ts = new Date(tsBase + secondsOffset * 1000).toISOString();
  return {
    id: `rec-${recCounter}`,
    record_type: 'test_decomposition_node',
    schema_version: '1.0',
    workflow_run_id: 'run-1',
    phase_id: '7',
    sub_phase_id: '7.1a',
    produced_by_agent_role: 'test_design_agent',
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

function testNode(o: {
  id: string;
  rootId: string;
  parent?: string | null;
  depth: number;
  status: TestDecompositionNodeContent['status'];
  tier?: 'A' | 'B' | 'C' | 'D';
  testType?: 'unit' | 'integration' | 'end_to_end';
  componentId?: string;
}): TestDecompositionNodeContent {
  return {
    kind: 'test_decomposition_node',
    node_id: o.id,
    parent_node_id: o.parent ?? null,
    display_key: o.id,
    root_test_id: o.rootId,
    depth: o.depth,
    pass_number: 0,
    status: o.status,
    tier: o.tier,
    test_case: {
      id: o.id,
      name: `Test ${o.id}`,
      test_type: o.testType ?? 'unit',
      component_ids: [o.componentId ?? 'comp-x'],
      acceptance_criterion_ids: ['AC-001'],
      preconditions: [],
      steps: [{ id: 's1', description: 'do thing', phase: 'act' }],
      expected_outcome: 'works',
    },
    surfaced_assumption_ids: [],
    release_id: null,
    release_ordinal: null,
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

describe('getFrozenTestLeaves', () => {
  it('returns only nodes whose latest revision is status=atomic', () => {
    const records = [
      rec(testNode({ id: 'root-a', rootId: 'root-a', depth: 0, status: 'decomposed' })),
      rec(testNode({ id: 'leaf-1', rootId: 'root-a', parent: 'root-a', depth: 1, status: 'atomic', tier: 'D' })),
      rec(testNode({ id: 'pruned', rootId: 'root-a', parent: 'root-a', depth: 1, status: 'pruned', tier: 'B' })),
      rec(testNode({ id: 'pending', rootId: 'root-a', parent: 'root-a', depth: 1, status: 'pending', tier: 'C' })),
    ];
    const leaves = getFrozenTestLeaves(records);
    expect(leaves).toHaveLength(1);
    expect(leaves[0].node_id).toBe('leaf-1');
  });

  it('uses latest revision per node_id (supersession)', () => {
    const records = [
      rec(testNode({ id: 'n1', rootId: 'n1', depth: 0, status: 'pending' }), 0),
      rec(testNode({ id: 'n1', rootId: 'n1', depth: 0, status: 'atomic', tier: 'D' }), 60),
    ];
    expect(getFrozenTestLeaves(records)).toHaveLength(1);
  });

  it('drops superseded atomic when newer revision is non-atomic', () => {
    const records = [
      rec(testNode({ id: 'n1', rootId: 'n1', depth: 0, status: 'atomic', tier: 'D' }), 0),
      rec(testNode({ id: 'n1', rootId: 'n1', depth: 0, status: 'downgraded' }), 60),
    ];
    expect(getFrozenTestLeaves(records)).toHaveLength(0);
  });

  it('returns empty when no records exist', () => {
    expect(getFrozenTestLeaves([])).toEqual([]);
  });
});

describe('buildEffectiveTestPlanView', () => {
  it('returns source=leaves when leaves exist; groups by test_type+component', () => {
    const records = [
      rec(testNode({ id: 'leaf-u1', rootId: 'r1', depth: 1, status: 'atomic', tier: 'D', testType: 'unit', componentId: 'comp-a' })),
      rec(testNode({ id: 'leaf-u2', rootId: 'r2', depth: 1, status: 'atomic', tier: 'D', testType: 'unit', componentId: 'comp-a' })),
      rec(testNode({ id: 'leaf-i1', rootId: 'r3', depth: 1, status: 'atomic', tier: 'D', testType: 'integration', componentId: 'comp-b' })),
    ];
    const view = buildEffectiveTestPlanView(records, emptyPrior());
    expect(view.source).toBe('leaves');
    expect(view.leafCount).toBe(3);
    expect(view.test_suites).toHaveLength(2);
    const unitSuite = view.test_suites.find(s => s.test_type === 'unit');
    expect(unitSuite?.test_cases).toHaveLength(2);
    expect(unitSuite?.component_id).toBe('comp-a');
  });

  it('returns source=roots when no leaves but flat test_plan present', () => {
    const prior = emptyPrior();
    prior.testPlan = {
      recordId: 'tp-1',
      content: {
        test_suites: [{ suite_id: 's-1', test_type: 'unit', test_cases: [] }],
      },
      summary: 'flat plan',
    };
    const view = buildEffectiveTestPlanView([], prior);
    expect(view.source).toBe('roots');
    expect(view.summary).toBe('flat plan');
  });

  it('returns source=none when neither tree nor flat plan', () => {
    const view = buildEffectiveTestPlanView([], emptyPrior());
    expect(view.source).toBe('none');
    expect(view.test_suites).toEqual([]);
  });

  it('preserves Phase 9-compatible test_case shape (id, type, criterion ids, steps)', () => {
    const records = [rec({
      ...testNode({ id: 'l1', rootId: 'l1', depth: 0, status: 'atomic', tier: 'D' }),
      test_case: {
        id: 'l1', name: 'Leaf 1', test_type: 'unit',
        component_ids: ['comp-x'],
        acceptance_criterion_ids: ['AC-001'],
        preconditions: ['none'],
        steps: [
          { id: 's1', description: 'arrange', phase: 'arrange' },
          { id: 's2', description: 'act', phase: 'act' },
          { id: 's3', description: 'assert pass', phase: 'assert', expected_outcome: 'pass' },
        ],
        expected_outcome: 'leaf 1 passes',
      },
    })];
    const view = buildEffectiveTestPlanView(records, emptyPrior());
    expect(view.test_suites).toHaveLength(1);
    const tc = view.test_suites[0].test_cases[0];
    expect(tc.test_case_id).toBe('l1');
    expect(tc.type).toBe('unit');
    expect(tc.acceptance_criterion_ids).toEqual(['AC-001']);
    expect(tc.execution_steps).toEqual(['arrange', 'act', 'assert pass']);
    expect(tc.expected_outcome).toBe('leaf 1 passes');
  });
});
