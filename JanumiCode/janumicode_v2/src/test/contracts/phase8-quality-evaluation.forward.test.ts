import { describe, it, expect } from 'vitest';
import { runContractSuite } from './runner';
import { phase8QualityEvaluationContract, type QualityEvaluationPlanArtifact } from './phase8-quality-evaluation.contract';
import ideal from './fixtures/phase8-quality-evaluation-plan.ideal.json' assert { type: 'json' };
import nfr from './fixtures/phase2-non-functional-requirements.ideal.json' assert { type: 'json' };

describe('Phase 8.2 quality_evaluation contract — forward', () => {
  it('ideal fixture passes (with NFR context)', () => {
    const context = {
      workflowRunId: 'fwd',
      relatedArtifacts: new Map<string, ReadonlyArray<unknown>>([['non_functional_requirements', [nfr]]]),
    };
    const results = runContractSuite(
      phase8QualityEvaluationContract,
      ideal as unknown as QualityEvaluationPlanArtifact,
      context,
    );
    const failures = results.filter((r) => !r.passed);
    if (failures.length) console.error(failures.map((f) => `${f.clauseId}: ${f.message}`).join('\n'));
    expect(failures).toEqual([]);
  });

  it('breaks C-8.2.3 when threshold is empty', () => {
    const broken: QualityEvaluationPlanArtifact = {
      kind: 'quality_evaluation_plan',
      criteria: [{ nonfunctional_requirement_id: 'NFR-019', threshold: '', measurement_method: 'm' }],
    };
    const results = runContractSuite(phase8QualityEvaluationContract, broken, { workflowRunId: 'neg', relatedArtifacts: new Map() });
    const f = results.find((r) => r.clauseId === 'C-8.2.3');
    expect(f?.passed).toBe(false);
  });
});
