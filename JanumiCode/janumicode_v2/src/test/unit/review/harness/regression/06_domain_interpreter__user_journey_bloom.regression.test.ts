/**
 * Track D Commit 11 — Sample 06 regression (user_journey_bloom).
 */

import { describe, it, expect } from 'vitest';
import { runRegressionSample } from './regressionRunner';
import { highFinding } from './mockHarnessLLMCaller';
import { loadSample } from './loadSample';

const SAMPLE_ID = '06_domain_interpreter__user_journey_bloom';

/** Build a snake_case-normalised payload from the captured camelCase sample.
 * Captured sample is camelCase (pre-snake-case-flip); normalize for the new
 * wire-format contract. Re-capture after next cal run. */
function snake06() {
  const s = loadSample(SAMPLE_ID);
  if (!s.responseParsed) return null;
  const p = s.responseParsed;
  const journeys = Array.isArray(p.userJourneys)
    ? p.userJourneys.map((j: Record<string, unknown>) => ({
        ...j,
        persona_id: j.personaId ?? j.persona_id,
        acceptance_criteria: j.acceptanceCriteria ?? j.acceptance_criteria,
        implementation_phase: j.implementationPhase ?? j.implementation_phase,
        business_domain_ids: j.businessDomainIds ?? j.business_domain_ids,
      }))
    : p.userJourneys;
  return { ...p, user_journeys: journeys };
}

describe(`regression: ${SAMPLE_ID}`, () => {
  it('dispatches the user-journey bloom bundle', async () => {
    const { outcome } = await runRegressionSample({
      sampleId: SAMPLE_ID,
      responseParsedOverride: snake06(),
    });
    expect(outcome.validatorsDispatched).toEqual(
      expect.arrayContaining([
        'contract_schema_validator',
        'persona_id_continuity',
        'journey_id_continuity',
        'source_attribution_grounding',
        'surface_attribution_completeness',
        'persona_journey_coupling',
        'workflow_journey_separation',
        'step_completeness_and_automatable',
        'acceptance_criteria_measurability',
        'phase_journey_alignment',
        'final_synthesis',
      ]),
    );
  });

  it('escalates on a surface_attribution_completeness HIGH (compliance evacuation)', async () => {
    const { completedHarnessContent } = await runRegressionSample({
      sampleId: SAMPLE_ID,
      responseParsedOverride: snake06(),
      mockedLLMResponses: {
        surface_attribution_completeness: highFinding(
          'compliance_surface_evacuation',
          'Journey surfaces[] omits the upstream compliance items the journey enacts',
        ),
      },
    });
    expect(['REVISE', 'QUARANTINE', 'ESCALATE']).toContain(
      completedHarnessContent.decision_recommendation,
    );
  });
});
