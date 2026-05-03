import { makeLLMValidator } from './llmValidatorRunner';
export const invokeRegimeCitationValidity = makeLLMValidator({
  validatorId: 'regime_citation_validity',
});
