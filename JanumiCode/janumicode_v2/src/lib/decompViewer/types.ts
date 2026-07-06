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

// ── Realization layers (unified drill-down: component / task / data_model / test) ──

/** Which decomposition family a node belongs to. */
export type DecompLayer = 'requirement' | 'component' | 'data_model' | 'task' | 'test';

/**
 * A node from one of the downstream decomposition families (Phase 4/5/6/7),
 * flattened to the fields the unified drill-down needs and pre-joined to the
 * requirement spine. The requirement tree keeps using {@link ViewerDecompositionNode};
 * these hang under a requirement leaf's acceptance criteria.
 */
export interface ViewerRealizationNode {
  /** Governed-stream row id (stable key). */
  record_id: string;
  /** Logical UUID (content.node_id). */
  node_id: string;
  /** component | data_model | task | test. */
  layer: DecompLayer;
  /** Business/display id (task-…, comp-…, DM-…, TC-…). */
  display_key: string;
  /** Human title (task.name / component.name / entity.name / test_case.name). */
  title: string;
  status: ViewerStatus;
  tier: ViewerTier;
  depth: number;
  parent_node_id: string | null;
  /** Root grouping id (root_task_id / root_component_id / root_entity_id / root_test_id). */
  root_id: string;
  release_id: string | null;
  release_ordinal: number | null;
  /**
   * Component this node belongs to, resolved to a component node key
   * (task.component_id / entity.component_id / test component_ids[0]). Null when
   * the node carries no component ref or the ref resolved to nothing.
   */
  component_key: string | null;
  /** Leaf AC ids this node realizes (tasks/tests), filtered to VALID leaf ACs. */
  realizes_ac_ids: string[];
  /** Canonical US ids this node serves (resolved via the requirement lineage). */
  serves_us_ids: string[];
  /** Data-model entity kind (aggregate/entity/value_type/relation), when layer==='data_model'. */
  entity_kind?: string;
  produced_at: string;
}

/** Referenced ids that resolved to nothing — surfaced (not hidden) as diagnostics. */
export interface ViewerRealizationDrift {
  /** AC ids cited by tasks/tests that match no requirement leaf (malformed/dropped). */
  unresolved_ac_ids: string[];
  /** component_id values cited by tasks/data-models that match no component node. */
  unresolved_component_ids: string[];
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

/**
 * One Phase 3 System Requirement (Phase 3.2 sub-phase output). The
 * DAG tree uses these to render an "→ satisfied by:" footnote on
 * each FR/NFR row, threading the Phase 1 → Phase 2 → Phase 3
 * traceability chain end-to-end.
 */
export interface ViewerSystemRequirement {
  id: string;
  statement: string;
  /** FR/NFR ids this SR was derived from. */
  source_requirement_ids: string[];
  priority?: string;
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
  /**
   * Phase 3.2 System Requirements. The DAG tree uses these to render
   * an "→ satisfied by:" footnote on each FR/NFR row, threading
   * Phase 1 → Phase 2 → Phase 3 traceability end-to-end. Empty when
   * Phase 3.2 hasn't run.
   */
  system_requirements: ViewerSystemRequirement[];
  /**
   * Realization layers (component/task/data_model/test) pre-joined to the
   * requirement spine for the unified drill-down. Empty on runs that haven't
   * reached Phase 4+. Ships in full today; the high-fan-out layers become
   * lazy-loaded later (see `load_realization` message).
   */
  realization_nodes: ViewerRealizationNode[];
  /** Referenced ids that resolved to nothing (diagnostic surface). */
  realization_drift: ViewerRealizationDrift;
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

// ── Realization delta (lazy-loaded high-fan-out layers) ───────────

/**
 * Incremental update to the realization set (component/task/data_model/test).
 * The base snapshot no longer carries these high-fan-out nodes; the webview
 * requests them once (`load_realization`) and thereafter the host ships only
 * per-record changes, keyed by a cheap content fingerprint. This keeps the
 * wire payload bounded even as a run grows to thousands of downstream nodes
 * (the same unbounded-snapshot shape the governed stream had).
 */
export interface ViewerRealizationDelta {
  /** Realization revision token (changes when any realization node/drift does). */
  revision: string;
  /**
   * True when this is a full (re)send — the webview must clear its
   * realization store before applying `upserts`. Sent on first load, run
   * change, or an explicit re-request. False for incremental polls.
   */
  reset: boolean;
  /** Nodes added or changed since the last delta (full set when `reset`). */
  upserts: ViewerRealizationNode[];
  /** record_ids of nodes that are gone (superseded/pruned) since the last delta. */
  removed: string[];
  /** Current drift (cheap; always sent with a delta). */
  drift: ViewerRealizationDrift;
}

// ── Validator findings (reasoning-review, bound to items) ─────────

export type ViewerFindingSeverity = 'HIGH' | 'MEDIUM';

/**
 * One substantive validator finding, bound to the item(s) it cites. Selected
 * via the same rules the executor/adjudicator use (drop auto-fix noise +
 * superseded + LOW), then attached to items by the logical ids it cites
 * (AC/US/NFR/component). Findings that cite no known item are counted in the
 * summary but not shipped (there's nowhere to hang them).
 */
export interface ViewerFinding {
  record_id: string;
  validator_id: string;
  severity: ViewerFindingSeverity;
  finding_type: string;
  summary: string;
  detail: string;
  recommendation: string;
  /** 'process' = critiques upstream agent cognition; 'artifact' = about the produced content. */
  category: 'artifact' | 'process';
  cited_ids: string[];
  /** Leaf AC ids this finding bound to. */
  ac_ids: string[];
  /** US / NFR / component display keys this finding bound to. */
  display_keys: string[];
}

/** Run-level finding accounting (shown in the findings header). */
export interface ViewerFindingsSummary {
  /** All current reasoning_review_finding records. */
  total: number;
  /** HIGH/MEDIUM, not auto-fix, not superseded. */
  surfaced: number;
  /** Surfaced findings that bound to ≥1 item (shipped). */
  bound: number;
  /** Surfaced but unbound (no citable item id) — surfaced-not-shipped. */
  unbound: number;
  by_severity: { HIGH: number; MEDIUM: number };
}

/** Incremental findings update (immutable records, so a delta is add-only in practice). */
export interface ViewerFindingsDelta {
  revision: string;
  reset: boolean;
  upserts: ViewerFinding[];
  removed: string[];
  summary: ViewerFindingsSummary;
}

// ── Messages (extension host ↔ webview) ───────────────────────────

/**
 * Full content of a single decomposition record, fetched on demand when the
 * operator clicks a drill-down row. Kept off the snapshot/delta path — only
 * the clicked node's raw content travels, so the inspector is rich without
 * bloating the streamed payloads.
 */
export interface ViewerNodeDetail {
  record_id: string;
  record_type: string;
  /** Raw parsed governed_stream content (renderer picks the fields per type). */
  content: Record<string, unknown>;
}

export type DecompViewerOutboundMessage =
  /** Initial payload — sent once after webview loads. Realization nodes empty (lazy). */
  | { type: 'init'; snapshot: ViewerSnapshot }
  /** Delta / replacement when polling detects any change (base fields only). */
  | { type: 'snapshot_update'; snapshot: ViewerSnapshot }
  /** Incremental realization update — only after the webview requests it. */
  | { type: 'realization_delta'; delta: ViewerRealizationDelta }
  /** Full content of one record, in reply to `load_node_detail`. */
  | { type: 'node_detail'; detail: ViewerNodeDetail }
  /** Node-detail fetch found no such record (stale click after supersession). */
  | { type: 'node_detail_missing'; record_id: string }
  /** Incremental validator-findings update — only after the webview requests it. */
  | { type: 'findings_delta'; delta: ViewerFindingsDelta }
  /** Non-fatal error surfaced to the user (toast in the webview). */
  | { type: 'error'; message: string };

export type DecompViewerInboundMessage =
  /** Webview ready — host replies with `init`. */
  | { type: 'ready' }
  /** User requested a fresh refresh (bypass polling cadence). */
  | { type: 'refresh_requested' }
  /**
   * Webview entered a view that needs the realization layers (drill-down).
   * Host replies with a full `realization_delta` (reset) and thereafter
   * ships incremental deltas on each poll. Idempotent — re-requesting forces
   * a fresh full send.
   */
  | { type: 'load_realization' }
  /**
   * Operator clicked a drill-down row — fetch that one record's full content.
   * Host replies with `node_detail` (or `node_detail_missing` if it's gone).
   */
  | { type: 'load_node_detail'; recordId: string }
  /**
   * Webview wants validator findings (drill-down entered). Host replies with a
   * full `findings_delta` (reset) and ships incremental deltas thereafter.
   */
  | { type: 'load_findings' }
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
