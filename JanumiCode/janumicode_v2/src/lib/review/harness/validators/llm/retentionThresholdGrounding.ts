import { makeLLMValidator } from './llmValidatorRunner';
export const invokeRetentionThresholdGrounding = makeLLMValidator({
  validatorId: 'retention_threshold_grounding',
});
