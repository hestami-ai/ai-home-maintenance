import { describe, it, expect } from 'vitest';
import { runContractSuite } from './runner';
import { phase7TestCaseSkeletonContract, type TestPlanArtifact } from './phase7-test-case-skeleton.contract';
import ideal from './fixtures/phase7-test-plan.ideal.json' assert { type: 'json' };
import fr from './fixtures/phase2-functional-requirements.ideal.json' assert { type: 'json' };
import cm from './fixtures/phase4-component-model.ideal.json' assert { type: 'json' };

describe('Phase 7.1 test_case_skeleton contract — forward', () => {
  it('ideal fixture passes (with FR + component context)', () => {
    const context = {
      workflowRunId: 'fwd',
      relatedArtifacts: new Map<string, ReadonlyArray<unknown>>([
        ['functional_requirements', [fr]],
        ['component_model', [cm]],
      ]),
    };
    const results = runContractSuite(
      phase7TestCaseSkeletonContract,
      ideal as unknown as TestPlanArtifact,
      context,
    );
    const failures = results.filter((r) => !r.passed);
    if (failures.length) console.error(failures.map((f) => `${f.clauseId}: ${f.message}`).join('\n'));
    expect(failures).toEqual([]);
  });

  it('breaks C-7.1.4 when a test case has empty acceptance_criterion_ids', () => {
    const broken: TestPlanArtifact = {
      kind: 'test_plan',
      test_suites: [{
        suite_id: 'TS-X',
        component_id: 'comp-x',
        test_type: 'integration',
        test_cases: [{ test_case_id: 'TC-X', type: 'functional', acceptance_criterion_ids: [], expected_outcome: 'x' }],
      }],
    };
    const results = runContractSuite(phase7TestCaseSkeletonContract, broken, { workflowRunId: 'neg', relatedArtifacts: new Map() });
    const f = results.find((r) => r.clauseId === 'C-7.1.4');
    expect(f?.passed).toBe(false);
  });
});
