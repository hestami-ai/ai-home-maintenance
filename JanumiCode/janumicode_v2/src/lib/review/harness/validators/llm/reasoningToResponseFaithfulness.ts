/**
 * LLM validator: reasoning_to_response_faithfulness. Factory-built.
 */
import { makeLLMValidator } from './llmValidatorRunner';

export const invokeReasoningToResponseFaithfulness = makeLLMValidator({
  validatorId: 'reasoning_to_response_faithfulness',
});
