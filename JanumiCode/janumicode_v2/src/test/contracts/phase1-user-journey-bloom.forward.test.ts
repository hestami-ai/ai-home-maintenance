import { describe, it, expect } from 'vitest';
import { runContractSuite } from './runner';
import { phase1UserJourneyBloomContract, type UserJourneyBloomArtifact } from './phase1-user-journey-bloom.contract';
import ideal from './fixtures/phase1-user-journey-bloom.ideal.json' assert { type: 'json' };
import fr from './fixtures/phase2-functional-requirements.ideal.json' assert { type: 'json' };

describe('Phase 1.3a user_journey_bloom contract — forward', () => {
  it('ideal fixture passes (all UJ refs in FR resolve)', () => {
    const context = {
      workflowRunId: 'fwd',
      relatedArtifacts: new Map<string, ReadonlyArray<unknown>>([['functional_requirements', [fr]]]),
    };
    const results = runContractSuite(
      phase1UserJourneyBloomContract,
      ideal as unknown as UserJourneyBloomArtifact,
      context,
    );
    const failures = results.filter((r) => !r.passed);
    if (failures.length) console.error(failures.map((f) => `${f.clauseId}: ${f.message}`).join('\n'));
    expect(failures).toEqual([]);
  });

  it('breaks C-1.3a.1 (Gap #7) when bloom is empty but UJ refs exist elsewhere', () => {
    const empty: UserJourneyBloomArtifact = { kind: 'user_journey_bloom', user_journeys: [] };
    const context = {
      workflowRunId: 'neg',
      relatedArtifacts: new Map<string, ReadonlyArray<unknown>>([['functional_requirements', [fr]]]),
    };
    const results = runContractSuite(phase1UserJourneyBloomContract, empty, context);
    const f = results.find((r) => r.clauseId === 'C-1.3a.1');
    expect(f?.passed).toBe(false);
    expect(f?.message).toContain('Gap #7');
  });
});
