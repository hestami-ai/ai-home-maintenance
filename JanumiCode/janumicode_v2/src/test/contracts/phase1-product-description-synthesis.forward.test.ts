import { describe, it, expect } from 'vitest';
import { runContractSuite } from './runner';
import { phase1ProductDescriptionSynthesisContract, type ProductDescriptionHandoffArtifact } from './phase1-product-description-synthesis.contract';
import ideal from './fixtures/phase1-product-description-handoff.ideal.json' assert { type: 'json' };

describe('Phase 1.6 product_description_synthesis contract — forward', () => {
  it('ideal fixture passes', () => {
    const results = runContractSuite(
      phase1ProductDescriptionSynthesisContract,
      ideal as unknown as ProductDescriptionHandoffArtifact,
      { workflowRunId: 'fwd', relatedArtifacts: new Map() },
    );
    const failures = results.filter((r) => !r.passed);
    if (failures.length) console.error(failures.map((f) => `${f.clauseId}: ${f.message}`).join('\n'));
    expect(failures).toEqual([]);
  });

  it('breaks C-1.6.2 when product_description is empty', () => {
    const broken: ProductDescriptionHandoffArtifact = {
      kind: 'product_description_handoff',
      product_vision: 'X',
      product_description: '',
    };
    const results = runContractSuite(phase1ProductDescriptionSynthesisContract, broken, { workflowRunId: 'neg', relatedArtifacts: new Map() });
    const f = results.find((r) => r.clauseId === 'C-1.6.2');
    expect(f?.passed).toBe(false);
  });

  it('breaks C-1.6.1 when product_vision is empty', () => {
    const broken: ProductDescriptionHandoffArtifact = {
      kind: 'product_description_handoff',
      product_vision: '',
      product_description: 'Y',
    };
    const results = runContractSuite(phase1ProductDescriptionSynthesisContract, broken, { workflowRunId: 'neg', relatedArtifacts: new Map() });
    const f = results.find((r) => r.clauseId === 'C-1.6.1');
    expect(f?.passed).toBe(false);
  });
});
