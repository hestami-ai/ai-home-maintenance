import { describe, it, expect } from 'vitest';
import { runContractSuite } from './runner';
import { phase6TaskSkeletonContract, type ImplementationPlanArtifact } from './phase6-task-skeleton.contract';
import ideal from './fixtures/phase6-implementation-plan.ideal.json' assert { type: 'json' };
import componentModel from './fixtures/phase4-component-model.ideal.json' assert { type: 'json' };

describe('Phase 6.1 task_skeleton contract — forward', () => {
  it('ideal fixture passes when component_model is in context', () => {
    const context = {
      workflowRunId: 'fwd-test',
      relatedArtifacts: new Map<string, ReadonlyArray<unknown>>([['component_model', [componentModel]]]),
    };
    const results = runContractSuite(
      phase6TaskSkeletonContract,
      ideal as unknown as ImplementationPlanArtifact,
      context,
    );
    const failures = results.filter((r) => !r.passed);
    if (failures.length > 0) {
      console.error(failures.map((f) => `${f.clauseId}: ${f.message}`).join('\n'));
    }
    expect(failures).toEqual([]);
  });

  it('breaks C-6.1.6 when traces_to contains statement prose', () => {
    const broken: ImplementationPlanArtifact = {
      kind: 'implementation_plan',
      tasks: [{
        ...((ideal as unknown as ImplementationPlanArtifact).tasks[0]),
        traces_to: ['Send email to administrator within 2 min of abuse flag', 'SR-009'],
      }],
    };
    const results = runContractSuite(
      phase6TaskSkeletonContract,
      broken,
      { workflowRunId: 'fwd-test-neg', relatedArtifacts: new Map() },
    );
    const failed = results.find((r) => r.clauseId === 'C-6.1.6');
    expect(failed?.passed).toBe(false);
    expect(failed?.message).toContain('prose');
  });

  it('breaks C-6.1.5 when task.component_id does not resolve', () => {
    const broken: ImplementationPlanArtifact = {
      kind: 'implementation_plan',
      tasks: [{
        ...((ideal as unknown as ImplementationPlanArtifact).tasks[0]),
        component_id: 'comp-nonexistent',
      }],
    };
    const context = {
      workflowRunId: 'fwd-test-neg',
      relatedArtifacts: new Map<string, ReadonlyArray<unknown>>([['component_model', [componentModel]]]),
    };
    const results = runContractSuite(phase6TaskSkeletonContract, broken, context);
    const failed = results.find((r) => r.clauseId === 'C-6.1.5');
    expect(failed?.passed).toBe(false);
  });
});
