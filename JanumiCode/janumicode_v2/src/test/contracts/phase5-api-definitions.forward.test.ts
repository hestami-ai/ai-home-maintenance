import { describe, it, expect } from 'vitest';
import { runContractSuite } from './runner';
import { phase5ApiDefinitionsContract, type ApiDefinitionsArtifact } from './phase5-api-definitions.contract';
import ideal from './fixtures/phase5-api-definitions.ideal.json' assert { type: 'json' };
import componentModel from './fixtures/phase4-component-model.ideal.json' assert { type: 'json' };

describe('Phase 5.2 api_definitions contract — forward', () => {
  it('ideal fixture passes', () => {
    const context = {
      workflowRunId: 'fwd-test',
      relatedArtifacts: new Map<string, ReadonlyArray<unknown>>([['component_model', [componentModel]]]),
    };
    const results = runContractSuite(
      phase5ApiDefinitionsContract,
      ideal as unknown as ApiDefinitionsArtifact,
      context,
    );
    const failures = results.filter((r) => !r.passed);
    if (failures.length > 0) {
      console.error(failures.map((f) => `${f.clauseId}: ${f.message}`).join('\n'));
    }
    expect(failures).toEqual([]);
  });

  it('breaks C-5.2.3 when an endpoint uses the "open_question" placeholder', () => {
    const broken: ApiDefinitionsArtifact = {
      kind: 'api_definitions',
      definitions: [{
        component_id: 'comp-x',
        endpoints: [{ path: 'open_question', method: 'open_question' }],
      }],
    };
    const results = runContractSuite(
      phase5ApiDefinitionsContract,
      broken,
      { workflowRunId: 'fwd-test-neg', relatedArtifacts: new Map() },
    );
    const failed = results.find((r) => r.clauseId === 'C-5.2.3');
    expect(failed?.passed).toBe(false);
    expect(failed?.message).toContain('placeholder');
  });
});
