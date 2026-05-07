/**
 * LLM validator: error_type_source_attestation_validator
 *
 * Per validator_catalog.md §6 (Phase 5.3, sample 24):
 * For each error_types array value in error_handling_strategies output,
 * assess whether the error type is:
 *   (a) directly named in source → ACCEPT
 *   (b) derivable from a named source behavior → ACCEPT with LOW annotation
 *   (c) plausible but unattested infrastructure failure for the component → MEDIUM
 *   (d) generic cross-component infrastructure failure unrelated to any named behavior → HIGH
 *
 * Evidence: sample 24 — 18 unsupported_claim findings from grounding_validator.
 * This validator adds precision by distinguishing source-derivable from fully
 * fabricated error types.
 *
 * HIGH on group (d); MEDIUM on group (c); LOW on group (b).
 */

import { makeLLMValidator } from './llmValidatorRunner';

export const invokeErrorTypeSourceAttestationValidator = makeLLMValidator({
  validatorId: 'error_type_source_attestation_validator',
});
