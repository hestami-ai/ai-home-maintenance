import { describe, it, expect } from 'vitest';
import { runContractSuite } from './runner';
import { phase1IntentQualityCheckContract, type IntentQualityCheckArtifact } from './phase1-intent-quality-check.contract';
import ideal from './fixtures/phase1-intent-quality-check.ideal.json' assert { type: 'json' };

describe('Phase 1.0a intent_quality_check contract — forward', () => {
  it('ideal fixture passes', () => {
    const results = runContractSuite(
      phase1IntentQualityCheckContract,
      ideal as unknown as IntentQualityCheckArtifact,
      { workflowRunId: 'fwd', relatedArtifacts: new Map() },
    );
    const failures = results.filter((r) => !r.passed);
    if (failures.length) console.error(failures.map((f) => `${f.clauseId}: ${f.message}`).join('\n'));
    expect(failures).toEqual([]);
  });

  it('accepts populated consistency + coherence findings with their proper schemas', () => {
    // Per Phase 1.0a prompt: each finding array has a DIFFERENT shape.
    // This test exercises C-1.0a.4 (consistency: elements_in_conflict)
    // and C-1.0a.5 (coherence: concern) positively.
    const good: IntentQualityCheckArtifact = {
      kind: 'intent_quality_check',
      overall_status: 'pass',
      completeness_findings: [
        { field: 'what_is_being_built', status: 'present', severity: 'high', explanation: 'stated' },
        { field: 'who_it_serves', status: 'present', severity: 'high', explanation: 'stated' },
        { field: 'what_problem_it_solves', status: 'present', severity: 'high', explanation: 'stated' },
      ],
      consistency_findings: [
        {
          elements_in_conflict: ['Spec says single tenant', 'Spec says multi-tenant'],
          explanation: 'Single-tenancy vs multi-tenancy is unresolved.',
          severity: 'warning',
        },
      ],
      coherence_findings: [
        {
          concern: 'Scope boundary between user-facing and admin tooling is undefined.',
          explanation: 'Admin operations are implied but not named.',
          severity: 'warning',
        },
      ],
    };
    const results = runContractSuite(phase1IntentQualityCheckContract, good, { workflowRunId: 'fwd', relatedArtifacts: new Map() });
    const blocking = results.filter((r) => !r.passed && r.severity === 'blocking');
    expect(blocking).toEqual([]);
  });

  it('breaks C-1.0a.2 when completeness_findings does not cover all three required fields', () => {
    const broken: IntentQualityCheckArtifact = {
      kind: 'intent_quality_check',
      overall_status: 'pass',
      completeness_findings: [
        { field: 'what_is_being_built', status: 'present', severity: 'high', explanation: 'ok' },
      ],
    };
    const results = runContractSuite(phase1IntentQualityCheckContract, broken, { workflowRunId: 'neg', relatedArtifacts: new Map() });
    const f = results.find((r) => r.clauseId === 'C-1.0a.2');
    expect(f?.passed).toBe(false);
  });

  it('breaks C-1.0a.4 when a consistency finding lacks elements_in_conflict', () => {
    const broken: IntentQualityCheckArtifact = {
      kind: 'intent_quality_check',
      overall_status: 'pass',
      completeness_findings: [
        { field: 'what_is_being_built', status: 'present', severity: 'high', explanation: 'ok' },
        { field: 'who_it_serves', status: 'present', severity: 'high', explanation: 'ok' },
        { field: 'what_problem_it_solves', status: 'present', severity: 'high', explanation: 'ok' },
      ],
      consistency_findings: [
        { elements_in_conflict: ['only one element'], explanation: 'x', severity: 'low' },
      ],
    };
    const results = runContractSuite(phase1IntentQualityCheckContract, broken, { workflowRunId: 'neg', relatedArtifacts: new Map() });
    const f = results.find((r) => r.clauseId === 'C-1.0a.4');
    expect(f?.passed).toBe(false);
  });

  it('breaks C-1.0a.5 when a coherence finding lacks concern', () => {
    const broken: IntentQualityCheckArtifact = {
      kind: 'intent_quality_check',
      overall_status: 'pass',
      completeness_findings: [
        { field: 'what_is_being_built', status: 'present', severity: 'high', explanation: 'ok' },
        { field: 'who_it_serves', status: 'present', severity: 'high', explanation: 'ok' },
        { field: 'what_problem_it_solves', status: 'present', severity: 'high', explanation: 'ok' },
      ],
      coherence_findings: [
        { concern: '', explanation: 'x', severity: 'warning' },
      ],
    };
    const results = runContractSuite(phase1IntentQualityCheckContract, broken, { workflowRunId: 'neg', relatedArtifacts: new Map() });
    const f = results.find((r) => r.clauseId === 'C-1.0a.5');
    expect(f?.passed).toBe(false);
  });
});
