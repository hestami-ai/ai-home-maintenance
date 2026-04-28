/**
 * Decomposition Viewer — shared reactive store.
 *
 * Holds the current snapshot, derived indexes (node-by-record_id,
 * children-by-parent), UI state (filters, selected node, expanded
 * roots/tiers, active tab), and a thin bridge to the extension host
 * for sending messages.
 */

import { writable, derived, get } from 'svelte/store';

// Local structural types — duplicated minimally from ../lib/decompViewer/types.ts
// so the webview bundle doesn't need to import from src/lib.
export type ViewerTier = 'A' | 'B' | 'C' | 'D' | null;
export type ViewerRootKind = 'fr' | 'nfr' | null;

export interface ViewerAssumption {
  id: string;
  text: string;
  category: string;
  citations?: string[];
  surfaced_at_node: string;
  surfaced_at_pass: number;
  source?: string;
  duplicate_of?: string;
  duplicate_similarity?: number;
}

export interface ViewerDecompositionNode {
  record_id: string;
  node_id: string;
  display_key: string;
  parent_node_id: string | null;
  root_fr_id: string;
  root_kind: ViewerRootKind;
  tier: ViewerTier;
  tier_hint: ViewerTier;
  status: string;
  depth: number;
  pass_number: number;
  release_id: string | null;
  release_ordinal: number | null;
  story_role: string;
  story_action: string;
  story_outcome: string;
  acceptance_criteria: Array<{ id: string; description: string; measurable_condition: string }>;
  priority?: string;
  tier_rationale?: string;
  surfaced_assumption_ids: string[];
  traces_to: string[];
  produced_at: string;
  pruning_reason?: string;
  downgrade_reason?: string;
  children_display_keys: string[];
}

export interface ViewerPipelinePass {
  pass_number: number;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  nodes_produced: number;
  assumption_delta: number;
  termination_reason?: string;
}

export interface ViewerPipelineSummary {
  root_kind: ViewerRootKind;
  passes: ViewerPipelinePass[];
  termination_reason?: string;
  budget_calls_used?: number;
  max_depth_reached?: number;
}

export interface ViewerRelease {
  release_id: string;
  ordinal: number;
  name: string;
  description: string;
  rationale: string;
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

// ── Phase 1 anchors (DAG-tree view) ────────────────────────────────

export type Phase1AnchorKind =
  | 'user_journey'
  | 'system_workflow'
  | 'entity'
  | 'business_domain'
  | 'persona'
  | 'compliance_regime'
  | 'vv_quality_criterion'
  | 'technical_constraint';

export interface ViewerPhase1Anchor {
  id: string;
  kind: Phase1AnchorKind;
  sub_phase_id: string;
  label: string;
  description?: string;
  /**
   * True for anchors synthesized from `traces_to[]` ids that have no
   * producing Phase 1 artifact (e.g. cal-21 references QA-2 but
   * `vv_requirements_discovery` is empty). Surfaced as a "phantom"
   * pill in the DAG tree so the calibration gap is visible rather
   * than silently dropping the FR/NFR root.
   */
  phantom?: boolean;
}

export interface ViewerNfrApplication {
  nfr_id: string;
  applies_to_requirements: string[];
}

export interface ViewerIntentSummary {
  raw_intent: string | null;
  product_name: string | null;
  product_description: string | null;
}

export interface ViewerSystemRequirement {
  id: string;
  statement: string;
  source_requirement_ids: string[];
  priority?: string;
}

export interface ViewerRootSummary {
  root_fr_id: string;
  root_kind: ViewerRootKind;
  display_key: string;
  title: string;
  release_id: string | null;
  release_ordinal: number | null;
  node_count_total: number;
  tier_counts: { A: number; B: number; C: number; D: number; null: number };
  status_counts: Record<string, number>;
  max_depth: number;
}

export interface ViewerSnapshot {
  workflow_run_id: string;
  snapshot_at: string;
  revision: string;
  phase_id: string | null;
  sub_phase_id: string | null;
  run_status: string;
  nodes: ViewerDecompositionNode[];
  roots: ViewerRootSummary[];
  assumptions: ViewerAssumption[];
  pipelines: ViewerPipelineSummary[];
  releases: ViewerRelease[];
  cross_cutting: ViewerCrossCuttingCounts;
  phase1_anchors: ViewerPhase1Anchor[];
  nfr_applications: ViewerNfrApplication[];
  intent_summary: ViewerIntentSummary;
  system_requirements: ViewerSystemRequirement[];
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

// ── VS Code API bridge ──────────────────────────────────────────────

interface VsCodeApi {
  postMessage: (msg: unknown) => void;
}
let vscode: VsCodeApi | null = null;
export function setVsCodeApi(api: VsCodeApi): void {
  vscode = api;
}
export function sendMessage(msg: unknown): void {
  if (vscode) vscode.postMessage(msg);
}

// ── Core stores ─────────────────────────────────────────────────────

export const snapshot = writable<ViewerSnapshot | null>(null);
export const errorMessage = writable<string | null>(null);

export function applySnapshot(raw: unknown): void {
  snapshot.set(raw as ViewerSnapshot);
}
export function showError(msg: string): void {
  errorMessage.set(msg);
}
export function clearError(): void {
  errorMessage.set(null);
}

// ── UI state ────────────────────────────────────────────────────────

export type ViewerTab = 'tree' | 'assumptions' | 'summary';

export const activeTab = writable<ViewerTab>('tree');

/**
 * Tree-tab view mode. The Tree tab supports two layouts:
 *   - 'accordion' (Option 7) — multi-level accordion grouped by root +
 *     tier band; recommended default for MMP-style review where
 *     surfaced scope commitments need to be visually distinct from
 *     leaf operations.
 *   - 'indented'  (Option 1) — flat indented tree with per-node
 *     expand/collapse; familiar file-explorer UX, easier for
 *     keyboard-driven traversal of a known subtree path.
 * Both share the same FilterBar, ReleaseRail, and DetailDrawer.
 */
export type TreeViewMode = 'accordion' | 'indented' | 'dag';
export const treeViewMode = writable<TreeViewMode>('accordion');

/**
 * Per-node expand state for the Indented view (parallel to the
 * Accordion view's expandedRoots + expandedTierBands). Stored as a
 * set of node_id (the logical UUID), not record_id, so revisions of
 * the same logical node share their expanded state across snapshot
 * polls. Roots default to collapsed; users open them to drill in.
 */
export const expandedIndentedNodes = writable<Set<string>>(new Set());

export function toggleIndentedNode(nodeId: string): void {
  const s = new Set(get(expandedIndentedNodes));
  if (s.has(nodeId)) s.delete(nodeId);
  else s.add(nodeId);
  expandedIndentedNodes.set(s);
}

export function expandAllIndented(allNodeIds: string[]): void {
  expandedIndentedNodes.set(new Set(allNodeIds));
}

export function collapseAllIndented(): void {
  expandedIndentedNodes.set(new Set());
}

// Filter state — applied to the tree view.
export const filterReleaseIds = writable<Set<string> | null>(null); // null = all
export const filterTiers = writable<Set<'A' | 'B' | 'C' | 'D' | 'null'>>(new Set());
export const filterStatuses = writable<Set<string>>(new Set());
export const filterPriorities = writable<Set<string>>(new Set());
export const filterText = writable<string>('');

/** Expanded-state tracking: which root accordions are open, and which tier bands inside them. */
export const expandedRoots = writable<Set<string>>(new Set());
export const expandedTierBands = writable<Record<string, Set<'A' | 'B' | 'C' | 'D' | 'null'>>>({});

/** Selected node (for the detail drawer). */
export const selectedNodeRecordId = writable<string | null>(null);

// ── Derived indexes ─────────────────────────────────────────────────

/** record_id → node lookup. */
export const nodesByRecordId = derived(snapshot, ($s) => {
  const m = new Map<string, ViewerDecompositionNode>();
  if ($s) for (const n of $s.nodes) m.set(n.record_id, n);
  return m;
});

/** node_id → node lookup. */
export const nodesByNodeId = derived(snapshot, ($s) => {
  const m = new Map<string, ViewerDecompositionNode>();
  if ($s) for (const n of $s.nodes) m.set(n.node_id, n);
  return m;
});

/** root_fr_id → nodes (all depths, sorted by display_key). */
export const nodesByRoot = derived(snapshot, ($s) => {
  const m = new Map<string, ViewerDecompositionNode[]>();
  if ($s) {
    for (const n of $s.nodes) {
      const key = n.root_fr_id;
      const arr = m.get(key) ?? [];
      arr.push(n);
      m.set(key, arr);
    }
    for (const [, arr] of m) {
      arr.sort((a, b) => {
        if (a.depth !== b.depth) return a.depth - b.depth;
        return a.display_key.localeCompare(b.display_key);
      });
    }
  }
  return m;
});

/** parent_node_id → children (for tree walking in the accordion). */
export const childrenByParent = derived(snapshot, ($s) => {
  const m = new Map<string, ViewerDecompositionNode[]>();
  if ($s) {
    for (const n of $s.nodes) {
      if (!n.parent_node_id) continue;
      const arr = m.get(n.parent_node_id) ?? [];
      arr.push(n);
      m.set(n.parent_node_id, arr);
    }
    for (const [, arr] of m) {
      arr.sort((a, b) => a.display_key.localeCompare(b.display_key));
    }
  }
  return m;
});

/** Assumptions keyed by their id for quick lookup from node chips. */
export const assumptionsById = derived(snapshot, ($s) => {
  const m = new Map<string, ViewerAssumption>();
  if ($s) for (const a of $s.assumptions) m.set(a.id, a);
  return m;
});

/** Release lookup by id. */
export const releasesById = derived(snapshot, ($s) => {
  const m = new Map<string, ViewerRelease>();
  if ($s) for (const r of $s.releases) m.set(r.release_id, r);
  return m;
});

// ── Filtered views ──────────────────────────────────────────────────

/**
 * Is a given node visible under current filter state? Applied to the
 * whole-tree render; parent-visibility is handled by the AccordionRoot
 * component (if a child matches, the parent row is shown too).
 */
export function isNodeVisibleUnderFilters(
  n: ViewerDecompositionNode,
  f: {
    releases: Set<string> | null;
    tiers: Set<'A' | 'B' | 'C' | 'D' | 'null'>;
    statuses: Set<string>;
    priorities: Set<string>;
    text: string;
  },
): boolean {
  if (f.releases && n.release_id !== null && !f.releases.has(n.release_id)) return false;
  if (f.tiers.size > 0) {
    const t = (n.tier ?? 'null') as 'A' | 'B' | 'C' | 'D' | 'null';
    if (!f.tiers.has(t)) return false;
  }
  if (f.statuses.size > 0 && !f.statuses.has(n.status)) return false;
  if (f.priorities.size > 0 && (!n.priority || !f.priorities.has(n.priority))) return false;
  if (f.text.trim().length > 0) {
    const q = f.text.toLowerCase();
    const hay = (n.display_key + ' ' + n.story_action + ' ' + n.story_outcome).toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

/** Combined filter handle — read-only snapshot of all filter stores. */
export const currentFilters = derived(
  [filterReleaseIds, filterTiers, filterStatuses, filterPriorities, filterText],
  ([$rel, $tiers, $status, $prio, $txt]) => ({
    releases: $rel,
    tiers: $tiers,
    statuses: $status,
    priorities: $prio,
    text: $txt,
  }),
);

// ── Expand helpers ──────────────────────────────────────────────────

export function toggleRoot(rootFrId: string): void {
  const s = new Set(get(expandedRoots));
  if (s.has(rootFrId)) s.delete(rootFrId);
  else s.add(rootFrId);
  expandedRoots.set(s);
}

export function toggleTierBand(
  rootFrId: string,
  tier: 'A' | 'B' | 'C' | 'D' | 'null',
): void {
  const cur = { ...get(expandedTierBands) };
  const s = new Set(cur[rootFrId] ?? []);
  if (s.has(tier)) s.delete(tier);
  else s.add(tier);
  cur[rootFrId] = s;
  expandedTierBands.set(cur);
}

export function selectNode(recordId: string | null): void {
  selectedNodeRecordId.set(recordId);
}

// ── DAG model (Phase 1 → Phase 2 traceability) ─────────────────────

/**
 * DAG-tree placement for a single Phase-2 root (one decomposition
 * root, FR or NFR). `primary_anchor_id` is the first id in
 * `traces_to[]` after applying the per-kind precedence; `secondaries`
 * are the remaining traces. NFRs additionally carry the inverse
 * `qualifies_us_ids` list rendered as a "qualified by:" footnote on
 * each FR row.
 */
export interface DagRootPlacement {
  /** root_fr_id of the decomposition root. */
  root_fr_id: string;
  root_kind: 'fr' | 'nfr';
  primary_anchor_id: string | null;
  /** Anchor ids from traces_to[] minus the primary one. */
  secondary_anchor_ids: string[];
}

/**
 * Top-level DAG structure: anchors keyed by id, primary/secondary
 * roots per anchor, orphan anchors (no inbound traces), NFR-qualifies
 * inverse map.
 */
export interface DagModel {
  anchorsById: Map<string, ViewerPhase1Anchor>;
  /** anchor_id → root_fr_ids whose primary anchor is this one. */
  primaryRootsByAnchor: Map<string, string[]>;
  /** anchor_id → root_fr_ids that secondary-reference this anchor. */
  secondaryRootsByAnchor: Map<string, string[]>;
  /** anchor ids with zero inbound primary OR secondary references. */
  orphanAnchorIds: Set<string>;
  /** root_fr_id → DagRootPlacement. */
  placementByRoot: Map<string, DagRootPlacement>;
  /** us_id → list of NFR ids that qualify it (inverse of NFR.applies_to_requirements). */
  qualifiedByMap: Map<string, string[]>;
  /**
   * us_id (or NFR id) → list of SR ids that satisfy it (inverse of
   * Phase 3.2 SR.source_requirement_ids[]). Renders an
   * "→ satisfied by:" footnote on each FR/NFR row.
   */
  satisfiedByMap: Map<string, string[]>;
  /** SR id → SR record, for footnote tooltips. */
  systemRequirementsById: Map<string, ViewerSystemRequirement>;
}

/**
 * Per-kind precedence for selecting the primary anchor from
 * `traces_to[]`. The list is consulted in order; the first matching
 * id-prefix wins. Falls back to the first traces_to[] entry if no
 * kind matches.
 *
 * FR rule: user journey > workflow > entity > business domain >
 *          persona > compliance regime. (Intent-level parents trump
 *          structural ones; journeys read better as "what scenario
 *          does this story belong to?".)
 *
 * NFR rule: V&V quality criterion > technical constraint. (QA-* are
 *           closer to user-facing intent than TECH-*; preferring them
 *           keeps NFR roots under intent-level parents.)
 */
const FR_KIND_PRECEDENCE: Phase1AnchorKind[] = [
  'user_journey', 'system_workflow', 'entity',
  'business_domain', 'persona', 'compliance_regime',
];
const NFR_KIND_PRECEDENCE: Phase1AnchorKind[] = [
  'vv_quality_criterion', 'technical_constraint',
];

function pickPrimaryAnchor(
  traceIds: string[],
  rootKind: 'fr' | 'nfr',
  anchorsById: Map<string, ViewerPhase1Anchor>,
): string | null {
  if (traceIds.length === 0) return null;
  const precedence = rootKind === 'fr' ? FR_KIND_PRECEDENCE : NFR_KIND_PRECEDENCE;
  for (const kind of precedence) {
    for (const id of traceIds) {
      if (anchorsById.get(id)?.kind === kind) return id;
    }
  }
  // No anchor matched our precedence — fall back to the first known
  // anchor in traces_to[] regardless of kind, then to the first id
  // even if it's not in our anchor index (could be a stale or
  // freshly-added Phase 1 id we don't yet model).
  for (const id of traceIds) if (anchorsById.has(id)) return id;
  return traceIds[0];
}

/**
 * Infer an anchor kind from an id prefix (e.g. 'UJ-NEW-PROPERTY' →
 * 'user_journey'). Used to synthesize phantom anchors when a root
 * traces_to[] id has no producing Phase 1 artifact. Returns null
 * when the prefix is unrecognized — those ids get dropped to avoid
 * polluting the tree with mystery rows.
 */
function inferAnchorKindFromId(id: string): Phase1AnchorKind | null {
  if (id.startsWith('UJ-')) return 'user_journey';
  if (id.startsWith('WF-')) return 'system_workflow';
  if (id.startsWith('ENT-')) return 'entity';
  if (id.startsWith('DOM-')) return 'business_domain';
  if (id.startsWith('PER-')) return 'persona';
  if (id.startsWith('COMP-')) return 'compliance_regime';
  if (id.startsWith('QA-')) return 'vv_quality_criterion';
  if (id.startsWith('TECH-')) return 'technical_constraint';
  return null;
}

/**
 * Walk every depth=0 root's traces_to[] and synthesize a phantom
 * anchor for any id that doesn't have a producing Phase 1 artifact.
 * Mutates `anchorsById` in place. The phantom anchor's label flags
 * the gap so the DAG tree can visually distinguish it from a
 * properly-produced anchor (the DAG view renders these with a
 * "phantom" pill next to the orphan signal).
 */
function synthesizePhantomAnchors(
  rootNodes: ViewerDecompositionNode[],
  anchorsById: Map<string, ViewerPhase1Anchor>,
): void {
  for (const root of rootNodes) {
    for (const id of root.traces_to) {
      if (anchorsById.has(id)) continue;
      const kind = inferAnchorKindFromId(id);
      if (!kind) continue;
      anchorsById.set(id, {
        id, kind,
        sub_phase_id: '?',
        label: '(referenced; no producing artifact)',
        phantom: true,
      });
    }
  }
}

/** Append `value` to the array stored at `map[key]`, creating it if absent. */
function pushToMapList<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const arr = map.get(key) ?? [];
  arr.push(value);
  map.set(key, arr);
}

/** Place all decomposition roots into their primary + secondary anchor buckets. */
function placeRoots(
  rootNodes: ViewerDecompositionNode[],
  anchorsById: Map<string, ViewerPhase1Anchor>,
  primaryRootsByAnchor: Map<string, string[]>,
  secondaryRootsByAnchor: Map<string, string[]>,
  placementByRoot: Map<string, DagRootPlacement>,
): void {
  for (const root of rootNodes) {
    const kind: 'fr' | 'nfr' = root.root_kind === 'nfr' ? 'nfr' : 'fr';
    const primary = pickPrimaryAnchor(root.traces_to, kind, anchorsById);
    const secondaries = root.traces_to.filter(id => id !== primary);
    placementByRoot.set(root.root_fr_id, {
      root_fr_id: root.root_fr_id, root_kind: kind,
      primary_anchor_id: primary, secondary_anchor_ids: secondaries,
    });
    if (primary) pushToMapList(primaryRootsByAnchor, primary, root.root_fr_id);
    for (const sec of secondaries) pushToMapList(secondaryRootsByAnchor, sec, root.root_fr_id);
  }
}

/** Inverse-map NFR.applies_to_requirements[] → us_id → [nfr_ids]. */
function buildQualifiedByMap(apps: ViewerNfrApplication[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const app of apps) {
    for (const usId of app.applies_to_requirements) pushToMapList(out, usId, app.nfr_id);
  }
  return out;
}

/**
 * Inverse-map Phase 3.2 SR.source_requirement_ids[] → root_id →
 * [sr_ids]. Used to render the "→ satisfied by:" footnote on each
 * FR/NFR root row in the DAG tree.
 *
 * "Declare at root, derive at leaf" — see the cal-22+ calibration
 * decision. NFRs declare applies_to_requirements at root level
 * (US-001, NFR-001) and downstream consumers walk decomposition
 * trees to project leaf coverage. SR.source_requirement_ids[] from
 * the Phase 3.2 LLM is intentionally permitted to mix roots and
 * leaves (judgment work — "this SR was inspired by these specific
 * drivers"); we normalize on read so the footnote stays root-level.
 *
 * Normalize-on-read algorithm: for each source id, look up its
 * decomposition node by display_key; if found and not depth=0,
 * walk parent_node_id (via display_key chain) up to the root.
 * Index the SR under the resolved root's display_key. Source ids
 * that don't map to any known node (e.g. stale references after
 * supersession) get indexed under themselves so they're still
 * visible somewhere — surfaces drift rather than hiding it.
 */
function buildSatisfiedByMap(
  srs: ViewerSystemRequirement[],
  nodes: ViewerDecompositionNode[],
): Map<string, string[]> {
  // Index nodes by display_key (LLM-facing id, e.g. "US-001",
  // "FR-ACCT-1.1-1") and by node_id (internal UUID — what
  // parent_node_id chains through). Both built once.
  const byDisplayKey = new Map<string, ViewerDecompositionNode>();
  const byNodeId = new Map<string, ViewerDecompositionNode>();
  for (const n of nodes) {
    byDisplayKey.set(n.display_key, n);
    byNodeId.set(n.node_id, n);
  }

  const resolveRoot = (sourceId: string): string => {
    const node = byDisplayKey.get(sourceId);
    if (!node) return sourceId;  // unknown id — return as-is so drift is visible
    if (node.depth === 0) return node.display_key;
    let cur: ViewerDecompositionNode | undefined = node;
    while (cur && cur.parent_node_id) {
      const next: ViewerDecompositionNode | undefined = byNodeId.get(cur.parent_node_id);
      if (!next) break;
      cur = next;
      if (cur.depth === 0) return cur.display_key;
    }
    return cur?.display_key ?? sourceId;
  };

  const out = new Map<string, string[]>();
  for (const sr of srs) {
    // Dedupe SRs per root — a single SR might reference both a root
    // and several of its leaves; we only want it listed once.
    const seenForThisSr = new Set<string>();
    for (const sourceId of sr.source_requirement_ids) {
      const rootId = resolveRoot(sourceId);
      const key = `${sr.id}@${rootId}`;
      if (seenForThisSr.has(key)) continue;
      seenForThisSr.add(key);
      pushToMapList(out, rootId, sr.id);
    }
  }
  return out;
}

/**
 * Build the DAG model from the current snapshot. Re-derived whenever
 * the snapshot revision changes.
 */
export const dagModel = derived(snapshot, ($s): DagModel => {
  const anchorsById = new Map<string, ViewerPhase1Anchor>();
  const primaryRootsByAnchor = new Map<string, string[]>();
  const secondaryRootsByAnchor = new Map<string, string[]>();
  const placementByRoot = new Map<string, DagRootPlacement>();
  if (!$s) {
    return {
      anchorsById, primaryRootsByAnchor, secondaryRootsByAnchor,
      orphanAnchorIds: new Set(), placementByRoot,
      qualifiedByMap: new Map(),
      satisfiedByMap: new Map(),
      systemRequirementsById: new Map(),
    };
  }
  for (const a of $s.phase1_anchors) anchorsById.set(a.id, a);
  const rootNodes = $s.nodes.filter(n => n.depth === 0);
  synthesizePhantomAnchors(rootNodes, anchorsById);
  placeRoots(
    rootNodes,
    anchorsById, primaryRootsByAnchor, secondaryRootsByAnchor, placementByRoot,
  );
  const orphanAnchorIds = new Set<string>();
  for (const id of anchorsById.keys()) {
    if (!primaryRootsByAnchor.has(id) && !secondaryRootsByAnchor.has(id)) {
      orphanAnchorIds.add(id);
    }
  }
  const systemRequirementsById = new Map<string, ViewerSystemRequirement>();
  for (const sr of $s.system_requirements) systemRequirementsById.set(sr.id, sr);
  return {
    anchorsById, primaryRootsByAnchor, secondaryRootsByAnchor,
    orphanAnchorIds, placementByRoot,
    qualifiedByMap: buildQualifiedByMap($s.nfr_applications),
    satisfiedByMap: buildSatisfiedByMap($s.system_requirements, $s.nodes),
    systemRequirementsById,
  };
});

// ── DAG-tree expand state ──────────────────────────────────────────

/**
 * Per-anchor expand state for the DAG view (parallel to
 * `expandedIndentedNodes`). Stored as anchor ids. Decomposition
 * sub-tree expansion within an FR root reuses `expandedIndentedNodes`.
 */
export const expandedDagAnchors = writable<Set<string>>(new Set());

export function toggleDagAnchor(anchorId: string): void {
  const s = new Set(get(expandedDagAnchors));
  if (s.has(anchorId)) s.delete(anchorId);
  else s.add(anchorId);
  expandedDagAnchors.set(s);
}

export function expandAllDagAnchors(allAnchorIds: string[]): void {
  expandedDagAnchors.set(new Set(allAnchorIds));
}

export function collapseAllDagAnchors(): void {
  expandedDagAnchors.set(new Set());
}
