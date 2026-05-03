import { makeLLMValidator } from './llmValidatorRunner';
export const invokeMeasurementAdequacyValidator = makeLLMValidator({
  validatorId: 'measurement_adequacy_validator',
});
