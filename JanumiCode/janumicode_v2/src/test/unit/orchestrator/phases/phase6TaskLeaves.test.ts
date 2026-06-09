/**
 * Wave 8 — regression tests for task-leaf projection helpers.
 *
 * Pins the contract that Phase 9 consumes:
 *   - getFrozenTaskLeaves walks task_decomposition_node records and
 *     returns nodes whose latest revision is status='atomic'.
 *   - buildEffectiveTaskView prefers leaves when present, falls back
 *     to flat root implementation_plan.tasks otherwise.
 *   - Supersession handling: a node with multiple revisions returns the
 *     latest (e.g. pending → atomic).
 *   - Release-ordinal sort orders leaves with lower ordinals first;
 *     nulls sort last (backlog).
 */

import { describe, it, expect } from 'vitest';
import type { GovernedStreamRecord, TaskDecompositionNodeContent } from '../../../../lib/types/records';
import {
  getFrozenTaskLeaves,
  buildEffectiveTaskView,
  type PriorPhaseContext,
} from '../../../../lib/orchestrator/phases/phaseContext';

let recCounter = 0;
const tsBase = Date.parse('2026-04-28T12:00:00Z');

function rec(content: TaskDecompositionNodeContent, secondsOffset = 0): GovernedStreamRecord {
  recCounter++;
  const ts = new Date(tsBase + secondsOffset * 1000).toISOString();
  return {
    id: `rec-${recCounter}`,
    record_type: 'task_decomposition_node',
    schema_version: '1.0',
    workflow_run_id: 'run-1',
    phase_id: '6',
    sub_phase_id: '6.1a',
    produced_by_agent_role: 'implementation_planner',
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

function taskNode(o: {
  id: string;
  rootId: string;
  parent?: string | null;
  depth: number;
  status: TaskDecompositionNodeContent['status'];
  tier?: 'A' | 'B' | 'C' | 'D';
  name?: string;
  releaseOrdinal?: number | null;
}): TaskDecompositionNodeContent {
  return {
    kind: 'task_decomposition_node',
    node_id: o.id,
    parent_node_id: o.parent ?? null,
    display_key: o.id,
    root_task_id: o.rootId,
    depth: o.depth,
    pass_number: 0,
    status: o.status,
    tier: o.tier,
    task: {
      id: o.id,
      name: o.name ?? `Task ${o.id}`,
      description: `Implement ${o.id}`,
      component_id: 'comp-x',
      component_responsibility: 'do work',
      backing_tool: 'claude_code_cli',
      estimated_complexity: 'medium',
      completion_criteria: [{ criterion_id: `cc-${o.id}`, description: `${o.id} completes` }],
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

describe('getFrozenTaskLeaves', () => {
  it('returns only nodes whose latest revision is status=atomic', () => {
    const records = [
      rec(taskNode({ id: 'root-a', rootId: 'root-a', depth: 0, status: 'decomposed' })),
      rec(taskNode({ id: 'leaf-a-1', rootId: 'root-a', parent: 'root-a', depth: 1, status: 'atomic', tier: 'D' })),
      rec(taskNode({ id: 'leaf-a-2', rootId: 'root-a', parent: 'root-a', depth: 1, status: 'atomic', tier: 'D' })),
      rec(taskNode({ id: 'pruned-a', rootId: 'root-a', parent: 'root-a', depth: 1, status: 'pruned', tier: 'B' })),
      rec(taskNode({ id: 'pending-a', rootId: 'root-a', parent: 'root-a', depth: 1, status: 'pending', tier: 'C' })),
    ];
    const leaves = getFrozenTaskLeaves(records);
    expect(leaves).toHaveLength(2);
    const ids = leaves.map(l => l.node_id).sort();
    expect(ids).toEqual(['leaf-a-1', 'leaf-a-2']);
  });

  it('uses the latest revision per node_id for supersession handling', () => {
    const records = [
      rec(taskNode({ id: 'n1', rootId: 'n1', depth: 0, status: 'pending' }), 0),
      rec(taskNode({ id: 'n1', rootId: 'n1', depth: 0, status: 'atomic', tier: 'D' }), 60),
    ];
    const leaves = getFrozenTaskLeaves(records);
    expect(leaves).toHaveLength(1);
    expect(leaves[0].node_id).toBe('n1');
  });

  it('surfaces a depth-0 atomic refactoring leaf with its idempotency fields (Phase 0.5 → 6 → 9.1)', () => {
    // Mirrors Phase 6's injected refactoring leaf: depth-0, status=atomic, never
    // decomposed, carrying task_type:'refactoring' + the executor idempotency fields.
    const refLeaf = taskNode({ id: 'REFACTOR-1', rootId: 'REFACTOR-1', depth: 0, status: 'atomic' });
    refLeaf.task.task_type = 'refactoring';
    refLeaf.task.expected_pre_state_hash = 'deadbeef';
    refLeaf.task.verification_step = 'confirm contract conformance';
    refLeaf.task.refactoring_instructions = '## Cross-Run Refactoring Instruction\nremove delete endpoint';
    const leaves = getFrozenTaskLeaves([rec(refLeaf)]);
    expect(leaves).toHaveLength(1);

    const view = buildEffectiveTaskView([rec(refLeaf)], emptyPrior());
    expect(view.source).toBe('leaves');
    const t = view.tasks[0] as Record<string, unknown>;
    expect(t.task_type).toBe('refactoring');
    expect(t.expected_pre_state_hash).toBe('deadbeef');
    expect(t.verification_step).toBe('confirm contract conformance');
    expect(t.refactoring_instructions).toContain('Cross-Run Refactoring Instruction');
  });

  it('drops superseded atomic if newer revision is non-atomic', () => {
    const records = [
      rec(taskNode({ id: 'n1', rootId: 'n1', depth: 0, status: 'atomic', tier: 'D' }), 0),
      rec(taskNode({ id: 'n1', rootId: 'n1', depth: 0, status: 'downgraded' }), 60),
    ];
    expect(getFrozenTaskLeaves(records)).toHaveLength(0);
  });

  it('returns empty array when no task_decomposition_node records exist', () => {
    expect(getFrozenTaskLeaves([])).toEqual([]);
  });

  it('ignores records of other types', () => {
    const records: GovernedStreamRecord[] = [
      {
        ...rec(taskNode({ id: 'leaf-1', rootId: 'leaf-1', depth: 0, status: 'atomic', tier: 'D' })),
        record_type: 'requirement_decomposition_node',
      },
    ];
    expect(getFrozenTaskLeaves(records)).toEqual([]);
  });
});

describe('buildEffectiveTaskView', () => {
  it('returns source=leaves when leaves exist; sorted by release_ordinal then display', () => {
    const records = [
      rec(taskNode({ id: 'leaf-r2', rootId: 'r2', depth: 1, status: 'atomic', tier: 'D', releaseOrdinal: 2 })),
      rec(taskNode({ id: 'leaf-r1', rootId: 'r1', depth: 1, status: 'atomic', tier: 'D', releaseOrdinal: 1 })),
      rec(taskNode({ id: 'leaf-bk', rootId: 'rb', depth: 1, status: 'atomic', tier: 'D', releaseOrdinal: null })),
    ];
    const view = buildEffectiveTaskView(records, emptyPrior());
    expect(view.source).toBe('leaves');
    expect(view.leafCount).toBe(3);
    expect(view.tasks.map(t => t.id)).toEqual(['leaf-r1', 'leaf-r2', 'leaf-bk']);
  });

  it('returns source=roots when no leaves exist but flat implementation_plan present', () => {
    const prior = emptyPrior();
    prior.implementationPlan = {
      recordId: 'ip-1',
      content: {
        tasks: [{ id: 'flat-1', component_id: 'c-1' }, { id: 'flat-2', component_id: 'c-2' }],
      },
      summary: 'flat plan summary',
    };
    const view = buildEffectiveTaskView([], prior);
    expect(view.source).toBe('roots');
    expect(view.leafCount).toBe(0);
    expect(view.rootCount).toBe(2);
    expect(view.summary).toBe('flat plan summary');
  });

  it('returns source=none when neither tree nor flat plan exists', () => {
    const view = buildEffectiveTaskView([], emptyPrior());
    expect(view.source).toBe('none');
    expect(view.leafCount).toBe(0);
    expect(view.rootCount).toBe(0);
    expect(view.tasks).toEqual([]);
  });

  it('surfaces Phase 9-compatible field names on leaf projection', () => {
    // Phase 9 reads task.id, task_type, component_id,
    // component_responsibility, description, backing_tool,
    // dependency_task_ids, estimated_complexity, completion_criteria,
    // write_directory_paths. Verify all surface from the leaf shape.
    const records = [rec({
      ...taskNode({ id: 'l1', rootId: 'l1', depth: 0, status: 'atomic', tier: 'D' }),
      task: {
        id: 'l1',
        name: 'Leaf 1',
        description: 'Implement leaf 1',
        task_type: 'standard',
        component_id: 'comp-x',
        component_responsibility: 'do work',
        backing_tool: 'claude_code_cli',
        estimated_complexity: 'medium',
        completion_criteria: [{ criterion_id: 'cc-1', description: 'works' }],
        write_directory_paths: ['src/x'],
        dependency_task_ids: ['l0'],
      },
    })];
    const view = buildEffectiveTaskView(records, emptyPrior());
    const t = view.tasks[0];
    expect(t.id).toBe('l1');
    expect(t.task_type).toBe('standard');
    expect(t.component_id).toBe('comp-x');
    expect(t.component_responsibility).toBe('do work');
    expect(t.description).toBe('Implement leaf 1');
    expect(t.backing_tool).toBe('claude_code_cli');
    expect(t.estimated_complexity).toBe('medium');
    expect((t.completion_criteria as Array<Record<string, unknown>>)[0].criterion_id).toBe('cc-1');
    expect(t.write_directory_paths).toEqual(['src/x']);
    expect(t.dependency_task_ids).toEqual(['l0']);
  });
});
