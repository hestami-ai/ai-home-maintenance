/**
 * Prompt probe: Phase 9 — Implementation Task Execution
 *
 * Note: this probe tests the prompt template structure only.
 * Actual code generation happens via Claude Code CLI in production,
 * not via Ollama. Ollama will produce text but probably not runnable code.
 */

import { describe, it, expect } from 'vitest';
import { runProbe, checkOllama } from './probeRunner';
import { logResult } from './probeHelpers';

describe('Probe: Implementation Task Execution (9.1)', () => {
  it('renders the executor agent prompt template successfully', async () => {
    const available = await checkOllama();
    if (!available) return;

    const result = await runProbe({
      name: 'phase_9_1_implementation_task_execution',
      agentRole: 'executor_agent',
      subPhase: 'implementation_task_execution',
      variables: {
        active_constraints: 'Use TypeScript strict mode',
        implementation_task: 'task-001 — Implement JWT token generation',
        component_context: 'Name: auth_service\nResponsibility: Issues and validates JWT tokens',
        component_model_summary: 'AuthService owns identity and token lifecycle.',
        completion_criteria: '1. [cc-1] JWT contains user_id\n   Verification: test_execution',
        write_scope_constraints: 'Files may ONLY be created/modified in:\n- src/auth/',
        governing_adrs: '### ADR-003: Use JWT for stateless auth\nDecision: HS256 signing',
        task_specific_test_cases: '### Test Suite: ts-1\nType: unit\n- [tc-1] (unit) Verify token contains user_id',
        task_specific_eval_criteria: 'RELEVANCE FILTER NOTE: kept 1 of 1 eval criteria; filtered 0.\n\n### Functional Criteria\n- [FR-001] llm_judge: token validated',
        dependency_tasks_summary: '(no dependency tasks)',
        upstream_validator_findings: '(no HIGH/MEDIUM upstream validator findings against motivating artifacts)',
        refactoring_constraints: '(not applicable — standard implementation task)',
        detail_file_path: '/dev/null',
        detail_file_content: '# detail\n(no DMR for probe)',
        janumicode_version_sha: 'test-probe',
      },
      expectedArtifactType: 'reasoning_review_output',
      structuralAssertions: () => {
        // Executor agent produces code, not JSON — only verify the prompt rendered
        // and the model returned something
        return [];
      },
    });

    logResult(result);
    // Just verify the call succeeded — actual code production is handled by Claude Code CLI
    expect(result.response).not.toBeNull();
  }, 300000);
});
