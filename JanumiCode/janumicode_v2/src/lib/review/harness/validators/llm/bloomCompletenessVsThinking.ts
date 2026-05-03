import { makeLLMValidator } from './llmValidatorRunner';
export const invokeBloomCompletenessVsThinking = makeLLMValidator({
  validatorId: 'bloom_completeness_vs_thinking',
});
