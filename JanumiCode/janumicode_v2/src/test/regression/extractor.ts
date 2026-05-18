/**
 * Fixture extractor. Walks a thin-slice DB and emits one fixture JSON
 * per recognized producer template.
 *
 * Variable recovery strategy: the rendered prompt is the result of
 * `{{var}}` substitution into the template body. We split the template
 * body on placeholders into static segments, then walk the rendered
 * prompt segment-by-segment to recover each variable's value.
 *
 * For variables that appear multiple times (e.g. `active_constraints`
 * in the task_skeleton template), we use the first occurrence's value
 * and verify the second occurrence aligns. If alignment fails, the
 * fixture is skipped with a clear reason.
 *
 * `janumicode_version_sha` is a frontmatter-declared required variable
 * but isn't actually referenced in the rendered body of these three
 * templates. We pass through the empty string for it.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';

import { FixtureSchema, type Fixture } from './fixtureSchema.js';
import { getTemplateLoader, SOURCE_ROOT } from './runner.js';
import { FIXTURE_DIR } from './loadFixtures.js';

export interface ExtractOptions {
  dbPath: string;
  outputDir?: string;
  templates?: string[];
  workflowRunId?: string;
  /** Sample slug suffix appended after `<prompt_id>__`. Default `tinyurl-001`. */
  sampleSlug?: string;
  /** Overwrite existing fixtures. Default false (skip if file exists). */
  overwrite?: boolean;
}

export interface ExtractResult {
  written: string[];
  skipped: { reason: string; sub_phase: string }[];
}

// ── Producer template map ───────────────────────────────────────────

interface ProducerSpec {
  /** Sub-phase id used in the agent_invocation record. */
  sub_phase: string;
  /** Agent role expected on the invocation. */
  agent_role: string;
  /** prompt_id prefix used in fixture_id naming. */
  fixture_prefix: string;
  /** Optional lens discriminator. */
  lens?: string;
  /** Description for the fixture. */
  description: string;
  /**
   * Ordered list of (variable, before, after) markers used to slice
   * variable values directly out of the rendered prompt. Used as a
   * fallback when literal-segment back-substitution fails because the
   * template body has drifted since the historical run.
   *
   * `after` may be the empty string, meaning "to end of prompt".
   */
  landmarks?: Array<{ variable: string; before: string; after: string }>;
  /**
   * Match invocation by `content.label` instead of sub_phase_id. Used for
   * cross-cutting templates (e.g., DMR Stage 7) that fire under many
   * different host sub_phases but share a stable label.
   */
  match_label?: string;
}

const PRODUCERS: ProducerSpec[] = [
  {
    sub_phase: 'task_skeleton',
    agent_role: 'implementation_planner',
    fixture_prefix: 'phase06_task_skeleton',
    description: 'Phase 6.1 implementation task decomposition: per-component task array with completion criteria + traces_to back to system requirements and components.',
    landmarks: [
      { variable: 'active_constraints', before: '# Active constraints\n', after: '\n\n# Component Model Summary' },
      { variable: 'component_model_summary', before: '# Component Model Summary\n', after: '\n\n# Technical Specifications Summary' },
      { variable: 'technical_specs_summary', before: '# Technical Specifications Summary\n', after: '\n\n# Detail file path' },
      { variable: 'detail_file_path', before: 'DETAIL FILE PATH (reference only): ', after: '\n\nDEEP MEMORY RESEARCH CONTEXT' },
      { variable: 'detail_file_content', before: 'completeness assessment that govern this sub-phase):\n\n', after: '' },
    ],
  },
  {
    sub_phase: 'data_model_skeleton',
    agent_role: 'technical_spec_agent',
    fixture_prefix: 'phase05_data_model_skeleton',
    description: 'Phase 5.1 data model specification: per-component entity definitions with typed fields and relationships.',
    landmarks: [
      { variable: 'active_constraints', before: 'GOVERNING CONSTRAINTS (apply without exception):\n', after: '\n\nProduce [JC:Data Models]' },
      { variable: 'system_requirements_summary', before: 'System Requirements (Phase 3.2 — what each entity must support): ', after: '\nComponent Model: ' },
      { variable: 'component_model_summary', before: '\nComponent Model: ', after: '\nSoftware Domains: ' },
      { variable: 'software_domains_summary', before: '\nSoftware Domains: ', after: '\n\nDETAIL FILE PATH' },
      { variable: 'detail_file_path', before: 'DETAIL FILE PATH (reference only): ', after: '\n\nDEEP MEMORY RESEARCH CONTEXT' },
      { variable: 'detail_file_content', before: 'completeness assessment that govern this sub-phase):\n\n', after: '' },
    ],
  },
  {
    sub_phase: 'fr_bloom_skeleton',
    agent_role: 'requirements_agent',
    fixture_prefix: 'phase02_fr_bloom_skeleton',
    lens: 'product',
    description: 'Phase 2.1 FR skeleton bloom: user stories with acceptance criteria, role/action/outcome, traces_to journeys / entities / vocabulary.',
    landmarks: [
      { variable: 'active_constraints', before: 'GOVERNING CONSTRAINTS (apply without exception):\n', after: '\n' },
      { variable: 'product_vision', before: '# Product Vision\n', after: '\n\n# Intent Statement' },
      { variable: 'intent_statement_summary', before: '# Intent Statement\n', after: '\n\n# Accepted Journeys' },
      { variable: 'accepted_journeys', before: '# Accepted Journeys (user-facing flows)\n', after: '\n\n# Accepted Entities' },
      { variable: 'accepted_entities', before: '# Accepted Entities (data the product operates on)\n', after: '\n\n# Accepted Workflows' },
      { variable: 'accepted_workflows', before: '# Accepted Workflows (system automations)\n', after: '\n\n# Compliance Extracted Items' },
      { variable: 'compliance_extracted_items', before: '# Compliance Extracted Items (regulatory / retention / audit obligations)\n', after: '\n\n# Canonical Vocabulary' },
      { variable: 'canonical_vocabulary', before: '# Canonical Vocabulary (use these terms verbatim)\n', after: '\n\n# Open Questions' },
      { variable: 'open_questions', before: '# Open Questions (resolve or explicitly re-flag)\n', after: '\n\n# Detail File' },
      { variable: 'detail_file_path', before: 'DETAIL FILE PATH (reference only): ', after: '\n\nDEEP MEMORY RESEARCH CONTEXT' },
      { variable: 'detail_file_content', before: 'completeness assessment that govern this sub-phase):\n\n', after: '' },
    ],
  },
  {
    sub_phase: 'fr_bloom_enrichment',
    agent_role: 'requirements_agent',
    fixture_prefix: 'phase02_fr_bloom_enrichment',
    lens: 'product',
    description: 'Phase 2.1 FR acceptance-criteria enrichment (Pass 2 of 3): expand one FR skeleton into a complete measurable acceptance_criteria[] list.',
    landmarks: [
      { variable: 'active_constraints', before: 'GOVERNING CONSTRAINTS (apply without exception):\n', after: '\n\n# What\'s different' },
      { variable: 'fr_skeleton', before: '# FR Skeleton (the single FR you are enriching)\n', after: '\n\n# Traced User Journeys' },
      { variable: 'traced_journeys', before: '# Traced User Journeys (steps + their own upstream acceptance criteria)\n', after: '\n\n# Traced Entities' },
      { variable: 'traced_entities', before: '# Traced Entities (schemas / invariants)\n', after: '\n\n# Traced Workflows' },
      { variable: 'traced_workflows', before: '# Traced Workflows (system automations that this FR participates in)\n', after: '\n\n# Traced Compliance Items' },
      { variable: 'traced_compliance_items', before: '# Traced Compliance Items (regulatory / retention / audit obligations)\n', after: '\n\n# Canonical Vocabulary' },
      { variable: 'canonical_vocabulary', before: '# Canonical Vocabulary (use these terms verbatim)\n', after: '\n\n# Detail File' },
      { variable: 'detail_file_path', before: 'DETAIL FILE PATH (reference only): ', after: '\n\nDEEP MEMORY RESEARCH CONTEXT' },
      { variable: 'detail_file_content', before: 'completeness assessment that govern this sub-phase):\n\n', after: '' },
    ],
  },
  {
    sub_phase: 'nfr_bloom_skeleton',
    agent_role: 'requirements_agent',
    fixture_prefix: 'phase02_nfr_bloom_skeleton',
    lens: 'product',
    description: 'Phase 2.2 NFR skeleton bloom (Pass 1 of 3): id / category / description / priority / traces_to + one-line seed_threshold per NFR, covering every V&V requirement and material compliance item.',
    landmarks: [
      { variable: 'active_constraints', before: 'GOVERNING CONSTRAINTS (apply without exception):\n', after: '\n\n# What\'s different' },
      { variable: 'intent_statement_summary', before: '# Intent Statement Summary\n', after: '\n\n# Functional Requirements (from Sub-Phase 2.1' },
      { variable: 'functional_requirements_summary', before: '# Functional Requirements (from Sub-Phase 2.1 — do not duplicate; may appear in applies_to_requirements)\n', after: '\n\n# Accepted User Journeys' },
      { variable: 'accepted_journeys', before: '# Do NOT mint UJ-* ids that are not in this list; the self-heal filter silently drops fabricated refs.\n', after: '\n\n# Quality Attributes' },
      { variable: 'quality_attributes', before: '# Quality Attributes (free-prose NFR seeds)\n', after: '\n\n# V&V Requirements' },
      { variable: 'vv_requirements', before: '# V&V Requirements (structured target + measurement + threshold seeds — MUST be covered)\n', after: '\n\n# Technical Constraints' },
      { variable: 'technical_constraints', before: '# Technical Constraints (CONTEXT only — do not re-propose)\n', after: '\n\n# Compliance Extracted Items' },
      { variable: 'compliance_extracted_items', before: '# Compliance Extracted Items (MUST be covered — each material item spawns ≥1 NFR)\n', after: '\n\n# Detail File' },
      { variable: 'detail_file_path', before: 'DETAIL FILE PATH (reference only): ', after: '\n\nDEEP MEMORY RESEARCH CONTEXT' },
      { variable: 'detail_file_content', before: 'completeness assessment that govern this sub-phase):\n\n', after: '' },
    ],
  },
  {
    sub_phase: 'nfr_bloom_enrichment',
    agent_role: 'requirements_agent',
    fixture_prefix: 'phase02_nfr_bloom_enrichment',
    lens: 'product',
    description: 'Phase 2.2 NFR threshold + measurement enrichment (Pass 2 of 3): expand one NFR skeleton into a complete measurable NFR with threshold and measurement_method.',
    landmarks: [
      { variable: 'active_constraints', before: 'GOVERNING CONSTRAINTS (apply without exception):\n', after: '\n\n# What\'s different' },
      { variable: 'nfr_skeleton', before: '# NFR Skeleton (the single NFR you are enriching)\n', after: '\n\n# Traced V&V Requirements' },
      { variable: 'traced_vv_requirements', before: '# Traced V&V Requirements (structured target + measurement + threshold — PRIMARY grounding source)\n', after: '\n\n# Traced Quality Attributes' },
      { variable: 'traced_quality_attributes', before: '# Traced Quality Attributes (free-prose NFR seeds)\n', after: '\n\n# Traced Technical Constraints' },
      { variable: 'traced_technical_constraints', before: '# Traced Technical Constraints (CONTEXT only — do not re-propose)\n', after: '\n\n# Traced Compliance Items' },
      { variable: 'traced_compliance_items', before: '# Traced Compliance Items (retention / audit / regulatory obligations)\n', after: '\n\n# Detail File' },
      { variable: 'detail_file_path', before: 'DETAIL FILE PATH (reference only): ', after: '\n\nDEEP MEMORY RESEARCH CONTEXT' },
      { variable: 'detail_file_content', before: 'completeness assessment that govern this sub-phase):\n\n', after: '' },
    ],
  },
  {
    sub_phase: 'system_boundary',
    agent_role: 'systems_agent',
    fixture_prefix: 'phase03_system_boundary',
    description: 'Phase 3.1 system boundary definition: in_scope / out_of_scope capabilities and external_systems with interface_type, covering every FR.',
    landmarks: [
      { variable: 'active_constraints', before: 'GOVERNING CONSTRAINTS (apply without exception):\n', after: '\n\nDefine the [JC:System Boundary]' },
      { variable: 'intent_statement_summary', before: '\nIntent: ', after: '\nFunctional Requirements: ' },
      { variable: 'functional_requirements_summary', before: '\nFunctional Requirements: ', after: '\nNon-Functional Requirements: ' },
      { variable: 'non_functional_requirements_summary', before: '\nNon-Functional Requirements: ', after: '\n\nDETAIL FILE PATH' },
      { variable: 'detail_file_path', before: 'DETAIL FILE PATH (reference only): ', after: '\n\nDEEP MEMORY RESEARCH CONTEXT' },
      { variable: 'detail_file_content', before: 'completeness assessment that govern this sub-phase):\n\n', after: '\n\n# Hard rules — source-item enumeration discipline' },
    ],
  },
  {
    sub_phase: 'software_domains',
    agent_role: 'architecture_agent',
    fixture_prefix: 'phase04_software_domains',
    description: 'Phase 4.1 software domains: identify cohesive bounded contexts with id / name / ubiquitous_language / system_requirement_ids covering every input SR.',
    landmarks: [
      { variable: 'active_constraints', before: 'GOVERNING CONSTRAINTS (apply without exception):\n', after: '\n\nIdentify [JC:Software Domains]' },
      { variable: 'system_boundary_summary', before: '\nSystem Boundary: ', after: '\nSystem Requirements: ' },
      { variable: 'system_requirements_summary', before: '\nSystem Requirements: ', after: '\n\nDETAIL FILE PATH' },
      { variable: 'detail_file_path', before: 'DETAIL FILE PATH (reference only): ', after: '\n\nDEEP MEMORY RESEARCH CONTEXT' },
      { variable: 'detail_file_content', before: 'completeness assessment that govern this sub-phase):\n\n', after: '' },
    ],
  },
  {
    sub_phase: 'component_skeleton',
    agent_role: 'architecture_agent',
    fixture_prefix: 'phase04_component_skeleton',
    description: 'Phase 4.2 component decomposition: components with id / name / domain_id / responsibilities (atomic statements) / dependencies, covering every SR.',
    landmarks: [
      { variable: 'active_constraints', before: 'GOVERNING CONSTRAINTS (apply without exception):\n', after: '\n\nDecompose the system into [JC:Components]' },
      { variable: 'software_domains_summary', before: '\nSoftware Domains: ', after: '\nSystem Requirements: ' },
      { variable: 'system_requirements_summary', before: '\nSystem Requirements: ', after: '' },
    ],
  },
  {
    sub_phase: 'adr_capture',
    agent_role: 'architecture_agent',
    fixture_prefix: 'phase04_adr_capture',
    description: 'Phase 4.3 architectural decision records: id / title / status / context / decision / alternatives / rationale / consequences for every significant choice.',
    landmarks: [
      { variable: 'active_constraints', before: 'GOVERNING CONSTRAINTS (apply without exception):\n', after: '\n\nProduce [JC:Architectural Decision Records]' },
      { variable: 'component_model_summary', before: '\nComponent Model: ', after: '\nSoftware Domains: ' },
      { variable: 'software_domains_summary', before: '\nSoftware Domains: ', after: '' },
    ],
  },
  {
    sub_phase: 'api_definitions',
    agent_role: 'technical_spec_agent',
    fixture_prefix: 'phase05_api_definitions',
    description: 'Phase 5.2 API definitions: per-component endpoint contracts with path / method / inputs / outputs / error_codes / auth_requirement aligned with interface contracts.',
    landmarks: [
      { variable: 'active_constraints', before: 'GOVERNING CONSTRAINTS (apply without exception):\n', after: '\n\nProduce [JC:API Definitions]' },
      { variable: 'system_requirements_summary', before: '\nSystem Requirements (Phase 3.2 — what each endpoint must support): ', after: '\nComponent Model: ' },
      { variable: 'component_model_summary', before: '\nComponent Model: ', after: '\nInterface Contracts: ' },
      { variable: 'interface_contracts_summary', before: '\nInterface Contracts: ', after: '' },
    ],
  },
  {
    sub_phase: 'error_handling',
    agent_role: 'technical_spec_agent',
    fixture_prefix: 'phase05_error_handling',
    description: 'Phase 5.3 error handling strategies: per-component error_types / detection / response / surfacing classified with source-attested error names.',
    landmarks: [
      { variable: 'active_constraints', before: 'GOVERNING CONSTRAINTS (apply without exception):\n', after: '\n\nProduce [JC:Error Handling Strategies]' },
      { variable: 'system_requirements_summary', before: '\nSystem Requirements (Phase 3.2 — error-handling expectations from each SR): ', after: '\nComponent Model: ' },
      { variable: 'component_model_summary', before: '\nComponent Model: ', after: '\nAPI Definitions: ' },
      { variable: 'api_definitions_summary', before: '\nAPI Definitions: ', after: '' },
    ],
  },
  {
    sub_phase: 'test_case_skeleton',
    agent_role: 'test_design_agent',
    fixture_prefix: 'phase07_test_case_skeleton',
    description: 'Phase 7.1 test case generation: per-component test_suites with test_cases binding acceptance_criterion_ids, preconditions, expected_outcome.',
    landmarks: [
      { variable: 'active_constraints', before: 'GOVERNING CONSTRAINTS (apply without exception):\n', after: '\n\nGenerate structured [JC:Test Case]' },
      { variable: 'functional_requirements_summary', before: '\nFunctional Requirements: ', after: '\nImplementation Plan: ' },
      { variable: 'implementation_plan_summary', before: '\nImplementation Plan: ', after: '\nComponent Model: ' },
      { variable: 'component_model_summary', before: '\nComponent Model: ', after: '\n\nDETAIL FILE PATH' },
      { variable: 'detail_file_path', before: 'DETAIL FILE PATH (reference only): ', after: '\n\nDEEP MEMORY RESEARCH CONTEXT' },
      { variable: 'detail_file_content', before: 'completeness assessment that govern this sub-phase):\n\n', after: '' },
    ],
  },
  {
    sub_phase: 'evaluation_design',
    agent_role: 'eval_design_agent',
    fixture_prefix: 'phase08_evaluation_design',
    description: 'Phase 8.1 evaluation design: functional_evaluation_plan, quality_evaluation_plan (per-NFR), reasoning_evaluation_plan with grounded FR/NFR id citations.',
    landmarks: [
      { variable: 'active_constraints', before: 'GOVERNING CONSTRAINTS (apply without exception):\n', after: '\n\nDesign evaluation criteria' },
      { variable: 'functional_requirements_summary', before: '\nFunctional Requirements (FR / user-story IDs you may cite): ', after: '\nNon-Functional Requirements (NFR IDs you may cite): ' },
      { variable: 'non_functional_requirements_summary', before: '\nNon-Functional Requirements (NFR IDs you may cite): ', after: '\nTest Plan (read-only — do not duplicate): ' },
      { variable: 'test_plan_summary', before: '\nTest Plan (read-only — do not duplicate): ', after: '\nCompliance: ' },
      { variable: 'compliance_context_summary', before: '\nCompliance: ', after: '' },
    ],
  },
  // ── Phase 1 producers (Tier D) ────────────────────────────────────
  {
    sub_phase: 'product_intent_discovery',
    agent_role: 'domain_interpreter',
    fixture_prefix: 'phase01_product_intent_discovery',
    lens: 'product',
    description: 'Phase 1.0b product intent discovery: extract vision / description / personas / user_journeys / phasing_strategy / requirements / decisions / constraints / open_questions from raw intent (product lens slice).',
  },
  {
    sub_phase: 'intent_lens_classification',
    agent_role: 'orchestrator',
    fixture_prefix: 'phase01_intent_lens_classification',
    description: 'Phase 1.0a intent lens classification: classify raw intent into a single lens (product|feature|content|automation) with confidence + rationale.',
  },
  {
    sub_phase: 'canonical_vocabulary_discovery',
    agent_role: 'domain_interpreter',
    fixture_prefix: 'phase01_canonical_vocabulary_discovery',
    lens: 'product',
    description: 'Phase 1.0f canonical vocabulary discovery: extract domain-specific terms with id / term / definition / synonyms / source_ref from raw intent.',
  },
  {
    sub_phase: 'compliance_retention_discovery',
    agent_role: 'domain_interpreter',
    fixture_prefix: 'phase01_compliance_retention_discovery',
    lens: 'product',
    description: 'Phase 1.0d compliance & retention discovery: extract regulatory regimes, retention obligations, audit requirements with id / type / text / source_ref.',
  },
  {
    sub_phase: 'technical_constraints_discovery',
    agent_role: 'domain_interpreter',
    fixture_prefix: 'phase01_technical_constraints_discovery',
    lens: 'product',
    description: 'Phase 1.0c technical constraints discovery: extract stated stack / infra / security / deployment constraints with id / category / text / technology / source_ref.',
  },
  {
    sub_phase: 'vv_requirements_discovery',
    agent_role: 'domain_interpreter',
    fixture_prefix: 'phase01_vv_requirements_discovery',
    lens: 'product',
    description: 'Phase 1.0e V&V requirements discovery: extract measurable performance / availability / reliability targets with id / category / target / measurement / threshold / source_ref.',
  },
  {
    sub_phase: 'business_domains_bloom',
    agent_role: 'domain_interpreter',
    fixture_prefix: 'phase01_business_domains_bloom',
    lens: 'product',
    description: 'Phase 1.2 business domains & personas bloom: produce domains[] with entity / workflow previews and an enriched personas[] aligned to product vision and discovered journeys.',
  },
  {
    sub_phase: 'user_journey_bloom',
    agent_role: 'domain_interpreter',
    fixture_prefix: 'phase01_user_journey_bloom',
    lens: 'product',
    description: 'Phase 1.3a user journey bloom: expand journeys with steps, business_domain_ids, surfaces (compliance/retention/V&V/integrations), priority + phase.',
  },
  {
    sub_phase: 'system_workflow_bloom',
    agent_role: 'domain_interpreter',
    fixture_prefix: 'phase01_system_workflow_bloom',
    lens: 'product',
    description: 'Phase 1.3b system workflow bloom: derive system workflows (automations) backing user-journey steps, with triggers / actors / surfaces and a step_backing_map.',
  },
  {
    sub_phase: 'entities_bloom',
    agent_role: 'domain_interpreter',
    fixture_prefix: 'phase01_entities_bloom',
    lens: 'product',
    description: 'Phase 1.4 entities bloom: enumerate data entities with id / businessDomainId / keyAttributes / relationships covering accepted domains / workflows / journeys.',
  },
  {
    sub_phase: 'integrations_qa_bloom',
    agent_role: 'domain_interpreter',
    fixture_prefix: 'phase01_integrations_qa_bloom',
    lens: 'product',
    description: 'Phase 1.5 integrations & QA bloom: integrations[] (third-party systems with category / ownershipModel) + qualityAttributes seeds.',
  },
  {
    sub_phase: 'intent_quality_check',
    agent_role: 'orchestrator',
    fixture_prefix: 'phase01_intent_quality_check',
    description: 'Phase 1.0 intent quality check: completeness / consistency / coherence findings on raw intent with overall_status and system_proposal_offered_for.',
  },
  {
    sub_phase: 'product_description_synthesis',
    agent_role: 'domain_interpreter',
    fixture_prefix: 'phase01_product_description_synthesis',
    lens: 'product',
    description: 'Phase 1.6 product description narrative refinement: refined product_vision / product_description / summary plus open_loops with category / priority.',
  },
  {
    sub_phase: 'release_plan',
    agent_role: 'orchestrator',
    fixture_prefix: 'phase01_release_plan',
    lens: 'product',
    description: 'Phase 1.8 release plan v2 proposer (narrow scope): releases[] (release_id / ordinal / name / description / rationale / contains_journeys) ordered by ordinal.',
  },
  // ── Cross-cutting DMR Stage 7 (Tier C) ────────────────────────────
  {
    sub_phase: 'deep_memory_context_packet_synthesis',
    agent_role: 'deep_memory_research',
    fixture_prefix: 'cross_cutting_dmr_context_packet_synthesis',
    match_label: 'DMR Stage 7 — Context Packet Synthesis',
    description: 'Cross-cutting DMR Stage 7 — Context Packet Synthesis: synthesize material findings, supersession chains, contradictions, and coverage into a structured Context Packet with active_constraints (Authority Level 6+) cited by source_record_ids.',
  },
];

function recoverVariablesWithFallback(
  templateBody: string,
  prompt: string,
  producer: ProducerSpec,
): { vars: Record<string, string> } | { error: string } {
  const recovery = recoverVariables(templateBody, prompt);
  if (!('error' in recovery)) return { vars: recovery.vars };
  if (!producer.landmarks) {
    return { error: `variable recovery failed and no landmarks defined: ${recovery.error}` };
  }
  const lmResult = extractByLandmarks(prompt, producer.landmarks);
  if ('error' in lmResult) {
    return { error: `landmark extraction failed (back-sub also failed: ${recovery.error}): ${lmResult.error}` };
  }
  return { vars: lmResult.vars };
}

function extractByLandmarks(
  rendered: string,
  landmarks: NonNullable<ProducerSpec['landmarks']>,
): { vars: Record<string, string> } | { error: string } {
  const vars: Record<string, string> = {};
  for (const lm of landmarks) {
    const beforeIdx = rendered.indexOf(lm.before);
    if (beforeIdx === -1) {
      return { error: `landmark "before" not found for variable "${lm.variable}": ${JSON.stringify(lm.before.slice(0, 60))}` };
    }
    const start = beforeIdx + lm.before.length;
    if (lm.after === '') {
      vars[lm.variable] = rendered.slice(start);
    } else {
      const afterIdx = rendered.indexOf(lm.after, start);
      if (afterIdx === -1) {
        return { error: `landmark "after" not found for variable "${lm.variable}": ${JSON.stringify(lm.after.slice(0, 60))}` };
      }
      vars[lm.variable] = rendered.slice(start, afterIdx);
    }
  }
  return { vars };
}

// ── Template variable recovery ──────────────────────────────────────

interface TemplateSegment {
  kind: 'literal' | 'placeholder';
  /** literal text or variable name */
  value: string;
}

/**
 * Tokenize a template body into a sequence of literal and placeholder
 * segments. Adjacent literals are merged.
 */
function tokenizeTemplate(body: string): TemplateSegment[] {
  const segments: TemplateSegment[] = [];
  const re = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    if (m.index > cursor) {
      segments.push({ kind: 'literal', value: body.slice(cursor, m.index) });
    }
    segments.push({ kind: 'placeholder', value: m[1] });
    cursor = re.lastIndex;
  }
  if (cursor < body.length) {
    segments.push({ kind: 'literal', value: body.slice(cursor) });
  }
  return segments;
}

/**
 * Walk the rendered prompt using the template's segment structure,
 * extracting each variable's value. Returns null on alignment failure.
 */
export function recoverVariables(
  templateBody: string,
  rendered: string,
): { vars: Record<string, string>; warning?: string } | { error: string } {
  const segments = tokenizeTemplate(templateBody);
  if (segments.length === 0) return { vars: {} };

  // Anchor each literal segment in the rendered prompt sequentially.
  const vars: Record<string, string> = {};
  let pos = 0;
  let warning: string | undefined;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.kind === 'literal') {
      const idx = rendered.indexOf(seg.value, pos);
      if (idx === -1) {
        return {
          error: `template literal segment not found in rendered prompt; segment[${i}] preview: "${seg.value.slice(0, 80).replace(/\n/g, '\\n')}"`,
        };
      }
      if (i > 0 && segments[i - 1].kind === 'placeholder') {
        const placeholder = segments[i - 1];
        const value = rendered.slice(pos, idx);
        const existing = vars[placeholder.value];
        if (existing !== undefined && existing !== value) {
          warning = `variable "${placeholder.value}" appears multiple times with differing extracted values; using first.`;
        } else {
          vars[placeholder.value] = value;
        }
      }
      pos = idx + seg.value.length;
    } else if (i === segments.length - 1) {
      // Template ends with a placeholder — everything from cursor to end.
      const value = rendered.slice(pos);
      if (vars[seg.value] === undefined) vars[seg.value] = value;
      pos = rendered.length;
    }
  }

  return { vars, warning };
}

// ── DB helpers ──────────────────────────────────────────────────────

interface InvocationRow {
  id: string;
  workflow_run_id: string;
  phase_id: string | null;
  sub_phase_id: string | null;
  produced_by_agent_role: string | null;
  content: string;
}
interface OutputRow {
  id: string;
  content: string;
}

function pickWorkflowRunId(db: Database.Database, requested?: string): string {
  if (requested) return requested;
  const row = db.prepare(
    `SELECT id FROM workflow_runs ORDER BY rowid DESC LIMIT 1`,
  ).get() as { id: string } | undefined;
  if (!row) throw new Error('No workflow_runs found in DB');
  return row.id;
}

function findInvocation(
  db: Database.Database,
  workflowRunId: string,
  producer: ProducerSpec,
): InvocationRow | null {
  let rows: InvocationRow[];
  if (producer.match_label) {
    rows = db.prepare(
      `SELECT id, workflow_run_id, phase_id, sub_phase_id, produced_by_agent_role, content
       FROM governed_stream
       WHERE record_type = 'agent_invocation'
         AND workflow_run_id = ?
         AND produced_by_agent_role = ?
         AND json_extract(content, '$.label') = ?
       ORDER BY produced_at ASC`,
    ).all(workflowRunId, producer.agent_role, producer.match_label) as InvocationRow[];
  } else {
    rows = db.prepare(
      `SELECT id, workflow_run_id, phase_id, sub_phase_id, produced_by_agent_role, content
       FROM governed_stream
       WHERE record_type = 'agent_invocation'
         AND workflow_run_id = ?
         AND sub_phase_id = ?
         AND produced_by_agent_role = ?
       ORDER BY produced_at ASC`,
    ).all(workflowRunId, producer.sub_phase, producer.agent_role) as InvocationRow[];
  }
  // First non-harness, non-error invocation.
  return rows.find((r) => {
    try {
      const c = JSON.parse(r.content);
      return c.status !== 'error';
    } catch {
      return false;
    }
  }) ?? rows[0] ?? null;
}

function findOutput(db: Database.Database, invocationId: string): OutputRow | null {
  const rows = db.prepare(
    `SELECT id, content FROM governed_stream
     WHERE record_type = 'agent_output'
       AND derived_from_record_ids LIKE ?
     ORDER BY produced_at ASC`,
  ).all(`%${invocationId}%`) as OutputRow[];
  return rows[0] ?? null;
}

// ── Main extract ────────────────────────────────────────────────────

export async function extract(opts: ExtractOptions): Promise<ExtractResult> {
  const outDir = opts.outputDir ?? FIXTURE_DIR;
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const sampleSlug = opts.sampleSlug ?? 'tinyurl-001';

  const db = new Database(opts.dbPath, { readonly: true });
  db.pragma('journal_mode = WAL');

  const workflowRunId = pickWorkflowRunId(db, opts.workflowRunId);
  const loader = getTemplateLoader();

  const producers = opts.templates
    ? PRODUCERS.filter((p) => opts.templates!.includes(p.sub_phase))
    : PRODUCERS;

  const written: string[] = [];
  const skipped: { reason: string; sub_phase: string }[] = [];

  for (const producer of producers) {
    try {
      const tpl = loader.findTemplate(producer.agent_role, producer.sub_phase, producer.lens);
      if (!tpl) {
        skipped.push({ reason: `no template found for agent_role=${producer.agent_role} sub_phase=${producer.sub_phase}${producer.lens ? ` lens=${producer.lens}` : ''}`, sub_phase: producer.sub_phase });
        continue;
      }
      const invocation = findInvocation(db, workflowRunId, producer);
      if (!invocation) {
        skipped.push({ reason: `no matching agent_invocation in run ${workflowRunId}`, sub_phase: producer.sub_phase });
        continue;
      }
      const invocationContent = JSON.parse(invocation.content);
      const output = findOutput(db, invocation.id);
      if (!output) {
        skipped.push({ reason: `no agent_output found for invocation ${invocation.id}`, sub_phase: producer.sub_phase });
        continue;
      }
      const outputContent = JSON.parse(output.content);

      // makeLLMValidator templates: invocation records BOTH `system`
      // (rendered template) and `prompt` (audit material). For these,
      // align against the rendered system and capture prompt as
      // user_message. Standard producers store only `prompt` (which IS
      // the rendered template).
      const invocationSystem: string = invocationContent.system ?? '';
      const invocationPrompt: string = invocationContent.prompt ?? '';
      const usesSeparateUserMessage = invocationSystem.length > 0;
      const alignmentTarget = usesSeparateUserMessage ? invocationSystem : invocationPrompt;
      const varResult = recoverVariablesWithFallback(tpl.body, alignmentTarget, producer);
      if ('error' in varResult) {
        skipped.push({ reason: varResult.error, sub_phase: producer.sub_phase });
        continue;
      }
      const vars = varResult.vars;
      // Ensure all required variables present (default missing to '').
      for (const req of tpl.metadata.required_variables) {
        if (!(req in vars)) vars[req] = '';
      }

      const fixture: Fixture = {
        fixture_id: `${producer.fixture_prefix}__${sampleSlug}`,
        description: producer.description,
        extracted_from_run: workflowRunId,
        extracted_from_db: opts.dbPath.replace(/\\/g, '/'),
        extracted_at: new Date().toISOString(),
        template_ref: {
          agent_role: producer.agent_role,
          sub_phase: producer.sub_phase,
          ...(producer.lens ? { lens: producer.lens } : {}),
        },
        invocation_params: {
          provider: invocationContent.provider ?? 'ollama',
          model: invocationContent.model ?? 'qwen3.5:9b',
          temperature: invocationContent.temperature ?? 0.4,
          response_format: invocationContent.response_format ?? 'json',
        },
        template_variables: vars,
        ...(usesSeparateUserMessage ? { user_message: invocationPrompt } : {}),
        baseline: {
          response_text: outputContent.text ?? '',
          parsed_json: tryParse(outputContent.text ?? ''),
          duration_ms: outputContent.duration_ms ?? 0,
          thinking: outputContent.thinking ?? undefined,
        },
        assertions: assertionsFor(producer.sub_phase),
      };

      const validated = FixtureSchema.safeParse(fixture);
      if (!validated.success) {
        const issues = validated.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
        skipped.push({ reason: `fixture validation failed: ${issues}`, sub_phase: producer.sub_phase });
        continue;
      }

      const outPath = join(outDir, `${fixture.fixture_id}.fixture.json`);
      if (existsSync(outPath) && !opts.overwrite) {
        skipped.push({ reason: `fixture file already exists at ${outPath} (use --overwrite)`, sub_phase: producer.sub_phase });
        continue;
      }
      writeFileSync(outPath, JSON.stringify(validated.data, null, 2) + '\n', 'utf-8');
      written.push(outPath);
    } catch (err) {
      skipped.push({
        reason: `unexpected error: ${err instanceof Error ? err.message : String(err)}`,
        sub_phase: producer.sub_phase,
      });
    }
  }

  db.close();
  return { written, skipped };
}

function tryParse(text: string): unknown | null {
  try {
    // Strip leading code-fence if present.
    const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

// ── Hand-authored per-template assertion blocks ─────────────────────

import type { AssertionBlock } from './fixtureSchema.js';

function assertionsFor(subPhase: string): AssertionBlock {
  switch (subPhase) {
    case 'task_skeleton':
      return {
        require_json_parse: true,
        t1_schema: {
          kind: 'json-shape',
          shape: {
            'tasks': 'array',
            'tasks[].id': 'string',
            'tasks[].name': 'string',
            'tasks[].component_id': 'string',
            'tasks[].completion_criteria': 'array',
            'tasks[].completion_criteria[].criterion_id': 'string',
            'tasks[].traces_to': 'array',
          },
        },
        t2_id_preservation: [
          {
            name: 'every input component_id appears as some task.component_id',
            input_source: {
              variable: 'component_model_summary',
              // Component slugs like `comp-link-mapping-repository`.
              id_pattern: 'comp-[a-z0-9][a-z0-9-]*',
            },
            output_assertion: {
              mode: 'all_in_field',
              path: 'tasks[].component_id',
              min_match_ratio: 1.0,
            },
          },
        ],
        t3_invariants: [
          {
            name: 'tasks array non-empty',
            kind: 'array_length',
            path: 'tasks',
            min: 1,
          },
          {
            name: 'tasks[].id follows task-<slug> pattern',
            kind: 'required_value_pattern',
            path: 'tasks[].id',
            pattern: '^task-[a-z0-9][a-z0-9-]*$',
          },
          {
            name: 'tasks[].traces_to non-empty',
            kind: 'array_length',
            path: 'tasks[].traces_to',
            min: 1,
          },
        ],
      };
    case 'data_model_skeleton':
      return {
        require_json_parse: true,
        t1_schema: {
          kind: 'json-shape',
          shape: {
            'models': 'array',
            'models[].component_id': 'string',
            'models[].entities': 'array',
            'models[].entities[].name': 'string',
            'models[].entities[].fields': 'array',
            'models[].entities[].fields[].name': 'string',
            'models[].entities[].fields[].type': 'string',
          },
        },
        t2_id_preservation: [
          {
            name: 'every input component_id appears as some model.component_id',
            input_source: {
              variable: 'component_model_summary',
              id_pattern: 'comp-[a-z0-9][a-z0-9-]*',
            },
            output_assertion: {
              mode: 'all_in_field',
              path: 'models[].component_id',
              min_match_ratio: 1.0,
            },
          },
        ],
        t3_invariants: [
          {
            name: 'models array non-empty',
            kind: 'array_length',
            path: 'models',
            min: 1,
          },
          {
            name: 'field types use concrete primitives',
            kind: 'enum_subset',
            path: 'models[].entities[].fields[].type',
            allowed: [
              'string', 'integer', 'boolean', 'timestamp', 'uuid',
              'jsonb', 'text', 'decimal', 'numeric', 'float', 'datetime',
              'date', 'bigint', 'smallint', 'json', 'bytes', 'blob',
              'array', 'enum',
            ],
          },
        ],
      };
    case 'fr_bloom_skeleton':
      return {
        require_json_parse: true,
        t1_schema: {
          kind: 'json-shape',
          shape: {
            'user_stories': 'array',
            'user_stories[].id': 'string',
            'user_stories[].role': 'string',
            'user_stories[].action': 'string',
            'user_stories[].outcome': 'string',
            'user_stories[].acceptance_criteria': 'array',
            'user_stories[].acceptance_criteria[].id': 'string',
            'user_stories[].acceptance_criteria[].description': 'string',
            'user_stories[].traces_to': 'array',
          },
        },
        t2_id_preservation: [],
        t3_invariants: [
          {
            name: 'user_stories array non-empty',
            kind: 'array_length',
            path: 'user_stories',
            min: 1,
          },
          {
            name: 'user_stories[].id matches US-NNN',
            kind: 'required_value_pattern',
            path: 'user_stories[].id',
            pattern: '^US-[0-9]+$',
          },
          {
            name: 'user_stories[].traces_to non-empty',
            kind: 'array_length',
            path: 'user_stories[].traces_to',
            min: 1,
          },
        ],
      };
    case 'fr_bloom_enrichment':
      return {
        require_json_parse: true,
        t1_schema: {
          kind: 'json-shape',
          shape: {
            'id': 'string',
            'role': 'string',
            'action': 'string',
            'outcome': 'string',
            'priority': 'string',
            'traces_to': 'array',
            'acceptance_criteria': 'array',
            'acceptance_criteria[].id': 'string',
            'acceptance_criteria[].description': 'string',
            'acceptance_criteria[].measurable_condition': 'string',
          },
        },
        t2_id_preservation: [],
        t3_invariants: [
          { name: 'id matches US-* or FR-* pattern', kind: 'required_value_pattern', path: 'id', pattern: '^(US|FR)-[A-Z0-9.-]+$' },
          { name: 'traces_to non-empty', kind: 'array_length', path: 'traces_to', min: 1 },
          { name: 'acceptance_criteria 1..10', kind: 'array_length', path: 'acceptance_criteria', min: 1, max: 10 },
          { name: 'acceptance_criteria[].id matches AC-*', kind: 'required_value_pattern', path: 'acceptance_criteria[].id', pattern: '^AC-[A-Z0-9-]+$' },
        ],
      };
    case 'nfr_bloom_skeleton':
      return {
        require_json_parse: true,
        t1_schema: {
          kind: 'json-shape',
          shape: {
            'requirements': 'array',
            'requirements[].id': 'string',
            'requirements[].category': 'string',
            'requirements[].description': 'string',
            'requirements[].priority': 'string',
            'requirements[].traces_to': 'array',
            'requirements[].seed_threshold': 'string',
          },
        },
        t2_id_preservation: [],
        t3_invariants: [
          { name: 'requirements non-empty', kind: 'array_length', path: 'requirements', min: 1 },
          { name: 'requirements[].id matches NFR-NNN', kind: 'required_value_pattern', path: 'requirements[].id', pattern: '^NFR-[0-9]+$' },
          {
            name: 'requirements[].category in allowed set',
            kind: 'enum_subset',
            path: 'requirements[].category',
            allowed: ['performance', 'security', 'reliability', 'scalability', 'accessibility', 'maintainability', 'availability', 'durability', 'auditability', 'observability', 'compliance'],
          },
          { name: 'requirements[].priority in allowed', kind: 'enum_subset', path: 'requirements[].priority', allowed: ['critical', 'high', 'medium', 'low'] },
          { name: 'requirements[].traces_to non-empty', kind: 'array_length', path: 'requirements[].traces_to', min: 1 },
        ],
      };
    case 'nfr_bloom_enrichment':
      return {
        require_json_parse: true,
        t1_schema: {
          kind: 'json-shape',
          shape: {
            'id': 'string',
            'category': 'string',
            'description': 'string',
            'priority': 'string',
            'traces_to': 'array',
            'applies_to_requirements': 'array',
            'threshold': 'string',
            'measurement_method': 'string',
          },
        },
        t2_id_preservation: [],
        t3_invariants: [
          { name: 'id matches NFR-* pattern', kind: 'required_value_pattern', path: 'id', pattern: '^NFR-[A-Z0-9-]+$' },
          { name: 'priority in allowed', kind: 'enum_subset', path: 'priority', allowed: ['critical', 'high', 'medium', 'low'] },
          { name: 'traces_to non-empty', kind: 'array_length', path: 'traces_to', min: 1 },
          { name: 'threshold non-empty', kind: 'required_value_pattern', path: 'threshold', pattern: '.+' },
          { name: 'measurement_method non-empty', kind: 'required_value_pattern', path: 'measurement_method', pattern: '.+' },
        ],
      };
    case 'system_boundary':
      return {
        require_json_parse: true,
        t1_schema: {
          kind: 'json-shape',
          shape: {
            'in_scope': 'array',
            'in_scope[].capability': 'string',
            'in_scope[].description': 'string',
            'out_of_scope': 'array',
            'external_systems': 'array',
            'external_systems[].id': 'string',
            'external_systems[].name': 'string',
            'external_systems[].purpose': 'string',
            'external_systems[].interface_type': 'string',
          },
        },
        t2_id_preservation: [],
        t3_invariants: [
          { name: 'in_scope non-empty', kind: 'array_length', path: 'in_scope', min: 1 },
        ],
      };
    case 'software_domains':
      return {
        require_json_parse: true,
        t1_schema: {
          kind: 'json-shape',
          shape: {
            'domains': 'array',
            'domains[].id': 'string',
            'domains[].name': 'string',
            'domains[].ubiquitous_language': 'array',
            'domains[].ubiquitous_language[].term': 'string',
            'domains[].ubiquitous_language[].definition': 'string',
            'domains[].system_requirement_ids': 'array',
          },
        },
        t2_id_preservation: [
          {
            name: 'every input SR id appears in some domain.system_requirement_ids',
            input_source: { variable: 'system_requirements_summary', id_pattern: 'SR-[0-9]+' },
            output_assertion: { mode: 'all_in_field', path: 'domains[].system_requirement_ids[]', min_match_ratio: 1.0 },
          },
        ],
        t3_invariants: [
          { name: 'domains non-empty', kind: 'array_length', path: 'domains', min: 1 },
          { name: 'domains[].ubiquitous_language non-empty', kind: 'array_length', path: 'domains[].ubiquitous_language', min: 1 },
        ],
      };
    case 'component_skeleton':
      return {
        require_json_parse: true,
        t1_schema: {
          kind: 'json-shape',
          shape: {
            'components': 'array',
            'components[].id': 'string',
            'components[].name': 'string',
            'components[].domain_id': 'string',
            'components[].responsibilities': 'array',
            'components[].responsibilities[].id': 'string',
            'components[].responsibilities[].statement': 'string',
            'components[].dependencies': 'array',
          },
        },
        t2_id_preservation: [],
        t3_invariants: [
          { name: 'components non-empty', kind: 'array_length', path: 'components', min: 1 },
          { name: 'components[].responsibilities non-empty', kind: 'array_length', path: 'components[].responsibilities', min: 1 },
          { name: 'components[].id unique', kind: 'unique_values', path: 'components[].id' },
        ],
      };
    case 'adr_capture':
      return {
        require_json_parse: true,
        t1_schema: {
          kind: 'json-shape',
          shape: {
            'adrs': 'array',
            'adrs[].id': 'string',
            'adrs[].title': 'string',
            'adrs[].status': 'string',
            'adrs[].context': 'string',
            'adrs[].decision': 'string',
            'adrs[].alternatives': 'array',
            'adrs[].rationale': 'string',
            'adrs[].consequences': 'string',
          },
        },
        t2_id_preservation: [],
        t3_invariants: [
          { name: 'adrs non-empty', kind: 'array_length', path: 'adrs', min: 1 },
          { name: 'adrs[].status in allowed', kind: 'enum_subset', path: 'adrs[].status', allowed: ['proposed', 'accepted'] },
          { name: 'adrs[].alternatives non-empty', kind: 'array_length', path: 'adrs[].alternatives', min: 1 },
        ],
      };
    case 'api_definitions':
      return {
        require_json_parse: true,
        t1_schema: {
          kind: 'json-shape',
          shape: {
            'definitions': 'array',
            'definitions[].component_id': 'string',
            'definitions[].endpoints': 'array',
            'definitions[].endpoints[].path': 'string',
            'definitions[].endpoints[].method': 'string',
            'definitions[].endpoints[].auth_requirement': 'string',
            'definitions[].endpoints[].error_codes': 'array',
          },
        },
        t2_id_preservation: [],
        t3_invariants: [
          { name: 'definitions non-empty', kind: 'array_length', path: 'definitions', min: 1 },
          { name: 'endpoints non-empty per definition', kind: 'array_length', path: 'definitions[].endpoints', min: 1 },
        ],
      };
    case 'error_handling':
      return {
        require_json_parse: true,
        t1_schema: {
          kind: 'json-shape',
          shape: {
            'strategies': 'array',
            'strategies[].component_id': 'string',
            'strategies[].error_types': 'array',
            'strategies[].detection': 'string',
            'strategies[].response': 'string',
          },
        },
        t2_id_preservation: [],
        t3_invariants: [
          { name: 'strategies non-empty', kind: 'array_length', path: 'strategies', min: 1 },
          { name: 'error_types non-empty per strategy', kind: 'array_length', path: 'strategies[].error_types', min: 1 },
        ],
      };
    case 'test_case_skeleton':
      return {
        require_json_parse: true,
        t1_schema: {
          kind: 'json-shape',
          shape: {
            'test_suites': 'array',
            'test_suites[].suite_id': 'string',
            'test_suites[].component_id': 'string',
            'test_suites[].test_type': 'string',
            'test_suites[].test_cases': 'array',
            'test_suites[].test_cases[].test_case_id': 'string',
            'test_suites[].test_cases[].acceptance_criterion_ids': 'array',
            'test_suites[].test_cases[].preconditions': 'array',
            'test_suites[].test_cases[].expected_outcome': 'string',
          },
        },
        t2_id_preservation: [],
        t3_invariants: [
          { name: 'test_suites non-empty', kind: 'array_length', path: 'test_suites', min: 1 },
          {
            name: 'test_suites[].test_type in allowed',
            kind: 'enum_subset',
            path: 'test_suites[].test_type',
            allowed: ['unit', 'integration', 'end_to_end'],
          },
          { name: 'test_cases preconditions non-empty', kind: 'array_length', path: 'test_suites[].test_cases[].preconditions', min: 1 },
        ],
      };
    case 'evaluation_design':
      return {
        require_json_parse: true,
        t1_schema: {
          kind: 'json-shape',
          shape: {
            'functional_evaluation_plan': 'object',
            'functional_evaluation_plan.criteria': 'array',
            'quality_evaluation_plan': 'object',
            'quality_evaluation_plan.criteria': 'array',
            'quality_evaluation_plan.criteria[].nfr_id': 'string',
            'quality_evaluation_plan.criteria[].evaluation_tool': 'string',
            'reasoning_evaluation_plan': 'object',
            'reasoning_evaluation_plan.scenarios': 'array',
            'reasoning_evaluation_plan.ai_subsystems_detected': 'boolean',
          },
        },
        t2_id_preservation: [],
        t3_invariants: [
          { name: 'quality_evaluation_plan.criteria non-empty', kind: 'array_length', path: 'quality_evaluation_plan.criteria', min: 1 },
          {
            name: 'quality_evaluation_plan.criteria[].nfr_id matches NFR-*',
            kind: 'required_value_pattern',
            path: 'quality_evaluation_plan.criteria[].nfr_id',
            pattern: '^NFR-[A-Z0-9-]+$',
          },
          { name: 'reasoning_evaluation_plan.scenarios non-empty', kind: 'array_length', path: 'reasoning_evaluation_plan.scenarios', min: 1 },
        ],
      };
    case 'product_intent_discovery':
      return {
        require_json_parse: true,
        t1_schema: {
          kind: 'json-shape',
          shape: {
            'kind': 'string',
            'analysis_summary': 'string',
            'product_vision': 'string',
            'product_description': 'string',
            'personas': 'array',
            'personas[].id': 'string',
            'personas[].name': 'string',
            'personas[].description': 'string',
            'personas[].goals': 'array',
            'personas[].pain_points': 'array',
            'user_journeys': 'array',
            'user_journeys[].id': 'string',
            'user_journeys[].persona_id': 'string',
            'user_journeys[].title': 'string',
            'user_journeys[].steps': 'array',
            'phasing_strategy': 'array',
            'requirements': 'array',
            'decisions': 'array',
            'constraints': 'array',
            'open_questions': 'array',
          },
        },
        t2_id_preservation: [],
        t3_invariants: [
          { name: 'kind is intent_discovery', kind: 'required_value_pattern', path: 'kind', pattern: '^intent_discovery$' },
          { name: 'personas[].id pattern P-*', kind: 'required_value_pattern', path: 'personas[].id', pattern: '^P-[A-Z0-9-]+$' },
          { name: 'user_journeys[].id pattern UJ-*', kind: 'required_value_pattern', path: 'user_journeys[].id', pattern: '^UJ-[A-Z0-9-]+$' },
          { name: 'personas non-empty', kind: 'array_length', path: 'personas', min: 1 },
          { name: 'user_journeys non-empty', kind: 'array_length', path: 'user_journeys', min: 1 },
        ],
      };
    case 'intent_lens_classification':
      return {
        require_json_parse: true,
        t1_schema: {
          kind: 'json-shape',
          shape: {
            'lens': 'string',
            'confidence': 'number',
            'rationale': 'string',
          },
        },
        t2_id_preservation: [],
        t3_invariants: [
          {
            name: 'lens in allowed set',
            kind: 'enum_subset',
            path: 'lens',
            allowed: ['product', 'feature', 'content', 'automation', 'platform', 'integration'],
          },
        ],
      };
    case 'canonical_vocabulary_discovery':
      return {
        require_json_parse: true,
        t1_schema: {
          kind: 'json-shape',
          shape: {
            'kind': 'string',
            'canonicalVocabulary': 'array',
            'canonicalVocabulary[].id': 'string',
            'canonicalVocabulary[].term': 'string',
            'canonicalVocabulary[].definition': 'string',
            'canonicalVocabulary[].synonyms': 'array',
            'canonicalVocabulary[].source_ref': 'object',
          },
        },
        t2_id_preservation: [],
        t3_invariants: [
          { name: 'canonicalVocabulary non-empty', kind: 'array_length', path: 'canonicalVocabulary', min: 1 },
          { name: 'canonicalVocabulary[].id pattern VOC-*', kind: 'required_value_pattern', path: 'canonicalVocabulary[].id', pattern: '^VOC-[A-Z0-9-]+$' },
          { name: 'canonicalVocabulary[].id unique', kind: 'unique_values', path: 'canonicalVocabulary[].id' },
        ],
      };
    case 'compliance_retention_discovery':
      return {
        require_json_parse: true,
        t1_schema: {
          kind: 'json-shape',
          shape: {
            'kind': 'string',
            'compliance_extracted_items': 'array',
            'compliance_extracted_items[].id': 'string',
            'compliance_extracted_items[].type': 'string',
            'compliance_extracted_items[].text': 'string',
            'compliance_extracted_items[].source_ref': 'object',
          },
        },
        t2_id_preservation: [],
        t3_invariants: [
          { name: 'compliance_extracted_items[].id pattern COMP-*', kind: 'required_value_pattern', path: 'compliance_extracted_items[].id', pattern: '^COMP-[A-Z0-9-]+$' },
        ],
      };
    case 'technical_constraints_discovery':
      return {
        require_json_parse: true,
        t1_schema: {
          kind: 'json-shape',
          shape: {
            'kind': 'string',
            'technicalConstraints': 'array',
            'technicalConstraints[].id': 'string',
            'technicalConstraints[].category': 'string',
            'technicalConstraints[].text': 'string',
            'technicalConstraints[].source_ref': 'object',
          },
        },
        t2_id_preservation: [],
        t3_invariants: [
          { name: 'technicalConstraints[].id pattern TECH-*', kind: 'required_value_pattern', path: 'technicalConstraints[].id', pattern: '^TECH-[A-Z0-9-]+$' },
        ],
      };
    case 'vv_requirements_discovery':
      return {
        require_json_parse: true,
        t1_schema: {
          kind: 'json-shape',
          shape: {
            'kind': 'string',
            'vvRequirements': 'array',
            'vvRequirements[].id': 'string',
            'vvRequirements[].category': 'string',
            'vvRequirements[].target': 'string',
            'vvRequirements[].measurement': 'string',
            'vvRequirements[].threshold': 'string',
            'vvRequirements[].source_ref': 'object',
          },
        },
        t2_id_preservation: [],
        t3_invariants: [
          { name: 'vvRequirements[].id pattern VV-*', kind: 'required_value_pattern', path: 'vvRequirements[].id', pattern: '^VV-[A-Z0-9-]+$' },
          { name: 'vvRequirements[].id unique', kind: 'unique_values', path: 'vvRequirements[].id' },
        ],
      };
    case 'business_domains_bloom':
      return {
        require_json_parse: true,
        t1_schema: {
          kind: 'json-shape',
          shape: {
            'kind': 'string',
            'domains': 'array',
            'domains[].id': 'string',
            'domains[].name': 'string',
            'domains[].description': 'string',
            'personas': 'array',
            'personas[].id': 'string',
            'personas[].name': 'string',
          },
        },
        t2_id_preservation: [],
        t3_invariants: [
          { name: 'domains non-empty', kind: 'array_length', path: 'domains', min: 1 },
          { name: 'domains[].id pattern DOM-*', kind: 'required_value_pattern', path: 'domains[].id', pattern: '^DOM-[A-Z0-9-]+$' },
          { name: 'domains[].id unique', kind: 'unique_values', path: 'domains[].id' },
          { name: 'personas[].id pattern P-*', kind: 'required_value_pattern', path: 'personas[].id', pattern: '^P-[A-Z0-9-]+$' },
        ],
      };
    case 'user_journey_bloom':
      return {
        require_json_parse: true,
        t1_schema: {
          kind: 'json-shape',
          shape: {
            'kind': 'string',
            'user_journeys': 'array',
            'user_journeys[].id': 'string',
            'user_journeys[].persona_id': 'string',
            'user_journeys[].title': 'string',
            'user_journeys[].steps': 'array',
            'user_journeys[].steps[].step_number': 'number',
            'user_journeys[].steps[].actor': 'string',
            'user_journeys[].steps[].action': 'string',
          },
        },
        t2_id_preservation: [],
        t3_invariants: [
          { name: 'user_journeys non-empty', kind: 'array_length', path: 'user_journeys', min: 1 },
          { name: 'user_journeys[].id pattern UJ-*', kind: 'required_value_pattern', path: 'user_journeys[].id', pattern: '^UJ-[A-Z0-9-]+$' },
          { name: 'user_journeys[].id unique', kind: 'unique_values', path: 'user_journeys[].id' },
        ],
      };
    case 'system_workflow_bloom':
      return {
        require_json_parse: true,
        t1_schema: {
          kind: 'json-shape',
          shape: {
            'kind': 'string',
            'workflows': 'array',
            'workflows[].id': 'string',
            'workflows[].business_domain_id': 'string',
            'workflows[].name': 'string',
            'workflows[].steps': 'array',
            'workflows[].triggers': 'array',
            'step_backing_map': 'array',
          },
        },
        t2_id_preservation: [],
        t3_invariants: [
          { name: 'workflows non-empty', kind: 'array_length', path: 'workflows', min: 1 },
          { name: 'workflows[].id pattern WF-*', kind: 'required_value_pattern', path: 'workflows[].id', pattern: '^WF-[A-Z0-9&-]+$' },
          { name: 'workflows[].business_domain_id pattern DOM-*', kind: 'required_value_pattern', path: 'workflows[].business_domain_id', pattern: '^DOM-[A-Z0-9-]+$' },
        ],
      };
    case 'entities_bloom':
      return {
        require_json_parse: true,
        t1_schema: {
          kind: 'json-shape',
          shape: {
            'kind': 'string',
            'entities': 'array',
            'entities[].id': 'string',
            'entities[].businessDomainId': 'string',
            'entities[].name': 'string',
            'entities[].keyAttributes': 'array',
            'entities[].relationships': 'array',
          },
        },
        t2_id_preservation: [],
        t3_invariants: [
          { name: 'entities non-empty', kind: 'array_length', path: 'entities', min: 1 },
          { name: 'entities[].id pattern ENT-*', kind: 'required_value_pattern', path: 'entities[].id', pattern: '^ENT-[A-Z0-9-]+$' },
          { name: 'entities[].businessDomainId pattern DOM-*', kind: 'required_value_pattern', path: 'entities[].businessDomainId', pattern: '^DOM-[A-Z0-9-]+$' },
          { name: 'entities[].id unique', kind: 'unique_values', path: 'entities[].id' },
        ],
      };
    case 'integrations_qa_bloom':
      return {
        require_json_parse: true,
        t1_schema: {
          kind: 'json-shape',
          shape: {
            'kind': 'string',
            'integrations': 'array',
            'integrations[].id': 'string',
            'integrations[].name': 'string',
            'integrations[].category': 'string',
            'integrations[].ownershipModel': 'string',
          },
        },
        t2_id_preservation: [],
        t3_invariants: [
          { name: 'integrations[].id pattern INT-*', kind: 'required_value_pattern', path: 'integrations[].id', pattern: '^INT-[A-Z0-9-]+$' },
        ],
      };
    case 'intent_quality_check':
      return {
        require_json_parse: true,
        t1_schema: {
          kind: 'json-shape',
          shape: {
            'completeness_findings': 'array',
            'consistency_findings': 'array',
            'coherence_findings': 'array',
            'overall_status': 'string',
            'system_proposal_offered_for': 'array',
          },
        },
        t2_id_preservation: [],
        t3_invariants: [
          {
            name: 'overall_status in allowed',
            kind: 'enum_subset',
            path: 'overall_status',
            allowed: ['pass', 'fail', 'warn', 'needs_clarification', 'incomplete'],
          },
          {
            name: 'completeness_findings[].severity in allowed',
            kind: 'enum_subset',
            path: 'completeness_findings[].severity',
            allowed: ['HIGH', 'MEDIUM', 'LOW', 'high', 'medium', 'low', 'info'],
          },
        ],
      };
    case 'product_description_synthesis':
      return {
        require_json_parse: true,
        t1_schema: {
          kind: 'json-shape',
          shape: {
            'product_vision': 'string',
            'product_description': 'string',
            'summary': 'string',
            'open_loops': 'array',
            'open_loops[].category': 'string',
            'open_loops[].description': 'string',
            'open_loops[].priority': 'string',
          },
        },
        t2_id_preservation: [],
        t3_invariants: [
          { name: 'product_vision non-empty', kind: 'required_value_pattern', path: 'product_vision', pattern: '.+' },
          { name: 'product_description non-empty', kind: 'required_value_pattern', path: 'product_description', pattern: '.+' },
          {
            name: 'open_loops[].priority in allowed',
            kind: 'enum_subset',
            path: 'open_loops[].priority',
            allowed: ['high', 'med', 'medium', 'low', 'critical'],
          },
        ],
      };
    case 'release_plan':
      return {
        require_json_parse: true,
        t1_schema: {
          kind: 'json-shape',
          shape: {
            'kind': 'string',
            'releases': 'array',
            'releases[].release_id': 'string',
            'releases[].ordinal': 'number',
            'releases[].name': 'string',
            'releases[].description': 'string',
            'releases[].contains_journeys': 'array',
          },
        },
        t2_id_preservation: [],
        t3_invariants: [
          { name: 'releases non-empty', kind: 'array_length', path: 'releases', min: 1 },
          { name: 'releases[].release_id pattern REL-*', kind: 'required_value_pattern', path: 'releases[].release_id', pattern: '^REL-[A-Z0-9-]+$' },
          { name: 'releases[].release_id unique', kind: 'unique_values', path: 'releases[].release_id' },
        ],
      };
    case 'deep_memory_context_packet_synthesis':
      return {
        require_json_parse: true,
        t1_schema: {
          kind: 'json-shape',
          shape: {
            'decision_context_summary': 'string',
            'active_constraints': 'array',
            'active_constraints[].statement': 'string',
            'active_constraints[].authority_level': 'number',
            'active_constraints[].source_record_ids': 'array',
            'supersession_chains': 'array',
            'contradictions': 'array',
            'open_questions': 'array',
            'completeness_status': 'string',
            'completeness_narrative': 'string',
          },
        },
        t2_id_preservation: [],
        t3_invariants: [
          {
            name: 'completeness_status in allowed',
            kind: 'enum_subset',
            path: 'completeness_status',
            allowed: ['complete', 'partial_low', 'partial_medium', 'incomplete_high'],
          },
          { name: 'decision_context_summary non-empty', kind: 'required_value_pattern', path: 'decision_context_summary', pattern: '.+' },
        ],
      };
    default:
      return { t2_id_preservation: [], t3_invariants: [] };
  }
}

// ── CLI entrypoint helper ───────────────────────────────────────────

if (typeof require !== 'undefined' && require.main === module) {
  // intentionally empty — the CLI script in cli/extract.ts is the entry.
}

export { SOURCE_ROOT };
