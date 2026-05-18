/**
 * Prompt probe: Phase 10 — Pre-Commit Consistency Check
 */

import { describe, it, expect } from 'vitest';
import { runProbe, checkOllama } from './probeRunner';
import { logResult } from './probeHelpers';

describe('Probe: Pre-Commit Consistency (10.1)', () => {
  it('produces consistency_report for final pre-commit check', async () => {
    const available = await checkOllama();
    if (!available) return;

    const result = await runProbe({
      name: 'phase_10_1_pre_commit_consistency',
      agentRole: 'consistency_checker',
      subPhase: '10_1_pre_commit_consistency',
      variables: {
        active_constraints: 'No constraints',
        all_phase_artifacts_summary: `Phase 1: intent_statement (TaskFlow)
Phase 2: 5 user stories, 3 NFRs
Phase 4: 3 components (AuthService, TaskService, NotificationService)
Phase 5: data models, API definitions
Phase 6: 12 implementation tasks
Phase 9: All tasks completed, all tests passing`,
        prior_decision_summary: 'No prior workflow runs (greenfield)',
        compliance_context_summary: 'No compliance regimes',
        janumicode_version_sha: 'test-probe',
      },
      expectedArtifactType: 'consistency_report',
      structuralAssertions: (parsed) => {
        const errors: string[] = [];
        if (typeof parsed.overall_pass !== 'boolean') errors.push('Missing overall_pass');
        return errors;
      },
      judgeRubric: {
        name: 'Pre-Commit Consistency Check for clean greenfield workflow',
        criteria: [
          'overall_pass is true (the workflow run is internally consistent)',
          'No invented inconsistencies — the input describes a clean workflow with all phases successful',
          'blocking_failures is empty',
          'No false-positive findings about the prior_decision_summary (this is greenfield)',
        ],
        reasoningCriteria: [
          'The reviewer recognized that "all tasks completed, all tests passing" indicates a successful run',
          'The reviewer did not invent traceability issues for a coherent set of artifacts',
          'The reviewer correctly handled the greenfield case (no prior decisions to check against)',
        ],
      },
    });

    logResult(result);
    expect(result.parsed).not.toBeNull();
    expect(result.structuralValid).toBe(true);
    expect(result.judgePassed).toBe(true);
  }, 600000);
});
