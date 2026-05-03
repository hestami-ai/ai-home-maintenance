import { makeLLMValidator } from './llmValidatorRunner';
export const invokeComplianceSequencingAudit = makeLLMValidator({
  validatorId: 'compliance_sequencing_audit',
});
