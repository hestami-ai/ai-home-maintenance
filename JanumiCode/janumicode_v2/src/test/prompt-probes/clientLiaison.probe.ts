/**
 * Prompt probes: Client Liaison Agent (query_classification + synthesis)
 */

import { describe, it, expect } from 'vitest';
import { runProbe, checkOllama } from './probeRunner';
import { logResult } from './probeHelpers';

describe('Probe: Client Liaison Query Classification', () => {
  it('classifies historical lookup query', async () => {
    const available = await checkOllama();
    if (!available) return;

    const result = await runProbe({
      name: 'client_liaison_classify_historical',
      templateKey: 'cross_cutting/client_liaison_query_classification.system',
      variables: {
        query_text: 'Did we decide to use PostgreSQL or MySQL for the database?',
        available_capabilities: '(no capabilities)',
        janumicode_version_sha: 'test-probe',
      },
      expectedArtifactType: 'reasoning_review_output',
      structuralAssertions: (parsed) => {
        const errors: string[] = [];
        const validTypes = ['workflow_initiation', 'historical_lookup', 'consistency_challenge', 'forward_implication', 'rationale_request', 'ambient_clarification', 'status_check', 'artifact_request'];
        if (!validTypes.includes(parsed.query_type as string)) {
          errors.push(`Invalid query_type: ${parsed.query_type}`);
        }
        if (typeof parsed.confidence !== 'number') errors.push('Missing confidence');
        return errors;
      },
      judgeRubric: {
        name: 'Client Liaison classification of historical lookup',
        criteria: [
          'query_type is "historical_lookup"',
          'confidence is >= 0.6 (the query is unambiguously historical)',
          'Did not classify as consistency_challenge (no belief stated by user) or rationale_request (no "why" asked)',
        ],
        reasoningCriteria: [
          'The classifier recognized "Did we decide ..." as the historical-lookup pattern',
        ],
      },
    });

    logResult(result);
    expect(result.parsed).not.toBeNull();
    expect(result.structuralValid).toBe(true);
    expect(result.judgePassed).toBe(true);
  }, 600000);

  it('classifies consistency challenge query', async () => {
    const available = await checkOllama();
    if (!available) return;

    const result = await runProbe({
      name: 'client_liaison_classify_consistency',
      templateKey: 'cross_cutting/client_liaison_query_classification.system',
      variables: {
        query_text: 'I thought we decided to use REST APIs but I see GraphQL in the new component',
        available_capabilities: '(no capabilities)',
        janumicode_version_sha: 'test-probe',
      },
      expectedArtifactType: 'reasoning_review_output',
      structuralAssertions: (parsed) => {
        const errors: string[] = [];
        // Should detect this as consistency_challenge
        if (parsed.query_type !== 'consistency_challenge') {
          errors.push(`Expected consistency_challenge, got ${parsed.query_type}`);
        }
        return errors;
      },
      judgeRubric: {
        name: 'Client Liaison classification of consistency challenge',
        criteria: [
          'query_type is "consistency_challenge"',
          'confidence is >= 0.6',
          'Did not classify as ambient_clarification (the user IS challenging an apparent inconsistency)',
        ],
        reasoningCriteria: [
          'The classifier recognized "I thought ... but I see ..." as the consistency-challenge pattern',
          'The classifier recognized that the user is asserting a belief that conflicts with observed reality',
        ],
      },
    });

    logResult(result);
    expect(result.parsed).not.toBeNull();
    expect(result.structuralValid).toBe(true);
    expect(result.judgePassed).toBe(true);
  }, 600000);
});

describe('Probe: Client Liaison Response Synthesis', () => {
  it('synthesizes response with provenance citations', async () => {
    const available = await checkOllama();
    if (!available) return;

    const result = await runProbe({
      name: 'client_liaison_synthesis',
      templateKey: 'cross_cutting/client_liaison_synthesis.system',
      variables: {
        query_text: 'Why did we choose PostgreSQL?',
        query_type: 'rationale_request',
        relevant_records: `[rec-adr-003] (architectural_decision, phase 4, authority 6): Decision: Use PostgreSQL. Rationale: ACID compliance, JSON support, and team familiarity.
[rec-d-005] (decision_trace, phase 4, authority 5): Human selected PostgreSQL over MySQL due to better JSON column support.`,
        pending_decisions: '(none)',
        janumicode_version_sha: 'test-probe',
      },
      expectedArtifactType: 'reasoning_review_output',
      structuralAssertions: (parsed) => {
        const errors: string[] = [];
        if (typeof parsed.response_text !== 'string') errors.push('Missing response_text');
        if (!Array.isArray(parsed.provenance_record_ids)) errors.push('Missing provenance_record_ids');
        if (typeof parsed.inconsistency_found !== 'boolean') errors.push('Missing inconsistency_found');
        return errors;
      },
      judgeRubric: {
        name: 'Client Liaison response synthesis with provenance',
        criteria: [
          'response_text answers the "why PostgreSQL" question with the rationale from the records',
          'response_text cites at least one record id in [bracket] format',
          'provenance_record_ids contains rec-adr-003 and/or rec-d-005',
          'inconsistency_found is false (the records are consistent)',
          'No fabricated history or rationales not present in the records',
        ],
        reasoningCriteria: [
          'The agent surfaced ACID compliance, JSON support, and team familiarity from rec-adr-003',
          'The agent surfaced "better JSON column support" from rec-d-005',
          'The agent did NOT invent reasons not in the records',
        ],
      },
    });

    logResult(result);
    expect(result.parsed).not.toBeNull();
    expect(result.structuralValid).toBe(true);
    expect(result.judgePassed).toBe(true);
  }, 600000);
});
