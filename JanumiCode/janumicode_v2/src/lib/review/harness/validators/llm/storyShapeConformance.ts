import { makeLLMValidator } from './llmValidatorRunner';
export const invokeStoryShapeConformance = makeLLMValidator({
  validatorId: 'story_shape_conformance',
});
