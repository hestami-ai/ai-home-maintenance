/**
 * Track D Commit 11 — Sample 07 regression (product_description_synthesis).
 */

import { describe, it, expect } from 'vitest';
import { runRegressionSample } from './regressionRunner';
import { highFinding } from './mockHarnessLLMCaller';
import { loadSample } from './loadSample';

const SAMPLE_ID = '07_domain_interpreter__product_description_synthesis';

/** Build a snake_case-normalised payload from the captured camelCase sample.
 * Captured sample is camelCase (pre-snake-case-flip); normalize for the new
 * wire-format contract. Re-capture after next cal run. */
function snake07() {
  const s = loadSample(SAMPLE_ID);
  if (!s.responseParsed) return null;
  const p = s.responseParsed;
  return {
    ...p,
    product_vision: p.productVision ?? p.product_vision,
    product_description: p.productDescription ?? p.product_description,
    open_loops: p.openLoops ?? p.open_loops,
  };
}

describe(`regression: ${SAMPLE_ID}`, () => {
  it('dispatches the synthesis bundle', async () => {
    const { outcome } = await runRegressionSample({
      sampleId: SAMPLE_ID,
      responseParsedOverride: snake07(),
    });
    expect(outcome.validatorsDispatched).toEqual(
      expect.arrayContaining([
        'contract_schema_validator',
        'handoff_field_completeness',
        'synthesis_coverage_audit',
        'compression_fidelity_audit',
        'synthesis_fabrication_check',
        'phasing_dependency_consistency',
        'reasoning_to_response_faithfulness',
        'final_synthesis',
      ]),
    );
  });

  it('escalates on a synthesis_coverage_audit HIGH (dropped personas)', async () => {
    const { completedHarnessContent, outcome } = await runRegressionSample({
      sampleId: SAMPLE_ID,
      responseParsedOverride: snake07(),
      mockedLLMResponses: {
        synthesis_coverage_audit: highFinding(
          'dropped_substrate_items',
          '5 personas were dropped silently from the synthesis (no SURVIVED tag)',
        ),
      },
    });
    expect(
      outcome.findings.some(
        (f) => f.validatorId === 'synthesis_coverage_audit' && f.severity === 'HIGH',
      ),
    ).toBe(true);
    expect(['REVISE', 'QUARANTINE', 'ESCALATE']).toContain(
      completedHarnessContent.decision_recommendation,
    );
  });
});
