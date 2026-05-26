import { describe, it, expect } from 'vitest';
import { runContractSuite } from './runner';
import { phase1BusinessDomainsBloomContract, type BusinessDomainsBloomArtifact } from './phase1-business-domains-bloom.contract';
import ideal from './fixtures/phase1-business-domains-bloom.ideal.json' assert { type: 'json' };

describe('Phase 1.2 business_domains_bloom contract — forward', () => {
  it('ideal fixture passes', () => {
    const results = runContractSuite(
      phase1BusinessDomainsBloomContract,
      ideal as unknown as BusinessDomainsBloomArtifact,
      { workflowRunId: 'fwd', relatedArtifacts: new Map() },
    );
    const failures = results.filter((r) => !r.passed);
    if (failures.length) console.error(failures.map((f) => `${f.clauseId}: ${f.message}`).join('\n'));
    expect(failures).toEqual([]);
  });

  it('breaks C-1.2.2 when domain id is not DOM-*', () => {
    const broken: BusinessDomainsBloomArtifact = {
      kind: 'business_domains_bloom',
      businessDomains: [{ id: 'domain-x' }],
    };
    const results = runContractSuite(phase1BusinessDomainsBloomContract, broken, { workflowRunId: 'neg', relatedArtifacts: new Map() });
    const f = results.find((r) => r.clauseId === 'C-1.2.2');
    expect(f?.passed).toBe(false);
  });
});
