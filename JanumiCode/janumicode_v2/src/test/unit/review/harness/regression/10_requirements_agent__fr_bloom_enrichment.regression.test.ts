/**
 * Track D Commit 11 — Sample 10 regression (fr_bloom_enrichment).
 */

import { describe, it, expect } from 'vitest';
import { runRegressionSample } from './regressionRunner';
import { highFinding } from './mockHarnessLLMCaller';

const SAMPLE_ID = '10_requirements_agent__fr_bloom_enrichment';

describe(`regression: ${SAMPLE_ID}`, () => {
  it('dispatches the FR-enrichment bundle', async () => {
    const { outcome } = await runRegressionSample({ sampleId: SAMPLE_ID });
    expect(outcome.validatorsDispatched).toEqual(
      expect.arrayContaining([
        'contract_schema_validator',
        'enrichment_echo_invariance',
        'ac_count_discipline',
        'exemplar_leakage_detector',
        'measurement_adequacy_validator',
        'threshold_grounding_audit',
        'measurable_condition_executability',
        'skeleton_drift_audit',
        'pass_scope_discipline',
        'reasoning_to_response_faithfulness',
        'final_synthesis',
      ]),
    );
  });

  it('escalates on a measurement_adequacy_validator HIGH (existence-as-coverage failure)', async () => {
    const { completedHarnessContent, outcome } = await runRegressionSample({
      sampleId: SAMPLE_ID,
      mockedLLMResponses: {
        measurement_adequacy_validator: highFinding(
          'existence_as_coverage',
          'AC-014 measures existence of artefact rather than coverage',
        ),
      },
    });
    expect(
      outcome.findings.some(
        (f) =>
          f.validatorId === 'measurement_adequacy_validator' && f.severity === 'HIGH',
      ),
    ).toBe(true);
    expect(['REVISE', 'QUARANTINE', 'ESCALATE']).toContain(
      completedHarnessContent.decision_recommendation,
    );
  });
});
