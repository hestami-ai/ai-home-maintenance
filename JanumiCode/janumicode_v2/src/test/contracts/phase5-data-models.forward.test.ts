import { describe, it, expect } from 'vitest';
import { runContractSuite } from './runner';
import { phase5DataModelsContract, type DataModelsArtifact } from './phase5-data-models.contract';
import ideal from './fixtures/phase5-data-models.ideal.json' assert { type: 'json' };
import componentModel from './fixtures/phase4-component-model.ideal.json' assert { type: 'json' };

describe('Phase 5.1 data_models contract — forward', () => {
  it('ideal fixture passes', () => {
    const context = {
      workflowRunId: 'fwd-test',
      relatedArtifacts: new Map<string, ReadonlyArray<unknown>>([['component_model', [componentModel]]]),
    };
    const results = runContractSuite(
      phase5DataModelsContract,
      ideal as unknown as DataModelsArtifact,
      context,
    );
    const failures = results.filter((r) => !r.passed);
    if (failures.length > 0) {
      console.error(failures.map((f) => `${f.clauseId}: ${f.message}`).join('\n'));
    }
    expect(failures).toEqual([]);
  });

  it('breaks C-5.1.4 when an entity has no fields', () => {
    const broken: DataModelsArtifact = {
      kind: 'data_models',
      models: [{ component_id: 'comp-x', entities: [{ name: 'Empty', fields: [] }] }],
    };
    const results = runContractSuite(
      phase5DataModelsContract,
      broken,
      { workflowRunId: 'fwd-test-neg', relatedArtifacts: new Map() },
    );
    const failed = results.find((r) => r.clauseId === 'C-5.1.4');
    expect(failed?.passed).toBe(false);
  });
});
