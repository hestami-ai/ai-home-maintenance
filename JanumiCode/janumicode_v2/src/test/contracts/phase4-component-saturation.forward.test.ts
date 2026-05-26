import { describe, it, expect } from 'vitest';
import { runContractSuite } from './runner';
import { phase4ComponentSaturationContract, type ComponentDecompositionNodeArtifact } from './phase4-component-saturation.contract';
import ideal from './fixtures/phase4-component-saturation-node.ideal.json' assert { type: 'json' };

describe('Phase 4.2a component_saturation contract — forward', () => {
  it('ideal atomic-leaf fixture passes', () => {
    const results = runContractSuite(
      phase4ComponentSaturationContract,
      ideal as unknown as ComponentDecompositionNodeArtifact,
      { workflowRunId: 'fwd', relatedArtifacts: new Map() },
    );
    const failures = results.filter((r) => !r.passed);
    if (failures.length) console.error(failures.map((f) => `${f.clauseId}: ${f.message}`).join('\n'));
    expect(failures).toEqual([]);
  });

  it('breaks C-4.2a.5 when atomic node has no responsibilities', () => {
    const broken: ComponentDecompositionNodeArtifact = {
      kind: 'component_decomposition_node',
      node_id: 'n', status: 'atomic',
      component: { id: 'comp-x', responsibilities: [] },
    };
    const results = runContractSuite(phase4ComponentSaturationContract, broken, { workflowRunId: 'neg', relatedArtifacts: new Map() });
    const f = results.find((r) => r.clauseId === 'C-4.2a.5');
    expect(f?.passed).toBe(false);
  });
});
