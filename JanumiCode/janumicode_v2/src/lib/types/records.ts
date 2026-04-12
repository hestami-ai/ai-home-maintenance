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
  | 'orchestrator'
  | 'loop_detection_monitor'
  | 'reasoning_review'
  | 'narrative_memory_generator';

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

// ── Record Types (§6) ───────────────────────────────────────────────

export type RecordType =
  // Phase and Agent Records (§6.1)
  | 'raw_intent_received'
  | 'agent_invocation'
  | 'agent_output'
  | 'agent_reasoning_step'
  | 'agent_self_correction'
  | 'tool_call'
  | 'tool_result'
  | 'artifact_produced'
  | 'invariant_check_record'
  | 'invariant_violation_record'
  | 'reasoning_review_record'
  | 'reasoning_review_ensemble_record'
  | 'domain_compliance_review_record'
  | 'detail_file_generated'
  // Human Interaction Records (§6.2)
  | 'mirror_presented'
  | 'menu_presented'
  | 'decision_bundle_presented'
  | 'decision_trace'
  | 'mirror_approved'
  | 'mirror_rejected'
  | 'mirror_edited'
  | 'phase_gate_evaluation'
  | 'phase_gate_approved'
  | 'phase_gate_rejected'
  | 'rollback_authorized'
  | 'complexity_flag_resolution'
  | 'cascade_threshold_decision'
  | 'technical_debt_record'
  | 'verification_ensemble_disagreement'
  | 'quarantine_override'
  // Memory Records (§6.3)
  | 'narrative_memory'
  | 'decision_trace_summary'
  | 'retrieval_brief_record'
  | 'context_packet'
  | 'memory_edge_proposed'
  | 'memory_edge_confirmed'
  | 'intent_quality_report'
  | 'cross_run_impact_report'
  | 'cross_run_modification'
  // Client Liaison Records (§6.4)
  | 'open_query_received'
  | 'query_classification_record'
  | 'client_liaison_response'
  | 'consistency_challenge_escalation'
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
  | 'llm_api_recovery';

// ── Decision Trace Types (§6.2) ─────────────────────────────────────

export type DecisionType =
  | 'menu_selection'
  | 'mirror_approval'
  | 'mirror_rejection'
  | 'mirror_edit'
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
}

export type WorkflowRunStatus =
  | 'initiated'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'rolled_back';

// ── Reasoning Flaw Types (§8.1) ─────────────────────────────────────

export type ReasoningFlawType =
  | 'unsupported_assumption'
  | 'invalid_inference'
  | 'circular_logic'
  | 'scope_violation'
  | 'premature_convergence'
  | 'false_equivalence'
  | 'authority_confusion'
  | 'completeness_shortcut'
  | 'contradiction_with_prior_approved'
  | 'unacknowledged_uncertainty'
  | 'implementability_violation'
  | 'implementation_divergence'
  | 'tool_result_misinterpretation_suspected';

// ── Loop Status (§7.10) ─────────────────────────────────────────────

export type LoopStatus =
  | 'CONVERGING'
  | 'STALLED'
  | 'DIVERGING'
  | 'SCOPE_BLIND';
