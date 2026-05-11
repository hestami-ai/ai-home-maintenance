/**
 * AttorneyAction model.
 *
 * Per docs/janumilegal_product_description_evolution.md §9 and
 * docs/janumilegal_implementation_roadmap.md Wave 7 §7.1.
 *
 * Replaces boolean approval everywhere. Every release-relevant decision is
 * an AttorneyAction record bound to:
 *   - the attorney's identity + bar admissions;
 *   - the artifact's exact bytes (versionHash);
 *   - a specific action category.
 */

export type AttorneyRole =
  | 'drafter'
  | 'supervising_attorney'
  | 'reviewer'
  | 'attorney_of_record'
  | 'signing_attorney'
  | 'approving_partner';

export type AttorneyActionType =
  | 'drafted'
  | 'reviewed'
  | 'approved_for_internal_use'
  | 'approved_for_client_release'
  | 'approved_for_filing'
  | 'signed_for_filing'
  | 'signed_engagement'
  | 'ratified'
  | 'approved_for_firm_knowledge_promotion'
  // Wave 12 — reasoning-review reconciliation:
  | 'acknowledged_finding'
  | 'override_finding';

export type SignatureMode = 'wet' | 'electronic' | 'platform_attestation' | 'ecf_compatible';

export interface AdmissionRef {
  readonly jurisdiction: string;
  readonly barNumber: string;
}

export interface AttorneyAction {
  readonly actionId: string;
  readonly firmId: string;
  readonly clientId: string;
  readonly matterId: string;
  readonly artifactId: string;
  readonly artifactVersionHash: string;
  readonly attorneyId: string;
  readonly attorneyRole: AttorneyRole;
  readonly action: AttorneyActionType;
  readonly signatureMode?: SignatureMode;
  readonly jurisdictionRequirementsMet: boolean;
  readonly barNumbersAtAction: readonly AdmissionRef[];
  readonly timestamp: string;
  readonly governedStreamEventId: string;

  /**
   * Wave 12: list of reasoning-review finding IDs this action acknowledges
   * or overrides. Required when action is 'acknowledged_finding' or
   * 'override_finding'. Bound to artifactVersionHash so a downstream
   * artifact change invalidates the acknowledgement and the harness must
   * re-run on the new version.
   */
  readonly acknowledgedFindings?: readonly string[];
  /** Required when action='override_finding' — attorney's rationale for disagreeing with the harness. */
  readonly overrideRationale?: string;
}
