import { describe, it, expect } from 'vitest';
import { runContractSuite } from './runner';
import { phase9ImplementationTaskExecutionContract, type ExecutionSummaryArtifact } from './phase9-implementation-task-execution.contract';
import ideal from './fixtures/phase9-execution-summary.ideal.json' assert { type: 'json' };

describe('Phase 9.1 implementation_task_execution contract — forward', () => {
  it('ideal fixture passes', () => {
    const results = runContractSuite(
      phase9ImplementationTaskExecutionContract,
      ideal as unknown as ExecutionSummaryArtifact,
      { workflowRunId: 'fwd', relatedArtifacts: new Map() },
    );
    const failures = results.filter((r) => !r.passed);
    if (failures.length) console.error(failures.map((f) => `${f.clauseId}: ${f.message}`).join('\n'));
    expect(failures).toEqual([]);
  });

  it('breaks C-9.1.3 when success=true with no files_written', () => {
    const broken: ExecutionSummaryArtifact = {
      kind: 'execution_summary',
      task_id: 'task-x',
      success: true,
      files_written: [],
    };
    const results = runContractSuite(phase9ImplementationTaskExecutionContract, broken, { workflowRunId: 'neg', relatedArtifacts: new Map() });
    const f = results.find((r) => r.clauseId === 'C-9.1.3');
    expect(f?.passed).toBe(false);
  });

  it('breaks C-9.1.4 when success=false with no reason', () => {
    const broken: ExecutionSummaryArtifact = {
      kind: 'execution_summary',
      task_id: 'task-x',
      success: false,
    };
    const results = runContractSuite(phase9ImplementationTaskExecutionContract, broken, { workflowRunId: 'neg', relatedArtifacts: new Map() });
    const f = results.find((r) => r.clauseId === 'C-9.1.4');
    expect(f?.passed).toBe(false);
  });
});
