import { describe, it, expect } from 'vitest';
import { runContractSuite } from './runner';
import { phase2FrBloomSkeletonContract, type FunctionalRequirementsArtifact } from './phase2-fr-bloom-skeleton.contract';
import ideal from './fixtures/phase2-functional-requirements.ideal.json' assert { type: 'json' };

describe('Phase 2.1 fr_bloom_skeleton contract — forward', () => {
  it('ideal fixture passes', () => {
    const results = runContractSuite(
      phase2FrBloomSkeletonContract,
      ideal as unknown as FunctionalRequirementsArtifact,
      { workflowRunId: 'fwd', relatedArtifacts: new Map() },
    );
    const failures = results.filter((r) => !r.passed);
    if (failures.length) console.error(failures.map((f) => `${f.clauseId}: ${f.message}`).join('\n'));
    expect(failures).toEqual([]);
  });

  it('breaks C-2.1.5 when US.traces_to cites a lowercase comp-* (Phase 4 forward-ref)', () => {
    const broken = {
      kind: 'functional_requirements',
      user_stories: [
        {
          id: 'US-001',
          role: 'User',
          action: 'do thing',
          outcome: 'thing done',
          traces_to: ['comp-something', 'UJ-X'],
          acceptance_criteria: [{ id: 'AC-001', description: 'works' }],
        },
      ],
    } as FunctionalRequirementsArtifact;
    const results = runContractSuite(phase2FrBloomSkeletonContract, broken, { workflowRunId: 'neg', relatedArtifacts: new Map() });
    const f = results.find((r) => r.clauseId === 'C-2.1.5');
    expect(f?.passed).toBe(false);
    expect(f?.message).toContain('comp-*');
  });

  it('ACCEPTS C-2.1.5 when US.traces_to cites legitimate Phase 1 namespaces (COMP-*, VOC-*, etc.)', () => {
    const good: FunctionalRequirementsArtifact = {
      kind: 'functional_requirements',
      user_stories: [
        {
          id: 'US-100',
          role: 'User',
          action: 'do compliant thing',
          outcome: 'compliance satisfied',
          traces_to: ['UJ-X', 'WF-Y', 'ENT-Z', 'COMP-ENCRYPTION-AT-REST', 'VOC-SLUG'],
          acceptance_criteria: [{ id: 'AC-100', description: 'works' }],
        },
      ],
    };
    const results = runContractSuite(phase2FrBloomSkeletonContract, good, { workflowRunId: 'pos', relatedArtifacts: new Map() });
    const f = results.find((r) => r.clauseId === 'C-2.1.5');
    expect(f?.passed).toBe(true);
  });
});
