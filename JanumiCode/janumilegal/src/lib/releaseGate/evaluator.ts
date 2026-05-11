/**
 * Release Gate Evaluator.
 *
 * Per docs/janumilegal_implementation_roadmap.md Wave 7 §7.2.
 *
 * Deterministic. Inputs:
 *   - artifact type, target audience
 *   - attorney actions (recorded approvals/signatures)
 *   - source-trace completeness
 *   - authority verification status
 *   - privilege frame snapshot present
 *   - conflict highest severity
 *   - LNFR gate status (Wave 8 layer)
 *   - firm policy
 *
 * Outputs: a ReleaseStatus + blockers + basis.
 *
 * Hard rules:
 *   - non-waivable / imputed conflict ⇒ external_release_blocked.
 *   - LNFR fail ⇒ held_pending_lnfr_resolution.
 *   - Filing target requires AttorneyAction with action='signed_for_filing'
 *     by an attorney admitted in the forum jurisdiction; otherwise
 *     external_release_blocked.
 *   - Client release requires attorney approved_for_client_release on this
 *     exact artifactVersionHash; high-risk practice areas require an
 *     additional approving_partner sign-off.
 */

import { isHardReleaseBlock } from '../conflicts/types.js';
import type {
  ReleaseGateDecision,
  ReleaseGateInputs,
  ReleaseStatus,
  ReleaseTarget,
} from './types.js';

export class ReleaseGateEvaluator {
  evaluate(input: ReleaseGateInputs): ReleaseGateDecision {
    const blockers: string[] = [];

    // 1. Conflicts gate (highest priority)
    if (isHardReleaseBlock(input.conflictHighestSeverity)) {
      blockers.push(`conflict severity '${input.conflictHighestSeverity}' is a hard release block`);
      return decide(input, 'held_pending_conflict_resolution', blockers, 'conflict block');
    }

    // 2. LNFR gate
    if (input.lnfrGateStatus === 'fail') {
      blockers.push('LNFR gate failed');
      return decide(input, 'held_pending_lnfr_resolution', blockers, 'lnfr fail');
    }

    // 3. Privilege frame must be present (write-time invariant)
    if (!input.privilegeFrameSnapshotPresent) {
      blockers.push('privilege frame snapshot missing');
      return decide(input, 'insufficient_information', blockers, 'no privilege frame');
    }

    // 3.5 Reasoning-review HIGH findings unresolved (Wave 11 + Wave 12)
    if (input.openHighSeverityFindings && input.openHighSeverityFindings.length > 0) {
      const ackByCurrentVersion = new Set<string>();
      for (const a of input.attorneyActions) {
        if (a.artifactVersionHash !== input.artifactVersionHash) continue;
        if (a.action !== 'acknowledged_finding' && a.action !== 'override_finding') continue;
        for (const fid of a.acknowledgedFindings ?? []) ackByCurrentVersion.add(fid);
      }
      const unresolved = input.openHighSeverityFindings.filter((fid) => !ackByCurrentVersion.has(fid));
      if (unresolved.length > 0) {
        blockers.push(`${unresolved.length} unresolved HIGH reasoning finding(s): ${unresolved.slice(0, 3).join(', ')}${unresolved.length > 3 ? '…' : ''}`);
        return decide(input, 'external_release_blocked', blockers, 'reasoning findings unresolved');
      }
    }

    // 4. Target-specific evaluation
    switch (input.target) {
      case 'internal':
        return this.evaluateInternal(input, blockers);
      case 'client':
        return this.evaluateClient(input, blockers);
      case 'opposing':
      case 'agency':
        return this.evaluateExternalNonCourt(input, blockers);
      case 'court':
        return this.evaluateFiling(input, blockers);
      case 'public':
        return this.evaluatePublic(input, blockers);
    }
  }

  private evaluateInternal(input: ReleaseGateInputs, blockers: string[]): ReleaseGateDecision {
    const reviewed = input.attorneyActions.some(
      (a) => a.artifactVersionHash === input.artifactVersionHash && (a.action === 'reviewed' || a.action === 'approved_for_internal_use'),
    );
    if (!reviewed) {
      blockers.push('no attorney review or internal-use approval for this artifact version');
      return decide(input, 'attorney_review_required', blockers, 'awaiting reviewer');
    }
    return decide(input, 'approved_for_internal_use', blockers, 'reviewed');
  }

  private evaluateClient(input: ReleaseGateInputs, blockers: string[]): ReleaseGateDecision {
    const approval = input.attorneyActions.find(
      (a) => a.artifactVersionHash === input.artifactVersionHash && a.action === 'approved_for_client_release',
    );
    if (!approval) {
      blockers.push('no approved_for_client_release AttorneyAction for this artifact version');
      return decide(input, 'client_release_blocked', blockers, 'awaiting client-release approval');
    }
    if (input.firmPolicy?.requireAttorneyConfirmedAuthorityForClient !== false) {
      if (!['attorney_confirmed', 'citator_status'].includes(input.authorityVerificationStatus)) {
        blockers.push(`firm policy: client release requires attorney_confirmed authority; current = ${input.authorityVerificationStatus}`);
        return decide(input, 'client_release_blocked', blockers, 'authority not attorney-confirmed');
      }
    }
    if (!input.sourceTraceComplete) {
      blockers.push('source-to-claim trace incomplete');
      return decide(input, 'client_release_blocked', blockers, 'trace incomplete');
    }
    return decide(input, 'approved_for_client_use', blockers, 'client release approved');
  }

  private evaluateExternalNonCourt(input: ReleaseGateInputs, blockers: string[]): ReleaseGateDecision {
    const approved = input.attorneyActions.some(
      (a) => a.artifactVersionHash === input.artifactVersionHash && a.action === 'approved_for_filing',
    );
    if (!approved) {
      blockers.push('no approved_for_filing AttorneyAction for external release');
      return decide(input, 'external_release_blocked', blockers, 'awaiting external-release approval');
    }
    return decide(input, 'approved_for_external_use', blockers, 'external release approved');
  }

  private evaluateFiling(input: ReleaseGateInputs, blockers: string[]): ReleaseGateDecision {
    if (!input.forumJurisdiction) {
      blockers.push('court target requires forumJurisdiction');
      return decide(input, 'external_release_blocked', blockers, 'no forum');
    }

    const signing = input.attorneyActions.find(
      (a) => a.artifactVersionHash === input.artifactVersionHash && a.action === 'signed_for_filing',
    );
    if (!signing) {
      blockers.push('no signed_for_filing AttorneyAction by a signing_attorney');
      return decide(input, 'external_release_blocked', blockers, 'awaiting attorney signature');
    }
    if (signing.attorneyRole !== 'signing_attorney') {
      blockers.push(`signed_for_filing must come from signing_attorney role (got '${signing.attorneyRole}')`);
      return decide(input, 'external_release_blocked', blockers, 'wrong role for signing');
    }
    if (!signing.jurisdictionRequirementsMet) {
      blockers.push(`signing attorney is not admitted in forum jurisdiction ${input.forumJurisdiction}`);
      return decide(input, 'external_release_blocked', blockers, 'forum admission missing');
    }
    if (!input.sourceTraceComplete) {
      blockers.push('source-to-claim trace incomplete for filing');
      return decide(input, 'external_release_blocked', blockers, 'trace incomplete');
    }
    if (input.authorityVerificationStatus === 'attorney_confirmation_required') {
      blockers.push('authority verification requires attorney confirmation before filing');
      return decide(input, 'external_release_blocked', blockers, 'authority unconfirmed');
    }
    return decide(input, 'approved_for_filing', blockers, 'filing approved');
  }

  private evaluatePublic(input: ReleaseGateInputs, blockers: string[]): ReleaseGateDecision {
    const approvedByPartner = input.attorneyActions.some(
      (a) =>
        a.artifactVersionHash === input.artifactVersionHash &&
        a.action === 'approved_for_filing' &&
        a.attorneyRole === 'approving_partner',
    );
    if (!approvedByPartner) {
      blockers.push('public release requires approving_partner approval');
      return decide(input, 'external_release_blocked', blockers, 'no partner approval');
    }
    return decide(input, 'approved_for_external_use', blockers, 'public release approved');
  }
}

function decide(input: ReleaseGateInputs, status: ReleaseStatus, blockers: readonly string[], basis: string): ReleaseGateDecision {
  return { artifactId: input.artifactId, target: input.target, status, blockers, basis };
}

export type { ReleaseStatus, ReleaseTarget };
