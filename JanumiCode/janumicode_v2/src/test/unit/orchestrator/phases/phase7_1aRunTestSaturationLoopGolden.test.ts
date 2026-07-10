/**
 * Wave 10 — RECORD-STREAM GOLDEN-SNAPSHOT characterization test for
 * `runTestSaturationLoop` (phase7_1a.ts).
 *
 * PURPOSE. This test pins the EXACT observable behavior of the test-case
 * saturation loop — the full persisted record stream plus the workflow_runs
 * telemetry columns — BEFORE the loop (cognitive complexity 217) is
 * decomposed into helpers. Any behavioral divergence introduced by the
 * refactor (a dropped record, a changed status transition, a reordered pass,
 * a different tier distribution, a lost supersession, a shifted assumption
 * sequence, a changed gate bundle) will flip the golden snapshot.
 *
 * DESIGN. One SINGLE representative scenario deliberately exercises many
 * branches at once, driven entirely by hermetic MockLLMProvider fixtures
 * (no network, in-memory DB, auto-approved decisions). It mirrors the
 * sibling golden `phase6_1aRunTaskSaturationLoopGolden.test.ts`:
 *
 *   Pass 1 — decompose the depth-0 root `test-root` into a MIX:
 *     • test-leaf-alpha (Tier-D) → atomic, terminal
 *     • test-leaf-beta  (Tier-D) → atomic, terminal
 *     • test-epic       (Tier-A) → recurses immediately (queued this pass)
 *     • test-mid        (Tier-C) → one more pass (queued this pass)
 *     • test-story      (Tier-B) → FIRES THE MIRROR GATE (decision bundle),
 *                                   auto-accepted, queued for next pass
 *     + 2 surfaced assumptions (oracle_choice, scope_boundary)
 *     → root gets a `decomposed` supersession.
 *
 *   Pass 2 — decompose the queued Tier-A / Tier-C / (auto-accepted) Tier-B:
 *     • test-epic  → one Tier-D leaf (atomic) + 1 surfaced assumption
 *                    (assumptions ACROSS passes) → `decomposed` supersession
 *     • test-mid   → one Tier-D leaf (atomic) → `decomposed` supersession
 *     • test-story → one Tier-D leaf (atomic); agrees with Tier-B hint,
 *                    produces no Tier-B children → NOT downgraded →
 *                    `decomposed` supersession (post-gate clean path)
 *     → queue drains → fixed-point termination.
 *
 * This reaches depth 2, produces five atomic leaves, one mirror-gate bundle,
 * two assumption snapshots, and four incremental pipeline records.
 *
 * DETERMINISM. Every LLM fixture is matched on a UNIQUE `[[MATCH_*]]`
 * sentinel embedded in ONE STEP DESCRIPTION of each decomposable parent's
 * test case. A step description appears ONLY in that node's own
 * `formatTestCaseForPrompt` block — never in a sibling bullet (which shows
 * only `id: name`), never in the AC / component / assumption context blocks.
 * So a sentinel cannot false-match a sibling / ancestor / cross-branch node,
 * which a bare test-id or a name-embedded sentinel WOULD (ids and names leak
 * into sibling_context bullets). Leaf sentinels are unnecessary and omitted
 * because Tier-D nodes are terminal and never re-enter a prompt.
 *
 * NORMALIZATION. See `normalize*` helpers below — every non-deterministic
 * field is stripped or remapped, each with a comment explaining WHY.
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
  GovernedStreamRecord,
  TestDecompositionNodeContent,
  TestDecompositionPipelineContent,
  TestAssumptionSetSnapshotContent,
} from '../../../../lib/types/records';

const extensionPath = path.resolve(__dirname, '..', '..', '..', '..', '..');
const workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'jc-test-ws-'));

// ── Seed helper (identical pattern to phase7_1aSaturation.test.ts) ──────

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

// ── Normalized snapshot shape ──────────────────────────────────────────

interface NormalizedRecord {
  record_type: string;
  sub_phase_id: string | null;
  content: Record<string, unknown>;
}

/**
 * Stable, collision-proof ordering. The DB query orders by `produced_at`,
 * which can tie for records written in the same millisecond, so ordering is
 * NOT reliable across runs. We sort by a readable primary key first, then by
 * the full normalized JSON as the ultimate tiebreaker (identical strings sort
 * adjacent, so order among true duplicates is irrelevant).
 */
function stableSort<T>(arr: T[], primary: (x: T) => string): T[] {
  return [...arr].sort((a, b) => {
    const ka = `${primary(a)} ${JSON.stringify(a)}`;
    const kb = `${primary(b)} ${JSON.stringify(b)}`;
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}

/**
 * node_id / parent_node_id / root_test_id are logical UUIDs minted via
 * randomUUID() (or, for the seeded root, a test-local seed convention) —
 * NON-DETERMINISTIC. We remap them to the stable, deterministic `display_key`
 * label so the tree LINKAGE (which the refactor must preserve) is still
 * pinned without leaking a raw UUID.
 */
function nodeContent(r: GovernedStreamRecord): TestDecompositionNodeContent {
  return r.content as unknown as TestDecompositionNodeContent;
}

function buildNodeLabelMap(nodeRecords: GovernedStreamRecord[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of nodeRecords) {
    const c = nodeContent(r);
    // All versions of a logical node share the same node_id AND display_key,
    // so repeated inserts are consistent.
    map.set(c.node_id, c.display_key);
  }
  return map;
}

function normalizeNode(
  r: GovernedStreamRecord,
  labels: Map<string, string>,
): NormalizedRecord {
  const c = nodeContent(r);
  return {
    // record_type + sub_phase_id are the two top-level behavioral fields we
    // keep. Everything else at the top level (id, produced_at,
    // workflow_run_id, janumicode_version_sha, derived_from_record_ids,
    // superseded_by_*, is_current_version, schema_version, etc.) is a
    // UUID/timestamp/run-scoped pointer — dropped by simply not copying it.
    record_type: r.record_type,
    sub_phase_id: r.sub_phase_id,
    content: {
      kind: c.kind,
      // display_key IS the stable label; parent/root remapped through it.
      display_key: c.display_key,
      // parent_ref / root_ref replace the raw logical UUIDs (see above).
      parent_ref: c.parent_node_id == null
        ? null
        : (labels.get(c.parent_node_id) ?? '<unmapped-parent>'),
      root_ref: labels.get(c.root_test_id) ?? c.root_test_id,
      depth: c.depth,
      pass_number: c.pass_number,
      status: c.status,
      tier: c.tier,
      decomposition_rationale: c.decomposition_rationale,
      // TS-<n> ids are a deterministic sequence (assignment order is fixed by
      // the deterministic queue + fixture order), so they are kept as-is.
      surfaced_assumption_ids: c.surfaced_assumption_ids,
      atomic_criteria_satisfied: c.atomic_criteria_satisfied,
      pruning_reason: c.pruning_reason,
      release_id: c.release_id,
      release_ordinal: c.release_ordinal,
      // The test_case payload is fully deterministic given the fixtures:
      // ids/names/steps/component_ids are fixture-provided; acceptance
      // criterion ids pass through unchanged (no canonicalAcIndex supplied so
      // normalizeChildAcRefs is a no-op); active_constraints resolve to [].
      // No UUIDs or timestamps live inside test_case.
      test_case: c.test_case as unknown as Record<string, unknown>,
    },
  };
}

function normalizePipeline(r: GovernedStreamRecord): NormalizedRecord {
  const c = r.content as unknown as TestDecompositionPipelineContent;
  return {
    record_type: r.record_type,
    sub_phase_id: r.sub_phase_id,
    content: {
      kind: c.kind,
      // pipeline_id = `test-decomp-pipe-${workflowRun.id.slice(0,8)}` — carries
      // the random run-id prefix → NON-DETERMINISTIC. Replaced with a fixed
      // placeholder.
      pipeline_id: '<pipeline-id>',
      root_test_id: c.root_test_id,
      passes: (c.passes ?? []).map(p => ({
        pass_number: p.pass_number,
        status: p.status,
        // started_at / completed_at are new Date().toISOString() wall-clock
        // timestamps → NON-DETERMINISTIC. Dropped.
        nodes_produced: p.nodes_produced,
        assumption_delta: p.assumption_delta,
        termination_reason: p.termination_reason,
      })),
      // Present only on the final pipeline record; deterministic counts.
      final_leaf_count: c.final_leaf_count,
      final_max_depth: c.final_max_depth,
      total_llm_calls: c.total_llm_calls,
      tier_distribution: c.tier_distribution,
    },
  };
}

function normalizeSnapshot(
  r: GovernedStreamRecord,
  labels: Map<string, string>,
): NormalizedRecord {
  const c = r.content as unknown as TestAssumptionSetSnapshotContent;
  return {
    record_type: r.record_type,
    sub_phase_id: r.sub_phase_id,
    content: {
      kind: c.kind,
      pass_number: c.pass_number,
      root_test_id: c.root_test_id,
      assumptions: c.assumptions.map(a => ({
        id: a.id,
        text: a.text,
        source: a.source,
        // surfaced_at_node is a logical UUID → remapped to display_key label.
        surfaced_at_ref: a.surfaced_at_node == null
          ? undefined
          : (labels.get(a.surfaced_at_node) ?? '<unmapped-node>'),
        surfaced_at_pass: a.surfaced_at_pass,
        category: a.category,
        citations: a.citations,
        // duplicate_of / duplicate_similarity are intentionally NOT copied:
        // duplicate_similarity is a float cosine score that depends on the
        // embedding backend (environment-dependent). Under vitest the embedder
        // is the NoopEmbeddingClient (empty vectors → cosine NaN → zero
        // duplicates), so these are never set today — but we strip them
        // defensively so injecting a real embedder later can't leak a
        // non-deterministic value into the golden snapshot.
      })),
      delta_from_previous_pass: c.delta_from_previous_pass,
      semantic_delta: c.semantic_delta,
    },
  };
}

function normalizeBundle(r: GovernedStreamRecord): NormalizedRecord {
  // decision_bundle content (bundle_id / bundle_type / title / context /
  // items) is fully deterministic: bundle_id = `test-decomp-gate-<display_key>`,
  // items reference test.id / test_type / component_ids / ac_ids / step
  // descriptions only. No UUIDs or timestamps live inside the content, so it
  // is kept verbatim.
  return {
    record_type: r.record_type,
    sub_phase_id: r.sub_phase_id,
    content: r.content as unknown as Record<string, unknown>,
  };
}

// ── Test ────────────────────────────────────────────────────────────────

describe('runTestSaturationLoop — record-stream golden snapshot', () => {
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

  it('pins the full persisted record stream + telemetry for a mixed-tier, multi-pass decomposition', async () => {
    const mock = new MockLLMProvider();

    // Pass 1: root → mix of D leaves, one A, one C, one B (mirror gate).
    // The sentinel of each DECOMPOSABLE child lives in a STEP description so
    // it re-enters only that child's own decomposition prompt in pass 2.
    mock.setFixture('[[MATCH_ROOT]]', {
      match: '[[MATCH_ROOT]]',
      parsedJson: {
        parent_branch_classification: 'decomposable',
        parent_tier_assessment: { tier: 'A', agrees_with_hint: true, rationale: 'suite root' },
        children: [
          {
            id: 'test-leaf-alpha', tier: 'D', name: 'Leaf Alpha',
            test_type: 'integration',
            component_ids: ['comp-x'],
            acceptance_criterion_ids: ['AC-001'],
            preconditions: ['fresh db'],
            steps: [
              { id: 's1', phase: 'arrange', description: 'seed alpha fixtures' },
              { id: 's2', phase: 'act', description: 'invoke alpha' },
              { id: 's3', phase: 'assert', description: 'assert alpha result' },
            ],
            expected_outcome: 'alpha passes',
            decomposition_rationale: 'single-flow integration test',
          },
          {
            id: 'test-leaf-beta', tier: 'D', name: 'Leaf Beta',
            test_type: 'unit',
            component_ids: ['comp-x'],
            acceptance_criterion_ids: ['AC-002'],
            steps: [{ id: 's1', phase: 'act', description: 'exercise beta unit' }],
            expected_outcome: 'beta passes',
          },
          {
            id: 'test-epic', tier: 'A', name: 'Epic Scenario',
            test_type: 'integration',
            component_ids: ['comp-x'],
            acceptance_criterion_ids: ['AC-001'],
            steps: [{ id: 's1', phase: 'act', description: 'epic body work [[MATCH_EPIC]]' }],
            expected_outcome: 'epic recurses',
            decomposition_rationale: 'multi-cluster suite',
          },
          {
            id: 'test-mid', tier: 'C', name: 'Mid Scenario',
            test_type: 'integration',
            component_ids: ['comp-x'],
            acceptance_criterion_ids: ['AC-002'],
            steps: [{ id: 's1', phase: 'act', description: 'mid body work [[MATCH_MID]]' }],
            expected_outcome: 'mid one more pass',
          },
          {
            id: 'test-story', tier: 'B', name: 'Story Commitment',
            test_type: 'integration',
            component_ids: ['comp-x'],
            acceptance_criterion_ids: ['AC-001'],
            steps: [{ id: 's1', phase: 'act', description: 'story body work [[MATCH_STORY]]' }],
            expected_outcome: 'commitment held',
            decomposition_rationale: 'scope commitment',
          },
        ],
        surfaced_assumptions: [
          { text: 'Integration tests run against a real ephemeral database', category: 'oracle_choice' },
          { text: 'Suite covers only comp-x behaviours', category: 'scope_boundary' },
        ],
      },
    });

    // Pass 2: Tier-A epic → one D leaf + one assumption (across-pass delta).
    mock.setFixture('[[MATCH_EPIC]]', {
      match: '[[MATCH_EPIC]]',
      parsedJson: {
        parent_branch_classification: 'decomposable',
        parent_tier_assessment: { tier: 'A', agrees_with_hint: true, rationale: 'still a suite' },
        children: [
          {
            id: 'test-epic-leaf', tier: 'D', name: 'Epic Leaf',
            test_type: 'integration',
            component_ids: ['comp-x'],
            acceptance_criterion_ids: ['AC-001'],
            steps: [{ id: 's1', phase: 'assert', description: 'verify epic leaf' }],
            expected_outcome: 'epic leaf passes',
          },
        ],
        surfaced_assumptions: [
          { text: 'Epic leaf reuses the shared HTTP client fixture', category: 'fixture_setup' },
        ],
      },
    });

    // Pass 2: Tier-C mid → one D leaf, no assumptions.
    mock.setFixture('[[MATCH_MID]]', {
      match: '[[MATCH_MID]]',
      parsedJson: {
        parent_branch_classification: 'decomposable',
        parent_tier_assessment: { tier: 'C', agrees_with_hint: true, rationale: 'coherent scenario' },
        children: [
          {
            id: 'test-mid-leaf', tier: 'D', name: 'Mid Leaf',
            test_type: 'integration',
            component_ids: ['comp-x'],
            acceptance_criterion_ids: ['AC-002'],
            steps: [{ id: 's1', phase: 'assert', description: 'verify mid leaf' }],
            expected_outcome: 'mid leaf passes',
          },
        ],
        surfaced_assumptions: [],
      },
    });

    // Pass 2: auto-accepted Tier-B story → one D leaf; agrees with hint and
    // produces no Tier-B child → NOT downgraded (post-gate clean path).
    mock.setFixture('[[MATCH_STORY]]', {
      match: '[[MATCH_STORY]]',
      parsedJson: {
        parent_branch_classification: 'decomposable',
        parent_tier_assessment: { tier: 'B', agrees_with_hint: true, rationale: 'commitment holds' },
        children: [
          {
            id: 'test-story-leaf', tier: 'D', name: 'Story Leaf',
            test_type: 'integration',
            component_ids: ['comp-x'],
            acceptance_criterion_ids: ['AC-001'],
            steps: [{ id: 's1', phase: 'assert', description: 'verify story leaf' }],
            expected_outcome: 'story leaf passes',
          },
        ],
        surfaced_assumptions: [],
      },
    });

    configureMock(mock);

    const { run } = engine.startWorkflowRun('ws', 'test');
    const root: DecompositionTestCase = {
      id: 'test-root',
      name: 'Root Suite',
      test_type: 'integration',
      component_ids: ['comp-x'],
      acceptance_criterion_ids: ['AC-001'],
      preconditions: ['fresh db'],
      steps: [{ id: 's1', phase: 'act', description: 'root suite work [[MATCH_ROOT]]' }],
      expected_outcome: 'root suite passes',
    };
    const seeded = seedRootNode(engine, run.id, root);

    await runTestSaturationLoop(
      { engine, workflowRun: { id: run.id } as Parameters<typeof runTestSaturationLoop>[0]['workflowRun'] },
      {
        technicalConstraints: [],
        componentSummary: 'comp-x: Component X (full-model fallback summary)',
        componentSummaryById: { 'comp-x': 'comp-x scoped context' },
        acceptanceCriteriaSummary: 'AC-001: primary behaviour\nAC-002: secondary behaviour',
        interfaceContractsSummary: 'IC-001, API-foo',
        rootTestCases: [root],
        rootNodeRecordIds: [seeded.recordId],
        rootLogicalIds: [seeded.logicalNodeId],
      },
    );

    // ── Collect the FULL record stream (all versions) + telemetry ────────
    const nodeRecords = engine.writer.getRecordsByType(run.id, 'test_decomposition_node', false);
    const pipelineRecords = engine.writer.getRecordsByType(run.id, 'test_decomposition_pipeline', false);
    const snapshotRecords = engine.writer.getRecordsByType(run.id, 'test_assumption_set_snapshot', false);
    const bundleRecords = engine.writer.getRecordsByType(run.id, 'decision_bundle_presented', false);

    const labels = buildNodeLabelMap(nodeRecords);

    const telemetryRow = db.prepare(`
      SELECT test_decomposition_budget_calls_used,
             test_decomposition_max_depth_reached,
             active_test_pipeline_id
      FROM workflow_runs WHERE id = ?
    `).get(run.id) as {
      test_decomposition_budget_calls_used: number;
      test_decomposition_max_depth_reached: number;
      active_test_pipeline_id: string | null;
    };

    // ── Normalize into a deterministic snapshot object ───────────────────
    const nodes = stableSort(
      nodeRecords.map(r => normalizeNode(r, labels)),
      n => `${String(n.content.display_key)}|${String(n.content.depth)}|` +
           `${String(n.content.pass_number)}|${String(n.content.status)}`,
    );
    const pipelines = stableSort(
      pipelineRecords.map(normalizePipeline),
      p => `${(p.content.passes as unknown[]).length}|` +
           `${p.content.final_leaf_count === undefined ? '0' : '1'}`,
    );
    const snapshots = stableSort(
      snapshotRecords.map(r => normalizeSnapshot(r, labels)),
      s => String(s.content.pass_number).padStart(4, '0'),
    );
    const bundles = stableSort(
      bundleRecords.map(normalizeBundle),
      b => String(b.content.bundle_id),
    );

    const telemetry = {
      test_decomposition_budget_calls_used: telemetryRow.test_decomposition_budget_calls_used,
      test_decomposition_max_depth_reached: telemetryRow.test_decomposition_max_depth_reached,
      // active_test_pipeline_id carries the random run-id prefix
      // (run.id.slice(0,8)) → replaced with a stable token.
      active_test_pipeline_id: telemetryRow.active_test_pipeline_id
        ?.replace(run.id.slice(0, 8), '<run8>') ?? null,
    };

    const normalized = { nodes, pipelines, snapshots, bundles, telemetry };

    // ── Coarse sanity assertions (meaningful even before the snapshot
    //    file exists on first run) ────────────────────────────────────────
    expect(normalized.nodes.length).toBeGreaterThan(0);
    // At least one leaf reached the terminal 'atomic' status.
    expect(normalized.nodes.some(n => n.content.status === 'atomic')).toBe(true);
    // The mixed scenario produces exactly five atomic Tier-D leaves
    // (alpha, beta, epic-leaf, mid-leaf, story-leaf); none are superseded.
    expect(normalized.nodes.filter(n => n.content.status === 'atomic')).toHaveLength(5);
    // The Tier-B mirror-gate branch was exercised (a Tier-B node exists and a
    // decision bundle was presented).
    expect(normalized.nodes.some(n => n.content.tier === 'B')).toBe(true);
    expect(normalized.bundles.length).toBeGreaterThanOrEqual(1);
    expect(String(normalized.bundles[0].content.bundle_id)).toMatch(/^test-decomp-gate-/);
    // The root produced children and therefore got a `decomposed` supersession.
    expect(normalized.nodes.some(n =>
      n.content.display_key === 'test-root' && n.content.status === 'decomposed')).toBe(true);
    // Assumptions surfaced across at least two passes → two snapshots.
    expect(normalized.snapshots.length).toBeGreaterThanOrEqual(2);
    // Telemetry recorded at least one decomposition LLM call.
    expect(normalized.telemetry.test_decomposition_budget_calls_used).toBeGreaterThanOrEqual(1);
    // Depth-2 tree (root → epic → epic-leaf).
    expect(normalized.telemetry.test_decomposition_max_depth_reached).toBe(2);

    // ── Golden snapshot: captures the exact behavior on first run ─────────
    expect(normalized).toMatchSnapshot();
  });
});
