import { makeLLMValidator } from './llmValidatorRunner';
export const invokeComplianceSignalCompleteness = makeLLMValidator({
  validatorId: 'compliance_signal_completeness',
});
