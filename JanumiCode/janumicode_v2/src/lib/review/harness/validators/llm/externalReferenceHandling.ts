import { makeLLMValidator } from './llmValidatorRunner';
export const invokeExternalReferenceHandling = makeLLMValidator({
  validatorId: 'external_reference_handling',
});
