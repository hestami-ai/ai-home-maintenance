/**
 * Prompt probe: Phase 7 — Test Case Generation
 */

import { describe, it, expect } from 'vitest';
import { runProbe, checkOllama } from './probeRunner';
import { logResult } from './probeHelpers';

describe('Probe: Test Case Generation (7.1)', () => {
  it('produces test_plan with preconditions per test case', async () => {
    const available = await checkOllama();
    if (!available) return;

    const result = await runProbe({
      name: 'phase_7_1_test_case_generation',
      agentRole: 'test_design_agent',
      subPhase: '07_1_test_case_generation',
      variables: {
        active_constraints: 'Use Vitest framework',
        functional_requirements_summary: `US-001: Create task (AC-001: task appears in list within 1s)
US-002: Mark task complete (AC-002: status updates and timestamp recorded)`,
        implementation_plan_summary: '5 tasks across AuthService and TaskService',
        component_model_summary: 'Components: AuthService, TaskService',
        detail_file_path: '/dev/null',
        janumicode_version_sha: 'test-probe',
      },
      expectedArtifactType: 'test_plan',
      structuralAssertions: (parsed) => {
        const errors: string[] = [];
        if (!Array.isArray(parsed.test_suites)) {
          errors.push('Missing test_suites array');
          return errors;
        }
        const suites = parsed.test_suites as Record<string, unknown>[];
        for (const s of suites) {
          const testCases = (s.test_cases as Record<string, unknown>[]) ?? [];
          for (const tc of testCases) {
            // Invariant: every test case has at least one precondition
            if (!Array.isArray(tc.preconditions) || (tc.preconditions as unknown[]).length === 0) {
              errors.push(`Test case ${tc.test_case_id}: missing preconditions`);
            }
            if (!tc.expected_outcome) errors.push(`Test case ${tc.test_case_id}: missing expected_outcome`);
            if (!Array.isArray(tc.acceptance_criterion_ids)) {
              errors.push(`Test case ${tc.test_case_id}: missing acceptance_criterion_ids`);
            }
          }
        }
        return errors;
      },
      judgeRubric: {
        name: 'Test Case Generation for TaskFlow user stories',
        criteria: [
          'At least 2 test cases — one for AC-001 (task creation) and one for AC-002 (mark complete)',
          'Every test case has at least one precondition (Invariant)',
          'Every test case has acceptance_criterion_ids referencing AC-001 or AC-002',
          'Every test case has a measurable expected_outcome (matches the AC measurable_condition)',
          'Tests are categorized as unit, integration, or end_to_end',
          'Test cases for AC-001 verify the "within 1s" condition',
          'Test cases for AC-002 verify both status update AND timestamp recording',
        ],
        reasoningCriteria: [
          'The agent created tests for the SPECIFIC measurable conditions in the ACs, not generic functionality tests',
          'The agent did not invent ACs not in the input',
        ],
      },
    });

    logResult(result);
    expect(result.parsed).not.toBeNull();
    expect(result.structuralValid).toBe(true);
    expect(result.judgePassed).toBe(true);
  }, 600000);
});
