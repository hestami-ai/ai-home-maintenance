import { describe, it, expect } from 'vitest';
import { runContractSuite } from './runner';
import { phase9EvaluationExecutionContract, type EvaluationResultArtifact } from './phase9-evaluation-execution.contract';
import ideal from './fixtures/phase9-evaluation-result.ideal.json' assert { type: 'json' };

describe('Phase 9.3 evaluation_execution contract — forward', () => {
  it('ideal fixture passes', () => {
    const results = runContractSuite(
      phase9EvaluationExecutionContract,
      ideal as unknown as EvaluationResultArtifact,
      { workflowRunId: 'fwd', relatedArtifacts: new Map() },
    );
    const failures = results.filter((r) => !r.passed);
    if (failures.length) console.error(failures.map((f) => `${f.clauseId}: ${f.message}`).join('\n'));
    expect(failures).toEqual([]);
  });

  it('breaks C-9.3.4 when verdict=fail with no rationale', () => {
    const broken: EvaluationResultArtifact = {
      kind: 'evaluation_result',
      target_id: 'US-001',
      verdict: 'fail',
    };
    const results = runContractSuite(phase9EvaluationExecutionContract, broken, { workflowRunId: 'neg', relatedArtifacts: new Map() });
    const f = results.find((r) => r.clauseId === 'C-9.3.4');
    expect(f?.passed).toBe(false);
  });
});
