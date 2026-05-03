/**
 * LLM validator: open_question_vs_decided. Factory-built.
 */
import { makeLLMValidator } from './llmValidatorRunner';

export const invokeOpenQuestionVsDecided = makeLLMValidator({
  validatorId: 'open_question_vs_decided',
});
