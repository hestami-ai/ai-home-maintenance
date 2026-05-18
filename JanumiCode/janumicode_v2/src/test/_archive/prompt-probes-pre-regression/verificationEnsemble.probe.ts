/**
 * Prompt probe: Verification Ensemble Secondary Reviewer (cross-cutting)
 *
 * The secondary reviewer in a Verification Ensemble. Same flaw taxonomy as
 * the primary Reasoning Review. Tests that the model produces the same
 * output schema independently.
 */

import { describe, it, expect } from 'vitest';
import { runProbe, checkOllama } from './probeRunner';
import { logResult } from './probeHelpers';

describe('Probe: Verification Ensemble Secondary', () => {
  it('produces independent review of clean trace', async () => {
    const available = await checkOllama();
    if (!available) return;

    const result = await runProbe({
      name: 'verification_ensemble_secondary_clean',
      templateKey: 'cross_cutting/verification_ensemble_secondary.system',
      variables: {
        trace_selection: `[REASONING] (seq 0):
The intent is well-formed. All required fields are present.

[REASONING] (seq 1):
No contradictions detected.

FINAL OUTPUT: {"completeness_findings": [], "consistency_findings": [], "overall_status": "pass"}`,
        required_output_specification: 'intent_quality_report with completeness_findings, consistency_findings, coherence_findings, overall_status',
        phase_gate_criteria: 'overall_status is pass or requires_input',
        final_output: '{"overall_status": "pass"}',
        primary_review_result: '(not shown to secondary reviewer per spec)',
        janumicode_version_sha: 'test-probe',
      },
      expectedArtifactType: 'reasoning_review_output',
      structuralAssertions: (parsed) => {
        const errors: string[] = [];
        if (typeof parsed.overall_pass !== 'boolean') errors.push('Missing overall_pass');
        if (!Array.isArray(parsed.flaws)) errors.push('Missing flaws array');
        return errors;
      },
      judgeRubric: {
        name: 'Verification Ensemble Secondary Reviewer',
        criteria: [
          'overall_pass is true (the trace is clean)',
          'flaws array is empty',
          'Output uses the reviewer flaw-report schema (overall_pass + flaws), NOT the reviewed agent\'s schema',
          'No invented flaws — assessment is grounded in the actual trace',
        ],
        reasoningCriteria: [
          'The secondary reviewer produced its assessment independently (not parroting any primary review)',
          'The reviewer scanned for flaws across the full taxonomy before concluding clean',
        ],
      },
    });

    logResult(result);
    expect(result.parsed).not.toBeNull();
    expect(result.structuralValid).toBe(true);
    expect(result.judgePassed).toBe(true);
  }, 600000);
});
