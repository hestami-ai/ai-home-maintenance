/**
 * Forward test for the Phase 4.2 component_skeleton contract.
 *
 * Asserts:
 *  1. The hand-written ideal fixture passes its own contract.
 *  2. (Future) Phase 9's packetBuilder Pass 2 reads US tracing correctly
 *     from this fixture. Currently a placeholder until packetBuilder is
 *     updated for Gap #2.
 */

import { describe, it, expect } from 'vitest';
import { runContractSuite, summarize } from './runner';
import { phase4ComponentSkeletonContract, type ComponentModelArtifact } from './phase4-component-skeleton.contract';
import ideal from './fixtures/phase4-component-model.ideal.json' assert { type: 'json' };

describe('Phase 4.2 component_skeleton contract — forward', () => {
  it('ideal fixture passes its own contract', () => {
    const results = runContractSuite(
      phase4ComponentSkeletonContract,
      ideal as unknown as ComponentModelArtifact,
      { workflowRunId: 'fwd-test', relatedArtifacts: new Map() },
    );
    const failures = results.filter((r) => !r.passed);
    if (failures.length > 0) {
      // Make the failure messages legible if this assertion ever breaks.
      console.error(failures.map((f) => `${f.clauseId}: ${f.message}`).join('\n'));
    }
    expect(failures).toEqual([]);
  });

  it('summary counts add up', () => {
    const results = runContractSuite(
      phase4ComponentSkeletonContract,
      ideal as unknown as ComponentModelArtifact,
      { workflowRunId: 'fwd-test', relatedArtifacts: new Map() },
    );
    const s = summarize(results);
    expect(s.total).toBe(phase4ComponentSkeletonContract.clauses.length);
    expect(s.passed).toBe(s.total);
    expect(s.blockingFailures).toBe(0);
    expect(s.advisoryFailures).toBe(0);
  });

  it('breaks C-4.2.4 when traces_to is empty', () => {
    const broken: ComponentModelArtifact = {
      kind: 'component_model',
      components: [
        {
          id: 'comp-x',
          name: 'X',
          responsibilities: [{ id: 'res-x', statement: 'do x' }],
          dependencies: [],
          traces_to: [],
        },
      ],
    };
    const results = runContractSuite(
      phase4ComponentSkeletonContract,
      broken,
      { workflowRunId: 'fwd-test-neg', relatedArtifacts: new Map() },
    );
    const failed = results.find((r) => r.clauseId === 'C-4.2.4');
    expect(failed?.passed).toBe(false);
  });
});
