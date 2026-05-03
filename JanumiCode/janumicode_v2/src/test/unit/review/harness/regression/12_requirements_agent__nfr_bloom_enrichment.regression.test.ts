/**
 * Track D Commit 11 — Sample 12 regression (nfr_bloom_enrichment).
 */

import { describe, it, expect } from 'vitest';
import { runRegressionSample } from './regressionRunner';
import { highFinding } from './mockHarnessLLMCaller';

const SAMPLE_ID = '12_requirements_agent__nfr_bloom_enrichment';

describe(`regression: ${SAMPLE_ID}`, () => {
  it('dispatches the NFR-enrichment bundle', async () => {
    const { outcome } = await runRegressionSample({ sampleId: SAMPLE_ID });
    expect(outcome.validatorsDispatched).toEqual(
      expect.arrayContaining([
        'contract_schema_validator',
        'enrichment_echo_invariance',
        'output_substantiveness_check',
        'exemplar_leakage_detector',
        'measurement_adequacy_validator',
        'threshold_grounding_audit',
        'measurement_method_executability',
        'skeleton_drift_audit',
        'pass_scope_discipline',
        'reasoning_to_response_faithfulness',
        'final_synthesis',
      ]),
    );
  });

  it('escalates to QUARANTINE on measurement_adequacy + threshold_grounding HIGHs', async () => {
    const { completedHarnessContent } = await runRegressionSample({
      sampleId: SAMPLE_ID,
      mockedLLMResponses: {
        measurement_adequacy_validator: highFinding(
          'zero_direct_traffic_unmeasurable',
          '"0% direct origin traffic" lacks an attestable measurement method (no VPC flow logs)',
        ),
        threshold_grounding_audit: highFinding(
          'cadence_imported_from_exemplar',
          '1-minute cadence imported verbatim from exemplar block, not substrate',
        ),
      },
    });
    expect(['QUARANTINE', 'ESCALATE']).toContain(
      completedHarnessContent.decision_recommendation,
    );
  });
});
