/**
 * Synthetic firm config — MD-primary, family-law focused.
 *
 * Used by Wave 9 onboarding tests. Contains no design-partner identity.
 */

import type { FirmConfig } from '../types.js';

export const synthMdConfig: FirmConfig = {
  firmId: 'firm_synth_md',
  displayName: 'Synthetic MD Firm (test)',
  primaryJurisdiction: 'MD',
  practiceAreas: ['family_law', 'criminal_defense'],
  enabledLensIds: [
    'family_law_production_lens',
    'legal_research_memo_lens',
    'client_advice_draft_lens',
    'court_filing_draft_lens',
    'direct_legal_conclusion_lens',
    'authority_verification_lens',
  ],
  admittedJurisdictions: ['MD', 'DC'],
  retentionDays: {
    family_law_with_minors: 365 * 18,
    family_law_no_minors: 365 * 7,
    criminal_defense: 365 * 10,
    civil_default: 365 * 7,
  },
  releasePolicy: {
    highRiskClientPractices: ['family_law'],
    requireAttorneyConfirmedAuthorityForClient: true,
  },
  citatorJurisdictionScope: ['MD', 'Maryland'],
  citatorSeed: [
    { authorityId: 'MD-FAM-CUSTODY-CASE-001', treatment: 'good_law' },
    { authorityId: 'MD-FAM-ACCESS-ENFORCEMENT-001', treatment: 'good_law' },
  ],
  briefBankScrubTokenCategories: ['client_name', 'opposing_party_name'],
  authorityFreshness: { maxAgeDays: 365 },
};
