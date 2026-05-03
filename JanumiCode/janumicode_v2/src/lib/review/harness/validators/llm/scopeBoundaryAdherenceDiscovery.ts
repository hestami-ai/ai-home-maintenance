/**
 * LLM validator: scope_boundary_adherence_discovery.
 *
 * Per validator_catalog §2 + samples 03/04. Layer-positive-list driven.
 * The shared template is parameterised at runtime via the substituted
 * SUB_PHASE / LAYER_POSITIVE_LIST variables; the factory's
 * preprocessGrounding hook injects the per-pass list.
 */
import { makeLLMValidator } from './llmValidatorRunner';

/**
 * Per-pass positive-list of in-scope concept categories. Items extracted
 * by the agent that don't belong to any of these categories are flagged
 * as drift to a sibling pass.
 */
export const LAYER_POSITIVE_LISTS: Record<string, readonly string[]> = {
  product_intent_discovery: [
    'product purpose',
    'value proposition',
    'primary user types',
    'core capability',
    'business context',
  ],
  technical_constraints_discovery: [
    'technology constraint',
    'platform constraint',
    'integration constraint',
    'deployment constraint',
  ],
  compliance_retention_discovery: [
    'compliance regime',
    'retention requirement',
    'data classification',
    'audit obligation',
  ],
  vv_requirements_discovery: [
    'verification requirement',
    'validation requirement',
    'evidence requirement',
  ],
  canonical_vocabulary_discovery: [
    'canonical term',
    'glossary entry',
    'synonym',
  ],
};

export const invokeScopeBoundaryAdherenceDiscovery = makeLLMValidator({
  validatorId: 'scope_boundary_adherence_discovery',
  preprocessGrounding: (params) => {
    const list = LAYER_POSITIVE_LISTS[params.subPhaseId] ?? [];
    return {
      LAYER_POSITIVE_LIST: list.length
        ? list.map((c) => `- ${c}`).join('\n')
        : '(no positive list defined for this sub_phase — flag any item as out-of-scope)',
    };
  },
});
