import { describe, it, expect } from 'vitest';
import { runContractSuite } from './runner';
import { phase10PreCommitConsistencyCheckContract, type ConsistencyReportArtifact } from './phase10-pre-commit-consistency-check.contract';
import ideal from './fixtures/phase10-consistency-report.ideal.json' assert { type: 'json' };

describe('Phase 10.1 pre_commit_consistency_check contract — forward', () => {
  it('ideal fixture passes', () => {
    const results = runContractSuite(
      phase10PreCommitConsistencyCheckContract,
      ideal as unknown as ConsistencyReportArtifact,
      { workflowRunId: 'fwd', relatedArtifacts: new Map() },
    );
    const failures = results.filter((r) => !r.passed);
    if (failures.length) console.error(failures.map((f) => `${f.clauseId}: ${f.message}`).join('\n'));
    expect(failures).toEqual([]);
  });

  it('breaks C-10.1.2 when HIGH findings present but status is not block', () => {
    const broken: ConsistencyReportArtifact = {
      kind: 'consistency_report',
      status: 'pass',
      findings: [{ severity: 'HIGH', description: 'broken invariant' }],
    };
    const results = runContractSuite(phase10PreCommitConsistencyCheckContract, broken, { workflowRunId: 'neg', relatedArtifacts: new Map() });
    const f = results.find((r) => r.clauseId === 'C-10.1.2');
    expect(f?.passed).toBe(false);
  });
});
