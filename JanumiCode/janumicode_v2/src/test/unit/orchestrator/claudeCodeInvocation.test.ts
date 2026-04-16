/**
 * Regression tests for Claude Code CLI wiring.
 *
 * Pin three properties that together unlock Phase 9 actually running
 * a coding agent instead of failing immediately with
 * "No output parser registered for backing tool: claude_code_cli":
 *
 *   1. OrchestratorEngine registers the Claude Code parser on
 *      construction (checked via dry-run invocation — if the parser
 *      were absent, invoke would return the registration error).
 *   2. buildCLICommand for `claude_code_cli` uses stdin-only prompt
 *      (empty `-p` arg), `--verbose`, and `--permission-mode acceptEdits`
 *      by default so writes land without a human in the loop.
 *   3. `JANUMICODE_CLAUDE_SKIP_PERMISSIONS=1` upgrades to
 *      `--dangerously-skip-permissions` for fully unattended runs.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'node:path';
import { createTestDatabase, type Database } from '../../../lib/database/init';
import { ConfigManager } from '../../../lib/config/configManager';
import { OrchestratorEngine } from '../../../lib/orchestrator/orchestratorEngine';

describe('Claude Code CLI invocation wiring', () => {
  let db: Database;
  let engine: OrchestratorEngine;
  const prevSkip = process.env.JANUMICODE_CLAUDE_SKIP_PERMISSIONS;
  const prevModel = process.env.JANUMICODE_CLAUDE_MODEL;

  beforeEach(() => {
    delete process.env.JANUMICODE_CLAUDE_SKIP_PERMISSIONS;
    delete process.env.JANUMICODE_CLAUDE_MODEL;
    db = createTestDatabase();
    const configManager = new ConfigManager();
    const workspacePath = path.resolve(__dirname, '..', '..', '..', '..');
    engine = new OrchestratorEngine(db, configManager, workspacePath);
  });

  afterEach(() => {
    db.close();
    if (prevSkip === undefined) delete process.env.JANUMICODE_CLAUDE_SKIP_PERMISSIONS;
    else process.env.JANUMICODE_CLAUDE_SKIP_PERMISSIONS = prevSkip;
    if (prevModel === undefined) delete process.env.JANUMICODE_CLAUDE_MODEL;
    else process.env.JANUMICODE_CLAUDE_MODEL = prevModel;
  });

  it('registers a parser for claude_code_cli at construction (no "parser not registered" error)', async () => {
    // Monkey-patch cliInvoker.invoke so we never spawn a real child.
    // The test only cares whether the pre-flight parser lookup passed.
    const cliInvokerSpy = vi.fn().mockResolvedValue({
      exitCode: 0, timedOut: false, idledOut: false,
      events: [], stderr: '', durationMs: 1,
    });
    // The agentInvoker owns its own cliInvoker instance — replace it.
    (engine.agentInvoker as unknown as { cliInvoker: { invoke: unknown } })
      .cliInvoker.invoke = cliInvokerSpy;

    const result = await engine.agentInvoker.invoke({
      agentRole: 'executor_agent',
      backingTool: 'claude_code_cli',
      invocationId: 'inv-1',
      prompt: 'build a todo app',
      cwd: '/tmp/ws',
    });

    // Pre-engine-fix, this would have returned
    // `{ success: false, error: 'No output parser registered …' }`.
    // Now it should reach the cliInvoker and return success from the stub.
    expect(result.success).toBe(true);
    expect(result.error).toBeFalsy();
    expect(cliInvokerSpy).toHaveBeenCalledTimes(1);
  });

  it('builds the default command with empty -p, acceptEdits, verbose, and --add-dir cwd', async () => {
    const cliInvokerSpy = vi.fn().mockResolvedValue({
      exitCode: 0, timedOut: false, idledOut: false,
      events: [], stderr: '', durationMs: 1,
    });
    (engine.agentInvoker as unknown as { cliInvoker: { invoke: unknown } })
      .cliInvoker.invoke = cliInvokerSpy;

    await engine.agentInvoker.invoke({
      agentRole: 'executor_agent',
      backingTool: 'claude_code_cli',
      invocationId: 'inv-2',
      prompt: 'task prompt',
      cwd: '/tmp/ws',
    });

    const spawnOpts = cliInvokerSpy.mock.calls[0][0] as {
      command: string;
      args: string[];
      stdinContent: string;
    };
    expect(spawnOpts.command).toBe('claude');
    // -p with empty string → non-interactive mode, prompt via stdin.
    expect(spawnOpts.args).toContain('-p');
    expect(spawnOpts.args.indexOf('-p')).toBeGreaterThanOrEqual(0);
    expect(spawnOpts.args[spawnOpts.args.indexOf('-p') + 1]).toBe('');

    expect(spawnOpts.args).toContain('--output-format');
    expect(spawnOpts.args).toContain('stream-json');
    expect(spawnOpts.args).toContain('--verbose');
    expect(spawnOpts.args).toContain('--permission-mode');
    expect(spawnOpts.args).toContain('acceptEdits');
    expect(spawnOpts.args).toContain('--add-dir');
    expect(spawnOpts.args[spawnOpts.args.indexOf('--add-dir') + 1]).toBe('/tmp/ws');

    // Prompt flows via stdin — not embedded in args where long prompts
    // would hit the OS argv length cap.
    expect(spawnOpts.stdinContent).toBe('task prompt');
  });

  it('swaps to --dangerously-skip-permissions when env flag is set', async () => {
    process.env.JANUMICODE_CLAUDE_SKIP_PERMISSIONS = '1';

    const cliInvokerSpy = vi.fn().mockResolvedValue({
      exitCode: 0, timedOut: false, idledOut: false,
      events: [], stderr: '', durationMs: 1,
    });
    (engine.agentInvoker as unknown as { cliInvoker: { invoke: unknown } })
      .cliInvoker.invoke = cliInvokerSpy;

    await engine.agentInvoker.invoke({
      agentRole: 'executor_agent',
      backingTool: 'claude_code_cli',
      invocationId: 'inv-3',
      prompt: 'p',
      cwd: '/tmp/ws',
    });

    const args = (cliInvokerSpy.mock.calls[0][0] as { args: string[] }).args;
    expect(args).toContain('--dangerously-skip-permissions');
    // Must not ALSO carry acceptEdits — the env toggle is an either/or.
    expect(args).not.toContain('acceptEdits');
  });

  it('pins the Claude model when JANUMICODE_CLAUDE_MODEL is set', async () => {
    process.env.JANUMICODE_CLAUDE_MODEL = 'claude-sonnet-4-6';

    const cliInvokerSpy = vi.fn().mockResolvedValue({
      exitCode: 0, timedOut: false, idledOut: false,
      events: [], stderr: '', durationMs: 1,
    });
    (engine.agentInvoker as unknown as { cliInvoker: { invoke: unknown } })
      .cliInvoker.invoke = cliInvokerSpy;

    await engine.agentInvoker.invoke({
      agentRole: 'executor_agent',
      backingTool: 'claude_code_cli',
      invocationId: 'inv-4',
      prompt: 'p',
      cwd: '/tmp/ws',
    });

    const args = (cliInvokerSpy.mock.calls[0][0] as { args: string[] }).args;
    expect(args).toContain('--model');
    expect(args[args.indexOf('--model') + 1]).toBe('claude-sonnet-4-6');
  });
});
