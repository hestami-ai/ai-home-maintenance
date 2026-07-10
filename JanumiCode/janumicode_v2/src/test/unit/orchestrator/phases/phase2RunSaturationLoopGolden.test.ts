/**
 * RECORD-STREAM GOLDEN-SNAPSHOT characterization test for
 * `Phase2Handler.runSaturationLoop` (phase2.ts, cognitive complexity 216).
 *
 * PURPOSE. This test pins the EXACT observable behavior of the FR/NFR
 * requirement decomposition saturation loop — the full persisted record
 * stream plus the workflow_runs decomposition telemetry columns — BEFORE the
 * ~900-line loop is decomposed into helpers. Any behavioral divergence
 * introduced by the refactor (a dropped record, a changed status transition,
 * a reordered pass, a different tier distribution, a lost supersession, a
 * shifted assumption sequence, a moved provenance sub_phase_id, a broken
 * mirror-gate bundle) will flip the golden snapshot.
 *
 * TARGET. `runSaturationLoop` is a PRIVATE method on `Phase2Handler`; the real
 * flow reaches it via `runFrDecomposition` AFTER `emitRootDecompositionNodes`
 * has written the depth-0 root node. We reproduce exactly that pre-condition:
 * seed one depth-0 `requirement_decomposition_node` (status 'pending',
 * sub_phase 'fr_bloom_skeleton', no root_kind — matching the FR root writer),
 * then invoke the method directly (cast past `private`). We leave the config
 * at its FR default (`fr_saturation`), so this pins the FR branch; the NFR
 * branch shares the same body via `SaturationLoopConfig`.
 *
 * SCENARIO — ONE run, MANY branches at once (hermetic: mock LLM, in-memory
 * DB, auto-approved decisions, Noop embedder under vitest):
 *
 *   Pass 1 — decompose depth-0 root `US-001` into a MIX:
 *     • task-leaf-alpha (Tier-D) → written 'atomic', terminal
 *     • task-leaf-beta  (Tier-D) → written 'atomic', terminal
 *     • task-epic       (Tier-A) → queued for next pass (recurse)
 *     • task-mid        (Tier-C) → queued for next pass (one more level)
 *     • task-story      (Tier-B) → FIRES THE MIRROR GATE (decision_bundle),
 *                                   auto-accepted, queued for next pass
 *     + 2 surfaced assumptions (scope, constraint)
 *     → root gets a `decomposed` supersession (provenance sub_phase preserved
 *        as 'fr_bloom_skeleton', NOT 'fr_saturation').
 *
 *   Pass 2 — decompose the queued Tier-A / Tier-C / accepted Tier-B:
 *     • task-epic  → one Tier-D leaf (atomic) + 1 surfaced assumption
 *                    (assumptions ACROSS passes) → `decomposed` supersession
 *     • task-mid   → one Tier-D leaf (atomic), no assumptions → `decomposed`
 *     • task-story → one Tier-D leaf (atomic); agrees with the Tier-B hint,
 *                    produces no Tier-B child → NOT downgraded → `decomposed`
 *                    (post-gate clean path; the AC-shape audit is off by
 *                    default so no reasoning_review_record is written)
 *     → queue drains → the `while (queue.length > 0)` guard terminates the
 *        loop → final pipeline record stamped `fixed_point`.
 *
 * This reaches depth 2, produces five atomic leaves, one mirror-gate bundle,
 * two assumption snapshots, four incremental pipeline records, and — because
 * the root `display_key` sits in the canonical `US-###` lineage — also
 * exercises `nestChildStoryId` (children nest to `US-001-1` … `US-001-5`, the
 * epic leaf to `US-001-3-1`) and `mintCompositeAcIds` (AC ids rewritten to
 * `AC-US001-###` / `AC-US-001-1-###`).
 *
 * DETERMINISM. Every LLM fixture is matched on a UNIQUE `[[MATCH_*]]` sentinel
 * embedded in each parent's acceptance-criterion `measurable_condition`. That
 * field appears in `{{parent_story}}` (the node being decomposed) but is the
 * ONE story field that NEVER appears in `{{sibling_context}}` — which the loop
 * renders as `id: action -> outcome` only. So a sentinel cannot false-match a
 * sibling / ancestor: matching on the story id (as the reference golden warns)
 * WOULD leak, because ids AND action/outcome flow into sibling bullets. Leaf
 * sentinels ([[MATCH_*LEAF]]) are inert — Tier-D nodes are terminal and never
 * decomposed, so those sentinels never enter any prompt.
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
import { OrchestratorEngine, type PhaseContext } from '../../../../lib/orchestrator/orchestratorEngine';
import { Phase2Handler } from '../../../../lib/orchestrator/phases/phase2';
import { MockLLMProvider } from '../../../helpers/mockLLMProvider';
import type {
  GovernedStreamRecord,
  ProductDescriptionHandoffContent,
  RequirementDecompositionNodeContent,
  RequirementDecompositionPipelineContent,
  AssumptionSetSnapshotContent,
} from '../../../../lib/types/records';

const extensionPath = path.resolve(__dirname, '..', '..', '..', '..', '..');
const workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'jc-p2-sat-'));

// ── Seed helper — replicates emitRootDecompositionNodes for ONE FR root ──
//
// The real flow writes the depth-0 root before runSaturationLoop runs. We
// reproduce it byte-for-byte: sub_phase 'fr_bloom_skeleton', root_kind
// OMITTED (the FR root writer omits it; only depth-1+ children + the root's
// own `decomposed` supersession tag it 'fr'), root_fr_id === node_id (self),
// status 'pending'. A fixed test-local node_id stands in for randomUUID(); it
// is remapped to the display_key in the snapshot, so its literal value never
// leaks.

function seedRootNode(
  engine: OrchestratorEngine,
  runId: string,
  story: Record<string, unknown>,
): { recordId: string; logicalNodeId: string } {
  const logicalNodeId = 'root-us-001-uuid';
  const rec = engine.writer.writeRecord({
    record_type: 'requirement_decomposition_node',
    schema_version: '1.0',
    workflow_run_id: runId,
    phase_id: '2',
    sub_phase_id: 'fr_bloom_skeleton',
    produced_by_agent_role: 'requirements_agent',
    janumicode_version_sha: 'dev',
    derived_from_record_ids: [],
    content: {
      kind: 'requirement_decomposition_node',
      node_id: logicalNodeId,
      parent_node_id: null,
      display_key: story.id as string,
      root_fr_id: logicalNodeId,
      depth: 0,
      pass_number: 0,
      status: 'pending',
      user_story: story,
      surfaced_assumption_ids: [],
      release_id: null,
      release_ordinal: null,
    } as unknown as RequirementDecompositionNodeContent,
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
 * which ties for records written in the same millisecond, so DB order is NOT
 * reliable across runs. We sort by a readable primary key first, then by the
 * full normalized JSON as the ultimate tiebreaker (identical strings sort
 * adjacent, so order among true duplicates is irrelevant).
 */
function stableSort<T>(arr: T[], primary: (x: T) => string): T[] {
  return [...arr].sort((a, b) => {
    const ka = `${primary(a)} ${JSON.stringify(a)}`;
    const kb = `${primary(b)} ${JSON.stringify(b)}`;
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}

function nodeContent(r: GovernedStreamRecord): RequirementDecompositionNodeContent {
  return r.content as unknown as RequirementDecompositionNodeContent;
}

/**
 * node_id / parent_node_id / root_fr_id are logical UUIDs minted via
 * randomUUID() (the seeded root uses a fixed test-local id) — NON-DETERMINISTIC.
 * We remap them to the stable, deterministic `display_key` so the tree LINKAGE
 * (which the refactor must preserve) is pinned without leaking a raw UUID. All
 * revisions of a logical node share the same node_id AND display_key, so the
 * map is consistent across the seed / atomic / decomposed / pruned / deferred
 * versions of a node.
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
    // keep (sub_phase_id pins the root's provenance preservation — its
    // `decomposed` version stays 'fr_bloom_skeleton', not 'fr_saturation').
    // Every other top-level field (id, produced_at, workflow_run_id,
    // janumicode_version_sha, derived_from_record_ids, is_current_version,
    // superseded_by_*) is a UUID / timestamp / run-scoped pointer — dropped
    // by simply not copying it.
    record_type: r.record_type,
    sub_phase_id: r.sub_phase_id,
    content: {
      kind: c.kind,
      // display_key IS the stable label; parent/root remapped through it.
      display_key: c.display_key,
      parent_ref: c.parent_node_id == null
        ? null
        : (labels.get(c.parent_node_id) ?? '<unmapped-parent>'),
      root_ref: labels.get(c.root_fr_id) ?? c.root_fr_id,
      depth: c.depth,
      pass_number: c.pass_number,
      status: c.status,
      // Optional fields coalesced to null so the snapshot renders identically
      // whether a field is absent (root: no tier / no root_kind) or set.
      tier: c.tier ?? null,
      root_kind: c.root_kind ?? null,
      decomposition_rationale: c.decomposition_rationale ?? null,
      // A-#### ids are a deterministic sequence (assignment order is fixed by
      // the deterministic queue + fixture order), so they are kept as-is.
      surfaced_assumption_ids: c.surfaced_assumption_ids,
      pruning_reason: c.pruning_reason ?? null,
      release_id: c.release_id,
      release_ordinal: c.release_ordinal,
      // The user_story payload is fully deterministic given the fixtures:
      // ids are nested by the pure nestChildStoryId(), AC ids minted by the
      // pure mintCompositeAcIds(), priority/traces coerced by the pure
      // sanitizeChildStory(). No UUIDs or timestamps live inside it.
      user_story: c.user_story as unknown as Record<string, unknown>,
    },
  };
}

function normalizePipeline(r: GovernedStreamRecord): NormalizedRecord {
  const c = r.content as unknown as RequirementDecompositionPipelineContent;
  return {
    record_type: r.record_type,
    sub_phase_id: r.sub_phase_id,
    content: {
      kind: c.kind,
      // pipeline_id = `decomp-pipe-fr-${workflowRun.id.slice(0,8)}` — carries
      // the random run-id prefix → NON-DETERMINISTIC. Replaced with a fixed
      // placeholder.
      pipeline_id: '<pipeline-id>',
      // root_fr_id is the fixed kind marker '*' (or '*nfr*') — deterministic.
      root_fr_id: c.root_fr_id,
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
    },
  };
}

function normalizeSnapshot(
  r: GovernedStreamRecord,
  labels: Map<string, string>,
): NormalizedRecord {
  const c = r.content as unknown as AssumptionSetSnapshotContent;
  return {
    record_type: r.record_type,
    sub_phase_id: r.sub_phase_id,
    content: {
      kind: c.kind,
      pass_number: c.pass_number,
      // Fixed kind marker '*' (FR) — deterministic.
      root_fr_id: c.root_fr_id,
      assumptions: c.assumptions.map(a => ({
        id: a.id,
        text: a.text,
        source: a.source,
        // surfaced_at_node is a logical UUID → remapped to display_key label.
        surfaced_at_ref: a.surfaced_at_node == null
          ? null
          : (labels.get(a.surfaced_at_node) ?? '<unmapped-node>'),
        surfaced_at_pass: a.surfaced_at_pass,
        category: a.category,
        citations: a.citations ?? null,
        // duplicate_of / duplicate_similarity are intentionally NOT copied:
        // duplicate_similarity is a float cosine score that depends on the
        // embedding backend. Under vitest the embedder is NoopEmbeddingClient
        // (empty vectors → cosineSimilarity returns NaN → never flagged), so
        // these are never set today — stripped defensively so injecting a real
        // embedder later can't leak a non-deterministic value into the golden.
      })),
      delta_from_previous_pass: c.delta_from_previous_pass,
      semantic_delta: c.semantic_delta,
    },
  };
}

/**
 * decision_bundle_presented content (surface_id / title / summary / mirror
 * items) is deterministic EXCEPT `surface_id`, which embeds the parent's
 * logical UUID (`decomp-gate-<parentNodeId>`). We remap every known node UUID
 * in the serialized content to its display_key so surface_id becomes
 * `decomp-gate-US-001`; everything else (title, summary assumption lines,
 * mirror item ids / text) contains no UUIDs or timestamps and passes through.
 */
function normalizeBundle(
  r: GovernedStreamRecord,
  labels: Map<string, string>,
): NormalizedRecord {
  let json = JSON.stringify(r.content);
  for (const [uuid, label] of labels) {
    json = json.split(uuid).join(label);
  }
  return {
    record_type: r.record_type,
    sub_phase_id: r.sub_phase_id,
    content: JSON.parse(json) as Record<string, unknown>,
  };
}

// ── Test ────────────────────────────────────────────────────────────────

describe('Phase2Handler.runSaturationLoop — record-stream golden snapshot', () => {
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

  it('pins the full persisted record stream + telemetry for a mixed-tier, multi-pass FR decomposition', async () => {
    const mock = new MockLLMProvider();

    // Pass 1: root → mix of D leaves, one A, one C, one B (mirror gate) + 2
    // surfaced assumptions. Sentinels live in AC measurable_condition only.
    mock.setFixture('[[MATCH_ROOT]]', {
      parsedJson: {
        parent_branch_classification: 'decomposable',
        parent_tier_assessment: { tier: 'A', agrees_with_hint: true, rationale: 'epic root' },
        children: [
          {
            id: 'task-leaf-alpha', tier: 'D', role: 'user',
            action: 'do alpha', outcome: 'alpha done', priority: 'high',
            traces_to: ['UJ-ROOT'],
            acceptance_criteria: [
              { id: 'AC-1', description: 'alpha', measurable_condition: 'alpha verified [[MATCH_ALPHA]]' },
            ],
            decomposition_rationale: 'single session alpha',
          },
          {
            id: 'task-leaf-beta', tier: 'D', role: 'user',
            action: 'do beta', outcome: 'beta done', priority: 'medium',
            traces_to: ['UJ-ROOT'],
            acceptance_criteria: [
              { id: 'AC-1', description: 'beta', measurable_condition: 'beta verified [[MATCH_BETA]]' },
            ],
          },
          {
            id: 'task-epic', tier: 'A', role: 'user',
            action: 'run epic area', outcome: 'epic structured', priority: 'high',
            traces_to: ['UJ-ROOT'],
            acceptance_criteria: [
              { id: 'AC-1', description: 'epic', measurable_condition: 'epic verified [[MATCH_EPIC]]' },
            ],
            decomposition_rationale: 'multi-cluster',
          },
          {
            id: 'task-mid', tier: 'C', role: 'user',
            action: 'implement mid', outcome: 'mid ready', priority: 'medium',
            traces_to: ['UJ-ROOT'],
            acceptance_criteria: [
              { id: 'AC-1', description: 'mid', measurable_condition: 'mid verified [[MATCH_MID]]' },
            ],
          },
          {
            id: 'task-story', tier: 'B', role: 'user',
            action: 'commit story scope', outcome: 'scope committed', priority: 'high',
            traces_to: ['UJ-ROOT'],
            acceptance_criteria: [
              { id: 'AC-1', description: 'story policy decided', measurable_condition: 'story scope decided [[MATCH_STORY]]' },
            ],
            decomposition_rationale: 'scope commitment',
          },
        ],
        surfaced_assumptions: [
          { text: 'Root work assumes a local cache', category: 'scope' },
          { text: 'Root commits before responding', category: 'constraint' },
        ],
      },
    });

    // Pass 2: Tier-A epic → one D leaf + one assumption (across-pass delta).
    mock.setFixture('[[MATCH_EPIC]]', {
      parsedJson: {
        parent_branch_classification: 'decomposable',
        parent_tier_assessment: { tier: 'A', agrees_with_hint: true, rationale: 'still epic' },
        children: [
          {
            id: 'task-epic-leaf', tier: 'D', role: 'user',
            action: 'do epic leaf', outcome: 'epic leaf done', priority: 'high',
            traces_to: ['UJ-ROOT'],
            acceptance_criteria: [
              { id: 'AC-1', description: 'epic leaf', measurable_condition: 'epic leaf verified [[MATCH_EPICLEAF]]' },
            ],
          },
        ],
        surfaced_assumptions: [
          { text: 'Epic leaf reuses the shared client', category: 'constraint' },
        ],
      },
    });

    // Pass 2: Tier-C mid → one D leaf, no assumptions.
    mock.setFixture('[[MATCH_MID]]', {
      parsedJson: {
        parent_branch_classification: 'decomposable',
        parent_tier_assessment: { tier: 'C', agrees_with_hint: true, rationale: 'coherent unit' },
        children: [
          {
            id: 'task-mid-leaf', tier: 'D', role: 'user',
            action: 'do mid leaf', outcome: 'mid leaf done', priority: 'medium',
            traces_to: ['UJ-ROOT'],
            acceptance_criteria: [
              { id: 'AC-1', description: 'mid leaf', measurable_condition: 'mid leaf verified [[MATCH_MIDLEAF]]' },
            ],
          },
        ],
        surfaced_assumptions: [],
      },
    });

    // Pass 2: auto-accepted Tier-B story → one D leaf; agrees with hint and
    // produces no Tier-B child → NOT downgraded (post-gate clean path).
    mock.setFixture('[[MATCH_STORY]]', {
      parsedJson: {
        parent_branch_classification: 'decomposable',
        parent_tier_assessment: { tier: 'B', agrees_with_hint: true, rationale: 'commitment holds' },
        children: [
          {
            id: 'task-story-leaf', tier: 'D', role: 'user',
            action: 'do story leaf', outcome: 'story leaf done', priority: 'high',
            traces_to: ['UJ-ROOT'],
            acceptance_criteria: [
              { id: 'AC-1', description: 'story leaf', measurable_condition: 'story leaf verified [[MATCH_STORYLEAF]]' },
            ],
          },
        ],
        surfaced_assumptions: [],
      },
    });

    configureMock(mock);

    const { run } = engine.startWorkflowRun('ws', 'test');

    // Canonical US-### root so nestChildStoryId + mintCompositeAcIds engage.
    // The [[MATCH_ROOT]] sentinel is in the AC measurable_condition, which
    // renders into {{parent_story}} but never into {{sibling_context}}.
    const rootStory: Record<string, unknown> = {
      id: 'US-001',
      role: 'account holder',
      action: 'manage my financial records',
      outcome: 'my books stay accurate',
      acceptance_criteria: [
        { id: 'AC-US001-001', description: 'root works', measurable_condition: 'root scenario verified [[MATCH_ROOT]]' },
      ],
      priority: 'high',
      traces_to: ['UJ-ROOT'],
    };

    const handoff = {
      kind: 'product_description_handoff',
      productVision: 'Vision',
      userJourneys: [],
      entityProposals: [],
      workflowProposals: [],
      qualityAttributes: [],
      technicalConstraints: [],
      vvRequirements: [],
      complianceExtractedItems: [],
      canonicalVocabulary: [],
      openQuestions: [],
    } as unknown as ProductDescriptionHandoffContent;

    const seeded = seedRootNode(engine, run.id, rootStory);

    const ctx = { engine, workflowRun: { id: run.id } } as unknown as PhaseContext;

    // runSaturationLoop is private — invoke it through a structural cast. We
    // leave `config` at its default (FR: fr_saturation / root_kind 'fr').
    const handler = new Phase2Handler();
    await (handler as unknown as {
      runSaturationLoop(
        ctx: PhaseContext,
        handoff: ProductDescriptionHandoffContent,
        rootStories: unknown[],
        rootNodeRecordIds: string[],
        rootLogicalIds: string[],
      ): Promise<void>;
    }).runSaturationLoop(ctx, handoff, [rootStory], [seeded.recordId], [seeded.logicalNodeId]);

    // ── Collect the FULL record stream (all versions) + telemetry ────────
    const nodeRecords = engine.writer.getRecordsByType(run.id, 'requirement_decomposition_node', false);
    const pipelineRecords = engine.writer.getRecordsByType(run.id, 'requirement_decomposition_pipeline', false);
    const snapshotRecords = engine.writer.getRecordsByType(run.id, 'assumption_set_snapshot', false);
    const bundleRecords = engine.writer.getRecordsByType(run.id, 'decision_bundle_presented', false);

    const labels = buildNodeLabelMap(nodeRecords);

    // Decomposition telemetry columns written by updateDecompositionTelemetry.
    // (Requirement decomposition has no active_*_pipeline_id column — only
    // component/task/data_model/test do — so there is none to capture here.)
    const telemetryRow = db.prepare(`
      SELECT decomposition_fr_calls_used,
             decomposition_nfr_calls_used,
             decomposition_budget_calls_used,
             decomposition_max_depth_reached
      FROM workflow_runs WHERE id = ?
    `).get(run.id) as {
      decomposition_fr_calls_used: number;
      decomposition_nfr_calls_used: number;
      decomposition_budget_calls_used: number;
      decomposition_max_depth_reached: number;
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
      bundleRecords.map(r => normalizeBundle(r, labels)),
      b => String((b.content as { surface_id?: string }).surface_id),
    );

    const telemetry = {
      decomposition_fr_calls_used: telemetryRow.decomposition_fr_calls_used,
      decomposition_nfr_calls_used: telemetryRow.decomposition_nfr_calls_used,
      decomposition_budget_calls_used: telemetryRow.decomposition_budget_calls_used,
      decomposition_max_depth_reached: telemetryRow.decomposition_max_depth_reached,
    };

    const normalized = { nodes, pipelines, snapshots, bundles, telemetry };

    // ── Coarse sanity assertions (meaningful even before the snapshot file
    //    exists on first run) ────────────────────────────────────────────
    expect(normalized.nodes.length).toBeGreaterThan(0);
    // At least one leaf reached the terminal 'atomic' status.
    expect(normalized.nodes.some(n => n.content.status === 'atomic')).toBe(true);
    // A leaf reached the deepest level (depth 2) as atomic — proves the loop
    // ran a SECOND pass and recursed the Tier-A branch.
    expect(normalized.nodes.some(n =>
      n.content.depth === 2 && n.content.status === 'atomic')).toBe(true);
    // The Tier-B mirror-gate branch was exercised (a Tier-B node exists and a
    // decision bundle was presented + auto-accepted).
    expect(normalized.nodes.some(n => n.content.tier === 'B')).toBe(true);
    expect(normalized.bundles.length).toBeGreaterThanOrEqual(1);
    // The root produced children and therefore got a `decomposed` supersession
    // whose provenance sub_phase stayed 'fr_bloom_skeleton'.
    expect(normalized.nodes.some(n =>
      n.content.display_key === 'US-001' && n.content.status === 'decomposed'
      && n.sub_phase_id === 'fr_bloom_skeleton')).toBe(true);
    // Assumptions surfaced across two passes → two snapshots.
    expect(normalized.snapshots.length).toBeGreaterThanOrEqual(2);
    // Clean fixed-point termination is stamped on the final pipeline record.
    expect(normalized.pipelines.some(p =>
      (p.content.passes as Array<{ termination_reason?: string }>)
        .some(pass => pass.termination_reason === 'fixed_point'))).toBe(true);
    // Telemetry recorded FR decomposition LLM calls; the NFR column stays 0.
    expect(normalized.telemetry.decomposition_fr_calls_used).toBeGreaterThanOrEqual(1);
    expect(normalized.telemetry.decomposition_nfr_calls_used).toBe(0);

    // ── Golden snapshot: captures the exact behavior on first run ─────────
    expect(normalized).toMatchSnapshot();
  });
});
