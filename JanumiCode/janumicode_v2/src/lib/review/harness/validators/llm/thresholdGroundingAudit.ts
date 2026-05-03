import { makeLLMValidator } from './llmValidatorRunner';
export const invokeThresholdGroundingAudit = makeLLMValidator({
  validatorId: 'threshold_grounding_audit',
});
