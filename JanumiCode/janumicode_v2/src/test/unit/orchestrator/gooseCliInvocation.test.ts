/**
 * Regression tests for Goose CLI wiring — the STRUCTURED (one-shot
 * `goose run`) invocation.
 *
 * Pins the structured-path properties:
 *   1. `registerBuiltinCLIParsers()` installs the Goose parser.
 *   2. `buildCLICommand('goose_cli')` spawns `goose run` with stdin-only
 *      prompt (`-i -`), `--no-session`, `--quiet`,
 *      `--output-format stream-json`, `--with-builtin developer`.
 *   3. Env-var knobs thread through; per-invocation `options.model` wins.
 *
 * NOTE: as of the interactive-session work (M4), an `executor_agent`
 * goose task routes through the Tier-3 TUI session adapter by default
 * (`goose session` over a PTY) — covered by capabilityRegistry.test +
 * gooseTuiAdapter.test. The structured command below is the role-agnostic
 * builder, still used for non-executor goose calls and the executor's
 * no-pty fallback; these tests exercise it via a non-executor role so the
 * interactive divert does not apply (and we never spawn a real session).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
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
    const extensionPath = path.resolve(__dirname, '..', '..', '..', '..');
    const workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'jc-test-ws-'));
    engine = new OrchestratorEngine(db, configManager, workspacePath, extensionPath);
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
      agentRole: 'requirements_agent', // non-executor: exercises the structured goose path (executor goes interactive)
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
      agentRole: 'requirements_agent', // non-executor: exercises the structured goose path (executor goes interactive)
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
      agentRole: 'requirements_agent', // non-executor: exercises the structured goose path (executor goes interactive)
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
      agentRole: 'requirements_agent', // non-executor: exercises the structured goose path (executor goes interactive)
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
      agentRole: 'requirements_agent', // non-executor: exercises the structured goose path (executor goes interactive)
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

  it('sets GOOSE_CLI_SHOW_THINKING=true and GOOSE_RANDOM_THINKING_MESSAGES=false on every goose spawn', async () => {
    const spy = stubCli();
    await engine.agentInvoker.invoke({
      agentRole: 'requirements_agent', // non-executor: exercises the structured goose path (executor goes interactive)
      backingTool: 'goose_cli',
      invocationId: 'inv-6',
      prompt: 'p',
      cwd: '/tmp/ws',
    });
    const env = (spy.mock.calls[0][0] as { env?: Record<string, string> }).env;
    expect(env?.GOOSE_CLI_SHOW_THINKING).toBe('true');
    expect(env?.GOOSE_RANDOM_THINKING_MESSAGES).toBe('false');
  });

  it('caller-supplied env overrides the goose reasoning-visibility defaults', async () => {
    const spy = stubCli();
    await engine.agentInvoker.invoke({
      agentRole: 'requirements_agent',
      backingTool: 'goose_cli',
      invocationId: 'inv-7',
      prompt: 'p',
      cwd: '/tmp/ws',
      env: { GOOSE_CLI_SHOW_THINKING: '0', CUSTOM_VAR: 'kept' },
    });
    const env = (spy.mock.calls[0][0] as { env?: Record<string, string> }).env;
    expect(env?.GOOSE_CLI_SHOW_THINKING).toBe('0');
    expect(env?.GOOSE_RANDOM_THINKING_MESSAGES).toBe('false');
    expect(env?.CUSTOM_VAR).toBe('kept');
  });
});
