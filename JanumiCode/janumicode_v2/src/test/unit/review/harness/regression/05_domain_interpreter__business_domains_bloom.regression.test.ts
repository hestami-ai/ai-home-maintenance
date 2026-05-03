/**
 * Track D Commit 11 — Sample 05 regression (business_domains_bloom).
 */

import { describe, it, expect } from 'vitest';
import { runRegressionSample } from './regressionRunner';
import { highFinding } from './mockHarnessLLMCaller';
import { loadSample } from './loadSample';

const SAMPLE_ID = '05_domain_interpreter__business_domains_bloom';

/** Build a snake_case-normalised payload from the captured camelCase sample.
 * Captured sample is camelCase (pre-snake-case-flip); normalize for the new
 * wire-format contract. Re-capture after next cal run. */
function snake05() {
  const s = loadSample(SAMPLE_ID);
  if (!s.responseParsed) return null;
  const p = s.responseParsed;
  const domains = Array.isArray(p.domains)
    ? p.domains.map((d: Record<string, unknown>) => ({
        ...d,
        entity_preview: d.entityPreview ?? d.entity_preview,
        workflow_preview: d.workflowPreview ?? d.workflow_preview,
      }))
    : p.domains;
  return { ...p, domains };
}

describe(`regression: ${SAMPLE_ID}`, () => {
  it('dispatches the bloom bundle', async () => {
    const { outcome } = await runRegressionSample({
      sampleId: SAMPLE_ID,
      responseParsedOverride: snake05(),
    });
    expect(outcome.validatorsDispatched).toEqual(
      expect.arrayContaining([
        'contract_schema_validator',
        'persona_id_continuity',
        'entity_workflow_shape',
        'source_attribution_grounding',
        'domain_persona_coherence',
        'source_grouping_coverage',
        'bloom_completeness_vs_thinking',
        'reasoning_to_response_faithfulness',
        'reasoning_quality_validator',
        'final_synthesis',
      ]),
    );
  });

  it('escalates on a source_attribution_grounding HIGH finding', async () => {
    const { completedHarnessContent } = await runRegressionSample({
      sampleId: SAMPLE_ID,
      responseParsedOverride: snake05(),
      mockedLLMResponses: {
        source_attribution_grounding: highFinding(
          'misattributed_source',
          'Bloom item tagged document-specified without an attestable source span',
        ),
      },
    });
    expect(['REVISE', 'QUARANTINE', 'ESCALATE']).toContain(
      completedHarnessContent.decision_recommendation,
    );
  });
});
