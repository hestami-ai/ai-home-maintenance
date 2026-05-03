/**
 * LLM validator: reasoning_quality_validator. Factory-built.
 */
import { makeLLMValidator } from './llmValidatorRunner';

export const invokeReasoningQualityValidator = makeLLMValidator({
  validatorId: 'reasoning_quality_validator',
});
