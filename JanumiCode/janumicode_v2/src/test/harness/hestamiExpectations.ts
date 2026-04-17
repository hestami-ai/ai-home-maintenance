/**
 * Hestami expectations — workflow-run assertions over the REAL
 * JanumiCode v2.3 artifact set.
 *
 * Most JanumiCode outputs are carried on the shared `artifact_produced`
 * record with `content.kind` as the discriminator. Every expectation
 * here matches on (record_type, content.kind) pairs instead of raw
 * record_type strings — otherwise `min_count: 1 of architecture_proposed`
 * would fail trivially because no handler ever emits a record with that
 * record_type. A previous generation of this file hard-coded names that
 * never appeared in the stream; that file is the one the review called
 * out as "asserts artifacts the real pipeline does not produce."
 *
 * Two severity tiers:
 *   - `required` — a missing/failing assertion is a gap. Fails the run.
 *   - `preferred` — a missing/failing assertion surfaces as a
 *     SemanticWarning but does not fail the run. Used for deeper quality
 *     heuristics (coverage, traceability, minimum component count).
 *
 * Every phase-level expectation carries a `phase` so the runner can
 * associate failures with the right phase in the gap report.
 */

import type { PhaseId } from '../../lib/types/records';
import type { SemanticWarning } from './types';

export interface HestamiExpectation {
  id: string;
  description: string;
  type: 'record_count' | 'semantic_check' | 'decision_point' | 'phase_progression';
  phase?: PhaseId;
  subPhase?: string;
  expected: unknown;
  validator: string;
  severity: 'required' | 'preferred';
}

export interface ExpectationResult {
  expectationId: string;
  passed: boolean;
  actual: unknown;
  message?: string;
  warning?: SemanticWarning;
}

// ── Expectation helpers (readable constructors) ────────────────────

const expectArtifact = (
  id: string,
  phase: PhaseId,
  kind: string,
  description: string,
  severity: 'required' | 'preferred' = 'required',
  min = 1,
): HestamiExpectation => ({
  id,
  description,
  type: 'record_count',
  phase,
  expected: { min, record_type: 'artifact_produced', content_kind: kind },
  validator: 'validateArtifactKindCount',
  severity,
});

const expectRecordType = (
  id: string,
  phase: PhaseId,
  recordType: string,
  description: string,
  severity: 'required' | 'preferred' = 'required',
  min = 1,
): HestamiExpectation => ({
  id,
  description,
  type: 'record_count',
  phase,
  expected: { min, record_type: recordType },
  validator: 'validateMinRecordCount',
  severity,
});

// ── Default expectations — minimal, used when a run only covers 0-1 ─

export const DEFAULT_EXPECTATIONS: HestamiExpectation[] = [
  expectRecordType('phase0-run-started', '0', 'raw_intent_received',
    'Phase 0 must record the raw intent that started the run.'),
  expectArtifact('phase0-workspace-classification', '0', 'workspace_classification',
    'Phase 0.1 must classify the workspace.'),
  expectArtifact('phase0-collision-risk', '0', 'collision_risk_report',
    'Phase 0.4 must record the collision risk report.'),

  expectRecordType('phase1-quality-check', '1', 'intent_quality_report',
    'Phase 1.0 must produce an intent_quality_report.'),
  expectArtifact('phase1-bloom', '1', 'intent_bloom',
    'Phase 1.2 must produce an intent_bloom with candidate product concepts.'),
  expectRecordType('phase1-decision-bundle', '1', 'decision_bundle_presented',
    'Phase 1.3 must present a composite decision bundle (Mirror + optional candidate Menu).'),
  expectArtifact('phase1-surfaced-assumptions', '1', 'surfaced_assumptions',
    'Phase 1.4 must surface assumptions implied by the kept candidates.'),
  expectArtifact('phase1-adjudicated-assumptions', '1', 'adjudicated_assumptions',
    'Phase 1.4 must record the adjudicated assumption set before synthesis.'),
  expectArtifact('phase1-intent-statement', '1', 'intent_statement',
    'Phase 1.5 must synthesize the intent statement from adjudicated assumptions.'),
  expectRecordType('phase1-gate', '1', 'phase_gate_evaluation',
    'Phase 1.6 must emit a phase gate evaluation.'),
];

// ── Full workflow expectations (Phases 0-10) ───────────────────────

export const FULL_WORKFLOW_EXPECTATIONS: HestamiExpectation[] = [
  ...DEFAULT_EXPECTATIONS,

  // Phase 2 — Requirements Definition
  expectArtifact('phase2-functional-requirements', '2', 'functional_requirements',
    'Phase 2.1 must emit functional requirements.'),
  expectArtifact('phase2-non-functional-requirements', '2', 'non_functional_requirements',
    'Phase 2.2 must emit non-functional requirements.'),
  expectArtifact('phase2-consistency-report', '2', 'consistency_report',
    'Phase 2.4 must record a consistency report.'),
  expectRecordType('phase2-gate', '2', 'phase_gate_evaluation',
    'Phase 2.5 must emit a phase gate evaluation.'),
  {
    id: 'phase2-requirement-coverage',
    description: 'Functional requirements should cover intent statement scope elements.',
    type: 'semantic_check',
    phase: '2',
    expected: { min_requirements: 3 },
    validator: 'validateFunctionalRequirementBreadth',
    severity: 'preferred',
  },

  // Phase 3 — System Specification
  expectArtifact('phase3-system-boundary', '3', 'system_boundary',
    'Phase 3.1 must define the system boundary.'),
  expectArtifact('phase3-system-requirements', '3', 'system_requirements',
    'Phase 3.2 must derive system requirements.'),
  expectArtifact('phase3-interface-contracts', '3', 'interface_contracts',
    'Phase 3.3 must define interface contracts.'),
  expectRecordType('phase3-gate', '3', 'phase_gate_evaluation',
    'Phase 3.5 must emit a phase gate evaluation.'),

  // Phase 4 — Architecture Definition
  expectArtifact('phase4-software-domains', '4', 'software_domains',
    'Phase 4.1 must partition into software domains.'),
  expectArtifact('phase4-component-model', '4', 'component_model',
    'Phase 4.2 must produce a component model.'),
  expectArtifact('phase4-architectural-decisions', '4', 'architectural_decisions',
    'Phase 4.3 must record architectural decisions.'),
  {
    id: 'phase4-component-breadth',
    description: 'Component model should define at least two components.',
    type: 'semantic_check',
    phase: '4',
    expected: { min_components: 2 },
    validator: 'validateArchitectureComponents',
    severity: 'preferred',
  },
  expectRecordType('phase4-gate', '4', 'phase_gate_evaluation',
    'Phase 4.5 must emit a phase gate evaluation.'),

  // Phase 5 — Technical Specification
  expectArtifact('phase5-data-models', '5', 'data_models',
    'Phase 5.1 must define data models.'),
  expectArtifact('phase5-api-definitions', '5', 'api_definitions',
    'Phase 5.2 must define APIs.'),
  expectArtifact('phase5-error-handling', '5', 'error_handling_strategies',
    'Phase 5.3 must record error handling strategies.'),
  expectArtifact('phase5-config-parameters', '5', 'configuration_parameters',
    'Phase 5.4 must enumerate configuration parameters.'),
  expectRecordType('phase5-gate', '5', 'phase_gate_evaluation',
    'Phase 5.6 must emit a phase gate evaluation.'),

  // Phase 6 — Implementation Planning
  expectArtifact('phase6-implementation-plan', '6', 'implementation_plan',
    'Phase 6.1 must produce an implementation plan.'),
  {
    id: 'phase6-task-estimates',
    description: 'Implementation plan tasks should carry estimates.',
    type: 'semantic_check',
    phase: '6',
    expected: { coverage: 0.9 },
    validator: 'validateTaskEstimateCoverage',
    severity: 'preferred',
  },
  expectRecordType('phase6-gate', '6', 'phase_gate_evaluation',
    'Phase 6.3 must emit a phase gate evaluation.'),

  // Phase 7 — Test Planning
  expectArtifact('phase7-test-plan', '7', 'test_plan',
    'Phase 7.1 must produce a test plan.'),
  expectArtifact('phase7-coverage-report', '7', 'test_coverage_report',
    'Phase 7.2 must produce a coverage report.'),
  expectRecordType('phase7-gate', '7', 'phase_gate_evaluation',
    'Phase 7.4 must emit a phase gate evaluation.'),

  // Phase 8 — Evaluation Planning
  expectArtifact('phase8-functional-eval', '8', 'functional_evaluation_plan',
    'Phase 8.1 must produce a functional evaluation plan.'),
  expectArtifact('phase8-quality-eval', '8', 'quality_evaluation_plan',
    'Phase 8.2 must produce a quality evaluation plan.'),
  expectArtifact('phase8-reasoning-eval', '8', 'reasoning_evaluation_plan',
    'Phase 8.3 must produce a reasoning evaluation plan.'),
  expectRecordType('phase8-gate', '8', 'phase_gate_evaluation',
    'Phase 8.5 must emit a phase gate evaluation.'),

  // Phase 9 — Execution
  expectArtifact('phase9-execution-summary', '9', 'execution_summary',
    'Phase 9.1 must produce an execution summary per task.'),
  expectArtifact('phase9-test-results', '9', 'test_results',
    'Phase 9.2 must record test results.'),
  expectArtifact('phase9-eval-results', '9', 'evaluation_results',
    'Phase 9.3 must record evaluation results.'),
  {
    id: 'phase9-tests-have-outcomes',
    description: 'Each test_results artifact should carry pass/fail outcomes.',
    type: 'semantic_check',
    phase: '9',
    expected: { require_outcomes: true },
    validator: 'validateTestOutcomePresence',
    severity: 'required',
  },
  {
    id: 'phase9-eval-criteria',
    description: 'Evaluation results should include criterion-level outcomes.',
    type: 'semantic_check',
    phase: '9',
    expected: { min_criteria: 1 },
    validator: 'validateEvalCriteriaPresence',
    severity: 'required',
  },
  expectRecordType('phase9-gate', '9', 'phase_gate_evaluation',
    'Phase 9.5 must emit a phase gate evaluation.'),

  // Phase 10 — Commit and Deployment Initiation
  expectArtifact('phase10-commit-record', '10', 'commit_record',
    'Phase 10.2 must record the commit (SHA + message).'),
  expectArtifact('phase10-run-summary', '10', 'workflow_run_summary',
    'Phase 10.3 must produce a workflow run summary.'),
  expectRecordType('phase10-gate', '10', 'phase_gate_evaluation',
    'Phase 10.3 must emit a final phase gate evaluation.'),
];

// ── Validator implementations ──────────────────────────────────────

type Recs = Array<{
  record_type: string;
  phase_id: string | null;
  sub_phase_id?: string | null;
  content: string | null;
}>;

function tryParse(content: string | null): Record<string, unknown> | null {
  if (!content) return null;
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

type ValidatorFn = (recs: Recs, exp: HestamiExpectation) => {
  passed: boolean;
  actual: unknown;
  message?: string;
};

const VALIDATORS: Record<string, ValidatorFn> = {
  validateMinRecordCount: (recs, exp) => {
    const { min, record_type } = exp.expected as { min: number; record_type: string };
    const count = recs.filter((r) => r.record_type === record_type).length;
    return {
      passed: count >= min,
      actual: count,
      message:
        count >= min
          ? `Found ${count} ${record_type} records`
          : `Expected ≥${min} ${record_type}, found ${count}`,
    };
  },

  validateArtifactKindCount: (recs, exp) => {
    const { min, content_kind } = exp.expected as {
      min: number;
      record_type: 'artifact_produced';
      content_kind: string;
    };
    const count = recs.filter(
      (r) => r.record_type === 'artifact_produced' && tryParse(r.content)?.kind === content_kind,
    ).length;
    return {
      passed: count >= min,
      actual: count,
      message:
        count >= min
          ? `Found ${count} artifact_produced[kind=${content_kind}]`
          : `Expected ≥${min} artifact_produced[kind=${content_kind}], found ${count}`,
    };
  },

  validateFunctionalRequirementBreadth: (recs, exp) => {
    const { min_requirements } = exp.expected as { min_requirements: number };
    const fr = recs.find(
      (r) => r.record_type === 'artifact_produced' &&
        tryParse(r.content)?.kind === 'functional_requirements',
    );
    if (!fr) return { passed: false, actual: 0, message: 'No functional_requirements artifact.' };
    const content = tryParse(fr.content) ?? {};
    let reqs: unknown[] = [];
    if (Array.isArray(content.user_stories)) reqs = content.user_stories;
    else if (Array.isArray(content.requirements)) reqs = content.requirements;
    return {
      passed: reqs.length >= min_requirements,
      actual: reqs.length,
      message: `Found ${reqs.length} functional requirement(s); expected ≥${min_requirements}`,
    };
  },

  validateArchitectureComponents: (recs, exp) => {
    const { min_components } = exp.expected as { min_components: number };
    const cm = recs.find(
      (r) => r.record_type === 'artifact_produced' &&
        tryParse(r.content)?.kind === 'component_model',
    );
    if (!cm) return { passed: false, actual: 0, message: 'No component_model artifact.' };
    const content = tryParse(cm.content) ?? {};
    const comps = Array.isArray(content.components) ? content.components : [];
    return {
      passed: comps.length >= min_components,
      actual: comps.length,
      message: `Component model defines ${comps.length} component(s); expected ≥${min_components}`,
    };
  },

  validateTaskEstimateCoverage: (recs, exp) => {
    const { coverage } = exp.expected as { coverage: number };
    const plan = recs.find(
      (r) => r.record_type === 'artifact_produced' &&
        tryParse(r.content)?.kind === 'implementation_plan',
    );
    if (!plan) return { passed: false, actual: 0, message: 'No implementation_plan artifact.' };
    const content = tryParse(plan.content) ?? {};
    const tasks = Array.isArray(content.tasks) ? content.tasks : [];
    if (tasks.length === 0) return { passed: true, actual: 1, message: 'Plan has no tasks.' };
    const withEstimate = (tasks as Array<Record<string, unknown>>).filter(
      (t) => t.estimate !== undefined || t.estimated_effort !== undefined,
    ).length;
    const ratio = withEstimate / tasks.length;
    return {
      passed: ratio >= coverage,
      actual: ratio,
      message: `${withEstimate}/${tasks.length} tasks have estimates (ratio ${ratio.toFixed(2)}, threshold ${coverage})`,
    };
  },

  validateTestOutcomePresence: (recs, _exp) => {
    const results = recs.filter(
      (r) => r.record_type === 'artifact_produced' &&
        tryParse(r.content)?.kind === 'test_results',
    );
    if (results.length === 0) return { passed: false, actual: 0, message: 'No test_results artifacts.' };
    const good = results.filter((r) => {
      const c = tryParse(r.content) ?? {};
      return c.outcomes !== undefined || c.results !== undefined || c.suites !== undefined;
    }).length;
    return {
      passed: good === results.length,
      actual: `${good}/${results.length}`,
      message: `${good}/${results.length} test_results artifacts carry outcomes`,
    };
  },

  validateEvalCriteriaPresence: (recs, exp) => {
    const { min_criteria } = exp.expected as { min_criteria: number };
    const ev = recs.find(
      (r) => r.record_type === 'artifact_produced' &&
        tryParse(r.content)?.kind === 'evaluation_results',
    );
    if (!ev) return { passed: false, actual: 0, message: 'No evaluation_results artifact.' };
    const content = tryParse(ev.content) ?? {};
    const criteria = content.criteria ?? content.criterion_outcomes ?? content.results ?? [];
    const count = Array.isArray(criteria) ? criteria.length : criteria ? 1 : 0;
    return {
      passed: count >= min_criteria,
      actual: count,
      message: `evaluation_results has ${count} criterion outcome(s); expected ≥${min_criteria}`,
    };
  },
};

// ── Public entry points ────────────────────────────────────────────

export function validateExpectations(
  records: Recs,
  expectations: HestamiExpectation[],
): ExpectationResult[] {
  return expectations.map((exp) => validateOne(records, exp));
}

function validateOne(records: Recs, exp: HestamiExpectation): ExpectationResult {
  const fn = VALIDATORS[exp.validator];
  if (!fn) {
    return {
      expectationId: exp.id,
      passed: true,
      actual: null,
      message: `Unknown validator: ${exp.validator}`,
    };
  }
  // Phase-scoped expectations only see records produced in that phase.
  const scoped = exp.phase ? records.filter((r) => r.phase_id === exp.phase) : records;
  const result = fn(scoped, exp);
  return {
    expectationId: exp.id,
    passed: result.passed,
    actual: result.actual,
    message: result.message,
    warning:
      !result.passed && exp.severity === 'preferred'
        ? {
            phase: exp.phase ?? 'unknown',
            subPhase: exp.subPhase ?? 'unknown',
            field: exp.type,
            assertion: exp.description,
            message: result.message ?? 'Expectation not met',
          }
        : undefined,
  };
}

export function getExpectationsForPhase(phaseId: PhaseId): HestamiExpectation[] {
  return FULL_WORKFLOW_EXPECTATIONS.filter((e) => e.phase === phaseId);
}

export function getRequiredExpectations(): HestamiExpectation[] {
  return FULL_WORKFLOW_EXPECTATIONS.filter((e) => e.severity === 'required');
}

export function getPreferredExpectations(): HestamiExpectation[] {
  return FULL_WORKFLOW_EXPECTATIONS.filter((e) => e.severity === 'preferred');
}
