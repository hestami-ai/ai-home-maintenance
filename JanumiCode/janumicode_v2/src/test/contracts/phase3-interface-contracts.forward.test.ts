import { describe, it, expect } from 'vitest';
import { runContractSuite } from './runner';
import { phase3InterfaceContractsContract, type InterfaceContractsArtifact } from './phase3-interface-contracts.contract';
import ideal from './fixtures/phase3-interface-contracts.ideal.json' assert { type: 'json' };

describe('Phase 3.3 interface_contracts contract — forward', () => {
  it('ideal fixture passes', () => {
    const results = runContractSuite(
      phase3InterfaceContractsContract,
      ideal as unknown as InterfaceContractsArtifact,
      { workflowRunId: 'fwd', relatedArtifacts: new Map() },
    );
    const failures = results.filter((r) => !r.passed);
    if (failures.length) console.error(failures.map((f) => `${f.clauseId}: ${f.message}`).join('\n'));
    expect(failures).toEqual([]);
  });

  it('breaks C-3.3.3 when a contract has no systems_involved', () => {
    const broken: InterfaceContractsArtifact = {
      kind: 'interface_contracts',
      contracts: [{ id: 'C-X-001', protocol: 'HTTP' }],
    };
    const results = runContractSuite(phase3InterfaceContractsContract, broken, { workflowRunId: 'neg', relatedArtifacts: new Map() });
    const f = results.find((r) => r.clauseId === 'C-3.3.3');
    expect(f?.passed).toBe(false);
  });
});
