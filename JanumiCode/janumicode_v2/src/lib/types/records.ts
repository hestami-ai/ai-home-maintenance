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

/**
 * Sub-phase names per phase.
 * Key: phaseId, Value: Record<subPhaseId, subPhaseName>
 */
export const SUB_PHASE_NAMES: Record<PhaseId, Record<string, string>> = {
  '0': {
    '0.1': 'Workspace Classification',
    '0.2': 'Artifact Ingestion',
    '0.2b': 'Brownfield Continuity Check',
    '0.4': 'Vocabulary Collision Check',
  },
  '0.5': {
    '0.5.1': 'Impact Enumeration',
    '0.5.2': 'Refactoring Decision',
  },
  '1': {
    '1.0': 'Intent Quality Check',
    '1.1b': 'Scope Bounding',
    '1.2': 'Intent Domain Bloom',
    '1.3': 'Intent Candidate Review & Menu',
    '1.4': 'Assumption Surfacing & Adjudication',
    '1.5': 'Intent Statement Synthesis',
    '1.6': 'Intent Statement Approval',
  },
  '2': {
    '2.1': 'Functional Requirements Bloom',
    '2.2': 'Non-Functional Requirements Bloom',
    '2.3': 'Requirements Mirror and Menu',
  },
  '3': {
    '3.1': 'System Boundary Definition',
    '3.2': 'System Requirements Derivation',
    '3.3': 'Interface Contract Specification',
  },
  '4': {
    '4.1': 'Software Domain Identification',
    '4.2': 'Component Decomposition',
    '4.3': 'Architectural Decision Capture',
  },
  '5': {
    '5.1': 'Data Model Specification',
    '5.2': 'API Definition',
    '5.3': 'Error Handling Strategy Specification',
  },
  '6': {
    '6.1': 'Implementation Task Decomposition',
    '6.2': 'Implementation Plan Mirror and Menu',
    '6.3': 'Approval',
  },
  '7': {
    '7.1': 'Test Case Generation',
    '7.2': 'Test Coverage Analysis',
    '7.3': 'Test Plan Mirror and Menu',
  },
  '8': {
    '8.1': 'Functional Evaluation Design',
    '8.2': 'Quality Evaluation Design',
    '8.3': 'Reasoning Evaluation Design',
  },
  '9': {
    '9.1': 'Implementation Task Execution',
    '9.2': 'Test Execution',
    '9.3': 'Evaluation Execution',
  },
  '10': {
    '10.1': 'Pre-Commit Consistency Check',
    '10.2': 'Commit Preparation',
    '10.3': 'Workflow Run Closure',
  },
};

/**
 * Sub-phase order per phase for timeline rendering.
 */
export const SUB_PHASE_ORDER: Record<PhaseId, string[]> = {
  '0': ['0.1', '0.2', '0.2b', '0.4'],
  '0.5': ['0.5.1', '0.5.2'],
  '1': ['1.0', '1.1b', '1.2', '1.3', '1.4', '1.5', '1.6'],
  '2': ['2.1', '2.2', '2.3'],
  '3': ['3.1', '3.2', '3.3'],
  '4': ['4.1', '4.2', '4.3'],
  '5': ['5.1', '5.2', '5.3'],
  '6': ['6.1', '6.2', '6.3'],
  '7': ['7.1', '7.2', '7.3'],
  '8': ['8.1', '8.2', '8.3'],
  '9': ['9.1', '9.2', '9.3'],
  '10': ['10.1', '10.2', '10.3'],
};

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
  | 'query_decomposition_record'
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
