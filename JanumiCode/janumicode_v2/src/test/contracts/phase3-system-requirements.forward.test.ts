import { describe, it, expect } from 'vitest';
import { runContractSuite } from './runner';
import { phase3SystemRequirementsContract, type SystemRequirementsArtifact } from './phase3-system-requirements.contract';
import ideal from './fixtures/phase3-system-requirements.ideal.json' assert { type: 'json' };
import fr from './fixtures/phase2-functional-requirements.ideal.json' assert { type: 'json' };
import nfr from './fixtures/phase2-non-functional-requirements.ideal.json' assert { type: 'json' };

describe('Phase 3.2 system_requirements contract — forward', () => {
  it('ideal fixture passes (with FR + NFR context)', () => {
    const context = {
      workflowRunId: 'fwd',
      relatedArtifacts: new Map<string, ReadonlyArray<unknown>>([
        ['functional_requirements', [fr]],
        ['non_functional_requirements', [nfr]],
      ]),
    };
    const results = runContractSuite(
      phase3SystemRequirementsContract,
      ideal as unknown as SystemRequirementsArtifact,
      context,
    );
    const failures = results.filter((r) => !r.passed);
    if (failures.length) console.error(failures.map((f) => `${f.clauseId}: ${f.message}`).join('\n'));
    expect(failures).toEqual([]);
  });

  it('breaks C-3.2.4 when source_requirement_ids contains only unrecognized refs', () => {
    const broken: SystemRequirementsArtifact = {
      kind: 'system_requirements',
      items: [{ id: 'SR-001', statement: 'something', source_requirement_ids: ['SR-002'] }],
    };
    const results = runContractSuite(phase3SystemRequirementsContract, broken, { workflowRunId: 'neg', relatedArtifacts: new Map() });
    const f = results.find((r) => r.clauseId === 'C-3.2.4');
    expect(f?.passed).toBe(false);
  });
});
