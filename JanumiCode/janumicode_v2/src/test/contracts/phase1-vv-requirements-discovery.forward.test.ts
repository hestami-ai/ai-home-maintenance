import { describe, it, expect } from 'vitest';
import { runContractSuite } from './runner';
import { phase1VvRequirementsContract, type VvRequirementsArtifact } from './phase1-vv-requirements-discovery.contract';
import ideal from './fixtures/phase1-vv-requirements.ideal.json' assert { type: 'json' };

describe('Phase 1.0e vv_requirements_discovery contract — forward', () => {
  it('ideal fixture passes', () => {
    const results = runContractSuite(
      phase1VvRequirementsContract,
      ideal as unknown as VvRequirementsArtifact,
      { workflowRunId: 'fwd', relatedArtifacts: new Map() },
    );
    const failures = results.filter((r) => !r.passed);
    if (failures.length) console.error(failures.map((f) => `${f.clauseId}: ${f.message}`).join('\n'));
    expect(failures).toEqual([]);
  });

  it('breaks C-1.0e.2 when an item lacks a VV-* id', () => {
    const broken: VvRequirementsArtifact = {
      kind: 'vv_requirements_discovery',
      vvRequirements: [{ id: 'not-vv', target: 't', measurement: 'm', threshold: 'th' }],
    };
    const results = runContractSuite(phase1VvRequirementsContract, broken, { workflowRunId: 'neg', relatedArtifacts: new Map() });
    const f = results.find((r) => r.clauseId === 'C-1.0e.2');
    expect(f?.passed).toBe(false);
  });

  it('breaks C-1.0e.3 when an item is missing target/measurement/threshold', () => {
    const broken: VvRequirementsArtifact = {
      kind: 'vv_requirements_discovery',
      vvRequirements: [{ id: 'VV-X', target: '', measurement: 'm', threshold: 'th' }],
    };
    const results = runContractSuite(phase1VvRequirementsContract, broken, { workflowRunId: 'neg', relatedArtifacts: new Map() });
    const f = results.find((r) => r.clauseId === 'C-1.0e.3');
    expect(f?.passed).toBe(false);
  });
});
