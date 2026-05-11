/**
 * Lens Boundary Handoff (LBH).
 *
 * Per docs/janumilegal_product_description_evolution.md §6.2.
 *
 * Produced at every handoff-flagged state transition and at every cross-lens
 * boundary. The receiving state consumes the LBH as input. Context loss
 * between states becomes detectable: the Intent Drift Detector compares a
 * final artifact to the originating LBH and Mirror cards.
 *
 * LBHs are written to the matter track as work_product_mental — they encode
 * mental impressions (assumptions, pruning rationales, curator commentary).
 */

import type { Scope } from '../database/types.js';

export interface FactRef {
  readonly factId: string;
  readonly summary: string;
  readonly sourceRefs: readonly string[];
  readonly confidence:
    | 'document_supported'
    | 'client_reported'
    | 'opposing_party_claim'
    | 'attorney_note'
    | 'unverified'
    | 'conflicting';
}

export interface IssueRef {
  readonly issueId: string;
  readonly issueDomain: string;
  readonly disposition: 'retained' | 'deferred' | 'escalated';
}

export interface PrunedIssueWithReason {
  readonly issueId: string;
  readonly issueDomain: string;
  readonly decision: 'remove' | 'defer';
  readonly reason: string;
}

export interface AssumptionRef {
  readonly assumptionId: string;
  readonly text: string;
  readonly couldChangeIf?: string;
}

export interface PrivilegeContextSnapshot {
  readonly privilegeFrameRef: string;
  readonly version: number;
}

export interface ReleaseFrameSnapshot {
  readonly artifactReleaseStatuses: ReadonlyArray<{ artifactId: string; releaseStatus: string }>;
}

export interface AuthorityStateSnapshot {
  readonly retrievedCount: number;
  readonly machineAssessedSupportCount: number;
  readonly attorneyConfirmedCount: number;
  readonly citatorStatusCount: number;
}

/** The LBH itself. */
export interface LensBoundaryHandoff {
  readonly lbhId: string;
  readonly scope: Scope;
  readonly fromLensId: string;
  readonly fromLensVersion: string;
  readonly toLensId: string;
  readonly toLensVersion: string;
  readonly fromState: string;
  readonly toState: string;
  readonly governingObjective: string;
  readonly retainedFacts: readonly FactRef[];
  readonly retainedIssues: readonly IssueRef[];
  readonly prunedIssuesWithReasons: readonly PrunedIssueWithReason[];
  readonly authorityStatus: AuthorityStateSnapshot;
  readonly openQuestions: readonly string[];
  readonly assumptionsCarried: readonly AssumptionRef[];
  readonly privilegeContext: PrivilegeContextSnapshot;
  readonly releaseFrame: ReleaseFrameSnapshot;
  /** CLV term ids in active scope at handoff time. Receiving lens must declare these. */
  readonly clvContext: readonly string[];
  /** Human-readable summary produced by the Narrative Curator. */
  readonly curatorNotes: string;
  readonly producedAt: string;
}

/** Reference returned by the LBH service after issuance. */
export interface LbhRef {
  readonly lbhId: string;
  readonly fromState: string;
  readonly toState: string;
  readonly clvContext: readonly string[];
  readonly producedAt: string;
}
