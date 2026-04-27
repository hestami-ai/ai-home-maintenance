/**
 * Decomposition Viewer — data provider.
 *
 * All read-only queries against the governed_stream SQLite table that
 * the viewer needs to render. Returns a fully-populated ViewerSnapshot.
 *
 * Expensive queries are cheap enough at current scale (cal-19: ~850
 * nodes + ~540 assumptions) to re-run on every poll. If this ever grows
 * to 10K+ nodes we'd move to row-level deltas via content-hash
 * comparisons, but the current implementation keeps things simple.
 */

import type { Database } from '../database/init';
import * as crypto from 'node:crypto';
import type {
  Phase1AnchorKind,
  ViewerAssumption,
  ViewerCrossCuttingCounts,
  ViewerDecompositionNode,
  ViewerIntentSummary,
  ViewerNfrApplication,
  ViewerPhase1Anchor,
  ViewerPipelinePass,
  ViewerPipelineSummary,
  ViewerRelease,
  ViewerRootKind,
  ViewerRootSummary,
  ViewerSnapshot,
  ViewerStatus,
  ViewerTier,
} from './types';

/**
 * Read-only queries against the governed_stream SQLite table.
 * Designed to run every ~3 seconds from a polling loop.
 */
export class DecompViewerDataProvider {
  constructor(private readonly db: Database) {}

  /**
   * Build a full ViewerSnapshot for a given workflow run. Uses
   * is_current_version=1 filtering throughout so supersession works
   * transparently (pruned/downgraded nodes reflect their latest state).
   */
  getSnapshot(workflowRunId: string): ViewerSnapshot {
    const runRow = this.db
      .prepare(
        `SELECT current_phase_id, current_sub_phase_id, status
         FROM workflow_runs WHERE id = ?`,
      )
      .get(workflowRunId) as
        | { current_phase_id: string | null; current_sub_phase_id: string | null; status: string }
        | undefined;

    const nodes = this.loadNodes(workflowRunId);
    const roots = this.buildRootSummaries(nodes);
    const assumptions = this.loadAssumptions(workflowRunId);
    const pipelines = this.loadPipelines(workflowRunId);
    const { releases, crossCutting } = this.loadReleaseManifest(workflowRunId);
    const phase1Anchors = this.loadPhase1Anchors(workflowRunId);
    const nfrApplications = this.loadNfrApplications(workflowRunId);
    const intentSummary = this.loadIntentSummary(workflowRunId);

    const duplicateAssumptions = assumptions.filter(a => !!a.duplicate_of).length;
    const byStatus: Record<ViewerStatus, number> = {};
    for (const n of nodes) {
      byStatus[n.status] = (byStatus[n.status] ?? 0) + 1;
    }

    const snapshotAt = new Date().toISOString();
    const snapshot: ViewerSnapshot = {
      workflow_run_id: workflowRunId,
      snapshot_at: snapshotAt,
      revision: '', // filled below
      phase_id: runRow?.current_phase_id ?? null,
      sub_phase_id: runRow?.current_sub_phase_id ?? null,
      run_status: runRow?.status ?? 'unknown',
      nodes,
      roots,
      assumptions,
      pipelines,
      releases,
      cross_cutting: crossCutting,
      phase1_anchors: phase1Anchors,
      nfr_applications: nfrApplications,
      intent_summary: intentSummary,
      totals: {
        nodes: nodes.length,
        atomic: byStatus['atomic'] ?? 0,
        pending: byStatus['pending'] ?? 0,
        pruned: byStatus['pruned'] ?? 0,
        deferred: byStatus['deferred'] ?? 0,
        downgraded: byStatus['downgraded'] ?? 0,
        roots: roots.length,
        assumptions: assumptions.length,
        duplicate_assumptions: duplicateAssumptions,
      },
    };
    snapshot.revision = this.computeRevision(snapshot);
    return snapshot;
  }

  /**
   * Compute a cheap hash over the snapshot's load-bearing fields. Used
   * by the editor's polling loop to skip posting no-op updates to the
   * webview. Timestamps are excluded so two identical polls produce the
   * same revision even a minute apart.
   */
  private computeRevision(s: ViewerSnapshot): string {
    const h = crypto.createHash('sha256');
    h.update(`phase:${s.phase_id}/${s.sub_phase_id}|status:${s.run_status}|`);
    h.update(`nodes:${s.nodes.length}|`);
    for (const n of s.nodes) {
      h.update(`${n.record_id}:${n.status}:${n.tier}:${n.pass_number}|`);
    }
    h.update(`assumptions:${s.assumptions.length}|`);
    for (const a of s.assumptions) {
      h.update(`${a.id}:${a.duplicate_of ?? ''}|`);
    }
    h.update(`pipelines:${s.pipelines.length}|`);
    for (const p of s.pipelines) {
      h.update(`${p.root_kind}:${p.termination_reason ?? ''}:${p.passes.length}|`);
      for (const pp of p.passes) {
        h.update(`${pp.pass_number}:${pp.status}:${pp.nodes_produced}:${pp.assumption_delta}|`);
      }
    }
    h.update(`releases:${s.releases.length}|`);
    for (const r of s.releases) {
      h.update(`${r.release_id}:${r.ordinal}|`);
    }
    h.update(`anchors:${s.phase1_anchors.length}|`);
    for (const a of s.phase1_anchors) h.update(`${a.id}:${a.kind}|`);
    h.update(`nfr_apps:${s.nfr_applications.length}|`);
    for (const a of s.nfr_applications) {
      h.update(`${a.nfr_id}:${a.applies_to_requirements.join(',')}|`);
    }
    return h.digest('hex').slice(0, 16);
  }

  // ── Decomposition nodes ──────────────────────────────────────────

  private loadNodes(workflowRunId: string): ViewerDecompositionNode[] {
    const rows = this.db
      .prepare(
        `SELECT id, content, produced_at
         FROM governed_stream
         WHERE record_type = 'requirement_decomposition_node'
           AND is_current_version = 1
           AND workflow_run_id = ?
         ORDER BY produced_at ASC`,
      )
      .all(workflowRunId) as Array<{ id: string; content: string; produced_at: string }>;

    const parsed = rows.map(r => {
      const c = JSON.parse(r.content) as Record<string, unknown>;
      const story = (c.user_story ?? {}) as Record<string, unknown>;
      const rawAcs = Array.isArray(story.acceptance_criteria)
        ? (story.acceptance_criteria as Array<Record<string, unknown>>)
        : [];
      return {
        record_id: r.id,
        node_id: (c.node_id as string) ?? r.id,
        display_key: (c.display_key as string) ?? '',
        parent_node_id: (c.parent_node_id as string | null) ?? null,
        root_fr_id: (c.root_fr_id as string) ?? '',
        root_kind: (c.root_kind as ViewerRootKind) ?? null,
        tier: (c.tier as ViewerTier) ?? null,
        tier_hint: (c.tier_hint as ViewerTier) ?? null,
        status: (c.status as ViewerStatus) ?? 'pending',
        depth: typeof c.depth === 'number' ? c.depth : 0,
        pass_number: typeof c.pass_number === 'number' ? c.pass_number : 0,
        release_id: (c.release_id as string | null) ?? null,
        release_ordinal: typeof c.release_ordinal === 'number' ? c.release_ordinal : null,
        story_role: (story.role as string) ?? '',
        story_action: (story.action as string) ?? '',
        story_outcome: (story.outcome as string) ?? '',
        acceptance_criteria: rawAcs.map(ac => ({
          id: (ac.id as string) ?? '',
          description: (ac.description as string) ?? '',
          measurable_condition: (ac.measurable_condition as string) ?? '',
        })),
        priority: (story.priority as string) ?? undefined,
        tier_rationale: (c.tier_rationale as string) ?? undefined,
        surfaced_assumption_ids: Array.isArray(c.surfaced_assumption_ids)
          ? (c.surfaced_assumption_ids as unknown[]).filter(
              (x): x is string => typeof x === 'string',
            )
          : [],
        traces_to: Array.isArray(story.traces_to)
          ? (story.traces_to as unknown[]).filter(
              (x): x is string => typeof x === 'string',
            )
          : [],
        produced_at: r.produced_at,
        pruning_reason: (c.pruning_reason as string) ?? undefined,
        downgrade_reason: (c.downgrade_reason as string) ?? undefined,
        children_display_keys: [], // filled in next pass
      } as ViewerDecompositionNode;
    });

    // Derive children_display_keys: group by parent_node_id so each
    // node's children_display_keys is the sorted list of their display_keys.
    const byParent = new Map<string, string[]>();
    for (const n of parsed) {
      if (n.parent_node_id) {
        const arr = byParent.get(n.parent_node_id) ?? [];
        arr.push(n.display_key);
        byParent.set(n.parent_node_id, arr);
      }
    }
    for (const n of parsed) {
      n.children_display_keys = (byParent.get(n.node_id) ?? []).sort();
    }
    return parsed;
  }

  // ── Root summaries ───────────────────────────────────────────────

  private buildRootSummaries(nodes: ViewerDecompositionNode[]): ViewerRootSummary[] {
    // Group nodes by root_fr_id + root_kind.
    const byRoot = new Map<string, ViewerDecompositionNode[]>();
    for (const n of nodes) {
      const key = `${n.root_kind ?? 'fr'}:${n.root_fr_id}`;
      const arr = byRoot.get(key) ?? [];
      arr.push(n);
      byRoot.set(key, arr);
    }

    const summaries: ViewerRootSummary[] = [];
    for (const [, group] of byRoot) {
      const root = group.find(n => n.depth === 0);
      if (!root) continue;

      const tierCounts = { A: 0, B: 0, C: 0, D: 0, null: 0 };
      const statusCounts: Record<string, number> = {};
      let maxDepth = 0;
      for (const n of group) {
        const t = (n.tier ?? 'null') as keyof typeof tierCounts;
        tierCounts[t] = (tierCounts[t] ?? 0) + 1;
        statusCounts[n.status] = (statusCounts[n.status] ?? 0) + 1;
        if (n.depth > maxDepth) maxDepth = n.depth;
      }

      summaries.push({
        root_fr_id: root.root_fr_id,
        root_kind: root.root_kind,
        display_key: root.display_key,
        title: root.story_action || root.display_key,
        release_id: root.release_id,
        release_ordinal: root.release_ordinal,
        node_count_total: group.length,
        tier_counts: tierCounts,
        status_counts: statusCounts,
        max_depth: maxDepth,
      });
    }

    // Order: kind (fr before nfr) → release_ordinal (nulls last) → display_key.
    summaries.sort((a, b) => {
      const ka = a.root_kind === 'nfr' ? 1 : 0;
      const kb = b.root_kind === 'nfr' ? 1 : 0;
      if (ka !== kb) return ka - kb;
      const oa = a.release_ordinal ?? Number.POSITIVE_INFINITY;
      const ob = b.release_ordinal ?? Number.POSITIVE_INFINITY;
      if (oa !== ob) return oa - ob;
      return a.display_key.localeCompare(b.display_key);
    });
    return summaries;
  }

  // ── Assumptions ──────────────────────────────────────────────────

  private loadAssumptions(workflowRunId: string): ViewerAssumption[] {
    // Take the latest snapshot per root_kind. Wave 6 writes a fresh
    // assumption_set_snapshot each pass; we want the most-recent for fr
    // and nfr so the viewer reflects the current de-duplicated state.
    const rows = this.db
      .prepare(
        `SELECT content, produced_at
         FROM governed_stream
         WHERE record_type = 'assumption_set_snapshot'
           AND is_current_version = 1
           AND workflow_run_id = ?
         ORDER BY produced_at DESC`,
      )
      .all(workflowRunId) as Array<{ content: string; produced_at: string }>;

    const byKind = new Map<string, Array<Record<string, unknown>>>();
    for (const r of rows) {
      const c = JSON.parse(r.content) as Record<string, unknown>;
      const kind = (c.root_kind as string) ?? 'fr';
      if (byKind.has(kind)) continue; // already have the latest for this kind
      const arr = Array.isArray(c.assumptions) ? (c.assumptions as Array<Record<string, unknown>>) : [];
      byKind.set(kind, arr);
    }

    const out: ViewerAssumption[] = [];
    for (const [, arr] of byKind) {
      for (const a of arr) {
        out.push({
          id: (a.id as string) ?? '',
          text: (a.text as string) ?? '',
          category: (a.category as string) ?? 'scope',
          citations: Array.isArray(a.citations)
            ? (a.citations as unknown[]).filter((x): x is string => typeof x === 'string')
            : undefined,
          surfaced_at_node: (a.surfaced_at_node as string) ?? '',
          surfaced_at_pass: typeof a.surfaced_at_pass === 'number' ? a.surfaced_at_pass : 0,
          source: (a.source as string) ?? undefined,
          duplicate_of: (a.duplicate_of as string) ?? undefined,
          duplicate_similarity:
            typeof a.duplicate_similarity === 'number'
              ? a.duplicate_similarity
              : undefined,
        });
      }
    }
    return out;
  }

  // ── Pipeline telemetry ───────────────────────────────────────────

  private loadPipelines(workflowRunId: string): ViewerPipelineSummary[] {
    // sub_phase_id and pipeline_id are read because the orchestrator
    // doesn't (yet) emit `root_kind` on this record. The pipeline
    // belongs to FR when sub_phase_id='2.1a' or pipeline_id starts
    // with 'decomp-pipe-fr-', and NFR for '2.2a' / 'decomp-pipe-nfr-'.
    const rows = this.db
      .prepare(
        `SELECT content, sub_phase_id
         FROM governed_stream
         WHERE record_type = 'requirement_decomposition_pipeline'
           AND is_current_version = 1
           AND workflow_run_id = ?`,
      )
      .all(workflowRunId) as Array<{ content: string; sub_phase_id: string | null }>;

    const out: ViewerPipelineSummary[] = [];
    for (const r of rows) {
      const c = JSON.parse(r.content) as Record<string, unknown>;
      const passesRaw = Array.isArray(c.passes) ? (c.passes as Array<Record<string, unknown>>) : [];
      const passes: ViewerPipelinePass[] = passesRaw.map(p => ({
        pass_number: typeof p.pass_number === 'number' ? p.pass_number : 0,
        status: (p.status as string) ?? 'pending',
        started_at: (p.started_at as string) ?? null,
        completed_at: (p.completed_at as string) ?? null,
        nodes_produced: typeof p.nodes_produced === 'number' ? p.nodes_produced : 0,
        assumption_delta: typeof p.assumption_delta === 'number' ? p.assumption_delta : 0,
        termination_reason: (p.termination_reason as string) ?? undefined,
      }));
      out.push({
        root_kind:
          (c.root_kind as ViewerRootKind | undefined)
          ?? derivePipelineRootKind(r.sub_phase_id, c.pipeline_id as string | undefined),
        passes,
        termination_reason: (c.termination_reason as string) ?? undefined,
        budget_calls_used:
          typeof c.budget_calls_used === 'number' ? c.budget_calls_used : undefined,
        max_depth_reached:
          typeof c.max_depth_reached === 'number' ? c.max_depth_reached : undefined,
      });
    }
    // Stable order: FR before NFR so the rail's two pipeline blocks
    // are always in the same order regardless of insertion timing.
    out.sort((a, b) => (a.root_kind === 'nfr' ? 1 : 0) - (b.root_kind === 'nfr' ? 1 : 0));
    return out;
  }

  // ── Release manifest ─────────────────────────────────────────────

  private loadReleaseManifest(
    workflowRunId: string,
  ): { releases: ViewerRelease[]; crossCutting: ViewerCrossCuttingCounts } {
    // The release_plan record flows as artifact_produced with
    // content.kind === 'release_plan'. Prefer approved, schemaVersion=2.0.
    const rows = this.db
      .prepare(
        `SELECT content
         FROM governed_stream
         WHERE record_type = 'artifact_produced'
           AND is_current_version = 1
           AND workflow_run_id = ?
           AND json_extract(content, '$.kind') = 'release_plan'
           AND json_extract(content, '$.approved') = 1
         ORDER BY rowid DESC
         LIMIT 1`,
      )
      .all(workflowRunId) as Array<{ content: string }>;

    if (rows.length === 0) {
      return {
        releases: [],
        crossCutting: { workflows: 0, compliance: 0, integrations: 0, vocabulary: 0 },
      };
    }

    const c = JSON.parse(rows[0].content) as Record<string, unknown>;
    const rawReleases = Array.isArray(c.releases) ? (c.releases as Array<Record<string, unknown>>) : [];
    const releases: ViewerRelease[] = rawReleases.map(r => {
      const contains = (r.contains as Record<string, unknown> | undefined) ?? {};
      const arrLen = (k: string): number =>
        Array.isArray((contains as Record<string, unknown>)[k])
          ? ((contains as Record<string, unknown[]>)[k]).length
          : 0;
      return {
        release_id: (r.release_id as string) ?? '',
        ordinal: typeof r.ordinal === 'number' ? r.ordinal : 0,
        name: (r.name as string) ?? '',
        description: (r.description as string) ?? '',
        rationale: (r.rationale as string) ?? '',
        counts: {
          journeys: arrLen('journeys'),
          workflows: arrLen('workflows'),
          entities: arrLen('entities'),
          compliance: arrLen('compliance'),
          integrations: arrLen('integrations'),
          vocabulary: arrLen('vocabulary'),
        },
      };
    });

    const cc = (c.cross_cutting as Record<string, unknown> | undefined) ?? {};
    const ccArrLen = (k: string): number =>
      Array.isArray((cc as Record<string, unknown>)[k])
        ? ((cc as Record<string, unknown[]>)[k]).length
        : 0;

    return {
      releases,
      crossCutting: {
        workflows: ccArrLen('workflows'),
        compliance: ccArrLen('compliance'),
        integrations: ccArrLen('integrations'),
        vocabulary: ccArrLen('vocabulary'),
      },
    };
  }

  // ── Phase 1 anchors (DAG-tree view) ──────────────────────────────

  /**
   * Load Phase 1 traceability anchors from the artifacts that produce
   * the id-prefix families referenced in user stories' `traces_to[]`.
   *
   * One row per anchor: { id, kind, sub_phase_id, label, description }.
   * Anchors are produced once per Phase 1 sub-phase artifact:
   *   1.2  → user_journey_bloom    → UJ-*
   *   1.2  → system_workflow_bloom → WF-*
   *   1.2  → entities_bloom        → ENT-*
   *   1.2  → business_domains_bloom → DOM-* / PER-*
   *   1.0d → compliance_retention_discovery → COMP-*
   *   1.0e → vv_requirements_discovery     → QA-*
   *   1.0c → technical_constraints_discovery → TECH-*
   *
   * Defensive: each artifact kind may have multiple shape variants
   * across cal-runs. Where the field is missing or shape diverges,
   * the loader skips silently rather than throwing — the worst case
   * is a smaller anchor set, not a broken viewer.
   */
  private loadPhase1Anchors(workflowRunId: string): ViewerPhase1Anchor[] {
    const rows = this.db
      .prepare(
        `SELECT content, sub_phase_id
         FROM governed_stream
         WHERE record_type = 'artifact_produced'
           AND is_current_version = 1
           AND workflow_run_id = ?
           AND json_extract(content, '$.kind') IN (
             'user_journey_bloom',
             'system_workflow_bloom',
             'entities_bloom',
             'business_domains_bloom',
             'compliance_retention_discovery',
             'vv_requirements_discovery',
             'technical_constraints_discovery'
           )`,
      )
      .all(workflowRunId) as Array<{ content: string; sub_phase_id: string | null }>;

    const out: ViewerPhase1Anchor[] = [];
    const seen = new Set<string>();
    const push = (a: ViewerPhase1Anchor): void => {
      if (!a.id || seen.has(a.id)) return;
      seen.add(a.id);
      out.push(a);
    };

    for (const r of rows) {
      const c = JSON.parse(r.content) as Record<string, unknown>;
      const kind = c.kind as string;
      const sub = r.sub_phase_id ?? '1';
      const dispatcher = ANCHOR_DISPATCHERS[kind];
      if (dispatcher) dispatcher(c, sub, push);
    }
    return out;
  }

  /**
   * NFR applications: each NFR's `applies_to_requirements[]`. Used to
   * render the "qualified by:" footnote on each FR row in the DAG tree.
   */
  private loadNfrApplications(workflowRunId: string): ViewerNfrApplication[] {
    const rows = this.db
      .prepare(
        `SELECT content
         FROM governed_stream
         WHERE record_type = 'artifact_produced'
           AND is_current_version = 1
           AND workflow_run_id = ?
           AND json_extract(content, '$.kind') = 'non_functional_requirements'
         ORDER BY produced_at DESC`,
      )
      .all(workflowRunId) as Array<{ content: string }>;

    const out: ViewerNfrApplication[] = [];
    const seen = new Set<string>();
    for (const r of rows) {
      const c = JSON.parse(r.content) as Record<string, unknown>;
      const reqs = Array.isArray(c.requirements) ? (c.requirements as Array<Record<string, unknown>>) : [];
      for (const nfr of reqs) {
        const id = nfr.id as string;
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const apps = Array.isArray(nfr.applies_to_requirements)
          ? (nfr.applies_to_requirements as unknown[]).filter((x): x is string => typeof x === 'string')
          : [];
        out.push({ nfr_id: id, applies_to_requirements: apps });
      }
    }
    return out;
  }

  /**
   * Intent summary for the DAG tree's root header. Pulls raw intent +
   * product concept (name, description) from Phase 1 artifacts.
   */
  private loadIntentSummary(workflowRunId: string): ViewerIntentSummary {
    const out: ViewerIntentSummary = {
      raw_intent: null,
      product_name: null,
      product_description: null,
    };

    const rawRow = this.db
      .prepare(
        `SELECT content FROM governed_stream
         WHERE record_type = 'artifact_produced'
           AND is_current_version = 1
           AND workflow_run_id = ?
           AND json_extract(content, '$.kind') = 'raw_intent_received'
         ORDER BY produced_at ASC LIMIT 1`,
      )
      .get(workflowRunId) as { content: string } | undefined;
    if (rawRow) {
      const c = JSON.parse(rawRow.content) as Record<string, unknown>;
      const text = (c.text as string) ?? (c.intent as string) ?? (c.raw_intent as string);
      if (typeof text === 'string') out.raw_intent = text;
    }

    const intentRow = this.db
      .prepare(
        `SELECT content FROM governed_stream
         WHERE record_type = 'artifact_produced'
           AND is_current_version = 1
           AND workflow_run_id = ?
           AND json_extract(content, '$.kind') = 'intent_statement'
         ORDER BY produced_at DESC LIMIT 1`,
      )
      .get(workflowRunId) as { content: string } | undefined;
    if (intentRow) {
      const c = JSON.parse(intentRow.content) as Record<string, unknown>;
      const pc = (c.product_concept as Record<string, unknown> | undefined) ?? undefined;
      if (pc) {
        const name = pc.name;
        const desc = pc.description;
        if (typeof name === 'string') out.product_name = name;
        if (typeof desc === 'string') out.product_description = desc;
      }
    }
    return out;
  }

  /**
   * Return the most-recent workflow_run id (for 'Open Decomposition
   * Viewer' commands that want the current run without asking).
   */
  resolveLatestWorkflowRun(): string | null {
    const row = this.db
      .prepare(`SELECT id FROM workflow_runs ORDER BY rowid DESC LIMIT 1`)
      .get() as { id: string } | undefined;
    return row?.id ?? null;
  }
}

/**
 * Per-kind dispatcher for `loadPhase1Anchors`. The artifact `kind`
 * names the discriminator; the dispatcher reads the right collection
 * field(s) and forwards each item to `extractAnchorList`. Field-name
 * variants (e.g. `userJourneys` vs `user_journeys`) are tried in order.
 *
 * Lifted to module scope so `loadPhase1Anchors` stays a flat dispatch
 * (no per-kind `case` blocks → cognitive complexity stays under 15).
 */
type AnchorDispatcher = (
  c: Record<string, unknown>,
  subPhaseId: string,
  push: (a: ViewerPhase1Anchor) => void,
) => void;
const ANCHOR_DISPATCHERS: Record<string, AnchorDispatcher> = {
  user_journey_bloom: (c, sub, push) =>
    extractAnchorList(c.userJourneys ?? c.user_journeys, 'user_journey', sub, push),
  system_workflow_bloom: (c, sub, push) =>
    extractAnchorList(c.systemWorkflows ?? c.workflows, 'system_workflow', sub, push),
  entities_bloom: (c, sub, push) =>
    extractAnchorList(c.entities, 'entity', sub, push),
  business_domains_bloom: (c, sub, push) => {
    extractAnchorList(c.domains, 'business_domain', sub, push);
    extractAnchorList(c.personas, 'persona', sub, push);
  },
  compliance_retention_discovery: (c, sub, push) =>
    extractAnchorList(c.regimes ?? c.compliance_regimes, 'compliance_regime', sub, push),
  vv_requirements_discovery: (c, sub, push) =>
    extractAnchorList(
      c.vvRequirements ?? c.qa_criteria ?? c.quality_criteria ?? c.criteria,
      'vv_quality_criterion', sub, push,
    ),
  technical_constraints_discovery: (c, sub, push) =>
    extractAnchorList(
      c.technicalConstraints ?? c.constraints ?? c.technical_constraints,
      'technical_constraint', sub, push,
    ),
};

/**
 * Walk a Phase 1 bloom collection (e.g. userJourneys[]) and emit one
 * anchor per item via `push`. Item shape varies across blooms — the
 * helper tries `name`, `title`, `id` for the label and `description`
 * for the body, in priority order. Skips items without a string id.
 *
 * Defined at module scope (not as a class method) because it has no
 * dependency on the data provider's state and lifting it out keeps
 * `loadPhase1Anchors` short and dispatcher-shaped.
 */
function extractAnchorList(
  rawItems: unknown,
  kind: Phase1AnchorKind,
  subPhaseId: string,
  push: (a: ViewerPhase1Anchor) => void,
): void {
  if (!Array.isArray(rawItems)) return;
  for (const raw of rawItems as Array<Record<string, unknown>>) {
    if (!raw || typeof raw !== 'object') continue;
    const id = raw.id;
    if (typeof id !== 'string' || id.length === 0) continue;
    const label = pickString(raw, ['name', 'title', 'label', 'text']) ?? id;
    const description = pickString(raw, ['description', 'summary', 'rationale', 'text']);
    push({
      id, kind, sub_phase_id: subPhaseId, label,
      ...(description ? { description } : {}),
    });
  }
}

/**
 * Derive the FR/NFR designation for a pipeline record when the
 * orchestrator didn't emit `root_kind` directly. Both `sub_phase_id`
 * (2.1a vs 2.2a) and the `pipeline_id` prefix (`decomp-pipe-fr-…` vs
 * `decomp-pipe-nfr-…`) carry the signal. Defaults to 'fr' when
 * neither is conclusive — matches the producer's implicit default
 * and keeps the legacy "fr pipeline" label for old runs.
 */
function derivePipelineRootKind(
  subPhaseId: string | null,
  pipelineId: string | undefined,
): ViewerRootKind {
  if (subPhaseId === '2.2a') return 'nfr';
  if (subPhaseId === '2.1a') return 'fr';
  if (typeof pipelineId === 'string' && pipelineId.includes('-nfr-')) return 'nfr';
  if (typeof pipelineId === 'string' && pipelineId.includes('-fr-')) return 'fr';
  return 'fr';
}

/** First non-empty string field at `keys`, else undefined. */
function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return undefined;
}
