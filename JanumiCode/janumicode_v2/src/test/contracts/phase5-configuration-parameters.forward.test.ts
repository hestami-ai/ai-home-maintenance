import { describe, it, expect } from 'vitest';
import { runContractSuite } from './runner';
import { phase5ConfigParametersContract, type ConfigurationParametersArtifact } from './phase5-configuration-parameters.contract';
import ideal from './fixtures/phase5-configuration-parameters.ideal.json' assert { type: 'json' };

describe('Phase 5.4 configuration_parameters contract — forward', () => {
  it('ideal fixture passes', () => {
    const results = runContractSuite(
      phase5ConfigParametersContract,
      ideal as unknown as ConfigurationParametersArtifact,
      { workflowRunId: 'fwd', relatedArtifacts: new Map() },
    );
    const failures = results.filter((r) => !r.passed);
    if (failures.length) console.error(failures.map((f) => `${f.clauseId}: ${f.message}`).join('\n'));
    expect(failures).toEqual([]);
  });

  it('breaks C-5.4.3 when a parameter has no type', () => {
    const broken: ConfigurationParametersArtifact = {
      kind: 'configuration_parameters',
      parameters: [{ component_id: 'comp-x', parameters: [{ name: 'X' }] }],
    };
    const results = runContractSuite(phase5ConfigParametersContract, broken, { workflowRunId: 'neg', relatedArtifacts: new Map() });
    const f = results.find((r) => r.clauseId === 'C-5.4.3');
    expect(f?.passed).toBe(false);
  });
});
