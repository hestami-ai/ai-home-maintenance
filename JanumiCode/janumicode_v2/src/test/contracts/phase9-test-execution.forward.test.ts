import { describe, it, expect } from 'vitest';
import { runContractSuite } from './runner';
import { phase9TestExecutionContract, type TestResultsArtifact } from './phase9-test-execution.contract';
import ideal from './fixtures/phase9-test-results.ideal.json' assert { type: 'json' };

describe('Phase 9.2 test_execution contract — forward', () => {
  it('ideal fixture passes', () => {
    const results = runContractSuite(
      phase9TestExecutionContract,
      ideal as unknown as TestResultsArtifact,
      { workflowRunId: 'fwd', relatedArtifacts: new Map() },
    );
    const failures = results.filter((r) => !r.passed);
    if (failures.length) console.error(failures.map((f) => `${f.clauseId}: ${f.message}`).join('\n'));
    expect(failures).toEqual([]);
  });

  it('breaks C-9.2.3 when total != passed+failed+skipped', () => {
    const broken: TestResultsArtifact = {
      kind: 'test_results',
      task_id: 'task-x',
      passed: 3,
      failed: 1,
      total: 10,
    };
    const results = runContractSuite(phase9TestExecutionContract, broken, { workflowRunId: 'neg', relatedArtifacts: new Map() });
    const f = results.find((r) => r.clauseId === 'C-9.2.3');
    expect(f?.passed).toBe(false);
  });
});
