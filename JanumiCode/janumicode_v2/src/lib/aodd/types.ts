/**
 * AODD type registry — event types, payload map, envelope, summaries.
 *
 * Defined in `docs/design/aodd-design.md` §1 (event schema) and §4
 * (sub-phase summary 5W+H).
 *
 * Naming convention:
 *   - Event types are dotted `namespace.action` (e.g. "phase.entered").
 *     Distinct from EventBus which uses "namespace:action".
 *   - Payload field names are snake_case (matches LLM-emit norm).
 *     Distinct from EventBus payloads which use camelCase. The dual-emit
 *     pattern (design memo §5) carries the transform explicitly at the
 *     call-site.
 *
 * Schema versioning: integer `AODD_SCHEMA_VERSION`. Bump on breaking
 * changes only. Additive changes (new optional fields, new event types)
 * do not bump.
 */

import type { PhaseId } from '../types/records';

/** Current AODD schema version. Bump only on breaking changes. */
export const AODD_SCHEMA_VERSION = 1;

// ── Event type registry ─────────────────────────────────────────────

export type AoddEventType =
  // Run lifecycle
  | 'run.started'
  | 'run.completed'
  | 'run.resumed'
  | 'run.failed'
  // Phase lifecycle
  | 'phase.entered'
  | 'phase.exited'
  // Sub-phase lifecycle
  | 'sub_phase.entered'
  | 'sub_phase.exited'
  | 'sub_phase.summary'
  // LLM I/O
  | 'llm.invoked'
  | 'llm.returned'
  | 'llm.failed'
  | 'llm.cache_hit'
  // Agent cognition
  | 'agent.invocation_started'
  | 'agent.invocation_completed'
  | 'agent.reasoning_step'
  | 'agent.self_correction'
  | 'agent.tool_call'
  | 'agent.output_skipped'
  | 'agent.output_write_failed'
  // Prompt assembly
  | 'prompt.template_rendered'
  | 'prompt.materialized'
  // Records
  | 'record.added'
  | 'record.updated'
  | 'record.quarantined'
  | 'record.superseded'
  // Decisions
  | 'decision.requested'
  | 'decision.resolved'
  | 'decision.escalated'
  // Mirror / MMP
  | 'mirror.presented'
  | 'mirror.resolved'
  // Validators
  | 'validator.run'
  | 'validator.finding'
  // Gates
  | 'gate.pending'
  | 'gate.approved'
  | 'gate.rejected'
  // JSON repair
  | 'repair.json_attempted'
  | 'repair.json_succeeded'
  | 'repair.json_failed'
  // Retries
  | 'retry.scheduled'
  | 'retry.attempted'
  // Audit pause
  | 'audit.pause_emitted'
  | 'audit.pause_resolved'
  // Logger pass-through
  | 'log.debug'
  | 'log.info'
  | 'log.warn'
  | 'log.error'
  // Test / eval
  | 'test.run_started'
  | 'test.suite_completed'
  | 'test.run_completed'
  | 'eval.started'
  | 'eval.completed'
  // Context
  | 'context.assembled'
  | 'context.detail_file_written';

// ── Payload reference (sidecar payload store, design memo §2.3) ─────

/**
 * Reference to a sidecar payload file under
 *   runs/<run_id>/aodd/payloads/<ulid>.{json,txt}
 *
 * Emitted in-line when a payload would otherwise exceed the inline
 * threshold (>4 KB structured / >1 KB free-text). The reader uses
 * `payload_ref` as the basename and `kind` as the extension hint.
 */
export interface PayloadRef {
  payload_ref: string;
  bytes: number;
  kind: 'json' | 'text';
}

/** Shared payload shape for log.* events (LogEntry → AODD translation). */
export interface LogPayload {
  trace_id: string;
  category: string;
  message: string;
  data?: Record<string, unknown>;
  duration_ms?: number | null;
}

// ── Payload-shape map ───────────────────────────────────────────────

/**
 * Per-event payload shapes. New optional fields are additive (no schema
 * bump). Field removal or type change requires bumping
 * AODD_SCHEMA_VERSION.
 *
 * Where a payload may carry large free-form text (prompts, model output,
 * reasoning, tool params), the field type is `string | PayloadRef` so
 * the emitter can spill on size threshold without changing the wire
 * shape consumers see.
 */
export interface AoddEventPayload {
  // Run
  'run.started': { intent_brief: string | null; resume_from?: string };
  'run.completed': { duration_ms: number; status: 'success' | 'partial' };
  'run.resumed': { resumed_at: string };
  'run.failed': {
    duration_ms: number;
    error: { message: string; phase_id?: PhaseId | null };
  };

  // Phase
  'phase.entered': { phase_name: string };
  'phase.exited': {
    phase_name: string;
    status: 'success' | 'partial' | 'failed' | 'skipped';
    duration_ms: number;
    artifact_count: number;
    error?: { message: string };
  };

  // Sub-phase
  'sub_phase.entered': { sub_phase_name?: string };
  'sub_phase.exited': {
    status: 'success' | 'partial' | 'failed';
    duration_ms: number;
    error?: { message: string };
  };
  'sub_phase.summary': { summary_path: string };

  // LLM
  'llm.invoked': {
    provider: string;
    model: string;
    temperature?: number;
    max_tokens?: number;
    prompt: string | PayloadRef;
    system?: string | PayloadRef;
    template_key?: string;
    template_source_sha?: string;
  };
  'llm.returned': {
    text: string | PayloadRef;
    thinking?: string | PayloadRef | null;
    input_tokens: number | null;
    output_tokens: number | null;
    duration_ms: number;
    retry_attempts: number;
  };
  'llm.failed': {
    error: { message: string; code?: string; status?: number };
    duration_ms: number;
    retry_attempts: number;
  };
  'llm.cache_hit': {
    source_invocation_id: string;
    text: string | PayloadRef;
  };

  // Agent
  'agent.invocation_started': { invocation_id: string; agent_role: string };
  'agent.invocation_completed': { invocation_id: string; success: boolean };
  'agent.reasoning_step': {
    invocation_id: string;
    content: string | PayloadRef;
    sequence_position: number;
  };
  'agent.self_correction': {
    invocation_id: string;
    content: string | PayloadRef;
    sequence_position: number;
  };
  'agent.tool_call': {
    invocation_id: string;
    tool_name: string;
    params: string | PayloadRef;
    sequence_position: number;
  };
  'agent.output_skipped': { invocation_id: string; reason: string };
  'agent.output_write_failed': {
    invocation_id: string;
    error: { message: string };
  };

  // Prompt
  'prompt.template_rendered': {
    template_key: string;
    template_source_sha: string;
    output_ref?: PayloadRef;
  };
  'prompt.materialized': {
    invocation_id: string;
    final_prompt: string | PayloadRef;
  };

  // Records
  'record.added': {
    record_id: string;
    record_type: string;
    /**
     * Optional structural summary derived from the record's content
     * (e.g. field counts for implementation_packet, blocking-failure
     * rollup for packet_synthesis_failure). Populated by
     * `governedStreamWriter.writeRecord` via `src/lib/aodd/recordSummary.ts`.
     * Lets an agent inspecting the trace see shape-level diagnostic
     * info without opening the DB.
     */
    summary?: Record<string, unknown>;
  };
  'record.updated': {
    record_id: string;
    record_type: string;
    field_diff?: Record<string, unknown>;
  };
  'record.quarantined': {
    record_id: string;
    record_type: string;
    reason: string;
  };
  /**
   * Emitted when an existing governed_stream record's
   * `is_current_version` flag flips from 1 → 0. Captures both
   * rollback-driven supersessions and decomposition-node revision
   * supersessions. Lets an agent reconstruct the supersession graph
   * (and detect "drift" — records that should have been superseded
   * but weren't) without joining DB columns.
   */
  'record.superseded': {
    record_id: string;
    /** Record_type of the superseded record (e.g. 'requirement_decomposition_node'). */
    record_type: string;
    /** Record that replaced this one (or null for plain rollbacks). */
    superseded_by_id: string | null;
    /** Why this record was superseded — diagnostic free-form text. */
    reason: 'rollback' | 'decomposition_revision' | string;
  };

  // Decisions
  'decision.requested': {
    decision_id: string;
    surface_type: 'mirror' | 'decision_bundle' | 'phase_gate';
  };
  'decision.resolved': {
    decision_id: string;
    resolution: { type: string; payload?: unknown };
  };
  'decision.escalated': {
    escalation_record_id: string;
    description: string;
  };

  // Mirror
  'mirror.presented': { mirror_id: string; artifact_type: string };
  'mirror.resolved': { mirror_id: string; resolution: string };

  // Validator
  'validator.run': {
    validator_name: string;
    target_record_id: string;
    duration_ms: number;
  };
  'validator.finding': {
    validator_name: string;
    target_record_id: string;
    severity: 'error' | 'warning' | 'info';
    message: string;
  };

  // Gate
  'gate.pending': { gate_kind: string };
  'gate.approved': { gate_kind: string };
  'gate.rejected': { gate_kind: string; reason: string };

  // Repair
  'repair.json_attempted': { strategy: string; raw: string | PayloadRef };
  'repair.json_succeeded': {
    strategy: string;
    repaired: string | PayloadRef;
  };
  'repair.json_failed': { strategy: string; error: { message: string } };

  // Retry
  'retry.scheduled': { attempt: number; reason: string };
  'retry.attempted': { attempt: number };

  // Audit
  'audit.pause_emitted': { seq: number; marker_path: string };
  'audit.pause_resolved': {
    seq: number;
    ack_path: string;
    action?: string;
  };

  // Logger
  'log.debug': LogPayload;
  'log.info': LogPayload;
  'log.warn': LogPayload;
  'log.error': LogPayload;

  // Test
  'test.run_started': { suite_count: number };
  'test.suite_completed': {
    suite_id: string;
    suite_name: string;
    passed: number;
    failed: number;
    skipped: number;
  };
  'test.run_completed': {
    total_passed: number;
    total_failed: number;
    total_skipped: number;
    duration_ms: number;
    success: boolean;
  };

  // Eval
  'eval.started': { eval_type: string };
  'eval.completed': { eval_type: string; passed: boolean };

  // Context
  'context.assembled': {
    input_record_ids: string[];
    output_ref?: PayloadRef;
  };
  'context.detail_file_written': { path: string; bytes: number };
}

// ── Event envelope ──────────────────────────────────────────────────

/**
 * AODD event envelope. One line in `events.ndjson` = one event.
 *
 * All identifier fields are required (`run_id`) or explicitly nullable
 * (`phase_id`, `sub_phase_id`, etc.) — never absent. This keeps the
 * on-disk shape uniform and greppable.
 */
export interface AoddEvent<T extends AoddEventType = AoddEventType> {
  schema_version: number;
  event_id: string;
  event_type: T;
  /** ISO 8601 UTC. */
  ts: string;
  run_id: string;
  phase_id: PhaseId | null;
  sub_phase_id: string | null;
  invocation_id: string | null;
  agent_role: string | null;
  /** Parent in the cognition chain (push/pop via withAoddSpan). */
  parent_event_id: string | null;
  /** Semantic causation, distinct from parent. */
  caused_by_event_id: string | null;
  payload: AoddEventPayload[T];
  metadata: Record<string, unknown> | null;
}

// ── Sub-phase summary (design memo §4.2) ────────────────────────────

export interface InvocationStep {
  invocation_id: string;
  depth: number;
}

export interface SubPhaseSummaryWho {
  agent_role: string | null;
  model: string;
  model_parameters: Record<string, unknown>;
  invocation_chain: InvocationStep[];
}

export interface SubPhaseRecordRef {
  record_id: string;
  record_type: string;
  brief: string;
}

export interface SubPhaseDecisionRef {
  kind: 'validator_finding' | 'mirror' | 'gate' | 'escalation';
  ref_event_id: string;
  brief: string;
}

export interface SubPhaseSummaryWhat {
  inputs_consumed: SubPhaseRecordRef[];
  outputs_produced: SubPhaseRecordRef[];
  decisions: SubPhaseDecisionRef[];
}

export interface SubPhaseSummaryWhy {
  template_key: string;
  template_source_sha: string;
  rendered_prompt_ref: string;
  governing_constraints: string[];
}

export interface SubPhaseFallback {
  from: string;
  to: string;
  reason: string;
}

export interface SubPhaseSummaryHow {
  retries: number;
  repairs: number;
  escalations: number;
  fallbacks: SubPhaseFallback[];
  status: 'success' | 'partial' | 'failed';
  error: { event_id: string; message: string } | null;
}

export interface SubPhaseEventRange {
  first_event_id: string;
  last_event_id: string;
  count: number;
}

export interface SubPhaseSummary {
  schema_version: number;
  run_id: string;
  phase_id: PhaseId;
  sub_phase_id: string;

  started_at: string;
  completed_at: string;
  duration_ms: number;

  who: SubPhaseSummaryWho;
  what: SubPhaseSummaryWhat;
  why: SubPhaseSummaryWhy;
  how: SubPhaseSummaryHow;

  events: SubPhaseEventRange;
}

// ── Run summary (top-level) ─────────────────────────────────────────

/**
 * Run-level summary written at `run.completed` / `run.failed`. The
 * Markdown projection shape is deferred to P6 implementation
 * (design memo §12 open question 3).
 */
export interface RunSummary {
  schema_version: number;
  run_id: string;
  workspace: string;
  intent_brief: string | null;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  status: 'success' | 'partial' | 'failed' | 'in_progress';
  janumicode_version_sha: string;
  phases: Array<{
    phase_id: PhaseId;
    status: 'success' | 'partial' | 'failed' | 'skipped';
    sub_phase_count: number;
    duration_ms: number;
  }>;
  totals: {
    sub_phases: number;
    llm_invocations: number;
    retries: number;
    repairs: number;
    escalations: number;
    events: number;
  };
  events: SubPhaseEventRange;
}

// ── `aodd ls` row ───────────────────────────────────────────────────

export interface RunInfo {
  run_id: string;
  started_at: string;
  completed_at: string | null;
  status: 'success' | 'partial' | 'failed' | 'in_progress';
  duration_ms: number | null;
  has_keep: boolean;
}
