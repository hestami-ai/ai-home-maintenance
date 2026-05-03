import { makeLLMValidator } from './llmValidatorRunner';
export const invokeCompletenessEvidenceAdequacy = makeLLMValidator({
  validatorId: 'completeness_evidence_adequacy',
});
