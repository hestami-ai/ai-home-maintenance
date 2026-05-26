import { describe, it, expect } from 'vitest';
import { runContractSuite } from './runner';
import { phase8ReasoningEvaluationContract, type ReasoningEvaluationPlanArtifact } from './phase8-reasoning-evaluation.contract';
import ideal from './fixtures/phase8-reasoning-evaluation-plan.ideal.json' assert { type: 'json' };

describe('Phase 8.3 reasoning_evaluation contract — forward', () => {
  it('ideal fixture passes (no AI subsystems → no scenarios)', () => {
    const results = runContractSuite(
      phase8ReasoningEvaluationContract,
      ideal as unknown as ReasoningEvaluationPlanArtifact,
      { workflowRunId: 'fwd', relatedArtifacts: new Map() },
    );
    const failures = results.filter((r) => !r.passed);
    if (failures.length) console.error(failures.map((f) => `${f.clauseId}: ${f.message}`).join('\n'));
    expect(failures).toEqual([]);
  });

  it('breaks C-8.3.2 when ai_subsystems_detected=true with empty scenarios', () => {
    const broken: ReasoningEvaluationPlanArtifact = {
      kind: 'reasoning_evaluation_plan',
      ai_subsystems_detected: true,
      scenarios: [],
    };
    const results = runContractSuite(phase8ReasoningEvaluationContract, broken, { workflowRunId: 'neg', relatedArtifacts: new Map() });
    const f = results.find((r) => r.clauseId === 'C-8.3.2');
    expect(f?.passed).toBe(false);
  });
});
