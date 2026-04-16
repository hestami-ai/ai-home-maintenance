/**
 * Phase Contracts — what each JanumiCode v2.3 phase must emit.
 *
 * These contracts mirror the actual phase handlers in
 * `src/lib/orchestrator/phases/`. Most JanumiCode phase outputs are
 * carried on the shared `artifact_produced` record, with
 * `content.kind` as the discriminator (e.g. `intent_statement`,
 * `functional_requirements`, `component_model`). The validator
 * therefore matches on BOTH record_type AND content_kind, not on
 * record_type alone.
 *
 * A previous generation of this file mapped a generic "requirements →
 * architecture → commit" workflow that never matched JanumiCode's
 * actual artifact model; the oracle it produced was useless because
 * it reported phantom gaps against names no handler ever wrote. This
 * file is aligned to the real phases as of the catalog in
 * docs/test strategy harness — cross-reference the matching phase
 * handler when updating a contract.
 */

import type { PhaseId } from '../../lib/types/records';
import type { PhaseContract, PhaseInvariant, AuthorityRule, RequiredArtifact } from './types';

const art = (
  content_kind: string,
  sub_phase_id: string,
  reason: string,
  extras: Partial<RequiredArtifact> = {},
): RequiredArtifact => ({
  record_type: 'artifact_produced',
  content_kind,
  sub_phase_id,
  reason,
  ...extras,
});

// ── Phase 0 — Workspace Initialization ─────────────────────────────
export const PHASE0_CONTRACT: PhaseContract = {
  phase: '0',
  required_artifacts: [
    art('workspace_classification', '0.1',
      'Phase 0.1 classifies the workspace as greenfield/brownfield; gates the Phase 0.2 scan.',
      { produced_by_agent_role: 'orchestrator' }),
    art('external_file_ingested', '0.1b',
      'Phase 0.1b ingests user-attached reference files into the governed stream.',
      { optional: true }),
    art('ingested_artifact_index', '0.2',
      'Phase 0.2 DMR indexes brownfield artifacts (brownfield runs only).',
      { produced_by_agent_role: 'deep_memory_research', optional: true }),
    art('prior_decision_summary', '0.2b',
      'Phase 0.2b DMR summarizes prior-run decisions (brownfield runs only).',
      { produced_by_agent_role: 'deep_memory_research', optional: true }),
    art('collision_risk_report', '0.4',
      'Phase 0.4 records collision risk / alias findings before Phase 1 begins.',
      { produced_by_agent_role: 'orchestrator' }),
  ],
  invariants: [],
  authority_rules: [],
};

// ── Phase 0.5 — Cross-Run Impact Analysis (conditional) ────────────
export const PHASE0_5_CONTRACT: PhaseContract = {
  phase: '0.5',
  required_artifacts: [
    art('cross_run_impact_report', '0.5.1',
      'Phase 0.5 consistency-checker output; drives the cascade threshold menu.',
      { produced_by_agent_role: 'consistency_checker' }),
  ],
  invariants: [],
  authority_rules: [],
};

// ── Phase 1 — Intent Capture and Convergence ───────────────────────
export const PHASE1_CONTRACT: PhaseContract = {
  phase: '1',
  required_artifacts: [
    {
      record_type: 'intent_quality_report',
      sub_phase_id: '1.0',
      produced_by_agent_role: 'orchestrator',
      reason: 'Phase 1.0 Intent Quality Check emits a dedicated report record.',
    },
    art('scope_classification', '1.1b',
      'Phase 1.1b classifies scope so compliance context can be attached.'),
    art('compliance_context', '1.1b',
      'Phase 1.1b attaches compliance constraints for the classified scope.'),
    art('intent_bloom', '1.2',
      'Phase 1.2 produces candidate product concepts from the raw intent.',
      { produced_by_agent_role: 'domain_interpreter' }),
    {
      record_type: 'decision_bundle_presented',
      sub_phase_id: '1.3',
      produced_by_agent_role: 'orchestrator',
      reason: 'Phase 1.3 presents the composite bloom prune (assumption mirror + optional candidate menu).',
    },
    art('intent_statement', '1.4',
      'Phase 1.4 synthesizes the final intent statement from user-kept candidates.',
      { produced_by_agent_role: 'domain_interpreter' }),
    {
      record_type: 'mirror_presented',
      sub_phase_id: '1.5',
      produced_by_agent_role: 'orchestrator',
      reason: 'Phase 1.5 presents the intent statement for human approval.',
    },
    {
      record_type: 'phase_gate_evaluation',
      sub_phase_id: '1.5',
      produced_by_agent_role: 'orchestrator',
      reason: 'Phase 1 closes with a gate evaluation before advancing to Phase 2.',
    },
  ],
  invariants: [
    {
      name: 'intent_statement_has_scope',
      description: 'Intent statement artifact must carry a product_concept with name + description.',
      validator: 'validateIntentStatementScope',
      severity: 'error',
    },
  ],
  authority_rules: [],
};

// ── Phase 2 — Requirements Definition ──────────────────────────────
export const PHASE2_CONTRACT: PhaseContract = {
  phase: '2',
  required_artifacts: [
    art('functional_requirements', '2.1',
      'Phase 2.1 enumerates functional requirements from the intent statement.',
      { produced_by_agent_role: 'requirements_agent' }),
    art('non_functional_requirements', '2.2',
      'Phase 2.2 derives NFRs (performance, security, etc.) from the intent + scope.',
      { produced_by_agent_role: 'requirements_agent' }),
    {
      record_type: 'mirror_presented',
      sub_phase_id: '2.3',
      produced_by_agent_role: 'orchestrator',
      reason: 'Phase 2.3 presents the combined requirements for human review.',
    },
    art('consistency_report', '2.4',
      'Phase 2.4 consistency-checker output over the requirements set.',
      { produced_by_agent_role: 'consistency_checker' }),
    {
      record_type: 'mirror_presented',
      sub_phase_id: '2.5',
      produced_by_agent_role: 'orchestrator',
      reason: 'Phase 2.5 domain attestation mirror — user signs off on compliance coverage.',
    },
    {
      record_type: 'phase_gate_evaluation',
      sub_phase_id: '2.5',
      produced_by_agent_role: 'orchestrator',
      reason: 'Phase 2 closes with a gate evaluation before Phase 3.',
    },
  ],
  invariants: [
    {
      name: 'requirements_have_sources',
      description: 'Each functional requirement must trace to a source record id.',
      validator: 'validateRequirementSources',
      severity: 'warning',
    },
  ],
  authority_rules: [],
};

// ── Phase 3 — System Specification ─────────────────────────────────
export const PHASE3_CONTRACT: PhaseContract = {
  phase: '3',
  required_artifacts: [
    art('system_boundary', '3.1',
      'Phase 3.1 systems-agent defines the system boundary.',
      { produced_by_agent_role: 'systems_agent' }),
    art('system_requirements', '3.2',
      'Phase 3.2 systems-agent derives system-level requirements.',
      { produced_by_agent_role: 'systems_agent' }),
    art('interface_contracts', '3.3',
      'Phase 3.3 systems-agent defines external interface contracts.',
      { produced_by_agent_role: 'systems_agent' }),
    {
      record_type: 'mirror_presented',
      sub_phase_id: '3.4',
      produced_by_agent_role: 'orchestrator',
      reason: 'Phase 3.4 presents the system spec for human review.',
    },
    art('consistency_report', '3.5',
      'Phase 3.5 consistency-checker output over the system spec.',
      { produced_by_agent_role: 'consistency_checker' }),
    {
      record_type: 'phase_gate_evaluation',
      sub_phase_id: '3.5',
      produced_by_agent_role: 'orchestrator',
      reason: 'Phase 3 closes with a gate evaluation before Phase 4.',
    },
  ],
  invariants: [],
  authority_rules: [],
};

// ── Phase 4 — Architecture Definition ──────────────────────────────
export const PHASE4_CONTRACT: PhaseContract = {
  phase: '4',
  required_artifacts: [
    art('software_domains', '4.1',
      'Phase 4.1 architecture-agent partitions the problem into software domains.',
      { produced_by_agent_role: 'architecture_agent' }),
    art('component_model', '4.2',
      'Phase 4.2 architecture-agent defines components and their relationships.',
      { produced_by_agent_role: 'architecture_agent' }),
    art('architectural_decisions', '4.3',
      'Phase 4.3 architecture-agent records ADRs for significant choices.',
      { produced_by_agent_role: 'architecture_agent' }),
    {
      record_type: 'mirror_presented',
      sub_phase_id: '4.4',
      produced_by_agent_role: 'orchestrator',
      reason: 'Phase 4.4 presents the architecture for human review.',
    },
    art('consistency_report', '4.5',
      'Phase 4.5 consistency-checker output over the architecture.',
      { produced_by_agent_role: 'consistency_checker' }),
    {
      record_type: 'phase_gate_evaluation',
      sub_phase_id: '4.5',
      produced_by_agent_role: 'orchestrator',
      reason: 'Phase 4 closes with a gate evaluation before Phase 5.',
    },
  ],
  invariants: [
    {
      name: 'architecture_has_components',
      description: 'Component model must define at least two components.',
      validator: 'validateArchitectureComponents',
      severity: 'error',
    },
    {
      name: 'components_have_responsibilities',
      description: 'Each component must declare a responsibility string.',
      validator: 'validateComponentResponsibilities',
      severity: 'warning',
    },
  ],
  authority_rules: [],
};

// ── Phase 5 — Technical Specification ──────────────────────────────
export const PHASE5_CONTRACT: PhaseContract = {
  phase: '5',
  required_artifacts: [
    art('data_models', '5.1',
      'Phase 5.1 technical-spec-agent defines data models.',
      { produced_by_agent_role: 'technical_spec_agent' }),
    art('api_definitions', '5.2',
      'Phase 5.2 technical-spec-agent defines internal / external APIs.',
      { produced_by_agent_role: 'technical_spec_agent' }),
    art('error_handling_strategies', '5.3',
      'Phase 5.3 technical-spec-agent defines error-handling strategies.',
      { produced_by_agent_role: 'technical_spec_agent' }),
    art('configuration_parameters', '5.4',
      'Phase 5.4 technical-spec-agent enumerates configuration parameters.',
      { produced_by_agent_role: 'technical_spec_agent' }),
    {
      record_type: 'mirror_presented',
      sub_phase_id: '5.5',
      produced_by_agent_role: 'orchestrator',
      reason: 'Phase 5.5 presents the technical spec for human review.',
    },
    art('consistency_report', '5.6',
      'Phase 5.6 consistency-checker output over the technical spec.',
      { produced_by_agent_role: 'consistency_checker' }),
    {
      record_type: 'phase_gate_evaluation',
      sub_phase_id: '5.6',
      produced_by_agent_role: 'orchestrator',
      reason: 'Phase 5 closes with a gate evaluation before Phase 6.',
    },
  ],
  invariants: [],
  authority_rules: [],
};

// ── Phase 6 — Implementation Planning ──────────────────────────────
export const PHASE6_CONTRACT: PhaseContract = {
  phase: '6',
  required_artifacts: [
    art('implementation_plan', '6.1',
      'Phase 6.1 implementation-planner emits task decomposition + dependencies.',
      { produced_by_agent_role: 'implementation_planner' }),
    {
      record_type: 'mirror_presented',
      sub_phase_id: '6.2',
      produced_by_agent_role: 'orchestrator',
      reason: 'Phase 6.2 presents the implementation plan for human review.',
    },
    art('consistency_report', '6.3',
      'Phase 6.3 consistency-checker output over the implementation plan.',
      { produced_by_agent_role: 'consistency_checker' }),
    {
      record_type: 'phase_gate_evaluation',
      sub_phase_id: '6.3',
      produced_by_agent_role: 'orchestrator',
      reason: 'Phase 6 closes with a gate evaluation before Phase 7.',
    },
  ],
  invariants: [
    {
      name: 'tasks_have_estimates',
      description: 'Implementation plan tasks must carry time estimates.',
      validator: 'validateTaskEstimates',
      severity: 'warning',
    },
    {
      name: 'dependencies_acyclic',
      description: 'Task dependency graph must not have cycles.',
      validator: 'validateAcyclicDependencies',
      severity: 'error',
    },
  ],
  authority_rules: [],
};

// ── Phase 7 — Test Planning ────────────────────────────────────────
export const PHASE7_CONTRACT: PhaseContract = {
  phase: '7',
  required_artifacts: [
    art('test_plan', '7.1',
      'Phase 7.1 test-design-agent emits the test plan.',
      { produced_by_agent_role: 'test_design_agent' }),
    art('test_coverage_report', '7.2',
      'Phase 7.2 consistency-checker cross-walks test plan vs requirements.',
      { produced_by_agent_role: 'consistency_checker' }),
    {
      record_type: 'mirror_presented',
      sub_phase_id: '7.3',
      produced_by_agent_role: 'orchestrator',
      reason: 'Phase 7.3 presents the test plan for human review.',
    },
    {
      record_type: 'phase_gate_evaluation',
      sub_phase_id: '7.4',
      produced_by_agent_role: 'orchestrator',
      reason: 'Phase 7 closes with a gate evaluation before Phase 8.',
    },
  ],
  invariants: [],
  authority_rules: [],
};

// ── Phase 8 — Evaluation Planning ──────────────────────────────────
export const PHASE8_CONTRACT: PhaseContract = {
  phase: '8',
  required_artifacts: [
    art('functional_evaluation_plan', '8.1',
      'Phase 8.1 eval-design-agent emits functional eval plan.',
      { produced_by_agent_role: 'eval_design_agent' }),
    art('quality_evaluation_plan', '8.2',
      'Phase 8.2 eval-design-agent emits quality eval plan.',
      { produced_by_agent_role: 'eval_design_agent' }),
    art('reasoning_evaluation_plan', '8.3',
      'Phase 8.3 eval-design-agent emits reasoning eval plan.',
      { produced_by_agent_role: 'eval_design_agent' }),
    {
      record_type: 'mirror_presented',
      sub_phase_id: '8.4',
      produced_by_agent_role: 'orchestrator',
      reason: 'Phase 8.4 presents the evaluation plans for human review.',
    },
    {
      record_type: 'phase_gate_evaluation',
      sub_phase_id: '8.5',
      produced_by_agent_role: 'orchestrator',
      reason: 'Phase 8 closes with a gate evaluation before Phase 9.',
    },
  ],
  invariants: [],
  authority_rules: [],
};

// ── Phase 9 — Execution (primary implementation) ───────────────────
export const PHASE9_CONTRACT: PhaseContract = {
  phase: '9',
  required_artifacts: [
    art('execution_summary', '9.1',
      'Phase 9.1 executor-agent emits an execution summary per implementation task.',
      { produced_by_agent_role: 'executor_agent' }),
    art('test_results', '9.2',
      'Phase 9.2 executor-agent runs tests and records per-suite results.',
      { produced_by_agent_role: 'executor_agent' }),
    art('evaluation_results', '9.3',
      'Phase 9.3 eval-execution-agent runs evaluation plans and records outcomes.',
      { produced_by_agent_role: 'eval_execution_agent' }),
    art('reasoning_review_result', '9.1',
      'Phase 9 reasoning-review produces a result per reviewed task (optional — only when triggered).',
      { produced_by_agent_role: 'reasoning_review', optional: true }),
    art('loop_detection_result', '9.1',
      'Phase 9 loop-detection fires after ≥2 retries (optional).',
      { produced_by_agent_role: 'loop_detection_monitor', optional: true }),
    {
      record_type: 'mirror_presented',
      sub_phase_id: '9.5',
      produced_by_agent_role: 'orchestrator',
      reason: 'Phase 9.5 presents the execution completion mirror.',
    },
    {
      record_type: 'phase_gate_evaluation',
      sub_phase_id: '9.5',
      produced_by_agent_role: 'orchestrator',
      reason: 'Phase 9 closes with a gate evaluation before Phase 10.',
    },
  ],
  invariants: [
    {
      name: 'tests_have_results',
      description: 'Every task in the implementation plan must have a test_results record.',
      validator: 'validateTestResults',
      severity: 'error',
    },
    {
      name: 'eval_has_criteria_outcomes',
      description: 'evaluation_results must record per-criterion pass/fail.',
      validator: 'validateEvalResults',
      severity: 'error',
    },
  ],
  authority_rules: [],
};

// ── Phase 10 — Commit and Deployment Initiation ────────────────────
export const PHASE10_CONTRACT: PhaseContract = {
  phase: '10',
  required_artifacts: [
    art('consistency_report', '10.1',
      'Phase 10.1 consistency-checker runs a final pass before the commit.',
      { produced_by_agent_role: 'consistency_checker' }),
    art('commit_record', '10.2',
      'Phase 10.2 executor-agent creates a commit and records its SHA + message.',
      { produced_by_agent_role: 'executor_agent' }),
    art('workflow_run_summary', '10.3',
      'Phase 10.3 orchestrator emits a workflow run summary for retrieval.',
      { produced_by_agent_role: 'orchestrator' }),
    {
      record_type: 'mirror_presented',
      sub_phase_id: '10.3',
      produced_by_agent_role: 'orchestrator',
      reason: 'Phase 10.3 presents a closure mirror for the whole run.',
    },
    {
      record_type: 'phase_gate_evaluation',
      sub_phase_id: '10.3',
      produced_by_agent_role: 'orchestrator',
      reason: 'Phase 10 closes with a final gate evaluation.',
    },
  ],
  invariants: [
    {
      name: 'commit_message_present',
      description: 'commit_record must carry a non-empty commit message.',
      validator: 'validateCommitMessage',
      severity: 'warning',
    },
    {
      name: 'commit_references_intent',
      description: 'commit_record message should reference the originating intent.',
      validator: 'validateCommitReferencesIntent',
      severity: 'warning',
    },
  ],
  authority_rules: [],
};

// ── Registry ────────────────────────────────────────────────────────

export const PHASE_CONTRACTS: Record<PhaseId, PhaseContract> = {
  '0': PHASE0_CONTRACT,
  '0.5': PHASE0_5_CONTRACT,
  '1': PHASE1_CONTRACT,
  '2': PHASE2_CONTRACT,
  '3': PHASE3_CONTRACT,
  '4': PHASE4_CONTRACT,
  '5': PHASE5_CONTRACT,
  '6': PHASE6_CONTRACT,
  '7': PHASE7_CONTRACT,
  '8': PHASE8_CONTRACT,
  '9': PHASE9_CONTRACT,
  '10': PHASE10_CONTRACT,
};

export function getPhaseContract(phaseId: PhaseId): PhaseContract | undefined {
  return PHASE_CONTRACTS[phaseId];
}

export function getRequiredArtifacts(phaseId: PhaseId): RequiredArtifact[] {
  return PHASE_CONTRACTS[phaseId]?.required_artifacts ?? [];
}

export function getPhaseInvariants(phaseId: PhaseId): PhaseInvariant[] {
  return PHASE_CONTRACTS[phaseId]?.invariants ?? [];
}

export function getAuthorityRules(phaseId: PhaseId): AuthorityRule[] {
  return PHASE_CONTRACTS[phaseId]?.authority_rules ?? [];
}
