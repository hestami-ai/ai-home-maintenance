/**
 * Prompt probe: Intent Quality Check (Sub-Phase 1.0)
 *
 * Sends the intent_quality_check prompt template to Ollama with a test
 * Raw Intent and validates the output against the intent_quality_report schema.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { runProbe, checkOllama } from './probeRunner';
import { logResult } from './probeHelpers';

describe('Probe: Intent Quality Check', () => {
  beforeAll(async () => {
    const available = await checkOllama();
    if (!available) {
      console.warn('Ollama not available — skipping probe tests');
      return;
    }
  });

  it('produces valid intent_quality_report for a well-formed intent', async () => {
    const available = await checkOllama();
    if (!available) return;

    const result = await runProbe({
      name: 'intent_quality_check_wellformed',
      templateKey: 'cross_cutting/intent_quality_check.system',
      variables: {
        raw_intent_text: 'Build a task management application for small software teams. It should allow creating tasks with priorities, assigning team members, tracking progress through kanban boards, and sending email notifications when tasks are overdue.',
        janumicode_version_sha: 'test-probe',
      },
      expectedArtifactType: 'intent_quality_report',
      structuralAssertions: (parsed) => {
        const errors: string[] = [];
        if (!Array.isArray(parsed.completeness_findings)) errors.push('Missing completeness_findings array');
        if (!Array.isArray(parsed.consistency_findings)) errors.push('Missing consistency_findings array');
        if (!Array.isArray(parsed.coherence_findings)) errors.push('Missing coherence_findings array');
        if (!parsed.overall_status) errors.push('Missing overall_status');
        if (!['pass', 'requires_input', 'blocking'].includes(parsed.overall_status as string)) {
          errors.push(`Invalid overall_status: ${parsed.overall_status}`);
        }
        // A well-formed intent should pass
        if (parsed.overall_status !== 'pass') {
          errors.push(`Expected 'pass' for well-formed intent, got '${parsed.overall_status}'`);
        }
        return errors;
      },
      judgeRubric: {
        name: 'Intent Quality Check for well-formed intent',
        criteria: [
          'overall_status is "pass" (intent is well-formed)',
          'All three required fields (what is being built, who it serves, what problem it solves) are marked present',
          'consistency_findings is empty (no contradictions in the intent)',
          'coherence_findings is empty (the intent forms a plausible product)',
          'No invented absent fields',
        ],
        reasoningCriteria: [
          'The reviewer recognized "task management application" as what is being built',
          'The reviewer recognized "small software teams" as who it serves',
          'The reviewer correctly inferred the problem (managing tasks) from the intent',
        ],
      },
    });

    logResult(result);
    expect(result.parsed).not.toBeNull();
    expect(result.structuralValid).toBe(true);
    expect(result.judgePassed).toBe(true);
  }, 600000);

  it('detects absent fields in an underspecified intent', async () => {
    const available = await checkOllama();
    if (!available) return;

    const result = await runProbe({
      name: 'intent_quality_check_underspecified',
      templateKey: 'cross_cutting/intent_quality_check.system',
      variables: {
        raw_intent_text: 'Make something with AI.',
        janumicode_version_sha: 'test-probe',
      },
      expectedArtifactType: 'intent_quality_report',
      structuralAssertions: (parsed) => {
        const errors: string[] = [];
        if (!Array.isArray(parsed.completeness_findings)) errors.push('Missing completeness_findings');
        // Underspecified intent should have absent fields
        const findings = parsed.completeness_findings as { status: string }[];
        const absentCount = findings.filter(f => f.status === 'absent').length;
        if (absentCount === 0) {
          errors.push('Expected at least one absent finding for underspecified intent');
        }
        // Should NOT be "pass"
        if (parsed.overall_status === 'pass') {
          errors.push('Underspecified intent should not produce "pass" status');
        }
        return errors;
      },
      judgeRubric: {
        name: 'Intent Quality Check for underspecified intent ("Make something with AI.")',
        criteria: [
          'overall_status is "requires_input" or "blocking" (NOT "pass")',
          'completeness_findings includes at least one absent field',
          'The "what is being built" field is recognized as absent (intent says only "something")',
          'The "who it serves" field is recognized as absent',
          'The "what problem it solves" field is recognized as absent',
          'system_proposal_offered_for is populated for the absent fields (per template instructions)',
        ],
        reasoningCriteria: [
          'The reviewer recognized "something" as too vague to count as a product description',
          'The reviewer did not invent fields the intent did not have',
        ],
      },
    });

    logResult(result);
    expect(result.parsed).not.toBeNull();
    expect(result.structuralValid).toBe(true);
    expect(result.judgePassed).toBe(true);
  }, 600000);
});
