/**
 * Wave 9 — RECORD-STREAM GOLDEN-SNAPSHOT characterization test for
 * `runDataModelSaturationLoop` (phase5_1a.ts).
 *
 * PURPOSE. This test pins the EXACT observable behavior of the data-model
 * saturation loop — the full persisted governed-stream record stream plus the
 * `workflow_runs` telemetry columns — BEFORE the ~660-line loop
 * (`runDataModelSaturationLoop`, cognitive complexity 244) is decomposed into
 * helpers. Any behavioral divergence introduced by the refactor (a dropped
 * record, a changed status transition, a reordered pass, a different tier
 * distribution, a lost supersession, a shifted assumption sequence, a moved
 * telemetry write) will flip the golden snapshot.
 *
 * DESIGN. One SINGLE representative scenario deliberately exercises many
 * branches at once, driven entirely by hermetic MockLLMProvider fixtures
 * (no network, in-memory DB, auto-approved decisions). It MIRRORS the
 * sibling task-loop golden (phase6_1aRunTaskSaturationLoopGolden.test.ts):
 *
 *   Pass 1 — decompose the depth-0 root `dm-root` into a MIX:
 *     • dm-leaf-alpha (Tier-D) → atomic, terminal
 *     • dm-leaf-beta  (Tier-D) → atomic, terminal
 *     • dm-agg        (Tier-A) → recurses next pass (queued this pass)
 *     • dm-cluster    (Tier-C) → one more pass (queued this pass)
 *     • dm-entity     (Tier-B) → FIRES THE MIRROR GATE (decision bundle),
 *                                 auto-accepted, queued for next pass
 *     + 2 surfaced assumptions (identity, ownership)
 *     → root gets a `decomposed` supersession.
 *
 *   Pass 2 — decompose the queued Tier-A / Tier-C / (auto-accepted) Tier-B:
 *     • dm-agg     → one Tier-D leaf (atomic) + 1 surfaced assumption
 *                    (assumptions ACROSS passes) → `decomposed` supersession
 *     • dm-cluster → one Tier-D leaf (atomic) → `decomposed` supersession
 *     • dm-entity  → one Tier-D leaf (atomic); agrees with Tier-B hint and
 *                    produces no Tier-B children → NOT downgraded →
 *                    `decomposed` supersession (post-gate clean path)
 *     → queue drains → fixed-point termination.
 *
 * This reaches depth 2, produces five atomic leaves, one mirror-gate bundle,
 * two assumption snapshots, and four pipeline records (anchor + 2 per-pass +
 * final).
 *
 * DETERMINISM. A data-model `DecompositionEntity` has NO free-text
 * `description` field (unlike a `DecompositionTask`), so — unlike the task
 * golden — a sentinel cannot be embedded in a description. Instead each
 * fixture is matched on a UNIQUE `[[MATCH_*]]` sentinel embedded as a
 * FIELD NAME on the entity. `formatEntityForPrompt` is the ONLY place a
 * node's own field list is rendered into its decomposition prompt; sibling
 * context and the depth-zero roster render only `id: name` (never fields),
 * and the ancestor chain renders only node ids. So a field-name sentinel
 * appears ONLY in that entity's OWN decomposition prompt and cannot
 * false-match a sibling / ancestor / depth-zero mention — which a bare
 * entity-id OR entity-name match key WOULD (ids and names both leak into
 * sibling bullets and the depth-zero roster). Leaf sentinels never enter any
 * prompt because Tier-D nodes are terminal.
 *
 * Under vitest `createEmbeddingClient()` returns the NoopEmbeddingClient
 * (see embeddings.ts) → `embed()` yields empty vectors → cosine similarity
 * is NaN → zero assumptions are flagged as duplicates. The dedup code path
 * still runs (branch coverage) but is a deterministic no-op, so
 * `semantic_delta` always equals the raw `delta_from_previous_pass`.
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
import { runDataModelSaturationLoop } from '../../../../lib/orchestrator/phases/phase5_1a';
import { MockLLMProvider } from '../../../helpers/mockLLMProvider';
import type {
  DecompositionEntity,
  GovernedStreamRecord,
  DataModelDecompositionNodeContent,
  DataModelDecompositionPipelineContent,
  DataModelAssumptionSetSnapshotContent,
} from '../../../../lib/types/records';

const extensionPath = path.resolve(__dirname, '..', '..', '..', '..', '..');
const workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'jc-p5-golden-ws-'));

// ── Seed helper (identical pattern to phase5_1aDataModelScope.test.ts) ──

function seedRootNode(
  engine: OrchestratorEngine,
  runId: string,
  entity: DecompositionEntity,
): { recordId: string; logicalNodeId: string } {
  const logicalNodeId = `root-${entity.id}-uuid`;
  const rec = engine.writer.writeRecord({
    record_type: 'data_model_decomposition_node',
    schema_version: '1.0',
    workflow_run_id: runId,
    phase_id: '5',
    sub_phase_id: '5.1a',
    produced_by_agent_role: 'technical_spec_agent',
    janumicode_version_sha: 'dev',
    derived_from_record_ids: [],
    content: {
      kind: 'data_model_decomposition_node',
      node_id: logicalNodeId,
      parent_node_id: null,
      display_key: entity.id,
      root_entity_id: logicalNodeId,
      depth: 0,
      pass_number: 0,
      status: 'pending',
      entity,
      surfaced_assumption_ids: [],
      release_id: null,
      release_ordinal: null,
    } as unknown as DataModelDecompositionNodeContent,
  });
  return { recordId: rec.id, logicalNodeId };
}

/**
 * Build a child-entity payload as the mock LLM would emit it. The sentinel is
 * carried as a dedicated FIELD NAME (see DETERMINISM above) so it renders ONLY
 * in this entity's own decomposition prompt.
 */
function childEntity(
  id: string,
  kind: DecompositionEntity['kind'],
  sentinel: string,
): Record<string, unknown> {
  return {
    id,
    name: `Entity ${id}`,
    kind,
    component_id: 'comp-x',
    fields: [
      { name: 'id', type: 'uuid', is_identity: true },
      { name: `${sentinel} marker`, type: 'string' },
    ],
    relationships: [],
  };
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

function nodeContent(r: GovernedStreamRecord): DataModelDecompositionNodeContent {
  return r.content as unknown as DataModelDecompositionNodeContent;
}

/**
 * node_id / parent_node_id / root_entity_id are logical UUIDs minted via
 * randomUUID() (or, for the seeded root, a test-local `root-<id>-uuid` seed
 * convention) — NON-DETERMINISTIC. We remap them to the stable, deterministic
 * `display_key` label so the tree LINKAGE (which the refactor must preserve) is
 * still pinned without leaking a raw UUID. All revisions of one logical node
 * share the same node_id AND display_key, so the map is consistent.
 */
function buildNodeLabelMap(nodeRecords: GovernedStreamRecord[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of nodeRecords) {
    const c = nodeContent(r);
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
    // superseded_by_id, superseded_at, is_current_version, …) is a
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
      root_ref: labels.get(c.root_entity_id) ?? c.root_entity_id,
      depth: c.depth,
      pass_number: c.pass_number,
      status: c.status,
      tier: c.tier,
      decomposition_rationale: c.decomposition_rationale,
      // DA-#### ids are a deterministic sequence (assignment order is fixed by
      // the deterministic queue + fixture order), so they are kept as-is.
      surfaced_assumption_ids: c.surfaced_assumption_ids,
      pruning_reason: c.pruning_reason,
      release_id: c.release_id,
      release_ordinal: c.release_ordinal,
      // The entity payload is fully deterministic given the fixtures:
      // sanitizeChildEntity is a pure transform, active_constraints resolve to
      // [] (no technical constraints supplied), traces_to is undefined. No
      // UUIDs or timestamps live inside the entity.
      entity: c.entity as unknown as Record<string, unknown>,
    },
  };
}

function normalizePipeline(r: GovernedStreamRecord): NormalizedRecord {
  const c = r.content as unknown as DataModelDecompositionPipelineContent;
  return {
    record_type: r.record_type,
    sub_phase_id: r.sub_phase_id,
    content: {
      kind: c.kind,
      // pipeline_id = `data-model-decomp-pipe-${workflowRun.id.slice(0,8)}` —
      // carries the random run-id prefix → NON-DETERMINISTIC. Replaced with a
      // fixed placeholder.
      pipeline_id: '<pipeline-id>',
      root_entity_id: c.root_entity_id,
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
  const c = r.content as unknown as DataModelAssumptionSetSnapshotContent;
  return {
    record_type: r.record_type,
    sub_phase_id: r.sub_phase_id,
    content: {
      kind: c.kind,
      pass_number: c.pass_number,
      root_entity_id: c.root_entity_id,
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
        // is the NoopEmbeddingClient so these are never set today — but we strip
        // them defensively so injecting a real embedder later can't leak a
        // non-deterministic value into the golden snapshot.
      })),
      delta_from_previous_pass: c.delta_from_previous_pass,
      semantic_delta: c.semantic_delta,
    },
  };
}

function normalizeBundle(r: GovernedStreamRecord): NormalizedRecord {
  // decision_bundle content (bundle_id / bundle_type / title / context / items)
  // is fully deterministic: bundle_id = `data-model-gate-<parent display_key>`,
  // items reference entity.id / kind / field counts / display_key only. No
  // UUIDs or timestamps live inside the content, so it is kept verbatim.
  return {
    record_type: r.record_type,
    sub_phase_id: r.sub_phase_id,
    content: r.content as unknown as Record<string, unknown>,
  };
}

// ── Test ────────────────────────────────────────────────────────────────

describe('runDataModelSaturationLoop — record-stream golden snapshot', () => {
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
    mock.setFixture('[[MATCH_ROOT]]', {
      match: '[[MATCH_ROOT]]',
      parsedJson: {
        parent_branch_classification: 'decomposable',
        parent_tier_assessment: { tier: 'A', agrees_with_hint: true, rationale: 'aggregate root' },
        children: [
          { ...childEntity('dm-leaf-alpha', 'value_type', '[[MATCH_ALPHA]]'), tier: 'D',
            decomposition_rationale: 'atomic value alpha' },
          { ...childEntity('dm-leaf-beta', 'value_type', '[[MATCH_BETA]]'), tier: 'D' },
          { ...childEntity('dm-agg', 'aggregate', '[[MATCH_AGG]]'), tier: 'A',
            decomposition_rationale: 'nested aggregate' },
          { ...childEntity('dm-cluster', 'entity', '[[MATCH_CLUSTER]]'), tier: 'C' },
          { ...childEntity('dm-entity', 'entity', '[[MATCH_ENTITY]]'), tier: 'B',
            decomposition_rationale: 'scope commitment' },
        ],
        surfaced_assumptions: [
          { text: 'Root aggregate owns its consistency boundary', category: 'identity' },
          { text: 'Root persists before acknowledging writes', category: 'ownership' },
        ],
      },
    });

    // Pass 2: Tier-A aggregate → one D leaf + one assumption (across-pass delta).
    mock.setFixture('[[MATCH_AGG]]', {
      match: '[[MATCH_AGG]]',
      parsedJson: {
        parent_branch_classification: 'decomposable',
        parent_tier_assessment: { tier: 'A', agrees_with_hint: true, rationale: 'still an aggregate' },
        children: [
          { ...childEntity('dm-agg-leaf', 'value_type', '[[MATCH_AGGLEAF]]'), tier: 'D' },
        ],
        surfaced_assumptions: [
          { text: 'Aggregate leaf shares the parent identity key', category: 'cardinality' },
        ],
      },
    });

    // Pass 2: Tier-C cluster → one D leaf, no assumptions.
    mock.setFixture('[[MATCH_CLUSTER]]', {
      match: '[[MATCH_CLUSTER]]',
      parsedJson: {
        parent_branch_classification: 'decomposable',
        parent_tier_assessment: { tier: 'C', agrees_with_hint: true, rationale: 'coherent cluster' },
        children: [
          { ...childEntity('dm-cluster-leaf', 'value_type', '[[MATCH_CLUSTERLEAF]]'), tier: 'D' },
        ],
        surfaced_assumptions: [],
      },
    });

    // Pass 2: auto-accepted Tier-B entity → one D leaf; agrees with hint and
    // produces no Tier-B child → NOT downgraded (post-gate clean path).
    mock.setFixture('[[MATCH_ENTITY]]', {
      match: '[[MATCH_ENTITY]]',
      parsedJson: {
        parent_branch_classification: 'decomposable',
        parent_tier_assessment: { tier: 'B', agrees_with_hint: true, rationale: 'commitment holds' },
        children: [
          { ...childEntity('dm-entity-leaf', 'value_type', '[[MATCH_ENTITYLEAF]]'), tier: 'D' },
        ],
        surfaced_assumptions: [],
      },
    });

    configureMock(mock);

    const { run } = engine.startWorkflowRun('ws', 'test');
    const root: DecompositionEntity = {
      id: 'dm-root',
      name: 'Root Aggregate',
      kind: 'aggregate',
      component_id: 'comp-x',
      fields: [
        { name: 'id', type: 'uuid', is_identity: true },
        { name: '[[MATCH_ROOT]] marker', type: 'string' },
      ],
      relationships: [],
      active_constraints: [],
      traces_to: [],
    };
    const seeded = seedRootNode(engine, run.id, root);

    await runDataModelSaturationLoop(
      { engine, workflowRun: { id: run.id } as Parameters<typeof runDataModelSaturationLoop>[0]['workflowRun'] },
      {
        technicalConstraints: [],
        componentSummary: 'comp-x: Component X (full-model fallback summary)',
        componentSummaryById: { 'comp-x': 'comp-x scoped context' },
        rootEntities: [root],
        rootNodeRecordIds: [seeded.recordId],
        rootLogicalIds: [seeded.logicalNodeId],
        systemRequirementsSummary: 'SR-001: the system persists domain entities',
      },
    );

    // ── Collect the FULL record stream (all versions) + telemetry ────────
    const nodeRecords = engine.writer.getRecordsByType(run.id, 'data_model_decomposition_node', false);
    const pipelineRecords = engine.writer.getRecordsByType(run.id, 'data_model_decomposition_pipeline', false);
    const snapshotRecords = engine.writer.getRecordsByType(run.id, 'data_model_assumption_set_snapshot', false);
    const bundleRecords = engine.writer.getRecordsByType(run.id, 'decision_bundle_presented', false);

    const labels = buildNodeLabelMap(nodeRecords);

    const telemetryRow = db.prepare(`
      SELECT data_model_decomposition_budget_calls_used,
             data_model_decomposition_max_depth_reached,
             active_data_model_pipeline_id
      FROM workflow_runs WHERE id = ?
    `).get(run.id) as {
      data_model_decomposition_budget_calls_used: number;
      data_model_decomposition_max_depth_reached: number;
      active_data_model_pipeline_id: string | null;
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
      b => String((b.content as { bundle_id?: unknown }).bundle_id),
    );

    const telemetry = {
      data_model_decomposition_budget_calls_used: telemetryRow.data_model_decomposition_budget_calls_used,
      data_model_decomposition_max_depth_reached: telemetryRow.data_model_decomposition_max_depth_reached,
      // active_data_model_pipeline_id carries the random run-id prefix
      // (run.id.slice(0,8)) → replaced with a stable token.
      active_data_model_pipeline_id: telemetryRow.active_data_model_pipeline_id
        ?.replace(run.id.slice(0, 8), '<run8>') ?? null,
    };

    const normalized = { nodes, pipelines, snapshots, bundles, telemetry };

    // ── Coarse sanity assertions (meaningful even before the snapshot file
    //    exists on first run) ─────────────────────────────────────────────
    expect(normalized.nodes.length).toBeGreaterThan(0);
    // At least one leaf reached the terminal 'atomic' status.
    expect(normalized.nodes.some(n => n.content.status === 'atomic')).toBe(true);
    // The decomposition reached depth 2 (a leaf under a recursed child).
    expect(normalized.nodes.some(n => n.content.depth === 2)).toBe(true);
    // The Tier-B mirror-gate branch was exercised (a Tier-B node exists and a
    // decision bundle was presented).
    expect(normalized.nodes.some(n => n.content.tier === 'B')).toBe(true);
    expect(normalized.bundles.length).toBeGreaterThanOrEqual(1);
    // The root produced children and therefore got a `decomposed` supersession.
    expect(normalized.nodes.some(n =>
      n.content.display_key === 'dm-root' && n.content.status === 'decomposed')).toBe(true);
    // Assumptions surfaced across at least two passes → two snapshots.
    expect(normalized.snapshots.length).toBeGreaterThanOrEqual(2);
    // A final pipeline record recorded a fixed-point termination.
    expect(normalized.pipelines.some(p =>
      (p.content.passes as Array<{ termination_reason?: string }>).some(
        pass => pass.termination_reason === 'fixed_point'))).toBe(true);
    // Telemetry recorded at least one decomposition LLM call.
    expect(normalized.telemetry.data_model_decomposition_budget_calls_used).toBeGreaterThanOrEqual(1);

    // ── Golden snapshot: captures the exact behavior on first run ─────────
    expect(normalized).toMatchSnapshot();
  });
});
