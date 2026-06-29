/**
 * Binding-vs-context classification for governing records.
 *
 * Authority (>= 6 / phase-gate-certified) answers *"is this trustworthy /
 * governing-grade?"*. It does NOT answer *"is this a normative rule the
 * generated code must not violate?"* — that is a property of the record's KIND,
 * orthogonal to authority. A phase gate elevates EVERY certified architecture
 * artifact (component_model, system_boundary, the user-story roster, …) to
 * authority 6 alongside the genuine TECH-* / ADR / NFR rules, so authority alone
 * over-claims bindingness: in ws-156, 12 of 14 records rendered under "apply
 * without exception" were certified CONTEXT, not rules (and the only actual task
 * constraint, TECH-AES-256, arrived via the implementation packet, not here).
 *
 * This module adds the missing SECOND axis — the kind-class:
 *   - BINDING            = normative rules the code must satisfy without exception.
 *   - CERTIFIED_CONTEXT  = authoritative reference to build WITHIN and not contradict.
 *
 * Unknown kinds default to CERTIFIED_CONTEXT (conservative — a newly-added
 * artifact kind must never silently become "apply without exception").
 *
 * Shared on purpose: the DMR detail-file renderer, the phases-0-8
 * governing-constraints prompt text, and (later) the Phase-9 recon enforcement
 * manifest's TECH-* gate all reference ONE definition of "binding" so the
 * executor's binding channels never drift on what the word means.
 */

export type GoverningClass = 'binding' | 'certified_context';

/**
 * Record kinds (`content.kind`, falling back to `record_type`) that are
 * NORMATIVE rules — things the generated code must satisfy without exception.
 * Everything not listed is treated as certified context. Reports/diagnostics
 * (`*_report`, `*_coverage_report`) and structural/descriptive artifacts
 * (component_model, data_models, api_definitions, interface_contracts,
 * software_domains, system_boundary, system_requirements, intent_statement,
 * functional_requirements, error_handling_strategies, configuration_parameters,
 * implementation_plan) are deliberately NOT binding here — they are reference
 * context, and their binding form (when one exists, e.g. a component's own data
 * model) is delivered to the executor through the implementation packet.
 */
export const BINDING_KINDS: ReadonlySet<string> = new Set<string>([
  // Technical constraints (TECH-*)
  'technical_constraints_discovery',
  'technical_constraints',
  // Architectural decisions (ADR)
  'architectural_decisions',
  // Non-functional requirement thresholds
  'non_functional_requirements',
  // Compliance / verification & validation / quality attributes
  'compliance',
  'compliance_context',
  'compliance_retention_discovery',
  'vv_requirement',
  'vv_requirements_discovery',
  'quality_attribute',
  // Acceptance gates
  'completion_criteria',
  // Binding process governance
  'constitutional_invariant',
  // Cross-cutting binding constraints
  'cross_cutting_constraints',
]);

/**
 * Classify a governing record by its kind. `kind` should be the record's
 * `content.kind` when present, else its `record_type`. Undefined / unknown →
 * `certified_context` (conservative default).
 */
export function classifyGoverningKind(kind: string | undefined): GoverningClass {
  return kind != null && BINDING_KINDS.has(kind) ? 'binding' : 'certified_context';
}
