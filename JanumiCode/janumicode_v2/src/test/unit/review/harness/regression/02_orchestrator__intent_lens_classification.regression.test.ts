/**
 * Track D Commit 11 — Sample 02 regression (intent_lens_classification).
 */

import { describe, it, expect } from 'vitest';
import { runRegressionSample } from './regressionRunner';
import { highFinding } from './mockHarnessLLMCaller';

const SAMPLE_ID = '02_orchestrator__intent_lens_classification';

describe(`regression: ${SAMPLE_ID}`, () => {
  it('dispatches the lens-classification bundle', async () => {
    const { outcome } = await runRegressionSample({ sampleId: SAMPLE_ID });
    expect(outcome.validatorsDispatched).toEqual(
      expect.arrayContaining([
        'contract_schema_validator',
        'calibration_rule_consistency_lens',
        'confidence_calibration_lens',
        'intent_vs_artifact_scope_audit',
        'reasoning_to_response_faithfulness',
        'final_synthesis',
      ]),
    );
  });

  it('calibration_rule_consistency_lens deterministic body executes (no failure)', async () => {
    const { outcome } = await runRegressionSample({ sampleId: SAMPLE_ID });
    expect(
      outcome.validatorFailures.some(
        (f) => f.validatorId === 'calibration_rule_consistency_lens',
      ),
    ).toBe(false);
  });

  it('escalates to at least REVISE on a confidence-calibration HIGH', async () => {
    const { completedHarnessContent } = await runRegressionSample({
      sampleId: SAMPLE_ID,
      mockedLLMResponses: {
        confidence_calibration_lens: highFinding(
          'over_claimed_confidence',
          'Confidence band over-claimed without competitor analysis',
        ),
      },
    });
    expect(['REVISE', 'QUARANTINE', 'ESCALATE']).toContain(
      completedHarnessContent.decision_recommendation,
    );
  });
});
