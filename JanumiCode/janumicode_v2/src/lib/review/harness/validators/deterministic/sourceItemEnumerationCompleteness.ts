/**
 * Source item enumeration completeness validator (dual-mode: deterministic + LLM semantic).
 *
 * Per validator_catalog.md §2: verify every source item id (or named entity)
 * the agent received as input appears in its output.
 *
 * Three operating modes (selected by (agentRole, subPhaseId)):
 *   - id_match: pure TypeScript set-difference over explicit IDs in the prompt.
 *     Extracts IDs by regex from the original prompt, checks they appear in the
 *     output field designated for that sub-phase.
 *   - vocabulary_grounding: bidirectional (Phase 4.1 software_domains) —
 *     each term in ubiquitous_language must trace to an SR, and each SR behavior
 *     cluster should have at least one term. This mode implements the deterministic
 *     side only (presence check of SR-refs in term definitions).
 *   - semantic: LLM mode for Phase 3.1 system_boundary. Input is prose (user stories
 *     + FRs), output is a structured boundary. The LLM is asked to enumerate every
 *     distinct entity/capability from the input that does not appear by name or
 *     paraphrase in the output. Uses
 *     prompts/review/discovery/source_item_enumeration_completeness_semantic.system.md.
 *
 * REGISTRY NOTE: This validator is registered as kind='llm' because the semantic mode
 * requires an LLM call. For id_match and vocabulary_grounding modes the invoke function
 * calls the deterministic logic directly (no LLM call). The `validate` export remains
 * for direct unit testing.
 *
 * Severity: HIGH on silent drop.
 */

import type { ValidatorRuntimeParams, ValidatorFinding } from '../../validatorRegistry';
import type { LLMCaller } from '../../../../llm/llmCaller';
import type { TemplateLoader } from '../../../../orchestrator/templateLoader';
import type { LLMInvokeContext } from '../llm/llmValidatorRunner';
import { runLLMValidator } from '../llm/llmValidatorRunner';

type CoverageMode = 'id_match' | 'vocabulary_grounding' | 'semantic';

interface SubPhaseConfig {
  mode: CoverageMode;
  /** Regex to extract source IDs from the original prompt. Must have a capture group. */
  sourceIdPattern?: RegExp;
  /** Field path in outputContent where IDs should appear (dot notation, one level). */
  outputFieldPath?: string;
  /** Sub-field within output items that holds the reference id(s). */
  itemRefField?: string;
}

/**
 * Per-dispatch-entry config table. Maps `${agentRole}:${subPhaseId}` to config.
 * Catalog §2 dispatch table (harness_design.md §2.1).
 */
const CONFIGS: Record<string, SubPhaseConfig> = {
  // Phase 3.1 system_boundary — semantic mode (LLM needed; deterministic skips)
  'systems_agent:system_boundary': {
    mode: 'semantic',
  },
  // Phase 3.2 system_requirements — id-match: FR/NFR ids → source_requirement_ids[]
  'systems_agent:system_requirements': {
    mode: 'id_match',
    // Match FR-xxx or NFR-xxx or US-xxx in the prompt
    sourceIdPattern: /\b(FR-[A-Z0-9-]+|NFR-[A-Z0-9-]+|US-[0-9]+)\b/g,
    outputFieldPath: 'system_requirements',
    itemRefField: 'source_requirement_ids',
  },
  // Phase 3.3 interface_contracts — id-match: system ids → systems_involved[]
  'systems_agent:interface_contracts': {
    mode: 'id_match',
    // Match SYS-xxx or EXT-xxx style system IDs
    sourceIdPattern: /\b(SYS-[A-Z0-9-]+|EXT-[A-Z0-9-]+|SYST-[A-Z0-9-]+)\b/g,
    outputFieldPath: 'interface_contracts',
    itemRefField: 'systems_involved',
  },
  // Phase 4.1 software_domains — vocabulary_grounding: bidirectional SR ↔ term check
  'architecture_agent:software_domains': {
    mode: 'vocabulary_grounding',
    sourceIdPattern: /\b(SR-[A-Z0-9-]+)\b/g,
    outputFieldPath: 'domains',
    itemRefField: 'ubiquitous_language',
  },
  // Phase 5.1 data_model_skeleton — id-match: component ids → data_models entries
  'technical_spec_agent:data_model_skeleton': {
    mode: 'id_match',
    sourceIdPattern: /\b(COMP-[A-Z0-9-]+|comp-[a-z0-9-]+)\b/g,
    outputFieldPath: 'data_models',
    itemRefField: 'component_id',
  },
  // Phase 5.2 api_definitions — id-match: component ids → api_definitions entries
  'technical_spec_agent:api_definitions': {
    mode: 'id_match',
    sourceIdPattern: /\b(COMP-[A-Z0-9-]+|comp-[a-z0-9-]+)\b/g,
    outputFieldPath: 'api_definitions',
    itemRefField: 'component_id',
  },
  // Phase 5.3 error_handling — id-match: component ids → error_handling_strategies entries
  'technical_spec_agent:error_handling': {
    mode: 'id_match',
    sourceIdPattern: /\b(COMP-[A-Z0-9-]+|comp-[a-z0-9-]+)\b/g,
    outputFieldPath: 'error_handling_strategies',
    itemRefField: 'component_id',
  },
  // Phase 5.4 configuration_parameters — id-match: component ids → configuration_parameters
  'technical_spec_agent:configuration_parameters': {
    mode: 'id_match',
    sourceIdPattern: /\b(COMP-[A-Z0-9-]+|comp-[a-z0-9-]+)\b/g,
    outputFieldPath: 'configuration_parameters',
    itemRefField: 'component_id',
  },
};

function getConfig(agentRole: string, subPhaseId: string): SubPhaseConfig | null {
  return CONFIGS[`${agentRole}:${subPhaseId}`] ?? null;
}

/**
 * Extract all unique IDs matching `pattern` from `text`.
 * Resets lastIndex before each call (handles global regex).
 */
function extractIds(text: string, pattern: RegExp): Set<string> {
  const ids = new Set<string>();
  pattern.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    ids.add(match[1] ?? match[0]);
  }
  return ids;
}

/**
 * Collect all values of `itemRefField` from an array of output items.
 * Items may have the ref field as a string (single) or string[] (multiple).
 */
function collectOutputRefs(items: unknown[], refField: string): Set<string> {
  const refs = new Set<string>();
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const val = rec[refField];
    if (typeof val === 'string') refs.add(val);
    else if (Array.isArray(val)) {
      for (const v of val) {
        if (typeof v === 'string') refs.add(v);
      }
    }
  }
  return refs;
}

export function validateSourceItemEnumerationCompleteness(
  params: ValidatorRuntimeParams,
): ValidatorFinding[] {
  const config = getConfig(params.agentRole, params.subPhaseId);
  if (!config) return [];

  // Semantic mode: requires LLM — return [] (no false positives; LLM variant deferred).
  if (config.mode === 'semantic') return [];

  const { outputContent, originalPrompt } = params;
  if (!outputContent || !config.sourceIdPattern || !config.outputFieldPath) return [];

  const sourceIds = extractIds(originalPrompt ?? '', config.sourceIdPattern);
  if (sourceIds.size === 0) return [];

  const outputItems = outputContent[config.outputFieldPath];
  if (!Array.isArray(outputItems)) {
    // If the output field is missing entirely, flag all source IDs as dropped.
    // HIGH severity — output field is structurally absent.
    return [...sourceIds].map((id) => ({
      validatorId: 'source_item_enumeration_completeness',
      severity: 'HIGH' as const,
      type: 'output_field_missing',
      summary: `Output field '${config.outputFieldPath}' is absent; source item '${id}' silently dropped`,
      location: `$.${config.outputFieldPath}`,
      detail: `Source context contained id '${id}' but output field '${config.outputFieldPath}' is missing entirely.`,
      recommendation: `Ensure '${config.outputFieldPath}' is populated with an entry referencing '${id}'.`,
    }));
  }

  const outputRefs = collectOutputRefs(outputItems, config.itemRefField ?? '');

  const findings: ValidatorFinding[] = [];

  if (config.mode === 'id_match') {
    for (const id of sourceIds) {
      if (!outputRefs.has(id)) {
        findings.push({
          validatorId: 'source_item_enumeration_completeness',
          severity: 'HIGH',
          type: 'source_item_silently_dropped',
          summary: `Source item '${id}' not referenced in any ${config.outputFieldPath} entry`,
          location: `$.${config.outputFieldPath}[*].${config.itemRefField}`,
          detail: `Source id '${id}' extracted from prompt context but no output item references it in '${config.itemRefField}'.`,
          recommendation: `Add an entry in '${config.outputFieldPath}' that references '${id}' in its '${config.itemRefField}' field.`,
        });
      }
    }
  }

  if (config.mode === 'vocabulary_grounding') {
    // Bidirectional: each SR in source should appear in at least one term definition.
    // (Term→SR direction is the primary check; SR→term direction requires LLM for full coverage.)
    const termItems = outputItems as Record<string, unknown>[];
    const coveredSRs = new Set<string>();
    for (const item of termItems) {
      const traces = item.traces_to ?? item.source_requirements ?? item.sr_refs;
      if (Array.isArray(traces)) {
        for (const t of traces) {
          if (typeof t === 'string') coveredSRs.add(t);
        }
      }
    }
    for (const id of sourceIds) {
      if (!coveredSRs.has(id)) {
        findings.push({
          validatorId: 'source_item_enumeration_completeness',
          severity: 'HIGH',
          type: 'source_item_silently_dropped',
          summary: `SR '${id}' not traced by any ubiquitous_language term`,
          location: `$.domains[*].ubiquitous_language[*].traces_to`,
          detail: `SR '${id}' was in the input but no vocabulary term's traces_to includes it.`,
          recommendation: `Add or annotate a term whose definition is grounded in SR '${id}'.`,
        });
      }
    }
  }

  return findings;
}

// ── LLM semantic mode invoke function ─────────────────────────────────────
//
// This is the entry point the harness calls for all modes. For id_match and
// vocabulary_grounding, it delegates to the deterministic logic above
// (synchronously — no LLM call). For semantic mode (Phase 3.1
// system_boundary), it calls the LLM with the semantic prompt template.
//
// The registry entry is kind='llm' with this function as `invoke` so all
// three modes are reachable through a single dispatch entry.

export async function invokeSourceItemEnumerationCompleteness(
  params: ValidatorRuntimeParams,
  llmCaller: LLMCaller,
  templateLoader: TemplateLoader,
  context: LLMInvokeContext,
): Promise<ValidatorFinding[]> {
  const config = getConfig(params.agentRole, params.subPhaseId);
  if (!config) return [];

  // Non-semantic modes: run deterministic logic, no LLM call needed.
  if (config.mode !== 'semantic') {
    return validateSourceItemEnumerationCompleteness(params);
  }

  // Semantic mode: delegate to the LLM validator runner.
  return runLLMValidator(
    params,
    llmCaller,
    templateLoader,
    {
      validatorId: 'source_item_enumeration_completeness',
      workflowRunId: context.workflowRunId,
      phaseId: context.phaseId,
      subPhaseId: context.subPhaseId,
      provider: context.harnessProvider,
      model: context.harnessModel,
      temperature: context.harnessTemperature,
      recordLLMUsage: context.recordLLMUsage,
    },
    context.pushFailure,
  );
}
