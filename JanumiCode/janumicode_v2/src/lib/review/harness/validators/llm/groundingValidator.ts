/**
 * LLM validator: grounding_validator. Factory-built; see makeLLMValidator.
 */
import { makeLLMValidator } from './llmValidatorRunner';

export const invokeGroundingValidator = makeLLMValidator({
  validatorId: 'grounding_validator',
});
