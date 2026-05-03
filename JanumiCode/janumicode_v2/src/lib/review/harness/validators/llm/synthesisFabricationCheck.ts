import { makeLLMValidator } from './llmValidatorRunner';
export const invokeSynthesisFabricationCheck = makeLLMValidator({
  validatorId: 'synthesis_fabrication_check',
});
