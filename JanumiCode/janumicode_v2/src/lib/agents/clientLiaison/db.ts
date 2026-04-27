/**
 * ClientLiaisonDB — read-only-ish database access layer for the Universal
 * Router. Implements the spec §10.1 interface plus a hybrid FTS5+vector
 * search and a pending-decisions helper used by the retriever.
 *
 * Vector similarity is computed in JavaScript over Float32Array embeddings
 * stored in `governed_stream_vec` (BLOB column). No sqlite-vec dependency.
 */

import type { Database } from '../../database/init';
import type {
  GovernedStreamRecord,
  RecordType,
  PhaseId,
  AuthorityLevel,
  AgentRole,
  WorkflowRun,
  MemoryEdgeType,
  WorkflowRunStatus,
} from '../../types/records';
import { EmbeddingService, cosineSimilarity } from '../../embedding/embeddingService';
import { getLogger } from '../../logging';
import type { RecordFilters, WorkflowStatus } from './types';

export interface MemoryEdge {
  id: string;
  source_id: string;
  target_id: string;
  edge_type: MemoryEdgeType;
  status: string;
}

export interface ClientLiaisonDB {
  ftsSearch(query: string, filters?: RecordFilters): GovernedStreamRecord[];
  getRecordsByType(type: RecordType, runId?: string): GovernedStreamRecord[];
  getRecordsByPhase(phaseId: PhaseId, runId?: string): GovernedStreamRecord[];
  getRecordById(id: string): GovernedStreamRecord | null;
  getRecordsByIds(ids: string[]): GovernedStreamRecord[];
  traverseEdges(fromId: string, edgeType?: MemoryEdgeType, depth?: number): MemoryEdge[];
  getDownstreamDependencies(entityId: string, depth?: number): GovernedStreamRecord[];
  getCurrentWorkflowRun(): WorkflowRun | null;
  /**
   * DB-as-truth resolver for "which run should the UI focus on right now?".
   * Tiered resolution, deterministic, single read path:
   *   1. The user-focused run from `ui_state.focused_run_id`, IF that id
   *      still exists in `workflow_runs`. Otherwise the focus is treated
   *      as stale and ignored — handles DB-swap cleanly.
   *   2. The unique active run (`status IN ('initiated','in_progress')`).
   *   3. Most recent run by `initiated_at` that owns ≥ 1
   *      `requirement_decomposition_node` record (the "post-mortem"
   *      viewing case for a completed cal run).
   *   4. Most recent run of any kind by `initiated_at`.
   *   5. null when the DB has no runs at all.
   * Used by the DecompViewer + GovernedStreamView so they Just Work
   * after a DB swap without any in-memory session state.
   */
  getActiveWorkflowRun(): WorkflowRun | null;
  /**
   * Persist the user's currently-focused run. Stored in the `ui_state`
   * key/value table so it travels with the DB (never in extension
   * memory or VS Code workspaceState — DB swap automatically resets).
   * Pass `null` to clear the focus.
   */
  setFocusedWorkflowRun(runId: string | null): void;
  /**
   * Read the `ui_state.focused_run_id` raw — does NOT validate that the
   * id still exists in `workflow_runs`. Most callers want
   * `getActiveWorkflowRun()` instead.
   */
  getFocusedWorkflowRunId(): string | null;
  getWorkflowStatus(runId: string): WorkflowStatus;
  getPendingDecisions(runId: string): GovernedStreamRecord[];
  vectorSearch(query: string, opts?: { workflowRunId?: string; limit?: number }): Promise<GovernedStreamRecord[]>;
  hybridSearch(query: string, opts?: { workflowRunId?: string; limit?: number }): Promise<GovernedStreamRecord[]>;
  getRecentRecords(runId: string, limit?: number): GovernedStreamRecord[];
  /**
   * Retrieve the last N conversation turns for a run — pairs of
   * open_query_received (or raw_intent_received) and the
   * client_liaison_response that answered them. Used to give the
   * synthesizer multi-turn context so follow-ups like "what about the
   * previous one?" resolve correctly.
   *
   * Pairs are oldest-first in the returned array. Unpaired queries
   * (still in flight) are omitted.
   */
  getRecentConversationTurns(runId: string, limit?: number): ConversationTurn[];
}

export interface ConversationTurn {
  queryRecord: GovernedStreamRecord;
  responseRecord: GovernedStreamRecord;
}

export class ClientLiaisonDBImpl implements ClientLiaisonDB {
  constructor(
    private readonly db: Database,
    private readonly embedding: EmbeddingService,
  ) {}

  // ── Direct queries ────────────────────────────────────────────

  ftsSearch(query: string, filters?: RecordFilters): GovernedStreamRecord[] {
    const keywords = query
      .split(/\s+/)
      .filter(w => w.length > 2)
      .map(w => w.replace(/['"]/g, ''))
      .join(' OR ');
    if (!keywords) return [];

    const conds = ['governed_stream_fts MATCH ?', 'gs.is_current_version = 1'];
    const params: unknown[] = [keywords];

    if (filters?.workflowRunId) {
      conds.push('gs.workflow_run_id = ?');
      params.push(filters.workflowRunId);
    }
    if (filters?.recordType) {
      conds.push('gs.record_type = ?');
      params.push(filters.recordType);
    }
    if (filters?.phaseId) {
      conds.push('gs.phase_id = ?');
      params.push(filters.phaseId);
    }

    const limit = filters?.limit ?? 10;

    try {
      const rows = this.db
        .prepare(
          `SELECT gs.*
             FROM governed_stream_fts fts
             JOIN governed_stream gs ON gs.id = fts.id
            WHERE ${conds.join(' AND ')}
         ORDER BY gs.authority_level DESC, gs.produced_at DESC
            LIMIT ?`,
        )
        .all(...params, limit) as Record<string, unknown>[];
      return rows.map(r => this.rowToRecord(r));
    } catch (err) {
      getLogger().warn('agent', 'FTS search failed', { error: String(err) });
      return [];
    }
  }

  getRecordsByType(type: RecordType, runId?: string): GovernedStreamRecord[] {
    const rows = runId
      ? this.db
          .prepare(
            `SELECT * FROM governed_stream
              WHERE record_type = ? AND workflow_run_id = ? AND is_current_version = 1
              ORDER BY produced_at ASC`,
          )
          .all(type, runId)
      : this.db
          .prepare(
            `SELECT * FROM governed_stream
              WHERE record_type = ? AND is_current_version = 1
              ORDER BY produced_at ASC`,
          )
          .all(type);
    return (rows as Record<string, unknown>[]).map(r => this.rowToRecord(r));
  }

  getRecordsByPhase(phaseId: PhaseId, runId?: string): GovernedStreamRecord[] {
    const rows = runId
      ? this.db
          .prepare(
            `SELECT * FROM governed_stream
              WHERE phase_id = ? AND workflow_run_id = ? AND is_current_version = 1
              ORDER BY produced_at ASC`,
          )
          .all(phaseId, runId)
      : this.db
          .prepare(
            `SELECT * FROM governed_stream
              WHERE phase_id = ? AND is_current_version = 1
              ORDER BY produced_at ASC`,
          )
          .all(phaseId);
    return (rows as Record<string, unknown>[]).map(r => this.rowToRecord(r));
  }

  getRecordById(id: string): GovernedStreamRecord | null {
    const row = this.db
      .prepare('SELECT * FROM governed_stream WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined;
    return row ? this.rowToRecord(row) : null;
  }

  getRecordsByIds(ids: string[]): GovernedStreamRecord[] {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    const rows = this.db
      .prepare(
        `SELECT * FROM governed_stream WHERE id IN (${placeholders}) AND is_current_version = 1`,
      )
      .all(...ids) as Record<string, unknown>[];
    return rows.map(r => this.rowToRecord(r));
  }

  getRecentRecords(runId: string, limit = 10): GovernedStreamRecord[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM governed_stream
          WHERE workflow_run_id = ? AND is_current_version = 1
          ORDER BY produced_at DESC
          LIMIT ?`,
      )
      .all(runId, limit) as Record<string, unknown>[];
    return rows.map(r => this.rowToRecord(r));
  }

  getRecentConversationTurns(runId: string, limit = 5): ConversationTurn[] {
    // Pair each client_liaison_response with the raw_intent_received /
    // open_query_received record it derived from. Ordered oldest-first so
    // the prompt reads chronologically.
    const responseRows = this.db
      .prepare(
        `SELECT * FROM governed_stream
          WHERE workflow_run_id = ?
            AND record_type = 'client_liaison_response'
            AND is_current_version = 1
          ORDER BY produced_at DESC
          LIMIT ?`,
      )
      .all(runId, limit) as Record<string, unknown>[];

    const turns: ConversationTurn[] = [];
    for (const row of responseRows) {
      const responseRecord = this.rowToRecord(row);
      const derivedFrom = responseRecord.derived_from_record_ids ?? [];
      if (derivedFrom.length === 0) continue;
      const queryRecord = this.getRecordById(derivedFrom[0]);
      if (!queryRecord) continue;
      if (
        queryRecord.record_type !== 'open_query_received' &&
        queryRecord.record_type !== 'raw_intent_received'
      ) continue;
      turns.push({ queryRecord, responseRecord });
    }
    // Oldest-first for prompt readability.
    return turns.reverse();
  }

  // ── Memory edge graph traversal ───────────────────────────────

  traverseEdges(fromId: string, edgeType?: MemoryEdgeType, depth = 5): MemoryEdge[] {
    const visited = new Set<string>([fromId]);
    const result: MemoryEdge[] = [];
    const frontier: string[] = [fromId];
    let currentDepth = 0;

    while (frontier.length > 0 && currentDepth < depth) {
      const next: string[] = [];
      for (const id of frontier) {
        const sql = edgeType
          ? `SELECT id, source_id, target_id, edge_type, status
               FROM memory_edge
              WHERE source_id = ? AND edge_type = ? AND status != 'rejected'`
          : `SELECT id, source_id, target_id, edge_type, status
               FROM memory_edge
              WHERE source_id = ? AND status != 'rejected'`;
        const rows = (
          edgeType
            ? this.db.prepare(sql).all(id, edgeType)
            : this.db.prepare(sql).all(id)
        ) as MemoryEdge[];
        for (const edge of rows) {
          result.push(edge);
          if (!visited.has(edge.target_id)) {
            visited.add(edge.target_id);
            next.push(edge.target_id);
          }
        }
      }
      frontier.length = 0;
      frontier.push(...next);
      currentDepth++;
    }

    return result;
  }

  getDownstreamDependencies(entityId: string, depth = 5): GovernedStreamRecord[] {
    // Records that derive_from / implement / validate the given entity.
    const visited = new Set<string>([entityId]);
    const result: GovernedStreamRecord[] = [];
    const frontier: string[] = [entityId];
    let currentDepth = 0;

    while (frontier.length > 0 && currentDepth < depth) {
      const next: string[] = [];
      for (const id of frontier) {
        const rows = this.db
          .prepare(
            `SELECT DISTINCT gs.*
               FROM memory_edge me
               JOIN governed_stream gs ON gs.id = me.source_id
              WHERE me.target_id = ?
                AND me.edge_type IN ('derives_from', 'implements', 'validates')
                AND me.status != 'rejected'
                AND gs.is_current_version = 1`,
          )
          .all(id) as Record<string, unknown>[];
        for (const r of rows) {
          const record = this.rowToRecord(r);
          if (!visited.has(record.id)) {
            visited.add(record.id);
            result.push(record);
            next.push(record.id);
          }
        }
      }
      frontier.length = 0;
      frontier.push(...next);
      currentDepth++;
    }

    return result;
  }

  // ── Workflow state ────────────────────────────────────────────

  getCurrentWorkflowRun(): WorkflowRun | null {
    const row = this.db
      .prepare(
        `SELECT * FROM workflow_runs
          WHERE status IN ('initiated', 'in_progress')
          ORDER BY initiated_at DESC LIMIT 1`,
      )
      .get() as Record<string, unknown> | undefined;
    return row ? this.rowToWorkflowRun(row) : null;
  }

  getFocusedWorkflowRunId(): string | null {
    try {
      const row = this.db
        .prepare(`SELECT value FROM ui_state WHERE key = ?`)
        .get('focused_run_id') as { value: string | null } | undefined;
      return row?.value ?? null;
    } catch {
      // Older DB without ui_state — treat as no focus.
      return null;
    }
  }

  setFocusedWorkflowRun(runId: string | null): void {
    if (runId === null) {
      this.db.prepare(`DELETE FROM ui_state WHERE key = ?`).run('focused_run_id');
      return;
    }
    this.db
      .prepare(
        `INSERT INTO ui_state(key, value, updated_at) VALUES(?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .run('focused_run_id', runId);
  }

  getActiveWorkflowRun(): WorkflowRun | null {
    // Tier 1 — user-focused run (DB-persisted). Validate it still
    // exists; if it doesn't, the focus is from a prior DB and should
    // be ignored (DB-swap-safe).
    const focusedId = this.getFocusedWorkflowRunId();
    if (focusedId) {
      const focusedRow = this.db
        .prepare(`SELECT * FROM workflow_runs WHERE id = ?`)
        .get(focusedId) as Record<string, unknown> | undefined;
      if (focusedRow) return this.rowToWorkflowRun(focusedRow);
      // Stale focus — clear so we stop checking on every call.
      try { this.setFocusedWorkflowRun(null); } catch { /* readonly DB tolerated */ }
    }

    // Tier 2 — active run.
    const active = this.getCurrentWorkflowRun();
    if (active) return active;

    // Tier 3 — most recent run with ≥ 1 decomposition node.
    const withDecomp = this.db
      .prepare(
        `SELECT wr.* FROM workflow_runs wr
          WHERE EXISTS (
            SELECT 1 FROM governed_stream gs
              WHERE gs.workflow_run_id = wr.id
                AND gs.record_type = 'requirement_decomposition_node'
                AND gs.is_current_version = 1
            LIMIT 1
          )
          ORDER BY wr.initiated_at DESC LIMIT 1`,
      )
      .get() as Record<string, unknown> | undefined;
    if (withDecomp) return this.rowToWorkflowRun(withDecomp);

    // Tier 4 — any run.
    const anyRun = this.db
      .prepare(`SELECT * FROM workflow_runs ORDER BY initiated_at DESC LIMIT 1`)
      .get() as Record<string, unknown> | undefined;
    return anyRun ? this.rowToWorkflowRun(anyRun) : null;
  }

  getWorkflowStatus(runId: string): WorkflowStatus {
    const row = this.db
      .prepare('SELECT * FROM workflow_runs WHERE id = ?')
      .get(runId) as Record<string, unknown> | undefined;
    if (!row) {
      return {
        run: null,
        currentPhaseId: null,
        currentSubPhaseId: null,
        status: null,
        recentRecords: [],
      };
    }
    const run = this.rowToWorkflowRun(row);
    return {
      run,
      currentPhaseId: run.current_phase_id,
      currentSubPhaseId: run.current_sub_phase_id,
      status: run.status,
      recentRecords: this.getRecentRecords(runId, 10),
    };
  }

  getPendingDecisions(runId: string): GovernedStreamRecord[] {
    // Return mirror_presented / decision_bundle_presented / phase_gate_evaluation
    // records that have no matching follow-up record.
    const surfaces = [
      'mirror_presented',
      'decision_bundle_presented',
      'phase_gate_evaluation',
    ];
    const placeholders = surfaces.map(() => '?').join(',');

    const rows = this.db
      .prepare(
        `SELECT * FROM governed_stream gs
          WHERE gs.workflow_run_id = ?
            AND gs.record_type IN (${placeholders})
            AND gs.is_current_version = 1
            AND NOT EXISTS (
              SELECT 1 FROM governed_stream f
              WHERE f.workflow_run_id = gs.workflow_run_id
                AND f.record_type IN (
                  'mirror_approved', 'mirror_rejected', 'mirror_edited',
                  'phase_gate_approved', 'phase_gate_rejected',
                  'decision_bundle_resolved', 'decision_trace'
                )
                AND f.derived_from_record_ids LIKE '%' || gs.id || '%'
            )
          ORDER BY gs.produced_at ASC`,
      )
      .all(runId, ...surfaces) as Record<string, unknown>[];
    return rows.map(r => this.rowToRecord(r));
  }

  // ── Vector & hybrid search ────────────────────────────────────

  async vectorSearch(
    query: string,
    opts: { workflowRunId?: string; limit?: number } = {},
  ): Promise<GovernedStreamRecord[]> {
    let queryVec: Float32Array;
    try {
      queryVec = await this.embedding.embedQuery(query);
    } catch {
      return [];
    }

    const sql = opts.workflowRunId
      ? `SELECT gs.*, gv.embedding
           FROM governed_stream gs
           JOIN governed_stream_vec gv ON gv.record_id = gs.id
          WHERE gs.is_current_version = 1
            AND gs.workflow_run_id = ?`
      : `SELECT gs.*, gv.embedding
           FROM governed_stream gs
           JOIN governed_stream_vec gv ON gv.record_id = gs.id
          WHERE gs.is_current_version = 1`;

    const rows = (opts.workflowRunId
      ? this.db.prepare(sql).all(opts.workflowRunId)
      : this.db.prepare(sql).all()) as Array<Record<string, unknown>>;

    const scored = rows.map(r => {
      const buf = r.embedding as Buffer;
      const vec = new Float32Array(
        buf.buffer,
        buf.byteOffset,
        buf.byteLength / 4,
      );
      return { record: this.rowToRecord(r), score: cosineSimilarity(queryVec, vec) };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, opts.limit ?? 10).map(s => s.record);
  }

  async hybridSearch(
    query: string,
    opts: { workflowRunId?: string; limit?: number } = {},
  ): Promise<GovernedStreamRecord[]> {
    const limit = opts.limit ?? 10;
    const ftsResults = this.ftsSearch(query, {
      workflowRunId: opts.workflowRunId,
      limit: limit * 2,
    });
    let vecResults: GovernedStreamRecord[] = [];
    try {
      vecResults = await this.vectorSearch(query, {
        workflowRunId: opts.workflowRunId,
        limit: limit * 2,
      });
    } catch {
      // Vector search degrades silently — FTS-only is acceptable.
    }

    const seen = new Set<string>();
    const merged: GovernedStreamRecord[] = [];
    // Interleave: prefer items appearing in both, then FTS, then vector.
    const ftsIds = new Set(ftsResults.map(r => r.id));
    const both = vecResults.filter(r => ftsIds.has(r.id));
    for (const r of both) {
      if (!seen.has(r.id)) { seen.add(r.id); merged.push(r); }
    }
    for (const r of ftsResults) {
      if (!seen.has(r.id)) { seen.add(r.id); merged.push(r); }
    }
    for (const r of vecResults) {
      if (!seen.has(r.id)) { seen.add(r.id); merged.push(r); }
    }
    return merged.slice(0, limit);
  }

  // ── Row mapping helpers ───────────────────────────────────────

  private rowToRecord(row: Record<string, unknown>): GovernedStreamRecord {
    return {
      id: row.id as string,
      record_type: row.record_type as RecordType,
      schema_version: row.schema_version as string,
      workflow_run_id: row.workflow_run_id as string,
      phase_id: (row.phase_id as string) || null,
      sub_phase_id: (row.sub_phase_id as string) || null,
      produced_by_agent_role: (row.produced_by_agent_role as AgentRole) || null,
      produced_by_record_id: (row.produced_by_record_id as string) || null,
      produced_at: row.produced_at as string,
      effective_at: (row.effective_at as string) || null,
      janumicode_version_sha: row.janumicode_version_sha as string,
      authority_level: row.authority_level as AuthorityLevel,
      derived_from_system_proposal: !!(row.derived_from_system_proposal as number),
      is_current_version: !!(row.is_current_version as number),
      superseded_by_id: (row.superseded_by_id as string) || null,
      superseded_at: (row.superseded_at as string) || null,
      superseded_by_record_id: (row.superseded_by_record_id as string) || null,
      source_workflow_run_id: row.source_workflow_run_id as string,
      derived_from_record_ids: JSON.parse((row.derived_from_record_ids as string) || '[]'),
      quarantined: !!(row.quarantined as number),
      sanitized: !!(row.sanitized as number),
      sanitized_fields: JSON.parse((row.sanitized_fields as string) || '[]'),
      content: JSON.parse(row.content as string),
    };
  }

  private rowToWorkflowRun(row: Record<string, unknown>): WorkflowRun {
    return {
      id: row.id as string,
      workspace_id: row.workspace_id as string,
      janumicode_version_sha: row.janumicode_version_sha as string,
      initiated_at: row.initiated_at as string,
      completed_at: (row.completed_at as string) || null,
      status: row.status as WorkflowRunStatus,
      current_phase_id: (row.current_phase_id as PhaseId) || null,
      current_sub_phase_id: (row.current_sub_phase_id as string) || null,
      raw_intent_record_id: (row.raw_intent_record_id as string) || null,
      scope_classification_ref: (row.scope_classification_ref as string) || null,
      compliance_context_ref: (row.compliance_context_ref as string) || null,
      cross_run_impact_triggered: !!(row.cross_run_impact_triggered as number),
      intent_lens: (row.intent_lens as import('../../types/records').IntentLens) || null,
      decomposition_budget_calls_used: (row.decomposition_budget_calls_used as number) ?? 0,
      decomposition_fr_calls_used: (row.decomposition_fr_calls_used as number) ?? 0,
      decomposition_nfr_calls_used: (row.decomposition_nfr_calls_used as number) ?? 0,
      decomposition_max_depth_reached: (row.decomposition_max_depth_reached as number) ?? 0,
      active_release_plan_record_id: (row.active_release_plan_record_id as string) || null,
    };
  }
}
