import { describe, it, expect } from 'vitest';
import { AgentRegistry, validateRegistryEntry, type AgentRegistryEntry } from '../lib/registry/agentRegistry.js';

const baseEntry: AgentRegistryEntry = {
  agentId: 'family_law_issue_bloom_agent.v1',
  displayName: 'Family Law Issue Bloom Agent',
  tier: 'issue_decomposition',
  permittedLenses: ['family_law_production_lens'],
  permittedStates: ['IssueBloom'],
  capabilityGroupA: 'decompose',
  inputSchema: 'FamilyLawIssueBloomInput.v1',
  outputSchema: 'IssueCandidateSet.v1',
  prohibitedActions: ['do not prune issues'],
  requiredValidators: ['issue_candidate_schema_validator.v1'],
  confidencePolicy: {
    mayUseConfidenceLabels: false,
    mayBlockRelease: false,
    mayRequireAttorneyReview: true,
    mayApproveRelease: false,
  },
  authorityPolicy: { mayRetrieveAuthority: false, mayAssessAuthoritySupport: false, mayMarkAttorneyConfirmed: false },
  privilegePolicy: { mayHandlePrivilegedMaterial: true, mayGenerateClientFacingText: false, mayExportExternalArtifact: false },
  version: 'v1',
};

describe('agent registry capability-group exclusivity', () => {
  it('accepts a valid entry', () => {
    const v = validateRegistryEntry(baseEntry);
    expect(v.ok, v.errors.join('; ')).toBe(true);
  });

  it('rejects an entry that puts a Group B value in Group A', () => {
    const bad: AgentRegistryEntry = { ...baseEntry, capabilityGroupA: 'verify' as any };
    const v = validateRegistryEntry(bad);
    expect(v.ok).toBe(false);
    expect(v.errors.join(';')).toMatch(/capabilityGroupA value 'verify' not in Group A/);
  });

  it('rejects an entry that puts a Group A value in Group C', () => {
    const bad: AgentRegistryEntry = { ...baseEntry, capabilityGroupA: undefined, capabilityGroupC: 'draft' as any };
    const v = validateRegistryEntry(bad);
    expect(v.ok).toBe(false);
  });

  it('rejects an entry with no capability declared', () => {
    const bad: AgentRegistryEntry = { ...baseEntry, capabilityGroupA: undefined };
    const v = validateRegistryEntry(bad);
    expect(v.ok).toBe(false);
    expect(v.errors.join(';')).toMatch(/at least one capability/);
  });

  it('rejects an agent that claims mayApproveRelease=true', () => {
    const bad: AgentRegistryEntry = {
      ...baseEntry,
      confidencePolicy: { ...baseEntry.confidencePolicy, mayApproveRelease: true },
    };
    const v = validateRegistryEntry(bad);
    expect(v.ok).toBe(false);
    expect(v.errors.join(';')).toMatch(/mayApproveRelease must be false/);
  });

  it('registry rejects duplicate registration', () => {
    const reg = new AgentRegistry();
    reg.register(baseEntry);
    expect(() => reg.register(baseEntry)).toThrow(/already registered/);
  });

  it('an agent declaring two capability groups is permitted (production+governance composition is intentional only via separate agents)', () => {
    // Capability-group exclusivity rule (evolution §14): at most one PER GROUP.
    // An agent may carry one from each group simultaneously. Two from the SAME
    // group is the failure case. The type system enforces single-value-per-group;
    // this test asserts that combining cross-group is fine.
    const composite: AgentRegistryEntry = { ...baseEntry, capabilityGroupB: 'verify' };
    const v = validateRegistryEntry(composite);
    expect(v.ok, v.errors.join('; ')).toBe(true);
  });
});
