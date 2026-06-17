/**
 * StructuredAdapter (Tier-1) — verifies it wraps CLIInvoker faithfully and
 * maps the result into the unified adapter outcome.
 */
import { describe, it, expect } from 'vitest';
import { StructuredAdapter } from '../../../../lib/cli/session/adapters/structuredAdapter';
import type { CLIInvoker, CLIInvocationOptions, CLIInvocationResult } from '../../../../lib/cli/cliInvoker';
import { createGooseCliParser } from '../../../../lib/cli/outputParser';

function fakeInvoker(result: Partial<CLIInvocationResult>, capture: { opts?: CLIInvocationOptions }): CLIInvoker {
  return {
    invoke: async (opts: CLIInvocationOptions): Promise<CLIInvocationResult> => {
      capture.opts = opts;
      return {
        exitCode: 0, timedOut: false, idledOut: false, noContentTimedOut: false,
        events: [], stdoutText: '', stderr: '', durationMs: 5, ...result,
      };
    },
  } as unknown as CLIInvoker;
}

describe('StructuredAdapter', () => {
  it('invokes CLIInvoker with the request command/args/prompt and the given parser', async () => {
    const capture: { opts?: CLIInvocationOptions } = {};
    const parser = createGooseCliParser();
    const adapter = new StructuredAdapter(parser, fakeInvoker({ stdoutText: 'built ok' }, capture));

    const outcome = await adapter.run({
      command: 'goose', args: ['run', '-i', '-'], cwd: '/ws', prompt: 'do the task', timeoutSeconds: 300,
    });

    expect(capture.opts?.command).toBe('goose');
    expect(capture.opts?.args).toEqual(['run', '-i', '-']);
    expect(capture.opts?.stdinContent).toBe('do the task');
    expect(capture.opts?.outputParser).toBe(parser);
    expect(outcome.tier).toBe('structured');
    expect(outcome.exitCode).toBe(0);
    // No structured events → final text falls back to stdout.
    expect(outcome.finalText).toBe('built ok');
    expect(outcome.rawOutput).toBe('built ok');
  });

  it('flags timeouts (wall/idle/no-content) as timedOut', async () => {
    const parser = createGooseCliParser();
    const adapter = new StructuredAdapter(parser, fakeInvoker({ idledOut: true }, {}));
    const outcome = await adapter.run({ command: 'goose', args: [], cwd: '/ws', prompt: 'x' });
    expect(outcome.timedOut).toBe(true);
  });
});
