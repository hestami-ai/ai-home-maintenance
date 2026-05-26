import { describe, it, expect } from 'vitest';
import { runContractSuite } from './runner';
import { phase1ReleasePlanContract, type ReleasePlanArtifact } from './phase1-release-plan.contract';
import ideal from './fixtures/phase1-release-plan.ideal.json' assert { type: 'json' };

describe('Phase 1.9 release_plan contract — forward', () => {
  it('ideal fixture passes', () => {
    const results = runContractSuite(
      phase1ReleasePlanContract,
      ideal as unknown as ReleasePlanArtifact,
      { workflowRunId: 'fwd', relatedArtifacts: new Map() },
    );
    const failures = results.filter((r) => !r.passed);
    if (failures.length) console.error(failures.map((f) => `${f.clauseId}: ${f.message}`).join('\n'));
    expect(failures).toEqual([]);
  });

  it('breaks C-1.9.3 on duplicate ordinals', () => {
    const broken: ReleasePlanArtifact = {
      kind: 'release_plan',
      releases: [
        { release_id: 'a', ordinal: 1, name: 'A', contains_user_stories: ['US-1'] },
        { release_id: 'b', ordinal: 1, name: 'B', contains_user_stories: ['US-2'] },
      ],
    };
    const results = runContractSuite(phase1ReleasePlanContract, broken, { workflowRunId: 'neg', relatedArtifacts: new Map() });
    const f = results.find((r) => r.clauseId === 'C-1.9.3');
    expect(f?.passed).toBe(false);
  });

  it('breaks C-1.9.4 when a release has all primary contains_* axes empty', () => {
    const broken: ReleasePlanArtifact = {
      kind: 'release_plan',
      releases: [
        { release_id: 'REL-A', ordinal: 1, name: 'A' },
      ],
    };
    const results = runContractSuite(phase1ReleasePlanContract, broken, { workflowRunId: 'neg', relatedArtifacts: new Map() });
    const f = results.find((r) => r.clauseId === 'C-1.9.4');
    expect(f?.passed).toBe(false);
  });
});
