/**
 * Track D Commit 11 — regression-corpus smoke runner.
 *
 * Loads ALL 12 captured samples and drives `runReviewHarness` with NO
 * mocked LLM responses (default empty-findings envelope). Asserts:
 *   - every sample produces a completed harness record
 *   - dispatch lists are non-empty
 *   - the harness never throws
 *
 * This test exists separately from the per-sample regression files: it
 * validates harness PERSISTENCE / DISPATCH end-to-end without depending
 * on per-sample LLM-mock fidelity.
 */

import { describe, it, expect } from 'vitest';
import { SAMPLE_IDS } from './loadSample';
import { runRegressionSample } from './regressionRunner';

describe('reasoning-review harness — regression smoke (all 12 samples)', () => {
  for (const sampleId of SAMPLE_IDS) {
    it(`produces a completed harness record for ${sampleId}`, async () => {
      const { outcome, completedHarnessContent } = await runRegressionSample({
        sampleId,
      });
      expect(outcome.skipped).toBe(false);
      expect(outcome.harnessRecordId).toBeTruthy();
      expect(outcome.validatorsDispatched.length).toBeGreaterThan(0);
      expect(completedHarnessContent.status).toBe('completed');
      expect(completedHarnessContent.decision_recommendation).toBeDefined();
      // Universal validators must always dispatch.
      expect(outcome.validatorsDispatched).toContain('contract_schema_validator');
      expect(outcome.validatorsDispatched).toContain('final_synthesis');
    });
  }

  it('every sample has a non-empty extracted response and thinking body', async () => {
    // The loader must extract both the response and thinking text from
    // each sample. JSON parsability is NOT asserted here — sample 04's
    // captured response contains unescaped inner quotes (a real captured
    // agent defect that the harness's contract_schema_validator catches
    // via its outputContent=null branch). The harness handles unparseable
    // responses by emitting a HIGH `invalid_json` finding.
    const { loadSample } = await import('./loadSample');
    for (const sampleId of SAMPLE_IDS) {
      const sample = loadSample(sampleId);
      expect(
        sample.response.length,
        `sample ${sampleId} response body must be non-empty`,
      ).toBeGreaterThan(0);
      expect(
        sample.thinking.length,
        `sample ${sampleId} thinking must be non-empty`,
      ).toBeGreaterThan(0);
    }
  });

  it('sample 04 (with malformed JSON) is detected as a contract violation', async () => {
    // Documents that the harness handles captured-agent JSON parse
    // failures gracefully — outputContent is null, contract_schema_validator
    // emits HIGH invalid_json, and the decision escalates to at least REVISE.
    const { outcome, completedHarnessContent } = await runRegressionSample({
      sampleId: '04_domain_interpreter__compliance_retention_discovery',
    });
    const decision = completedHarnessContent.decision_recommendation;
    expect(decision).toBeDefined();
    // outputContent=null path raises HIGH invalid_json from the
    // contract_schema_validator.
    const invalidJsonFinding = outcome.findings.find(
      (f) =>
        f.validatorId === 'contract_schema_validator' && f.type === 'invalid_json',
    );
    expect(invalidJsonFinding?.severity).toBe('HIGH');
    expect(['REVISE', 'QUARANTINE', 'ESCALATE']).toContain(decision);
  });
});
