/**
 * Synthetic firm config — VA-primary, business-civil focused.
 */

import type { FirmConfig } from '../types.js';

export const synthVaConfig: FirmConfig = {
  firmId: 'firm_synth_va',
  displayName: 'Synthetic VA Firm (test)',
  primaryJurisdiction: 'VA',
  practiceAreas: ['business_civil', 'transactional'],
  enabledLensIds: [
    'legal_research_memo_lens',
    'client_advice_draft_lens',
    'court_filing_draft_lens',
    'redline_lens',
    'direct_legal_conclusion_lens',
    'authority_verification_lens',
  ],
  admittedJurisdictions: ['VA', 'DC'],
  retentionDays: {
    business_civil: 365 * 10,
    transactional: 365 * 10,
    civil_default: 365 * 7,
  },
  releasePolicy: {
    highRiskClientPractices: ['business_civil'],
    requireAttorneyConfirmedAuthorityForClient: true,
  },
  citatorJurisdictionScope: ['VA', 'Virginia'],
  citatorSeed: [],
  briefBankScrubTokenCategories: ['client_name', 'opposing_party_name', 'specific_dates'],
  authorityFreshness: { maxAgeDays: 270 },
};
