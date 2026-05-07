/**
 * LLM validator: interface_contract_alignment_validator
 *
 * Per validator_catalog.md §2 (Phase 5 discovery-class additions, sample 23):
 * For Phase 5.2 api_definitions, verify that each component's endpoint
 * definition uses the communication protocol specified in the matching
 * Interface Contract from Phase 3.3.
 *
 * Evidence: sample 23 — uniform REST/HTTPS flattening ignored explicit
 * gRPC/Protobuf (CONTRACT-BACKEND-003), TUS/HTTPS (CONTRACT-SYNC-011),
 * and KMS API (CONTRACT-SECURITY-012) contracts.
 *
 * Severity:
 *   - HIGH: protocol mismatch contradicting explicit contract.
 *   - MEDIUM: unresolved ambiguity not surfaced as assumption.
 */

import { makeLLMValidator } from './llmValidatorRunner';

export const invokeInterfaceContractAlignmentValidator = makeLLMValidator({
  validatorId: 'interface_contract_alignment_validator',
});
