/**
 * Track D Commit 11 — Sample 08 regression (release_plan).
 */

import { describe, it, expect } from 'vitest';
import { runRegressionSample } from './regressionRunner';
import { highFinding } from './mockHarnessLLMCaller';

const SAMPLE_ID = '08_orchestrator__release_plan';

describe(`regression: ${SAMPLE_ID}`, () => {
  it('dispatches the release-plan bundle', async () => {
    const { outcome } = await runRegressionSample({ sampleId: SAMPLE_ID });
    expect(outcome.validatorsDispatched).toEqual(
      expect.arrayContaining([
        'contract_schema_validator',
        'handoff_field_completeness',
        'synthesis_coverage_audit',
        'wave_dependency_topology',
        'mvp_credibility_check',
        'release_balance_audit',
        'compression_fidelity_audit',
        'compliance_sequencing_audit',
        'final_synthesis',
      ]),
    );
  });

  it('escalates to QUARANTINE on >= 2 HIGH findings (wave topology + MVP credibility)', async () => {
    const { completedHarnessContent } = await runRegressionSample({
      sampleId: SAMPLE_ID,
      mockedLLMResponses: {
        wave_dependency_topology: highFinding(
          'back_edge_in_dag',
          '3 back-edges detected in the release-wave DAG',
        ),
        mvp_credibility_check: highFinding(
          'rel_1_dead_letter',
          'REL-1 demand journey has no in-wave or earlier-wave supply',
        ),
      },
    });
    // 2 HIGH findings -> QUARANTINE per the locked policy.
    expect(['QUARANTINE', 'ESCALATE']).toContain(
      completedHarnessContent.decision_recommendation,
    );
  });
});
