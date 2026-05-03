import { makeLLMValidator } from './llmValidatorRunner';
export const invokePhasingDependencyConsistency = makeLLMValidator({
  validatorId: 'phasing_dependency_consistency',
});
