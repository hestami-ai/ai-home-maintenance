/**
 * Authority verification types.
 *
 * Per docs/janumilegal_implementation_roadmap.md Wave 6 §6.2 and
 * docs/clv/canonical_vocabulary_v1.md §11.
 *
 * Verification status tiers (CLV §11) are NEVER collapsed:
 *   - source_located            (mechanical: corpus retrieval succeeded)
 *   - quote_matched             (mechanical: pinpoint quote present verbatim)
 *   - machine_assessed_support  (probabilistic: LLM/agent thinks authority supports proposition)
 *   - machine_assessed_treatment (probabilistic: classifier on treatment status)
 *   - citator_status            (commercial citator status; empty until Wave 8/9 license)
 *   - attorney_confirmation_required
 *   - attorney_confirmed        (AttorneyAction-bound)
 */

export type AuthorityType = 'statute' | 'rule' | 'case_law' | 'regulation' | 'court_form' | 'case_specific_order' | 'secondary' | 'unknown';

export type ControllingStatus = 'controlling' | 'persuasive' | 'unknown';

export type VerificationLabel =
  | 'source_located'
  | 'quote_matched'
  | 'machine_assessed_support'
  | 'machine_assessed_treatment'
  | 'citator_status'
  | 'attorney_confirmation_required'
  | 'attorney_confirmed';

export type CitatorTreatment =
  | 'good_law'
  | 'distinguished'
  | 'criticized'
  | 'overruled'
  | 'superseded'
  | 'no_data';

export interface AuthorityRef {
  readonly authorityId: string;
  readonly citation: string;
  readonly authorityType: AuthorityType;
  readonly jurisdiction: string;
}

export interface ParsedCitation {
  readonly raw: string;
  readonly reporter?: string;
  readonly volume?: string;
  readonly page?: string;
  readonly year?: string;
  readonly court?: string;
  readonly statuteSection?: string;
  readonly ruleNumber?: string;
  readonly parseOk: boolean;
  readonly parseErrors?: readonly string[];
}

export interface MechanicalCheckResult {
  readonly authorityId: string;
  readonly citationParsed: boolean;
  readonly sourceLocated: boolean;
  readonly quoteMatched?: boolean;
  readonly pinpointExists?: boolean;
  readonly statuteSectionExists?: boolean;
  readonly notes: readonly string[];
}

export interface MachineAssessedSupport {
  readonly authorityId: string;
  readonly proposition: string;
  readonly supports: 'supports' | 'partially_supports' | 'does_not_support' | 'unknown';
  readonly confidence: 'low' | 'medium' | 'high';
  readonly basis: string;
}

export interface MachineAssessedTreatment {
  readonly authorityId: string;
  readonly treatment: CitatorTreatment;
  readonly basis: string;
  readonly confidence: 'low' | 'medium' | 'high';
}

export interface CitatorStatus {
  readonly authorityId: string;
  readonly treatment: CitatorTreatment;
  readonly providerName: string;
  readonly retrievedAt: string;
}

export interface VerificationRecord {
  readonly authorityId: string;
  readonly mechanical?: MechanicalCheckResult;
  readonly machineAssessedSupport?: MachineAssessedSupport;
  readonly machineAssessedTreatment?: MachineAssessedTreatment;
  readonly citatorStatus?: CitatorStatus;
  readonly attorneyConfirmed?: { byAttorneyId: string; at: string; actionId: string };
  /** Display label per the never-collapse rule. */
  readonly displayLabel: VerificationLabel;
  /** True if attorney confirmation is required before reliance for any release target. */
  readonly attorneyConfirmationRequired: boolean;
}
