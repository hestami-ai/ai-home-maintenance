/**
 * Regression tests for the claude_code_cli permission-mode resolution.
 *
 * Background:
 *   The default `--permission-mode acceptEdits` auto-approves
 *   Edit/Write/Patch but BLOCKS Bash. cal-22b's Phase 9 executor
 *   wrote 4 files, then tried `node --test` to verify its own work,
 *   the sandbox blocked it, and the agent claimed success without
 *   proof. ReasoningReview correctly flagged this as
 *   `completeness_shortcut`.
 *
 *   The fix layers permission-mode resolution:
 *     1. Per-invocation `unattendedSkipPermissions: true` (set by
 *        Phase 9 executor in calibration mode)
 *     2. Process-wide `JANUMICODE_CLAUDE_SKIP_PERMISSIONS=1` env var
 *        (kept for backward compat)
 *     3. Default — `acceptEdits` (production CLI / VS Code; surfaces
 *        Bash requests to the human as designed)
 *
 * If a future regression flips the default to skip-permissions
 * globally (silently bypassing the human-in-the-loop contract for
 * production callers) this test catches it.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AgentInvoker } from '../../../lib/orchestrator/agentInvoker';
import { LLMCaller } from '../../../lib/llm/llmCaller';

interface CliCommand { command: string; args: string[] }

function buildCLICommand(invoker: AgentInvoker, options: Record<string, unknown>): CliCommand {
  // buildCLICommand is private; cast through `unknown` to access it
  // without polluting the public surface. This is the same pattern the
  // existing test files use to verify CLI argument construction.
  return (invoker as unknown as { buildCLICommand: (o: unknown) => CliCommand })
    .buildCLICommand(options);
}

describe('AgentInvoker — claude_code_cli permission mode', () => {
  let invoker: AgentInvoker;
  let prevEnv: string | undefined;

  beforeEach(() => {
    invoker = new AgentInvoker(new LLMCaller({ maxRetries: 0 }), {
      timeoutSeconds: 1, idleTimeoutSeconds: 1, bufferMaxEvents: 100,
    });
    prevEnv = process.env.JANUMICODE_CLAUDE_SKIP_PERMISSIONS;
    delete process.env.JANUMICODE_CLAUDE_SKIP_PERMISSIONS;
  });

  afterEach(() => {
    if (prevEnv !== undefined) process.env.JANUMICODE_CLAUDE_SKIP_PERMISSIONS = prevEnv;
    else delete process.env.JANUMICODE_CLAUDE_SKIP_PERMISSIONS;
  });

  it('default (no flag, no env) uses acceptEdits — protects production human-in-the-loop', () => {
    const { args } = buildCLICommand(invoker, {
      backingTool: 'claude_code_cli', cwd: '/tmp/x', prompt: '', invocationId: 'inv-1',
    });
    expect(args).toContain('--permission-mode');
    expect(args).toContain('acceptEdits');
    expect(args).not.toContain('--dangerously-skip-permissions');
  });

  it('per-invocation unattendedSkipPermissions=true upgrades to dangerously-skip-permissions', () => {
    // The new policy. Calibration / unattended runs flip this on
    // per-invocation rather than via the process-wide env var.
    const { args } = buildCLICommand(invoker, {
      backingTool: 'claude_code_cli', cwd: '/tmp/x', prompt: '', invocationId: 'inv-1',
      unattendedSkipPermissions: true,
    });
    expect(args).toContain('--dangerously-skip-permissions');
    expect(args).not.toContain('--permission-mode');
  });

  it('JANUMICODE_CLAUDE_SKIP_PERMISSIONS=1 still works (backward compat)', () => {
    process.env.JANUMICODE_CLAUDE_SKIP_PERMISSIONS = '1';
    const { args } = buildCLICommand(invoker, {
      backingTool: 'claude_code_cli', cwd: '/tmp/x', prompt: '', invocationId: 'inv-1',
    });
    expect(args).toContain('--dangerously-skip-permissions');
  });

  it('per-invocation unattendedSkipPermissions=false keeps acceptEdits even with env var unset', () => {
    // Explicit false is explicit — not "fall through to env var".
    // Production callers that genuinely want acceptEdits stay safe.
    const { args } = buildCLICommand(invoker, {
      backingTool: 'claude_code_cli', cwd: '/tmp/x', prompt: '', invocationId: 'inv-1',
      unattendedSkipPermissions: false,
    });
    expect(args).toContain('--permission-mode');
    expect(args).toContain('acceptEdits');
  });

  it('env var presence overrides default-when-no-explicit-option', () => {
    // No explicit unattendedSkipPermissions option, env var set →
    // upgrades. This is the existing JANUMICODE_CLAUDE_SKIP_PERMISSIONS
    // contract; preserved.
    process.env.JANUMICODE_CLAUDE_SKIP_PERMISSIONS = '1';
    const { args } = buildCLICommand(invoker, {
      backingTool: 'claude_code_cli', cwd: '/tmp/x', prompt: '', invocationId: 'inv-1',
    });
    expect(args).toContain('--dangerously-skip-permissions');
  });
});
