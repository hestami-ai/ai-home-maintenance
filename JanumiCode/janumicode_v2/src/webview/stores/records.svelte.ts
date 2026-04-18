/**
 * Reactive store for Governed Stream records (Svelte 5 runes).
 * Single source of truth for the webview.
 *
 * The extension host sends records via postMessage.
 * This store holds them as a $state field; consumers read `recordsStore.records`
 * directly and Svelte's runtime tracks the dependency for surgical updates.
 */

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

class RecordsStore {
  records = $state<SerializedRecord[]>([]);

  /**
   * Add a single record. Inserts in chronological order by produced_at,
   * then pins conversational-thread records (client_liaison_response)
   * adjacent to the record they derive from — see `conversationalSort`.
   */
  add(record: SerializedRecord): void {
    if (this.records.some(r => r.id === record.id)) return;
    this.records = conversationalSort([...this.records, record]);
  }

  /**
   * Update fields on an existing record.
   */
  update(id: string, fields: Partial<SerializedRecord>): void {
    this.records = this.records.map(r =>
      r.id === id ? { ...r, ...fields } : r,
    );
  }

  /**
   * Replace the entire record set (e.g. on webview restore).
   */
  setSnapshot(snapshot: SerializedRecord[]): void {
    this.records = conversationalSort([...snapshot]);
  }

  clear(): void {
    this.records = [];
  }

  /** Look up a single record by id (used by provenance citation chips). */
  getById(id: string): SerializedRecord | undefined {
    return this.records.find(r => r.id === id);
  }

  /**
   * Return all records whose `derived_from_record_ids` includes the given
   * parent id. Used by AgentInvocationCard to gather its child records
   * (agent_output, tool_call, agent_reasoning_step, etc.).
   */
  getChildren(parentId: string): SerializedRecord[] {
    return this.records.filter(
      r => r.derived_from_record_ids.includes(parentId),
    );
  }

  /**
   * Check if a record is a child of an agent_invocation. Used by the Card
   * dispatcher to skip child records at the top level (they render nested
   * inside AgentInvocationCard instead).
   */
  isChildOfInvocation(record: SerializedRecord): boolean {
    if (record.derived_from_record_ids.length === 0) return false;
    return this.records.some(
      r => r.record_type === 'agent_invocation' &&
           record.derived_from_record_ids.includes(r.id),
    );
  }

  /**
   * True when the given record is referenced by a sibling `dmr_pipeline`
   * container record — either via `stages[].output_record_id` (the
   * Stage 1 / 7 detail records) or via `retrieval_brief_record_id` on
   * the pipeline content, or because the record's `derived_from` chain
   * leads back to a DMR detail record that itself is referenced.
   *
   * Used by the Card dispatcher to suppress DMR detail records at the
   * top level — they render inline inside DmrPipelineCard so the
   * whole DMR run reads as one composite card.
   */
  isReferencedByDmrPipeline(record: SerializedRecord): boolean {
    const pipelineDetailIds = this.collectDmrPipelineDetailIds();
    if (pipelineDetailIds.has(record.id)) return true;
    // Also suppress agent_invocation records whose child is a detail
    // record referenced by a pipeline (Stage 1 + Stage 7 each open an
    // agent_invocation that owns a detail-record child).
    if (record.record_type === 'agent_invocation') {
      return this.hasDmrDetailChild(record.id, pipelineDetailIds);
    }
    return false;
  }

  private collectDmrPipelineDetailIds(): Set<string> {
    const ids = new Set<string>();
    for (const r of this.records) {
      if (r.record_type !== 'dmr_pipeline') continue;
      const c = r.content as {
        stages?: Array<{ output_record_id?: string }>;
        retrieval_brief_record_id?: string;
      };
      if (c.retrieval_brief_record_id) ids.add(c.retrieval_brief_record_id);
      for (const s of c.stages ?? []) {
        if (s.output_record_id) ids.add(s.output_record_id);
      }
    }
    return ids;
  }

  private hasDmrDetailChild(parentId: string, detailIds: Set<string>): boolean {
    for (const child of this.records) {
      if (!child.derived_from_record_ids.includes(parentId)) continue;
      if (detailIds.has(child.id)) return true;
    }
    return false;
  }

  get count(): number {
    return this.records.length;
  }
}

export const recordsStore = new RecordsStore();

/**
 * Sort records chronologically, then pin conversational-thread records
 * adjacent to the record they reply to.
 *
 * Motivation: client_liaison_response records for workflow_initiation
 * queries are written AFTER the forced `startWorkflow` capability
 * returns, which is AFTER Phase 0 completes and often AFTER Phase 1's
 * first few records land. A pure produced_at sort therefore shows the
 * user their "Workflow started…" acknowledgement buried underneath
 * Phase 1 content — confusing, because conversationally the response
 * belongs immediately under the intent that triggered it.
 *
 * The fix: after chronological sort, lift every `client_liaison_response`
 * up to sit right after the record it derives from (raw_intent_received
 * or open_query_received). This matches chat-thread UX without mutating
 * timestamps on the governed stream.
 */
function conversationalSort(records: SerializedRecord[]): SerializedRecord[] {
  const chronological = records.slice().sort(
    (a, b) => a.produced_at.localeCompare(b.produced_at),
  );

  const byId = new Map<string, SerializedRecord>();
  for (const r of chronological) byId.set(r.id, r);

  const result: SerializedRecord[] = [];
  const placed = new Set<string>();
  const respondingTypes = new Set(['raw_intent_received', 'open_query_received']);

  // Group responses by their anchor record id so we can insert them right
  // after the anchor during the pass below.
  const responsesByAnchor = new Map<string, SerializedRecord[]>();
  for (const r of chronological) {
    if (r.record_type !== 'client_liaison_response') continue;
    const anchorId = r.derived_from_record_ids.find(id => {
      const anchor = byId.get(id);
      return anchor && respondingTypes.has(anchor.record_type);
    });
    if (!anchorId) continue;
    const list = responsesByAnchor.get(anchorId) ?? [];
    list.push(r);
    responsesByAnchor.set(anchorId, list);
  }

  for (const r of chronological) {
    if (placed.has(r.id)) continue;
    if (r.record_type === 'client_liaison_response' && responsesByAnchor.size > 0) {
      // Responses are only emitted when traversed via their anchor below.
      // Skipping here keeps the response from appearing out of thread.
      const isAnchored = [...responsesByAnchor.values()].some(
        list => list.some(resp => resp.id === r.id),
      );
      if (isAnchored) continue;
    }
    result.push(r);
    placed.add(r.id);

    const pinned = responsesByAnchor.get(r.id);
    if (pinned) {
      for (const resp of pinned) {
        if (!placed.has(resp.id)) {
          result.push(resp);
          placed.add(resp.id);
        }
      }
    }
  }

  // Safety: append anything that somehow got orphaned.
  for (const r of chronological) {
    if (!placed.has(r.id)) {
      result.push(r);
      placed.add(r.id);
    }
  }

  return result;
}
