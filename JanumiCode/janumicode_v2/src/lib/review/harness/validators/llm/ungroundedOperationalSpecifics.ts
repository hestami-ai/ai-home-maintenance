/**
 * LLM validator: ungrounded_operational_specifics
 *
 * Per validator_catalog.md §2: verify every concrete operational/technical
 * detail emitted in a structured schema field is grounded in upstream source.
 *
 * Three parameterizations (selected by agentRole + subPhaseId):
 *   (A) interface_contracts: auth_mechanism, protocol, data_format fields
 *   (B) adr_capture: algorithmic/numeric mandates — bidirectional check
 *   (C) technical_spec_agent: endpoint URLs, bucket names, error-type names,
 *       defaults, retry-strategy specifics
 *
 * Implemented as a single LLM validator with a shared prompt that is
 * parameterized by PARAMETERIZATION_LABEL injected at render time.
 */

import { makeLLMValidator } from './llmValidatorRunner';
import type { ValidatorRuntimeParams } from '../../validatorRegistry';

export function getParameterizationLabel(agentRole: string, subPhaseId: string): string {
  if (agentRole === 'systems_agent' && subPhaseId === 'interface_contracts') {
    return 'A — interface commitment fields (auth_mechanism, protocol, data_format)';
  }
  if (agentRole === 'architecture_agent' && subPhaseId === 'adr_capture') {
    return 'B — regulatory/algorithmic threshold bidirectional check (introduced vs. mandated)';
  }
  // Phase 5.x — technical_spec_agent
  return 'C — runtime operational specifics (endpoint URLs, bucket names, error-type names, defaults, retry strategies)';
}

export const invokeUngroundedOperationalSpecifics = makeLLMValidator({
  validatorId: 'ungrounded_operational_specifics',
  preprocessGrounding: (params: ValidatorRuntimeParams): Record<string, string> => ({
    PARAMETERIZATION: getParameterizationLabel(params.agentRole, params.subPhaseId),
    AGENT_ROLE: params.agentRole,
    SUB_PHASE: params.subPhaseId,
  }),
});
