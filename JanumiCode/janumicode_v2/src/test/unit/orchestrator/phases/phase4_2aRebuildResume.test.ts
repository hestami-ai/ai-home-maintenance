/**
 * Wave 7 — characterization tests for rebuildComponentSaturationStateFromStream.
 *
 * Pins the CURRENT observable behavior of the resume-state reconstruction:
 *   - Returns null when no decomposition-node rows exist (fresh start).
 *   - Returns null when nodes exist but no pipeline record matches the
 *     requested pipeline_id.
 *   - On a full prior state, reconstructs the resume queue (pending nodes
 *     only), sibling map, assumption set + next-seq, pass number,
 *     max depth, and pipeline start/current record identities.
 *
 * These assertions are derived from the original control flow (not the
 * refactor) so they lock behavior across the S3776 decomposition.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createTestDatabase, type Database } from '../../../../lib/database/init';
import { ConfigManager } from '../../../../lib/config/configManager';
import { OrchestratorEngine } from '../../../../lib/orchestrator/orchestratorEngine';
import {
  rebuildComponentSaturationStateFromStream,
  type ComponentSaturationConfig,
} from '../../../../lib/orchestrator/phases/phase4_2a';
import type {
  DecompositionComponent,
  DecompositionNodeStatus,
  DecompositionTier,
  ComponentDecompositionNodeContent,
  ComponentDecompositionPipelineContent,
  ComponentAssumptionSetSnapshotContent,
  ComponentAssumptionEntry,
} from '../../../../lib/types/records';

const extensionPath = path.resolve(__dirname, '..', '..', '..', '..', '..');
const workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'jc-test-ws-rebuild-'));

const CONFIG: ComponentSaturationConfig = {
  recordSubPhaseId: 'component_saturation',
  templateSubPhase: 'component_saturation',
  gateSurfacePrefix: 'comp-decomp-gate-',
};

type Ctx = Parameters<typeof rebuildComponentSaturationStateFromStream>[0];

function comp(
  id: string,
  overrides: Partial<DecompositionComponent> = {},
): DecompositionComponent {
  return {
    id,
    name: `${id} name`,
    responsibilities: [{ id: `resp-${id}`, description: `${id} duty` }],
    dependencies: [],
    ...overrides,
  };
}

function writeNode(
  engine: OrchestratorEngine,
  runId: string,
  fields: {
    node_id: string;
    parent_node_id: string | null;
    display_key: string;
    root_component_id: string;
    depth: number;
    status: DecompositionNodeStatus;
    component: DecompositionComponent;
    tier?: DecompositionTier;
  },
): string {
  const rec = engine.writer.writeRecord({
    record_type: 'component_decomposition_node',
    schema_version: '1.0',
    workflow_run_id: runId,
    phase_id: '4',
    sub_phase_id: 'component_saturation',
    produced_by_agent_role: 'architecture_agent',
    janumicode_version_sha: 'dev',
    derived_from_record_ids: [],
    content: {
      kind: 'component_decomposition_node',
      node_id: fields.node_id,
      parent_node_id: fields.parent_node_id,
      display_key: fields.display_key,
      root_component_id: fields.root_component_id,
      depth: fields.depth,
      pass_number: 0,
      status: fields.status,
      tier: fields.tier,
      component: fields.component,
      surfaced_assumption_ids: [],
      release_id: null,
      release_ordinal: null,
    } satisfies ComponentDecompositionNodeContent,
  });
  return rec.id;
}

describe('rebuildComponentSaturationStateFromStream — Wave 7 resume reconstruction', () => {
  let db: Database;
  let engine: OrchestratorEngine;

  beforeEach(() => {
    db = createTestDatabase();
    const configManager = new ConfigManager();
    engine = new OrchestratorEngine(db, configManager, workspacePath, extensionPath);
  });

  afterEach(() => { db.close(); });

  it('returns null when no decomposition-node rows exist (fresh start)', () => {
    const { run } = engine.startWorkflowRun('ws', 'test');
    const ctx = { engine, workflowRun: { id: run.id } as Ctx['workflowRun'] };
    const state = rebuildComponentSaturationStateFromStream(ctx, CONFIG, 'comp-decomp-pipe-none');
    expect(state).toBeNull();
  });

  it('returns null when nodes exist but no pipeline record matches the pipeline_id', () => {
    const { run } = engine.startWorkflowRun('ws', 'test');
    writeNode(engine, run.id, {
      node_id: 'n-root', parent_node_id: null, display_key: 'comp-root',
      root_component_id: 'n-root', depth: 0, status: 'pending', component: comp('comp-root'),
    });
    // A pipeline record exists but under a DIFFERENT pipeline_id.
    engine.writer.writeRecord({
      record_type: 'component_decomposition_pipeline',
      schema_version: '1.0',
      workflow_run_id: run.id,
      phase_id: '4',
      sub_phase_id: 'component_saturation',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: 'dev',
      derived_from_record_ids: [],
      content: {
        kind: 'component_decomposition_pipeline',
        pipeline_id: 'comp-decomp-pipe-OTHER',
        root_component_id: '*',
        passes: [],
      } satisfies ComponentDecompositionPipelineContent,
    });
    const ctx = { engine, workflowRun: { id: run.id } as Ctx['workflowRun'] };
    const state = rebuildComponentSaturationStateFromStream(ctx, CONFIG, 'comp-decomp-pipe-WANTED');
    expect(state).toBeNull();
  });

  it('reconstructs queue, siblings, assumptions, passes, and pipeline identities', () => {
    const { run } = engine.startWorkflowRun('ws', 'test');
    const pipelineId = 'comp-decomp-pipe-resume';

    // Nodes: root (pending, depth 0), child-B (pending, depth 1, tier B),
    // child-D (atomic, depth 1, tier D — terminal, must NOT be re-queued).
    const rootComp = comp('comp-root', { active_constraints: ['TECH-BUN-1'] });
    const childBComp = comp('comp-child-b');
    const childDComp = comp('comp-child-d');

    const rootRecId = writeNode(engine, run.id, {
      node_id: 'n-root', parent_node_id: null, display_key: 'comp-root',
      root_component_id: 'n-root', depth: 0, status: 'pending', component: rootComp,
    });
    writeNode(engine, run.id, {
      node_id: 'n-childB', parent_node_id: 'n-root', display_key: 'comp-child-b',
      root_component_id: 'n-root', depth: 1, status: 'pending', tier: 'B', component: childBComp,
    });
    writeNode(engine, run.id, {
      node_id: 'n-childD', parent_node_id: 'n-root', display_key: 'comp-child-d',
      root_component_id: 'n-root', depth: 1, status: 'atomic', tier: 'D', component: childDComp,
    });

    // Assumption snapshot at pass 2 — highest CA-#### drives next seq.
    const assumptions: ComponentAssumptionEntry[] = [
      { id: 'CA-0003', text: 'assumption three', source: 'decomposition', surfaced_at_node: 'n-root', surfaced_at_pass: 2, category: 'boundary' },
      { id: 'CA-0001', text: 'assumption one', source: 'decomposition', surfaced_at_node: 'n-childB', surfaced_at_pass: 1, category: 'data_ownership' },
    ];
    engine.writer.writeRecord({
      record_type: 'component_assumption_set_snapshot',
      schema_version: '1.0',
      workflow_run_id: run.id,
      phase_id: '4',
      sub_phase_id: 'component_saturation',
      produced_by_agent_role: 'domain_interpreter',
      janumicode_version_sha: 'dev',
      derived_from_record_ids: [],
      content: {
        kind: 'component_assumption_set_snapshot',
        pass_number: 2,
        root_component_id: '*',
        assumptions,
        delta_from_previous_pass: 2,
        semantic_delta: 2,
      } satisfies ComponentAssumptionSetSnapshotContent,
    });

    // Single pipeline record — start == latest; carries passes[].
    const pipelineRec = engine.writer.writeRecord({
      record_type: 'component_decomposition_pipeline',
      schema_version: '1.0',
      workflow_run_id: run.id,
      phase_id: '4',
      sub_phase_id: 'component_saturation',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: 'dev',
      derived_from_record_ids: [],
      content: {
        kind: 'component_decomposition_pipeline',
        pipeline_id: pipelineId,
        root_component_id: '*',
        passes: [
          { pass_number: 1, status: 'completed', started_at: '2026-01-01T00:00:00.000Z', completed_at: '2026-01-01T00:01:00.000Z', nodes_produced: 2, assumption_delta: 2 },
          { pass_number: 2, status: 'completed', started_at: '2026-01-01T00:02:00.000Z', completed_at: '2026-01-01T00:03:00.000Z', nodes_produced: 1, assumption_delta: 0 },
        ],
      } satisfies ComponentDecompositionPipelineContent,
    });

    const ctx = { engine, workflowRun: { id: run.id } as Ctx['workflowRun'] };
    const state = rebuildComponentSaturationStateFromStream(ctx, CONFIG, pipelineId);

    expect(state).not.toBeNull();
    const s = state!;

    // Queue — only the two pending nodes; atomic child excluded.
    expect(s.queue).toHaveLength(2);
    expect(s.queue.find(q => q.nodeId === 'n-childD')).toBeUndefined();

    const rootEntry = s.queue.find(q => q.nodeId === 'n-root')!;
    expect(rootEntry).toBeDefined();
    expect(rootEntry.tierHint).toBe('root');
    expect(rootEntry.depth).toBe(0);
    expect(rootEntry.parentNodeId).toBeNull();
    expect(rootEntry.rootComponentId).toBe('n-root');
    expect(rootEntry.displayKey).toBe('comp-root');
    expect(rootEntry.parentRecordId).toBe(rootRecId);
    expect(rootEntry.activeConstraints).toEqual(['TECH-BUN-1']);

    const childBEntry = s.queue.find(q => q.nodeId === 'n-childB')!;
    expect(childBEntry).toBeDefined();
    expect(childBEntry.tierHint).toBe('B');
    expect(childBEntry.depth).toBe(1);
    expect(childBEntry.parentNodeId).toBe('n-root');
    expect(childBEntry.activeConstraints).toEqual([]);

    // Sibling map — root under null, both children under n-root (order preserved).
    expect(s.siblingsByParent.get(null)?.map(c => c.id)).toEqual(['comp-root']);
    expect(s.siblingsByParent.get('n-root')?.map(c => c.id)).toEqual(['comp-child-b', 'comp-child-d']);

    // Depth + pass.
    expect(s.maxDepthReached).toBe(1);
    expect(s.passNumber).toBe(2);

    // Assumptions + next-seq (max of CA-0003 / CA-0001).
    expect(s.allAssumptions).toHaveLength(2);
    expect(s.allAssumptions.map(a => a.id)).toEqual(['CA-0003', 'CA-0001']);
    expect(s.assumptionSeq).toBe(3);

    // Pipeline identities + passes.
    expect(s.pipelinePasses).toHaveLength(2);
    expect(s.pipelinePasses.map(p => p.pass_number)).toEqual([1, 2]);
    expect(s.pipelineStartRecord.id).toBe(pipelineRec.id);
    expect(s.currentPipelineRecordId).toBe(pipelineRec.id);
  });
});
