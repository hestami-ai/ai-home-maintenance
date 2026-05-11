import { describe, it, expect } from 'vitest';
import { IssueRecursion } from '../lib/issueBloom/recursion.js';
import { candidate } from './fixtures/bloomAgent.js';
import type { IssueBloomAgent, BloomPassInput, IssueCandidate, SeedDomain } from '../lib/issueBloom/types.js';

/**
 * Wave 5 gate: recursive sub-issue decomposition completes on a multi-level
 * test fixture without runaway. Tier-based gate + Promise.all parallelism.
 *
 * The sub-bloom agent honors `subSeedDerive`: at pass 1 it produces exactly
 * one candidate per supplied seed (matching domain), so the three-pass
 * discipline is satisfied at every recursion level.
 */

class SeedHonoringAgent implements IssueBloomAgent {
  invocations = 0;
  async pass1(input: BloomPassInput) {
    this.invocations++;
    const candidates: IssueCandidate[] = input.seedDomains.map((s) => candidate({ issueId: `i.${s.domain}`, domain: s.domain }));
    return { pass: 1 as const, candidates, nonApplicable: [] };
  }
  async pass2(input: BloomPassInput) {
    return {
      pass: 2 as const,
      candidates: input.priorCandidates.map((c) => ({ ...c, lastModifiedAtPass: 2 as const })),
      attestation: { type: 'no_off_seed_plausible' as const, basis: 'recursive sub-bloom' },
    };
  }
  async pass3(input: BloomPassInput) {
    return { pass: 3 as const, candidates: input.priorCandidates.map((c) => ({ ...c, lastModifiedAtPass: 3 as const })) };
  }
}

describe('recursive sub-issue decomposition', () => {
  it('descends through declared sub-seed domains, with Promise.all sibling gating', async () => {
    const agent = new SeedHonoringAgent();
    const subSeedDerive = (parent: IssueCandidate): readonly SeedDomain[] => {
      switch (parent.issueDomain) {
        case 'enforcement':
          return [{ domain: 'enforcement.contempt' }, { domain: 'enforcement.makeup' }];
        case 'enforcement.contempt':
          return [{ domain: 'contempt.willfulness' }, { domain: 'contempt.notice' }];
        case 'enforcement.makeup':
          return [{ domain: 'makeup.compensatory_access' }];
        default:
          return [];
      }
    };

    const r = await new IssueRecursion(agent).recurse({
      rootCandidates: [candidate({ issueId: 'root.enforcement', domain: 'enforcement' })],
      options: { maxDepth: 3, subSeedDerive, subContextDerive: (p) => `parent: ${p.issueDomain}` },
    });

    expect(r.anyEscalated).toBe(false);
    expect(r.maxDepthReached).toBeGreaterThanOrEqual(2);
    expect(r.nodes.filter((n) => n.level === 1)).toHaveLength(1);
    expect(r.nodes.filter((n) => n.level === 2)).toHaveLength(2);
  });

  it('respects maxDepth (no runaway on a self-recurring tree)', async () => {
    const agent = new SeedHonoringAgent();
    const subSeedDerive = (parent: IssueCandidate): readonly SeedDomain[] => [{ domain: `${parent.issueDomain}.sub` }];
    const r = await new IssueRecursion(agent).recurse({
      rootCandidates: [candidate({ issueId: 'root', domain: 'root' })],
      options: { maxDepth: 2, subSeedDerive, subContextDerive: () => 'cyclic' },
    });
    expect(r.maxDepthReached).toBeLessThanOrEqual(2);
  });

  it('halts a branch when a sub-bloom escalates (illegal pass-3 new domain)', async () => {
    class EscalatingAgent implements IssueBloomAgent {
      async pass1(input: BloomPassInput) {
        return {
          pass: 1 as const,
          candidates: input.seedDomains.map((s) => candidate({ issueId: `i.${s.domain}`, domain: s.domain })),
          nonApplicable: [],
        };
      }
      async pass2(input: BloomPassInput) {
        return {
          pass: 2 as const,
          candidates: input.priorCandidates,
          attestation: { type: 'no_off_seed_plausible' as const, basis: 'x' },
        };
      }
      async pass3(input: BloomPassInput) {
        return {
          pass: 3 as const,
          candidates: [...input.priorCandidates, candidate({ issueId: 'late.add', domain: 'novel_late_domain', pass: 3 })],
        };
      }
    }
    const r = await new IssueRecursion(new EscalatingAgent()).recurse({
      rootCandidates: [candidate({ issueId: 'root', domain: 'root' })],
      options: {
        maxDepth: 3,
        subSeedDerive: (p) => [{ domain: `${p.issueDomain}.sub` }],
        subContextDerive: () => 'x',
      },
    });
    expect(r.anyEscalated).toBe(true);
  });
});
