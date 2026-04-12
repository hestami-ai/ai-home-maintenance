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
      subPhase: '09_1_implementation_task_execution',
      variables: {
        active_constraints: 'Use TypeScript strict mode',
        implementation_task: '{"id": "task-001", "component_id": "auth_service", "description": "Implement JWT token generation"}',
        completion_criteria: '- JWT contains user_id\n- JWT signed with HS256\n- JWT expires in 24h',
        technical_spec_summary: 'AuthService data model includes User entity with id, email fields',
        governing_adr_ids: 'ADR-003 (use JWT for stateless auth)',
        compliance_context_summary: 'No compliance regimes',
        detail_file_path: '/dev/null',
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
