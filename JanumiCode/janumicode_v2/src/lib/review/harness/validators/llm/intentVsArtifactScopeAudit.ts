import { makeLLMValidator } from './llmValidatorRunner';
export const invokeIntentVsArtifactScopeAudit = makeLLMValidator({
  validatorId: 'intent_vs_artifact_scope_audit',
});
