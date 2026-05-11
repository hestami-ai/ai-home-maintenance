/**
 * Shared agent ids reused across MVP lens-pack manifests.
 *
 * Each id corresponds to a registered agent in the runtime registry. Wave 6
 * ships the registrations as constants only; agent implementations come in
 * Wave 7+ (LLM-backed) and are stubbed via test fixtures for E2E.
 */

export const SHARED_AGENTS = {
  intakeNormalize: 'intake_normalization_agent.v1',
  lensClassifier: 'lens_classifier_agent.v1',
  jurisdictionCapture: 'jurisdiction_capture_agent.v1',
  factExtraction: 'fact_extraction_agent.v1',
  authorityRetrieve: 'authority_retrieval_agent.v1',
  authorityVerification: 'authority_verification_agent.v1',
  ruleElementMap: 'rule_element_mapper.v1',
  conclusionDraft: 'legal_conclusion_draft_agent.v1',
  researchMemoDraft: 'legal_research_memo_draft_agent.v1',
  clientAdviceDraft: 'client_advice_draft_agent.v1',
  courtFilingDraft: 'court_filing_draft_agent.v1',
  redlineCandidate: 'redline_candidate_agent.v1',
  clauseMap: 'clause_map_agent.v1',
  releaseStatusDetermine: 'release_status_determine_agent.v1',
  attorneyReviewPacket: 'attorney_review_packet_agent.v1',
  sourceToClaimTraceValidator: 'source_to_claim_trace_validator.v1',
} as const;
