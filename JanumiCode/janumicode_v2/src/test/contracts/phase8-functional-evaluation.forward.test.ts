import { describe, it, expect } from 'vitest';
import { runContractSuite } from './runner';
import { phase8FunctionalEvaluationContract, type FunctionalEvaluationPlanArtifact } from './phase8-functional-evaluation.contract';
import ideal from './fixtures/phase8-functional-evaluation-plan.ideal.json' assert { type: 'json' };
import fr from './fixtures/phase2-functional-requirements.ideal.json' assert { type: 'json' };

describe('Phase 8.1 functional_evaluation contract — forward', () => {
  it('ideal fixture passes (with FR context)', () => {
    const context = {
      workflowRunId: 'fwd',
      relatedArtifacts: new Map<string, ReadonlyArray<unknown>>([['functional_requirements', [fr]]]),
    };
    const results = runContractSuite(
      phase8FunctionalEvaluationContract,
      ideal as unknown as FunctionalEvaluationPlanArtifact,
      context,
    );
    const failures = results.filter((r) => !r.passed);
    if (failures.length) console.error(failures.map((f) => `${f.clauseId}: ${f.message}`).join('\n'));
    expect(failures).toEqual([]);
  });

  it('breaks C-8.1.2 when functional_requirement_id is not US-*', () => {
    const broken: FunctionalEvaluationPlanArtifact = {
      kind: 'functional_evaluation_plan',
      criteria: [{ functional_requirement_id: 'not-an-id', evaluation_method: 'x', success_condition: 'y' }],
    };
    const results = runContractSuite(phase8FunctionalEvaluationContract, broken, { workflowRunId: 'neg', relatedArtifacts: new Map() });
    const f = results.find((r) => r.clauseId === 'C-8.1.2');
    expect(f?.passed).toBe(false);
  });

  it('flags C-8.1.5 advisory when not every US has a criterion', () => {
    const partial: FunctionalEvaluationPlanArtifact = {
      kind: 'functional_evaluation_plan',
      criteria: [{ functional_requirement_id: 'US-001', evaluation_method: 'x', success_condition: 'y' }],
    };
    const context = {
      workflowRunId: 'fwd',
      relatedArtifacts: new Map<string, ReadonlyArray<unknown>>([['functional_requirements', [fr]]]),
    };
    const results = runContractSuite(phase8FunctionalEvaluationContract, partial, context);
    const f = results.find((r) => r.clauseId === 'C-8.1.5');
    expect(f?.passed).toBe(false);
    expect(f?.severity).toBe('advisory');
  });
});
