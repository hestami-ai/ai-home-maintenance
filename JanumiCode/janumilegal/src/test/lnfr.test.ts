import { describe, it, expect } from 'vitest';
import { LNFR_DOMAINS } from '../lib/lnfr/domains.js';
import { LnfrGateEvaluator } from '../lib/lnfr/gate.js';
import { LnfrThreePassBloom, LnfrBloomViolation, lnfrFinding } from '../lib/lnfr/bloom.js';
import type { LnfrBloomAgent, LnfrBloomInput } from '../lib/lnfr/bloom.js';
import { ReleaseGateEvaluator } from '../lib/releaseGate/evaluator.js';
import type { LnfrFinding } from '../lib/lnfr/types.js';

describe('LNFR gate aggregator', () => {
  const ev = new LnfrGateEvaluator();

  it('all 13 domains "pass" ⇒ gate pass', () => {
    const r = ev.evaluate({
      domainStatuses: LNFR_DOMAINS.map((d) => ({ domain: d, status: 'pass' as const, findings: [] })),
    });
    expect(r.status).toBe('pass');
  });

  it('missing domain ⇒ pending', () => {
    const r = ev.evaluate({
      domainStatuses: LNFR_DOMAINS.slice(0, 5).map((d) => ({ domain: d, status: 'pass' as const, findings: [] })),
    });
    expect(r.status).toBe('pending');
  });

  it('any block-severity finding ⇒ fail', () => {
    const r = ev.evaluate({
      domainStatuses: LNFR_DOMAINS.map((d) => ({ domain: d, status: 'pass' as const, findings: [] })),
      extraFindings: [
        lnfrFinding({
          domain: 'deadlines_and_limitations',
          severity: 'block',
          category: 'missed_deadline',
          message: 'response deadline 2026-04-15 missed',
        }),
      ],
    });
    expect(r.status).toBe('fail');
  });
});

describe('Release Gate consumes LNFR fail', () => {
  it('LNFR fail ⇒ held_pending_lnfr_resolution at the Release Gate', () => {
    const r = new ReleaseGateEvaluator().evaluate({
      artifactId: 'art1', artifactType: 'court_filing_draft', artifactVersionHash: 'h',
      target: 'court', forumJurisdiction: 'MD',
      attorneyActions: [{ action: 'signed_for_filing', attorneyId: 'a1', attorneyRole: 'signing_attorney', jurisdictionRequirementsMet: true, artifactVersionHash: 'h' }],
      conflictHighestSeverity: 'none',
      authorityVerificationStatus: 'attorney_confirmed',
      sourceTraceComplete: true,
      privilegeFrameSnapshotPresent: true,
      lnfrGateStatus: 'fail',
    });
    expect(r.status).toBe('held_pending_lnfr_resolution');
  });
});

describe('LNFR three-pass bloom', () => {
  function makeAgent(allDomainsCovered = true, addOffDomain = true): LnfrBloomAgent {
    return {
      pass1(input: LnfrBloomInput) {
        if (!allDomainsCovered) {
          return { findings: [], nonApplicable: [] };
        }
        return {
          findings: LNFR_DOMAINS.map((d) =>
            lnfrFinding({ domain: d, severity: 'info', category: 'seed', message: `seed coverage ${d}` }),
          ),
          nonApplicable: [],
        };
      },
      pass2(_input: LnfrBloomInput, prior: readonly LnfrFinding[]) {
        const findings: LnfrFinding[] = [...prior];
        if (addOffDomain) {
          // matter-specific additional finding within an existing domain — counts as divergence in our shape
          findings.push(lnfrFinding({
            domain: 'sanctions_risk',
            severity: 'warn',
            category: 'matter_specific',
            message: 'attorney fees claim aggressive',
          }));
        }
        return {
          findings,
          attestation: addOffDomain ? undefined : { type: 'no_off_domain_plausible', basis: 'no off-domain plausible for this matter' },
        };
      },
      pass3(_input: LnfrBloomInput, prior: readonly LnfrFinding[]) {
        return { findings: prior };
      },
    };
  }

  it('completes with all-domain coverage + attestation', () => {
    const r = new LnfrThreePassBloom(makeAgent(true, false)).run({ matterContextSummary: 'x' });
    expect(r.status).toBe('completed');
  });

  it('VIOLATES when pass 1 misses seed coverage', () => {
    const r = () => new LnfrThreePassBloom(makeAgent(false, false)).run({ matterContextSummary: 'x' });
    expect(r).toThrow(LnfrBloomViolation);
  });

  it('VIOLATES when pass 2 has neither divergence nor attestation', () => {
    const agent: LnfrBloomAgent = {
      pass1: () => ({
        findings: LNFR_DOMAINS.map((d) => lnfrFinding({ domain: d, severity: 'info', category: 's', message: 's' })),
        nonApplicable: [],
      }),
      pass2: (_i, prior) => ({ findings: [...prior] }),
      pass3: (_i, prior) => ({ findings: prior }),
    };
    expect(() => new LnfrThreePassBloom(agent).run({ matterContextSummary: 'x' })).toThrow(/DIVERGENCE_REQUIRED|attestation/);
  });
});
