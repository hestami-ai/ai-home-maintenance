import { describe, it, expect } from 'vitest';
import { runContractSuite } from './runner';
import { phase4SoftwareDomainsContract, type SoftwareDomainsArtifact } from './phase4-software-domains.contract';
import ideal from './fixtures/phase4-software-domains.ideal.json' assert { type: 'json' };

describe('Phase 4.1 software_domains contract — forward', () => {
  it('ideal fixture passes', () => {
    const results = runContractSuite(
      phase4SoftwareDomainsContract,
      ideal as unknown as SoftwareDomainsArtifact,
      { workflowRunId: 'fwd', relatedArtifacts: new Map() },
    );
    const failures = results.filter((r) => !r.passed);
    if (failures.length) console.error(failures.map((f) => `${f.clauseId}: ${f.message}`).join('\n'));
    expect(failures).toEqual([]);
  });

  it('breaks C-4.1.3 (Gap #8) when maps_to_business_domains is empty', () => {
    const broken: SoftwareDomainsArtifact = {
      kind: 'software_domains',
      domains: [{ id: 'domain-x', maps_to_business_domains: [] }],
    };
    const results = runContractSuite(phase4SoftwareDomainsContract, broken, { workflowRunId: 'neg', relatedArtifacts: new Map() });
    const f = results.find((r) => r.clauseId === 'C-4.1.3');
    expect(f?.passed).toBe(false);
    expect(f?.message).toContain('Gap #8');
  });
});
