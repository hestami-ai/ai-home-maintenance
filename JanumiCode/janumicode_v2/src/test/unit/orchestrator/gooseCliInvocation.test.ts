/**
 * Regression tests for Goose CLI wiring.
 *
 * Pins the three properties that together unlock Phase 9 actually
 * running Goose instead of failing with
 * "No output parser registered for backing tool: goose_cli":
 *
 *   1. `registerBuiltinCLIParsers()` installs the Goose parser
 *      alongside the Claude Code one.
 *   2. `buildCLICommand('goose_cli')` spawns `goose run` with
 *      stdin-only prompt (`-i -`), `--no-session`, `--quiet`,
 *      `--output-format stream-json`, and `--with-builtin developer`
 *      by default.
 *   3. Env-var knobs (`JANUMICODE_GOOSE_PROVIDER`,
 *      `JANUMICODE_GOOSE_MODEL`, `JANUMICODE_GOOSE_MAX_TURNS`) thread
 *      through to the spawn args; per-invocation `options.model`
 *      wins over the env default.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'node:path';
import { createTestDatabase, type Database } from '../../../lib/database/init';
import { ConfigManager } from '../../../lib/config/configManager';
import { OrchestratorEngine } from '../../../lib/orchestrator/orchestratorEngine';

describe('Goose CLI invocation wiring', () => {
  let db: Database;
  let engine: OrchestratorEngine;
  const prevProvider = process.env.JANUMICODE_GOOSE_PROVIDER;
  const prevModel = process.env.JANUMICODE_GOOSE_MODEL;
  const prevMaxTurns = process.env.JANUMICODE_GOOSE_MAX_TURNS;
  const prevExtra = process.env.JANUMICODE_GOOSE_EXTRA_ARGS;

  beforeEach(() => {
    delete process.env.JANUMICODE_GOOSE_PROVIDER;
    delete process.env.JANUMICODE_GOOSE_MODEL;
    delete process.env.JANUMICODE_GOOSE_MAX_TURNS;
    delete process.env.JANUMICODE_GOOSE_EXTRA_ARGS;
    db = createTestDatabase();
    const configManager = new ConfigManager();
    const workspacePath = path.resolve(__dirname, '..', '..', '..', '..');
    engine = new OrchestratorEngine(db, configManager, workspacePath);
    engine.registerBuiltinCLIParsers();
  });

  afterEach(() => {
    db.close();
    if (prevProvider === undefined) delete process.env.JANUMICODE_GOOSE_PROVIDER;
    else process.env.JANUMICODE_GOOSE_PROVIDER = prevProvider;
    if (prevModel === undefined) delete process.env.JANUMICODE_GOOSE_MODEL;
    else process.env.JANUMICODE_GOOSE_MODEL = prevModel;
    if (prevMaxTurns === undefined) delete process.env.JANUMICODE_GOOSE_MAX_TURNS;
    else process.env.JANUMICODE_GOOSE_MAX_TURNS = prevMaxTurns;
    if (prevExtra === undefined) delete process.env.JANUMICODE_GOOSE_EXTRA_ARGS;
    else process.env.JANUMICODE_GOOSE_EXTRA_ARGS = prevExtra;
  });

  function stubCli(): ReturnType<typeof vi.fn> {
    const spy = vi.fn().mockResolvedValue({
      exitCode: 0, timedOut: false, idledOut: false,
      events: [], stderr: '', durationMs: 1,
    });
    (engine.agentInvoker as unknown as { cliInvoker: { invoke: unknown } })
      .cliInvoker.invoke = spy;
    return spy;
  }

  it('registers a parser for goose_cli (no "parser not registered" error)', async () => {
    const spy = stubCli();
    const result = await engine.agentInvoker.invoke({
      agentRole: 'executor_agent',
      backingTool: 'goose_cli',
      invocationId: 'inv-1',
      prompt: 'build a todo app',
      cwd: '/tmp/ws',
    });
    expect(result.success).toBe(true);
    expect(result.error).toBeFalsy();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('builds the default command with `goose run -i - --no-session --output-format stream-json --quiet --with-builtin developer`', async () => {
    const spy = stubCli();
    await engine.agentInvoker.invoke({
      agentRole: 'executor_agent',
      backingTool: 'goose_cli',
      invocationId: 'inv-2',
      prompt: 'task prompt',
      cwd: '/tmp/ws',
    });
    const spawnOpts = spy.mock.calls[0][0] as {
      command: string;
      args: string[];
      stdinContent: string;
    };
    expect(spawnOpts.command).toBe('goose');
    expect(spawnOpts.args[0]).toBe('run');
    // `-i -` ⇒ read instructions from stdin; prompt MUST be on stdin.
    expect(spawnOpts.args).toContain('-i');
    expect(spawnOpts.args[spawnOpts.args.indexOf('-i') + 1]).toBe('-');
    expect(spawnOpts.args).toContain('--no-session');
    expect(spawnOpts.args).toContain('--quiet');
    expect(spawnOpts.args).toContain('--output-format');
    expect(spawnOpts.args).toContain('stream-json');
    expect(spawnOpts.args).toContain('--with-builtin');
    expect(spawnOpts.args[spawnOpts.args.indexOf('--with-builtin') + 1]).toBe('developer');
    // Prompt flows via stdin, not args.
    expect(spawnOpts.stdinContent).toBe('task prompt');
    // No provider/model/max-turns flags unless env-configured.
    expect(spawnOpts.args).not.toContain('--provider');
    expect(spawnOpts.args).not.toContain('--model');
    expect(spawnOpts.args).not.toContain('--max-turns');
  });

  it('threads JANUMICODE_GOOSE_PROVIDER / _MODEL / _MAX_TURNS through to the spawn args', async () => {
    process.env.JANUMICODE_GOOSE_PROVIDER = 'ollama';
    process.env.JANUMICODE_GOOSE_MODEL = 'qwen3.5:9b';
    process.env.JANUMICODE_GOOSE_MAX_TURNS = '25';

    const spy = stubCli();
    await engine.agentInvoker.invoke({
      agentRole: 'executor_agent',
      backingTool: 'goose_cli',
      invocationId: 'inv-3',
      prompt: 'p',
      cwd: '/tmp/ws',
    });
    const args = (spy.mock.calls[0][0] as { args: string[] }).args;
    expect(args).toContain('--provider');
    expect(args[args.indexOf('--provider') + 1]).toBe('ollama');
    expect(args).toContain('--model');
    expect(args[args.indexOf('--model') + 1]).toBe('qwen3.5:9b');
    expect(args).toContain('--max-turns');
    expect(args[args.indexOf('--max-turns') + 1]).toBe('25');
  });

  it('prefers per-invocation options.model over JANUMICODE_GOOSE_MODEL', async () => {
    process.env.JANUMICODE_GOOSE_MODEL = 'qwen3.5:9b';

    const spy = stubCli();
    await engine.agentInvoker.invoke({
      agentRole: 'executor_agent',
      backingTool: 'goose_cli',
      invocationId: 'inv-4',
      prompt: 'p',
      cwd: '/tmp/ws',
      model: 'claude-sonnet-4-6',
    });
    const args = (spy.mock.calls[0][0] as { args: string[] }).args;
    expect(args).toContain('--model');
    expect(args[args.indexOf('--model') + 1]).toBe('claude-sonnet-4-6');
  });

  it('appends JANUMICODE_GOOSE_EXTRA_ARGS verbatim', async () => {
    process.env.JANUMICODE_GOOSE_EXTRA_ARGS = '--debug --max-tool-repetitions 3';

    const spy = stubCli();
    await engine.agentInvoker.invoke({
      agentRole: 'executor_agent',
      backingTool: 'goose_cli',
      invocationId: 'inv-5',
      prompt: 'p',
      cwd: '/tmp/ws',
    });
    const args = (spy.mock.calls[0][0] as { args: string[] }).args;
    expect(args).toContain('--debug');
    expect(args).toContain('--max-tool-repetitions');
    expect(args[args.indexOf('--max-tool-repetitions') + 1]).toBe('3');
  });
});
