import { describe, it, expect } from 'vitest';
import { computeFinalSynthesisDecision } from '../../../../lib/review/harness/finalSynthesisDecision';
import type { ValidatorFinding } from '../../../../lib/review/harness/validatorRegistry';

function f(
  severity: 'HIGH' | 'MEDIUM' | 'LOW',
  validatorId = 'some_validator',
  type = 'some_type',
): ValidatorFinding {
  return {
    validatorId,
    severity,
    type,
    summary: 's',
    location: '$',
    detail: 'd',
    recommendation: 'r',
  };
}

const UNAVAILABLE = (id = 'x'): { validatorId: string; error: string } => ({
  validatorId: id,
  error: 'validator_unavailable: prompt template missing',
});

describe('computeFinalSynthesisDecision', () => {
  it('0 findings -> ACCEPT', () => {
    const r = computeFinalSynthesisDecision([], []);
    expect(r.decision).toBe('ACCEPT');
  });

  it('LOW only -> ACCEPT_WITH_NOTES', () => {
    const r = computeFinalSynthesisDecision([f('LOW'), f('LOW')], []);
    expect(r.decision).toBe('ACCEPT_WITH_NOTES');
  });

  it('1 MEDIUM -> REVISE', () => {
    const r = computeFinalSynthesisDecision([f('MEDIUM')], []);
    expect(r.decision).toBe('REVISE');
  });

  it('1 HIGH -> REVISE', () => {
    const r = computeFinalSynthesisDecision([f('HIGH')], []);
    expect(r.decision).toBe('REVISE');
  });

  it('2 HIGH -> QUARANTINE', () => {
    const r = computeFinalSynthesisDecision([f('HIGH'), f('HIGH')], []);
    expect(r.decision).toBe('QUARANTINE');
  });

  it('1 HIGH + 1 validator_unavailable -> ESCALATE', () => {
    const r = computeFinalSynthesisDecision([f('HIGH')], [UNAVAILABLE()]);
    expect(r.decision).toBe('ESCALATE');
    expect(r.validatorUnavailableCount).toBe(1);
    expect(r.rationale).toContain('ESCALATE');
  });

  it('1 MEDIUM + 1 validator_unavailable -> REVISE escalated to QUARANTINE', () => {
    const r = computeFinalSynthesisDecision([f('MEDIUM')], [UNAVAILABLE()]);
    expect(r.decision).toBe('QUARANTINE');
    expect(r.rationale).toContain('REVISE escalated to QUARANTINE');
  });

  it('validator_unavailable alone -> REVISE (escalated from ACCEPT)', () => {
    const r = computeFinalSynthesisDecision([], [UNAVAILABLE()]);
    expect(r.decision).toBe('REVISE');
    expect(r.rationale).toContain('ACCEPT escalated to REVISE');
  });

  it('LOW + validator_unavailable -> REVISE (escalated from ACCEPT_WITH_NOTES)', () => {
    const r = computeFinalSynthesisDecision([f('LOW')], [UNAVAILABLE()]);
    expect(r.decision).toBe('REVISE');
  });

  it('contractDesignFindings present + only LOW -> ACCEPT_WITH_NOTES (no escalation; informational)', () => {
    const cd: ValidatorFinding = {
      validatorId: 'reasoning_quality_validator',
      severity: 'HIGH', // even HIGH on a contract-design finding does NOT escalate
      type: 'contract_design_defect',
      summary: 'enum lacks scope value',
      location: '$.openLoops',
      detail: 'd',
      recommendation: 'r',
    };
    const r = computeFinalSynthesisDecision([cd, f('LOW')], []);
    expect(r.decision).toBe('ACCEPT_WITH_NOTES');
    expect(r.contractDesignFindings.length).toBe(1);
    expect(r.contractDesignFindings[0].validator_id).toBe(
      'reasoning_quality_validator',
    );
  });

  it('contractDesignFindings of subtype contract_design_* are also collated', () => {
    const cd: ValidatorFinding = {
      validatorId: 'reasoning_quality_validator',
      severity: 'MEDIUM',
      type: 'contract_design_field_missing',
      summary: 's',
      location: '$',
      detail: 'd',
      recommendation: 'r',
    };
    const r = computeFinalSynthesisDecision([cd], []);
    // MEDIUM contract-design finding is informational; with no other
    // findings, the decision should still be ACCEPT.
    expect(r.decision).toBe('ACCEPT');
    expect(r.contractDesignFindings.length).toBe(1);
  });

  it('failure messages without the validator_unavailable marker do NOT escalate', () => {
    const r = computeFinalSynthesisDecision(
      [f('LOW')],
      [{ validatorId: 'x', error: 'transient_network_error' }],
    );
    expect(r.decision).toBe('ACCEPT_WITH_NOTES');
    expect(r.validatorUnavailableCount).toBe(0);
  });

  it('rationale captures all severity counts', () => {
    const r = computeFinalSynthesisDecision(
      [f('HIGH'), f('MEDIUM'), f('LOW'), f('LOW')],
      [],
    );
    expect(r.rationale).toContain('1 HIGH');
    expect(r.rationale).toContain('1 MEDIUM');
    expect(r.rationale).toContain('2 LOW');
  });
});
