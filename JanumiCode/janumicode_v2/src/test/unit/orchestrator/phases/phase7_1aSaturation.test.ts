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
import {
  runTestSaturationLoop,
  renderScopedAcSummary,
  rebuildTestSaturationStateFromStream,
  type TestSaturationConfig,
} from '../../../../lib/orchestrator/phases/phase7_1a';
import { buildCanonicalAcIndex } from '../../../../lib/orchestrator/phases/phase7/acRefResolver';
import { MockLLMProvider } from '../../../helpers/mockLLMProvider';
import type {
  DecompositionTestCase,
  TestDecompositionNodeContent,
  TestDecompositionPipelineContent,
  TestAssumptionSetSnapshotContent,
  TestAssumptionEntry,
  DecompositionPassEntry,
  DecompositionNodeStatus,
  DecompositionTier,
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

describe('renderScopedAcSummary — scope saturation AC block to the parent (prompt-bloat fix)', () => {
  const index = buildCanonicalAcIndex([
    { id: 'US-1', acceptance_criteria: [
      { id: 'AC-US-001-001', measurable_condition: 'latency < 1ms' },
      { id: 'AC-US-001-002', description: 'returns 403 on deny' },
    ] },
    { id: 'US-2', acceptance_criteria: [
      { id: 'AC-US-002-001', measurable_condition: 'count === 6' },
    ] },
  ]);

  it('renders ONLY the parent\'s validated ACs, not the whole catalog', () => {
    const out = renderScopedAcSummary(['AC-US-001-002'], index, 'FULL-CATALOG');
    expect(out).toBe('AC-US-001-002: returns 403 on deny'); // description used when no measurable_condition
    expect(out).not.toContain('AC-US-001-001');
    expect(out).not.toContain('AC-US-002-001');
    expect(out).not.toContain('FULL-CATALOG');
  });

  it('dedups repeated AC ids', () => {
    expect(renderScopedAcSummary(['AC-US-001-001', 'AC-US-001-001'], index, 'FULL'))
      .toBe('AC-US-001-001: latency < 1ms');
  });

  it('keeps resolvable ids and silently skips unknown ones (never fabricates)', () => {
    expect(renderScopedAcSummary(['AC-US-001-001', 'AC-UNKNOWN-9'], index, 'FULL'))
      .toBe('AC-US-001-001: latency < 1ms');
  });

  it('falls back to the full summary when the parent has no AC ids', () => {
    expect(renderScopedAcSummary([], index, 'FULL')).toBe('FULL');
    expect(renderScopedAcSummary(undefined, index, 'FULL')).toBe('FULL');
  });

  it('falls back when NONE of the parent ids resolve (never an empty AC universe)', () => {
    expect(renderScopedAcSummary(['AC-UNKNOWN-1', 'AC-UNKNOWN-2'], index, 'FULL')).toBe('FULL');
  });

  it('falls back when the index is absent', () => {
    expect(renderScopedAcSummary(['AC-US-001-001'], undefined, 'FULL')).toBe('FULL');
  });
});

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
        interfaceContractsSummary: 'IC-001, API-foo',
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

  it('PA-2 — test_case_saturation prompt is scoped: own-component context, same-component root siblings', async () => {
    const mock = new MockLLMProvider();
    // Atomic response for every root → one call each; assert on the captured prompts.
    mock.setFixture('atomic', {
      match: 'test-',
      parsedJson: {
        parent_branch_classification: 'atomic_step',
        parent_tier_assessment: { tier: 'D', agrees_with_hint: true, rationale: 'atomic' },
        children: [],
        surfaced_assumptions: [],
      },
    });
    configureMock(mock);

    const { run } = engine.startWorkflowRun('ws', 'test');
    const rootA: DecompositionTestCase = { ...tinyTest('test-a-root'), component_ids: ['comp-a'] };
    const rootB: DecompositionTestCase = { ...tinyTest('test-b-root'), component_ids: ['comp-b'] };
    const sa = seedRootNode(engine, run.id, rootA);
    const sb = seedRootNode(engine, run.id, rootB);

    await runTestSaturationLoop(
      { engine, workflowRun: { id: run.id } as Parameters<typeof runTestSaturationLoop>[0]['workflowRun'] },
      {
        technicalConstraints: [],
        componentSummary: 'FULL-MODEL-SUMMARY (comp-a and comp-b)',
        componentSummaryById: { 'comp-a': 'SCOPED-COMPONENT-A-ONLY', 'comp-b': 'SCOPED-COMPONENT-B-ONLY' },
        acceptanceCriteriaSummary: 'AC-001, AC-002',
        interfaceContractsSummary: 'IC-001',
        rootTestCases: [rootA, rootB],
        rootNodeRecordIds: [sa.recordId, sb.recordId],
        rootLogicalIds: [sa.logicalNodeId, sb.logicalNodeId],
      },
    );

    const prompts = mock.getCallLog().map(c => c.options.prompt ?? '');
    const promptA = prompts.find(p => p.includes('SCOPED-COMPONENT-A-ONLY'));
    expect(promptA, 'a test_case_saturation prompt scoped to comp-a should exist').toBeDefined();

    // (1) component_context scoped to the test's OWN component — not the other, not the full model.
    expect(promptA!).not.toContain('SCOPED-COMPONENT-B-ONLY');
    expect(promptA!).not.toContain('FULL-MODEL-SUMMARY');

    // (2) root sibling_context scoped to component-overlapping test cases → comp-a root has no
    //     same-component siblings, and the cross-component root is NOT injected as a sibling bullet.
    expect(promptA!).toContain('(none — sole child under this parent)');
    expect(promptA!).not.toContain('- test-b-root: test-b-root');
  });

  it('PA-2 regression — roots with EMPTY component_ids still list siblings (no false "sole child")', async () => {
    const mock = new MockLLMProvider();
    mock.setFixture('atomic', {
      match: 'test-',
      parsedJson: {
        parent_branch_classification: 'atomic_step',
        parent_tier_assessment: { tier: 'D', agrees_with_hint: true, rationale: 'atomic' },
        children: [],
        surfaced_assumptions: [],
      },
    });
    configureMock(mock);

    const { run } = engine.startWorkflowRun('ws', 'test');
    // The 7.1 skeleton binds components at the SUITE level, so a root test case
    // often has NO component_ids of its own. Pre-fix, parentComps was empty and
    // the overlap predicate dropped every sibling → each root falsely rendered as
    // the sole child, starving the cross-sibling dedup roster. The empty-parentComps
    // bypass must restore the full same-parent roster.
    const rootA: DecompositionTestCase = { ...tinyTest('test-a-root'), component_ids: [] };
    const rootB: DecompositionTestCase = { ...tinyTest('test-b-root'), component_ids: [] };
    const sa = seedRootNode(engine, run.id, rootA);
    const sb = seedRootNode(engine, run.id, rootB);

    await runTestSaturationLoop(
      { engine, workflowRun: { id: run.id } as Parameters<typeof runTestSaturationLoop>[0]['workflowRun'] },
      {
        technicalConstraints: [],
        componentSummary: 'FULL-MODEL',
        acceptanceCriteriaSummary: 'AC-001',
        interfaceContractsSummary: 'IC-001',
        rootTestCases: [rootA, rootB],
        rootNodeRecordIds: [sa.recordId, sb.recordId],
        rootLogicalIds: [sa.logicalNodeId, sb.logicalNodeId],
      },
    );

    const prompts = mock.getCallLog().map(c => c.options.prompt ?? '');
    expect(prompts).toHaveLength(2);
    // Neither root is falsely told it is the sole child.
    expect(prompts.some(p => p.includes('(none — sole child under this parent)'))).toBe(false);
    // Each root sees the OTHER root as a sibling bullet (roster preserved).
    expect(prompts.some(p => p.includes('- test-b-root: test-b-root'))).toBe(true);
    expect(prompts.some(p => p.includes('- test-a-root: test-a-root'))).toBe(true);
  });

  it('carries a property child (test_type=property + property_spec) through the loop; synthesizes an assert step when none given', async () => {
    const mock = new MockLLMProvider();
    mock.setFixture('decompose-root', {
      match: 'test-root',
      parsedJson: {
        parent_branch_classification: 'decomposable',
        parent_tier_assessment: { tier: 'B', agrees_with_hint: true, rationale: 'property/invariant scenario' },
        children: [
          {
            id: 'test-prop-1', tier: 'D', name: 'round-trips any URL',
            test_type: 'property',
            component_ids: ['comp-x'],
            acceptance_criterion_ids: ['AC-001'],
            preconditions: ['store empty'],
            steps: [], // property children may omit arrange/act/assert steps
            expected_outcome: 'no counterexample',
            property_spec: {
              invariant: 'resolve(shorten(u)) === u',
              property_kind: 'round_trip',
              input_domain: 'valid http/https URLs incl. query/fragment',
              generators: ['validUrl'],
              oracle: 'identity',
            },
          },
          {
            // property test_type but NO valid spec → degrades to example (kept, not dropped)
            id: 'test-prop-bad', tier: 'D', name: 'malformed property',
            test_type: 'property',
            component_ids: ['comp-x'],
            acceptance_criterion_ids: ['AC-002'],
            preconditions: [],
            steps: [{ id: 's1', phase: 'act', description: 'do thing' }],
            expected_outcome: 'works',
            property_spec: { property_kind: 'round_trip' }, // missing invariant + input_domain
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
        componentSummary: 'comp-x: Component X',
        acceptanceCriteriaSummary: 'AC-001, AC-002',
        interfaceContractsSummary: 'IC-001',
        rootTestCases: [root],
        rootNodeRecordIds: [seeded.recordId],
        rootLogicalIds: [seeded.logicalNodeId],
      },
    );

    const nodes = engine.writer.getRecordsByType(run.id, 'test_decomposition_node');
    const children = nodes
      .map(n => n.content as unknown as TestDecompositionNodeContent)
      .filter(c => c.depth === 1);
    expect(children).toHaveLength(2);

    const prop = children.find(c => c.test_case.id === 'test-prop-1')!;
    expect(prop.test_case.test_type).toBe('property');
    expect(prop.test_case.property_spec?.invariant).toBe('resolve(shorten(u)) === u');
    expect(prop.test_case.property_spec?.property_kind).toBe('round_trip');
    // No steps were provided → a single assert step is synthesized from the invariant.
    expect(prop.test_case.steps).toHaveLength(1);
    expect(prop.test_case.steps[0].phase).toBe('assert');
    expect(prop.test_case.steps[0].description).toContain('resolve(shorten(u)) === u');

    // Malformed property_spec → child is kept (not dropped) but spec is undefined.
    const bad = children.find(c => c.test_case.id === 'test-prop-bad')!;
    expect(bad.test_case.property_spec).toBeUndefined();
    expect(bad.test_case.steps.length).toBeGreaterThan(0);
  });

  it('sanitizes a child: array expected_outcome is joined and empty-description steps are dropped (characterization)', async () => {
    const mock = new MockLLMProvider();
    mock.setFixture('decompose-root', {
      match: 'test-root',
      parsedJson: {
        parent_branch_classification: 'decomposable',
        parent_tier_assessment: { tier: 'A', agrees_with_hint: true, rationale: 'suite' },
        children: [
          {
            id: 'test-arr', tier: 'D', name: 'Array-outcome leaf',
            test_type: 'integration',
            component_ids: ['comp-x'],
            acceptance_criterion_ids: ['AC-001'],
            steps: [
              { id: 's-empty', phase: 'arrange', description: '' }, // dropped — empty description
              { id: 's-keep', phase: 'assert', description: 'verify result' },
            ],
            // LLM emitted expected_outcome as an array (non-strings filtered, rest joined with '; ')
            expected_outcome: ['first outcome', 42, 'second outcome'],
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
        componentSummary: 'comp-x: Component X',
        acceptanceCriteriaSummary: 'AC-001',
        interfaceContractsSummary: 'IC-001',
        rootTestCases: [root],
        rootNodeRecordIds: [seeded.recordId],
        rootLogicalIds: [seeded.logicalNodeId],
      },
    );

    const child = engine.writer.getRecordsByType(run.id, 'test_decomposition_node')
      .map(n => n.content as unknown as TestDecompositionNodeContent)
      .find(c => c.test_case.id === 'test-arr');
    expect(child).toBeDefined();
    // Array expected_outcome → non-strings filtered, remainder joined with '; '.
    expect(child!.test_case.expected_outcome).toBe('first outcome; second outcome');
    // Empty-description step dropped; only the valid step survives, with its own id/phase.
    expect(child!.test_case.steps).toHaveLength(1);
    expect(child!.test_case.steps[0].id).toBe('s-keep');
    expect(child!.test_case.steps[0].phase).toBe('assert');
    expect(child!.test_case.steps[0].description).toBe('verify result');
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

describe('rebuildTestSaturationStateFromStream — resume-state reconstruction (characterization)', () => {
  let db: Database;
  let engine: OrchestratorEngine;

  beforeEach(() => {
    db = createTestDatabase();
    const cm = new ConfigManager();
    engine = new OrchestratorEngine(db, cm, workspacePath, extensionPath);
  });
  afterEach(() => { db.close(); });

  const config: TestSaturationConfig = {
    recordSubPhaseId: 'test_case_saturation',
    templateSubPhase: 'test_case_saturation',
    gateSurfacePrefix: 'test-decomp-gate-',
  };

  function tc(id: string, activeConstraints?: string[]): DecompositionTestCase {
    return {
      id, name: id,
      test_type: 'integration',
      steps: [{ id: 's1', description: 'do', phase: 'act' }],
      active_constraints: activeConstraints,
    };
  }

  function writeNode(
    runId: string,
    opts: {
      nodeId: string;
      parentNodeId: string | null;
      depth: number;
      status: DecompositionNodeStatus;
      testCase: DecompositionTestCase;
      tier?: DecompositionTier;
      rootTestId?: string;
    },
  ): string {
    const rec = engine.writer.writeRecord({
      record_type: 'test_decomposition_node',
      schema_version: '1.0',
      workflow_run_id: runId,
      phase_id: '7',
      sub_phase_id: 'test_case_saturation',
      produced_by_agent_role: 'test_design_agent',
      janumicode_version_sha: 'dev',
      derived_from_record_ids: [],
      content: {
        kind: 'test_decomposition_node',
        node_id: opts.nodeId,
        parent_node_id: opts.parentNodeId,
        display_key: opts.testCase.id,
        root_test_id: opts.rootTestId ?? opts.nodeId,
        depth: opts.depth,
        pass_number: 0,
        status: opts.status,
        tier: opts.tier,
        test_case: opts.testCase,
        surfaced_assumption_ids: [],
        release_id: null,
        release_ordinal: null,
      } satisfies TestDecompositionNodeContent,
    });
    return rec.id;
  }

  function writeSnapshot(runId: string, passNumber: number, assumptions: TestAssumptionEntry[]): void {
    engine.writer.writeRecord({
      record_type: 'test_assumption_set_snapshot',
      schema_version: '1.0',
      workflow_run_id: runId,
      phase_id: '7',
      sub_phase_id: 'test_case_saturation',
      produced_by_agent_role: 'test_design_agent',
      janumicode_version_sha: 'dev',
      derived_from_record_ids: [],
      content: {
        kind: 'test_assumption_set_snapshot',
        pass_number: passNumber,
        root_test_id: '*',
        assumptions,
        delta_from_previous_pass: assumptions.length,
        semantic_delta: assumptions.length,
      } satisfies TestAssumptionSetSnapshotContent,
    });
  }

  function writePipeline(runId: string, pipelineId: string, passes: DecompositionPassEntry[]): string {
    const rec = engine.writer.writeRecord({
      record_type: 'test_decomposition_pipeline',
      schema_version: '1.0',
      workflow_run_id: runId,
      phase_id: '7',
      sub_phase_id: 'test_case_saturation',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: 'dev',
      derived_from_record_ids: [],
      content: {
        kind: 'test_decomposition_pipeline',
        pipeline_id: pipelineId,
        root_test_id: '*',
        passes,
      } satisfies TestDecompositionPipelineContent,
    });
    return rec.id;
  }

  const pass = (passNumber: number, nodesProduced: number): DecompositionPassEntry => ({
    pass_number: passNumber,
    status: 'completed',
    started_at: null,
    completed_at: null,
    nodes_produced: nodesProduced,
    assumption_delta: 0,
  });

  const assumption = (id: string, passNumber: number): TestAssumptionEntry => ({
    id, text: `assumption ${id}`, source: 'decomposition', surfaced_at_pass: passNumber, category: 'open_question',
  });

  // produced_at is millisecond-resolution and can collide between records written
  // in the same tick; pin it explicitly so earliest/latest selection is deterministic.
  function setProducedAt(recordId: string, iso: string): void {
    db.prepare('UPDATE governed_stream SET produced_at = ? WHERE id = ?').run(iso, recordId);
  }

  function ctxFor(runId: string): Parameters<typeof rebuildTestSaturationStateFromStream>[0] {
    return { engine, workflowRun: { id: runId } as Parameters<typeof rebuildTestSaturationStateFromStream>[0]['workflowRun'] };
  }

  it('returns null when there are no node records', () => {
    const { run } = engine.startWorkflowRun('ws', 'test');
    expect(rebuildTestSaturationStateFromStream(ctxFor(run.id), config, 'pipe-x')).toBeNull();
  });

  it('returns null when nodes exist but no pipeline record matches the pipelineId', () => {
    const { run } = engine.startWorkflowRun('ws', 'test');
    writeNode(run.id, { nodeId: 'n-root', parentNodeId: null, depth: 0, status: 'pending', testCase: tc('T-root') });
    writePipeline(run.id, 'other-pipe', [pass(1, 0)]); // present, but under a different pipeline id
    expect(rebuildTestSaturationStateFromStream(ctxFor(run.id), config, 'pipe-x')).toBeNull();
  });

  it('reconstructs queue, siblings, assumptions, and pipeline pointers from the stream', () => {
    const { run } = engine.startWorkflowRun('ws', 'test');
    const pipelineId = 'pipe-x';

    // Node tree: root(pending, depth 0) → child-c(pending, tier C, depth 1) + child-d(decomposed, tier A, depth 1)
    const rootRecId = writeNode(run.id, {
      nodeId: 'n-root', parentNodeId: null, depth: 0, status: 'pending',
      testCase: tc('T-root', ['TC-9']),
    });
    const childCRecId = writeNode(run.id, {
      nodeId: 'n-child-c', parentNodeId: 'n-root', depth: 1, status: 'pending', tier: 'C',
      testCase: tc('T-child-c'), rootTestId: 'n-root',
    });
    writeNode(run.id, {
      nodeId: 'n-child-d', parentNodeId: 'n-root', depth: 1, status: 'decomposed', tier: 'A',
      testCase: tc('T-child-d'), rootTestId: 'n-root',
    });

    // Two snapshots; the highest pass_number wins.
    writeSnapshot(run.id, 1, [assumption('TS-0001', 1)]);
    writeSnapshot(run.id, 3, [assumption('TS-0001', 1), assumption('TS-0005', 3)]);

    // Two pipeline records for THIS pipeline: earliest = start, latest = current.
    const startRecId = writePipeline(run.id, pipelineId, [pass(1, 2)]);
    const latestRecId = writePipeline(run.id, pipelineId, [pass(1, 2), pass(2, 0)]);
    setProducedAt(startRecId, '2020-01-01T00:00:00.000Z');
    setProducedAt(latestRecId, '2020-01-02T00:00:00.000Z');
    // A pipeline record under a different id must be ignored by the filter.
    writePipeline(run.id, 'other-pipe', []);

    const state = rebuildTestSaturationStateFromStream(ctxFor(run.id), config, pipelineId);
    expect(state).not.toBeNull();

    // Queue: only the two PENDING nodes (root + child-c); the decomposed node is excluded.
    expect(state!.queue).toHaveLength(2);
    const rootEntry = state!.queue.find(q => q.nodeId === 'n-root')!;
    expect(rootEntry.tierHint).toBe('root');
    expect(rootEntry.depth).toBe(0);
    expect(rootEntry.parentNodeId).toBeNull();
    expect(rootEntry.parentRecordId).toBe(rootRecId);
    expect(rootEntry.activeConstraints).toEqual(['TC-9']);
    const childEntry = state!.queue.find(q => q.nodeId === 'n-child-c')!;
    expect(childEntry.tierHint).toBe('C');
    expect(childEntry.depth).toBe(1);
    expect(childEntry.parentNodeId).toBe('n-root');
    expect(childEntry.parentRecordId).toBe(childCRecId);
    expect(childEntry.activeConstraints).toEqual([]);

    // Siblings: null-parent holds the root; 'n-root' holds both children.
    expect((state!.siblingsByParent.get(null) ?? []).map(t => t.id)).toEqual(['T-root']);
    expect((state!.siblingsByParent.get('n-root') ?? []).map(t => t.id).sort())
      .toEqual(['T-child-c', 'T-child-d']);

    expect(state!.maxDepthReached).toBe(1);

    // Assumptions: highest-pass snapshot wins; seq = max TS-<n>.
    expect(state!.passNumber).toBe(3);
    expect(state!.allAssumptions.map(a => a.id)).toEqual(['TS-0001', 'TS-0005']);
    expect(state!.assumptionSeq).toBe(5);

    // Pipeline pointers: start = earliest, current = latest, passes come from the latest record.
    expect(state!.pipelineStartRecord.id).toBe(startRecId);
    expect(state!.currentPipelineRecordId).toBe(latestRecId);
    expect(state!.pipelinePasses.map(p => p.pass_number)).toEqual([1, 2]);
  });
});
