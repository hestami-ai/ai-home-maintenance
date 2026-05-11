/**
 * Agent registrations for the MVP lens packs.
 *
 * Each registration is a metadata declaration only — agent implementations
 * (LLM-backed) come in Wave 7+. For Wave 6 the orchestrator binds replay
 * agents from test fixtures via `AgentRuntime.bindAgent`.
 */

import type { AgentRegistryEntry, AgentTier } from '../lib/registry/agentRegistry.js';
import { FAMILY_LAW_AGENTS } from './familyLawProduction/manifest.js';
import { SHARED_AGENTS } from './sharedAgents.js';
import { MVP_LENS_MANIFESTS } from './index.js';

const ALL_LENSES = MVP_LENS_MANIFESTS.map((m) => m.lensId);

function makeEntry(args: {
  agentId: string;
  displayName: string;
  tier: AgentTier;
  permittedLenses: readonly string[];
  permittedStates: readonly string[];
  capabilityGroupA?: AgentRegistryEntry['capabilityGroupA'];
  capabilityGroupB?: AgentRegistryEntry['capabilityGroupB'];
  capabilityGroupC?: AgentRegistryEntry['capabilityGroupC'];
}): AgentRegistryEntry {
  return {
    agentId: args.agentId,
    displayName: args.displayName,
    tier: args.tier,
    permittedLenses: args.permittedLenses,
    permittedStates: args.permittedStates,
    capabilityGroupA: args.capabilityGroupA,
    capabilityGroupB: args.capabilityGroupB,
    capabilityGroupC: args.capabilityGroupC,
    inputSchema: 'WaveSixSchema.v1',
    outputSchema: 'WaveSixSchema.v1',
    prohibitedActions: ['do not approve release without an AttorneyAction'],
    requiredValidators: [],
    confidencePolicy: {
      mayUseConfidenceLabels: true,
      mayBlockRelease: false,
      mayRequireAttorneyReview: true,
      mayApproveRelease: false,
    },
    authorityPolicy: { mayRetrieveAuthority: false, mayAssessAuthoritySupport: false, mayMarkAttorneyConfirmed: false },
    privilegePolicy: { mayHandlePrivilegedMaterial: true, mayGenerateClientFacingText: false, mayExportExternalArtifact: false },
    version: 'v1',
  };
}

/** Registrations for Wave 6. Includes Family Law per-state agents and shared cross-lens agents. */
export const MVP_AGENT_REGISTRATIONS: readonly AgentRegistryEntry[] = [
  // Family Law per-state agents
  makeEntry({ agentId: FAMILY_LAW_AGENTS.matterContextNormalize, displayName: 'Family Law Matter Context Normalize', tier: 'intake', permittedLenses: ['family_law_production_lens'], permittedStates: ['MatterContextNormalize'], capabilityGroupA: 'extract' }),
  makeEntry({ agentId: FAMILY_LAW_AGENTS.jurisdictionCapture, displayName: 'Family Law Jurisdiction Capture', tier: 'matter_framing', permittedLenses: ['family_law_production_lens'], permittedStates: ['JurisdictionCapture'], capabilityGroupA: 'extract' }),
  makeEntry({ agentId: FAMILY_LAW_AGENTS.factExtraction, displayName: 'Family Law Fact Extraction', tier: 'fact_source_analysis', permittedLenses: ['family_law_production_lens'], permittedStates: ['FactExtraction'], capabilityGroupA: 'extract' }),
  makeEntry({ agentId: FAMILY_LAW_AGENTS.existingOrderExtract, displayName: 'Family Law Existing Order Extract', tier: 'fact_source_analysis', permittedLenses: ['family_law_production_lens'], permittedStates: ['ExistingOrderExtract'], capabilityGroupA: 'extract' }),
  makeEntry({ agentId: FAMILY_LAW_AGENTS.issueBloom, displayName: 'Family Law Issue Bloom', tier: 'issue_decomposition', permittedLenses: ['family_law_production_lens'], permittedStates: ['IssueBloom'], capabilityGroupA: 'decompose' }),
  makeEntry({ agentId: FAMILY_LAW_AGENTS.issuePrune, displayName: 'Family Law Issue Prune', tier: 'issue_decomposition', permittedLenses: ['family_law_production_lens'], permittedStates: ['IssuePrune'], capabilityGroupA: 'classify' }),
  makeEntry({ agentId: FAMILY_LAW_AGENTS.authorityVerification, displayName: 'Family Law Authority Verification', tier: 'authority_analysis', permittedLenses: ['family_law_production_lens'], permittedStates: ['AuthorityVerification'], capabilityGroupB: 'verify' }),
  makeEntry({ agentId: FAMILY_LAW_AGENTS.directLegalConclusion, displayName: 'Family Law Direct Legal Conclusion', tier: 'draft_generation', permittedLenses: ['family_law_production_lens'], permittedStates: ['DirectLegalConclusionDraft'], capabilityGroupA: 'draft' }),
  makeEntry({ agentId: FAMILY_LAW_AGENTS.clientAdviceDraft, displayName: 'Family Law Client Advice Draft', tier: 'draft_generation', permittedLenses: ['family_law_production_lens'], permittedStates: ['ClientAdviceDraft'], capabilityGroupA: 'draft' }),
  makeEntry({ agentId: FAMILY_LAW_AGENTS.courtFilingDraft, displayName: 'Family Law Court Filing Draft', tier: 'draft_generation', permittedLenses: ['family_law_production_lens'], permittedStates: ['CourtFilingDraftGenerate'], capabilityGroupA: 'draft' }),
  makeEntry({ agentId: FAMILY_LAW_AGENTS.releaseStatusDetermine, displayName: 'Family Law Release Status Determine', tier: 'release_governance', permittedLenses: ['family_law_production_lens'], permittedStates: ['ReleaseStatusDetermine'], capabilityGroupC: 'gate' }),

  // Shared / cross-lens agents
  makeEntry({ agentId: SHARED_AGENTS.intakeNormalize, displayName: 'Intake Normalization', tier: 'intake', permittedLenses: ALL_LENSES, permittedStates: ['ResearchQuestionNormalize', 'ClientQuestionNormalize', 'FilingTypeSelect', 'DocumentTypeIdentify', 'LegalQuestionNormalize'], capabilityGroupA: 'extract' }),
  makeEntry({ agentId: SHARED_AGENTS.lensClassifier, displayName: 'Lens Classifier', tier: 'lens_selection', permittedLenses: ALL_LENSES, permittedStates: ['*'], capabilityGroupA: 'classify' }),
  makeEntry({ agentId: SHARED_AGENTS.jurisdictionCapture, displayName: 'Jurisdiction / Forum Capture', tier: 'matter_framing', permittedLenses: ALL_LENSES, permittedStates: ['JurisdictionCapture'], capabilityGroupA: 'extract' }),
  makeEntry({ agentId: SHARED_AGENTS.factExtraction, displayName: 'Fact Extraction', tier: 'fact_source_analysis', permittedLenses: ALL_LENSES, permittedStates: ['FactExtraction'], capabilityGroupA: 'extract' }),
  makeEntry({ agentId: SHARED_AGENTS.authorityRetrieve, displayName: 'Authority Retrieval', tier: 'authority_analysis', permittedLenses: ALL_LENSES, permittedStates: ['AuthorityRetrieve', 'AuthorityIngest'], capabilityGroupA: 'retrieve' }),
  makeEntry({ agentId: SHARED_AGENTS.authorityVerification, displayName: 'Authority Verification', tier: 'verification', permittedLenses: ALL_LENSES, permittedStates: ['AuthorityVerification', 'MechanicalCheck', 'MachineAssessedSupport', 'CitatorLookup', 'VerificationLabel'], capabilityGroupB: 'verify' }),
  makeEntry({ agentId: SHARED_AGENTS.ruleElementMap, displayName: 'Rule Element Mapper', tier: 'authority_analysis', permittedLenses: ALL_LENSES, permittedStates: ['RuleElementMap'], capabilityGroupA: 'map' }),
  makeEntry({ agentId: SHARED_AGENTS.conclusionDraft, displayName: 'Legal Conclusion Draft', tier: 'draft_generation', permittedLenses: ALL_LENSES, permittedStates: ['ConclusionDraft', 'LegalConclusionDraft'], capabilityGroupA: 'draft' }),
  makeEntry({ agentId: SHARED_AGENTS.researchMemoDraft, displayName: 'Legal Research Memo Draft', tier: 'draft_generation', permittedLenses: ALL_LENSES, permittedStates: ['DraftMemoGenerate'], capabilityGroupA: 'draft' }),
  makeEntry({ agentId: SHARED_AGENTS.clientAdviceDraft, displayName: 'Client Advice Draft', tier: 'draft_generation', permittedLenses: ALL_LENSES, permittedStates: ['ClientAdviceDraft'], capabilityGroupA: 'draft' }),
  makeEntry({ agentId: SHARED_AGENTS.courtFilingDraft, displayName: 'Court Filing Draft', tier: 'draft_generation', permittedLenses: ALL_LENSES, permittedStates: ['FilingDraftGenerate', 'CourtFilingDraftGenerate'], capabilityGroupA: 'draft' }),
  makeEntry({ agentId: SHARED_AGENTS.redlineCandidate, displayName: 'Redline Candidate', tier: 'draft_generation', permittedLenses: ALL_LENSES, permittedStates: ['RedlineCandidateGenerate'], capabilityGroupA: 'redline' }),
  makeEntry({ agentId: SHARED_AGENTS.clauseMap, displayName: 'Clause Map', tier: 'fact_source_analysis', permittedLenses: ALL_LENSES, permittedStates: ['ClauseMapExtract'], capabilityGroupA: 'map' }),
  makeEntry({ agentId: SHARED_AGENTS.releaseStatusDetermine, displayName: 'Release Status Determine', tier: 'release_governance', permittedLenses: ALL_LENSES, permittedStates: ['ReleaseStatusDetermine'], capabilityGroupC: 'gate' }),
  makeEntry({ agentId: SHARED_AGENTS.attorneyReviewPacket, displayName: 'Attorney Review Packet', tier: 'professional_review', permittedLenses: ALL_LENSES, permittedStates: ['*'], capabilityGroupC: 'package' }),
  makeEntry({ agentId: SHARED_AGENTS.sourceToClaimTraceValidator, displayName: 'Source-to-Claim Trace Validator', tier: 'verification', permittedLenses: ALL_LENSES, permittedStates: ['*'], capabilityGroupB: 'verify' }),
];

export function registerAllMvpAgents(registry: { register: (e: AgentRegistryEntry) => void }): void {
  for (const e of MVP_AGENT_REGISTRATIONS) registry.register(e);
}
