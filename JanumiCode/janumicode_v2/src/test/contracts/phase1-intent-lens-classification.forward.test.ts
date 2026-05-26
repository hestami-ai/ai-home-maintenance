import { describe, it, expect } from 'vitest';
import { runContractSuite } from './runner';
import { phase1IntentLensClassificationContract, type IntentLensClassificationArtifact } from './phase1-intent-lens-classification.contract';
import ideal from './fixtures/phase1-intent-lens-classification.ideal.json' assert { type: 'json' };

describe('Phase 1.1a intent_lens_classification contract — forward', () => {
  it('ideal fixture passes', () => {
    const results = runContractSuite(
      phase1IntentLensClassificationContract,
      ideal as unknown as IntentLensClassificationArtifact,
      { workflowRunId: 'fwd', relatedArtifacts: new Map() },
    );
    const failures = results.filter((r) => !r.passed);
    if (failures.length) console.error(failures.map((f) => `${f.clauseId}: ${f.message}`).join('\n'));
    expect(failures).toEqual([]);
  });

  it('breaks C-1.1a.2 on unknown lens value', () => {
    const broken: IntentLensClassificationArtifact = { kind: 'intent_lens_classification', lens: 'foobar' };
    const results = runContractSuite(phase1IntentLensClassificationContract, broken, { workflowRunId: 'neg', relatedArtifacts: new Map() });
    const f = results.find((r) => r.clauseId === 'C-1.1a.2');
    expect(f?.passed).toBe(false);
  });
});
