/**
 * GovernedStreamWriter — the single writer to the Governed Stream database.
 * Based on JanumiCode Spec v2.3, §5 and §7.8.
 *
 * Responsibilities:
 * - Records all actions with correct universal fields
 * - Assigns Authority Levels at record write time (deterministic)
 * - Sets quarantined flag on records with severity: high Reasoning Review findings
 * - Propagates derived_from_system_proposal flag
 * - Triggers Ingestion Pipeline (Wave 4)
 */

import type { Database } from '../database/init';
import { collectGovernedStream } from '../database/iterateGovernedStream';
import type {
  GovernedStreamRecord,
  RecordType,
  AuthorityLevel,
  AgentRole,
} from '../types/records';
import type { EventBus, SerializedRecord } from '../events/eventBus';
import type { EmbeddingService } from '../embedding/embeddingService';
import { emitLifecycle } from '../trace/lifecycle';

/**
 * Sub-phase IDs whose `artifact_produced` outputs are Bloom Sub-Phase
 * candidate space (Authority Level 1 per spec §3.1). Matches anything
 * containing `_bloom` or `_saturation` — covers terminal forms like
 * `business_domains_bloom` AND mid-string forms like `fr_bloom_enrichment`,
 * `nfr_bloom_skeleton`, `fr_bloom_skeleton`. Saturation passes use
 * decomposition_node record types and are also handled via
 * DECOMPOSITION_NODE_RECORD_TYPES.
 */
const BLOOM_SUB_PHASE_PATTERN = /(_bloom|_saturation)(_|$)/;

const DECOMPOSITION_NODE_RECORD_TYPES = new Set<RecordType>([
  'requirement_decomposition_node',
  'component_decomposition_node',
  'task_decomposition_node',
  'data_model_decomposition_node',
  'test_decomposition_node',
]);

/**
 * Record types that warrant an artifact.produced lifecycle event.
 * Skips high-volume bookkeeping (agent_reasoning_step, agent_output_chunk,
 * transformation_step itself) — those would spam the NDJSON without
 * adding signal. Decomposition nodes are included individually so the
 * scope-creep survey can count them.
 */
const ARTIFACT_LIFECYCLE_RECORD_TYPES = new Set<RecordType>([
  'artifact_produced',
  'implementation_packet',
  'packet_synthesis_failure',
  'requirement_decomposition_node',
  'component_decomposition_node',
  'task_decomposition_node',
  'data_model_decomposition_node',
  'test_decomposition_node',
  'phase_gate_evaluation',
  'reasoning_review_harness_record',
  'cycle_iteration',
  'execution_wave_started',
  'execution_wave_completed',
  'task_quarantine',
  'coverage_gap',
]);

/**
 * Best-effort count summarizer for the artifact.produced event. Picks
 * up the common array-shaped fields on substantive content so a single
 * grep on the lifecycle NDJSON can answer "how many X did phase Y
 * produce". Unknown shapes return an empty object — no error.
 */
function summarizeArtifactCounts(content: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(content)) {
    if (Array.isArray(v)) out[`${k}_count`] = v.length;
  }
  return out;
}

export interface WriteRecordOptions {
  /** Record type */
  record_type: RecordType;
  /** Schema version for this record type */
  schema_version: string;
  /** Workflow Run ID */
  workflow_run_id: string;
  /** Phase ID (null for phase-independent records) */
  phase_id?: string | null;
  /** Sub-Phase ID */
  sub_phase_id?: string | null;
  /** Agent Role that produced this record */
  produced_by_agent_role?: AgentRole | null;
  /** Agent Invocation record ID that produced this record */
  produced_by_record_id?: string | null;
  /** JanumiCode version SHA */
  janumicode_version_sha: string;
  /** Authority level (auto-assigned if not provided) */
  authority_level?: AuthorityLevel;
  /** Source workflow run ID (defaults to workflow_run_id) */
  source_workflow_run_id?: string;
  /** Records this record derives from */
  derived_from_record_ids?: string[];
  /** Type-specific content payload */
  content: Record<string, unknown>;
  /** Override effective_at (defaults to produced_at) */
  effective_at?: string;
}

export class GovernedStreamWriter {
  private eventBus: EventBus | null = null;
  private embeddingService: EmbeddingService | null = null;

  constructor(
    private readonly db: Database,
    private readonly generateId: () => string,
  ) {}

  /**
   * Attach an EventBus so every successful write emits `record:added`.
   * Optional — passes silently if not set.
   */
  setEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus;
  }

  /**
   * Attach an EmbeddingService so every successful write enqueues the record
   * for background embedding. Optional — passes silently if not set.
   */
  setEmbeddingService(service: EmbeddingService): void {
    this.embeddingService = service;
  }

  /**
   * Project the full record into the minimal shape sent to the webview.
   */
  private serializeForEvent(record: GovernedStreamRecord): SerializedRecord {
    return {
      id: record.id,
      record_type: record.record_type,
      phase_id: record.phase_id,
      sub_phase_id: record.sub_phase_id,
      produced_by_agent_role: record.produced_by_agent_role,
      produced_at: record.produced_at,
      authority_level: record.authority_level,
      quarantined: record.quarantined,
      derived_from_record_ids: record.derived_from_record_ids ?? [],
      content: record.content,
    };
  }

  /**
   * Write a new record to the Governed Stream.
   * Returns the complete record with all universal fields populated.
   */
  writeRecord(options: WriteRecordOptions): GovernedStreamRecord {
    const now = new Date().toISOString();
    const id = this.generateId();

    // Determine if any parent record has derived_from_system_proposal
    const derivedFromSystemProposal = this.checkSystemProposalPropagation(
      options.derived_from_record_ids,
    );

    const record: GovernedStreamRecord = {
      id,
      record_type: options.record_type,
      schema_version: options.schema_version,
      workflow_run_id: options.workflow_run_id,
      phase_id: options.phase_id ?? null,
      sub_phase_id: options.sub_phase_id ?? null,
      produced_by_agent_role: options.produced_by_agent_role ?? null,
      produced_by_record_id: options.produced_by_record_id ?? null,
      produced_at: now,
      effective_at: options.effective_at ?? this.resolveEffectiveAt(options.record_type, now),
      janumicode_version_sha: options.janumicode_version_sha,
      authority_level: options.authority_level ?? this.resolveAuthorityLevel(options.record_type, options.sub_phase_id),
      derived_from_system_proposal: derivedFromSystemProposal,
      is_current_version: true,
      superseded_by_id: null,
      superseded_at: null,
      superseded_by_record_id: null,
      source_workflow_run_id: options.source_workflow_run_id ?? options.workflow_run_id,
      derived_from_record_ids: options.derived_from_record_ids ?? [],
      quarantined: false,
      sanitized: false,
      sanitized_fields: [],
      content: options.content,
    };

    // Insert into governed_stream
    this.db.prepare(`
      INSERT INTO governed_stream (
        id, record_type, schema_version, workflow_run_id,
        phase_id, sub_phase_id, produced_by_agent_role, produced_by_record_id,
        produced_at, effective_at, janumicode_version_sha, authority_level,
        derived_from_system_proposal, is_current_version,
        superseded_by_id, superseded_at, superseded_by_record_id,
        source_workflow_run_id, derived_from_record_ids,
        quarantined, sanitized, sanitized_fields, content
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?
      )
    `).run(
      record.id, record.record_type, record.schema_version, record.workflow_run_id,
      record.phase_id, record.sub_phase_id, record.produced_by_agent_role, record.produced_by_record_id,
      record.produced_at, record.effective_at, record.janumicode_version_sha, record.authority_level,
      record.derived_from_system_proposal ? 1 : 0, record.is_current_version ? 1 : 0,
      record.superseded_by_id, record.superseded_at, record.superseded_by_record_id,
      record.source_workflow_run_id, JSON.stringify(record.derived_from_record_ids),
      record.quarantined ? 1 : 0, record.sanitized ? 1 : 0,
      JSON.stringify(record.sanitized_fields), JSON.stringify(record.content),
    );

    // TODO (Wave 4): Trigger Ingestion Pipeline

    // Notify the webview channel. recordsStore deduplicates by id, so phase
    // handlers that still emit `record:added` manually remain idempotent.
    if (this.eventBus) {
      this.eventBus.emit('record:added', { record: this.serializeForEvent(record) });
    }

    // Tier-1 lifecycle: emit an artifact.produced event when the record
    // is one of the substantive content artifacts (skip the high-volume
    // bookkeeping types like agent_reasoning_step, agent_output_chunk,
    // transformation_step, etc.). The event summarizes key field counts
    // so survey-level queries can spot scope creep at a glance.
    if (ARTIFACT_LIFECYCLE_RECORD_TYPES.has(record.record_type)) {
      emitLifecycle('artifact.produced', {
        workflow_run_id: record.workflow_run_id,
        phase_id: record.phase_id,
        sub_phase_id: record.sub_phase_id,
        record_id: record.id,
        record_type: record.record_type,
        kind: (record.content as { kind?: unknown }).kind ?? null,
        agent_role: record.produced_by_agent_role,
        counts: summarizeArtifactCounts(record.content),
      });
    }

    // Enqueue for background embedding. Non-blocking; embedding failures do
    // not affect the write path. See EmbeddingService for the queue lifecycle.
    if (this.embeddingService) {
      this.embeddingService.enqueue(record);
    }

    return record;
  }

  /**
   * Set the quarantined flag on a record.
   * Called when Reasoning Review finds severity: high flaw.
   */
  quarantineRecord(recordId: string): void {
    this.db.prepare(`
      UPDATE governed_stream SET quarantined = 1 WHERE id = ?
    `).run(recordId);
  }

  /**
   * Mark a record as superseded (rollback within a run).
   */
  supersedByRollback(recordId: string, supersededById: string): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE governed_stream
      SET is_current_version = 0, superseded_by_id = ?, superseded_at = ?
      WHERE id = ?
    `).run(supersededById, now, recordId);
  }

  /**
   * Retire any prior current-version `requirement_decomposition_node`
   * rows whose `content.node_id` (the logical UUID) matches the supplied
   * id. Invoked after writing a new revision of a logical decomposition
   * node (Step 4b downgrade, pruned supersession, deferred supersession,
   * or any future status change) so that at most one row per
   * (workflow_run_id, content.node_id) is current at a time. Initial
   * writes of brand-new logical nodes are harmless no-ops — no prior
   * row matches the freshly-minted UUID.
   */
  supersedeDecompositionNodeByLogicalId(
    workflowRunId: string,
    logicalNodeId: string,
    supersedingRecordId: string,
  ): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE governed_stream
         SET is_current_version = 0,
             superseded_by_id = ?,
             superseded_at = ?
       WHERE workflow_run_id = ?
         AND record_type = 'requirement_decomposition_node'
         AND is_current_version = 1
         AND id != ?
         AND json_extract(content, '$.node_id') = ?
    `).run(supersedingRecordId, now, workflowRunId, supersedingRecordId, logicalNodeId);
  }

  /**
   * Wave 7 — supersede a component decomposition node by its logical
   * UUID. Mirrors the FR variant above. Separate method (rather than
   * generalized record_type parameter) keeps the existing FR behavior
   * untouched while Wave 7 calibrates; a future consolidation can fold
   * them together.
   */
  supersedeComponentDecompositionNodeByLogicalId(
    workflowRunId: string,
    logicalNodeId: string,
    supersedingRecordId: string,
  ): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE governed_stream
         SET is_current_version = 0,
             superseded_by_id = ?,
             superseded_at = ?
       WHERE workflow_run_id = ?
         AND record_type = 'component_decomposition_node'
         AND is_current_version = 1
         AND id != ?
         AND json_extract(content, '$.node_id') = ?
    `).run(supersedingRecordId, now, workflowRunId, supersedingRecordId, logicalNodeId);
  }

  /**
   * Wave 8 — supersede a task decomposition node by its logical UUID.
   * Mirrors the FR / component variants. Separate method (rather than
   * generalized record_type parameter) keeps the existing FR / component
   * behavior untouched while Wave 8 calibrates.
   */
  supersedeTaskDecompositionNodeByLogicalId(
    workflowRunId: string,
    logicalNodeId: string,
    supersedingRecordId: string,
  ): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE governed_stream
         SET is_current_version = 0,
             superseded_by_id = ?,
             superseded_at = ?
       WHERE workflow_run_id = ?
         AND record_type = 'task_decomposition_node'
         AND is_current_version = 1
         AND id != ?
         AND json_extract(content, '$.node_id') = ?
    `).run(supersedingRecordId, now, workflowRunId, supersedingRecordId, logicalNodeId);
  }

  /**
   * Wave 9 — supersede a data-model decomposition node by its logical
   * UUID. Mirrors the FR / component / task variants.
   */
  supersedeDataModelDecompositionNodeByLogicalId(
    workflowRunId: string,
    logicalNodeId: string,
    supersedingRecordId: string,
  ): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE governed_stream
         SET is_current_version = 0,
             superseded_by_id = ?,
             superseded_at = ?
       WHERE workflow_run_id = ?
         AND record_type = 'data_model_decomposition_node'
         AND is_current_version = 1
         AND id != ?
         AND json_extract(content, '$.node_id') = ?
    `).run(supersedingRecordId, now, workflowRunId, supersedingRecordId, logicalNodeId);
  }

  /**
   * Wave 10 — supersede a test decomposition node by its logical UUID.
   */
  supersedeTestDecompositionNodeByLogicalId(
    workflowRunId: string,
    logicalNodeId: string,
    supersedingRecordId: string,
  ): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE governed_stream
         SET is_current_version = 0,
             superseded_by_id = ?,
             superseded_at = ?
       WHERE workflow_run_id = ?
         AND record_type = 'test_decomposition_node'
         AND is_current_version = 1
         AND id != ?
         AND json_extract(content, '$.node_id') = ?
    `).run(supersedingRecordId, now, workflowRunId, supersedingRecordId, logicalNodeId);
  }

  /**
   * Mark a record as semantically superseded (across workflow runs).
   */
  semanticSupersession(recordId: string, supersededByRecordId: string): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE governed_stream
      SET superseded_by_record_id = ?, superseded_at = ?
      WHERE id = ?
    `).run(supersededByRecordId, now, recordId);
  }

  /**
   * Read a record by ID.
   */
  getRecord(recordId: string): GovernedStreamRecord | null {
    const row = this.db.prepare(
      'SELECT * FROM governed_stream WHERE id = ?'
    ).get(recordId) as Record<string, unknown> | undefined;

    if (!row) return null;
    return this.rowToRecord(row);
  }

  /**
   * Query records by type for a workflow run.
   */
  getRecordsByType(
    workflowRunId: string,
    recordType: RecordType,
    currentVersionOnly = true,
  ): GovernedStreamRecord[] {
    const whereClause = currentVersionOnly
      ? 'WHERE workflow_run_id = ? AND record_type = ? AND is_current_version = 1'
      : 'WHERE workflow_run_id = ? AND record_type = ?';

    // Paginate via the shared `iterateGovernedStream` helper. High-fanout
    // record types (e.g. agent_reasoning_step) on long calibration runs
    // can approach the 32MB SAB ceiling enforced by the sidecar RPC
    // bridge; PAGE_SIZE 500 keeps each batch comfortably below it.
    const stmt = this.db.prepare(
      `SELECT * FROM governed_stream ${whereClause} ORDER BY produced_at ASC LIMIT ? OFFSET ?`,
    );
    const rows = collectGovernedStream<Record<string, unknown>>(
      stmt, [workflowRunId, recordType], { pageSize: 500 });

    return rows.map(row => this.rowToRecord(row));
  }

  /**
   * Count records of a given type for a workflow run. Use this when only
   * the cardinality is needed (e.g. Phase 10 closure summary). Loading
   * full bodies via getRecordsByType for thousands of rows can overflow
   * the sidecar SAB bridge (32MB) and surface as
   * "RPC error: offset is out of bounds".
   */
  countRecordsByType(
    workflowRunId: string,
    recordType: RecordType,
    currentVersionOnly = true,
  ): number {
    const whereClause = currentVersionOnly
      ? 'WHERE workflow_run_id = ? AND record_type = ? AND is_current_version = 1'
      : 'WHERE workflow_run_id = ? AND record_type = ?';
    const row = this.db.prepare(
      `SELECT COUNT(*) AS n FROM governed_stream ${whereClause}`
    ).get(workflowRunId, recordType) as { n: number } | undefined;
    return row?.n ?? 0;
  }

  /**
   * Fetch a single artifact_produced record by its content.kind. Returns
   * the most recent matching row (current version). Narrower than
   * getRecordsByType for callers that only need one specific artifact
   * (e.g. intent_statement) without paying the bulk-load cost.
   */
  getArtifactByKind(
    workflowRunId: string,
    kind: string,
  ): GovernedStreamRecord | null {
    const row = this.db.prepare(
      `SELECT * FROM governed_stream
       WHERE workflow_run_id = ?
         AND record_type = 'artifact_produced'
         AND is_current_version = 1
         AND json_extract(content, '$.kind') = ?
       ORDER BY produced_at DESC
       LIMIT 1`
    ).get(workflowRunId, kind) as Record<string, unknown> | undefined;
    return row ? this.rowToRecord(row) : null;
  }

  // ── Authority Level Assignment (§3.1) ──────────────────────────

  /**
   * Deterministic authority level assignment based on record type.
   * No LLM call required.
   */
  private resolveAuthorityLevel(
    recordType: RecordType,
    subPhaseId?: string | null,
  ): AuthorityLevel {
    // Human interaction records
    switch (recordType) {
      case 'mirror_approved':
      case 'phase_gate_approved':
      case 'decision_bundle_resolved':
        return 5; // Human-Approved
      case 'mirror_edited':
        return 4; // Human-Edited
      case 'mirror_acknowledged':
        return 3; // Human-Acknowledged (continued past Mirror without editing/approving)
      case 'mirror_presented':
      case 'decision_bundle_presented':
        return 2; // Agent-Asserted (presented to human, not yet acted on)
      case 'decision_trace':
        return 5; // Human-Approved (human made a selection)
      case 'mirror_rejected':
      case 'phase_gate_rejected':
        return 5; // Human-Approved (rejection is a human decision)
      case 'rollback_authorized':
      case 'quarantine_override':
      case 'warning_acknowledged':
      case 'warning_batch_acknowledged':
        return 5; // Human-Approved
      case 'raw_intent_received':
        return 5; // Human-Approved (human provided the input)
      case 'narrative_memory':
        return 5; // Human-Approved (generated at Phase Gate approval)
      case 'constitutional_invariant':
        return 7; // Constitutional — spec §1.5; seeded once per workspace
      case 'auto_mitigation_action':
        return 5; // Human-Approved equivalent — orchestrator policy=auto authorised the mutation
    }

    // Level 1 (Exploratory) — spec §3.1: "Agent-generated candidate space
    // before any human interaction." Bloom Sub-Phase outputs + decomposition
    // nodes (saturation expansion) fall here. After Mirror interaction the
    // lifecycle moves them up (4 on edit, 5 on approve, 6 on gate-certify).
    if (DECOMPOSITION_NODE_RECORD_TYPES.has(recordType)) {
      return 1;
    }
    if (recordType === 'artifact_produced' && subPhaseId && BLOOM_SUB_PHASE_PATTERN.test(subPhaseId)) {
      return 1;
    }

    return 2; // Agent-Asserted (default for agent-produced records)
  }

  // ── effective_at Resolution (§13.3) ────────────────────────────

  private resolveEffectiveAt(recordType: RecordType, producedAt: string): string {
    // Most record types: effective_at = produced_at
    // Special cases (decision_trace, mirror_edited, etc.) where the human
    // action timestamp may differ are handled via the explicit effective_at
    // parameter in WriteRecordOptions
    return producedAt;
  }

  // ── System Proposal Propagation (§3.1) ─────────────────────────

  /**
   * Check if any parent record has derived_from_system_proposal = true
   * and has not been explicitly approved (authority_level < 5).
   */
  private checkSystemProposalPropagation(parentIds?: string[]): boolean {
    if (!parentIds || parentIds.length === 0) return false;

    for (const parentId of parentIds) {
      const parent = this.db.prepare(`
        SELECT derived_from_system_proposal, authority_level
        FROM governed_stream WHERE id = ?
      `).get(parentId) as { derived_from_system_proposal: number; authority_level: number } | undefined;

      if (parent && parent.derived_from_system_proposal === 1 && parent.authority_level < 5) {
        return true;
      }
    }

    return false;
  }

  // ── Row mapping ────────────────────────────────────────────────

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
}
