/**
 * Release Gate types.
 *
 * Per docs/janumilegal_implementation_roadmap.md Wave 7 §7.2.
 */

export type ReleaseStatus =
  | 'internal_draft'
  | 'attorney_review_required'
  | 'business_review_required'
  | 'client_release_blocked'
  | 'approved_for_internal_use'
  | 'approved_for_client_use'
  | 'approved_for_external_use'
  | 'approved_for_filing'
  | 'external_release_blocked'
  | 'insufficient_information'
  | 'held_pending_conflict_resolution'
  | 'held_pending_lnfr_resolution';

export type ReleaseTarget = 'internal' | 'client' | 'opposing' | 'court' | 'agency' | 'public';

export interface ReleaseGateInputs {
  readonly artifactId: string;
  readonly artifactType: string;
  readonly artifactVersionHash: string;
  readonly target: ReleaseTarget;
  /** Forum jurisdiction when target = 'court' (e.g., 'MD'). */
  readonly forumJurisdiction?: string;
  /** Active firm policy slot — Wave 7 ships a stub policy; firm config wires it. */
  readonly firmPolicy?: FirmReleasePolicy;

  // Status inputs from upstream layers
  readonly attorneyActions: readonly { action: string; attorneyId: string; attorneyRole: string; jurisdictionRequirementsMet: boolean; artifactVersionHash: string; acknowledgedFindings?: readonly string[] }[];

  /**
   * Wave 11 + Wave 12: open HIGH-severity reasoning-review findings on
   * the artifact's source state. Each finding ID must be acknowledged
   * by an AttorneyAction (action='acknowledged_finding' or
   * 'override_finding') whose `acknowledgedFindings` includes the id
   * AND whose `artifactVersionHash` matches the current artifact's
   * hash. Otherwise external release is blocked.
   */
  readonly openHighSeverityFindings?: readonly string[];
  readonly attorneyAdmissionsForActor?: readonly { jurisdiction: string; status: 'active' | 'inactive' | 'suspended' }[];

  readonly conflictHighestSeverity: 'none' | 'waivable' | 'requires_screening' | 'imputed' | 'non_waivable';
  readonly authorityVerificationStatus: 'attorney_confirmed' | 'machine_assessed_support' | 'machine_assessed_treatment' | 'citator_status' | 'source_located' | 'attorney_confirmation_required';
  readonly sourceTraceComplete: boolean;
  readonly privilegeFrameSnapshotPresent: boolean;
  /** Wave 8 LNFR layer input — Wave 7 accepts a stub. */
  readonly lnfrGateStatus: 'pass' | 'pending' | 'fail';
}

export interface FirmReleasePolicy {
  /** Practice areas requiring approving partner co-sign on client release. */
  readonly highRiskClientPractices: readonly string[];
  /** Whether the firm requires attorney_confirmed authority before client release (default true). */
  readonly requireAttorneyConfirmedAuthorityForClient?: boolean;
}

export interface ReleaseGateDecision {
  readonly artifactId: string;
  readonly status: ReleaseStatus;
  readonly target: ReleaseTarget;
  readonly blockers: readonly string[];
  readonly basis: string;
}
