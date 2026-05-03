import { makeLLMValidator } from './llmValidatorRunner';
export const invokeSynthesisCoverageAudit = makeLLMValidator({
  validatorId: 'synthesis_coverage_audit',
});
