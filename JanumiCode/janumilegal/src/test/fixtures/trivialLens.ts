/**
 * Test fixture: trivial two-state lens for Wave 2 E2E.
 */

import type { LensPhaseManifest } from '../../lib/orchestrator/types.js';
import type { AgentRegistryEntry } from '../../lib/registry/agentRegistry.js';

export const TRIVIAL_LENS_ID = 'test_trivial_lens';
export const TRIVIAL_LENS_VERSION = 'v1';

export const STATE_ONE_AGENT_ID = 'test_state_one_agent.v1';
export const STATE_TWO_AGENT_ID = 'test_state_two_agent.v1';

export const stateOneAgentRegistration: AgentRegistryEntry = {
  agentId: STATE_ONE_AGENT_ID,
  displayName: 'Test State 1 Agent',
  tier: 'intake',
  permittedLenses: [TRIVIAL_LENS_ID],
  permittedStates: ['StateOne'],
  capabilityGroupA: 'extract',
  inputSchema: 'TestStateOneInput.v1',
  outputSchema: 'TestStateOneOutput.v1',
  prohibitedActions: [],
  requiredValidators: [],
  confidencePolicy: { mayUseConfidenceLabels: false, mayBlockRelease: false, mayRequireAttorneyReview: false, mayApproveRelease: false },
  authorityPolicy: { mayRetrieveAuthority: false, mayAssessAuthoritySupport: false, mayMarkAttorneyConfirmed: false },
  privilegePolicy: { mayHandlePrivilegedMaterial: true, mayGenerateClientFacingText: false, mayExportExternalArtifact: false },
  version: 'v1',
};

export const stateTwoAgentRegistration: AgentRegistryEntry = {
  ...stateOneAgentRegistration,
  agentId: STATE_TWO_AGENT_ID,
  displayName: 'Test State 2 Agent',
  permittedStates: ['StateTwo'],
  inputSchema: 'TestStateTwoInput.v1',
  outputSchema: 'TestStateTwoOutput.v1',
};

export const trivialManifest: LensPhaseManifest = {
  lensId: TRIVIAL_LENS_ID,
  lensVersion: TRIVIAL_LENS_VERSION,
  practiceArea: 'family_law',
  applicableJurisdictions: ['MD'],
  states: [
    {
      stateId: 'StateOne',
      required: true,
      predecessors: [],
      permittedAgents: [STATE_ONE_AGENT_ID],
      inputSchema: 'TestStateOneInput.v1',
      outputSchema: 'TestStateOneOutput.v1',
      validators: [],
      escalationConditions: [],
      clvScope: ['clv.core.matter.v1'],
      artifactsProduced: [],
    },
    {
      stateId: 'StateTwo',
      required: true,
      predecessors: ['StateOne'],
      permittedAgents: [STATE_TWO_AGENT_ID],
      inputSchema: 'TestStateTwoInput.v1',
      outputSchema: 'TestStateTwoOutput.v1',
      validators: [],
      escalationConditions: [],
      clvScope: ['clv.core.fact.v1'],
      artifactsProduced: [],
    },
  ],
  requiredArtifacts: [],
  validators: [],
  escalationTriggers: [],
  releasePolicies: [],
  clvBindings: ['clv.core.matter.v1', 'clv.core.fact.v1'],
  dependencies: [],
};
