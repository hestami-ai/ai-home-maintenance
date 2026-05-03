import { makeLLMValidator } from './llmValidatorRunner';
export const invokeSkeletonDriftAudit = makeLLMValidator({
  validatorId: 'skeleton_drift_audit',
});
