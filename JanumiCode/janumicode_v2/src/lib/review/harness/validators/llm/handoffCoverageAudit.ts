import { makeLLMValidator } from './llmValidatorRunner';
export const invokeHandoffCoverageAudit = makeLLMValidator({
  validatorId: 'handoff_coverage_audit',
});
