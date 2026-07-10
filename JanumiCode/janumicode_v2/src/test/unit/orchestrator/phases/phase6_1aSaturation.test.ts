/**
 * Wave 8 — integration tests for runTaskSaturationLoop.
 *
 * Mirrors phase4_2aSaturation.test.ts patterns, adapted for tasks.
 * Covers the load-bearing guarantees:
 *   - Pass-1 produces Tier-D atomic children that terminate the branch.
 *   - Tier-B children fire the mirror gate (Promise.all batch).
 *   - depth_cap trips writes status='deferred' rows.
 *   - Per-run telemetry is persisted to workflow_runs columns.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createTestDatabase, type Database } from '../../../../lib/database/init';
import { ConfigManager } from '../../../../lib/config/configManager';
import { OrchestratorEngine } from '../../../../lib/orchestrator/orchestratorEngine';
import {
  runTaskSaturationLoop,
  rebuildTaskSaturationStateFromStream,
  type TaskSaturationConfig,
} from '../../../../lib/orchestrator/phases/phase6_1a';
import { MockLLMProvider } from '../../../helpers/mockLLMProvider';
import type {
  DecompositionTask,
  TaskDecompositionNodeContent,
  TaskDecompositionPipelineContent,
  TaskAssumptionSetSnapshotContent,
  TaskAssumptionEntry,
  DecompositionPassEntry,
} from '../../../../lib/types/records';

const extensionPath = path.resolve(__dirname, '..', '..', '..', '..', '..');
const workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'jc-test-ws-'));

function seedRootNode(
  engine: OrchestratorEngine,
  runId: string,
  task: DecompositionTask,
): { recordId: string; logicalNodeId: string } {
  const logicalNodeId = `root-${task.id}-uuid`;
  const rec = engine.writer.writeRecord({
    record_type: 'task_decomposition_node',
    schema_version: '1.0',
    workflow_run_id: runId,
    phase_id: '6',
    sub_phase_id: '6.1a',
    produced_by_agent_role: 'implementation_planner',
    janumicode_version_sha: 'dev',
    derived_from_record_ids: [],
    content: {
      kind: 'task_decomposition_node',
      node_id: logicalNodeId,
      parent_node_id: null,
      display_key: task.id,
      root_task_id: logicalNodeId,
      depth: 0,
      pass_number: 0,
      status: 'pending',
      task,
      surfaced_assumption_ids: [],
      release_id: null,
      release_ordinal: null,
    } satisfies TaskDecompositionNodeContent,
  });
  return { recordId: rec.id, logicalNodeId };
}

describe('runTaskSaturationLoop — Wave 8 saturation', () => {
  let db: Database;
  let engine: OrchestratorEngine;

  beforeEach(() => {
    db = createTestDatabase();
    const configManager = new ConfigManager();
    engine = new OrchestratorEngine(db, configManager, workspacePath, extensionPath);
    engine.setAutoApproveDecisions(true);
  });

  afterEach(() => { db.close(); });

  function configureMock(mock: MockLLMProvider): void {
    engine.llmCaller.registerProvider(mock.bindAsProvider('llamacpp'));
    engine.configManager.setRequirementsAgentRouting({
      primary: { backing_tool: 'direct_llm_api', provider: 'llamacpp', model: 'qwen3.5:9b' },
      temperature: 0.4,
    });
  }

  function tinyTask(id: string): DecompositionTask {
    return {
      id, name: id,
      description: `Implement ${id}`,
      component_id: 'comp-x',
      component_responsibility: 'do work',
      backing_tool: 'claude_code_cli',
      estimated_complexity: 'medium',
      completion_criteria: [{ criterion_id: `cc-${id}-1`, description: `${id} works` }],
    };
  }

  it('Pass-1 — produces Tier-D atomic children; saturation terminates cleanly', async () => {
    const mock = new MockLLMProvider();
    mock.setFixture('decompose-root', {
      match: 'task-root',
      parsedJson: {
        parent_branch_classification: 'decomposable',
        parent_tier_assessment: { tier: 'A', agrees_with_hint: true, rationale: 'epic' },
        children: [
          {
            id: 'task-leaf-1', tier: 'D', name: 'Leaf 1',
            description: 'Implement leaf 1',
            component_id: 'comp-x',
            component_responsibility: 'do work',
            backing_tool: 'claude_code_cli',
            estimated_complexity: 'medium',
            completion_criteria: [{ criterion_id: 'cc-1', description: 'leaf 1 done' }],
            decomposition_rationale: 'single session',
          },
          {
            id: 'task-leaf-2', tier: 'D', name: 'Leaf 2',
            description: 'Implement leaf 2',
            component_id: 'comp-x',
            component_responsibility: 'do work',
            completion_criteria: [{ criterion_id: 'cc-2', description: 'leaf 2 done' }],
          },
        ],
        surfaced_assumptions: [
          { text: 'Leaf 1 uses local cache', category: 'implementation_choice' },
          { text: 'Leaf 2 commits before responding', category: 'sequencing' },
        ],
      },
    });
    configureMock(mock);

    const { run } = engine.startWorkflowRun('ws', 'test');
    const root = tinyTask('task-root');
    const seeded = seedRootNode(engine, run.id, root);

    await runTaskSaturationLoop(
      { engine, workflowRun: { id: run.id } as Parameters<typeof runTaskSaturationLoop>[0]['workflowRun'] },
      {
        technicalConstraints: [],
        componentSummary: 'comp-x: Component X',
        rootTasks: [root],
        rootNodeRecordIds: [seeded.recordId],
        rootLogicalIds: [seeded.logicalNodeId],
      },
    );

    const nodes = engine.writer.getRecordsByType(run.id, 'task_decomposition_node');
    const children = nodes.filter(n =>
      (n.content as unknown as TaskDecompositionNodeContent).depth === 1);
    expect(children).toHaveLength(2);
    expect(children.every(c => (c.content as unknown as TaskDecompositionNodeContent).tier === 'D')).toBe(true);
    expect(children.every(c => (c.content as unknown as TaskDecompositionNodeContent).status === 'atomic')).toBe(true);

    const pipelines = engine.writer.getRecordsByType(run.id, 'task_decomposition_pipeline');
    expect(pipelines.length).toBeGreaterThan(0);
    const latestPipeline = pipelines.reduce((latest, r) =>
      r.produced_at > latest.produced_at ? r : latest, pipelines[0]);
    const pc = latestPipeline.content as unknown as TaskDecompositionPipelineContent;
    expect(pc.passes.length).toBeGreaterThan(0);
    expect(pc.final_leaf_count).toBe(2);
    expect(pc.tier_distribution?.D).toBe(2);

    const snapshots = engine.writer.getRecordsByType(run.id, 'task_assumption_set_snapshot');
    expect(snapshots).toHaveLength(1);
    const snap = snapshots[0].content as unknown as TaskAssumptionSetSnapshotContent;
    expect(snap.assumptions).toHaveLength(2);
    expect(snap.delta_from_previous_pass).toBe(2);
  });

  it('PA-1 — task_saturation prompt is scoped: own-component context, id-only depth-0, same-component root siblings', async () => {
    const mock = new MockLLMProvider();
    // Atomic response for every root → one call each, branch terminates; we assert on the captured prompts.
    mock.setFixture('atomic', {
      match: 'task-',
      parsedJson: {
        parent_branch_classification: 'atomic_unit',
        parent_tier_assessment: { tier: 'D', agrees_with_hint: true, rationale: 'atomic' },
        children: [],
        surfaced_assumptions: [],
      },
    });
    configureMock(mock);

    const { run } = engine.startWorkflowRun('ws', 'test');
    const rootA: DecompositionTask = { ...tinyTask('task-a-root'), component_id: 'comp-a' };
    const rootB: DecompositionTask = { ...tinyTask('task-b-root'), component_id: 'comp-b' };
    const sa = seedRootNode(engine, run.id, rootA);
    const sb = seedRootNode(engine, run.id, rootB);

    await runTaskSaturationLoop(
      { engine, workflowRun: { id: run.id } as Parameters<typeof runTaskSaturationLoop>[0]['workflowRun'] },
      {
        technicalConstraints: [],
        componentSummary: 'FULL-MODEL-SUMMARY (comp-a and comp-b together)',
        componentSummaryById: {
          'comp-a': 'SCOPED-COMPONENT-A-ONLY',
          'comp-b': 'SCOPED-COMPONENT-B-ONLY',
        },
        rootTasks: [rootA, rootB],
        rootNodeRecordIds: [sa.recordId, sb.recordId],
        rootLogicalIds: [sa.logicalNodeId, sb.logicalNodeId],
      },
    );

    const prompts = mock.getCallLog().map(c => c.options.prompt ?? '');
    const promptA = prompts.find(p => p.includes('SCOPED-COMPONENT-A-ONLY'));
    expect(promptA, 'a task_saturation prompt scoped to comp-a should exist').toBeDefined();

    // (1) component_context is scoped to the task's OWN component — not the other component, not the full model.
    expect(promptA!).not.toContain('SCOPED-COMPONENT-B-ONLY');
    expect(promptA!).not.toContain('FULL-MODEL-SUMMARY');

    // (2) depth_zero_tasks is a compact id-only comma list (not `- id: name` bullets / ~33KB roster).
    expect(promptA!).toContain('task-a-root, task-b-root');

    // (3) root-node sibling_context is scoped to the same component → comp-a root has no same-component siblings,
    //     and the cross-component root must NOT be injected as a sibling bullet.
    expect(promptA!).toContain('(none — sole child under this parent)');
    expect(promptA!).not.toContain('- task-b-root: task-b-root');
  });

  it('Tier-B children fire mirror gate; auto-accept queues for Tier-C decomposition', async () => {
    const mock = new MockLLMProvider();
    mock.setFixture('decompose-root', {
      match: 'task-root',
      parsedJson: {
        parent_branch_classification: 'decomposable',
        parent_tier_assessment: { tier: 'A', agrees_with_hint: true, rationale: 'epic' },
        children: [
          {
            id: 'task-story', tier: 'B', name: 'Story',
            description: 'Story-level commitment',
            component_id: 'comp-x',
            component_responsibility: 'do work',
            completion_criteria: [{ criterion_id: 'cc-s', description: 'commitment met' }],
          },
        ],
        surfaced_assumptions: [],
      },
    });
    mock.setFixture('decompose-tier-b', {
      match: 'task-story',
      parsedJson: {
        parent_branch_classification: 'decomposable',
        parent_tier_assessment: { tier: 'B', agrees_with_hint: true, rationale: 'commitment' },
        children: [
          {
            id: 'task-leaf', tier: 'D', name: 'Leaf',
            description: 'leaf work',
            component_id: 'comp-x',
            component_responsibility: 'do work',
            completion_criteria: [{ criterion_id: 'cc-l', description: 'done' }],
          },
        ],
        surfaced_assumptions: [],
      },
    });
    configureMock(mock);

    const { run } = engine.startWorkflowRun('ws', 'test');
    const root = tinyTask('task-root');
    const seeded = seedRootNode(engine, run.id, root);

    await runTaskSaturationLoop(
      { engine, workflowRun: { id: run.id } as Parameters<typeof runTaskSaturationLoop>[0]['workflowRun'] },
      {
        technicalConstraints: [],
        componentSummary: 'comp-x: Component X',
        rootTasks: [root],
        rootNodeRecordIds: [seeded.recordId],
        rootLogicalIds: [seeded.logicalNodeId],
      },
    );

    const bundles = engine.writer.getRecordsByType(run.id, 'decision_bundle_presented');
    expect(bundles.length).toBeGreaterThanOrEqual(1);
    const bundleContent = bundles[0].content as Record<string, unknown>;
    expect(bundleContent.bundle_id).toMatch(/^task-decomp-gate-/);

    const nodes = engine.writer.getRecordsByType(run.id, 'task_decomposition_node', false);
    const latestByNodeId = new Map<string, typeof nodes[number]>();
    for (const r of nodes) {
      const c = r.content as unknown as TaskDecompositionNodeContent;
      const prior = latestByNodeId.get(c.node_id);
      if (!prior || r.produced_at > prior.produced_at) latestByNodeId.set(c.node_id, r);
    }
    const latest = [...latestByNodeId.values()].map(r => r.content as unknown as TaskDecompositionNodeContent);
    const tierDLeaf = latest.find(c => c.display_key === 'task-leaf');
    expect(tierDLeaf, 'Tier-B child should have decomposed into a Tier-D leaf after auto-accept').toBeDefined();
    expect(tierDLeaf!.tier).toBe('D');
    expect(tierDLeaf!.status).toBe('atomic');
  });

  it('depth_cap trips deferred status when configured low', async () => {
    engine.configManager.get().decomposition.task_depth_cap = 1;

    const mock = new MockLLMProvider();
    mock.setFixture('decompose-root', {
      match: 'task-root',
      parsedJson: {
        parent_branch_classification: 'decomposable',
        parent_tier_assessment: { tier: 'A', agrees_with_hint: true, rationale: 'epic' },
        children: [
          {
            id: 'task-tier-a', tier: 'A', name: 'Tier A child',
            description: 'still recursive',
            component_id: 'comp-x',
            component_responsibility: 'do work',
            completion_criteria: [{ criterion_id: 'cc-a', description: 'recursive' }],
          },
        ],
        surfaced_assumptions: [],
      },
    });
    configureMock(mock);

    const { run } = engine.startWorkflowRun('ws', 'test');
    const root = tinyTask('task-root');
    const seeded = seedRootNode(engine, run.id, root);

    await runTaskSaturationLoop(
      { engine, workflowRun: { id: run.id } as Parameters<typeof runTaskSaturationLoop>[0]['workflowRun'] },
      {
        technicalConstraints: [],
        componentSummary: '',
        rootTasks: [root],
        rootNodeRecordIds: [seeded.recordId],
        rootLogicalIds: [seeded.logicalNodeId],
      },
    );

    const nodes = engine.writer.getRecordsByType(
      run.id, 'task_decomposition_node', false,
    );
    const latestByNodeId = new Map<string, typeof nodes[number]>();
    for (const r of nodes) {
      const c = r.content as unknown as TaskDecompositionNodeContent;
      const prior = latestByNodeId.get(c.node_id);
      if (!prior || r.produced_at > prior.produced_at) latestByNodeId.set(c.node_id, r);
    }
    const tierAChild = [...latestByNodeId.values()].find(r =>
      (r.content as unknown as TaskDecompositionNodeContent).display_key === 'task-tier-a');
    expect(tierAChild).toBeDefined();
    expect((tierAChild!.content as unknown as TaskDecompositionNodeContent).status).toBe('deferred');
    expect((tierAChild!.content as unknown as TaskDecompositionNodeContent).pruning_reason).toContain('depth_cap_reached');
  });

  it('persists per-run telemetry to workflow_runs columns', async () => {
    const mock = new MockLLMProvider();
    mock.setFixture('decompose-root', {
      match: 'task-root',
      parsedJson: {
        parent_branch_classification: 'decomposable',
        parent_tier_assessment: { tier: 'A', agrees_with_hint: true, rationale: 'epic' },
        children: [
          {
            id: 'task-leaf', tier: 'D', name: 'Leaf',
            description: 'leaf work',
            component_id: 'comp-x',
            component_responsibility: 'do work',
            completion_criteria: [{ criterion_id: 'cc', description: 'done' }],
          },
        ],
        surfaced_assumptions: [],
      },
    });
    configureMock(mock);

    const { run } = engine.startWorkflowRun('ws', 'test');
    const root = tinyTask('task-root');
    const seeded = seedRootNode(engine, run.id, root);

    await runTaskSaturationLoop(
      { engine, workflowRun: { id: run.id } as Parameters<typeof runTaskSaturationLoop>[0]['workflowRun'] },
      {
        technicalConstraints: [],
        componentSummary: '',
        rootTasks: [root],
        rootNodeRecordIds: [seeded.recordId],
        rootLogicalIds: [seeded.logicalNodeId],
      },
    );

    const row = db.prepare(`
      SELECT task_decomposition_budget_calls_used, task_decomposition_max_depth_reached, active_task_pipeline_id
      FROM workflow_runs WHERE id = ?
    `).get(run.id) as {
      task_decomposition_budget_calls_used: number;
      task_decomposition_max_depth_reached: number;
      active_task_pipeline_id: string | null;
    };
    expect(row.task_decomposition_budget_calls_used).toBeGreaterThanOrEqual(1);
    expect(row.task_decomposition_max_depth_reached).toBe(1);
    expect(row.active_task_pipeline_id).toMatch(/^task-decomp-pipe-/);
  });
});

// Characterization: pins the current observable behavior of the exported
// resume-state reconstructor. The runTaskSaturationLoop tests above only ever
// hit the early `return null` path (no prior pipeline record exists on a fresh
// run), so the non-null resume reconstruction was previously unexercised.
describe('rebuildTaskSaturationStateFromStream — resume state reconstruction', () => {
  let db: Database;
  let engine: OrchestratorEngine;

  const config: TaskSaturationConfig = {
    recordSubPhaseId: 'task_saturation',
    templateSubPhase: 'task_saturation',
    gateSurfacePrefix: 'task-decomp-gate-',
  };

  beforeEach(() => {
    db = createTestDatabase();
    const configManager = new ConfigManager();
    engine = new OrchestratorEngine(db, configManager, workspacePath, extensionPath);
  });

  afterEach(() => { db.close(); });

  function ctxFor(runId: string) {
    return {
      engine,
      workflowRun: { id: runId } as
        Parameters<typeof rebuildTaskSaturationStateFromStream>[0]['workflowRun'],
    };
  }

  function task(id: string, activeConstraints?: string[]): DecompositionTask {
    const t: DecompositionTask = {
      id, name: id, description: `Implement ${id}`,
      component_id: 'comp-x', component_responsibility: 'do work',
      estimated_complexity: 'medium',
      completion_criteria: [{ criterion_id: `cc-${id}`, description: `${id} works` }],
    };
    if (activeConstraints) t.active_constraints = activeConstraints;
    return t;
  }

  function writeNode(runId: string, content: TaskDecompositionNodeContent): string {
    return engine.writer.writeRecord({
      record_type: 'task_decomposition_node',
      schema_version: '1.0',
      workflow_run_id: runId,
      phase_id: '6',
      sub_phase_id: 'task_saturation',
      produced_by_agent_role: 'implementation_planner',
      janumicode_version_sha: 'dev',
      derived_from_record_ids: [],
      content,
    }).id;
  }

  function writeSnapshot(runId: string, content: TaskAssumptionSetSnapshotContent): string {
    return engine.writer.writeRecord({
      record_type: 'task_assumption_set_snapshot',
      schema_version: '1.0',
      workflow_run_id: runId,
      phase_id: '6',
      sub_phase_id: 'task_saturation',
      produced_by_agent_role: 'implementation_planner',
      janumicode_version_sha: 'dev',
      derived_from_record_ids: [],
      content,
    }).id;
  }

  function writePipeline(runId: string, content: TaskDecompositionPipelineContent): string {
    return engine.writer.writeRecord({
      record_type: 'task_decomposition_pipeline',
      schema_version: '1.0',
      workflow_run_id: runId,
      phase_id: '6',
      sub_phase_id: 'task_saturation',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: 'dev',
      derived_from_record_ids: [],
      content,
    }).id;
  }

  it('returns null when no task_decomposition_node records exist', () => {
    const { run } = engine.startWorkflowRun('ws', 'test');
    expect(rebuildTaskSaturationStateFromStream(ctxFor(run.id), config, 'pipe-x')).toBeNull();
  });

  it('returns null when nodes exist but no pipeline record matches the pipeline id', () => {
    const { run } = engine.startWorkflowRun('ws', 'test');
    writeNode(run.id, {
      kind: 'task_decomposition_node',
      node_id: 'nR', parent_node_id: null, display_key: 'task-r',
      root_task_id: 'nR', depth: 0, pass_number: 0, status: 'pending',
      task: task('task-r'), surfaced_assumption_ids: [],
      release_id: null, release_ordinal: null,
    });
    // A pipeline record exists but with a different id → filtered out → null.
    writePipeline(run.id, {
      kind: 'task_decomposition_pipeline', pipeline_id: 'other-pipe',
      root_task_id: '*', passes: [],
    });
    expect(rebuildTaskSaturationStateFromStream(ctxFor(run.id), config, 'pipe-x')).toBeNull();
  });

  it('reconstructs queue, siblings, assumptions, seq, and pipeline bounds', () => {
    const { run } = engine.startWorkflowRun('ws', 'test');

    // depth-0 pending root (tierHint → 'root'), one pending Tier-C child,
    // one already-decomposed child (excluded from queue but present as sibling),
    // and one pending child with no tier (tierHint falls back to 'A').
    writeNode(run.id, {
      kind: 'task_decomposition_node',
      node_id: 'nR', parent_node_id: null, display_key: 'task-r',
      root_task_id: 'nR', depth: 0, pass_number: 0, status: 'pending',
      task: task('task-r', ['TECH-1']), surfaced_assumption_ids: [],
      release_id: null, release_ordinal: null,
    });
    writeNode(run.id, {
      kind: 'task_decomposition_node',
      node_id: 'nC1', parent_node_id: 'nR', display_key: 'task-c1',
      root_task_id: 'nR', depth: 1, pass_number: 1, status: 'pending', tier: 'C',
      task: task('task-c1'), surfaced_assumption_ids: [],
      release_id: 'rel-1', release_ordinal: 2,
    });
    writeNode(run.id, {
      kind: 'task_decomposition_node',
      node_id: 'nC2', parent_node_id: 'nR', display_key: 'task-c2',
      root_task_id: 'nR', depth: 1, pass_number: 1, status: 'decomposed', tier: 'A',
      task: task('task-c2'), surfaced_assumption_ids: [],
      release_id: null, release_ordinal: null,
    });
    writeNode(run.id, {
      kind: 'task_decomposition_node',
      node_id: 'nC3', parent_node_id: 'nR', display_key: 'task-c3',
      root_task_id: 'nR', depth: 1, pass_number: 1, status: 'pending',
      task: task('task-c3'), surfaced_assumption_ids: [],
      release_id: null, release_ordinal: null,
    });

    const mkAssumption = (id: string, pass: number): TaskAssumptionEntry => ({
      id, text: `assumption ${id}`, source: 'decomposition',
      surfaced_at_pass: pass, category: 'implementation_choice',
    });
    // Two snapshots; the highest pass_number wins regardless of write order.
    writeSnapshot(run.id, {
      kind: 'task_assumption_set_snapshot', pass_number: 1, root_task_id: '*',
      assumptions: [mkAssumption('TA-0003', 1)], delta_from_previous_pass: 1,
    });
    writeSnapshot(run.id, {
      kind: 'task_assumption_set_snapshot', pass_number: 2, root_task_id: '*',
      assumptions: [
        mkAssumption('TA-0003', 1),
        mkAssumption('TA-0007', 2),
        mkAssumption('X-99', 2), // non-TA id → ignored by seq computation
      ],
      delta_from_previous_pass: 2,
    });

    const passEntry = (n: number): DecompositionPassEntry => ({
      pass_number: n, status: 'completed', started_at: null, completed_at: null,
      nodes_produced: n, assumption_delta: n,
    });
    // Non-matching pipeline (filtered out) + the matching pipeline record.
    writePipeline(run.id, {
      kind: 'task_decomposition_pipeline', pipeline_id: 'other-pipe',
      root_task_id: '*', passes: [passEntry(9)],
    });
    const matchingId = writePipeline(run.id, {
      kind: 'task_decomposition_pipeline', pipeline_id: 'pipe-x',
      root_task_id: '*', passes: [passEntry(1), passEntry(2)],
    });

    const state = rebuildTaskSaturationStateFromStream(ctxFor(run.id), config, 'pipe-x');
    expect(state).not.toBeNull();

    // Queue: only the three pending nodes.
    expect(state!.queue).toHaveLength(3);
    const qR = state!.queue.find(q => q.nodeId === 'nR')!;
    const qC1 = state!.queue.find(q => q.nodeId === 'nC1')!;
    const qC3 = state!.queue.find(q => q.nodeId === 'nC3')!;
    expect(qR.tierHint).toBe('root');               // depth 0
    expect(qR.activeConstraints).toEqual(['TECH-1']);
    expect(qC1.tierHint).toBe('C');                 // explicit tier
    expect(qC1.releaseId).toBe('rel-1');
    expect(qC1.releaseOrdinal).toBe(2);
    expect(qC3.tierHint).toBe('A');                 // no tier → fallback 'A'
    // The decomposed child is not queued.
    expect(state!.queue.find(q => q.nodeId === 'nC2')).toBeUndefined();

    // Siblings: root under null; all three children under 'nR' regardless of status.
    expect(state!.siblingsByParent.get(null)!.map(t => t.id)).toEqual(['task-r']);
    expect(state!.siblingsByParent.get('nR')!.map(t => t.id).sort())
      .toEqual(['task-c1', 'task-c2', 'task-c3']);

    expect(state!.maxDepthReached).toBe(1);

    // Assumptions come from the highest-pass snapshot.
    expect(state!.passNumber).toBe(2);
    expect(state!.allAssumptions.map(a => a.id)).toEqual(['TA-0003', 'TA-0007', 'X-99']);
    // Seq = max TA-<n>; the non-TA id is ignored.
    expect(state!.assumptionSeq).toBe(7);

    // Pipeline bounds resolve to the matching record only.
    expect(state!.currentPipelineRecordId).toBe(matchingId);
    expect(state!.pipelineStartRecord.id).toBe(matchingId);
    expect(state!.pipelinePasses.map(p => p.pass_number)).toEqual([1, 2]);
  });
});
