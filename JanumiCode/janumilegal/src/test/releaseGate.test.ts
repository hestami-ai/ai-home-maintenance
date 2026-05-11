import { describe, it, expect } from 'vitest';
import { ReleaseGateEvaluator } from '../lib/releaseGate/evaluator.js';
import type { ReleaseGateInputs } from '../lib/releaseGate/types.js';

const VH = 'hash_v1';

function baseInput(overrides: Partial<ReleaseGateInputs> = {}): ReleaseGateInputs {
  return {
    artifactId: 'art1',
    artifactType: 'court_filing_draft',
    artifactVersionHash: VH,
    target: 'internal',
    attorneyActions: [],
    conflictHighestSeverity: 'none',
    authorityVerificationStatus: 'machine_assessed_support',
    sourceTraceComplete: true,
    privilegeFrameSnapshotPresent: true,
    lnfrGateStatus: 'pass',
    ...overrides,
  };
}

describe('Release Gate Evaluator', () => {
  const ev = new ReleaseGateEvaluator();

  it('non_waivable conflict ⇒ held_pending_conflict_resolution (hard release block)', () => {
    const r = ev.evaluate(baseInput({ conflictHighestSeverity: 'non_waivable', target: 'client' }));
    expect(r.status).toBe('held_pending_conflict_resolution');
    expect(r.blockers.some((b) => /conflict/.test(b))).toBe(true);
  });

  it('imputed conflict ⇒ held_pending_conflict_resolution', () => {
    const r = ev.evaluate(baseInput({ conflictHighestSeverity: 'imputed', target: 'court', forumJurisdiction: 'MD' }));
    expect(r.status).toBe('held_pending_conflict_resolution');
  });

  it('LNFR fail ⇒ held_pending_lnfr_resolution', () => {
    const r = ev.evaluate(baseInput({ lnfrGateStatus: 'fail' }));
    expect(r.status).toBe('held_pending_lnfr_resolution');
  });

  it('missing privilege frame snapshot ⇒ insufficient_information', () => {
    const r = ev.evaluate(baseInput({ privilegeFrameSnapshotPresent: false }));
    expect(r.status).toBe('insufficient_information');
  });

  it('internal target without review ⇒ attorney_review_required', () => {
    const r = ev.evaluate(baseInput({ target: 'internal' }));
    expect(r.status).toBe('attorney_review_required');
  });

  it('internal target WITH review ⇒ approved_for_internal_use', () => {
    const r = ev.evaluate(baseInput({
      target: 'internal',
      attorneyActions: [{ action: 'reviewed', attorneyId: 'a1', attorneyRole: 'reviewer', jurisdictionRequirementsMet: true, artifactVersionHash: VH }],
    }));
    expect(r.status).toBe('approved_for_internal_use');
  });

  it('client release without approval ⇒ client_release_blocked', () => {
    const r = ev.evaluate(baseInput({ target: 'client' }));
    expect(r.status).toBe('client_release_blocked');
  });

  it('client release with approval but no attorney_confirmed authority ⇒ client_release_blocked', () => {
    const r = ev.evaluate(baseInput({
      target: 'client',
      attorneyActions: [{ action: 'approved_for_client_release', attorneyId: 'a1', attorneyRole: 'attorney_of_record', jurisdictionRequirementsMet: true, artifactVersionHash: VH }],
      authorityVerificationStatus: 'machine_assessed_support',
    }));
    expect(r.status).toBe('client_release_blocked');
    expect(r.blockers.some((b) => /authority/.test(b))).toBe(true);
  });

  it('client release with approval AND attorney_confirmed authority ⇒ approved_for_client_use', () => {
    const r = ev.evaluate(baseInput({
      target: 'client',
      attorneyActions: [{ action: 'approved_for_client_release', attorneyId: 'a1', attorneyRole: 'attorney_of_record', jurisdictionRequirementsMet: true, artifactVersionHash: VH }],
      authorityVerificationStatus: 'attorney_confirmed',
    }));
    expect(r.status).toBe('approved_for_client_use');
  });

  it('FILING REQUIRES forum admission — refuses when signing attorney is not admitted', () => {
    const r = ev.evaluate(baseInput({
      target: 'court',
      forumJurisdiction: 'VA',
      attorneyActions: [{ action: 'signed_for_filing', attorneyId: 'a1', attorneyRole: 'signing_attorney', jurisdictionRequirementsMet: false, artifactVersionHash: VH }],
      authorityVerificationStatus: 'attorney_confirmed',
    }));
    expect(r.status).toBe('external_release_blocked');
    expect(r.blockers.some((b) => /admitted in forum jurisdiction/.test(b))).toBe(true);
  });

  it('FILING APPROVED when signing attorney is admitted, role correct, trace complete, authority verified', () => {
    const r = ev.evaluate(baseInput({
      target: 'court',
      forumJurisdiction: 'MD',
      attorneyActions: [{ action: 'signed_for_filing', attorneyId: 'a1', attorneyRole: 'signing_attorney', jurisdictionRequirementsMet: true, artifactVersionHash: VH }],
      authorityVerificationStatus: 'attorney_confirmed',
    }));
    expect(r.status).toBe('approved_for_filing');
  });

  it('FILING with wrong role refused', () => {
    const r = ev.evaluate(baseInput({
      target: 'court',
      forumJurisdiction: 'MD',
      attorneyActions: [{ action: 'signed_for_filing', attorneyId: 'a1', attorneyRole: 'reviewer', jurisdictionRequirementsMet: true, artifactVersionHash: VH }],
      authorityVerificationStatus: 'attorney_confirmed',
    }));
    expect(r.status).toBe('external_release_blocked');
    expect(r.blockers.some((b) => /signing_attorney/.test(b))).toBe(true);
  });

  it('FILING blocked when authority is only attorney_confirmation_required', () => {
    const r = ev.evaluate(baseInput({
      target: 'court',
      forumJurisdiction: 'MD',
      attorneyActions: [{ action: 'signed_for_filing', attorneyId: 'a1', attorneyRole: 'signing_attorney', jurisdictionRequirementsMet: true, artifactVersionHash: VH }],
      authorityVerificationStatus: 'attorney_confirmation_required',
    }));
    expect(r.status).toBe('external_release_blocked');
  });

  it('public release requires approving_partner', () => {
    const r1 = ev.evaluate(baseInput({
      target: 'public',
      attorneyActions: [{ action: 'approved_for_filing', attorneyId: 'a1', attorneyRole: 'reviewer', jurisdictionRequirementsMet: true, artifactVersionHash: VH }],
    }));
    expect(r1.status).toBe('external_release_blocked');

    const r2 = ev.evaluate(baseInput({
      target: 'public',
      attorneyActions: [{ action: 'approved_for_filing', attorneyId: 'a1', attorneyRole: 'approving_partner', jurisdictionRequirementsMet: true, artifactVersionHash: VH }],
    }));
    expect(r2.status).toBe('approved_for_external_use');
  });

  it('approval bound to specific artifactVersionHash — different version not honored', () => {
    const r = ev.evaluate(baseInput({
      target: 'internal',
      artifactVersionHash: 'hash_v2',
      attorneyActions: [{ action: 'reviewed', attorneyId: 'a1', attorneyRole: 'reviewer', jurisdictionRequirementsMet: true, artifactVersionHash: 'hash_v1' }],
    }));
    expect(r.status).toBe('attorney_review_required');
  });
});
