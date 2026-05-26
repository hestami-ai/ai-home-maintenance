import { describe, it, expect } from 'vitest';
import { runContractSuite } from './runner';
import { phase6TaskSaturationContract, type TaskDecompositionNodeArtifact } from './phase6-task-saturation.contract';
import ideal from './fixtures/phase6-task-saturation-node.ideal.json' assert { type: 'json' };

describe('Phase 6.1a task_saturation contract — forward', () => {
  it('ideal atomic-leaf fixture passes', () => {
    const results = runContractSuite(
      phase6TaskSaturationContract,
      ideal as unknown as TaskDecompositionNodeArtifact,
      { workflowRunId: 'fwd', relatedArtifacts: new Map() },
    );
    const failures = results.filter((r) => !r.passed);
    if (failures.length) console.error(failures.map((f) => `${f.clauseId}: ${f.message}`).join('\n'));
    expect(failures).toEqual([]);
  });

  it('breaks C-6.1a.5 when status=atomic but task.id is missing', () => {
    const broken: TaskDecompositionNodeArtifact = {
      kind: 'task_decomposition_node',
      node_id: 'n-1',
      status: 'atomic',
      task: { description: 'x' },
    };
    const results = runContractSuite(phase6TaskSaturationContract, broken, { workflowRunId: 'neg', relatedArtifacts: new Map() });
    const f = results.find((r) => r.clauseId === 'C-6.1a.5');
    expect(f?.passed).toBe(false);
  });
});
