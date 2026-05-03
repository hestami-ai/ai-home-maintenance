import type { ValidatorRuntimeParams } from '../../../../../../lib/review/harness/validatorRegistry';

export function makeRuntime(
  overrides: Partial<ValidatorRuntimeParams> = {},
): ValidatorRuntimeParams {
  return {
    agentRole: 'orchestrator',
    subPhaseId: 'intent_quality_check',
    agentOutputId: 'out-1',
    outputText: '',
    outputContent: null,
    outputThinking: null,
    originalPrompt: '',
    originalSystem: null,
    upstreamFindings: [],
    ...overrides,
  };
}
