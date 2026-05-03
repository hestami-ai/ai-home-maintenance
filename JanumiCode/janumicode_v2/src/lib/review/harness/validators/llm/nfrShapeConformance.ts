import { makeLLMValidator } from './llmValidatorRunner';
export const invokeNfrShapeConformance = makeLLMValidator({
  validatorId: 'nfr_shape_conformance',
});
