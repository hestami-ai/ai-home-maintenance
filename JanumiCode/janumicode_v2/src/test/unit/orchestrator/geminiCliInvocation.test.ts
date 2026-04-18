/**
 * Regression tests for Gemini CLI invocation wiring.
 *
 * The bug this pins: the old command was
 *   `gemini --prompt "<big text>"`
 * while CLIInvoker ALWAYS pipes `options.prompt` to stdin. Gemini
 * treats piped stdin as a positional prompt, so it errored with
 *   Cannot use both a positional prompt and the --prompt (-p) flag together
 * and exited 1 — but `callForRole`'s old behaviour was to coerce empty
 * events into `{text:'', parsed:null}` and the phase fell through to a
 * pass-through default. These tests pin that:
 *
 *   1. The default Gemini command does NOT pass `--prompt` on the
 *      command line — the prompt flows only via stdin.
 *   2. Env knobs thread through to the spawn args.
 *   3. JANUMICODE_GEMINI_YOLO=1 adds --yolo for unattended runs.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'node:path';
import { createTestDatabase, type Database } from '../../../lib/database/init';
import { ConfigManager } from '../../../lib/config/configManager';
import { OrchestratorEngine } from '../../../lib/orchestrator/orchestratorEngine';

describe('Gemini CLI invocation wiring', () => {
  let db: Database;
  let engine: OrchestratorEngine;
  const prevYolo = process.env.JANUMICODE_GEMINI_YOLO;
  const prevModel = process.env.JANUMICODE_GEMINI_MODEL;
  const prevExtra = process.env.JANUMICODE_GEMINI_EXTRA_ARGS;

  beforeEach(() => {
    delete process.env.JANUMICODE_GEMINI_YOLO;
    delete process.env.JANUMICODE_GEMINI_MODEL;
    delete process.env.JANUMICODE_GEMINI_EXTRA_ARGS;
    db = createTestDatabase();
    const configManager = new ConfigManager();
    const workspacePath = path.resolve(__dirname, '..', '..', '..', '..');
    engine = new OrchestratorEngine(db, configManager, workspacePath);
    engine.registerBuiltinCLIParsers();
  });

  afterEach(() => {
    db.close();
    if (prevYolo === undefined) delete process.env.JANUMICODE_GEMINI_YOLO;
    else process.env.JANUMICODE_GEMINI_YOLO = prevYolo;
    if (prevModel === undefined) delete process.env.JANUMICODE_GEMINI_MODEL;
    else process.env.JANUMICODE_GEMINI_MODEL = prevModel;
    if (prevExtra === undefined) delete process.env.JANUMICODE_GEMINI_EXTRA_ARGS;
    else process.env.JANUMICODE_GEMINI_EXTRA_ARGS = prevExtra;
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

  it('default command does NOT pass --prompt (prompt flows via stdin only)', async () => {
    const spy = stubCli();
    await engine.agentInvoker.invoke({
      agentRole: 'orchestrator',
      backingTool: 'gemini_cli',
      invocationId: 'inv-1',
      prompt: 'large multiline prompt…',
      cwd: '/tmp/ws',
    });
    const spawnOpts = spy.mock.calls[0][0] as {
      command: string;
      args: string[];
      stdinContent: string;
    };
    expect(spawnOpts.command).toBe('gemini');
    // The bug was `args: ['--prompt', options.prompt, ...]` which
    // conflicted with piped stdin. Guard both forms.
    expect(spawnOpts.args).not.toContain('--prompt');
    expect(spawnOpts.args).not.toContain('-p');
    // Prompt MUST arrive via stdin — that's how Gemini detects
    // non-interactive mode without the flag.
    expect(spawnOpts.stdinContent).toBe('large multiline prompt…');
    // No --yolo by default — Orchestrator role only outputs JSON, no
    // tool approval dialog to auto-accept.
    expect(spawnOpts.args).not.toContain('--yolo');
  });

  it('adds --yolo when JANUMICODE_GEMINI_YOLO=1 is set', async () => {
    process.env.JANUMICODE_GEMINI_YOLO = '1';
    const spy = stubCli();
    await engine.agentInvoker.invoke({
      agentRole: 'executor_agent',
      backingTool: 'gemini_cli',
      invocationId: 'inv-2',
      prompt: 'p',
      cwd: '/tmp/ws',
    });
    const args = (spy.mock.calls[0][0] as { args: string[] }).args;
    expect(args).toContain('--yolo');
  });

  it('threads JANUMICODE_GEMINI_MODEL through as --model', async () => {
    process.env.JANUMICODE_GEMINI_MODEL = 'gemini-2.5-pro';
    const spy = stubCli();
    await engine.agentInvoker.invoke({
      agentRole: 'orchestrator',
      backingTool: 'gemini_cli',
      invocationId: 'inv-3',
      prompt: 'p',
      cwd: '/tmp/ws',
    });
    const args = (spy.mock.calls[0][0] as { args: string[] }).args;
    expect(args).toContain('--model');
    expect(args[args.indexOf('--model') + 1]).toBe('gemini-2.5-pro');
  });

  it('prefers per-invocation options.model over JANUMICODE_GEMINI_MODEL', async () => {
    process.env.JANUMICODE_GEMINI_MODEL = 'gemini-2.5-pro';
    const spy = stubCli();
    await engine.agentInvoker.invoke({
      agentRole: 'orchestrator',
      backingTool: 'gemini_cli',
      invocationId: 'inv-4',
      prompt: 'p',
      cwd: '/tmp/ws',
      model: 'gemini-2.5-flash',
    });
    const args = (spy.mock.calls[0][0] as { args: string[] }).args;
    expect(args[args.indexOf('--model') + 1]).toBe('gemini-2.5-flash');
  });

  it('appends JANUMICODE_GEMINI_EXTRA_ARGS verbatim', async () => {
    process.env.JANUMICODE_GEMINI_EXTRA_ARGS = '--debug --telemetry-opt-out';
    const spy = stubCli();
    await engine.agentInvoker.invoke({
      agentRole: 'orchestrator',
      backingTool: 'gemini_cli',
      invocationId: 'inv-5',
      prompt: 'p',
      cwd: '/tmp/ws',
    });
    const args = (spy.mock.calls[0][0] as { args: string[] }).args;
    expect(args).toContain('--debug');
    expect(args).toContain('--telemetry-opt-out');
  });
});
