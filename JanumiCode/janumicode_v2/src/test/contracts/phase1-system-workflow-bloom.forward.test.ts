import { describe, it, expect } from 'vitest';
import { runContractSuite } from './runner';
import { phase1SystemWorkflowBloomContract, type SystemWorkflowBloomArtifact } from './phase1-system-workflow-bloom.contract';
import ideal from './fixtures/phase1-system-workflow-bloom.ideal.json' assert { type: 'json' };
import fr from './fixtures/phase2-functional-requirements.ideal.json' assert { type: 'json' };

describe('Phase 1.3b system_workflow_bloom contract — forward', () => {
  it('ideal fixture passes (all WF refs in FR resolve)', () => {
    const context = {
      workflowRunId: 'fwd',
      relatedArtifacts: new Map<string, ReadonlyArray<unknown>>([['functional_requirements', [fr]]]),
    };
    const results = runContractSuite(
      phase1SystemWorkflowBloomContract,
      ideal as unknown as SystemWorkflowBloomArtifact,
      context,
    );
    const failures = results.filter((r) => !r.passed);
    if (failures.length) console.error(failures.map((f) => `${f.clauseId}: ${f.message}`).join('\n'));
    expect(failures).toEqual([]);
  });

  it('breaks C-1.3b.3 when a WF ref does not resolve', () => {
    const partial: SystemWorkflowBloomArtifact = {
      kind: 'system_workflow_bloom',
      workflows: [{ id: 'WF-URL-CREATION' }],
    };
    const context = {
      workflowRunId: 'neg',
      relatedArtifacts: new Map<string, ReadonlyArray<unknown>>([['functional_requirements', [fr]]]),
    };
    const results = runContractSuite(phase1SystemWorkflowBloomContract, partial, context);
    const f = results.find((r) => r.clauseId === 'C-1.3b.3');
    expect(f?.passed).toBe(false);
  });
});
