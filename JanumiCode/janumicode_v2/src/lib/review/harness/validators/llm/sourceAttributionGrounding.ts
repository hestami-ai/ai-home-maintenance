import { makeLLMValidator } from './llmValidatorRunner';
export const invokeSourceAttributionGrounding = makeLLMValidator({
  validatorId: 'source_attribution_grounding',
});
