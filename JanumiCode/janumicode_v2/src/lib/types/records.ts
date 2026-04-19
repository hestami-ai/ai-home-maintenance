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
      '1.0b': 'Intent Discovery',
      '1.1b': 'Scope Bounding',
      '1.2': 'Business Domains & Personas Bloom',
      '1.3': 'User Journeys & Workflows Bloom',
      '1.4': 'Business Entities Bloom',
      '1.5': 'Integrations & Quality Attributes Bloom',
      '1.6': 'Product Description Synthesis',
      '1.7': 'Handoff Approval',
    },
  },
};

/**
 * Per-phase, per-lens overrides for the ordered sub-phase list.
 */
export const SUB_PHASE_ORDER_BY_LENS: Partial<Record<PhaseId, Partial<Record<IntentLens, string[]>>>> = {
  '1': {
    product: ['1.0', '1.0a', '1.0b', '1.1b', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7'],
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
  /**
   * Intent lens selected by Phase 1.0a classification. Null until the
   * classification step runs. Downstream phase handlers read this to
   * pick lens-variant prompt templates.
   */
  intent_lens: IntentLens | null;
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

export interface Workflow {
  id: string;
  /** References `BusinessDomain.id`. */
  businessDomainId: string;
  name: string;
  description: string;
  steps: string[];
  triggers: string[];
  actors: string[];
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
  schemaVersion: '1.0';
  /** Always 'product_or_feature' under the product lens; preserved for v1 parity. */
  requestCategory: 'product_or_feature';

  // Narrative layer (from 1.0b Intent Discovery, refined through synthesis)
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
  workflowProposals: Workflow[];
  integrationProposals: Integration[];
  qualityAttributes: string[];
  uxRequirements: string[];

  // Extracted items (from 1.0b Intent Discovery + refined during synthesis)
  requirements: ExtractedItem[];
  decisions: ExtractedItem[];
  constraints: ExtractedItem[];
  openQuestions: ExtractedItem[];

  // Cross-cutting — condensed human decisions + unresolved loops
  humanDecisions: HumanDecisionSummary[];
  openLoops: OpenLoop[];
}
