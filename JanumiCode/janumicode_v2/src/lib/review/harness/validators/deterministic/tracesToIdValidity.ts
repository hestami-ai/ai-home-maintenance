/**
 * Deterministic validator: traces_to_id_validity
 *
 * Per validator_catalog.md §5.4.1: verify every id in the parameterized
 * reference field resolves to an entry in the known id set at the current
 * saturation tree level (handoff_context, sibling_context, or the upstream
 * tier's child set).
 *
 * Field-path parameterization (by agentRole + subPhaseId):
 *   - fr_saturation / nfr_saturation: `traces_to[]` field on each child
 *   - component_saturation (domain_interpreter): `dependencies[].component_id`
 *   - data_model_saturation (technical_spec_agent): `references[].entity_id`
 *     or `references[].target_entity_id`
 *   - data_model_skeleton (technical_spec_agent): `relationships[].to_entity`
 *     used as FK target — checked against known entity ids in the same output
 *
 * Known id sets are extracted from:
 *   1. sibling_context IDs in the output (outputContent.sibling_context[].id)
 *   2. handoff_context IDs extracted from the original prompt by regex
 *   3. IDs of entities emitted in the same output batch
 *
 * Severity:
 *   - HIGH on broken reference at deep saturation (depth ≥ 2)
 *   - LOW at shallow depths (0–1) per catalog
 *   - MEDIUM when depth is unknown/unavailable (conservative)
 */

import type { ValidatorRuntimeParams, ValidatorFinding } from '../../validatorRegistry';

interface FieldPathConfig {
  /** Path to the array of children in the output. */
  childrenField: string;
  /** Field within each child that holds the reference (or array of references). */
  refField: string;
  /** Whether the refField is an array or a sub-object path. */
  refMode: 'array' | 'sub_array_field';
  /** Sub-field within the ref object (for sub_array_field mode). */
  subField?: string;
  /** Fallback: top-level output array field to collect known IDs from. */
  knownIdField?: string;
  /** Sub-field within knownIdField entries that holds the ID. */
  knownIdSubField?: string;
}

const CONFIGS: Record<string, FieldPathConfig> = {
  'requirements_agent:fr_saturation': {
    childrenField: 'children',
    refField: 'traces_to',
    refMode: 'array',
    knownIdField: 'handoff_context',
    knownIdSubField: 'id',
  },
  'requirements_agent:nfr_saturation': {
    childrenField: 'children',
    refField: 'traces_to',
    refMode: 'array',
    knownIdField: 'handoff_context',
    knownIdSubField: 'id',
  },
  'domain_interpreter:component_saturation': {
    childrenField: 'children',
    refField: 'dependencies',
    refMode: 'sub_array_field',
    subField: 'component_id',
    knownIdField: 'sibling_context',
    knownIdSubField: 'id',
  },
  'technical_spec_agent:data_model_saturation': {
    childrenField: 'children',
    refField: 'references',
    refMode: 'sub_array_field',
    subField: 'entity_id',
    knownIdField: 'sibling_context',
    knownIdSubField: 'id',
  },
  'technical_spec_agent:data_model_skeleton': {
    // At Phase 5.1 (flat, not saturation), check FK targets in relationships.
    // This is the broken_reference_validator pattern from §5.4.1 reconciliation note.
    childrenField: 'data_models',
    refField: 'relationships',
    refMode: 'sub_array_field',
    subField: 'to_entity',
    knownIdField: 'data_models',
    knownIdSubField: 'entity_id',
  },
};

function collectKnownIds(
  outputContent: Record<string, unknown>,
  prompt: string,
  config: FieldPathConfig,
): Set<string> {
  const ids = new Set<string>();

  // From sibling_context / handoff_context / data_models in output
  const contextArray = outputContent[config.knownIdField ?? ''];
  if (Array.isArray(contextArray)) {
    for (const item of contextArray) {
      if (!item || typeof item !== 'object') continue;
      const rec = item as Record<string, unknown>;
      const idVal = rec[config.knownIdSubField ?? 'id'];
      if (typeof idVal === 'string') ids.add(idVal);
    }
  }

  // From top-level emitted children in the same batch
  const children = outputContent[config.childrenField];
  if (Array.isArray(children)) {
    for (const child of children) {
      if (!child || typeof child !== 'object') continue;
      const c = child as Record<string, unknown>;
      const childId = c.id ?? c.component_id ?? c.entity_id;
      if (typeof childId === 'string') ids.add(childId);
    }
  }

  // From prompt — extract well-formed IDs. The prefix set MUST cover every id
  // namespace the prompts actually emit as trace targets, or valid traces are
  // flagged as fabricated. The saturation/bloom prompts use UJ-* (user
  // journeys) and WF-* (workflows) as the PRIMARY trace targets, plus
  // VV-/TECH-/QA-/VOC-/OPEN-/Q-/DM-/API- across the requirements & spec phases.
  // (Earlier this regex only listed FR|NFR|US|COMP|ENT|SR|SYS, which produced
  // 100% false positives on every UJ-/WF- trace in fr_saturation — see
  // dspy/reports/fr_saturation.findings.md.) Broadening is safe: ids are scanned
  // FROM the prompt, so a wider prefix set only recognizes ids actually present —
  // a fabricated id (absent from the prompt) still never matches.
  const promptIdPattern =
    /\b((FR|NFR|US|UJ|WF|VV|TECH|QA|VOC|OPEN|COMP|ENT|SR|SYS|DM|API|Q)-[A-Z0-9._-]+)\b/g;
  promptIdPattern.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = promptIdPattern.exec(prompt)) !== null) {
    ids.add(m[1]);
  }

  return ids;
}

function extractRefs(
  item: Record<string, unknown>,
  config: FieldPathConfig,
): string[] {
  const refs: string[] = [];
  if (config.refMode === 'array') {
    const val = item[config.refField];
    if (Array.isArray(val)) {
      for (const v of val) {
        if (typeof v === 'string') refs.push(v);
      }
    }
  } else if (config.refMode === 'sub_array_field') {
    const arr = item[config.refField];
    if (Array.isArray(arr)) {
      for (const entry of arr) {
        if (!entry || typeof entry !== 'object') continue;
        const e = entry as Record<string, unknown>;
        const v = e[config.subField ?? 'id'];
        if (typeof v === 'string') refs.push(v);
      }
    }
  }
  return refs;
}

export function validateTracesToIdValidity(
  params: ValidatorRuntimeParams,
): ValidatorFinding[] {
  const { outputContent, originalPrompt, agentRole, subPhaseId } = params;
  if (!outputContent) return [];

  const config = CONFIGS[`${agentRole}:${subPhaseId}`];
  if (!config) return [];

  const depth =
    typeof outputContent.depth === 'number' ? outputContent.depth
    : typeof outputContent.saturation_depth === 'number' ? outputContent.saturation_depth
    : null;

  // Severity: HIGH at depth ≥ 2; LOW at depth 0–1; MEDIUM when unknown
  const getSeverity = (): ValidatorFinding['severity'] => {
    if (depth === null) return 'MEDIUM';
    if (depth >= 2) return 'HIGH';
    return 'LOW';
  };

  const knownIds = collectKnownIds(outputContent, originalPrompt ?? '', config);

  const items = outputContent[config.childrenField];
  if (!Array.isArray(items)) return [];

  const findings: ValidatorFinding[] = [];

  items.forEach((item, idx) => {
    if (!item || typeof item !== 'object') return;
    const rec = item as Record<string, unknown>;
    const itemId =
      typeof rec.id === 'string' ? rec.id
      : typeof rec.component_id === 'string' ? rec.component_id
      : typeof rec.entity_id === 'string' ? rec.entity_id
      : `[${idx}]`;

    const refs = extractRefs(rec, config);
    for (const ref of refs) {
      if (!knownIds.has(ref)) {
        findings.push({
          validatorId: 'traces_to_id_validity',
          severity: getSeverity(),
          type: 'broken_reference',
          summary: `Item '${itemId}' references unknown id '${ref}'`,
          location: `$.${config.childrenField}[${idx}].${config.refField}`,
          detail: `Reference '${ref}' in item '${itemId}' does not match any known id in handoff_context, sibling_context, or emitted children. This may be a fabricated namespace.`,
          recommendation: `Verify '${ref}' exists in the handoff context or sibling context. Remove or correct the reference if fabricated.`,
        });
      }
    }
  });

  return findings;
}
