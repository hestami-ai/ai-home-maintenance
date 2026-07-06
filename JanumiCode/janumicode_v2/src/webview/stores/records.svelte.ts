/**
 * Reactive store for Governed Stream records (Svelte 5 runes).
 * Single source of truth for the webview.
 *
 * Memory model (Wave — governed-stream pagination):
 *   `records` holds only a BOUNDED tail WINDOW (≤ `cap`), not the whole run.
 *   A full calibration run is thousands–tens-of-thousands of records; holding
 *   them all (and re-sorting the array on every `add`) was O(n²) in CPU + GC
 *   and OOM'd the webview renderer. Instead:
 *     - `add()` is amortized O(log W): dedupe + incremental index update +
 *       binary-search insert; head groups drop when the window exceeds `cap`
 *       and the user is pinned to the tail.
 *     - relationship lookups (children / reviews / dmr suppression) read
 *       incremental indexes (O(1)/O(k)) instead of scanning the whole array.
 *     - older history is fetched on demand from the host (`prependOlder`).
 *
 * Reactivity: the child/review/dmr indexes are `SvelteMap`/`SvelteSet` (from
 * `svelte/reactivity`) — plain Map/Set are NOT deeply reactive in Svelte 5, so
 * a `$derived` that reads them would never re-run when they mutate. The
 * decomposition helpers below intentionally scan `records` (the reactive
 * window array) and so track it directly.
 */

import { SvelteMap, SvelteSet } from 'svelte/reactivity';

export interface SerializedRecord {
  id: string;
  record_type: string;
  phase_id: string | null;
  sub_phase_id: string | null;
  produced_by_agent_role: string | null;
  produced_at: string;
  authority_level: number;
  quarantined: boolean;
  /**
   * Parent record ids — used by the AgentInvocationCard dispatcher to skip
   * child records (agent_output, tool_call, etc.) at the top level and
   * render them nested under their owning agent_invocation card.
   */
  derived_from_record_ids: string[];
  content: Record<string, unknown>;
}

/** Default rendered-window size. ~400 keeps the DOM + store bounded well below
 *  the point where per-record work becomes visible, while comfortably holding
 *  a phase's worth of context on screen. */
const DEFAULT_CAP = 400;

/**
 * Total-order sort key: `[anchorProducedAt, anchorId, isResponse, selfProducedAt, selfId]`.
 *
 * Encodes the conversational-thread rule (see the module note on
 * `conversationalSort`): a `client_liaison_response` sorts as if it sat right
 * after the `raw_intent_received` / `open_query_received` it replies to
 * (anchor prefix + `isResponse=1`), so it renders under the intent that
 * triggered it. Everything else sorts chronologically by `(produced_at, id)`
 * — `produced_at` is NOT unique, so `id` is the deterministic tiebreak that
 * also gives the keyset "load older" cursor a total order.
 */
type OrderKey = [string, string, number, string, string];

const RESPONSE_ANCHOR_TYPES = new Set(['raw_intent_received', 'open_query_received']);

function orderKeyOf(
  record: SerializedRecord,
  byId: { get(id: string): SerializedRecord | undefined },
): OrderKey {
  if (record.record_type === 'client_liaison_response') {
    for (const anchorId of record.derived_from_record_ids) {
      const anchor = byId.get(anchorId);
      if (anchor && RESPONSE_ANCHOR_TYPES.has(anchor.record_type)) {
        return [anchor.produced_at, anchor.id, 1, record.produced_at, record.id];
      }
    }
  }
  return [record.produced_at, record.id, 0, record.produced_at, record.id];
}

function compareKeys(a: OrderKey, b: OrderKey): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return 0;
}

export class RecordsStore {
  /** The rendered window only — a bounded tail slice of the full run. */
  records = $state<SerializedRecord[]>([]);
  /** Best-known total record count for the run (for "showing N of M" affordances). */
  totalCount = $state(0);
  /** True when records older than the current window exist (in DB / dropped). */
  hasOlder = $state(false);

  private readonly cap: number;
  /** When true, the window head-drops to stay ≤ cap on live append. Set false
   *  while the user scrolls up reading history so rows aren't yanked away. */
  private stickToBottom = true;

  /** @param cap rendered-window size (defaults to {@link DEFAULT_CAP}). */
  constructor(cap: number = DEFAULT_CAP) {
    this.cap = cap;
  }

  // ── incremental indexes (reactive — read during render) ──────────
  private byId = new SvelteMap<string, SerializedRecord>();
  private childrenByParent = new SvelteMap<string, string[]>();
  /** agent_output id → latest reasoning_review_record id. */
  private reviewByOutput = new SvelteMap<string, string>();
  /** record ids referenced by a dmr_pipeline (suppressed at top level). */
  private dmrDetailIds = new SvelteSet<string>();
  // ── internal-only index (not read during render → plain Map) ──────
  /** record id → its top-level group ancestor id (so head-drop never splits
   *  an agent_invocation from its agent_output / tool_call children). */
  private groupRootOf = new Map<string, string>();

  /** Whether the window head-drops on overflow (App mirrors its autoScroll). */
  setStickToBottom(v: boolean): void {
    this.stickToBottom = v;
  }

  /** Oldest record currently in the window — the keyset cursor for load-older. */
  get oldest(): SerializedRecord | undefined {
    return this.records[0];
  }

  /**
   * Add a single record. Dedupes, updates indexes, inserts in conversational
   * order via binary search (O(log W)), and drops head groups when the window
   * overflows `cap` and the user is pinned to the tail.
   */
  add(record: SerializedRecord): void {
    if (this.byId.has(record.id)) return;
    this.addToIndexes(record);

    const key = orderKeyOf(record, this.byId);
    let lo = 0;
    let hi = this.records.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (compareKeys(orderKeyOf(this.records[mid], this.byId), key) < 0) lo = mid + 1;
      else hi = mid;
    }
    this.records.splice(lo, 0, record);
    this.totalCount++;

    // Recompute AFTER the splice so the scan sees the just-added pipeline.
    if (record.record_type === 'dmr_pipeline') this.recomputeDmrDetailIds();

    if (this.stickToBottom && this.records.length > this.cap) {
      this.dropHeadGroupsToCap();
    }
  }

  /**
   * Update fields on an existing record (in place — keeps window position).
   */
  update(id: string, fields: Partial<SerializedRecord>): void {
    const existing = this.byId.get(id);
    if (!existing) return;
    const updated = { ...existing, ...fields };
    this.byId.set(id, updated);
    const idx = this.records.findIndex((r) => r.id === id);
    if (idx >= 0) this.records[idx] = updated;
    if (updated.record_type === 'dmr_pipeline') this.recomputeDmrDetailIds();
  }

  /**
   * Replace the window with a bounded snapshot. `records` is the host-selected
   * window (already the latest slice); `totalCount` is the run's full count so
   * the UI can show how much history exists. Kept name `setSnapshot` for the
   * webview message handler; caps to the last `cap` defensively.
   */
  setSnapshot(snapshot: SerializedRecord[], totalCount?: number): void {
    this.clearIndexes();
    const sorted = conversationalSort(snapshot);
    let windowed = sorted;
    let trimmed = false;
    if (sorted.length > this.cap) {
      windowed = sorted.slice(sorted.length - this.cap);
      trimmed = true;
    }
    for (const r of windowed) this.addToIndexes(r);
    this.recomputeDmrDetailIds();
    this.records = windowed;
    this.totalCount = totalCount ?? snapshot.length;
    this.hasOlder = trimmed || (totalCount != null && totalCount > windowed.length);
  }

  /**
   * Prepend an older page (fetched via the host `loadOlder` keyset query) to
   * the head of the window. The window is allowed to grow beyond `cap` while
   * the user reads history; `trimToCap()` re-bounds it on jump-to-latest.
   */
  prependOlder(older: SerializedRecord[], hasMore: boolean): void {
    const fresh = older.filter((r) => !this.byId.has(r.id));
    for (const r of fresh) this.addToIndexes(r);
    this.records = conversationalSort([...fresh, ...this.records]);
    this.recomputeDmrDetailIds();
    this.hasOlder = hasMore;
  }

  /** Re-bound the window to the latest `cap` records (called on jump-to-latest). */
  trimToCap(): void {
    if (this.records.length > this.cap) this.dropHeadGroupsToCap();
  }

  clear(): void {
    this.records = [];
    this.clearIndexes();
    this.totalCount = 0;
    this.hasOlder = false;
  }

  // ── index maintenance ────────────────────────────────────────────

  private addToIndexes(record: SerializedRecord): void {
    this.byId.set(record.id, record);
    for (const pid of record.derived_from_record_ids) {
      const arr = this.childrenByParent.get(pid);
      if (arr) arr.push(record.id);
      else this.childrenByParent.set(pid, [record.id]);
    }
    if (record.record_type === 'reasoning_review_record') {
      for (const pid of record.derived_from_record_ids) {
        const existing = this.reviewByOutput.get(pid);
        const existingRec = existing ? this.byId.get(existing) : undefined;
        if (!existingRec || existingRec.produced_at <= record.produced_at) {
          this.reviewByOutput.set(pid, record.id);
        }
      }
    }
    this.groupRootOf.set(record.id, this.computeGroupRoot(record));
  }

  private removeFromIndexes(record: SerializedRecord): void {
    this.byId.delete(record.id);
    for (const pid of record.derived_from_record_ids) {
      const arr = this.childrenByParent.get(pid);
      if (!arr) continue;
      const next = arr.filter((id) => id !== record.id);
      if (next.length) this.childrenByParent.set(pid, next);
      else this.childrenByParent.delete(pid);
    }
    if (record.record_type === 'reasoning_review_record') {
      for (const pid of record.derived_from_record_ids) {
        if (this.reviewByOutput.get(pid) === record.id) this.reviewByOutput.delete(pid);
      }
    }
    this.groupRootOf.delete(record.id);
  }

  private clearIndexes(): void {
    this.byId.clear();
    this.childrenByParent.clear();
    this.reviewByOutput.clear();
    this.dmrDetailIds.clear();
    this.groupRootOf.clear();
  }

  /** Walk `derived_from` up to the top-level ancestor. Parents always precede
   *  their children in arrival order, so the parent's root is already known. */
  private computeGroupRoot(record: SerializedRecord): string {
    for (const pid of record.derived_from_record_ids) {
      if (this.byId.has(pid)) return this.groupRootOf.get(pid) ?? pid;
    }
    return record.id;
  }

  /** Rebuild the dmr-detail suppression set by scanning the window's (few)
   *  dmr_pipeline records. Cheap — pipelines are rare relative to total rows. */
  private recomputeDmrDetailIds(): void {
    this.dmrDetailIds.clear();
    for (const r of this.records) {
      if (r.record_type !== 'dmr_pipeline') continue;
      const c = r.content as {
        stages?: Array<{ output_record_id?: string }>;
        retrieval_brief_record_id?: string;
      };
      if (c.retrieval_brief_record_id) this.dmrDetailIds.add(c.retrieval_brief_record_id);
      for (const s of c.stages ?? []) {
        if (s.output_record_id) this.dmrDetailIds.add(s.output_record_id);
      }
    }
  }

  /** Drop whole groups from the head until the window is ≤ cap. Groups are
   *  contiguous at the head because roots precede their children in order. */
  private dropHeadGroupsToCap(): void {
    let droppedDmrPipeline = false;
    while (this.records.length > this.cap) {
      const head = this.records[0];
      const rootId = this.groupRootOf.get(head.id) ?? head.id;
      let removeCount = 0;
      while (
        removeCount < this.records.length &&
        (this.groupRootOf.get(this.records[removeCount].id) ?? this.records[removeCount].id) === rootId
      ) {
        removeCount++;
      }
      if (removeCount === 0) break; // safety — never spin
      const removed = this.records.splice(0, removeCount);
      for (const r of removed) {
        if (r.record_type === 'dmr_pipeline') droppedDmrPipeline = true;
        this.removeFromIndexes(r);
      }
      this.hasOlder = true;
    }
    if (droppedDmrPipeline) this.recomputeDmrDetailIds();
  }

  // ── lookups (index-backed) ───────────────────────────────────────

  /** Look up a single record by id (used by provenance citation chips). */
  getById(id: string): SerializedRecord | undefined {
    return this.byId.get(id);
  }

  /**
   * Return all records whose `derived_from_record_ids` includes the given
   * parent id, in chronological order. Used by AgentInvocationCard to gather
   * its child records (agent_output, tool_call, agent_reasoning_step, etc.).
   */
  getChildren(parentId: string): SerializedRecord[] {
    const ids = this.childrenByParent.get(parentId);
    if (!ids) return [];
    const out: SerializedRecord[] = [];
    for (const id of ids) {
      const r = this.byId.get(id);
      if (r) out.push(r);
    }
    out.sort((a, b) => compareKeys(orderKeyOf(a, this.byId), orderKeyOf(b, this.byId)));
    return out;
  }

  /**
   * Check if a record is a child of an agent_invocation. Used by the Card
   * dispatcher to skip child records at the top level (they render nested
   * inside AgentInvocationCard instead).
   */
  isChildOfInvocation(record: SerializedRecord): boolean {
    if (record.derived_from_record_ids.length === 0) return false;
    for (const pid of record.derived_from_record_ids) {
      const parent = this.byId.get(pid);
      if (parent && parent.record_type === 'agent_invocation') return true;
    }
    // reasoning_review_record points at agent_output, not at agent_invocation
    // directly — walk one hop up the derivation chain so it nests inside
    // the AgentInvocationCard alongside its reviewed agent_output.
    if (record.record_type === 'reasoning_review_record') {
      for (const pid of record.derived_from_record_ids) {
        const parent = this.byId.get(pid);
        if (parent && parent.record_type === 'agent_output' && this.isChildOfInvocation(parent)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Find the reasoning_review_record (if any) for a given agent_output id.
   * Used by AgentInvocationCard to render the review inline next to its
   * reviewed output. Returns the most recent review when multiple exist.
   */
  getReviewForOutput(agentOutputId: string): SerializedRecord | undefined {
    const reviewId = this.reviewByOutput.get(agentOutputId);
    return reviewId ? this.byId.get(reviewId) : undefined;
  }

  /**
   * True when the given record is referenced by a sibling `dmr_pipeline`
   * container record (via `stages[].output_record_id` /
   * `retrieval_brief_record_id`), or is an agent_invocation whose child is
   * such a referenced detail record. Used by the Card dispatcher to suppress
   * DMR detail records at the top level — they render inline inside
   * DmrPipelineCard so the whole DMR run reads as one composite card.
   */
  isReferencedByDmrPipeline(record: SerializedRecord): boolean {
    if (this.dmrDetailIds.has(record.id)) return true;
    if (record.record_type === 'agent_invocation') {
      const children = this.childrenByParent.get(record.id);
      if (children) {
        for (const childId of children) {
          if (this.dmrDetailIds.has(childId)) return true;
        }
      }
    }
    return false;
  }

  // ── decomposition helpers (window scans; cold — only for decomp types) ──
  // These read `this.records` directly and so track the reactive window array.

  isNonRootDecompositionNode(record: SerializedRecord): boolean {
    if (record.record_type !== 'requirement_decomposition_node') return false;
    const content = record.content as { depth?: number };
    return typeof content.depth === 'number' && content.depth > 0;
  }

  isSupersededDecompositionPipeline(record: SerializedRecord): boolean {
    if (record.record_type !== 'requirement_decomposition_pipeline') return false;
    const c = record.content as { pipeline_id?: string };
    if (!c.pipeline_id) return false;
    for (const r of this.records) {
      if (r.record_type !== 'requirement_decomposition_pipeline') continue;
      const rc = r.content as { pipeline_id?: string };
      if (rc.pipeline_id !== c.pipeline_id) continue;
      if (r.produced_at > record.produced_at) return true;
    }
    return false;
  }

  isOwnedByDecompositionPipeline(record: SerializedRecord): boolean {
    if (record.record_type !== 'requirement_decomposition_node'
      && record.record_type !== 'assumption_set_snapshot') return false;
    const rootKind = resolveRecordRootKind(record);
    return this.records.some(
      r => r.record_type === 'requirement_decomposition_pipeline'
        && resolveRecordRootKind(r) === rootKind,
    );
  }

  getDecompositionChildren(parentNodeId: string): SerializedRecord[] {
    return this.records
      .filter(r => r.record_type === 'requirement_decomposition_node'
        && (r.content as { parent_node_id?: string }).parent_node_id === parentNodeId);
  }

  getLatestDecompositionNode(nodeId: string): SerializedRecord | undefined {
    let latest: SerializedRecord | undefined;
    for (const r of this.records) {
      if (r.record_type !== 'requirement_decomposition_node') continue;
      const c = r.content as { node_id?: string };
      if (c.node_id !== nodeId) continue;
      if (!latest || r.produced_at > latest.produced_at) latest = r;
    }
    return latest;
  }

  // ── Wave 7 — component decomposition helpers ─────────────────────

  isSupersededComponentDecompositionPipeline(record: SerializedRecord): boolean {
    if (record.record_type !== 'component_decomposition_pipeline') return false;
    const c = record.content as { pipeline_id?: string };
    if (!c.pipeline_id) return false;
    for (const r of this.records) {
      if (r.record_type !== 'component_decomposition_pipeline') continue;
      const rc = r.content as { pipeline_id?: string };
      if (rc.pipeline_id !== c.pipeline_id) continue;
      if (r.produced_at > record.produced_at) return true;
    }
    return false;
  }

  isOwnedByComponentPipeline(record: SerializedRecord): boolean {
    if (record.record_type !== 'component_decomposition_node'
      && record.record_type !== 'component_assumption_set_snapshot') return false;
    return this.records.some(r => r.record_type === 'component_decomposition_pipeline');
  }

  getComponentDecompositionChildren(parentNodeId: string): SerializedRecord[] {
    return this.records
      .filter(r => r.record_type === 'component_decomposition_node'
        && (r.content as { parent_node_id?: string }).parent_node_id === parentNodeId);
  }

  getLatestComponentDecompositionNode(nodeId: string): SerializedRecord | undefined {
    let latest: SerializedRecord | undefined;
    for (const r of this.records) {
      if (r.record_type !== 'component_decomposition_node') continue;
      const c = r.content as { node_id?: string };
      if (c.node_id !== nodeId) continue;
      if (!latest || r.produced_at > latest.produced_at) latest = r;
    }
    return latest;
  }

  // ── Wave 8 — task decomposition helpers ──────────────────────────

  isSupersededTaskDecompositionPipeline(record: SerializedRecord): boolean {
    if (record.record_type !== 'task_decomposition_pipeline') return false;
    const c = record.content as { pipeline_id?: string };
    if (!c.pipeline_id) return false;
    for (const r of this.records) {
      if (r.record_type !== 'task_decomposition_pipeline') continue;
      const rc = r.content as { pipeline_id?: string };
      if (rc.pipeline_id !== c.pipeline_id) continue;
      if (r.produced_at > record.produced_at) return true;
    }
    return false;
  }

  isOwnedByTaskPipeline(record: SerializedRecord): boolean {
    if (record.record_type !== 'task_decomposition_node'
      && record.record_type !== 'task_assumption_set_snapshot') return false;
    return this.records.some(r => r.record_type === 'task_decomposition_pipeline');
  }

  getTaskDecompositionChildren(parentNodeId: string): SerializedRecord[] {
    return this.records
      .filter(r => r.record_type === 'task_decomposition_node'
        && (r.content as { parent_node_id?: string }).parent_node_id === parentNodeId);
  }

  getLatestTaskDecompositionNode(nodeId: string): SerializedRecord | undefined {
    let latest: SerializedRecord | undefined;
    for (const r of this.records) {
      if (r.record_type !== 'task_decomposition_node') continue;
      const c = r.content as { node_id?: string };
      if (c.node_id !== nodeId) continue;
      if (!latest || r.produced_at > latest.produced_at) latest = r;
    }
    return latest;
  }

  get count(): number {
    return this.records.length;
  }
}

/**
 * Resolve the effective `root_kind` ('fr' | 'nfr') for a decomposition-
 * related record. Decomposition nodes carry `root_kind` directly.
 * Assumption snapshots and pipeline containers encode it via the
 * `root_fr_id` marker ('*' → FR, '*nfr*' → NFR) because the snapshot
 * schema predates the `root_kind` field. Returns 'fr' as the default
 * for records that don't carry either signal.
 */
function resolveRecordRootKind(record: SerializedRecord): 'fr' | 'nfr' {
  const direct = (record.content as { root_kind?: string }).root_kind;
  if (direct === 'fr' || direct === 'nfr') return direct;
  const marker = (record.content as { root_fr_id?: string }).root_fr_id ?? '*';
  return marker === '*nfr*' ? 'nfr' : 'fr';
}

/**
 * Sort records into conversational order — chronological by `produced_at`,
 * with each `client_liaison_response` pinned immediately after the
 * `raw_intent_received` / `open_query_received` it replies to (so a
 * "Workflow started…" acknowledgement sits under the intent that triggered
 * it, chat-thread style, rather than buried under later phase content).
 *
 * Implemented as a total-order sort over {@link orderKeyOf} so the batch path
 * (snapshot / prepend) and the incremental `add()` binary search agree exactly
 * on ordering.
 */
function conversationalSort(records: SerializedRecord[]): SerializedRecord[] {
  const byId = new Map<string, SerializedRecord>();
  for (const r of records) byId.set(r.id, r);
  return records.slice().sort((a, b) => compareKeys(orderKeyOf(a, byId), orderKeyOf(b, byId)));
}

export const recordsStore = new RecordsStore();
