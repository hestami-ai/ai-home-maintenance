/**
 * Prompt probe: Eval Execution (cross-cutting)
 *
 * The Eval Execution Agent runs evaluation tooling. The prompt is sent to
 * a CLI agent (Claude Code CLI in production). For Ollama testing, we
 * verify the template renders correctly.
 */

import { describe, it, expect } from 'vitest';
import { runProbe, checkOllama } from './probeRunner';
import { logResult } from './probeHelpers';

describe('Probe: Eval Execution', () => {
  it('renders eval execution prompt with all required variables', async () => {
    const available = await checkOllama();
    if (!available) return;

    const result = await runProbe({
      name: 'eval_execution_render',
      templateKey: 'cross_cutting/eval_execution.system',
      variables: {
        tool_command: 'eslint src/**/*.ts',
        criterion_id: 'NFR-001-eval',
        measurement_method: 'Run ESLint with project config and count errors',
        threshold: 'Zero ESLint errors',
        janumicode_version_sha: 'test-probe',
      },
      expectedArtifactType: 'reasoning_review_output',
      structuralAssertions: () => {
        // The eval execution prompt is for a CLI agent — Ollama returns
        // free-text. Only verify the prompt rendered and we got a response.
        return [];
      },
    });

    logResult(result);
    expect(result.response).not.toBeNull();
  }, 300000);
});
