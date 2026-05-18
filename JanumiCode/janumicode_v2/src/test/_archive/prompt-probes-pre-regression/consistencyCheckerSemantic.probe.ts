/**
 * Prompt probe: Consistency Checker Semantic Analysis (cross-cutting)
 */

import { describe, it, expect } from 'vitest';
import { runProbe, checkOllama } from './probeRunner';
import { logResult } from './probeHelpers';

describe('Probe: Consistency Checker Semantic', () => {
  it('detects no inconsistency in compatible artifacts', async () => {
    const available = await checkOllama();
    if (!available) return;

    const result = await runProbe({
      name: 'consistency_semantic_compatible',
      templateKey: 'cross_cutting/consistency_checker_semantic.system',
      variables: {
        artifact_summaries: `[functional_requirements] (id: fr-001):
{"user_stories": [{"id": "US-1", "role": "user", "action": "log in", "outcome": "access account"}]}

---

[system_requirements] (id: sr-001):
{"items": [{"id": "SR-001", "statement": "System must support user authentication", "source_requirement_ids": ["US-1"]}]}`,
        janumicode_version_sha: 'test-probe',
      },
      expectedArtifactType: 'reasoning_review_output',
      structuralAssertions: (parsed) => {
        const errors: string[] = [];
        if (!Array.isArray(parsed.findings)) errors.push('Missing findings array');
        return errors;
      },
      judgeRubric: {
        name: 'Consistency check on compatible FR + SR',
        criteria: [
          'findings array is empty (no inconsistency)',
          'No false positives — the SR explicitly references the FR',
          'No invented inconsistencies for compatible artifacts',
        ],
        reasoningCriteria: [
          'The reviewer recognized that source_requirement_ids: ["US-1"] establishes a valid traceability link',
          'The reviewer did not flag the artifacts as inconsistent when they are clearly aligned',
        ],
      },
    });

    logResult(result);
    expect(result.parsed).not.toBeNull();
    expect(result.structuralValid).toBe(true);
    expect(result.judgePassed).toBe(true);
  }, 600000);

  it('detects inconsistency between contradictory artifacts', async () => {
    const available = await checkOllama();
    if (!available) return;

    const result = await runProbe({
      name: 'consistency_semantic_contradictory',
      templateKey: 'cross_cutting/consistency_checker_semantic.system',
      variables: {
        artifact_summaries: `[architectural_decisions] (id: adr-001):
{"adrs": [{"id": "ADR-1", "decision": "Use microservices architecture with separate databases per service"}]}

---

[component_model] (id: cm-001):
{"components": [{"id": "shared_db", "name": "SharedDatabase", "responsibilities": [{"statement": "Single shared database for all services"}]}]}`,
        janumicode_version_sha: 'test-probe',
      },
      expectedArtifactType: 'reasoning_review_output',
      structuralAssertions: (parsed) => {
        const errors: string[] = [];
        if (!Array.isArray(parsed.findings)) errors.push('Missing findings array');
        // Should detect inconsistency
        const findings = parsed.findings as unknown[];
        if (findings.length === 0) {
          errors.push('Expected findings for clearly contradictory artifacts (microservices vs shared DB)');
        }
        return errors;
      },
      judgeRubric: {
        name: 'Consistency check on contradictory ADR + component model',
        criteria: [
          'findings array contains at least one entry',
          'At least one finding identifies the contradiction between ADR-1 (microservices, separate DBs) and the SharedDatabase component',
          'The finding cites both artifact_ids (adr-001 and cm-001)',
          'severity is set on every finding',
        ],
        reasoningCriteria: [
          'The reviewer noticed that "separate databases per service" directly contradicts "Single shared database for all services"',
          'The reviewer did not require the contradiction to be stated more explicitly to flag it',
        ],
      },
    });

    logResult(result);
    expect(result.parsed).not.toBeNull();
    expect(result.structuralValid).toBe(true);
    expect(result.judgePassed).toBe(true);
  }, 600000);
});
