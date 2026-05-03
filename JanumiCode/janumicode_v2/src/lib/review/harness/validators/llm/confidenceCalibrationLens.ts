import { makeLLMValidator } from './llmValidatorRunner';
export const invokeConfidenceCalibrationLens = makeLLMValidator({
  validatorId: 'confidence_calibration_lens',
});
