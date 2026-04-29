/**
 * Wave 10 — integration tests for runTestSaturationLoop.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createTestDatabase, type Database } from '../../../../lib/database/init';
import { ConfigManager } from '../../../../lib/config/configManager';
import { OrchestratorEngine } from '../../../../lib/orchestrator/orchestratorEngine';
import { runTestSaturationLoop } from '../../../../lib/orchestrator/phases/phase7_1a';
import { MockLLMProvider } from '../../../helpers/mockLLMProvider';
import type {
  DecompositionTestCase,
  TestDecompositionNodeContent,
  TestDecompositionPipelineContent,
  TestAssumptionSetSnapshotContent,
} from '../../../../lib/types/records';

const extensionPath = path.resolve(__dirname, '..', '..', '..', '..', '..');
const workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'jc-test-ws-'));

function seedRootNode(
  engine: OrchestratorEngine,
  runId: string,
  testCase: DecompositionTestCase,
): { recordId: string; logicalNodeId: string } {
  const logicalNodeId = `root-${testCase.id}-uuid`;
  const rec = engine.writer.writeRecord({
    record_type: 'test_decomposition_node',
    schema_version: '1.0',
    workflow_run_id: runId,
    phase_id: '7',
    sub_phase_id: '7.1a',
    produced_by_agent_role: 'test_design_agent',
    janumicode_version_sha: 'dev',
    derived_from_record_ids: [],
    content: {
      kind: 'test_decomposition_node',
      node_id: logicalNodeId,
      parent_node_id: null,
      display_key: testCase.id,
      root_test_id: logicalNodeId,
      depth: 0,
      pass_number: 0,
      status: 'pending',
      test_case: testCase,
      surfaced_assumption_ids: [],
      release_id: null,
      release_ordinal: null,
    } satisfies TestDecompositionNodeContent,
  });
  return { recordId: rec.id, logicalNodeId };
}

describe('runTestSaturationLoop — Wave 10 saturation', () => {
  let db: Database;
  let engine: OrchestratorEngine;

  beforeEach(() => {
    db = createTestDatabase();
    const cm = new ConfigManager();
    engine = new OrchestratorEngine(db, cm, workspacePath, extensionPath);
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

  function tinyTest(id: string): DecompositionTestCase {
    return {
      id, name: id,
      test_type: 'integration',
      component_ids: ['comp-x'],
      acceptance_criterion_ids: ['AC-001'],
      preconditions: ['fresh db'],
      steps: [{ id: 's1', description: 'do thing', phase: 'act' }],
      expected_outcome: `${id} passes`,
    };
  }

  it('Pass-1 — produces Tier-D atomic children; saturation terminates cleanly', async () => {
    const mock = new MockLLMProvider();
    mock.setFixture('decompose-root', {
      match: 'test-root',
      parsedJson: {
        parent_branch_classification: 'decomposable',
        parent_tier_assessment: { tier: 'A', agrees_with_hint: true, rationale: 'suite' },
        children: [
          {
            id: 'test-leaf-1', tier: 'D', name: 'Leaf 1',
            test_type: 'integration',
            component_ids: ['comp-x'],
            acceptance_criterion_ids: ['AC-001'],
            preconditions: ['fresh db'],
            steps: [
              { id: 's1', phase: 'arrange', description: 'seed' },
              { id: 's2', phase: 'act', description: 'invoke' },
              { id: 's3', phase: 'assert', description: 'check' },
            ],
            expected_outcome: 'leaf 1 passes',
            decomposition_rationale: 'single flow integration test',
          },
          {
            id: 'test-leaf-2', tier: 'D', name: 'Leaf 2',
            test_type: 'integration',
            component_ids: ['comp-x'],
            acceptance_criterion_ids: ['AC-002'],
            preconditions: [],
            steps: [{ id: 's1', phase: 'act', description: 'do' }],
            expected_outcome: 'leaf 2 passes',
          },
        ],
        surfaced_assumptions: [
          { text: 'Use real Postgres in integration tests', category: 'oracle_choice' },
        ],
      },
    });
    configureMock(mock);

    const { run } = engine.startWorkflowRun('ws', 'test');
    const root = tinyTest('test-root');
    const seeded = seedRootNode(engine, run.id, root);

    await runTestSaturationLoop(
      { engine, workflowRun: { id: run.id } as Parameters<typeof runTestSaturationLoop>[0]['workflowRun'] },
      {
        technicalConstraints: [],
        componentSummary: 'comp-x: Component X',
        acceptanceCriteriaSummary: 'AC-001, AC-002',
        rootTestCases: [root],
        rootNodeRecordIds: [seeded.recordId],
        rootLogicalIds: [seeded.logicalNodeId],
      },
    );

    const nodes = engine.writer.getRecordsByType(run.id, 'test_decomposition_node');
    const children = nodes.filter(n =>
      (n.content as unknown as TestDecompositionNodeContent).depth === 1);
    expect(children).toHaveLength(2);
    expect(children.every(c => (c.content as unknown as TestDecompositionNodeContent).tier === 'D')).toBe(true);
    expect(children.every(c => (c.content as unknown as TestDecompositionNodeContent).status === 'atomic')).toBe(true);

    const pipelines = engine.writer.getRecordsByType(run.id, 'test_decomposition_pipeline');
    expect(pipelines.length).toBeGreaterThan(0);
    const latest = pipelines.reduce((a, r) => r.produced_at > a.produced_at ? r : a, pipelines[0]);
    const pc = latest.content as unknown as TestDecompositionPipelineContent;
    expect(pc.final_leaf_count).toBe(2);
    expect(pc.tier_distribution?.D).toBe(2);

    const snapshots = engine.writer.getRecordsByType(run.id, 'test_assumption_set_snapshot');
    expect(snapshots).toHaveLength(1);
    const snap = snapshots[0].content as unknown as TestAssumptionSetSnapshotContent;
    expect(snap.assumptions).toHaveLength(1);
  });

  it('Tier-B children fire mirror gate; auto-accept queues for Tier-C decomposition', async () => {
    const mock = new MockLLMProvider();
    mock.setFixture('decompose-root', {
      match: 'test-root',
      parsedJson: {
        parent_branch_classification: 'decomposable',
        parent_tier_assessment: { tier: 'A', agrees_with_hint: true, rationale: 'suite' },
        children: [
          {
            id: 'test-scenario', tier: 'B', name: 'Scenario',
            test_type: 'integration',
            component_ids: ['comp-x'],
            acceptance_criterion_ids: ['AC-001'],
            steps: [{ id: 's1', description: 'commitment behaviour' }],
            expected_outcome: 'commitment held',
          },
        ],
        surfaced_assumptions: [],
      },
    });
    mock.setFixture('decompose-tier-b', {
      match: 'test-scenario',
      parsedJson: {
        parent_branch_classification: 'decomposable',
        parent_tier_assessment: { tier: 'B', agrees_with_hint: true, rationale: 'commitment' },
        children: [
          {
            id: 'test-leaf', tier: 'D', name: 'Leaf',
            test_type: 'integration',
            component_ids: ['comp-x'],
            acceptance_criterion_ids: ['AC-001'],
            steps: [{ id: 's1', phase: 'assert', description: 'verify' }],
            expected_outcome: 'leaf done',
          },
        ],
        surfaced_assumptions: [],
      },
    });
    configureMock(mock);

    const { run } = engine.startWorkflowRun('ws', 'test');
    const root = tinyTest('test-root');
    const seeded = seedRootNode(engine, run.id, root);

    await runTestSaturationLoop(
      { engine, workflowRun: { id: run.id } as Parameters<typeof runTestSaturationLoop>[0]['workflowRun'] },
      {
        technicalConstraints: [],
        componentSummary: '', acceptanceCriteriaSummary: '',
        rootTestCases: [root],
        rootNodeRecordIds: [seeded.recordId],
        rootLogicalIds: [seeded.logicalNodeId],
      },
    );

    const bundles = engine.writer.getRecordsByType(run.id, 'decision_bundle_presented');
    expect(bundles.length).toBeGreaterThanOrEqual(1);
    const bundleContent = bundles[0].content as Record<string, unknown>;
    expect(bundleContent.bundle_id).toMatch(/^test-decomp-gate-/);

    const nodes = engine.writer.getRecordsByType(run.id, 'test_decomposition_node', false);
    const latestByNodeId = new Map<string, typeof nodes[number]>();
    for (const r of nodes) {
      const c = r.content as unknown as TestDecompositionNodeContent;
      const prior = latestByNodeId.get(c.node_id);
      if (!prior || r.produced_at > prior.produced_at) latestByNodeId.set(c.node_id, r);
    }
    const tierDLeaf = [...latestByNodeId.values()]
      .map(r => r.content as unknown as TestDecompositionNodeContent)
      .find(c => c.display_key === 'test-leaf');
    expect(tierDLeaf).toBeDefined();
    expect(tierDLeaf!.tier).toBe('D');
    expect(tierDLeaf!.status).toBe('atomic');
  });

  it('depth_cap trips deferred status when configured low', async () => {
    engine.configManager.get().decomposition.test_depth_cap = 1;

    const mock = new MockLLMProvider();
    mock.setFixture('decompose-root', {
      match: 'test-root',
      parsedJson: {
        parent_branch_classification: 'decomposable',
        parent_tier_assessment: { tier: 'A', agrees_with_hint: true, rationale: 'suite' },
        children: [
          {
            id: 'test-tier-a', tier: 'A', name: 'Tier A child',
            test_type: 'integration',
            steps: [{ id: 's1', description: 'recurse' }],
          },
        ],
        surfaced_assumptions: [],
      },
    });
    configureMock(mock);

    const { run } = engine.startWorkflowRun('ws', 'test');
    const root = tinyTest('test-root');
    const seeded = seedRootNode(engine, run.id, root);

    await runTestSaturationLoop(
      { engine, workflowRun: { id: run.id } as Parameters<typeof runTestSaturationLoop>[0]['workflowRun'] },
      {
        technicalConstraints: [],
        componentSummary: '', acceptanceCriteriaSummary: '',
        rootTestCases: [root],
        rootNodeRecordIds: [seeded.recordId],
        rootLogicalIds: [seeded.logicalNodeId],
      },
    );

    const nodes = engine.writer.getRecordsByType(run.id, 'test_decomposition_node', false);
    const latestByNodeId = new Map<string, typeof nodes[number]>();
    for (const r of nodes) {
      const c = r.content as unknown as TestDecompositionNodeContent;
      const prior = latestByNodeId.get(c.node_id);
      if (!prior || r.produced_at > prior.produced_at) latestByNodeId.set(c.node_id, r);
    }
    const tierAChild = [...latestByNodeId.values()].find(r =>
      (r.content as unknown as TestDecompositionNodeContent).display_key === 'test-tier-a');
    expect(tierAChild).toBeDefined();
    expect((tierAChild!.content as unknown as TestDecompositionNodeContent).status).toBe('deferred');
    expect((tierAChild!.content as unknown as TestDecompositionNodeContent).pruning_reason).toContain('depth_cap_reached');
  });

  it('persists per-run telemetry to workflow_runs columns', async () => {
    const mock = new MockLLMProvider();
    mock.setFixture('decompose-root', {
      match: 'test-root',
      parsedJson: {
        parent_branch_classification: 'decomposable',
        parent_tier_assessment: { tier: 'A', agrees_with_hint: true, rationale: 'suite' },
        children: [
          {
            id: 'test-leaf', tier: 'D', name: 'Leaf',
            test_type: 'unit',
            steps: [{ id: 's1', description: 'verify' }],
          },
        ],
        surfaced_assumptions: [],
      },
    });
    configureMock(mock);

    const { run } = engine.startWorkflowRun('ws', 'test');
    const root = tinyTest('test-root');
    const seeded = seedRootNode(engine, run.id, root);

    await runTestSaturationLoop(
      { engine, workflowRun: { id: run.id } as Parameters<typeof runTestSaturationLoop>[0]['workflowRun'] },
      {
        technicalConstraints: [],
        componentSummary: '', acceptanceCriteriaSummary: '',
        rootTestCases: [root],
        rootNodeRecordIds: [seeded.recordId],
        rootLogicalIds: [seeded.logicalNodeId],
      },
    );

    const row = db.prepare(`
      SELECT test_decomposition_budget_calls_used, test_decomposition_max_depth_reached, active_test_pipeline_id
      FROM workflow_runs WHERE id = ?
    `).get(run.id) as {
      test_decomposition_budget_calls_used: number;
      test_decomposition_max_depth_reached: number;
      active_test_pipeline_id: string | null;
    };
    expect(row.test_decomposition_budget_calls_used).toBeGreaterThanOrEqual(1);
    expect(row.test_decomposition_max_depth_reached).toBe(1);
    expect(row.active_test_pipeline_id).toMatch(/^test-decomp-pipe-/);
  });
});
