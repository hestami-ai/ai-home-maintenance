/**
 * Decomposition Viewer — shared types.
 *
 * DTO shapes flowing between the extension host (data provider) and the
 * webview (Svelte app). Kept narrow and serializable — no function refs,
 * no non-JSON types — because these travel over `webview.postMessage`.
 *
 * The viewer renders the Wave 6 requirement_decomposition_node tree
 * produced during Phase 2.1a / 2.2a, plus its accompanying assumption
 * set and pipeline-pass telemetry. All data is queried read-only from
 * the governed_stream SQLite table.
 */

// ── Tier / status tags mirrored from records.ts ──────────────────

export type ViewerTier = 'A' | 'B' | 'C' | 'D' | null;
export type ViewerStatus =
  | 'pending' | 'atomic' | 'pruned' | 'deferred' | 'downgraded'
  | string;
export type ViewerRootKind = 'fr' | 'nfr' | null;

// ── Tree nodes ───────────────────────────────────────────────────

/**
 * One decomposition node, flattened to the fields the viewer needs.
 * `children_display_keys` is derived at query time by grouping on
 * content.parent_node_id so the webview doesn't need to walk the tree.
 */
export interface ViewerDecompositionNode {
  /** Governed-stream row id — stable, used as React/Svelte key. */
  record_id: string;
  /** Logical UUID from content.node_id — stable across revisions. */
  node_id: string;
  /** Human-readable short id (e.g. US-001-1.2.3). */
  display_key: string;
  /** content.parent_node_id; null for roots. */
  parent_node_id: string | null;
  /** content.root_fr_id — points at the root's node_id. */
  root_fr_id: string;
  /** 'fr' / 'nfr' / null (older records without root_kind). */
  root_kind: ViewerRootKind;
  /** A / B / C / D / null. */
  tier: ViewerTier;
  /** Tier hint from the parent (when available). */
  tier_hint: ViewerTier;
  /** pending | atomic | pruned | deferred | downgraded. */
  status: ViewerStatus;
  /** 0-based depth; roots are depth=0. */
  depth: number;
  /** Which saturation pass produced this node (0 for phase-1.0 seeds). */
  pass_number: number;
  /** Release UUID the root was assigned to; inherited by children. */
  release_id: string | null;
  /** 1-based ordinal of the release; null = backlog. */
  release_ordinal: number | null;
  /** Short summary of the user_story (role/action/outcome). */
  story_role: string;
  story_action: string;
  story_outcome: string;
  /** Acceptance criteria (id + description + measurable). */
  acceptance_criteria: Array<{
    id: string;
    description: string;
    measurable_condition: string;
  }>;
  /** Priority: critical | high | medium | low. */
  priority?: string;
  /** Rationale the decomposer emitted when assessing the tier. */
  tier_rationale?: string;
  /** Assumption ids surfaced by this node. */
  surfaced_assumption_ids: string[];
  /** traces_to[] from Phase 2.1 (UJ-*, ENT-*, etc.). */
  traces_to: string[];
  /** Timestamp the record was produced (ISO-8601). */
  produced_at: string;
  /** content.pruning_reason when status === 'pruned'. */
  pruning_reason?: string;
  /** content.downgrade_reason when status === 'downgraded'. */
  downgrade_reason?: string;
  /**
   * Derived at query time — distinct display_keys of children of this
   * node. Empty for leaves. Lets the webview render tree-shape without
   * another round trip.
   */
  children_display_keys: string[];
}

// ── Assumptions ───────────────────────────────────────────────────

export interface ViewerAssumption {
  id: string;
  text: string;
  category: string;
  citations?: string[];
  surfaced_at_node: string;
  surfaced_at_pass: number;
  source?: string;
  /** When flagged as duplicate, the canonical id we point at. */
  duplicate_of?: string;
  duplicate_similarity?: number;
}

// ── Saturation pass telemetry ─────────────────────────────────────

export interface ViewerPipelinePass {
  pass_number: number;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  nodes_produced: number;
  assumption_delta: number;
  termination_reason?: string;
}

/**
 * Per-kind (fr/nfr) rollup of the saturation pipeline:
 * trajectory, termination status, budget consumed.
 */
export interface ViewerPipelineSummary {
  root_kind: ViewerRootKind;
  passes: ViewerPipelinePass[];
  termination_reason?: string;
  budget_calls_used?: number;
  max_depth_reached?: number;
}

// ── Release manifest view ────────────────────────────────────────

export interface ViewerRelease {
  release_id: string;
  ordinal: number;
  name: string;
  description: string;
  rationale: string;
  /**
   * Counts by artifact type from release_plan.v2 contains[*].
   * For v1 display purposes — no need for full id lists client-side.
   */
  counts: {
    journeys: number;
    workflows: number;
    entities: number;
    compliance: number;
    integrations: number;
    vocabulary: number;
  };
}

export interface ViewerCrossCuttingCounts {
  workflows: number;
  compliance: number;
  integrations: number;
  vocabulary: number;
}

// ── Roots index ──────────────────────────────────────────────────

/**
 * Per-root summary the webview uses to render the left rail + the top
 * of each accordion.
 */
export interface ViewerRootSummary {
  root_fr_id: string;
  root_kind: ViewerRootKind;
  display_key: string;
  title: string;
  release_id: string | null;
  release_ordinal: number | null;
  /** Total descendants including the root itself. */
  node_count_total: number;
  /** Counts by tier and status for the root's subtree. */
  tier_counts: { A: number; B: number; C: number; D: number; null: number };
  status_counts: Record<string, number>;
  max_depth: number;
}

// ── Phase 1 anchors (DAG-tree view) ──────────────────────────────

/**
 * The kinds of Phase 1 artifacts that act as traceability anchors for
 * Phase 2 FR/NFR roots. Each maps to a specific id-prefix family used
 * in `requirement_decomposition_node.user_story.traces_to[]`:
 *   - 'user_journey'         → UJ-*    (from user_journey_bloom)
 *   - 'system_workflow'      → WF-*    (from system_workflow_bloom)
 *   - 'entity'               → ENT-*   (from entities_bloom)
 *   - 'business_domain'      → DOM-*   (from business_domains_bloom)
 *   - 'persona'              → PER-*   (from business_domains_bloom)
 *   - 'compliance_regime'    → COMP-*  (from compliance_retention_discovery)
 *   - 'vv_quality_criterion' → QA-*    (from vv_requirements_discovery)
 *   - 'technical_constraint' → TECH-*  (from technical_constraints_discovery)
 */
export type Phase1AnchorKind =
  | 'user_journey'
  | 'system_workflow'
  | 'entity'
  | 'business_domain'
  | 'persona'
  | 'compliance_regime'
  | 'vv_quality_criterion'
  | 'technical_constraint';

/** A single Phase 1 traceability anchor (one journey, one entity, etc.). */
export interface ViewerPhase1Anchor {
  /** Semantic id (e.g. 'UJ-NEW-PROPERTY-ONBOARD'). Stable across passes. */
  id: string;
  /** Kind of anchor — drives the parent-precedence rule. */
  kind: Phase1AnchorKind;
  /** Sub-phase that produced it (e.g. '1.2'). */
  sub_phase_id: string;
  /** Short label for the row (name/title from the source artifact). */
  label: string;
  /** Optional longer description for the detail panel. */
  description?: string;
}

/** Inverse map: NFR id → list of US ids it qualifies (constrains). */
export interface ViewerNfrApplication {
  nfr_id: string;
  applies_to_requirements: string[];
}

/** Top-level intent summary used to render the Raw Intent / Intent Statement header. */
export interface ViewerIntentSummary {
  /** Original user prompt (raw_intent_received). */
  raw_intent: string | null;
  /** Product name from intent_statement.product_concept.name. */
  product_name: string | null;
  /** Product description / pitch from intent_statement.product_concept.description. */
  product_description: string | null;
}

// ── Snapshot ─────────────────────────────────────────────────────

/**
 * The full payload the webview needs to render one view. Produced by
 * `DecompViewerDataProvider.getSnapshot(workflowRunId)`.
 *
 * `revision` is a hash-like token used for cheap change detection by
 * the polling loop — if two consecutive polls return the same revision,
 * no `snapshot_update` is posted to the webview.
 */
export interface ViewerSnapshot {
  /** Workflow run id the snapshot came from. */
  workflow_run_id: string;
  /** ISO-8601 timestamp when the snapshot was built. */
  snapshot_at: string;
  /** Cheap-to-compute revision token. Changes any time any field does. */
  revision: string;
  /** Current phase / sub-phase so the header can show "2/2.1a". */
  phase_id: string | null;
  sub_phase_id: string | null;
  run_status: string;
  /** All decomposition nodes across fr + nfr, flat. */
  nodes: ViewerDecompositionNode[];
  /** Per-root summaries, ordered by kind then release ordinal then display_key. */
  roots: ViewerRootSummary[];
  /** All assumptions (latest snapshot per fr/nfr). */
  assumptions: ViewerAssumption[];
  /** Saturation telemetry — one summary per kind with a passes[] array. */
  pipelines: ViewerPipelineSummary[];
  /** Release manifest from the approved release_plan v2 record; null if none. */
  releases: ViewerRelease[];
  cross_cutting: ViewerCrossCuttingCounts;
  /**
   * Phase 1 traceability anchors (DAG-tree view). Empty when no Phase 1
   * artifacts are present (early-stage runs). Always sent — the webview
   * decides whether to render the DAG tree.
   */
  phase1_anchors: ViewerPhase1Anchor[];
  /**
   * NFR → FR applications (from non_functional_requirements artifact).
   * Used to render the "qualified by:" footnote on each FR row.
   */
  nfr_applications: ViewerNfrApplication[];
  /**
   * Header-row content for the DAG tree's root: original raw intent +
   * product concept from the Phase 1 intent_statement.
   */
  intent_summary: ViewerIntentSummary;
  /** Top-line counts for the summary strip. */
  totals: {
    nodes: number;
    atomic: number;
    pending: number;
    pruned: number;
    deferred: number;
    downgraded: number;
    roots: number;
    assumptions: number;
    duplicate_assumptions: number;
  };
}

// ── Messages (extension host ↔ webview) ───────────────────────────

export type DecompViewerOutboundMessage =
  /** Initial payload — sent once after webview loads. */
  | { type: 'init'; snapshot: ViewerSnapshot }
  /** Delta / replacement when polling detects any change. */
  | { type: 'snapshot_update'; snapshot: ViewerSnapshot }
  /** Non-fatal error surfaced to the user (toast in the webview). */
  | { type: 'error'; message: string };

export type DecompViewerInboundMessage =
  /** Webview ready — host replies with `init`. */
  | { type: 'ready' }
  /** User requested a fresh refresh (bypass polling cadence). */
  | { type: 'refresh_requested' }
  /**
   * MMP-decision placeholders for v2 — buttons disabled in v1 so these
   * aren't actually sent yet. Shape pinned here so v2 wiring is a
   * no-surprise change.
   */
  | { type: 'mmp_accept'; node_record_id: string }
  | { type: 'mmp_reject'; node_record_id: string; reason?: string }
  | { type: 'mmp_defer'; node_record_id: string; reason?: string }
  | { type: 'mmp_edit'; node_record_id: string; patch: Record<string, unknown> }
  | { type: 'mmp_accept_subtree'; root_node_id: string }
  | { type: 'mmp_reject_subtree'; root_node_id: string; reason?: string };
