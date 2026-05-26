import { describe, it, expect } from 'vitest';
import { runContractSuite } from './runner';
import { phase2FrSaturationContract, type RequirementDecompositionNodeArtifact } from './phase2-fr-saturation.contract';
import ideal from './fixtures/phase2-fr-saturation-node.ideal.json' assert { type: 'json' };

describe('Phase 2.1a fr_saturation contract — forward', () => {
  it('ideal atomic-leaf fixture passes', () => {
    const results = runContractSuite(
      phase2FrSaturationContract,
      ideal as unknown as RequirementDecompositionNodeArtifact,
      { workflowRunId: 'fwd', relatedArtifacts: new Map() },
    );
    const failures = results.filter((r) => !r.passed);
    if (failures.length) console.error(failures.map((f) => `${f.clauseId}: ${f.message}`).join('\n'));
    expect(failures).toEqual([]);
  });

  it('breaks C-2.1a.5 when atomic FR leaf missing user_story.action', () => {
    const broken: RequirementDecompositionNodeArtifact = {
      kind: 'requirement_decomposition_node',
      node_id: 'n', root_kind: 'fr', status: 'atomic',
      user_story: { id: 'US-1', role: 'r', outcome: 'o' },
    };
    const results = runContractSuite(phase2FrSaturationContract, broken, { workflowRunId: 'neg', relatedArtifacts: new Map() });
    const f = results.find((r) => r.clauseId === 'C-2.1a.5');
    expect(f?.passed).toBe(false);
  });
});
