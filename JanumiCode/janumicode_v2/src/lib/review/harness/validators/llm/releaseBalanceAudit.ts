import { makeLLMValidator } from './llmValidatorRunner';
export const invokeReleaseBalanceAudit = makeLLMValidator({
  validatorId: 'release_balance_audit',
});
