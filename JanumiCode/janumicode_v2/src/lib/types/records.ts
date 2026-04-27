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
    '1.0a': 'Intent Lens Classification',
    '1.0b': 'Intent Discovery',
    '1.0c': 'Technical Constraints Discovery',
    '1.0d': 'Compliance & Retention Discovery',
    '1.0e': 'V&V Requirements Discovery',
    '1.0f': 'Canonical Vocabulary Discovery',
    '1.0g': 'Intent Discovery Synthesis',
    '1.1b': 'Scope Bounding',
    '1.2': 'Intent Domain Bloom',
    '1.3': 'Intent Candidate Review & Menu',
    '1.4': 'Assumption Surfacing & Adjudication',
    '1.5': 'Intent Statement Synthesis',
    '1.6': 'Intent Statement Approval',
    '1.7': 'Handoff Approval',
  },
  '2': {
    '2.1': 'Functional Requirements Bloom',
    '2.1a': 'Functional Requirements Decomposition',
    '2.2': 'Non-Functional Requirements Bloom',
    '2.2a': 'Non-Functional Requirements Decomposition',
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
  '1': ['1.0', '1.0a', '1.1b', '1.2', '1.3', '1.4', '1.5', '1.6'],
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

// ── Lens-conditional sub-phase topology (Phase 1 product lens) ───────
//
// Phase 1's sub-phase list and the human-facing names of 1.2–1.6 depend
// on the classified intent lens. The product lens runs a v1-style bloom/
// prune proposer loop: silent intent discovery (1.0b) + four bloom rounds
// (1.2 domains, 1.3 journeys, 1.4 entities, 1.5 integrations) + silent
// synthesis (1.6) + handoff approval (1.7). Non-product lenses keep the
// default collapsed flow.
//
// The defaults above (SUB_PHASE_NAMES + SUB_PHASE_ORDER) are the fallback;
// callers resolve lens-aware values via getSubPhaseName / getSubPhaseOrder.

/**
 * Per-phase, per-lens overrides for sub-phase human-facing names. If a
 * lens isn't listed here for a given phase, fall back to SUB_PHASE_NAMES.
 */
export const SUB_PHASE_NAMES_BY_LENS: Partial<Record<PhaseId, Partial<Record<IntentLens, Record<string, string>>>>> = {
  '1': {
    product: {
      '1.0': 'Intent Quality Check',
      '1.0a': 'Intent Lens Classification',
      '1.0b': 'Product Intent Discovery',
      '1.0c': 'Technical Constraints Discovery',
      '1.0d': 'Compliance & Retention Discovery',
      '1.0e': 'V&V Requirements Discovery',
      '1.0f': 'Canonical Vocabulary Discovery',
      '1.0g': 'Intent Discovery Synthesis',
      '1.1b': 'Scope Bounding',
      '1.2': 'Business Domains & Personas Bloom',
      '1.3': 'User Journeys & Workflows Bloom',
      '1.4': 'Business Entities Bloom',
      '1.5': 'Integrations & Quality Attributes Bloom',
      '1.6': 'Product Description Synthesis',
      '1.7': 'Handoff Approval',
      '1.8': 'Release Plan Approval',
    },
  },
};

/**
 * Per-phase, per-lens overrides for the ordered sub-phase list.
 */
export const SUB_PHASE_ORDER_BY_LENS: Partial<Record<PhaseId, Partial<Record<IntentLens, string[]>>>> = {
  '1': {
    product: [
      '1.0', '1.0a',
      // Decomposed intent-discovery extraction passes (iter-4).
      '1.0b', '1.0c', '1.0d', '1.0e', '1.0f',
      // Deterministic composer merges 1.0b–1.0f into the discovery bundle.
      '1.0g',
      '1.1b', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7', '1.8',
    ],
  },
  // Wave 6 — product-lens Phase 2 inserts 2.1a (recursive FR
  // decomposition) between root FR bloom and NFR bloom. Default lens
  // skips 2.1a since there's no handoff to drive the decomposition.
  '2': {
    product: ['2.1', '2.1a', '2.2', '2.2a', '2.3'],
  },
};

/**
 * Resolve the human-facing name for a sub-phase. Prefers the lens-specific
 * override when `lens` is given and an override exists; otherwise falls
 * back to the default SUB_PHASE_NAMES entry; otherwise returns the raw id.
 */
export function getSubPhaseName(
  phaseId: PhaseId,
  subPhaseId: string,
  lens?: IntentLens | null,
): string {
  if (lens) {
    const lensOverride = SUB_PHASE_NAMES_BY_LENS[phaseId]?.[lens]?.[subPhaseId];
    if (lensOverride) return lensOverride;
  }
  return SUB_PHASE_NAMES[phaseId]?.[subPhaseId] ?? subPhaseId;
}

/**
 * Resolve the ordered sub-phase list for a phase. Prefers the lens-specific
 * override when one exists; otherwise falls back to the default ordering.
 */
export function getSubPhaseOrder(
  phaseId: PhaseId,
  lens?: IntentLens | null,
): string[] {
  if (lens) {
    const lensOverride = SUB_PHASE_ORDER_BY_LENS[phaseId]?.[lens];
    if (lensOverride) return lensOverride;
  }
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
  | 'dmr_pipeline'
  | 'product_description_handoff'
  | 'requirement_decomposition_node'
  | 'assumption_set_snapshot'
  | 'requirement_decomposition_pipeline'
  | 'memory_edge_proposed'
  | 'memory_edge_confirmed'
  | 'intent_quality_report'
  | 'cross_run_impact_report'
  | 'cross_run_modification'
  | 'coverage_gap'
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
  sub_phase_id: '1.3c' | '1.8' | '2.1c' | '2.2c';
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
