/**
 * Characterization tests for the codex_cli branch of buildCLICommand.
 *
 * The other backing tools (claude/gemini/goose/mimo) are pinned by their own
 * *CliInvocation.test.ts files, but the codex case had no direct test. These
 * pin its CURRENT observable output so the S3776 decomposition of
 * buildCLICommand (extracting each case into a per-tool builder) is provably
 * behaviour-preserving.
 *
 * Contract (ported from v1 codexCli.buildCodexArgs):
 *   `codex exec --sandbox read-only --json -`  — read prompt from stdin (`-`).
 *   options.model inserts `--model <name>` BEFORE the `-` sentinel.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AgentInvoker } from '../../../lib/orchestrator/agentInvoker';
import { LLMCaller } from '../../../lib/llm/llmCaller';

interface CliCommand { command: string; args: string[] }

function buildCLICommand(invoker: AgentInvoker, options: Record<string, unknown>): CliCommand {
  // buildCLICommand is private; cast through `unknown` to access it — same
  // pattern the other AgentInvoker CLI-argument tests use.
  return (invoker as unknown as { buildCLICommand: (o: unknown) => CliCommand })
    .buildCLICommand(options);
}

describe('AgentInvoker — codex_cli buildCLICommand', () => {
  let invoker: AgentInvoker;

  beforeEach(() => {
    invoker = new AgentInvoker(new LLMCaller({ maxRetries: 0 }), {
      timeoutSeconds: 1, idleTimeoutSeconds: 1, noContentTimeoutSeconds: 1, bufferMaxEvents: 100,
    });
  });

  it('default (no model) → codex exec --sandbox read-only --json - (stdin sentinel last)', () => {
    const { command, args } = buildCLICommand(invoker, {
      backingTool: 'codex_cli', cwd: '/tmp/x', prompt: 'p', invocationId: 'inv-1',
    });
    expect(command).toBe('codex');
    expect(args).toEqual(['exec', '--sandbox', 'read-only', '--json', '-']);
    // The `-` sentinel MUST be last so codex reads the prompt from stdin.
    expect(args[args.length - 1]).toBe('-');
    // No model flag unless options.model is set.
    expect(args).not.toContain('--model');
  });

  it('with options.model → inserts --model <name> immediately before the `-` sentinel', () => {
    const { command, args } = buildCLICommand(invoker, {
      backingTool: 'codex_cli', cwd: '/tmp/x', prompt: 'p', invocationId: 'inv-2',
      model: 'gpt-5-codex',
    });
    expect(command).toBe('codex');
    expect(args).toEqual(['exec', '--sandbox', 'read-only', '--json', '--model', 'gpt-5-codex', '-']);
    // Ordering contract: --model comes after --json, and the stdin sentinel
    // stays last.
    expect(args.indexOf('--model')).toBe(args.indexOf('--json') + 1);
    expect(args[args.indexOf('--model') + 1]).toBe('gpt-5-codex');
    expect(args[args.length - 1]).toBe('-');
  });
});
