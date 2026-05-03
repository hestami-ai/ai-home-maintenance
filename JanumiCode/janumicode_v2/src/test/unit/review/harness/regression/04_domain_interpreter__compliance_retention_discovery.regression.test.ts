/**
 * Track D Commit 11 — Sample 04 regression (compliance_retention_discovery).
 *
 * The captured response in this sample contains UNESCAPED inner quotes
 * inside a JSON string literal (a real captured-agent defect). The
 * harness's contract_schema_validator catches that via the
 * outputContent=null → HIGH `invalid_json` branch.
 *
 * Note: because this sample is deliberately malformed JSON (null
 * responseParsed), there is nothing to normalize for the snake_case flip.
 * Captured sample is camelCase (pre-snake-case-flip); re-capture after next cal run.
 */

import { describe, it, expect } from 'vitest';
import { runRegressionSample } from './regressionRunner';
import { highFinding } from './mockHarnessLLMCaller';

const SAMPLE_ID = '04_domain_interpreter__compliance_retention_discovery';

describe(`regression: ${SAMPLE_ID}`, () => {
  it('dispatches the compliance-discovery bundle', async () => {
    const { outcome } = await runRegressionSample({ sampleId: SAMPLE_ID });
    expect(outcome.validatorsDispatched).toEqual(
      expect.arrayContaining([
        'contract_schema_validator',
        'extraction_id_traceability',
        'regime_citation_validity',
        'retention_threshold_grounding',
        'compliance_signal_completeness',
        'open_question_vs_decided',
        'reasoning_to_response_faithfulness',
        'final_synthesis',
      ]),
    );
  });

  it('contract_schema_validator emits HIGH invalid_json for the captured malformed response', async () => {
    const { outcome } = await runRegressionSample({ sampleId: SAMPLE_ID });
    const invalid = outcome.findings.find(
      (f) =>
        f.validatorId === 'contract_schema_validator' && f.type === 'invalid_json',
    );
    expect(invalid?.severity).toBe('HIGH');
  });

  it('escalates on a regime_citation_validity HIGH finding', async () => {
    const { completedHarnessContent } = await runRegressionSample({
      sampleId: SAMPLE_ID,
      mockedLLMResponses: {
        regime_citation_validity: highFinding(
          'regime_unattested',
          'Cited regulatory regime is not attested in the source span',
        ),
      },
    });
    expect(['REVISE', 'QUARANTINE', 'ESCALATE']).toContain(
      completedHarnessContent.decision_recommendation,
    );
  });
});
