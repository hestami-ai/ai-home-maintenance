import { describe, it, expect } from 'vitest';
import { runContractSuite } from './runner';
import { phase7TestCaseSaturationContract, type TestCaseDecompositionNodeArtifact } from './phase7-test-case-saturation.contract';
import ideal from './fixtures/phase7-test-case-saturation-node.ideal.json' assert { type: 'json' };

describe('Phase 7.1a test_case_saturation contract — forward', () => {
  it('ideal atomic-leaf fixture passes', () => {
    const results = runContractSuite(
      phase7TestCaseSaturationContract,
      ideal as unknown as TestCaseDecompositionNodeArtifact,
      { workflowRunId: 'fwd', relatedArtifacts: new Map() },
    );
    const failures = results.filter((r) => !r.passed);
    if (failures.length) console.error(failures.map((f) => `${f.clauseId}: ${f.message}`).join('\n'));
    expect(failures).toEqual([]);
  });

  it('breaks C-7.1a.5 when atomic node has empty acceptance_criterion_ids', () => {
    const broken: TestCaseDecompositionNodeArtifact = {
      kind: 'test_case_decomposition_node',
      node_id: 'n-1',
      status: 'atomic',
      test_case: { test_case_id: 'TC-X', expected_outcome: 'x', acceptance_criterion_ids: [] },
    };
    const results = runContractSuite(phase7TestCaseSaturationContract, broken, { workflowRunId: 'neg', relatedArtifacts: new Map() });
    const f = results.find((r) => r.clauseId === 'C-7.1a.5');
    expect(f?.passed).toBe(false);
  });
});
