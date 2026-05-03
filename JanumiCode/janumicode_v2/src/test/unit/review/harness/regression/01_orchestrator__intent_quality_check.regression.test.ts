/**
 * Track D Commit 11 — Sample 01 regression.
 *
 * Per per_role_assessments/01: dispatched bundle = contract_schema +
 * status_consistency_iqc + completeness_evidence_adequacy +
 * coherence_evidence_audit + grounding + reasoning_to_response_faithfulness
 * + final_synthesis. Original defect: hasConcerns ↔ concerns.length
 * invariant. Captured sample is the *clean* baseline (overall_status=pass,
 * concerns=[]); status_consistency_iqc therefore returns [] on it. The
 * deterministic invariant is exercised by a synthetic-payload override.
 */

import { describe, it, expect } from 'vitest';
import { runRegressionSample } from './regressionRunner';
import { highFinding } from './mockHarnessLLMCaller';

const SAMPLE_ID = '01_orchestrator__intent_quality_check';

describe(`regression: ${SAMPLE_ID}`, () => {
  it('dispatches the IQC bundle including the role-specific validators', async () => {
    const { outcome } = await runRegressionSample({ sampleId: SAMPLE_ID });
    expect(outcome.validatorsDispatched).toEqual(
      expect.arrayContaining([
        'contract_schema_validator',
        'status_consistency_iqc',
        'completeness_evidence_adequacy',
        'coherence_evidence_audit',
        'grounding_validator',
        'reasoning_to_response_faithfulness',
        'final_synthesis',
      ]),
    );
  });

  it('status_consistency_iqc catches the hasConcerns ↔ concerns.length invariant', async () => {
    // Synthetic payload: mismatch hasConcerns vs concerns.length to
    // exercise the original-defect invariant deterministically.
    const { outcome } = await runRegressionSample({
      sampleId: SAMPLE_ID,
      responseParsedOverride: {
        overall_status: 'pass',
        concerns: [],
        hasConcerns: true,
      },
    });
    const sci = outcome.findings.filter(
      (f) => f.validatorId === 'status_consistency_iqc',
    );
    expect(sci.length).toBeGreaterThan(0);
    expect(sci[0].severity).toBe('HIGH');
    expect(sci[0].type).toBe('has_concerns_mismatch');
  });

  it('decision is at least REVISE when an LLM validator surfaces a HIGH finding', async () => {
    const { completedHarnessContent } = await runRegressionSample({
      sampleId: SAMPLE_ID,
      mockedLLMResponses: {
        coherence_evidence_audit: highFinding(
          'missing_concrete_defect',
          'Coherence audit surfaced a defect not represented in coherence_findings',
        ),
      },
    });
    expect(['REVISE', 'QUARANTINE', 'ESCALATE']).toContain(
      completedHarnessContent.decision_recommendation,
    );
  });
});
