/**
 * LLM validator: nfr_threshold_grounding
 *
 * Per validator_catalog.md §5.4.2 (NFR-specific saturation outlier):
 * Variant of threshold_grounding_audit parameterized for NFR saturation.
 * Every numeric threshold the agent emits in a child NFR's
 * `measurable_condition` or `seed_threshold` MUST be grounded in the
 * parent NFR / handoff or surfaced as an open_question.
 *
 * Evidence: sample 14b — temporal bookending not in any handoff item;
 * per-ballot locking commitment beyond A-0068.
 *
 * Applies to: requirements_agent / nfr_saturation only.
 *
 * HIGH severity on ungrounded numeric threshold.
 */

import { makeLLMValidator } from './llmValidatorRunner';

export const invokeNfrThresholdGrounding = makeLLMValidator({
  validatorId: 'nfr_threshold_grounding',
});
