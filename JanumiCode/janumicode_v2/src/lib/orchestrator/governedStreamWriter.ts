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
import type {
  GovernedStreamRecord,
  RecordType,
  AuthorityLevel,
  AgentRole,
} from '../types/records';
import type { EventBus, SerializedRecord } from '../events/eventBus';
import type { EmbeddingService } from '../embedding/embeddingService';

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

    const rows = this.db.prepare(
      `SELECT * FROM governed_stream ${whereClause} ORDER BY produced_at ASC`
    ).all(workflowRunId, recordType) as Record<string, unknown>[];

    return rows.map(row => this.rowToRecord(row));
  }

  // ── Authority Level Assignment (§3.1) ──────────────────────────

  /**
   * Deterministic authority level assignment based on record type.
   * No LLM call required.
   */
  private resolveAuthorityLevel(
    recordType: RecordType,
    _subPhaseId?: string | null,
  ): AuthorityLevel {
    // Human interaction records
    switch (recordType) {
      case 'mirror_approved':
      case 'phase_gate_approved':
        return 5; // Human-Approved
      case 'mirror_edited':
        return 4; // Human-Edited
      case 'mirror_presented':
      case 'menu_presented':
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
      default:
        return 2; // Agent-Asserted (default for agent-produced records)
    }
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
