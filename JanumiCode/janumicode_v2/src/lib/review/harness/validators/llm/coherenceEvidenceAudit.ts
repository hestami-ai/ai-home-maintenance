import { makeLLMValidator } from './llmValidatorRunner';
export const invokeCoherenceEvidenceAudit = makeLLMValidator({
  validatorId: 'coherence_evidence_audit',
});
