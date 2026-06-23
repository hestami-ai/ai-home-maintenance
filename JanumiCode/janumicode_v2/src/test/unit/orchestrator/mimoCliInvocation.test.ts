/**
 * Regression tests for mimo CLI wiring at the AgentInvoker layer.
 *
 * Background: mimo is the DEFAULT Phase-9 executor (server-API adapter via
 * `mimo serve` HTTP/SSE — see MimoServerAdapter). The adapter manages its own
 * server process and bypasses the structured stdout path, BUT AgentInvoker
 * still runs two backing-tool-keyed steps for EVERY invocation before the
 * executor adapter is even selected:
 *   1. a pre-flight "is an output parser registered for this backing tool?"
 *      gate (agentInvoker.ts ~L301), and
 *   2. `buildCLICommand(backingTool)` (~L311), whose `default` branch THROWS
 *      `Unknown backing tool: <x>`.
 *
 * A live slice-151 resume surfaced that `mimo_cli` was wired into the
 * capabilityRegistry + executor default but NOT into `registerBuiltinCLIParsers`
 * NOR `buildCLICommand` — so every Phase-9 leaf quarantined with
 * "No output parser registered for backing tool: mimo_cli" before mimo ever
 * spawned. These tests pin both gaps closed.
 *
 * As with gooseCliInvocation.test, we drive a NON-executor role so the
 * interactive-session divert (executor_agent-only) does not apply and we never
 * spawn a real `mimo serve` — the structured path with a stubbed cliInvoker
 * exercises both the parser gate and buildCLICommand.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createTestDatabase, type Database } from '../../../lib/database/init';
import { ConfigManager } from '../../../lib/config/configManager';
import { OrchestratorEngine } from '../../../lib/orchestrator/orchestratorEngine';

describe('mimo CLI invocation wiring', () => {
  let db: Database;
  let engine: OrchestratorEngine;

  beforeEach(() => {
    db = createTestDatabase();
    const configManager = new ConfigManager();
    const extensionPath = path.resolve(__dirname, '..', '..', '..', '..');
    const workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'jc-test-ws-'));
    engine = new OrchestratorEngine(db, configManager, workspacePath, extensionPath);
    engine.registerBuiltinCLIParsers();
  });

  afterEach(() => {
    db.close();
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

  it('registerBuiltinCLIParsers registers mimo_cli alongside the other backings', () => {
    const tools = engine.agentInvoker.getRegisteredBackingTools();
    expect(tools).toContain('mimo_cli');
    // sanity: the established backings are still there
    expect(tools).toEqual(expect.arrayContaining(['claude_code_cli', 'gemini_cli', 'goose_cli', 'codex_cli']));
  });

  it('does not fail with "No output parser registered" for mimo_cli', async () => {
    const spy = stubCli();
    const result = await engine.agentInvoker.invoke({
      agentRole: 'requirements_agent', // non-executor: exercises the structured path (executor goes through the server adapter)
      backingTool: 'mimo_cli',
      invocationId: 'inv-mimo-1',
      prompt: 'build a todo app',
      cwd: '/tmp/ws',
    });
    expect(result.error ?? '').not.toMatch(/No output parser registered/);
    expect(result.success).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('buildCLICommand handles mimo_cli instead of throwing "Unknown backing tool"', async () => {
    const spy = stubCli();
    await engine.agentInvoker.invoke({
      agentRole: 'requirements_agent',
      backingTool: 'mimo_cli',
      invocationId: 'inv-mimo-2',
      prompt: 'task prompt',
      cwd: '/tmp/ws',
    });
    // If buildCLICommand's default branch had been hit it would have thrown
    // before reaching the (stubbed) cliInvoker. Reaching the stub proves the
    // mimo_cli case returned a command.
    expect(spy).toHaveBeenCalledTimes(1);
    const spawnOpts = spy.mock.calls[0][0] as { command: string; args: string[] };
    expect(spawnOpts.command).toBe('mimo');
  });
});
