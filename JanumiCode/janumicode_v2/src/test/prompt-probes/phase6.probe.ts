/**
 * Prompt probe: Phase 6 — Implementation Task Decomposition
 */

import { describe, it, expect } from 'vitest';
import { runProbe, checkOllama } from './probeRunner';
import { logResult } from './probeHelpers';

describe('Probe: Implementation Task Decomposition (6.1)', () => {
  it('produces implementation_plan with completion_criteria per task', async () => {
    const available = await checkOllama();
    if (!available) return;

    const result = await runProbe({
      name: 'phase_6_1_implementation_task_decomposition',
      agentRole: 'implementation_planner',
      subPhase: '06_1_implementation_task_decomposition',
      variables: {
        active_constraints: 'Use TypeScript and Node.js',
        component_model_summary: 'Components: AuthService (responsibility: handle authentication), TaskService (responsibility: manage tasks)',
        technical_specs_summary: 'AuthService: data model + REST API. TaskService: data model + REST API',
        detail_file_path: '/dev/null',
        janumicode_version_sha: 'test-probe',
      },
      expectedArtifactType: 'implementation_plan',
      structuralAssertions: (parsed) => {
        const errors: string[] = [];
        if (!Array.isArray(parsed.tasks)) {
          errors.push('Missing tasks array');
          return errors;
        }
        const tasks = parsed.tasks as Record<string, unknown>[];
        for (const t of tasks) {
          if (!t.id) errors.push('Task missing id');
          if (!t.component_id) errors.push('Task missing component_id');
          if (!t.component_responsibility) {
            errors.push('Task missing component_responsibility (Invariant IP-002)');
          }
          // Invariant IP-001: completion_criteria non-empty
          if (!Array.isArray(t.completion_criteria) || (t.completion_criteria as unknown[]).length === 0) {
            errors.push(`Task ${t.id}: missing completion_criteria (Invariant IP-001)`);
          }
        }
        return errors;
      },
      judgeRubric: {
        name: 'Implementation Task Decomposition for AuthService + TaskService',
        criteria: [
          'At least 4 tasks total (covering both AuthService and TaskService)',
          'Every task has the rule "one Component + one Component Responsibility"',
          'Every task carries component_responsibility VERBATIM from component_model (Invariant IP-002)',
          'Every task has at least one completion_criterion with mechanically verifiable wording (Invariant IP-001)',
          'completion_criteria use specific verification_method values (schema_check, invariant, output_comparison, test_execution)',
          'estimated_complexity is set on every task',
          'No circular task dependencies in dependency_task_ids',
        ],
        reasoningCriteria: [
          'The agent did NOT paraphrase or summarize component_responsibility — verbatim copy required',
          'The agent split tasks at component boundaries, not arbitrarily',
        ],
      },
    });

    logResult(result);
    expect(result.parsed).not.toBeNull();
    expect(result.structuralValid).toBe(true);
    expect(result.judgePassed).toBe(true);
  }, 600000);
});
