import { describe, it, expect } from 'vitest';
import { runContractSuite } from './runner';
import { phase0WorkspaceClassificationContract, type WorkspaceClassificationArtifact } from './phase0-workspace-classification.contract';
import ideal from './fixtures/phase0-workspace-classification.ideal.json' assert { type: 'json' };

describe('Phase 0.1 workspace_classification contract — forward', () => {
  it('ideal fixture passes', () => {
    const results = runContractSuite(
      phase0WorkspaceClassificationContract,
      ideal as unknown as WorkspaceClassificationArtifact,
      { workflowRunId: 'fwd', relatedArtifacts: new Map() },
    );
    const failures = results.filter((r) => !r.passed);
    if (failures.length) console.error(failures.map((f) => `${f.clauseId}: ${f.message}`).join('\n'));
    expect(failures).toEqual([]);
  });

  it('breaks C-0.1.2 on unknown classification', () => {
    const broken: WorkspaceClassificationArtifact = { kind: 'workspace_classification', classification: 'foobar' };
    const results = runContractSuite(phase0WorkspaceClassificationContract, broken, { workflowRunId: 'neg', relatedArtifacts: new Map() });
    const f = results.find((r) => r.clauseId === 'C-0.1.2');
    expect(f?.passed).toBe(false);
  });
});
