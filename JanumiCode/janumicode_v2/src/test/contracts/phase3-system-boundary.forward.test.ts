import { describe, it, expect } from 'vitest';
import { runContractSuite } from './runner';
import { phase3SystemBoundaryContract, type SystemBoundaryArtifact } from './phase3-system-boundary.contract';
import ideal from './fixtures/phase3-system-boundary.ideal.json' assert { type: 'json' };

describe('Phase 3.1 system_boundary contract — forward', () => {
  it('ideal fixture passes', () => {
    const results = runContractSuite(
      phase3SystemBoundaryContract,
      ideal as unknown as SystemBoundaryArtifact,
      { workflowRunId: 'fwd', relatedArtifacts: new Map() },
    );
    const failures = results.filter((r) => !r.passed);
    if (failures.length) console.error(failures.map((f) => `${f.clauseId}: ${f.message}`).join('\n'));
    expect(failures).toEqual([]);
  });

  it('breaks C-3.1.2 on overlap between in_scope and out_of_scope', () => {
    const broken: SystemBoundaryArtifact = {
      kind: 'system_boundary',
      in_scope: ['feature-x'],
      out_of_scope: ['feature-x'],
    };
    const results = runContractSuite(phase3SystemBoundaryContract, broken, { workflowRunId: 'neg', relatedArtifacts: new Map() });
    const f = results.find((r) => r.clauseId === 'C-3.1.2');
    expect(f?.passed).toBe(false);
  });
});
