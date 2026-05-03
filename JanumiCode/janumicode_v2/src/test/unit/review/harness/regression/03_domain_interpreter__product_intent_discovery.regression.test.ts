/**
 * Track D Commit 11 — Sample 03 regression (product_intent_discovery).
 */

import { describe, it, expect } from 'vitest';
import { runRegressionSample } from './regressionRunner';
import { highFinding } from './mockHarnessLLMCaller';
import { loadSample } from './loadSample';

const SAMPLE_ID = '03_domain_interpreter__product_intent_discovery';

/** Build a snake_case-normalised payload from the captured camelCase sample.
 * Captured sample is camelCase (pre-snake-case-flip); normalize for the new
 * wire-format contract. Re-capture after next cal run. */
function snake03() {
  const s = loadSample(SAMPLE_ID);
  if (!s.responseParsed) return null;
  const p = s.responseParsed;
  return {
    ...p,
    analysis_summary: p.analysisSummary ?? p.analysis_summary,
    product_vision: p.productVision ?? p.product_vision,
    product_description: p.productDescription ?? p.product_description,
    user_journeys: p.userJourneys ?? p.user_journeys,
    phasing_strategy: p.phasingStrategy ?? p.phasing_strategy,
    success_metrics: p.successMetrics ?? p.success_metrics,
    ux_requirements: p.uxRequirements ?? p.ux_requirements,
    open_questions: p.openQuestions ?? p.open_questions,
  };
}

describe(`regression: ${SAMPLE_ID}`, () => {
  it('dispatches the discovery bundle', async () => {
    const { outcome } = await runRegressionSample({
      sampleId: SAMPLE_ID,
      responseParsedOverride: snake03(),
    });
    expect(outcome.validatorsDispatched).toEqual(
      expect.arrayContaining([
        'contract_schema_validator',
        'extraction_id_traceability',
        'scope_boundary_adherence_discovery',
        'external_reference_handling',
        'open_question_vs_decided',
        'assumption_citation_validator',
        'reasoning_to_response_faithfulness',
        'final_synthesis',
      ]),
    );
  });

  it('escalates on an external_reference_handling HIGH finding', async () => {
    const { completedHarnessContent, outcome } = await runRegressionSample({
      sampleId: SAMPLE_ID,
      responseParsedOverride: snake03(),
      mockedLLMResponses: {
        external_reference_handling: highFinding(
          'absorbed_external_product',
          'External product absorbed into native extraction without surfaced decision',
        ),
      },
    });
    expect(
      outcome.findings.some(
        (f) => f.validatorId === 'external_reference_handling' && f.severity === 'HIGH',
      ),
    ).toBe(true);
    expect(['REVISE', 'QUARANTINE', 'ESCALATE']).toContain(
      completedHarnessContent.decision_recommendation,
    );
  });
});
