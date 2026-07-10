/**
 * Wave 7 — RECORD-STREAM GOLDEN-SNAPSHOT characterization test for
 * `runComponentSaturationLoop` (phase4_2a.ts).
 *
 * PURPOSE. This test pins the EXACT observable behavior of the component
 * saturation loop — the full persisted record stream plus the workflow_runs
 * telemetry columns — BEFORE the ~750-line loop is decomposed into helpers
 * (cognitive complexity 230). Any behavioral divergence introduced by the
 * refactor (a dropped record, a changed status transition, a reordered pass,
 * a different tier distribution, a lost supersession, a shifted CA-#### mint,
 * a missing mirror-gate bundle) will flip the golden snapshot.
 *
 * DESIGN. One SINGLE representative scenario deliberately exercises many
 * branches at once, driven entirely by hermetic MockLLMProvider fixtures
 * (no network, in-memory DB, auto-approved decisions):
 *
 *   Pass 1 — decompose the depth-0 root `comp-root` into a MIX:
 *     • comp-leaf-alpha (Tier-D) → atomic, terminal
 *     • comp-leaf-beta  (Tier-D) → atomic, terminal
 *     • comp-macro      (Tier-A) → recurses immediately (queued this pass)
 *     • comp-module     (Tier-C) → one more pass (queued this pass)
 *     • comp-domain     (Tier-B) → FIRES THE MIRROR GATE (decision bundle),
 *                                   auto-accepted, queued for next pass
 *     + 2 surfaced assumptions (integration_pattern, data_ownership)
 *     → root gets a `decomposed` supersession.
 *
 *   Pass 2 — decompose the queued Tier-A / Tier-C / (auto-accepted) Tier-B:
 *     • comp-macro  → one Tier-D leaf (atomic) + 1 surfaced assumption
 *                     (assumptions ACROSS passes) → `decomposed` supersession
 *     • comp-module → one Tier-D leaf (atomic) → `decomposed` supersession
 *     • comp-domain → one Tier-D leaf (atomic); agrees with Tier-B hint,
 *                     produces no Tier-B children → NOT downgraded →
 *                     `decomposed` supersession (post-gate clean audit path;
 *                     the Step-4c audit itself is off by default so it fires
 *                     no LLM call — component_reasoning_review_on_tier_c=false)
 *     → queue drains → fixed-point termination.
 *
 * This reaches depth 2, produces five atomic leaves, one mirror-gate bundle,
 * two assumption snapshots, and (start + 2 incremental + 1 final) pipeline
 * records.
 *
 * DETERMINISM. Every LLM fixture is matched on a UNIQUE `[[MATCH_*]]`
 * sentinel embedded in a RESPONSIBILITY description of each parent. A
 * responsibility description is the ONLY place a component's own free text
 * appears in its own decomposition prompt — `formatRootComponentForPrompt`
 * renders `[id] description` bullets, whereas `sibling_context` shows only
 * `id: name`, `domain_context` is the (sentinel-free) domains summary, and
 * `existing_assumptions` shows only the (sentinel-free) assumption texts. So
 * a sentinel cannot false-match a sibling / ancestor / assumption mention —
 * which a bare component-id match key WOULD (component ids leak into sibling
 * bullets). Tier-D leaf descriptions carry no registered sentinel because
 * Tier-D nodes are terminal and never re-enter a prompt.
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
import { runComponentSaturationLoop } from '../../../../lib/orchestrator/phases/phase4_2a';
import { MockLLMProvider } from '../../../helpers/mockLLMProvider';
import type {
  DecompositionComponent,
  GovernedStreamRecord,
  ComponentDecompositionNodeContent,
  ComponentDecompositionPipelineContent,
  ComponentAssumptionSetSnapshotContent,
  ProductDescriptionHandoffContent,
} from '../../../../lib/types/records';

const extensionPath = path.resolve(__dirname, '..', '..', '..', '..', '..');
const workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'jc-test-ws-'));

// ── Seed helper (identical pattern to phase4_2aSaturation.test.ts) ──────

function tinyHandoff(): ProductDescriptionHandoffContent {
  return {
    kind: 'product_description_handoff',
    schemaVersion: '1.1',
    requestCategory: 'product_or_feature',
    productVision: 'Test platform',
    productDescription: 'A test platform for Wave 7',
    summary: 'Test summary',
    personas: [],
    userJourneys: [],
    phasingStrategy: [],
    successMetrics: [],
    businessDomainProposals: [],
    entityProposals: [],
    workflowProposals: [],
    integrationProposals: [],
    qualityAttributes: [],
    uxRequirements: [],
    requirements: [],
    decisions: [],
    constraints: [],
    openQuestions: [],
    technicalConstraints: [],
    complianceExtractedItems: [],
    vvRequirements: [],
    canonicalVocabulary: [],
    humanDecisions: [],
    openLoops: [],
  };
}

function seedRootNode(
  engine: OrchestratorEngine,
  runId: string,
  component: DecompositionComponent,
): { recordId: string; logicalNodeId: string } {
  const logicalNodeId = `root-${component.id}-uuid`;
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
      node_id: logicalNodeId,
      parent_node_id: null,
      display_key: component.id,
      root_component_id: logicalNodeId,
      depth: 0,
      pass_number: 0,
      status: 'pending',
      component,
      surfaced_assumption_ids: [],
      release_id: null,
      release_ordinal: null,
    } satisfies ComponentDecompositionNodeContent,
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
 * node_id / parent_node_id / root_component_id are logical UUIDs minted via
 * randomUUID() (or, for the seeded root, a test-local seed convention) —
 * NON-DETERMINISTIC. We remap them to the stable, deterministic `display_key`
 * label so the tree LINKAGE (which the refactor must preserve) is still pinned
 * without leaking a raw UUID.
 */
function nodeContent(r: GovernedStreamRecord): ComponentDecompositionNodeContent {
  return r.content as unknown as ComponentDecompositionNodeContent;
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
    // superseded_by_*, is_current_version, etc.) is a UUID / timestamp /
    // run-scoped pointer — dropped by simply not copying it.
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
      root_ref: labels.get(c.root_component_id) ?? c.root_component_id,
      depth: c.depth,
      pass_number: c.pass_number,
      status: c.status,
      tier: c.tier,
      decomposition_rationale: c.decomposition_rationale,
      // CA-<n> ids are a deterministic sequence (mint order is fixed by the
      // deterministic queue + fixture order), so they are kept as-is.
      surfaced_assumption_ids: c.surfaced_assumption_ids,
      pruning_reason: c.pruning_reason,
      release_id: c.release_id,
      release_ordinal: c.release_ordinal,
      // The component payload is fully deterministic given the fixtures:
      // id / name / responsibilities (fixture-provided, sentinels are literal
      // strings) / dependencies / domain_id resolve deterministically;
      // active_constraints inherit to [] here (no root constraints, empty
      // technicalConstraints). No UUIDs or timestamps inside.
      component: c.component as unknown as Record<string, unknown>,
      // NOTE: atomic_criteria_satisfied is intentionally NOT copied — it is
      // only ever written by the Step-4c responsibility-shape audit, which is
      // off by default (component_reasoning_review_on_tier_c=false) and so
      // never fires in this scenario. See flag note in the returned summary.
    },
  };
}

function normalizePipeline(r: GovernedStreamRecord): NormalizedRecord {
  const c = r.content as unknown as ComponentDecompositionPipelineContent;
  return {
    record_type: r.record_type,
    sub_phase_id: r.sub_phase_id,
    content: {
      kind: c.kind,
      // pipeline_id = `comp-decomp-pipe-${workflowRun.id.slice(0,8)}` — carries
      // the random run-id prefix → NON-DETERMINISTIC. Replaced with a fixed
      // placeholder.
      pipeline_id: '<pipeline-id>',
      // root_component_id on the pipeline container is the literal '*'
      // (spans all roots) → deterministic, kept verbatim.
      root_component_id: c.root_component_id,
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
  const c = r.content as unknown as ComponentAssumptionSetSnapshotContent;
  return {
    record_type: r.record_type,
    sub_phase_id: r.sub_phase_id,
    content: {
      kind: c.kind,
      pass_number: c.pass_number,
      // root_component_id on the snapshot is the literal '*' → deterministic.
      root_component_id: c.root_component_id,
      assumptions: c.assumptions.map(a => ({
        // CA-#### ids are a deterministic mint sequence, kept as-is.
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
        // is the NoopEmbeddingClient (embed → [] per input), so these are never
        // set today — but we strip them defensively so injecting a real
        // embedder later can't leak a non-deterministic value into the golden.
      })),
      delta_from_previous_pass: c.delta_from_previous_pass,
      semantic_delta: c.semantic_delta,
    },
  };
}

function normalizeBundle(r: GovernedStreamRecord): NormalizedRecord {
  // decision_bundle content (bundle_id / bundle_type / title / context /
  // items) is fully deterministic: bundle_id = `comp-decomp-gate-<display_key>`,
  // items reference component.id / name / display_key / counts only. No UUIDs
  // or timestamps live inside the content, so it is kept verbatim.
  return {
    record_type: r.record_type,
    sub_phase_id: r.sub_phase_id,
    content: r.content as unknown as Record<string, unknown>,
  };
}

// ── Test ────────────────────────────────────────────────────────────────

describe('runComponentSaturationLoop — record-stream golden snapshot', () => {
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
    engine.configManager.setDomainInterpreterRouting({
      primary: { backing_tool: 'direct_llm_api', provider: 'llamacpp', model: 'qwen3.5:9b' },
      temperature: 0.5,
    });
  }

  it('pins the full persisted record stream + telemetry for a mixed-tier, multi-pass decomposition', async () => {
    const mock = new MockLLMProvider();

    // Pass 1: root → mix of D leaves, one A, one C, one B (mirror gate).
    mock.setFixture('[[MATCH_ROOT]]', {
      match: '[[MATCH_ROOT]]',
      parsedJson: {
        parent_branch_classification: 'decomposable',
        parent_tier_assessment: { tier: 'A', agrees_with_hint: true, rationale: 'macro subsystem' },
        children: [
          {
            id: 'comp-leaf-alpha', tier: 'D', name: 'Leaf Alpha',
            responsibilities: [{ id: 'resp-alpha-1', description: 'Validate alpha inputs' }],
            dependencies: [{ component_id: 'comp-audit', kind: 'async_event' }],
            decomposition_rationale: 'concrete leaf module',
          },
          {
            id: 'comp-leaf-beta', tier: 'D', name: 'Leaf Beta',
            responsibilities: [{ id: 'resp-beta-1', description: 'Persist beta records' }],
            dependencies: [],
          },
          {
            id: 'comp-macro', tier: 'A', name: 'Macro Subsystem',
            responsibilities: [{ id: 'resp-macro-1', description: 'Coordinate macro flow [[MATCH_MACRO]]' }],
            dependencies: [],
            decomposition_rationale: 'multi-cluster',
          },
          {
            id: 'comp-module', tier: 'C', name: 'Module Task',
            responsibilities: [{ id: 'resp-module-1', description: 'Assemble module outputs [[MATCH_MODULE]]' }],
            dependencies: [],
          },
          {
            id: 'comp-domain', tier: 'B', name: 'Domain Commitment',
            responsibilities: [{ id: 'resp-domain-1', description: 'Own domain boundary [[MATCH_DOMAIN]]' }],
            dependencies: [],
            decomposition_rationale: 'scope commitment',
          },
        ],
        surfaced_assumptions: [
          { text: 'State transitions persist via async event', category: 'integration_pattern' },
          { text: 'Media validator owns size and type checks', category: 'data_ownership' },
        ],
      },
    });

    // Pass 2: Tier-A macro → one D leaf + one assumption (across-pass delta).
    mock.setFixture('[[MATCH_MACRO]]', {
      match: '[[MATCH_MACRO]]',
      parsedJson: {
        parent_branch_classification: 'decomposable',
        parent_tier_assessment: { tier: 'A', agrees_with_hint: true, rationale: 'still macro' },
        children: [
          {
            id: 'comp-macro-leaf', tier: 'D', name: 'Macro Leaf',
            responsibilities: [{ id: 'resp-macroleaf-1', description: 'Execute macro step' }],
            dependencies: [],
          },
        ],
        surfaced_assumptions: [
          { text: 'Macro leaf reuses the shared client', category: 'cross_cutting' },
        ],
      },
    });

    // Pass 2: Tier-C module → one D leaf, no assumptions.
    mock.setFixture('[[MATCH_MODULE]]', {
      match: '[[MATCH_MODULE]]',
      parsedJson: {
        parent_branch_classification: 'decomposable',
        parent_tier_assessment: { tier: 'C', agrees_with_hint: true, rationale: 'coherent unit' },
        children: [
          {
            id: 'comp-module-leaf', tier: 'D', name: 'Module Leaf',
            responsibilities: [{ id: 'resp-moduleleaf-1', description: 'Emit module artifact' }],
            dependencies: [],
          },
        ],
        surfaced_assumptions: [],
      },
    });

    // Pass 2: auto-accepted Tier-B domain → one D leaf; agrees with hint and
    // produces no Tier-B child → NOT downgraded (post-gate clean path).
    mock.setFixture('[[MATCH_DOMAIN]]', {
      match: '[[MATCH_DOMAIN]]',
      parsedJson: {
        parent_branch_classification: 'decomposable',
        parent_tier_assessment: { tier: 'B', agrees_with_hint: true, rationale: 'commitment holds' },
        children: [
          {
            id: 'comp-domain-leaf', tier: 'D', name: 'Domain Leaf',
            responsibilities: [{ id: 'resp-domainleaf-1', description: 'Fulfil domain contract' }],
            dependencies: [],
          },
        ],
        surfaced_assumptions: [],
      },
    });

    configureMock(mock);

    const { run } = engine.startWorkflowRun('ws', 'test');
    const root: DecompositionComponent = {
      id: 'comp-root',
      name: 'Root Subsystem',
      responsibilities: [{ id: 'resp-root-1', description: 'Orchestrate the whole thing [[MATCH_ROOT]]' }],
      dependencies: [],
    };
    const seeded = seedRootNode(engine, run.id, root);

    await runComponentSaturationLoop(
      { engine, workflowRun: { id: run.id } as Parameters<typeof runComponentSaturationLoop>[0]['workflowRun'] },
      {
        handoff: tinyHandoff(),
        technicalConstraints: [],
        domainsSummary: 'domain-service-fulfillment overview',
        rootComponents: [root],
        rootNodeRecordIds: [seeded.recordId],
        rootLogicalIds: [seeded.logicalNodeId],
      },
    );

    // ── Collect the FULL record stream (all versions) + telemetry ────────
    const nodeRecords = engine.writer.getRecordsByType(run.id, 'component_decomposition_node', false);
    const pipelineRecords = engine.writer.getRecordsByType(run.id, 'component_decomposition_pipeline', false);
    const snapshotRecords = engine.writer.getRecordsByType(run.id, 'component_assumption_set_snapshot', false);
    const bundleRecords = engine.writer.getRecordsByType(run.id, 'decision_bundle_presented', false);

    const labels = buildNodeLabelMap(nodeRecords);

    const telemetryRow = db.prepare(`
      SELECT component_decomposition_budget_calls_used,
             component_decomposition_max_depth_reached,
             active_component_pipeline_id
      FROM workflow_runs WHERE id = ?
    `).get(run.id) as {
      component_decomposition_budget_calls_used: number;
      component_decomposition_max_depth_reached: number;
      active_component_pipeline_id: string | null;
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
      component_decomposition_budget_calls_used: telemetryRow.component_decomposition_budget_calls_used,
      component_decomposition_max_depth_reached: telemetryRow.component_decomposition_max_depth_reached,
      // active_component_pipeline_id carries the random run-id prefix
      // (run.id.slice(0,8)) → replaced with a stable token.
      active_component_pipeline_id: telemetryRow.active_component_pipeline_id
        ?.replace(run.id.slice(0, 8), '<run8>') ?? null,
    };

    const normalized = { nodes, pipelines, snapshots, bundles, telemetry };

    // ── Coarse sanity assertions (meaningful even before the snapshot
    //    file exists on first run) ────────────────────────────────────────
    expect(normalized.nodes.length).toBeGreaterThan(0);
    // At least one leaf reached the terminal 'atomic' status.
    expect(normalized.nodes.some(n => n.content.status === 'atomic')).toBe(true);
    // The Tier-B mirror-gate branch was exercised (a Tier-B node exists and a
    // decision bundle was presented).
    expect(normalized.nodes.some(n => n.content.tier === 'B')).toBe(true);
    expect(normalized.bundles.length).toBeGreaterThanOrEqual(1);
    // The root produced children and therefore got a `decomposed` supersession.
    expect(normalized.nodes.some(n =>
      n.content.display_key === 'comp-root' && n.content.status === 'decomposed')).toBe(true);
    // Assumptions surfaced across at least two passes → two snapshots.
    expect(normalized.snapshots.length).toBeGreaterThanOrEqual(2);
    // The final pipeline record carries the leaf-count / tier-distribution roll-up.
    expect(normalized.pipelines.some(p => p.content.final_leaf_count !== undefined)).toBe(true);
    // Telemetry recorded at least one decomposition LLM call.
    expect(normalized.telemetry.component_decomposition_budget_calls_used).toBeGreaterThanOrEqual(1);

    // ── Golden snapshot: captures the exact behavior on first run ─────────
    expect(normalized).toMatchSnapshot();
  });
});
