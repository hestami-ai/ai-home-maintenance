/**
 * Prompt probes: Deep Memory Research (query_decomposition + context_packet_synthesis)
 */

import { describe, it, expect } from 'vitest';
import { runProbe, checkOllama } from './probeRunner';
import { logResult } from './probeHelpers';

describe('Probe: Deep Memory Query Decomposition', () => {
  it('decomposes a research query into structured retrieval targets', async () => {
    const available = await checkOllama();
    if (!available) return;

    const result = await runProbe({
      name: 'deep_memory_query_decomposition',
      templateKey: 'cross_cutting/deep_memory_query_decomposition.system',
      variables: {
        retrieval_brief_query: 'What architectural decisions were made about authentication and session management?',
        scope_tier: 'all_runs',
        requesting_agent_role: 'architecture_agent',
        janumicode_version_sha: 'test-probe',
      },
      expectedArtifactType: 'reasoning_review_output',
      structuralAssertions: (parsed) => {
        const errors: string[] = [];
        if (!Array.isArray(parsed.topic_entities)) errors.push('Missing topic_entities array');
        if (!Array.isArray(parsed.decision_types_sought)) errors.push('Missing decision_types_sought');
        if (!Array.isArray(parsed.authority_levels_included)) errors.push('Missing authority_levels_included');
        return errors;
      },
      judgeRubric: {
        name: 'Deep Memory Query Decomposition for auth/session query',
        criteria: [
          'topic_entities includes "authentication" and "session" (or similar exact entities)',
          'decision_types_sought includes architectural decision types (decision_trace, mirror_approval, phase_gate_approval, or similar)',
          'authority_levels_included contains 5 or higher (Human-Approved+) for authoritative decisions',
          'sources_in_scope reflects the all_runs scope tier (not just current_run)',
          'No invented entities not in the query',
        ],
        reasoningCriteria: [
          'The decomposition recognizes "authentication" and "session management" as the key topics',
          'The decomposition does not over-broaden the search to unrelated topics',
        ],
      },
    });

    logResult(result);
    expect(result.parsed).not.toBeNull();
    expect(result.structuralValid).toBe(true);
    expect(result.judgePassed).toBe(true);
  }, 600000);
});

describe('Probe: Deep Memory Context Packet Synthesis', () => {
  it('synthesizes findings into a context packet with citations', async () => {
    const available = await checkOllama();
    if (!available) return;

    const result = await runProbe({
      name: 'deep_memory_synthesis',
      templateKey: 'cross_cutting/deep_memory_context_packet_synthesis.system',
      variables: {
        query_decomposition: '{"topic_entities": ["authentication", "session"], "authority_levels_included": [5, 6]}',
        material_findings: `[rec-001] (authority 6): ADR-003 — JWT for stateless auth
[rec-002] (authority 6): ADR-005 — Redis for session storage
[rec-003] (authority 5): Decision trace — chose 24-hour session timeout`,
        supersession_chains: '[]',
        contradictions: '[]',
        coverage_assessment: '{"sources_queried": ["governed_stream_all_runs"], "confidence": 0.95}',
        janumicode_version_sha: 'test-probe',
      },
      expectedArtifactType: 'reasoning_review_output',
      structuralAssertions: (parsed) => {
        const errors: string[] = [];
        if (typeof parsed.decision_context_summary !== 'string') errors.push('Missing decision_context_summary');
        if (!Array.isArray(parsed.active_constraints)) errors.push('Missing active_constraints');
        if (!parsed.completeness_status) errors.push('Missing completeness_status');
        return errors;
      },
      judgeRubric: {
        name: 'Deep Memory Context Packet Synthesis',
        criteria: [
          'decision_context_summary mentions JWT, Redis, and 24-hour session timeout',
          'Every claim in decision_context_summary cites a source_record_id (rec-001, rec-002, or rec-003)',
          'active_constraints contains the authority-6 records (rec-001 ADR-003 and rec-002 ADR-005)',
          'active_constraints does NOT contain the authority-5 record (rec-003) — that is below the constraint threshold',
          'completeness_status is "complete" (no unavailable sources, no contradictions)',
          'No invented findings not present in the input material_findings',
        ],
        reasoningCriteria: [
          'The synthesizer correctly distinguished Authority Level 6+ as constraints vs Level 5 as decisions',
          'The synthesizer did not invent supersession or contradictions when none were provided',
        ],
      },
    });

    logResult(result);
    expect(result.parsed).not.toBeNull();
    expect(result.structuralValid).toBe(true);
    expect(result.judgePassed).toBe(true);
  }, 600000);
});
