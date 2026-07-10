/**
 * Governed Stream Record types and universal fields.
 * Based on JanumiCode Spec v2.3, Sections 5.1 and 6.
 */

// ── Universal Record Fields ──────────────────────────────────────────

export interface GovernedStreamRecord {
  /** Primary key (UUID) */
  id: string;
  /** Canonical record type identifier */
  record_type: RecordType;
  /** Version of JSON Schema this record was validated against */
  schema_version: string;
  /** The Workflow Run that produced this record */
  workflow_run_id: string;
  /** The Phase in which this record was produced */
  phase_id: string | null;
  /** The Sub-Phase in which this record was produced */
  sub_phase_id: string | null;
  /** The Agent Role that produced this record */
  produced_by_agent_role: AgentRole | null;
  /** Pointer to the Agent Invocation record that produced this record */
  produced_by_record_id: string | null;
  /** Timestamp of production (ISO 8601) */
  produced_at: string;
  /** When the underlying event occurred (may differ from produced_at) */
  effective_at: string | null;
  /** JanumiCode git SHA pinned at Workflow Run initiation */
  janumicode_version_sha: string;
  /** Authority level 1-7 per taxonomy */
  authority_level: AuthorityLevel;
  /** True if this record or any ancestor is System-Proposed Content not yet approved */
  derived_from_system_proposal: boolean;
  /** False if superseded by rollback within a run */
  is_current_version: boolean;
  /** Rollback supersession pointer */
  superseded_by_id: string | null;
  /** When this record was semantically superseded */
  superseded_at: string | null;
  /** Semantic supersession pointer */
  superseded_by_record_id: string | null;
  /** The Workflow Run that originally produced this record */
  source_workflow_run_id: string;
  /** Records from which this record was derived */
  derived_from_record_ids: string[];
  /** True if associated Reasoning Review found severity: high flaw */
  quarantined: boolean;
  /** True if tool result content was sanitized before storage */
  sanitized: boolean;
  /** List of fields that were sanitized */
  sanitized_fields: string[];
  /** Type-specific payload, validated against schema_version */
  content: Record<string, unknown>;
}

// ── Authority Levels (§3.1) ──────────────────────────────────────────

export enum AuthorityLevel {
  /** Agent-generated candidate space before human interaction */
  Exploratory = 1,
  /** Agent output not yet seen or validated by any human */
  AgentAsserted = 2,
  /** Human saw and did not reject */
  HumanAcknowledged = 3,
  /** Human actively modified agent-produced Mirror content */
  HumanEdited = 4,
  /** Explicit human approval */
  HumanApproved = 5,
  /** Subject of a Phase Gate — approved as complete */
  PhaseGateCertified = 6,
  /** Design Invariants from Section 1.5 */
  Constitutional = 7,
}

// ── Agent Roles (§3) ────────────────────────────────────────────────

export type AgentRole =
  | 'domain_interpreter'
  | 'requirements_agent'
  | 'systems_agent'
  | 'architecture_agent'
  | 'technical_spec_agent'
  | 'implementation_planner'
  | 'executor_agent'
  | 'test_design_agent'
  | 'eval_design_agent'
  | 'eval_execution_agent'
  | 'consistency_checker'
  | 'deep_memory_research'
  | 'unsticking_agent'
  | 'client_liaison'
  | 'human_author'
  | 'orchestrator'
  | 'loop_detection_monitor'
  | 'reasoning_review'
  | 'json_repair'
  | 'narrative_memory_generator'
  // Reasoning-review harness (Track D — replaces the single-pass
  // reasoning_review hook once Commit 10 lands the cutover; for now
  // both roles co-exist).
  | 'harness'
  // Ingestion Pipeline Stage III — LLM relationship extraction
  // (spec §8.12). Stamped on agent_invocation records emitted when
  // Stage III fires per ingested governed-stream record.
  | 'ingestion_pipeline_stage3'
  // Interactive-executor session responder — the LLM playing the HUMAN
  // side of a Phase-9 TUI session (answers the coding agent's clarifying
  // questions from the task spec, composes continuation nudges). Stamped
  // on the agent_invocation/agent_output records its calls produce.
  | 'session_responder';

// ── Phase IDs (§4) ──────────────────────────────────────────────────

export type PhaseId =
  | '0'    // Workspace Initialization
  | '0.5'  // Cross-Run Impact Analysis (conditional)
  | '1'    // Intent Capture and Convergence
  | '2'    // Requirements Definition
  | '3'    // System Specification
  | '4'    // Architecture Definition
  | '5'    // Technical Specification
  | '6'    // Implementation Planning
  | '7'    // Test Planning
  | '8'    // Evaluation Planning
  | '9'    // Execution
  | '10';  // Commit and Deployment Initiation

export const PHASE_ORDER: PhaseId[] = [
  '0', '0.5', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
];

export const PHASE_NAMES: Record<PhaseId, string> = {
  '0': 'Workspace Initialization',
  '0.5': 'Cross-Run Impact Analysis',
  '1': 'Intent Capture and Convergence',
  '2': 'Requirements Definition',
  '3': 'System Specification',
  '4': 'Architecture Definition',
  '5': 'Technical Specification',
  '6': 'Implementation Planning',
  '7': 'Test Planning',
  '8': 'Evaluation Planning',
  '9': 'Execution',
  '10': 'Commit and Deployment Initiation',
};

// ── Sub-phase identity is now manifest-backed (slug IDs) ────────────
//
// SUB_PHASE_NAMES + SUB_PHASE_ORDER below are derived from the canonical
// phase manifest (`src/lib/orchestrator/phaseManifest.ts`). The keys of
// SUB_PHASE_NAMES[phaseId] are slug-based sub-phase IDs (e.g.
// `'workspace_classification'`, `'fr_saturation'`) — NOT the legacy
// numeric IDs (`'0.1'`, `'2.1a'`). Callers that previously hardcoded
// numeric IDs must migrate to slugs.
//
// Lens-conditional sub-phase topology is no longer encoded here. With
// slug IDs, each step has a unique slug and a single canonical name —
// the prior lens-keyed overrides existed to disambiguate distinct steps
// that shared a numeric prefix, which slugs eliminate by construction.

import {
  PHASES as MANIFEST_PHASES,
  subPhasesOf,
} from '../orchestrator/phaseManifest';

/**
 * Sub-phase names per phase. Key: phase displayCode (numeric string).
 * Value: Record<subPhaseSlug, displayName>.
 */
export const SUB_PHASE_NAMES: Record<PhaseId, Record<string, string>> = (() => {
  const result = {} as Record<PhaseId, Record<string, string>>;
  for (const phase of MANIFEST_PHASES) {
    const code = phase.displayCode as PhaseId;
    const names: Record<string, string> = {};
    for (const sp of subPhasesOf(phase.id)) {
      names[sp.id] = sp.displayName;
    }
    result[code] = names;
  }
  return result;
})();

/**
 * Sub-phase order per phase for timeline rendering. Slug IDs in
 * execution order.
 */
export const SUB_PHASE_ORDER: Record<PhaseId, string[]> = (() => {
  const result = {} as Record<PhaseId, string[]>;
  for (const phase of MANIFEST_PHASES) {
    const code = phase.displayCode as PhaseId;
    result[code] = subPhasesOf(phase.id).map((sp) => sp.id);
  }
  return result;
})();

/**
 * @deprecated Lens-conditional name overrides are no longer used —
 * slugs disambiguate every step by construction. Kept as an empty
 * object for callers that still reference it; will be removed once
 * those callers migrate.
 */
export const SUB_PHASE_NAMES_BY_LENS: Partial<Record<PhaseId, Partial<Record<IntentLens, Record<string, string>>>>> = {};

/**
 * @deprecated Lens-conditional order overrides are no longer used.
 * Kept as an empty object for callers that still reference it.
 */
export const SUB_PHASE_ORDER_BY_LENS: Partial<Record<PhaseId, Partial<Record<IntentLens, string[]>>>> = {};

/**
 * Resolve the human-facing name for a sub-phase. The `lens` parameter
 * is ignored — kept for signature compatibility while callers migrate.
 */
export function getSubPhaseName(
  phaseId: PhaseId,
  subPhaseId: string,
  _lens?: IntentLens | null,
): string {
  return SUB_PHASE_NAMES[phaseId]?.[subPhaseId] ?? subPhaseId;
}

/**
 * Resolve the ordered sub-phase list for a phase. The `lens` parameter
 * is ignored — kept for signature compatibility.
 */
export function getSubPhaseOrder(
  phaseId: PhaseId,
  _lens?: IntentLens | null,
): string[] {
  return SUB_PHASE_ORDER[phaseId] ?? [];
}

// ── Record Types (§6) ───────────────────────────────────────────────

export type RecordType =
  // Phase and Agent Records (§6.1)
  | 'raw_intent_received'
  | 'agent_invocation'
  | 'agent_output'
  | 'agent_output_chunk'
  | 'agent_reasoning_step'
  | 'agent_self_correction'
  | 'tool_call'
  | 'tool_result'
  | 'artifact_produced'
  | 'invariant_check_record'
  | 'invariant_violation_record'
  | 'reasoning_review_record'
  | 'reasoning_review_ensemble_record'
  // Reasoning-review harness (Track D, Commit 1 foundation):
  //   - `reasoning_review_harness_record`: parent per harness invocation
  //   - `reasoning_review_finding_record`: one per validator finding
  // See src/lib/review/harness/validatorRegistry.ts and the harness
  // design doc under docs/reasoning review prompt template redesign.
  | 'reasoning_review_harness_record'
  | 'reasoning_review_finding_record'
  | 'json_repair_record'
  | 'domain_compliance_review_record'
  | 'detail_file_generated'
  // Human Interaction Records (§6.2)
  | 'mirror_presented'
  | 'decision_bundle_presented'
  | 'decision_bundle_resolved'
  | 'decision_trace'
  | 'mirror_approved'
  | 'mirror_rejected'
  | 'mirror_edited'
  | 'mirror_acknowledged'
  | 'phase_gate_evaluation'
  | 'phase_gate_approved'
  | 'phase_gate_rejected'
  // Phase-9 executor escalation (attended runs): a coding agent's blocking
  // clarification the spec-grounded responder could not answer, surfaced to the
  // human in the governed-stream UI, and the human's free-text answer.
  | 'executor_question_presented'
  | 'executor_question_answered'
  | 'rollback_authorized'
  | 'complexity_flag_resolution'
  | 'cascade_threshold_decision'
  | 'technical_debt_record'
  | 'verification_ensemble_disagreement'
  | 'quarantine_override'
  // Memory Records (§6.3)
  | 'constitutional_invariant'
  | 'narrative_memory'
  | 'auto_mitigation_action'
  | 'decision_trace_summary'
  | 'retrieval_brief_record'
  | 'context_packet'
  | 'query_decomposition_record'
  | 'dmr_pipeline'
  | 'product_description_handoff'
  | 'requirement_decomposition_node'
  | 'assumption_set_snapshot'
  | 'requirement_decomposition_pipeline'
  | 'component_decomposition_node'
  | 'component_assumption_set_snapshot'
  | 'component_decomposition_pipeline'
  | 'task_decomposition_node'
  | 'task_assumption_set_snapshot'
  | 'task_decomposition_pipeline'
  | 'data_model_decomposition_node'
  | 'data_model_assumption_set_snapshot'
  | 'data_model_decomposition_pipeline'
  | 'test_decomposition_node'
  | 'test_assumption_set_snapshot'
  | 'test_decomposition_pipeline'
  // Implementation packet synthesis (Phase 8 → 9 boundary). One packet
  // per atomic Phase 6.1a task, bundling upstream context (user stories,
  // ACs, NFRs, component contract, data models, APIs, test cases, eval
  // criteria, constraints, compliance items). See
  // docs/design/implementation-packet-synthesis.md.
  | 'implementation_packet'
  | 'packet_synthesis_failure'
  // Cycle controller — written by cycle_controller sub-phase to record
  // each release-major iteration's outcome. Today only the
  // `frontier_empty` termination branch is implemented; later steps
  // wire delta-mode entry points for Phase 6/7/8 + the actual loop.
  | 'cycle_iteration'
  | 'execution_wave_started'
  | 'execution_wave_completed'
  | 'task_quarantine'
  | 'task_test_result'
  | 'wave_gate_decision'
  | 'memory_edge_proposed'
  | 'memory_edge_confirmed'
  | 'intent_quality_report'
  | 'cross_run_impact_report'
  | 'cross_run_modification'
  // Output of Phase 0.5.2 when the human chooses "Proceed" — lists the
  // Refactoring Tasks (idempotency fields per spec §8.8) that Phase 6
  // injects into the implementation plan to update prior-run artifacts.
  | 'refactoring_scope'
  | 'coverage_gap'
  // Client Liaison Records (§6.4)
  | 'open_query_received'
  | 'query_classification_record'
  | 'client_liaison_response'
  | 'consistency_challenge_escalation'
  // Human item feedback (Card sub-chat REFINE mode) — inert, anchored to the
  // item it critiques; picked up when the item's collection is next revised.
  | 'human_item_feedback'
  // A user request to regenerate ("generate more") a collection — the
  // governed, auditable record of the ask; the re-bloom either wakes an
  // open bloom gate or is applied at the next revision.
  | 'collection_regeneration_requested'
  // Unsticking Records (§6.5)
  | 'loop_detection_record'
  | 'unsticking_session_open'
  | 'unsticking_hypothesis'
  | 'unsticking_socratic_turn'
  | 'unsticking_specialist_task'
  | 'unsticking_specialist_response'
  | 'unsticking_tool_result_review'
  | 'unsticking_resolution'
  | 'unsticking_escalation'
  // System Records (§6.6)
  | 'schema_gap_record'
  | 'version_upgrade_card'
  | 'ingestion_pipeline_record'
  | 'file_system_write_record'
  | 'file_system_revert_record'
  | 'refactoring_hash_recomputed'
  | 'refactoring_skipped_idempotent'
  | 'cycle_detected_record'
  | 'warning_acknowledged'
  | 'warning_batch_acknowledged'
  | 'ingestion_pipeline_failure'
  | 'llm_api_failure'
  | 'llm_api_recovery'
  // Transformation trace layer (forensic lineage). Emitted alongside
  // existing agent_invocation/agent_output/artifact_produced records;
  // not a replacement. See src/lib/trace/ and docs/design/transformation-trace.md.
  | 'transformation_step'
  // Scope gatekeeper — LLM-backed auto-prune of expansive bloom outputs.
  // Emitted after every bloom round that has applyPrune callbacks; carries
  // the kept ids, dropped ids + per-id rationales. Designed for the
  // debug-iterate loop where thin-slice / auto-approve paths need scope
  // discipline that the human-in-the-loop normally enforces.
  | 'scope_prune_decision';

// ── Decision Trace Types (§6.2) ─────────────────────────────────────

export type DecisionType =
  | 'menu_selection'
  | 'mirror_approval'
  | 'mirror_rejection'
  | 'mirror_edit'
  | 'decision_bundle_resolution'
  | 'phase_gate_approval'
  | 'rollback_authorization'
  | 'unsticking_escalation_resolution'
  | 'prior_decision_override'
  | 'system_proposal_approval'
  | 'system_proposal_rejection'
  | 'domain_attestation'
  | 'cascade_threshold_decision'
  | 'complexity_flag_resolution'
  | 'verification_ensemble_override'
  | 'quarantine_override';

// ── Memory Edge Types (§8.14) ───────────────────────────────────────

export type MemoryEdgeType =
  | 'derives_from'
  | 'supersedes'
  | 'contradicts'
  | 'validates'
  | 'corrects'
  | 'raises'
  | 'answers'
  | 'implements'
  | 'tests';

export type MemoryEdgeStatus =
  | 'proposed'
  | 'confirmed'
  | 'system_asserted'
  | 'rejected'
  | 'superseded'
  | 'invalidated';

// -- Sub-Artifact Edge Types (Architecture Canvas) --

/**
 * Edge types for relationships between sub-artifacts (components, ADRs, etc.).
 * These edges are stored in sub_artifact_edge table, not memory_edge,
 * because their endpoints are semantic IDs (e.g., "COMP-001") not governed_stream IDs.
 */
export type SubArtifactEdgeType =
  | 'satisfies'    // Component -> Requirement
  | 'depends_on'   // Component -> Component
  | 'governs';     // ADR -> Component

// ── Workflow Run (§5) ───────────────────────────────────────────────

export interface WorkflowRun {
  id: string;
  workspace_id: string;
  janumicode_version_sha: string;
  initiated_at: string;
  completed_at: string | null;
  status: WorkflowRunStatus;
  current_phase_id: PhaseId | null;
  current_sub_phase_id: string | null;
  raw_intent_record_id: string | null;
  scope_classification_ref: string | null;
  compliance_context_ref: string | null;
  cross_run_impact_triggered: boolean;
  /**
   * Intent lens selected by Phase 1.0a classification. Null until the
   * classification step runs. Downstream phase handlers read this to
   * pick lens-variant prompt templates.
   */
  intent_lens: IntentLens | null;
  /**
   * Wave 6 decomposition telemetry. `decomposition_budget_calls_used`
   * holds the sum of FR + NFR calls for display; the per-kind slices
   * drive resume-state reconstruction so a completed FR loop doesn't
   * clobber NFR's baseline. Per-root-within-kind counters are
   * in-memory only (reset per saturation-loop invocation / resume
   * session — budget_cap is enforced per-root-per-session).
   */
  decomposition_budget_calls_used: number;
  decomposition_fr_calls_used: number;
  decomposition_nfr_calls_used: number;
  decomposition_max_depth_reached: number;
  /**
   * Governed-stream row id of the approved ReleasePlan record for this
   * run, or null until Phase 1.7 completes. Phase 2+ reads this to
   * assign `release_id` to decomposition-node writes; downstream
   * markdown/gold exporters group output by release ordinal.
   */
  active_release_plan_record_id: string | null;

  /**
   * Iterative-implementation-backlog cycle telemetry. Always non-null
   * once cycle_controller has run; null on workflows that haven't
   * reached Phase 9 yet.
   */
  current_release_ordinal?: number | null;
  current_cycle_number?: number;
  max_cycles_per_release?: number;

  /**
   * Implementation packet synthesis telemetry. Populated by the
   * packet_synthesis sub-phase. Zero on workflows that haven't reached
   * the Phase 8 → 9 boundary yet.
   */
  packet_count?: number;
  packet_coherence_blocking_count?: number;
  packet_coherence_advisory_count?: number;
}

export type WorkflowRunStatus =
  | 'initiated'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'rolled_back';

// ── Loop Status (§7.10) ─────────────────────────────────────────────

export type LoopStatus =
  | 'CONVERGING'
  | 'STALLED'
  | 'DIVERGING'
  | 'SCOPE_BLIND';

// ── Assumption Items (Wave 5b — Mirror card row shape) ──────────────

export type AssumptionSource =
  | 'document_specified'
  | 'user_specified'
  | 'domain_standard'
  | 'ai_proposed';

export type AssumptionStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'deferred'
  | 'edited';

export interface AssumptionItem {
  id: string;
  text: string;
  category: string;
  source: AssumptionSource;
  rationale?: string;
  status: AssumptionStatus;
  editedText?: string;
}

// ── Pre-Mortem Items (Wave 5b — risk card row shape) ────────────────

export type PreMortemSeverity = 'critical' | 'medium' | 'low';

export interface PreMortemItem {
  id: string;
  assumption: string;
  severity: PreMortemSeverity;
  failureScenario: string;
  mitigation?: string;
  status: 'pending' | 'accepted' | 'rejected';
  rationale?: string;
}

// ── Intent Lens (Part B of the lens+DMR plan) ───────────────────────
//
// Phase 1.0a classifies the raw intent into one of these lenses. Each
// lens can drive a different prompt template variant for downstream
// sub-phases (bloom, synthesis). First pass ships real templates only
// for `product` and `feature`; other lenses classify correctly but
// fall back to product templates with a logged warning. `unclassified`
// is the classifier's escape hatch when confidence is low.
export type IntentLens =
  | 'product'
  | 'feature'
  | 'bug'
  | 'infra'
  | 'legal'
  | 'unclassified';

export type ReasoningReviewSeverity = 'HIGH' | 'MEDIUM' | 'LOW';

export interface ReasoningReviewConcern {
  severity: ReasoningReviewSeverity;
  summary: string;
  detail: string;
  location: string;
  recommendation: string;
}

/**
 * Output of an automated reasoning review on a single agent_output.
 * Linked to the reviewed call via `derived_from_record_ids = [agent_output_id]`.
 *
 * Status semantics:
 *   - `success`     — review LLM call returned and parsed cleanly
 *   - `parse_error` — review LLM returned text but JSON couldn't be recovered
 *   - `failed`      — review LLM call failed after retries (soft-fail)
 *   - `skipped`     — preconditions not met (e.g. empty thinking + empty text)
 *
 * Advisory only: never blocks workflow progression. UI surfaces `concerns`
 * in a card alongside the originating agent_output.
 */
/**
 * Auto-mitigation action — audit record for a deterministic mutation
 * applied to an artifact in response to a HIGH validator finding under
 * `orchestrator.auto_mitigation_policy = 'auto'`.
 *
 * One record per mutation. Records the offending finding, the action
 * taken, the JSONPath into the artifact that was mutated, and snapshots
 * of the before/after values for audit + potential rollback.
 *
 * Authority Level 5 — the orchestrator's explicit policy commit is the
 * human-equivalent action that authorises the deterministic mitigation.
 */
export interface AutoMitigationActionContent {
  kind: 'auto_mitigation_action';
  /** Record id of the artifact this mitigation mutates. */
  source_artifact_id: string;
  /** Record id of the reasoning_review_finding_record that prompted the action. */
  finding_record_id: string;
  /** Validator that caught the issue. */
  validator_id: string;
  /** Finding type (validator-specific). */
  finding_type: string;
  /** What the mitigation did. */
  action_type: 'drop' | 'replace' | 'retry' | 'skip';
  /** Top-level field within the artifact where the mutation landed (e.g. "domains"). */
  target_field: string;
  /** Identifier of the element acted on (id or name). */
  target_identifier: string;
  /** Human-readable rationale, typically the finding's summary. */
  rationale: string;
  /** Snapshot of the element before the mutation (for audit / rollback). */
  before_value: unknown;
  /** Snapshot of the element after the mutation (null for `drop`). */
  after_value: unknown;
}

/**
 * Constitutional Invariant — Authority Level 7 governing rule from spec §1.5.
 * Seeded once per workspace at init. Carried into every Context Packet as
 * `active_constraints` regardless of run-local state. No agent decision,
 * Orchestrator decision, or human approval within a Workflow Run can
 * supersede these.
 */
export interface ConstitutionalInvariantContent {
  kind: 'constitutional_invariant';
  /** Stable identifier — e.g. `CI-1`, `CI-2`. */
  invariant_id: string;
  /** Full statement of the invariant from spec §1.5. */
  statement: string;
  /** Spec section this invariant comes from (always `1.5` today). */
  source_section: string;
}

export interface ReasoningReviewRecordContent {
  kind: 'reasoning_review';
  status: 'success' | 'parse_error' | 'failed' | 'skipped';
  reviewed_agent_output_id: string;
  reviewed_agent_role: string | null;
  reviewed_phase_id: string | null;
  reviewed_sub_phase_id: string | null;
  reviewer_provider: string | null;
  reviewer_model: string | null;
  has_concerns: boolean;
  concerns: ReasoningReviewConcern[];
  overall_assessment: string;
  duration_ms: number;
  retry_attempts: number;
  /** Populated on parse_error / failed; null on success / skipped. */
  error_message: string | null;
  /** When status='skipped', why we skipped (e.g. 'no_thinking_or_text', 'self_review'). */
  skip_reason?: string;
}

// ── Reasoning-review harness (Track D) ──────────────────────────────
//
// Parallel to ReasoningReviewRecordContent above, but aggregates
// per-validator findings under a single harness invocation. Replaces
// the single-pass reviewer once Commit 10 lands the cutover; both
// shapes co-exist during the migration.

export type ReviewHarnessDecision =
  | 'ACCEPT'
  | 'ACCEPT_WITH_NOTES'
  | 'REVISE'
  | 'QUARANTINE'
  | 'ESCALATE';

export type ReviewHarnessStatus = 'running' | 'completed' | 'failed';

export interface ReviewHarnessFindingsCountBySeverity {
  HIGH: number;
  MEDIUM: number;
  LOW: number;
}

export interface ReasoningReviewHarnessRecordContent {
  kind: 'reasoning_review_harness';
  /** UUID — primary linkage key shared with all child finding records. */
  harness_id: string;
  /** Status — running while validators dispatch, completed/failed at end. */
  status: ReviewHarnessStatus;
  reviewed_agent_invocation_id: string;
  reviewed_agent_output_id: string;
  reviewed_agent_role: string | null;
  reviewed_phase_id: string | null;
  reviewed_sub_phase_id: string | null;
  /** Canonical validator ids dispatched for this output. */
  dispatched_validator_ids: string[];
  /** Per-severity finding counts (filled at end of run). */
  findings_count_by_severity: ReviewHarnessFindingsCountBySeverity;
  /** Number of validators that errored / had no body / hit retries-exhausted. */
  validator_failure_count: number;
  /**
   * Filled by Commit 8's `final_synthesis` validator. Until then,
   * remains undefined / null.
   */
  decision_recommendation?: ReviewHarnessDecision | null;
  /** Short rationale string explaining why the decision was selected. */
  decision_rationale?: string | null;
  /**
   * Pass-through findings (synthesis-time collation) flagged as
   * upstream-prompt / contract-design defects. INFORMATIONAL ONLY —
   * locked decision §6.5: do NOT influence decision_recommendation.
   */
  contractDesignFindings?: ReviewHarnessContractDesignFinding[];
  /** LLM-narrative summary produced by the final_synthesis prompt (when LLM ran). */
  narrative_summary?: string | null;
  /** Aggregate token usage across all LLM validator calls (Commit 9). */
  total_input_tokens?: number;
  total_output_tokens?: number;
  /** Wall-clock duration in ms across all validators. */
  duration_ms: number;
}

export interface ReviewHarnessContractDesignFinding {
  validator_id: string;
  severity: ReasoningReviewSeverity;
  summary: string;
  location: string;
  detail: string;
  recommendation: string;
}

export interface ReasoningReviewFindingRecordContent {
  kind: 'reasoning_review_finding';
  harness_id: string;
  validator_id: string;
  severity: ReasoningReviewSeverity;
  /** Validator-specific finding type (see catalog §9). */
  finding_type: string;
  summary: string;
  /** Field path / quoted span / child id / acceptance-criterion id. */
  location: string;
  detail: string;
  recommendation: string;
  /** Per-validator wall-clock in ms. */
  duration_ms: number;
  /** Token tracking — populated by Commit 9. Null for deterministic. */
  input_tokens?: number | null;
  output_tokens?: number | null;
  /**
   * Machine-resolvable target — populated when the validator's output
   * contract requires it (currently spec_boundary_respect_bloom; expands
   * to other validators as auto-mitigation coverage grows). Consumed by
   * MitigationEngine handlers to locate the offending element.
   */
  target_field?: string;
  target_identifier?: string;
}

export interface IntentLensClassificationContent {
  kind: 'intent_lens_classification';
  lens: IntentLens;
  /** 0.0–1.0 model-reported confidence. */
  confidence: number;
  /** Short human-readable rationale citing the raw intent / attached files. */
  rationale: string;
  /** Lens actually used downstream (= `lens` unless it's `unclassified`, in which case = 'product'). */
  fallback_lens: IntentLens;
}

// ── DMR Pipeline container (Part A of the lens+DMR plan) ────────────
//
// DMR has 7 stages. Stages 1 and 7 are LLM-backed; Stages 2–6 are
// deterministic (FTS5 + vector harvest, materiality scoring,
// relationship expansion, supersession analysis, gap detection).
// Without a container record, the UI sees only Stage 1 and Stage 7
// cards and the pipeline looks like it jumps 1 → 7. The container
// record surfaces all 7 stages with timing + output summary so the
// whole pipeline is visible as a single card.
export type DmrStageNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type DmrStageKind = 'llm' | 'deterministic' | 'skipped';
export type DmrStageStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface DmrStageEntry {
  stage: DmrStageNumber;
  name: string;
  kind: DmrStageKind;
  status: DmrStageStatus;
  started_at: string | null;
  completed_at: string | null;
  output_summary?: string;
  /** Link to the detail record this stage emitted (e.g. query_decomposition_record id). */
  output_record_id?: string;
  error?: string;
}

export interface DmrPipelineContent {
  kind: 'dmr_pipeline';
  pipeline_id: string;
  requesting_agent_role: string;
  scope_tier: string;
  query: string;
  stages: DmrStageEntry[];
  completeness_status?: string;
  retrieval_brief_record_id?: string;
}

// ── Wave 6: Recursive Requirements Decomposition ──────────────────
//
// Phase 2.1 + 2.2 evolve from single-pass FR/NFR bloom into a recursive
// decomposition driven by an assumption-saturation termination criterion
// (see project memory project_wave6_recursive_decomposition.md).
//
// Three append-only record types collaborate:
//   - requirement_decomposition_pipeline: container card for a root FR
//   - requirement_decomposition_node: one per node in the tree (root +
//     descendants); never mutated post-creation
//   - assumption_set_snapshot: written once per pass; saturation
//     detected when delta_from_previous_pass === 0
//
// NFRs ship single-pass in Wave 6 against the frozen FR tree; recursive
// NFR decomposition is expected as a follow-up wave.

export type DecompositionNodeStatus =
  | 'pending'
  | 'decomposed'
  | 'atomic'
  | 'pruned'
  | 'deferred'
  /**
   * Wave 6 Step 4b — the orchestrator detected post-gate that this node
   * (previously accepted by the human as a Tier-B commitment) still has
   * commitment layers underneath. The original acceptance stands, but
   * the human is being shown a follow-up gate for the sub-commitments
   * with a context note explaining the situation.
   */
  | 'downgraded';

/**
 * Semantic tier label for a decomposition node (Wave 6). The tier is
 * assigned by the decomposer and drives the orchestrator's routing:
 *   - Tier A (functional sub-area) → keep recursing.
 *   - Tier B (scope commitment) → mirror-gate the human.
 *   - Tier C (implementation commitment) → keep recursing or freeze if atomic.
 *   - Tier D (leaf operation) → freeze after atomic-criteria check.
 * Depth in the tree is a SECONDARY signal; tier is the primary driver.
 */
export type DecompositionTier = 'A' | 'B' | 'C' | 'D';

export interface DecompositionAtomicCriteria {
  ac_testable: boolean;
  single_operation: boolean;
  regime_cited: boolean;
  assumptions_listed: boolean;
}

export interface DecompositionUserStory {
  id: string;
  role: string;
  action: string;
  outcome: string;
  acceptance_criteria: Array<{ id: string; description: string; measurable_condition: string }>;
  priority: 'critical' | 'high' | 'medium' | 'low';
  traces_to?: string[];
}

export interface RequirementDecompositionNodeContent {
  kind: 'requirement_decomposition_node';
  /**
   * Canonical logical identity for this decomposition node. Stable across
   * revisions (e.g. a Step 4b downgrade re-emit keeps the same node_id).
   * Minted at first write as a UUID — NOT the LLM's `story.id`, which is
   * unreliable (LLMs collide on "natural" names like `FR-ACCT-1.1` across
   * unrelated subtrees). Each subsequent governed_stream revision of the
   * same logical node shares this value; only `is_current_version=1`
   * rows participate in the live tree.
   */
  node_id: string;
  /**
   * Parent node's canonical logical UUID (or null at depth 0). Uses
   * node_id identity, not the LLM's `story.id`.
   */
  parent_node_id: string | null;
  /**
   * Short human-readable label — the LLM's emitted `story.id` with a
   * collision suffix (`#ab12`) applied when a sibling under the same
   * parent already uses the same bare label. Presentation-only: logs,
   * markdown exporter, webview headings, prompt interpolations. Never
   * used for joins, tree walks, or supersession identity.
   */
  display_key: string;
  root_fr_id: string;
  depth: number;
  pass_number: number;
  status: DecompositionNodeStatus;
  /**
   * Semantic tier assigned by the decomposer (Wave 6 Step 4a+). Absent on
   * depth-0 root nodes (roots are tier-agnostic "the whole epic"). Present
   * on every depth-1+ node. Drives orchestrator routing; see DecompositionTier.
   */
  tier?: DecompositionTier;
  /**
   * Wave 6 NFR extension — which kind of root this subtree descends from.
   * Absent / 'fr' for Functional Requirement trees (backward compatible);
   * 'nfr' for Non-Functional Requirement trees seeded from Phase 2.2.
   * Used by downstream projection (getFrozenFrLeaves vs future
   * getFrozenNfrLeaves) and by the webview to colour trees distinctly.
   */
  root_kind?: 'fr' | 'nfr';
  user_story: DecompositionUserStory;
  decomposition_rationale?: string;
  surfaced_assumption_ids: string[];
  atomic_criteria_satisfied?: DecompositionAtomicCriteria;
  pruning_reason?: string;
  /**
   * Release assignment — inherited from parent at write time. Null =
   * backlog (root didn't match any release's `traces_to_journeys`, or
   * no active ReleasePlan on this run). Preserved across supersessions:
   * downgrade / pruned / deferred / atomic revisions all carry the
   * prior revision's release_id forward unchanged. Human re-assignment
   * happens via a dedicated gate surface (subtree-level moves only).
   */
  release_id: string | null;
  /**
   * Cached release ordinal at the time this node was most recently
   * written. Denormalized for downstream sort-by-release without a
   * ReleasePlan join. Refreshed when a subtree is moved to a new
   * release at the human gate.
   */
  release_ordinal: number | null;
}

export type AssumptionCategory =
  | 'domain_regime'
  | 'constraint'
  | 'compliance'
  | 'scope'
  | 'open_question';

export type DecompositionAssumptionSource = 'handoff' | 'bloom' | 'decomposition' | 'human';

export interface AssumptionEntry {
  id: string;
  text: string;
  source: DecompositionAssumptionSource;
  surfaced_at_node?: string;
  surfaced_at_pass: number;
  category: AssumptionCategory;
  citations?: string[];
  /**
   * Wave 6 dedup (flag-but-don't-merge) — when an embedding-similarity
   * check finds this assumption's text too close to a prior canonical
   * assumption, we keep the row AND tag it with the canonical id. The
   * decomposer's raw output is preserved (no data loss); downstream
   * semantic_delta is computed by filtering to entries where this
   * field is absent. Null/undefined means "not flagged as duplicate."
   */
  duplicate_of?: string;
  /** Cosine similarity with the canonical entry; populated when duplicate_of is set. */
  duplicate_similarity?: number;
}

export interface AssumptionSetSnapshotContent {
  kind: 'assumption_set_snapshot';
  pass_number: number;
  root_fr_id: string;
  assumptions: AssumptionEntry[];
  /**
   * Raw count: how many entries the decomposer added this pass,
   * regardless of whether they were flagged as duplicates. Historical /
   * audit value — preserved even after dedup flagging.
   */
  delta_from_previous_pass: number;
  /**
   * Wave 6 dedup — the count of newly-added entries this pass that were
   * NOT flagged as duplicates of prior assumptions (via embedding
   * similarity against the existing set). This is the signal the
   * saturation terminator gates on: `semantic_delta === 0` means the
   * model surfaced no genuinely new ideas this pass. When absent (old
   * snapshots or dedup disabled), callers fall back to
   * `delta_from_previous_pass`.
   */
  semantic_delta?: number;
}

export type DecompositionPassStatus = 'pending' | 'running' | 'completed' | 'terminated';

export type DecompositionTerminationReason =
  | 'fixed_point'
  | 'depth_cap'
  | 'budget_cap'
  | 'human_pruned_all'
  /**
   * The saturation loop's pass-over-pass node-production ratio has been
   * growing (rather than peaking + declining) for enough consecutive
   * passes to conclude that the decomposer is diverging, not converging.
   * Surfaces as an early termination with the remaining queue marked
   * deferred — prevents the loop from burning budget on exponential
   * fanout. Most often caused by assumption dedup being silently
   * offline (see `dedup_offline` for that specific signal).
   */
  | 'diverging'
  /**
   * The assumption dedup embedding client has failed for enough
   * consecutive passes that `semantic_delta` is effectively equal to
   * raw `delta_from_previous_pass` — the saturation termination gate
   * cannot fire because dedup isn't contributing. Advisory — logged as
   * a WARN but does NOT early-terminate on its own (the loop still has
   * depth_cap / budget_cap / diverging as hard safety rails).
   */
  | 'dedup_offline';

export interface DecompositionPassEntry {
  pass_number: number;
  status: DecompositionPassStatus;
  started_at: string | null;
  completed_at: string | null;
  nodes_produced: number;
  assumption_delta: number;
  termination_reason?: DecompositionTerminationReason;
}

export interface RequirementDecompositionPipelineContent {
  kind: 'requirement_decomposition_pipeline';
  pipeline_id: string;
  root_fr_id: string;
  passes: DecompositionPassEntry[];
  final_leaf_count?: number;
  final_max_depth?: number;
  total_llm_calls?: number;
}

// ── Wave 7 — Recursive component decomposition (Phase 4.2a) ─────────
//
// Mirrors Wave 6's tier-based saturation loop, adapted for components.
// Tier rubric: A=Macro Subsystem (recurse), B=Bounded Domain (mirror-
// gated), C=Module (one more pass), D=Atomic Component (terminal).
// See docs/wave7_phase4_recursive_decomposition.md for the design.

export interface ComponentResponsibility {
  id: string;
  description: string;
}

export type ComponentDependencyKind = 'sync_call' | 'async_event' | 'data_read' | 'data_write';

export interface ComponentDependency {
  component_id: string;
  kind: ComponentDependencyKind;
}

export interface DecompositionComponent {
  id: string;
  name: string;
  responsibilities: ComponentResponsibility[];
  dependencies: ComponentDependency[];
  /** Software domain id this component belongs to (Phase 4.1 output). */
  domain_id?: string | null;
  /**
   * Technical-constraint IDs (TECH-*) from Phase 1.0c that anchor this
   * component's implementation choices. Inherited from parent at write
   * time; refined as the tree narrows (e.g. a frontend leaf carries
   * only TECH-SVELTEKIT-1, not the whole stack).
   */
  active_constraints?: string[];
  traces_to?: string[];
}

export interface ComponentDecompositionAtomicCriteria {
  responsibilities_verb_led: boolean;
  responsibilities_mutually_exclusive: boolean;
  responsibilities_collectively_exhaust: boolean;
  no_subcomponent_implied: boolean;
}

export interface ComponentDecompositionNodeContent {
  kind: 'component_decomposition_node';
  /**
   * Canonical logical identity for this decomposition node. Stable
   * across revisions (downgrade / pruned / deferred / atomic
   * supersessions all share this id). Distinct from the LLM's
   * `component.id` which can collide across siblings under different
   * parents.
   */
  node_id: string;
  /** Parent node's canonical logical UUID, or null at depth 0. */
  parent_node_id: string | null;
  /**
   * Short human-readable label — the LLM's emitted `component.id` with a
   * collision suffix when a sibling under the same parent already uses
   * the same bare label. Presentation-only.
   */
  display_key: string;
  /** The depth-0 root component this node descends from. */
  root_component_id: string;
  depth: number;
  pass_number: number;
  status: DecompositionNodeStatus;
  tier?: DecompositionTier;
  component: DecompositionComponent;
  decomposition_rationale?: string;
  surfaced_assumption_ids: string[];
  atomic_criteria_satisfied?: ComponentDecompositionAtomicCriteria;
  pruning_reason?: string;
  /** Inherited release assignment, mirrors Wave 6 release propagation. */
  release_id: string | null;
  release_ordinal: number | null;
}

export type ComponentAssumptionCategory =
  | 'boundary'
  | 'cross_cutting'
  | 'integration_pattern'
  | 'data_ownership'
  | 'scaling_assumption'
  | 'tech_choice'
  | 'open_question';

export type ComponentAssumptionSource = 'handoff' | 'domain' | 'decomposition' | 'human';

export interface ComponentAssumptionEntry {
  id: string;
  text: string;
  source: ComponentAssumptionSource;
  surfaced_at_node?: string;
  surfaced_at_pass: number;
  category: ComponentAssumptionCategory;
  citations?: string[];
  duplicate_of?: string;
  duplicate_similarity?: number;
}

export interface ComponentAssumptionSetSnapshotContent {
  kind: 'component_assumption_set_snapshot';
  pass_number: number;
  root_component_id: string;
  assumptions: ComponentAssumptionEntry[];
  delta_from_previous_pass: number;
  semantic_delta?: number;
}

export interface ComponentDecompositionPipelineContent {
  kind: 'component_decomposition_pipeline';
  pipeline_id: string;
  root_component_id: string;
  passes: DecompositionPassEntry[];
  final_leaf_count?: number;
  final_max_depth?: number;
  total_llm_calls?: number;
  tier_distribution?: { A?: number; B?: number; C?: number; D?: number };
}

// ── Wave 8 — Recursive task decomposition (Phase 6.1a) ──────────────
//
// Mirrors Wave 6 / Wave 7 tier-based saturation loop, adapted for
// implementation tasks. Tier rubric: A=Epic (multi-cluster body of work,
// recurse), B=Story (scope commitment, mirror-gate), C=Task (coherent
// unit, one more pass), D=Atomic-Unit (single executor session, terminal).
// See docs/wave8_phase6_recursive_task_decomposition.md for the design
// (and project_wave6_recursive_decomposition memory for the saturation
// machinery these all share).

export interface TaskCompletionCriterion {
  criterion_id: string;
  description: string;
  verification_method?: 'schema_check' | 'invariant' | 'output_comparison' | 'test_execution';
  artifact_ref?: string;
  /**
   * Leaf acceptance-criterion id(s) this completion criterion verifies. Phase 6
   * mints these (LLM-cited, then validated against the task's cited leaf-AC set
   * — non-members dropped). Lets packet synthesis bind each completion criterion
   * to the test cases covering those ACs, so the executor's authoritative
   * deliverable (the CC) is test-backed, not just the ACs. Empty/absent when the
   * criterion maps to no specific AC.
   */
  verifies_acceptance_criteria?: string[];
}

export interface DecompositionTask {
  id: string;
  name: string;
  description: string;
  task_type?: 'standard' | 'refactoring';
  /** Component (logical id or display key) this task belongs to. */
  component_id: string;
  component_responsibility: string;
  estimated_complexity?: 'low' | 'medium' | 'high';
  complexity_flag?: string;
  completion_criteria: TaskCompletionCriterion[];
  write_directory_paths?: string[];
  read_directory_paths?: string[];
  dependency_task_ids?: string[];
  /**
   * Technical-constraint IDs (TECH-*) inherited from the parent task /
   * parent component. Anchors backing-tool + tech choices for the
   * executor. A single-component leaf carries only the constraints that
   * apply to that component (e.g. SvelteKit-only for a frontend leaf).
   */
  active_constraints?: string[];
  /** References to upstream artifacts this task realises (component ids, responsibility ids, AC ids). */
  traces_to?: string[];
  /**
   * Refactoring-task idempotency fields (spec §8.8). Present only on
   * `task_type:'refactoring'` leaves injected from a Phase 0.5 refactoring_scope.
   * Carried through buildEffectiveTaskView → ExecutionScheduler so Phase 9.1's
   * executor runs the pre-state-hash idempotency protocol.
   */
  expected_pre_state_hash?: string;
  verification_step?: string;
  /** Self-contained refactoring directive (old/new definition + member diff +
   *  target files), pre-rendered by Phase 0.5 so the executor needs no DB
   *  access to dereference record ids. Carried through to Phase 9.1. */
  refactoring_instructions?: string;
}

export interface TaskDecompositionAtomicCriteria {
  single_executor_session: boolean;
  completion_criteria_verifiable: boolean;
  no_subtask_implied: boolean;
  scope_within_one_component: boolean;
}

export interface TaskDecompositionNodeContent {
  kind: 'task_decomposition_node';
  /** Canonical logical UUID. Stable across revisions. */
  node_id: string;
  /** Parent node's logical UUID (or null at depth 0). */
  parent_node_id: string | null;
  /**
   * Sibling-unique human label — LLM's task.id with `#nnnn` collision
   * suffix when needed. Presentation-only.
   */
  display_key: string;
  /** Depth-0 root task this node descends from (root's logical UUID). */
  root_task_id: string;
  depth: number;
  pass_number: number;
  status: DecompositionNodeStatus;
  tier?: DecompositionTier;
  task: DecompositionTask;
  decomposition_rationale?: string;
  surfaced_assumption_ids: string[];
  atomic_criteria_satisfied?: TaskDecompositionAtomicCriteria;
  pruning_reason?: string;
  release_id: string | null;
  release_ordinal: number | null;
}

export type TaskAssumptionCategory =
  | 'implementation_choice'
  | 'sequencing'
  | 'dependency'
  | 'tooling'
  | 'scope_boundary'
  | 'integration_seam'
  | 'open_question';

export type TaskAssumptionSource = 'component' | 'plan' | 'decomposition' | 'human';

export interface TaskAssumptionEntry {
  id: string;
  text: string;
  source: TaskAssumptionSource;
  surfaced_at_node?: string;
  surfaced_at_pass: number;
  category: TaskAssumptionCategory;
  citations?: string[];
  duplicate_of?: string;
  duplicate_similarity?: number;
}

export interface TaskAssumptionSetSnapshotContent {
  kind: 'task_assumption_set_snapshot';
  pass_number: number;
  root_task_id: string;
  assumptions: TaskAssumptionEntry[];
  delta_from_previous_pass: number;
  semantic_delta?: number;
}

export interface TaskDecompositionPipelineContent {
  kind: 'task_decomposition_pipeline';
  pipeline_id: string;
  root_task_id: string;
  passes: DecompositionPassEntry[];
  final_leaf_count?: number;
  final_max_depth?: number;
  total_llm_calls?: number;
  tier_distribution?: { A?: number; B?: number; C?: number; D?: number };
}

// ── Implementation Packet Synthesis (Phase 8 → 9 boundary) ─────────
//
// One packet per atomic Phase 6.1a task. The packet bundles COPIES (not
// references) of every upstream artifact relevant to executing the task:
// matched user stories with all ACs, NFRs, the component contract, data
// models, API definitions, test cases that verify the ACs, evaluation
// criteria that judge the user story, technical constraints, compliance
// items, and dependency-packet ids.
//
// Phase 9's executor consumes the packet — not the bare task — so it has
// the full context it needs to implement the task without inventing.
//
// See docs/design/implementation-packet-synthesis.md.

export interface PacketUserStoryAc {
  id: string;
  description: string;
  measurable_condition: string;
}

export interface PacketUserStory {
  id: string;
  role: string;
  action: string;
  outcome: string;
  priority: string;
  acceptance_criteria: PacketUserStoryAc[];
}

export interface PacketNfr {
  id: string;
  category: string;
  description: string;
  threshold?: string;
  measurement_method?: string;
  measurable_condition?: string;
}

export interface PacketComponentResponsibility {
  id: string;
  description: string;
  statement?: string;
}

export interface PacketComponentDependency {
  component_id: string;
  kind: string;
}

export interface PacketComponent {
  id: string;
  name: string;
  domain_id: string | null;
  responsibilities: PacketComponentResponsibility[];
  dependencies: PacketComponentDependency[];
  active_constraints: string[];
}

export interface PacketDataModelField {
  name: string;
  type: string;
  constraints?: string;
}

export interface PacketDataModel {
  id: string;
  name: string;
  component_id: string;
  fields: PacketDataModelField[];
  /** PD-7 (Phase 5-minted): the SR-/AC- ids this entity serves — lets the packet
   *  builder task-scope data models (and pull cross-component write targets)
   *  instead of binding every component entity. Absent on pre-linkage runs. */
  traces_to?: string[];
}

export interface PacketApiDefinition {
  id: string;
  method: string;
  path: string;
  description: string;
  request_shape?: unknown;
  response_shape?: unknown;
  error_codes?: string[];
  /** PD-7 (Phase 5-minted): the SR-/AC- ids this endpoint implements — lets the
   *  packet builder bind ONLY the endpoint(s) a task actually implements instead
   *  of every endpoint of the component. Absent on pre-linkage runs. */
  traces_to?: string[];
}

export interface PacketTestCase {
  test_case_id: string;
  type: string;
  acceptance_criterion_ids: string[];
  preconditions: string[];
  expected_outcome: string;
  /** Carried into the packet so the executor can author a PBT test for a 'property' case. */
  property_spec?: PropertySpec;
}

export interface PacketEvaluationCriterion {
  kind: 'functional' | 'quality' | 'reasoning';
  target_id: string;
  evaluation_method: string;
  success_condition: string;
  /** Present on a 'quality' criterion whose NFR threshold is a generative property. */
  property_spec?: PropertySpec;
}

export interface PacketActiveConstraint {
  id: string;
  category: string;
  text: string;
  technology?: string;
  rationale?: string;
}

export interface PacketComplianceItem {
  id: string;
  kind: 'compliance' | 'vv_requirement' | 'quality_attribute';
  description: string;
  measurable_condition?: string;
}

export interface PacketTask {
  id: string;
  node_id: string;
  name: string;
  description: string;
  task_type: string;
  estimated_complexity: 'low' | 'medium' | 'high' | (string & {});
  completion_criteria: Array<{
    criterion_id: string;
    description: string;
    verification_method: string;
    /** Leaf AC id(s) this criterion verifies (from Phase 6, validated). */
    verifies_acceptance_criteria?: string[];
    /** Packet test_case_id(s) that cover this criterion (via its ACs, or the
     *  task's full AC set when it cites none). Empty ⇒ no pre-written test;
     *  the executor must author one (advisory P8_CC_NO_TEST). */
    covered_by_test_ids?: string[];
  }>;
  write_directory_paths: string[];
  read_directory_paths: string[];
  dependency_task_ids: string[];
  /**
   * The atomic task's requirement footprint (the SR-/US-/NFR-/AC-/comp- ids it
   * traces to). Carried so the coherence verifier can distinguish a structurally-
   * storyless technical leaf (traces only to a component id / invented completion
   * criterion / nothing — no join can give it a user story) from a real feature
   * whose story-join genuinely failed (cites a real upstream AC/US that must
   * still resolve). Optional: absent ⇒ treated as no anchor.
   */
  traces_to?: string[];
}

export interface PacketCoherenceAnnotations {
  ai_proposed_root_count: number;
  ai_proposed_root_ids: string[];
}

export interface PacketCoherenceResult {
  passed: boolean;
  blocking_failures: string[];
  advisory_findings: string[];
  annotations: PacketCoherenceAnnotations;
}

export interface ImplementationPacketContent {
  kind: 'implementation_packet';
  schemaVersion: '1.0';
  packet_id: string;
  task: PacketTask;
  user_stories: PacketUserStory[];
  nfrs: PacketNfr[];
  component: PacketComponent;
  data_models: PacketDataModel[];
  api_definitions: PacketApiDefinition[];
  test_cases: PacketTestCase[];
  evaluation_criteria: PacketEvaluationCriterion[];
  active_constraints: PacketActiveConstraint[];
  compliance_items: PacketComplianceItem[];
  depends_on_packets: string[];
  coherence: PacketCoherenceResult;
  release_id: string | null;
  release_ordinal: number | null;
}

/**
 * Written when packet_synthesis encounters a blocking coherence failure.
 * Captures the failure surface so the cycle controller (auto mode) or
 * the operator mirror (interactive mode) can route appropriately.
 */
export interface PacketSynthesisFailureContent {
  kind: 'packet_synthesis_failure';
  schemaVersion: '1.0';
  /** Per-packet blocking failures: packet_id → list of failure codes. */
  failures_by_packet: Record<string, string[]>;
  /** Cross-packet blocking failures: code → list of details. */
  cross_packet_failures: Record<string, string[]>;
  /** Aggregate counts for harness/telemetry consumption. */
  total_packets: number;
  failed_packets: number;
  total_blocking_failures: number;
  total_advisory_findings: number;
  total_ai_proposed_root_count: number;
}

/**
 * Cycle iteration record — written by the cycle_controller sub-phase.
 * One record per release-major iteration (cycle 0 = initial, cycle 1+ =
 * delta cycles). Minimum-viable implementation always emits
 * `termination_reason: 'frontier_empty'`; the loop activation step
 * extends this with the actual decision tree (frontier_empty /
 * zero_progress / ceiling_hit / etc.).
 */
export interface CycleIterationContent {
  kind: 'cycle_iteration';
  schemaVersion: '1.0';
  release_id: string | null;
  release_ordinal: number | null;
  cycle_number: number;
  started_at: string;
  completed_at: string;
  termination_reason:
    | 'frontier_empty'
    | 'zero_progress'
    | 'ceiling_hit'
    | 'ceiling_hit_accepted'
    | 'phase_failure';
  atomic_leaves_produced: number;
  deferred_leaves_remaining: number;
}

// ── Wave 9 — Recursive data-model decomposition (Phase 5.1a) ──────
//
// Tier rubric is data-model-scoped:
//   A — Aggregate Root (owns its consistency boundary; recurse)
//   B — Entity (identity within an aggregate; mirror-gated)
//   C — Sub-entity / Value-type cluster (one more pass)
//   D — Atomic value type / relation (terminal)

export type DataModelEntityKind = 'aggregate' | 'entity' | 'value_type' | 'relation';

export interface DataModelField {
  name: string;
  type: string;
  constraints?: string;
  nullable?: boolean;
  is_identity?: boolean;
}

export type DataModelRelationshipKind =
  | 'one_to_one'
  | 'one_to_many'
  | 'many_to_one'
  | 'many_to_many'
  | 'owns'
  | 'references';

export interface DataModelRelationship {
  target_entity_id: string;
  kind: DataModelRelationshipKind;
  ownership?: 'owns' | 'references';
}

/**
 * Cross-CONTEXT role of an entity within its bounded context (DDD, P5.1b
 * entity_ownership_reconciliation). Orthogonal to `kind` (which is the structural
 * tier aggregate/entity/value_type/relation):
 *  - 'owned'              — this component is the source of truth; deep-decompose it.
 *  - 'referenced'         — another context owns the aggregate; this is a reference
 *                           stub (correlation id + this context's own local fields);
 *                           NEVER deep-decomposed. Carries owner_entity_id/owner_component_id.
 *  - 'shared_value_object'— an immutable value type copied BY VALUE into each context
 *                           (no single owner, no reference); not deep-decomposed.
 * Absent ⇒ treated as 'owned' (pre-reconciliation / no-regression default).
 */
export type EntityOwnershipRole = 'owned' | 'referenced' | 'shared_value_object';

export interface DecompositionEntity {
  id: string;
  name: string;
  kind?: DataModelEntityKind;
  component_id?: string | null;
  fields: DataModelField[];
  relationships?: DataModelRelationship[];
  active_constraints?: string[];
  traces_to?: string[];
  /** DDD cross-context role (P5.1b). Absent ⇒ 'owned'. */
  ownership_role?: EntityOwnershipRole;
  /** When ownership_role='referenced': the owning context's canonical entity id it points at. */
  owner_entity_id?: string;
  /** When ownership_role='referenced': the component that owns the aggregate. */
  owner_component_id?: string;
}

export interface DataModelAtomicCriteria {
  fields_typed: boolean;
  no_implicit_subentity: boolean;
  relationships_externalized: boolean;
  constraints_enumerated: boolean;
}

export interface DataModelDecompositionNodeContent {
  kind: 'data_model_decomposition_node';
  node_id: string;
  parent_node_id: string | null;
  display_key: string;
  root_entity_id: string;
  depth: number;
  pass_number: number;
  status: DecompositionNodeStatus;
  tier?: DecompositionTier;
  entity: DecompositionEntity;
  decomposition_rationale?: string;
  surfaced_assumption_ids: string[];
  atomic_criteria_satisfied?: DataModelAtomicCriteria;
  pruning_reason?: string;
  release_id: string | null;
  release_ordinal: number | null;
}

/** DDD ownership verdict for one cross-component concept (P5.1b reconciliation). */
export type EntityOwnershipVerdict = 'owned_aggregate' | 'shared_value_object' | 'separate';

export interface EntityOwnershipDecision {
  /** Structural concept key (slug of the entity name) the copies were grouped by. */
  concept_key: string;
  concept_name: string;
  verdict: EntityOwnershipVerdict;
  /** For 'owned_aggregate': the elected owning component + its canonical entity id. */
  owner_component_id?: string;
  owner_entity_id?: string;
  /** Every component that declared a copy of this concept. */
  member_component_ids: string[];
  /** How the verdict/owner was decided — auditable. */
  source: 'deterministic' | 'adjudicator' | 'fail_open';
  rationale?: string;
}

/** The P5.1b entity_ownership_reconciliation artifact: which context owns each
 *  cross-component concept, so saturation deep-decomposes owned aggregates ONCE
 *  and non-owners keep thin reference stubs / value-object copies. */
export interface EntityOwnershipMapContent {
  kind: 'entity_ownership_map';
  decisions: EntityOwnershipDecision[];
  /** Concepts left all-owned because ownership could not be resolved — surfaced, not guessed. */
  unresolved: string[];
}

export type DataModelAssumptionCategory =
  | 'identity'
  | 'ownership'
  | 'cardinality'
  | 'lifecycle'
  | 'consistency'
  | 'storage_choice'
  | 'open_question';

export type DataModelAssumptionSource = 'component' | 'domain' | 'decomposition' | 'human';

export interface DataModelAssumptionEntry {
  id: string;
  text: string;
  source: DataModelAssumptionSource;
  surfaced_at_node?: string;
  surfaced_at_pass: number;
  category: DataModelAssumptionCategory;
  citations?: string[];
  duplicate_of?: string;
  duplicate_similarity?: number;
}

export interface DataModelAssumptionSetSnapshotContent {
  kind: 'data_model_assumption_set_snapshot';
  pass_number: number;
  root_entity_id: string;
  assumptions: DataModelAssumptionEntry[];
  delta_from_previous_pass: number;
  semantic_delta?: number;
}

export interface DataModelDecompositionPipelineContent {
  kind: 'data_model_decomposition_pipeline';
  pipeline_id: string;
  root_entity_id: string;
  passes: DecompositionPassEntry[];
  final_leaf_count?: number;
  final_max_depth?: number;
  total_llm_calls?: number;
  tier_distribution?: { A?: number; B?: number; C?: number; D?: number };
}

// ── Wave 10 — Recursive test decomposition (Phase 7.1a) ───────────
//
// Full peer to Waves 6/7/8/9. Tier rubric is test-scoped:
//   A — Test Suite (a coherent body of test work; recurse)
//   B — Test Scenario (scope commitment about a behaviour; mirror-gated)
//   C — Test Case (one verifiable instance; one more pass)
//   D — Atomic Test Step (single executable assertion; terminal)

export type TestDecompositionTestType =
  | 'unit'
  | 'integration'
  | 'end_to_end'
  | 'performance'
  | 'contract'
  | 'property';

/**
 * Property-based test specification. Present only on a `test_type: 'property'`
 * leaf. Describes an invariant that must hold across a generated input domain —
 * the executor implements it with the stack's PBT library (fast-check,
 * Hypothesis, proptest, gopter). A property is an alternative FORM of an atomic
 * test, not a decomposable subtree; the existing 7.1a tiers provide any fan-out.
 */
export interface PropertySpec {
  /** The rule that must always hold, e.g. "resolve(shorten(u)) === u". */
  invariant: string;
  property_kind:
    | 'round_trip'
    | 'idempotence'
    | 'commutativity'
    | 'invariant'
    | 'conservation'
    | 'ordering'
    | 'oracle'
    | 'metamorphic';
  /** The space of inputs to generate over, e.g. "valid http/https URLs incl. query, fragment, percent-encoding". */
  input_domain: string;
  /** Optional named generators / arbitraries the executor should compose. */
  generators?: string[];
  /** The truth source the result is checked against (identity, a reference impl, a recomputation). */
  oracle?: string;
  /** For metamorphic properties: the relation between related inputs' outputs. */
  metamorphic_relation?: string;
}

export interface DecompositionTestStep {
  id: string;
  description: string;
  /** Phase of an executable test: arrange (setup), act (action), assert. */
  phase?: 'arrange' | 'act' | 'assert' | 'teardown';
  expected_outcome?: string;
}

export interface DecompositionTestCase {
  id: string;
  name: string;
  test_type: TestDecompositionTestType;
  /** Component(s) under test (logical IDs). */
  component_ids?: string[];
  /** Acceptance-criterion IDs this test validates. */
  acceptance_criterion_ids?: string[];
  preconditions?: string[];
  steps: DecompositionTestStep[];
  expected_outcome?: string;
  edge_cases?: string[];
  test_file_path?: string;
  active_constraints?: string[];
  traces_to?: string[];
  /** Present iff test_type === 'property'. The invariant + input domain the executor turns into a PBT test. */
  property_spec?: PropertySpec;
}

export interface TestDecompositionAtomicCriteria {
  steps_executable: boolean;
  assertions_verifiable: boolean;
  no_implicit_subscenario: boolean;
  scope_within_one_component: boolean;
}

export interface TestDecompositionNodeContent {
  kind: 'test_decomposition_node';
  node_id: string;
  parent_node_id: string | null;
  display_key: string;
  root_test_id: string;
  depth: number;
  pass_number: number;
  status: DecompositionNodeStatus;
  tier?: DecompositionTier;
  test_case: DecompositionTestCase;
  decomposition_rationale?: string;
  surfaced_assumption_ids: string[];
  atomic_criteria_satisfied?: TestDecompositionAtomicCriteria;
  pruning_reason?: string;
  release_id: string | null;
  release_ordinal: number | null;
}

export type TestAssumptionCategory =
  | 'preconditions'
  | 'fixture_setup'
  | 'oracle_choice'
  | 'tooling'
  | 'scope_boundary'
  | 'flake_risk'
  | 'open_question';

export type TestAssumptionSource = 'fr' | 'component' | 'decomposition' | 'human';

export interface TestAssumptionEntry {
  id: string;
  text: string;
  source: TestAssumptionSource;
  surfaced_at_node?: string;
  surfaced_at_pass: number;
  category: TestAssumptionCategory;
  citations?: string[];
  duplicate_of?: string;
  duplicate_similarity?: number;
}

export interface TestAssumptionSetSnapshotContent {
  kind: 'test_assumption_set_snapshot';
  pass_number: number;
  root_test_id: string;
  assumptions: TestAssumptionEntry[];
  delta_from_previous_pass: number;
  semantic_delta?: number;
}

export interface TestDecompositionPipelineContent {
  kind: 'test_decomposition_pipeline';
  pipeline_id: string;
  root_test_id: string;
  passes: DecompositionPassEntry[];
  final_leaf_count?: number;
  final_max_depth?: number;
  total_llm_calls?: number;
  tier_distribution?: { A?: number; B?: number; C?: number; D?: number };
}

// ── Wave R — Phase 9 release-plan execution ───────────────────────
//
// Replaces Phase 9's flat for-loop with a wave-based execution
// scheduler. One wave per release ordinal (with an optional final
// deferred-batch wave for quarantined leaves). See
// docs/waveR_phase9_release_execution.md.

export type ExecutionWaveKind = 'release' | 'deferred_batch' | 'single';

export interface ExecutionWaveStartedContent {
  kind: 'execution_wave_started';
  wave_number: number;
  release_id: string | null;
  release_ordinal: number | null;
  release_name?: string;
  wave_kind: ExecutionWaveKind;
  leaf_count: number;
  started_at: string;
  leaf_distribution_by_component?: Record<string, number>;
  leaf_ids?: string[];
}

export interface ExecutionWaveCompletedContent {
  kind: 'execution_wave_completed';
  wave_number: number;
  release_id: string | null;
  release_ordinal: number | null;
  release_name?: string;
  wave_kind: ExecutionWaveKind;
  leaf_count: number;
  successful_count: number;
  quarantined_count: number;
  rescued_count?: number;
  skipped_count?: number;
  started_at?: string;
  completed_at: string;
  duration_ms?: number;
  files_written_count?: number;
  files_modified_count?: number;
  files_deleted_count?: number;
  test_summary?: {
    total_passed: number;
    total_failed: number;
    total_skipped: number;
    leaves_with_failing_tests: number;
  };
  reasoning_review_summary?: Record<string, number>;
  successful_leaf_ids?: string[];
  quarantined_leaf_ids?: string[];
}

export type QuarantineAttemptOutcome =
  | 'execution_failed'
  | 'reasoning_review_failed'
  | 'tests_failed'
  | 'passed';

export interface QuarantineAttemptEntry {
  attempt_number: number;
  invocation_id: string;
  outcome: QuarantineAttemptOutcome;
  reasoning_review_flaws?: Array<{ flaw_type: string; severity: string; description?: string }>;
  test_failures?: string[];
  files_written_count?: number;
  error_message?: string;
}

export type QuarantineRescueStatus = 'pending' | 'rescued' | 'terminally_deferred';

export interface TaskQuarantineContent {
  kind: 'task_quarantine';
  leaf_task_id: string;
  leaf_node_id?: string | null;
  wave_number: number;
  release_id: string | null;
  release_ordinal: number | null;
  attempts: QuarantineAttemptEntry[];
  quarantine_reason: string;
  rescue_status: QuarantineRescueStatus;
  quarantined_at: string;
}

export interface TaskTestResultContent {
  kind: 'task_test_result';
  leaf_task_id: string;
  attempt_number: number;
  wave_number: number;
  test_command?: string;
  passed_count: number;
  failed_count: number;
  skipped_count: number;
  exit_code: number | null;
  duration_ms: number;
  stdout_excerpt?: string;
  stderr_excerpt?: string;
  executed_at: string;
  skipped_reason?: string;
}

export type WaveGateDecisionKind =
  | 'approved'
  | 'rejected'
  | 'investigated_then_approved'
  | 'auto_approved';

export interface WaveGateDecisionContent {
  kind: 'wave_gate_decision';
  wave_number: number;
  release_id: string | null;
  release_ordinal: number | null;
  wave_kind: ExecutionWaveKind;
  decision: WaveGateDecisionKind;
  reason?: string;
  rolled_back?: boolean;
  decided_at: string;
  decided_by: 'human' | 'auto';
}

// ── Product Description Handoff (Phase 1 product lens) ──────────────
//
// Produced at Sub-Phase 1.6 under the product lens. Consolidates the
// outputs of 1.0b Intent Discovery + the four bloom rounds (1.2–1.5)
// into a single authoritative record describing the product to be
// built. Shape mirrors v1's `IntakePlanDocument.finalizedPlan` so the
// v1 Hestami handoff can serve as an approximate gold reference for
// the virtuous-cycle test harness (shape/coverage oracle, §10.2 of
// the product-lens plan).
//
// Phases 2–9 continue reading the compatibility `intent_statement`
// record (also emitted at 1.6). Upgrading Phase 2+ to read this
// handoff directly is a tracked follow-up.

/**
 * Source of a proposed item — carried through from v1 so downstream
 * phases can tell user-stated items from AI-proposed ones.
 */
export type ProductItemSource =
  | 'user-specified'
  | 'document-specified'
  | 'ai-proposed'
  | 'domain-standard'
  | 'synthesized';

export interface Persona {
  id: string;
  name: string;
  description: string;
  goals: string[];
  painPoints: string[];
  source?: ProductItemSource;
}

export interface UserJourneyStep {
  stepNumber: number;
  actor: string;
  action: string;
  expectedOutcome: string;
  /**
   * True when this step's behavior is backed by a system workflow
   * (rather than a purely persona-facing UI interaction). Populated
   * by 1.3a and consumed by 1.3b + 1.3c:
   *   - 1.3b reads `automatable=true` steps as the seeds for
   *     workflow proposals with `journey_step` triggers.
   *   - 1.3c enforces the coverage rule "every automatable step is
   *     claimed by at least one workflow with a journey_step trigger
   *     pointing at (journey_id, step_number)".
   * Absent/undefined during migration from the legacy 1.3 single-shot
   * bloom; new 1.3a output always populates it.
   */
  automatable?: boolean;
}

export interface UserJourney {
  id: string;
  personaId: string;
  title: string;
  scenario: string;
  steps: UserJourneyStep[];
  acceptanceCriteria: string[];
  /** Phase tag from the phasingStrategy (e.g. "Phase 1"). */
  implementationPhase: string;
  priority?: string;
  source?: ProductItemSource;
}

export interface PhasingPhase {
  /** "Phase 1", "Phase 2", etc. */
  phase: string;
  description: string;
  /** References `UserJourney.id` entries. */
  journeyIds: string[];
  rationale: string;
}

// ── Release Plan (Phase 1.8, Wave 7 widened manifest) ──────────────
//
// Industry-standard term for "what ships together, in which order".
// Framework-neutral (distinct from SAFe's Release Train / PI), has a
// natural ordinal, and does not collide with JanumiCode's workflow
// phases. Proposed in Phase 1.8 after the intent statement is approved;
// gated by the human for reorder / rename / accept.
//
// Wave 7 widened shape: assigns every accepted handoff artifact to
// exactly one release's `contains[type]` OR to the top-level
// `cross_cutting` bucket for artifacts that legitimately span all
// releases (e.g. a retention policy, a continuous-audit workflow, a
// shared vocabulary term). With that shape, Phase 2 resolves an FR's
// release via a flat lookup across all trace types — no silent nulls
// when the trace points at a non-journey artifact.

export interface ReleaseContents {
  /** References `UserJourney.id` (UJ-*). */
  journeys: string[];
  /** References `WorkflowV2.id` (WF-*). */
  workflows: string[];
  /** References `Entity.id` (ENT-*). */
  entities: string[];
  /** References compliance item ids (COMP-*). */
  compliance: string[];
  /** References `Integration.id` (INT-*). */
  integrations: string[];
  /** References `VocabularyTerm.id` (VOC-*). */
  vocabulary: string[];
  /**
   * References V&V requirement ids (VV-*). Added so NFR roots that
   * trace exclusively to V&V items (most performance / availability /
   * reliability NFRs) can anchor to a release instead of unconditionally
   * landing in Backlog. ts-13 surfaced this gap.
   */
  vv_requirements: string[];
  /**
   * References quality-attribute ids (QA-*). Added for the same
   * NFR-anchoring reason as `vv_requirements` — many NFRs trace
   * to a single quality attribute and would otherwise drop to Backlog.
   */
  quality_attributes: string[];
  /**
   * References technical-constraint ids (TECH-*). Added so NFRs that
   * trace into hard constraints (encryption-at-rest, language choice,
   * deployment topology) can anchor.
   */
  technical_constraints: string[];
}

/**
 * Artifacts that span all releases by design (not release-specific).
 *
 * Journeys are intentionally absent: a user journey is a persona-facing
 * end-to-end flow and must belong to the release it first becomes
 * available in (even if later releases enrich it). Entities are also
 * absent: an entity that spans releases is still introduced in a
 * specific release (the earliest one that writes to it) and inherited
 * forward. Only workflows, compliance, integrations, and vocabulary
 * have legitimate cross-cutting semantics — a nightly integrity check
 * workflow runs across all releases' data; a retention regime applies
 * to everything; a shared integration is consumed by many releases; a
 * vocabulary term is canonical product-wide.
 */
export interface CrossCuttingContents {
  workflows: string[];
  compliance: string[];
  integrations: string[];
  vocabulary: string[];
  /**
   * V&V items, quality attributes, and technical constraints can legitimately
   * span every release (e.g. "P95 latency ≤ 100 ms" applies to every release;
   * "Postgres only" is enforced across the product). Cross-cutting variants
   * pair with the per-release slots above.
   */
  vv_requirements: string[];
  quality_attributes: string[];
  technical_constraints: string[];
}

export interface ReleaseV2 {
  /** Canonical logical UUID — stable across revisions of this Release entry. */
  release_id: string;
  /** 1-based contiguous ordinal; strict ordering within the plan. */
  ordinal: number;
  name: string;
  description: string;
  rationale: string;
  contains: ReleaseContents;
}

export interface ReleasePlanContentV2 {
  kind: 'release_plan';
  schemaVersion: '2.0';
  releases: ReleaseV2[];
  cross_cutting: CrossCuttingContents;
  approved: boolean;
  approval_note?: string;
}

/**
 * Emitted by deterministic coverage verifiers in Phase 1 (1.3c for
 * journey/workflow coverage, 1.8 verifier for release-manifest coverage)
 * when a structural assertion fails. Routes to an MMP card where the
 * human chooses between:
 *   - `accepted_as_scope_cut` — the gap is intentional; record it in
 *     the handoff as an explicit exclusion; continue to next sub-phase.
 *   - `rebloom_requested` — targeted re-run of the preceding sub-phase
 *     with the gap as human_feedback.
 *
 * `blocking` severity pauses phase progression until resolved;
 * `advisory` severity logs the gap but does not block (used for
 * trace-coherence warnings where a legitimate cross-release trace is
 * possible).
 */
export interface CoverageGapContent {
  kind: 'coverage_gap';
  schemaVersion: '1.0';
  /** Which sub-phase emitted the gap. */
  sub_phase_id: 'coverage_verifier' | 'release_plan' | 'fr_bloom_verifier' | 'nfr_bloom_verifier';
  /** One-line description of the structural rule that tripped. */
  assertion: string;
  severity: 'blocking' | 'advisory';
  /**
   * Short machine-tag classifying the check. Examples:
   *   'persona_coverage', 'domain_coverage',
   *   'automatable_step_backing', 'compliance_coverage',
   *   'integration_coverage', 'retention_coverage', 'vv_coverage',
   *   'referential_integrity',
   *   'release_exact_coverage', 'release_double_count',
   *   'release_ordinal_integrity', 'release_backward_dependency',
   *   'release_trace_coherence'.
   */
  check: string;
  /** Optional structured details the MMP card / re-bloom prompt may render. */
  details?: Record<string, unknown>;
  /** Artifact ids that should have been covered by the rule. */
  expected: string[];
  /** Artifact ids that were actually covered. */
  actual: string[];
  /** `expected ∖ actual` — ids the rule requires but did not find. */
  missing: string[];
  /** `actual ∖ expected` — only populated for exclusivity/double-count checks. */
  extra?: string[];
  resolution?: 'accepted_as_scope_cut' | 'rebloom_requested' | 'pending';
  resolution_note?: string;
  /** When the human routed this gap (ISO-8601). */
  resolved_at?: string;
}

export interface BusinessDomain {
  id: string;
  name: string;
  description: string;
  rationale: string;
  /** Short-preview of entities expected in this domain (for the bloom gate). */
  entityPreview: string[];
  /** Short-preview of workflows that live in this domain. */
  workflowPreview: string[];
  source?: ProductItemSource;
}

export interface Entity {
  id: string;
  /** References `BusinessDomain.id`. */
  businessDomainId: string;
  name: string;
  description: string;
  keyAttributes: string[];
  relationships: string[];
  source?: ProductItemSource;
}

// ── Phase 1.3 (Wave 7) — system workflow shapes ───────────────────
//
// 1.3 is split across three sub-phases:
//   1.3a — User Journey Bloom + Decomposition  (produces UserJourney[])
//   1.3b — System Workflow Bloom + Decomposition (produces WorkflowV2[])
//   1.3c — Coverage verifier (deterministic; emits CoverageGapContent)
//
// `WorkflowV2` replaces the legacy workflow shape by:
//   - structured `WorkflowStep[]` (same shape as `UserJourneyStep`)
//     so step actors/outcomes are addressable rather than embedded in
//     prose;
//   - typed discriminated union `WorkflowTrigger[]` so every workflow
//     is provably rooted in an upstream artifact (journey step,
//     schedule, event, compliance regime, or integration) rather than
//     floating free; and
//   - `backs_journeys[]` — a cached index of journeys the workflow
//     participates in (derivable from triggers but cached for fast
//     coverage checks in 1.3c and downstream phases).

export interface WorkflowStep {
  stepNumber: number;
  /** Persona id, "System", or integration id — mirrors UserJourneyStep.actor. */
  actor: string;
  action: string;
  expectedOutcome: string;
}

export type WorkflowTrigger =
  | {
      kind: 'journey_step';
      /** References `UserJourney.id`. */
      journey_id: string;
      /** 1-based step number into the referenced journey's `steps[]`. */
      step_number: number;
    }
  | {
      kind: 'schedule';
      /** Free-form cadence description (e.g. "daily at 02:00 UTC", "monthly on last weekday"). */
      cadence: string;
    }
  | {
      kind: 'event';
      /** Domain-event name (e.g. "invoice.posted", "claim.submitted"). */
      event_type: string;
    }
  | {
      kind: 'compliance';
      /** References a compliance item id (COMP-*). */
      regime_id: string;
      /** Specific rule within that regime the workflow enforces. */
      rule: string;
    }
  | {
      kind: 'integration';
      /** References `Integration.id`. */
      integration_id: string;
      /** Event on the integration that kicks this workflow off. */
      event: string;
    };

export interface WorkflowV2 {
  id: string;
  /** References `BusinessDomain.id`. */
  businessDomainId: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  triggers: WorkflowTrigger[];
  actors: string[];
  /**
   * Cached index of UserJourney.id values this workflow participates
   * in — the set of distinct `journey_id` values across all
   * `kind: 'journey_step'` entries in `triggers`. Empty for purely
   * schedule/event/compliance/integration-driven workflows.
   */
  backs_journeys?: string[];
  source?: ProductItemSource;
}

export type IntegrationOwnershipModel = 'delegated' | 'synced' | 'consumed' | 'owned';

export interface Integration {
  id: string;
  name: string;
  /** Coarse category — payment, erp, identity, maps, storage, ai, etc. */
  category: string;
  description: string;
  /** Example third-party providers that fit the integration slot. */
  standardProviders: string[];
  ownershipModel: IntegrationOwnershipModel;
  rationale: string;
  source?: ProductItemSource;
}

/**
 * Traceability spine — every item extracted from a source document in
 * Phase 1 carries a `source_ref` so downstream phases (Phase 2 reqs,
 * Phase 5 tech spec, Phase 8 eval design) can trace their derived
 * artifacts back to verbatim source material. Phase 8 uses the chain
 * `source_ref → extracted_item → requirement → component → test_result`
 * to detect drift mechanically rather than via free-form review.
 *
 * Offsets are byte-level into the ingested file content if the
 * extraction agent can compute them; they're optional because not all
 * source documents support precise offset addressing (diagrams, tables,
 * lists that normalise on ingestion). The `excerpt` field is the
 * canonical anchor — if offsets drift between ingestion and later
 * verification, the excerpt can still be located by substring search.
 */
export interface SourceRef {
  /** Workspace-relative path of the source document. */
  document_path: string;
  /** Heading of the containing section, if the doc is hierarchical. */
  section_heading?: string;
  /** Verbatim text span supporting the extracted item. */
  excerpt: string;
  /** Byte offset of the excerpt's start (inclusive), when available. */
  excerpt_start?: number;
  /** Byte offset of the excerpt's end (exclusive), when available. */
  excerpt_end?: number;
}

/**
 * Free-form extracted items (requirements / decisions / constraints /
 * open questions). Shape is flat by design so downstream consumers
 * don't need to normalise.
 */
export interface ExtractedItem {
  id: string;
  type: 'REQUIREMENT' | 'DECISION' | 'CONSTRAINT' | 'OPEN_QUESTION';
  text: string;
  /** Turn id in the originating dialogue, if any — preserved for audit. */
  extractedFromTurnId?: number;
  timestamp: string;
  /** Provenance into the source document for drift-detection chains. */
  source_ref?: SourceRef;
}

/**
 * Stated-not-invented technical decisions extracted from source docs
 * at Phase 1.0c Technical Constraints Discovery. Downstream phases
 * (esp. Phase 4 Architecture + Phase 5 Technical Specification) read
 * these as authoritative pre-approved constraints — they're not
 * proposals the LLM invented, they're transcriptions from the source.
 */
export interface TechnicalConstraint {
  id: string;                 // TECH-1, TECH-2, …
  /**
   * Stack slot the constraint applies to. Open-ended string so
   * source-unique categories (e.g. 'workflow_engine', 'dns') don't
   * need an allowlist update.
   */
  category: string;           // 'frontend' | 'backend' | 'database' | 'infrastructure' | 'security' | 'deployment' | 'cdn' | 'workflow_engine' | 'mobile' | …
  /** Full human-readable constraint as stated in the source. */
  text: string;
  /** Specific technology or vendor named in the source, when applicable. */
  technology?: string;
  version?: string;
  /** Why this was chosen — copied from the source if rationale is stated. */
  rationale?: string;
  source_ref?: SourceRef;
}

/**
 * Verification & Validation requirements extracted at Phase 1.0e.
 * Distinct from `qualityAttributes[]` strings in that each V&V item
 * has a measurable threshold + measurement method — the data a test
 * planner (Phase 7) or evaluation designer (Phase 8) needs to
 * mechanically verify drift.
 */
export interface VVRequirement {
  id: string;                 // VV-1, VV-2, …
  category: string;           // 'performance' | 'availability' | 'reliability' | 'security' | 'compliance' | 'accessibility' | 'observability' | …
  /** What the system must achieve (goal). */
  target: string;
  /** How we know if it's met (observable signal). */
  measurement: string;
  /** Pass criterion — the boundary between satisfied and violated. */
  threshold?: string;
  source_ref?: SourceRef;
}

/**
 * Canonical vocabulary extracted at Phase 1.0f. Terms defined in the
 * source doc — consumed by Phase 0.4 Vocabulary Collision Check to
 * protect against naming drift and by Phase 4 Architecture to keep
 * component names aligned with the stakeholder mental model.
 */
export interface VocabularyTerm {
  id: string;                 // VOC-1, VOC-2, …
  term: string;
  definition: string;
  /** Equivalent / near-equivalent terms from the same source. */
  synonyms: string[];
  source_ref?: SourceRef;
}

/**
 * Captured per decision_bundle_resolved on the prune gates — lets the
 * handoff carry a condensed record of what the human accepted / rejected
 * across the four bloom rounds without dragging every resolution record.
 */
export interface HumanDecisionSummary {
  action: 'accepted' | 'rejected' | 'edited' | 'deferred';
  /** Which round the decision happened in — e.g. "1.2", "1.3", "1.4", "1.5". */
  sub_phase_id: string;
  /** Id of the item the decision applied to (domain id, journey id, etc.). */
  target_id: string;
  rationale?: string;
}

/**
 * Items that remained unresolved at the end of Phase 1 — carried into
 * Phase 2 so requirements discovery can close them out.
 */
export interface OpenLoop {
  category: 'deferred_decision' | 'missing_info' | 'unresolved_risk' | 'followup';
  description: string;
  priority: 'high' | 'medium' | 'low';
}

export interface ProductDescriptionHandoffContent {
  kind: 'product_description_handoff';
  schemaVersion: '1.1';
  /** Always 'product_or_feature' under the product lens; preserved for v1 parity. */
  requestCategory: 'product_or_feature';

  // Narrative layer (from 1.0b Product Intent Discovery, refined through synthesis)
  productVision: string;
  productDescription: string;
  summary: string;

  // Product structure (from the four bloom rounds)
  personas: Persona[];
  userJourneys: UserJourney[];
  phasingStrategy: PhasingPhase[];
  successMetrics: string[];
  businessDomainProposals: BusinessDomain[];
  entityProposals: Entity[];
  workflowProposals: WorkflowV2[];
  integrationProposals: Integration[];
  qualityAttributes: string[];
  uxRequirements: string[];

  // Extracted items — product-level (from 1.0b Product Intent Discovery)
  requirements: ExtractedItem[];
  decisions: ExtractedItem[];
  constraints: ExtractedItem[];
  openQuestions: ExtractedItem[];

  // Decomposed Phase 1.0 extraction passes (iter-4). Each field is the
  // frozen output of a focused extraction sub-phase; every item carries
  // `source_ref` provenance for drift-detection chains. Empty arrays are
  // meaningful — they mean "this category was scanned and nothing was
  // extractable", not "the category was skipped".
  /** Phase 1.0c — stated-not-invented technical stack / infra / security decisions. */
  technicalConstraints: TechnicalConstraint[];
  /** Phase 1.0d — compliance regimes + retention obligations (beyond Phase 1.1b's context hint). */
  complianceExtractedItems: ExtractedItem[];
  /** Phase 1.0e — Verification & Validation requirements with measurable thresholds. */
  vvRequirements: VVRequirement[];
  /** Phase 1.0f — canonical vocabulary terms defined in the source docs. */
  canonicalVocabulary: VocabularyTerm[];

  // Cross-cutting — condensed human decisions + unresolved loops
  humanDecisions: HumanDecisionSummary[];
  openLoops: OpenLoop[];
}

// ── Transformation Trace Layer ──────────────────────────────────────
//
// A single hop in the data pipeline. Emitted at known seams (LLM call
// entry/exit, prompt materialization, JSON parse/repair, normalizer
// wrap, context assembly, persist) so that for any field on any
// artifact, we can walk backward through the chain of transformations
// that produced (or failed to produce) it. Steps form a tree via
// parent_step_id; lateral lineage is reconstructed via input_record_ids
// → output_record_id pointers across separate steps.
//
// Step metadata lives in governed_stream. Full payloads (prompts, raw
// responses, parsed JSON, normalizer input/output) are written to disk
// at `.janumicode/runs/<run_id>/transforms/<sub_phase>/<step_id>.json`
// to keep the DB lean. The `payload_path` field points at the file.

export type TransformationStepType =
  /** Context assembler selected upstream records + fields. */
  | 'context_assembled'
  /** Prompt template substitution completed (per-variable provenance). */
  | 'template_rendered'
  /** Prompt template rendered with variable substitutions. */
  | 'prompt_materialized'
  /** LLM HTTP call dispatched (provider/model/sizes). */
  | 'llm_invoked'
  /** LLM HTTP call returned (raw response captured). */
  | 'llm_returned'
  /** JSON parse succeeded (parsed object captured). */
  | 'json_parsed'
  /** JSON parse failed and was repaired via repair LLM. */
  | 'json_repaired'
  /** A normalizer ran: input → output with field_diff. */
  | 'normalized'
  /** A governed_stream record was written. */
  | 'persisted'
  /** A previously persisted record was read by a downstream step (forward link). */
  | 'consumed'
  /** CLI agent (Goose, Claude Code) invoked. */
  | 'cli_invoked'
  /** CLI agent returned. */
  | 'cli_returned';

export interface TransformationFieldDiff {
  /** Top-level keys present in output but not in input. */
  added?: string[];
  /** Top-level keys present in input but not in output (silent drops live here). */
  removed?: string[];
  /** Heuristic: a key disappeared from input and a similarly-shaped key appeared in output. */
  renamed?: Array<{ from: string; to: string }>;
  /** Top-level keys whose JSON-type changed across the transformation. */
  type_changed?: string[];
  /** Top-level array fields whose length changed (incl. became empty). */
  size_changed?: Array<{ field: string; from: number; to: number }>;
}

export interface TransformationStepContent {
  kind: 'transformation_step';
  schemaVersion: '1.0';
  /** UUID — stable identifier for this step. */
  step_id: string;
  /** Parent step in the same trace chain (null for the root of a chain). */
  parent_step_id: string | null;
  step_type: TransformationStepType;
  /**
   * Workflow correlation. sub_phase_id is required because the trace
   * layer's primary use is "what went wrong in this sub-phase".
   */
  sub_phase_id: string;
  agent_role?: AgentRole | null;
  /** Upstream governed_stream record ids this step read from. */
  input_record_ids: string[];
  /** Downstream governed_stream record id this step wrote (when applicable). */
  output_record_id?: string;
  /**
   * Workspace-relative path to a JSON file containing the full payload
   * for this step (materialized prompt, raw response, parsed JSON, etc).
   * Off-DB to keep the governed_stream lean. May be null for very small
   * steps where the metadata alone is informative.
   */
  payload_path?: string;
  /** Set on normalized / json_parsed / llm_returned where applicable. */
  field_diff?: TransformationFieldDiff;
  duration_ms?: number;
  error?: { message: string; stack?: string };
  /** Step-type-specific extras. Free-form by intent — keep small. */
  metadata?: Record<string, unknown>;
}

// ── Scope Gatekeeper (LLM-backed prune) ─────────────────────────────

export interface ScopePruneDropEntry {
  /** ID of the dropped item (e.g., 'DOM-RATE-LIMIT'). */
  id: string;
  /** Human-readable name/label at time of drop (e.g., 'Rate Limiting'). */
  label?: string;
  /** Why the gatekeeper dropped it (verbatim from the LLM's response). */
  reason: string;
}

export interface ScopePruneDecisionContent {
  kind: 'scope_prune_decision';
  schemaVersion: '1.0';
  /** Sub-phase that produced the bloom we just pruned. */
  sub_phase_id: string;
  /** record_id of the original (now superseded) bloom artifact. */
  original_artifact_id: string;
  /** record_id of the new (pruned) bloom artifact that supersedes it. */
  pruned_artifact_id: string;
  /** IDs the gatekeeper kept. */
  kept_ids: string[];
  /** IDs the gatekeeper dropped, each with a rationale. */
  dropped: ScopePruneDropEntry[];
  /**
   * One-paragraph overall justification from the gatekeeper LLM —
   * useful for humans skimming the audit report.
   */
  rationale_summary: string;
  /** LLM provider/model used for the gatekeeper call. */
  gatekeeper_provider: string;
  gatekeeper_model: string;
  /** Wall-clock for the gatekeeper LLM call. */
  duration_ms?: number;
}
