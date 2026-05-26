import { describe, it, expect } from 'vitest';
import { runContractSuite } from './runner';
import { phase5ErrorHandlingContract, type ErrorHandlingStrategiesArtifact } from './phase5-error-handling.contract';
import ideal from './fixtures/phase5-error-handling.ideal.json' assert { type: 'json' };

describe('Phase 5.3 error_handling contract — forward', () => {
  it('ideal fixture passes', () => {
    const results = runContractSuite(
      phase5ErrorHandlingContract,
      ideal as unknown as ErrorHandlingStrategiesArtifact,
      { workflowRunId: 'fwd', relatedArtifacts: new Map() },
    );
    const failures = results.filter((r) => !r.passed);
    if (failures.length) console.error(failures.map((f) => `${f.clauseId}: ${f.message}`).join('\n'));
    expect(failures).toEqual([]);
  });

  it('breaks C-5.3.3 when a strategy is missing detection/response/surfacing', () => {
    const broken: ErrorHandlingStrategiesArtifact = {
      kind: 'error_handling_strategies',
      strategies: [{ component_id: 'comp-x', error_types: ['timeout'], detection: 'middleware', response: '', surfacing: '' }],
    };
    const results = runContractSuite(phase5ErrorHandlingContract, broken, { workflowRunId: 'neg', relatedArtifacts: new Map() });
    const f = results.find((r) => r.clauseId === 'C-5.3.3');
    expect(f?.passed).toBe(false);
  });
});
