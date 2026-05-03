/**
 * Track D Commit 11 — Sample 11 regression (nfr_bloom_skeleton).
 *
 * Captured-sample notes:
 *   1. The captured response uses `requirements: [...]` instead of the
 *      documented `nfrs: [...]`. contract_schema_validator catches this as
 *      HIGH `missing_required_field` (S11 schema still requires `nfrs`).
 *   2. fr_trace_pollution_check now iterates `out.requirements` directly,
 *      so NFR-003.traces_to "US-005 AC-005" is caught on the raw payload
 *      without any normalization shim.
 */

import { describe, it, expect } from 'vitest';
import { runRegressionSample } from './regressionRunner';
import { highFinding } from './mockHarnessLLMCaller';

const SAMPLE_ID = '11_requirements_agent__nfr_bloom_skeleton';

describe(`regression: ${SAMPLE_ID}`, () => {
  it('dispatches the NFR-skeleton bundle', async () => {
    const { outcome } = await runRegressionSample({ sampleId: SAMPLE_ID });
    expect(outcome.validatorsDispatched).toEqual(
      expect.arrayContaining([
        'contract_schema_validator',
        'nfr_structural_completeness',
        'fr_trace_pollution_check',
        'handoff_coverage_audit',
        'source_attribution_grounding',
        'nfr_shape_conformance',
        'threshold_presence_check',
        'quality_attribute_taxonomy_alignment',
        'measurement_adequacy_validator',
        'final_synthesis',
      ]),
    );
  });

  it('contract_schema_validator emits HIGH on the requirements/nfrs field-name mismatch', async () => {
    const { outcome } = await runRegressionSample({ sampleId: SAMPLE_ID });
    const missingNfrs = outcome.findings.find(
      (f) =>
        f.validatorId === 'contract_schema_validator' &&
        f.type === 'missing_required_field',
    );
    expect(missingNfrs?.severity).toBe('HIGH');
    expect(missingNfrs?.location).toContain('nfrs');
  });

  it('fr_trace_pollution_check catches the FR-id pollution in the captured payload', async () => {
    const { outcome, sample } = await runRegressionSample({ sampleId: SAMPLE_ID });
    expect(sample.responseParsed).toBeTruthy();
    const pollution = outcome.findings.filter(
      (f) => f.validatorId === 'fr_trace_pollution_check',
    );
    expect(pollution.length).toBeGreaterThan(0);
    expect(pollution[0].severity).toBe('HIGH');
    expect(pollution[0].type).toBe('fr_id_in_nfr_traces');
  });

  it('escalates the decision on the captured contract violation', async () => {
    const { completedHarnessContent } = await runRegressionSample({
      sampleId: SAMPLE_ID,
      mockedLLMResponses: {
        threshold_presence_check: highFinding(
          'aspirational_threshold',
          'NFR-003 threshold is aspirational, not measurable',
        ),
      },
    });
    expect(['REVISE', 'QUARANTINE', 'ESCALATE']).toContain(
      completedHarnessContent.decision_recommendation,
    );
  });
});
