/**
 * Prompt probe: Narrative Memory Generator (cross-cutting)
 */

import { describe, it, expect } from 'vitest';
import { runProbe, checkOllama } from './probeRunner';
import { logResult } from './probeHelpers';

describe('Probe: Narrative Memory Generator', () => {
  it('generates structured narrative memory with citations', async () => {
    const available = await checkOllama();
    if (!available) return;

    const result = await runProbe({
      name: 'narrative_memory_phase1',
      templateKey: 'cross_cutting/narrative_memory.system',
      variables: {
        phase_id: '1',
        phase_name: 'Intent Capture and Convergence',
        decision_trace_summary: `Decision 1 (rec-d1): Selected product concept "task management for small teams"
Decision 2 (rec-d2): Confirmed assumption that web-based interface is preferred
Decision 3 (rec-d3): Approved phase gate with attestation`,
        approved_artifacts: `intent_statement (rec-a1): {product_concept: "TaskFlow", who_it_serves: "small software teams"}
scope_classification (rec-a2): {breadth: "single_product", depth: "production_grade"}`,
        prior_narrative_memory: '',
        unsticking_summaries: '',
        janumicode_version_sha: 'test-probe',
      },
      expectedArtifactType: 'reasoning_review_output',
      structuralAssertions: (parsed) => {
        const errors: string[] = [];
        if (typeof parsed.continuity_summary !== 'string') errors.push('Missing continuity_summary string');
        if (!Array.isArray(parsed.sub_phases)) errors.push('Missing sub_phases array');
        if (!Array.isArray(parsed.governing_constraints_established)) {
          errors.push('Missing governing_constraints_established array');
        }
        return errors;
      },
      judgeRubric: {
        name: 'Narrative Memory for Phase 1',
        criteria: [
          'continuity_summary describes Phase 1 as Intent Capture and Convergence',
          'Every key_decision cites a source_record_id from the input (rec-d1, rec-d2, or rec-d3)',
          'Every assumption_confirmed cites a source_record_id',
          'No claims are made without source_record_id citations',
          'No invented decisions or artifacts not in the input',
          'governing_constraints_established are populated where applicable',
        ],
        reasoningCriteria: [
          'The narrative does NOT compress competing viewpoints into a single voice',
          'The narrative does NOT omit qualifiers or conditional language',
          'The narrative does NOT imply stability where decisions actually changed',
          'Every substantive claim cites a source record',
          'Where evidence was partial or contested, uncertainty is expressed',
        ],
      },
    });

    logResult(result);
    expect(result.parsed).not.toBeNull();
    expect(result.structuralValid).toBe(true);
    expect(result.judgePassed).toBe(true);
  }, 600000);
});
