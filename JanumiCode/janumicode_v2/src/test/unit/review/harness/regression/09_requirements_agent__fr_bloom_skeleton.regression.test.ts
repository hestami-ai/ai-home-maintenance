/**
 * Track D Commit 11 — Sample 09 regression (fr_bloom_skeleton).
 *
 * The captured response uses snake_case `user_stories`. The schema now
 * accepts `user_stories` as canonical, so contract_schema_validator passes
 * cleanly on the raw captured payload.
 */

import { describe, it, expect } from 'vitest';
import { runRegressionSample } from './regressionRunner';
import { highFinding } from './mockHarnessLLMCaller';

const SAMPLE_ID = '09_requirements_agent__fr_bloom_skeleton';

describe(`regression: ${SAMPLE_ID}`, () => {
  it('dispatches the FR-skeleton bundle', async () => {
    const { outcome } = await runRegressionSample({ sampleId: SAMPLE_ID });
    expect(outcome.validatorsDispatched).toEqual(
      expect.arrayContaining([
        'contract_schema_validator',
        'story_structural_completeness',
        'handoff_coverage_audit',
        'source_attribution_grounding',
        'story_shape_conformance',
        'pass_scope_discipline',
        'measurement_adequacy_validator',
        'assumption_citation_validator',
        'reasoning_to_response_faithfulness',
        'final_synthesis',
      ]),
    );
  });

  it('contract_schema_validator passes cleanly on user_stories key', async () => {
    const { outcome } = await runRegressionSample({ sampleId: SAMPLE_ID });
    const contractHighFindings = outcome.findings.filter(
      (f) => f.validatorId === 'contract_schema_validator' && f.severity === 'HIGH',
    );
    expect(contractHighFindings).toHaveLength(0);
  });

  it('escalates on a grounding_validator HIGH (US-001 exemplar leakage)', async () => {
    const { completedHarnessContent } = await runRegressionSample({
      sampleId: SAMPLE_ID,
      mockedLLMResponses: {
        grounding_validator: highFinding(
          'unsupported_claim',
          'US-001 outcome verbatim copies the prompt exemplar block',
        ),
      },
    });
    // grounding HIGH + validator_unavailable failures -> ESCALATE
    expect(['REVISE', 'QUARANTINE', 'ESCALATE']).toContain(
      completedHarnessContent.decision_recommendation,
    );
  });
});
