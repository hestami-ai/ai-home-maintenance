/**
 * LLM validator: tier_assignment_audit
 *
 * Per validator_catalog.md §5.4.1: verify each child's `tier` (A/B/C/D)
 * is consistent with its description, AC count, and decomposition_rationale
 * per the catalog's tier rubric.
 *
 * MEDIUM severity for misclassification within one tier;
 * HIGH for cross-tier (e.g. claiming atomic-D when description names a quality area).
 *
 * Applies to all saturation surfaces: fr_saturation, nfr_saturation,
 * component_saturation, data_model_saturation.
 */

import { makeLLMValidator } from './llmValidatorRunner';

export const invokeTierAssignmentAudit = makeLLMValidator({
  validatorId: 'tier_assignment_audit',
});
