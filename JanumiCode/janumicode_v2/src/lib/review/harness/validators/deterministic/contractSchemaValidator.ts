/**
 * Deterministic validator: contract_schema_validator
 *
 * Per validator_catalog.md §1 + §9.1: verify the agent's response is valid
 * JSON and conforms to a role-keyed schema (top-level keys, basic types,
 * required fields, ID prefix conventions). Schemas are keyed by
 * `${agentRole}:${subPhaseId}`. Roles outside the 12 sampled pairs use a
 * placeholder schema ({}) that returns no findings.
 *
 * Severity rule (catalog §9.1):
 *   - missing required field, parse failure, branch-rule violation -> HIGH
 *   - type/enum mismatch -> MEDIUM
 *   - extra unexpected fields / cosmetic issues -> LOW
 */

import type { ValidatorRuntimeParams, ValidatorFinding } from '../../validatorRegistry';

interface FieldRule {
  /** JSON type expected (when undefined, just check presence). */
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
  /** When present, value must be one of these. */
  enum?: readonly (string | number | boolean)[];
}

interface ContractSchema {
  /** Required top-level fields. */
  required?: Record<string, FieldRule>;
  /** Optional fields whose type is checked when present. */
  optional?: Record<string, FieldRule>;
  /** Closed schema — extra top-level keys raise LOW findings. */
  closed?: boolean;
}

const CONTRACT_SCHEMAS: Record<string, ContractSchema> = {
  // S01
  'orchestrator:intent_quality_check': {
    required: {
      overall_status: { type: 'string', enum: ['pass', 'requires_input', 'blocking'] },
      concerns: { type: 'array' },
    },
    optional: {
      completeness_findings: { type: 'array' },
      coherence_findings: { type: 'array' },
      has_concerns: { type: 'boolean' },
      system_proposal_offered_for: { type: 'array' },
    },
  },
  // S02
  'orchestrator:intent_lens_classification': {
    required: {
      lens: { type: 'string' },
      confidence: { type: 'number' },
    },
    optional: {
      rationale: { type: 'string' },
      lens_correctness_rationale: { type: 'string' },
      fallback_lens: { type: 'string' },
    },
  },
  // S03
  'domain_interpreter:product_intent_discovery': {
    required: { product_intent: {} },
    optional: {
      decisions: { type: 'array' },
      open_questions: { type: 'array' },
      personas: { type: 'array' },
      assumptions: { type: 'array' },
    },
  },
  // S04
  'domain_interpreter:compliance_retention_discovery': {
    optional: {
      compliance: { type: 'array' },
      retention: { type: 'array' },
      decisions: { type: 'array' },
      open_questions: { type: 'array' },
    },
  },
  // S05
  'domain_interpreter:business_domains_bloom': {
    required: {
      personas: { type: 'array' },
      domains: { type: 'array' },
    },
    optional: {
      entity_preview: { type: 'array' },
      workflow_preview: { type: 'array' },
    },
  },
  // S06
  'domain_interpreter:user_journey_bloom': {
    required: {
      user_journeys: { type: 'array' },
    },
    optional: {
      personas: { type: 'array' },
      unreached_personas: { type: 'array' },
      unreached_domains: { type: 'array' },
    },
  },
  // S07
  'domain_interpreter:product_description_synthesis': {
    required: {
      product_description: { type: 'string' },
    },
    optional: {
      open_loops: { type: 'array' },
      compressionNotes: { type: 'string' },
    },
  },
  // S08
  'orchestrator:release_plan': {
    required: {
      releases: { type: 'array' },
    },
    optional: {
      open_loops: { type: 'array' },
    },
  },
  // S09
  'requirements_agent:fr_bloom_skeleton': {
    required: { user_stories: { type: 'array' } },
  },
  // S10
  'requirements_agent:fr_bloom_enrichment': {
    required: { user_stories: { type: 'array' } },
  },
  // S11
  'requirements_agent:nfr_bloom_skeleton': {
    required: { nfrs: { type: 'array' } },
  },
  // S12
  'requirements_agent:nfr_bloom_enrichment': {
    required: { nfrs: { type: 'array' } },
  },

  // ── Phase 3: systems_agent sub-phases ──────────────────────────────────

  // S15 — systems_agent / system_boundary (3.1)
  // Evidence: sample 15. Top-level: in_scope[], out_of_scope[], external_systems[].
  'systems_agent:system_boundary': {
    required: {
      in_scope: { type: 'array' },
      out_of_scope: { type: 'array' },
      external_systems: { type: 'array' },
    },
  },

  // S16 — systems_agent / system_requirements (3.2)
  // Evidence: sample 16. Top-level: system_requirements[].
  // Each item has: id, statement, source_requirement_ids[], priority.
  'systems_agent:system_requirements': {
    required: {
      system_requirements: { type: 'array' },
    },
  },

  // S17 — systems_agent / interface_contracts (3.3)
  // Evidence: sample 17. Top-level: contracts[].
  // Each item has: id, systems_involved[], protocol, data_format, auth_mechanism.
  'systems_agent:interface_contracts': {
    required: {
      contracts: { type: 'array' },
    },
  },

  // ── Phase 4: architecture_agent sub-phases ─────────────────────────────

  // S18 — architecture_agent / software_domains (4.1)
  // Evidence: sample 18. Top-level: software_domains[].
  // Each item has: id, name, ubiquitous_language[], system_requirement_ids[].
  'architecture_agent:software_domains': {
    required: {
      software_domains: { type: 'array' },
    },
  },

  // S19 — architecture_agent / component_skeleton (4.2)
  // Evidence: sample 19. Top-level: components[].
  // Each item has: id, name, domain_id, responsibilities[], dependencies[].
  'architecture_agent:component_skeleton': {
    required: {
      components: { type: 'array' },
    },
  },

  // S20 — architecture_agent / adr_capture (4.3)
  // Evidence: sample 20. Top-level: architectural_decisions[] (array of ADR objects directly).
  // NOTE: accepted_rationale[] does NOT exist in the agent's schema — the prompt notes this gap
  // and falls back to rationale. adr_status_discipline_validator enforces the status rules.
  // Each ADR has: id, title, status (proposed|accepted), context, decision, alternatives[], rationale, consequences.
  'architecture_agent:adr_capture': {
    required: {
      architectural_decisions: { type: 'array' },
    },
  },

  // S21 — domain_interpreter / component_saturation (4.2a)
  // Evidence: sample 21a/21b. Top-level: parent_branch_classification, parent_tier_assessment{}, children[].
  'domain_interpreter:component_saturation': {
    required: {
      parent_branch_classification: {
        type: 'string',
        enum: ['decomposable', 'atomic_leaf', 'invalid_parent'],
      },
      parent_tier_assessment: { type: 'object' },
      children: { type: 'array' },
    },
  },

  // ── Phase 5: technical_spec_agent sub-phases ───────────────────────────

  // S22 — technical_spec_agent / data_model_skeleton (5.1)
  // Evidence: sample 22. Top-level: data_models[].
  // Each item has: component_id, entities[].
  'technical_spec_agent:data_model_skeleton': {
    required: {
      data_models: { type: 'array' },
    },
  },

  // S23 — technical_spec_agent / api_definitions (5.2)
  // Evidence: sample 23. Top-level: api_definitions[].
  // Each item has: component_id, endpoints[].
  'technical_spec_agent:api_definitions': {
    required: {
      api_definitions: { type: 'array' },
    },
  },

  // S24 — technical_spec_agent / error_handling (5.3)
  // Evidence: sample 24. Top-level: strategies[] (note: prompt schema name is
  // error_handling_strategies but agent emits root key 'strategies'; prompt text at sample 24
  // shows the agent's self-correction "root key is likely 'strategies'"). Contract registers
  // 'strategies' since that is what the agent emits per sample evidence.
  // Each item has: component_id, error_types[], detection, response, surfacing, error_payload.
  'technical_spec_agent:error_handling': {
    required: {
      strategies: { type: 'array' },
    },
    optional: {
      error_handling_strategies: { type: 'array' },
    },
  },

  // S25 — technical_spec_agent / configuration_parameters (5.4)
  // Evidence: sample 25. Top-level: params[].
  // Each item has: component_id, name, type, default (nullable), required (bool), description.
  'technical_spec_agent:configuration_parameters': {
    required: {
      params: { type: 'array' },
    },
    optional: {
      configuration_parameters: { type: 'array' },
    },
  },

  // S26 — technical_spec_agent / data_model_saturation (5.x)
  // Evidence: samples 26a/26b. Top-level: parent_branch_classification, parent_tier_assessment{}, children[].
  // Same shape as component_saturation (S21) but entity-surface rubric (decomposable/atomic_value/invalid_parent).
  'technical_spec_agent:data_model_saturation': {
    required: {
      parent_branch_classification: {
        type: 'string',
        enum: ['decomposable', 'atomic_value', 'invalid_parent'],
      },
      parent_tier_assessment: { type: 'object' },
      children: { type: 'array' },
    },
  },
};

function getJsonType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function lookupSchema(agentRole: string, subPhaseId: string): ContractSchema | null {
  return CONTRACT_SCHEMAS[`${agentRole}:${subPhaseId}`] ?? null;
}

export function validateContractSchema(
  params: ValidatorRuntimeParams,
): ValidatorFinding[] {
  const findings: ValidatorFinding[] = [];

  // Parse failure: outputContent is null (the harness sets this when
  // result.parsed is null — i.e. the agent's response wasn't parseable
  // JSON or wasn't an object).
  if (params.outputContent === null) {
    if ((params.outputText ?? '').trim().length > 0) {
      findings.push({
        validatorId: 'contract_schema_validator',
        severity: 'HIGH',
        type: 'invalid_json',
        summary: 'Agent response did not parse as JSON',
        location: '$',
        detail: 'outputContent is null; the agent response could not be parsed as a JSON object.',
        recommendation:
          'Ensure the agent emits a single JSON object (no markdown fences, no trailing prose).',
      });
    }
    return findings;
  }

  const schema = lookupSchema(params.agentRole, params.subPhaseId);
  if (!schema) return findings; // Unsampled (role, sub_phase) — placeholder.

  const obj = params.outputContent;

  // Required fields
  for (const [field, rule] of Object.entries(schema.required ?? {})) {
    if (!(field in obj) || obj[field] === undefined || obj[field] === null) {
      findings.push({
        validatorId: 'contract_schema_validator',
        severity: 'HIGH',
        type: 'missing_required_field',
        summary: `Missing required field '${field}'`,
        location: `$.${field}`,
        detail: `Schema for ${params.agentRole}/${params.subPhaseId} requires '${field}'.`,
        recommendation: `Populate '${field}' per the agent contract.`,
      });
      continue;
    }
    const findingForRule = checkFieldRule(field, obj[field], rule);
    if (findingForRule) findings.push(findingForRule);
  }

  // Optional fields — type checks when present.
  for (const [field, rule] of Object.entries(schema.optional ?? {})) {
    if (!(field in obj) || obj[field] === undefined || obj[field] === null) continue;
    const findingForRule = checkFieldRule(field, obj[field], rule);
    if (findingForRule) findings.push(findingForRule);
  }

  // Closed-schema extra-key check.
  if (schema.closed) {
    const allowed = new Set([
      ...Object.keys(schema.required ?? {}),
      ...Object.keys(schema.optional ?? {}),
    ]);
    for (const key of Object.keys(obj)) {
      if (!allowed.has(key)) {
        findings.push({
          validatorId: 'contract_schema_validator',
          severity: 'LOW',
          type: 'format_violation',
          summary: `Unexpected top-level field '${key}'`,
          location: `$.${key}`,
          detail: `Field '${key}' is not declared in the contract schema.`,
          recommendation: `Remove '${key}' or update the contract.`,
        });
      }
    }
  }

  return findings;
}

function checkFieldRule(
  field: string,
  value: unknown,
  rule: FieldRule,
): ValidatorFinding | null {
  if (rule.type) {
    const actualType = getJsonType(value);
    if (actualType !== rule.type) {
      return {
        validatorId: 'contract_schema_validator',
        severity: 'MEDIUM',
        type: 'wrong_enum',
        summary: `Field '${field}' has wrong type`,
        location: `$.${field}`,
        detail: `Expected '${rule.type}', got '${actualType}'.`,
        recommendation: `Change '${field}' to a ${rule.type}.`,
      };
    }
  }
  if (rule.enum && !rule.enum.includes(value as string | number | boolean)) {
    return {
      validatorId: 'contract_schema_validator',
      severity: 'MEDIUM',
      type: 'wrong_enum',
      summary: `Field '${field}' value not in allowed enum`,
      location: `$.${field}`,
      detail: `Value '${String(value)}' must be one of: ${rule.enum.join(', ')}.`,
      recommendation: `Use one of the allowed enum values.`,
    };
  }
  return null;
}
