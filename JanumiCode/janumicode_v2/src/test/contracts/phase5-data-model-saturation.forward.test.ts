import { describe, it, expect } from 'vitest';
import { runContractSuite } from './runner';
import { phase5DataModelSaturationContract, type DataModelDecompositionNodeArtifact } from './phase5-data-model-saturation.contract';
import ideal from './fixtures/phase5-data-model-saturation-node.ideal.json' assert { type: 'json' };

describe('Phase 5.1a data_model_saturation contract — forward', () => {
  it('ideal atomic-leaf fixture passes', () => {
    const results = runContractSuite(
      phase5DataModelSaturationContract,
      ideal as unknown as DataModelDecompositionNodeArtifact,
      { workflowRunId: 'fwd', relatedArtifacts: new Map() },
    );
    const failures = results.filter((r) => !r.passed);
    if (failures.length) console.error(failures.map((f) => `${f.clauseId}: ${f.message}`).join('\n'));
    expect(failures).toEqual([]);
  });

  it('breaks C-5.1a.5 when an atomic field has no type', () => {
    const broken: DataModelDecompositionNodeArtifact = {
      kind: 'data_model_decomposition_node',
      node_id: 'n', status: 'atomic',
      entity: { name: 'E', fields: [{ name: 'f' }] },
    };
    const results = runContractSuite(phase5DataModelSaturationContract, broken, { workflowRunId: 'neg', relatedArtifacts: new Map() });
    const f = results.find((r) => r.clauseId === 'C-5.1a.5');
    expect(f?.passed).toBe(false);
  });
});
