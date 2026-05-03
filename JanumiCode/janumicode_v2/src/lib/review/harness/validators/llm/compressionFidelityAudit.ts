import { makeLLMValidator } from './llmValidatorRunner';
export const invokeCompressionFidelityAudit = makeLLMValidator({
  validatorId: 'compression_fidelity_audit',
});
