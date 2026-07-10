/**
 * Deterministic validator: handoff_field_completeness (deterministic
 * prefilter portion).
 *
 * Per validator_catalog.md §4 + sample 07. Verify each required handoff
 * field is populated with non-trivial content (not empty, not 'TODO',
 * not placeholder fragments). LLM follow-up for purpose-met is a later
 * commit's job.
 *
 * Required-field list keyed on (agentRole, subPhaseId).
 */

import type { ValidatorRuntimeParams, ValidatorFinding } from '../../validatorRegistry';

const PLACEHOLDER_PATTERNS = [
  /^todo$/i,
  /^tbd$/i,
  /^fixme$/i,
  /^placeholder$/i,
  /^xxx$/i,
  /^\.\.\.$/,
];

const MIN_FIELD_LENGTH = 20;

const HANDOFF_REQUIRED_FIELDS: Record<string, readonly string[]> = {
  'domain_interpreter:product_description_synthesis': [
    'productDescription',
  ],
  'orchestrator:release_plan': ['releases'],
};

function isPlaceholder(text: string): boolean {
  const t = text.trim();
  if (t.length === 0) return true;
  return PLACEHOLDER_PATTERNS.some((p) => p.test(t));
}

function evaluateHandoffField(
  field: string,
  value: unknown,
): ValidatorFinding | null {
  if (value === undefined || value === null) {
    return {
      validatorId: 'handoff_field_completeness',
      severity: 'HIGH',
      type: 'missing_handoff_field',
      summary: `Required handoff field '${field}' missing`,
      location: `$.${field}`,
      detail: `Handoff contract requires '${field}'; value is missing.`,
      recommendation: `Populate '${field}' with substantive content.`,
    };
  }
  if (typeof value === 'string') {
    if (isPlaceholder(value)) {
      return {
        validatorId: 'handoff_field_completeness',
        severity: 'HIGH',
        type: 'placeholder_handoff_field',
        summary: `Field '${field}' is a placeholder`,
        location: `$.${field}`,
        detail: `Field value '${value.trim()}' looks like a TODO/TBD placeholder.`,
        recommendation: `Replace placeholder with real handoff content.`,
      };
    }
    if (value.trim().length < MIN_FIELD_LENGTH) {
      return {
        validatorId: 'handoff_field_completeness',
        severity: 'MEDIUM',
        type: 'trivial_handoff_field',
        summary: `Field '${field}' is suspiciously short`,
        location: `$.${field}`,
        detail: `Field value is ${value.trim().length} chars (< ${MIN_FIELD_LENGTH}).`,
        recommendation: `Expand '${field}' to convey full handoff context.`,
      };
    }
    return null;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return {
        validatorId: 'handoff_field_completeness',
        severity: 'HIGH',
        type: 'empty_handoff_array',
        summary: `Required handoff array '${field}' is empty`,
        location: `$.${field}`,
        detail: `Array '${field}' is empty; the handoff contract expects non-empty content.`,
        recommendation: `Populate '${field}' with at least one entry.`,
      };
    }
  }
  return null;
}

export function validateHandoffFieldCompleteness(
  params: ValidatorRuntimeParams,
): ValidatorFinding[] {
  const out = params.outputContent;
  if (!out) return [];
  const required = HANDOFF_REQUIRED_FIELDS[`${params.agentRole}:${params.subPhaseId}`] ?? [];
  const findings: ValidatorFinding[] = [];

  for (const field of required) {
    const finding = evaluateHandoffField(field, out[field]);
    if (finding) findings.push(finding);
  }

  return findings;
}
