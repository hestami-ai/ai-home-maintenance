import { describe, it, expect } from 'vitest';
import { runContractSuite } from './runner';
import { phase1EntitiesBloomContract, type EntitiesBloomArtifact } from './phase1-entities-bloom.contract';
import ideal from './fixtures/phase1-entities-bloom.ideal.json' assert { type: 'json' };
import fr from './fixtures/phase2-functional-requirements.ideal.json' assert { type: 'json' };

describe('Phase 1.4 entities_bloom contract — forward', () => {
  it('ideal fixture passes (all ENT refs in FR resolve)', () => {
    const context = {
      workflowRunId: 'fwd',
      relatedArtifacts: new Map<string, ReadonlyArray<unknown>>([['functional_requirements', [fr]]]),
    };
    const results = runContractSuite(
      phase1EntitiesBloomContract,
      ideal as unknown as EntitiesBloomArtifact,
      context,
    );
    const failures = results.filter((r) => !r.passed);
    if (failures.length) console.error(failures.map((f) => `${f.clauseId}: ${f.message}`).join('\n'));
    expect(failures).toEqual([]);
  });

  it('breaks C-1.4.3 when an external ENT ref does not resolve', () => {
    const partial: EntitiesBloomArtifact = {
      kind: 'entities_bloom',
      entities: [{ id: 'ENT-URL-MAPPING' }], // missing ENT-ABUSE-REPORT, ENT-USER, etc.
    };
    const context = {
      workflowRunId: 'neg',
      relatedArtifacts: new Map<string, ReadonlyArray<unknown>>([['functional_requirements', [fr]]]),
    };
    const results = runContractSuite(phase1EntitiesBloomContract, partial, context);
    const f = results.find((r) => r.clauseId === 'C-1.4.3');
    expect(f?.passed).toBe(false);
  });
});
