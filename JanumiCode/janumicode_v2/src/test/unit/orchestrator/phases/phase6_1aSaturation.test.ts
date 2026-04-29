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
import { runTaskSaturationLoop } from '../../../../lib/orchestrator/phases/phase6_1a';
import { MockLLMProvider } from '../../../helpers/mockLLMProvider';
import type {
  DecompositionTask,
  TaskDecompositionNodeContent,
  TaskDecompositionPipelineContent,
  TaskAssumptionSetSnapshotContent,
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
