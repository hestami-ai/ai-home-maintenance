import { makeLLMValidator } from './llmValidatorRunner';
export const invokeThresholdPresenceCheck = makeLLMValidator({
  validatorId: 'threshold_presence_check',
});
