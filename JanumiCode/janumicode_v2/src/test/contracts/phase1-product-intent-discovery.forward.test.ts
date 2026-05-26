import { describe, it, expect } from 'vitest';
import { runContractSuite } from './runner';
import { phase1ProductIntentDiscoveryContract, type IntentDiscoveryArtifact } from './phase1-product-intent-discovery.contract';
import ideal from './fixtures/phase1-intent-discovery.ideal.json' assert { type: 'json' };

describe('Phase 1.0b product_intent_discovery contract — forward', () => {
  it('ideal fixture passes', () => {
    const results = runContractSuite(
      phase1ProductIntentDiscoveryContract,
      ideal as unknown as IntentDiscoveryArtifact,
      { workflowRunId: 'fwd', relatedArtifacts: new Map() },
    );
    const failures = results.filter((r) => !r.passed);
    if (failures.length) console.error(failures.map((f) => `${f.clauseId}: ${f.message}`).join('\n'));
    expect(failures).toEqual([]);
  });

  it('breaks C-1.0b.2 when product_description is empty', () => {
    const broken: IntentDiscoveryArtifact = {
      kind: 'intent_discovery',
      product_vision: 'X',
      product_description: '',
      personas: [{ id: 'P-1', name: 'User' }],
    };
    const results = runContractSuite(phase1ProductIntentDiscoveryContract, broken, { workflowRunId: 'neg', relatedArtifacts: new Map() });
    const f = results.find((r) => r.clauseId === 'C-1.0b.2');
    expect(f?.passed).toBe(false);
  });

  it('breaks C-1.0b.3 when personas array is empty', () => {
    const broken: IntentDiscoveryArtifact = {
      kind: 'intent_discovery',
      product_vision: 'X',
      product_description: 'Y',
      personas: [],
    };
    const results = runContractSuite(phase1ProductIntentDiscoveryContract, broken, { workflowRunId: 'neg', relatedArtifacts: new Map() });
    const f = results.find((r) => r.clauseId === 'C-1.0b.3');
    expect(f?.passed).toBe(false);
  });
});
