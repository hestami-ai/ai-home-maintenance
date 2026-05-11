/**
 * Wave 5 gate: three-pass Issue Bloom (Proposal C).
 *
 *   - seed-only matter   ⇒ completed
 *   - novel matter       ⇒ completed (off-seed candidates allowed at pass 2)
 *   - mixed matter       ⇒ completed
 *   - late-addition pass3 ⇒ escalated
 */

import { describe, it, expect } from 'vitest';
import { ThreePassBloom, BloomViolation, bloomMetricsForResult } from '../lib/issueBloom/threePass.js';
import { ScriptedBloomAgent, candidate } from './fixtures/bloomAgent.js';

const SEEDS = [
  { domain: 'enforcement' },
  { domain: 'contempt' },
  { domain: 'best_interests' },
];

describe('three-pass Issue Bloom (Proposal C)', () => {
  it('SEED-ONLY matter completes cleanly', async () => {
    const agent = new ScriptedBloomAgent({
      pass1: {
        candidates: [
          candidate({ issueId: 'i1', domain: 'enforcement' }),
          candidate({ issueId: 'i2', domain: 'contempt' }),
          candidate({ issueId: 'i3', domain: 'best_interests' }),
        ],
      },
      pass2: {
        candidates: [
          candidate({ issueId: 'i1', domain: 'enforcement', pass: 2 }),
          candidate({ issueId: 'i2', domain: 'contempt', pass: 2 }),
          candidate({ issueId: 'i3', domain: 'best_interests', pass: 2 }),
        ],
        attestation: { type: 'no_off_seed_plausible', basis: 'matter is straightforward enforcement; no off-seed plausible' },
      },
      pass3: {
        candidates: [
          candidate({ issueId: 'i1', domain: 'enforcement', pass: 3 }),
          candidate({ issueId: 'i2', domain: 'contempt', pass: 3 }),
          candidate({ issueId: 'i3', domain: 'best_interests', pass: 3 }),
        ],
      },
    });
    const r = await new ThreePassBloom(agent).run({ seedDomains: SEEDS, matterContextSummary: 'seed-only' });
    expect(r.status).toBe('completed');
    expect(r.candidates).toHaveLength(3);
    expect(r.lateAdditionCount).toBe(0);
    expect(r.divergenceCount).toBe(0);

    const m = bloomMetricsForResult(r, SEEDS);
    expect(m.seedCoverageRate).toBe(1);
    expect(m.lateAdditionRate).toBe(0);
  });

  it('NOVEL matter completes — pass 2 introduces off-seed', async () => {
    const agent = new ScriptedBloomAgent({
      pass1: {
        candidates: [
          candidate({ issueId: 'i1', domain: 'enforcement' }),
          candidate({ issueId: 'i2', domain: 'contempt' }),
        ],
        nonApplicable: [{ domain: 'best_interests', reason: 'no minor child involved' }],
      },
      pass2: {
        candidates: [
          candidate({ issueId: 'i1', domain: 'enforcement', pass: 2 }),
          candidate({ issueId: 'i2', domain: 'contempt', pass: 2 }),
          candidate({ issueId: 'i4', domain: 'spousal_support_offset', pass: 2 }),
        ],
      },
      pass3: {
        candidates: [
          candidate({ issueId: 'i1', domain: 'enforcement', pass: 3 }),
          candidate({ issueId: 'i2', domain: 'contempt', pass: 3 }),
          candidate({ issueId: 'i4', domain: 'spousal_support_offset', pass: 3 }),
        ],
      },
    });
    const r = await new ThreePassBloom(agent).run({ seedDomains: SEEDS, matterContextSummary: 'novel' });
    expect(r.status).toBe('completed');
    expect(r.divergenceCount).toBeGreaterThanOrEqual(1);
    expect(r.candidates.some((c) => c.issueDomain === 'spousal_support_offset')).toBe(true);
    expect(r.nonApplicable.some((n) => n.domain === 'best_interests')).toBe(true);
  });

  it('MIXED matter completes — divergence + consolidation', async () => {
    const agent = new ScriptedBloomAgent({
      pass1: {
        candidates: [
          candidate({ issueId: 'i1', domain: 'enforcement' }),
          candidate({ issueId: 'i2', domain: 'contempt' }),
          candidate({ issueId: 'i3', domain: 'best_interests' }),
        ],
      },
      pass2: {
        candidates: [
          candidate({ issueId: 'i1', domain: 'enforcement', pass: 2 }),
          candidate({ issueId: 'i2', domain: 'contempt', pass: 2 }),
          candidate({ issueId: 'i3', domain: 'best_interests', pass: 2 }),
          candidate({ issueId: 'i5', domain: 'evidence_sufficiency', pass: 2 }),
        ],
      },
      // pass 3 consolidates: merges contempt into enforcement; restates evidence
      pass3: {
        candidates: [
          candidate({ issueId: 'i1', domain: 'enforcement', pass: 3 }),
          candidate({ issueId: 'i3', domain: 'best_interests', pass: 3 }),
          candidate({ issueId: 'i5', domain: 'evidence_sufficiency', pass: 3 }),
        ],
      },
    });
    const r = await new ThreePassBloom(agent).run({ seedDomains: SEEDS, matterContextSummary: 'mixed' });
    expect(r.status).toBe('completed');
    expect(r.candidates.map((c) => c.issueDomain).sort()).toEqual(['best_interests', 'enforcement', 'evidence_sufficiency']);
  });

  it('LATE-ADDITION in pass 3 ESCALATES (forbidden new domain)', async () => {
    const agent = new ScriptedBloomAgent({
      pass1: {
        candidates: [
          candidate({ issueId: 'i1', domain: 'enforcement' }),
          candidate({ issueId: 'i2', domain: 'contempt' }),
          candidate({ issueId: 'i3', domain: 'best_interests' }),
        ],
      },
      pass2: {
        candidates: [
          candidate({ issueId: 'i1', domain: 'enforcement', pass: 2 }),
          candidate({ issueId: 'i2', domain: 'contempt', pass: 2 }),
          candidate({ issueId: 'i3', domain: 'best_interests', pass: 2 }),
        ],
        attestation: { type: 'no_off_seed_plausible', basis: 'no off-seed plausible' },
      },
      pass3: {
        // forbidden: introduces 'modification_of_custody' which is neither in pass1 nor pass2
        candidates: [
          candidate({ issueId: 'i1', domain: 'enforcement', pass: 3 }),
          candidate({ issueId: 'i2', domain: 'contempt', pass: 3 }),
          candidate({ issueId: 'i9', domain: 'modification_of_custody', pass: 3 }),
        ],
      },
    });
    const r = await new ThreePassBloom(agent).run({ seedDomains: SEEDS, matterContextSummary: 'illegal late-addition' });
    expect(r.status).toBe('escalated');
    expect(r.lateAdditionCount).toBe(1);
    expect(r.escalationReason).toMatch(/modification_of_custody/);
  });

  it('PASS 1 missing seed coverage VIOLATES (no candidate, no non-applicability)', async () => {
    const agent = new ScriptedBloomAgent({
      pass1: {
        candidates: [
          candidate({ issueId: 'i1', domain: 'enforcement' }),
          candidate({ issueId: 'i2', domain: 'contempt' }),
          // 'best_interests' missing AND no non-applicability record
        ],
      },
    });
    await expect(new ThreePassBloom(agent).run({ seedDomains: SEEDS, matterContextSummary: 'broken' })).rejects.toThrow(BloomViolation);
  });

  it('PASS 1 introducing off-seed VIOLATES (only seed coverage permitted)', async () => {
    const agent = new ScriptedBloomAgent({
      pass1: {
        candidates: [
          candidate({ issueId: 'i1', domain: 'enforcement' }),
          candidate({ issueId: 'i2', domain: 'contempt' }),
          candidate({ issueId: 'i3', domain: 'best_interests' }),
          candidate({ issueId: 'i4', domain: 'novel_off_seed' }), // illegal at pass 1
        ],
      },
    });
    await expect(new ThreePassBloom(agent).run({ seedDomains: SEEDS, matterContextSummary: 'broken' })).rejects.toThrow(/PASS1_OFFSEED_VIOLATION|off-seed/);
  });

  it('PASS 2 with no off-seed AND no attestation VIOLATES', async () => {
    const agent = new ScriptedBloomAgent({
      pass1: {
        candidates: [
          candidate({ issueId: 'i1', domain: 'enforcement' }),
          candidate({ issueId: 'i2', domain: 'contempt' }),
          candidate({ issueId: 'i3', domain: 'best_interests' }),
        ],
      },
      pass2: {
        candidates: [
          candidate({ issueId: 'i1', domain: 'enforcement', pass: 2 }),
          candidate({ issueId: 'i2', domain: 'contempt', pass: 2 }),
          candidate({ issueId: 'i3', domain: 'best_interests', pass: 2 }),
        ],
        // no attestation, no new off-seed
      },
    });
    await expect(new ThreePassBloom(agent).run({ seedDomains: SEEDS, matterContextSummary: 'pass2-broken' })).rejects.toThrow(/DIVERGENCE_REQUIRED|attestation/);
  });
});
