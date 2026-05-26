import { describe, it, expect } from 'vitest';
import { runContractSuite } from './runner';
import { phase2NfrBloomSkeletonContract, type NonFunctionalRequirementsArtifact } from './phase2-nfr-bloom-skeleton.contract';
import ideal from './fixtures/phase2-non-functional-requirements.ideal.json' assert { type: 'json' };

describe('Phase 2.2 nfr_bloom_skeleton contract — forward', () => {
  it('ideal fixture passes', () => {
    const results = runContractSuite(
      phase2NfrBloomSkeletonContract,
      ideal as unknown as NonFunctionalRequirementsArtifact,
      { workflowRunId: 'fwd', relatedArtifacts: new Map() },
    );
    const failures = results.filter((r) => !r.passed);
    if (failures.length) console.error(failures.map((f) => `${f.clauseId}: ${f.message}`).join('\n'));
    expect(failures).toEqual([]);
  });

  it('breaks C-2.2.4 when seed_threshold is missing', () => {
    const broken: NonFunctionalRequirementsArtifact = {
      kind: 'non_functional_requirements',
      requirements: [{ id: 'NFR-X', category: 'performance', description: 'fast' }],
    };
    const results = runContractSuite(phase2NfrBloomSkeletonContract, broken, { workflowRunId: 'neg', relatedArtifacts: new Map() });
    const f = results.find((r) => r.clauseId === 'C-2.2.4');
    expect(f?.passed).toBe(false);
  });
});
