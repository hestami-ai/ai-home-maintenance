/**
 * Characterization test — rebuildDataModelSaturationStateFromStream.
 *
 * Pins the CURRENT observable contract of the Phase 5.1a resume rebuilder:
 * given a persisted decomposition stream (nodes + assumption snapshots +
 * pipeline records), it reconstructs the saturation-loop resume state.
 *
 * The existing runDataModelSaturationLoop tests only exercise this function
 * on a FRESH run, where it short-circuits to null via the empty-pipeline
 * path — so the non-null resume reconstruction (queue, siblings, assumption
 * sequence, pipeline anchor/head) was previously unexercised. Added while
 * decomposing the function to reduce S3776 cognitive complexity.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createTestDatabase, type Database } from '../../../../lib/database/init';
import { ConfigManager } from '../../../../lib/config/configManager';
import { OrchestratorEngine } from '../../../../lib/orchestrator/orchestratorEngine';
import {
  rebuildDataModelSaturationStateFromStream,
  type DataModelSaturationConfig,
} from '../../../../lib/orchestrator/phases/phase5_1a';
import type {
  DecompositionEntity,
  DecompositionTier,
  DecompositionNodeStatus,
  DataModelDecompositionNodeContent,
  DataModelAssumptionEntry,
  DataModelAssumptionSetSnapshotContent,
  DataModelDecompositionPipelineContent,
} from '../../../../lib/types/records';

const extensionPath = path.resolve(__dirname, '..', '..', '..', '..', '..');
const workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'jc-p5-resume-ws-'));

const CONFIG: DataModelSaturationConfig = {
  recordSubPhaseId: 'data_model_saturation',
  templateSubPhase: 'data_model_saturation',
  gateSurfacePrefix: 'data-model-gate-',
};

function entity(id: string, componentId: string, activeConstraints?: string[]): DecompositionEntity {
  const e: Record<string, unknown> = {
    id,
    name: `Entity ${id}`,
    kind: 'entity',
    component_id: componentId,
    fields: [{ name: 'id', type: 'uuid', is_identity: true }],
    relationships: [],
    traces_to: [],
  };
  // Only set active_constraints when supplied so the `?? []` fallback path is
  // genuinely exercised (an omitted field is undefined, not []).
  if (activeConstraints !== undefined) e.active_constraints = activeConstraints;
  return e as unknown as DecompositionEntity;
}

function seedNode(
  engine: OrchestratorEngine,
  runId: string,
  opts: {
    nodeId: string;
    parentNodeId: string | null;
    depth: number;
    status: DecompositionNodeStatus;
    entity: DecompositionEntity;
    tier?: DecompositionTier;
    rootEntityId?: string;
    displayKey?: string;
  },
): string {
  const rec = engine.writer.writeRecord({
    record_type: 'data_model_decomposition_node',
    schema_version: '1.0',
    workflow_run_id: runId,
    phase_id: '5',
    sub_phase_id: 'data_model_saturation',
    produced_by_agent_role: 'technical_spec_agent',
    janumicode_version_sha: 'dev',
    derived_from_record_ids: [],
    content: {
      kind: 'data_model_decomposition_node',
      node_id: opts.nodeId,
      parent_node_id: opts.parentNodeId,
      display_key: opts.displayKey ?? opts.entity.id,
      root_entity_id: opts.rootEntityId ?? opts.nodeId,
      depth: opts.depth,
      pass_number: 0,
      status: opts.status,
      tier: opts.tier,
      entity: opts.entity,
      surfaced_assumption_ids: [],
      release_id: null,
      release_ordinal: null,
    } as unknown as DataModelDecompositionNodeContent,
  });
  return rec.id;
}

function assumption(id: string): DataModelAssumptionEntry {
  return {
    id,
    text: `assumption ${id}`,
    source: 'decomposition',
    surfaced_at_pass: 1,
    category: 'open_question',
  } as unknown as DataModelAssumptionEntry;
}

function seedSnapshot(
  engine: OrchestratorEngine,
  runId: string,
  passNumber: number,
  assumptions: DataModelAssumptionEntry[],
): void {
  engine.writer.writeRecord({
    record_type: 'data_model_assumption_set_snapshot',
    schema_version: '1.0',
    workflow_run_id: runId,
    phase_id: '5',
    sub_phase_id: 'data_model_saturation',
    produced_by_agent_role: 'technical_spec_agent',
    janumicode_version_sha: 'dev',
    derived_from_record_ids: [],
    content: {
      kind: 'data_model_assumption_set_snapshot',
      pass_number: passNumber,
      root_entity_id: '*',
      assumptions,
      delta_from_previous_pass: assumptions.length,
    } as unknown as DataModelAssumptionSetSnapshotContent,
  });
}

function seedPipeline(
  engine: OrchestratorEngine,
  runId: string,
  pipelineId: string,
  passCount: number,
): string {
  const passes = Array.from({ length: passCount }, (_, i) => ({
    pass_number: i + 1,
    status: 'completed',
    started_at: null,
    completed_at: null,
    nodes_produced: i + 1,
    assumption_delta: 0,
  }));
  const rec = engine.writer.writeRecord({
    record_type: 'data_model_decomposition_pipeline',
    schema_version: '1.0',
    workflow_run_id: runId,
    phase_id: '5',
    sub_phase_id: 'data_model_saturation',
    produced_by_agent_role: 'orchestrator',
    janumicode_version_sha: 'dev',
    derived_from_record_ids: [],
    content: {
      kind: 'data_model_decomposition_pipeline',
      pipeline_id: pipelineId,
      root_entity_id: '*',
      passes,
    } as unknown as DataModelDecompositionPipelineContent,
  });
  return rec.id;
}

describe('rebuildDataModelSaturationStateFromStream — resume reconstruction', () => {
  let db: Database;
  let engine: OrchestratorEngine;

  beforeEach(() => {
    db = createTestDatabase();
    engine = new OrchestratorEngine(db, new ConfigManager(), workspacePath, extensionPath);
  });
  afterEach(() => { db.close(); });

  function ctxFor(runId: string): Parameters<typeof rebuildDataModelSaturationStateFromStream>[0] {
    return { engine, workflowRun: { id: runId } } as unknown as
      Parameters<typeof rebuildDataModelSaturationStateFromStream>[0];
  }

  it('reconstructs queue, siblings, assumptions and pipeline anchors from the stream', async () => {
    const { run } = engine.startWorkflowRun('ws', 'test');

    // Nodes: one pending root, two pending children (one with a tier hint, one
    // without → falls back to 'A'), and one non-pending (decomposed) child that
    // still contributes to the sibling index and sets the max depth.
    const rootRecId = seedNode(engine, run.id, {
      nodeId: 'na', parentNodeId: null, depth: 0, status: 'pending',
      entity: entity('dm-a', 'comp-a', ['TECH-1']), rootEntityId: 'na', displayKey: 'dm-a',
    });
    seedNode(engine, run.id, {
      nodeId: 'nb', parentNodeId: 'na', depth: 1, status: 'pending', tier: 'C',
      entity: entity('dm-b', 'comp-a', ['TECH-2']), rootEntityId: 'na',
    });
    seedNode(engine, run.id, {
      nodeId: 'nd', parentNodeId: 'na', depth: 1, status: 'pending', // no tier
      entity: entity('dm-d', 'comp-a'), rootEntityId: 'na',
    });
    seedNode(engine, run.id, {
      nodeId: 'nc', parentNodeId: 'na', depth: 2, status: 'decomposed', tier: 'A',
      entity: entity('dm-c', 'comp-a'), rootEntityId: 'na',
    });

    // Assumption snapshots: latest pass wins; DA-#### ids drive the sequence.
    seedSnapshot(engine, run.id, 1, [assumption('DA-0001'), assumption('DA-0003')]);
    seedSnapshot(engine, run.id, 2, [
      assumption('DA-0001'), assumption('DA-0003'), assumption('DA-0005'), assumption('X-bad'),
    ]);

    // Two pipeline records for the active id (later one = head) + one decoy id.
    const pipeStartId = seedPipeline(engine, run.id, 'pipe-1', 1);
    await new Promise(res => setTimeout(res, 5));
    const pipeHeadId = seedPipeline(engine, run.id, 'pipe-1', 2);
    await new Promise(res => setTimeout(res, 5));
    seedPipeline(engine, run.id, 'pipe-other', 3);

    const state = rebuildDataModelSaturationStateFromStream(ctxFor(run.id), CONFIG, 'pipe-1');
    expect(state).not.toBeNull();

    // Queue — only the three pending nodes re-enter, decomposed 'nc' is excluded.
    expect(state!.queue.map(q => q.nodeId).sort()).toEqual(['na', 'nb', 'nd']);

    const qa = state!.queue.find(q => q.nodeId === 'na')!;
    expect(qa.tierHint).toBe('root');
    expect(qa.depth).toBe(0);
    expect(qa.parentNodeId).toBeNull();
    expect(qa.parentRecordId).toBe(rootRecId);
    expect(qa.rootEntityId).toBe('na');
    expect(qa.displayKey).toBe('dm-a');
    expect(qa.activeConstraints).toEqual(['TECH-1']);

    const qb = state!.queue.find(q => q.nodeId === 'nb')!;
    expect(qb.tierHint).toBe('C');
    expect(qb.depth).toBe(1);

    const qd = state!.queue.find(q => q.nodeId === 'nd')!;
    expect(qd.tierHint).toBe('A'); // tier omitted → '?? A' fallback
    expect(qd.activeConstraints).toEqual([]); // entity.active_constraints undefined → '?? []'

    // Siblings — grouped by parent_node_id, every node (incl. decomposed) counts.
    expect(state!.siblingsByParent.get(null)!.map(e => e.id)).toEqual(['dm-a']);
    expect(state!.siblingsByParent.get('na')!.map(e => e.id).sort())
      .toEqual(['dm-b', 'dm-c', 'dm-d']);

    // Max depth reached — from the decomposed depth-2 node.
    expect(state!.maxDepthReached).toBe(2);

    // Assumptions — latest snapshot pass wins; sequence = highest DA-#### number.
    expect(state!.passNumber).toBe(2);
    expect(state!.allAssumptions.map(a => a.id)).toEqual(['DA-0001', 'DA-0003', 'DA-0005', 'X-bad']);
    expect(state!.assumptionSeq).toBe(5);

    // Pipeline — earliest record is the anchor, latest is the head, head passes surface.
    expect(state!.pipelineStartRecord.id).toBe(pipeStartId);
    expect(state!.currentPipelineRecordId).toBe(pipeHeadId);
    expect(state!.pipelinePasses.map(p => p.pass_number)).toEqual([1, 2]);
  });

  it('returns null when there are no decomposition nodes', () => {
    const { run } = engine.startWorkflowRun('ws', 'test');
    expect(rebuildDataModelSaturationStateFromStream(ctxFor(run.id), CONFIG, 'pipe-1')).toBeNull();
  });

  it('returns null when no pipeline records match the pipeline_id', () => {
    const { run } = engine.startWorkflowRun('ws', 'test');
    seedNode(engine, run.id, {
      nodeId: 'na', parentNodeId: null, depth: 0, status: 'pending',
      entity: entity('dm-a', 'comp-a'), rootEntityId: 'na',
    });
    seedPipeline(engine, run.id, 'pipe-1', 1);
    // Ask for a different pipeline id → filtered set is empty → null.
    expect(rebuildDataModelSaturationStateFromStream(ctxFor(run.id), CONFIG, 'no-such-pipe')).toBeNull();
  });
});
