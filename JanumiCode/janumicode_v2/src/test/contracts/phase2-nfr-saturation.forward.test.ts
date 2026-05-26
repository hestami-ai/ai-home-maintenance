import { describe, it, expect } from 'vitest';
import { runContractSuite } from './runner';
import { phase2NfrSaturationContract, type NfrRequirementDecompositionNodeArtifact } from './phase2-nfr-saturation.contract';
import ideal from './fixtures/phase2-nfr-saturation-node.ideal.json' assert { type: 'json' };

describe('Phase 2.2a nfr_saturation contract — forward', () => {
  it('ideal atomic-leaf fixture passes', () => {
    const results = runContractSuite(
      phase2NfrSaturationContract,
      ideal as unknown as NfrRequirementDecompositionNodeArtifact,
      { workflowRunId: 'fwd', relatedArtifacts: new Map() },
    );
    const failures = results.filter((r) => !r.passed);
    if (failures.length) console.error(failures.map((f) => `${f.clauseId}: ${f.message}`).join('\n'));
    expect(failures).toEqual([]);
  });

  it('breaks C-2.2a.5 when atomic NFR leaf has no threshold', () => {
    const broken: NfrRequirementDecompositionNodeArtifact = {
      kind: 'requirement_decomposition_node',
      node_id: 'n', root_kind: 'nfr', status: 'atomic',
      nfr: { id: 'NFR-1', description: 'd', measurement_method: 'm' },
    };
    const results = runContractSuite(phase2NfrSaturationContract, broken, { workflowRunId: 'neg', relatedArtifacts: new Map() });
    const f = results.find((r) => r.clauseId === 'C-2.2a.5');
    expect(f?.passed).toBe(false);
  });
});
