/**
 * Wave 9 — regression tests for data-model-leaf projection helpers.
 *
 * Pins the contract that downstream phases consume:
 *   - getFrozenDataModelLeaves walks data_model_decomposition_node
 *     records and returns nodes whose latest revision is status='atomic'.
 *   - buildEffectiveDataModelView prefers leaves when present, falls
 *     back to flat data_models artifact otherwise.
 *   - Leaves are grouped by component_id into the legacy `models[]` shape.
 */

import { describe, it, expect } from 'vitest';
import type {
  GovernedStreamRecord,
  DataModelDecompositionNodeContent,
} from '../../../../lib/types/records';
import {
  getFrozenDataModelLeaves,
  buildEffectiveDataModelView,
  type PriorPhaseContext,
} from '../../../../lib/orchestrator/phases/phaseContext';

let recCounter = 0;
const tsBase = Date.parse('2026-04-28T12:00:00Z');

function rec(content: DataModelDecompositionNodeContent, secondsOffset = 0): GovernedStreamRecord {
  recCounter++;
  const ts = new Date(tsBase + secondsOffset * 1000).toISOString();
  return {
    id: `rec-${recCounter}`,
    record_type: 'data_model_decomposition_node',
    schema_version: '1.0',
    workflow_run_id: 'run-1',
    phase_id: '5',
    sub_phase_id: '5.1a',
    produced_by_agent_role: 'technical_spec_agent',
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

function entityNode(o: {
  id: string;
  rootId: string;
  parent?: string | null;
  depth: number;
  status: DataModelDecompositionNodeContent['status'];
  tier?: 'A' | 'B' | 'C' | 'D';
  componentId?: string;
}): DataModelDecompositionNodeContent {
  return {
    kind: 'data_model_decomposition_node',
    node_id: o.id,
    parent_node_id: o.parent ?? null,
    display_key: o.id,
    root_entity_id: o.rootId,
    depth: o.depth,
    pass_number: 0,
    status: o.status,
    tier: o.tier,
    entity: {
      id: o.id,
      name: `Entity ${o.id}`,
      kind: 'entity',
      component_id: o.componentId ?? 'comp-x',
      fields: [{ name: 'id', type: 'uuid', is_identity: true }],
      relationships: [],
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

describe('getFrozenDataModelLeaves', () => {
  it('returns only nodes whose latest revision is status=atomic', () => {
    const records = [
      rec(entityNode({ id: 'root-a', rootId: 'root-a', depth: 0, status: 'decomposed' })),
      rec(entityNode({ id: 'leaf-a-1', rootId: 'root-a', parent: 'root-a', depth: 1, status: 'atomic', tier: 'D' })),
      rec(entityNode({ id: 'pruned', rootId: 'root-a', parent: 'root-a', depth: 1, status: 'pruned', tier: 'B' })),
      rec(entityNode({ id: 'pending', rootId: 'root-a', parent: 'root-a', depth: 1, status: 'pending', tier: 'C' })),
    ];
    const leaves = getFrozenDataModelLeaves(records);
    expect(leaves).toHaveLength(1);
    expect(leaves[0].node_id).toBe('leaf-a-1');
  });

  it('uses latest revision per node_id (supersession)', () => {
    const records = [
      rec(entityNode({ id: 'n1', rootId: 'n1', depth: 0, status: 'pending' }), 0),
      rec(entityNode({ id: 'n1', rootId: 'n1', depth: 0, status: 'atomic', tier: 'D' }), 60),
    ];
    expect(getFrozenDataModelLeaves(records)).toHaveLength(1);
  });

  it('drops superseded atomic when newer revision is non-atomic', () => {
    const records = [
      rec(entityNode({ id: 'n1', rootId: 'n1', depth: 0, status: 'atomic', tier: 'D' }), 0),
      rec(entityNode({ id: 'n1', rootId: 'n1', depth: 0, status: 'downgraded' }), 60),
    ];
    expect(getFrozenDataModelLeaves(records)).toHaveLength(0);
  });

  it('returns empty when no records exist', () => {
    expect(getFrozenDataModelLeaves([])).toEqual([]);
  });
});

describe('buildEffectiveDataModelView', () => {
  it('returns source=leaves when leaves exist; groups by component_id', () => {
    const records = [
      rec(entityNode({ id: 'leaf-1', rootId: 'r1', depth: 1, status: 'atomic', tier: 'D', componentId: 'comp-a' })),
      rec(entityNode({ id: 'leaf-2', rootId: 'r2', depth: 1, status: 'atomic', tier: 'D', componentId: 'comp-b' })),
      rec(entityNode({ id: 'leaf-3', rootId: 'r3', depth: 1, status: 'atomic', tier: 'D', componentId: 'comp-a' })),
    ];
    const view = buildEffectiveDataModelView(records, emptyPrior());
    expect(view.source).toBe('leaves');
    expect(view.leafCount).toBe(3);
    expect(view.models).toHaveLength(2);
    const compA = view.models.find(m => m.component_id === 'comp-a');
    expect(compA?.entities).toHaveLength(2);
  });

  it('returns source=roots when no leaves but flat data_models present', () => {
    const prior = emptyPrior();
    prior.dataModels = {
      recordId: 'dm-1',
      content: {
        models: [{ component_id: 'comp-1', entities: [] }],
      },
      summary: 'flat data models',
    };
    const view = buildEffectiveDataModelView([], prior);
    expect(view.source).toBe('roots');
    expect(view.summary).toBe('flat data models');
  });

  it('returns source=none when neither tree nor flat data_models', () => {
    const view = buildEffectiveDataModelView([], emptyPrior());
    expect(view.source).toBe('none');
    expect(view.models).toEqual([]);
  });
});
