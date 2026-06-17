/**
 * Tier-1 structured adapter — the behavior-preserving baseline + fallback.
 *
 * Wraps the existing one-shot {@link CLIInvoker} (write stdin once, stream
 * stdout through the per-provider OutputParser) behind the unified
 * {@link ExecutorAdapter} contract, reusing the production `extractFinalText`
 * so its result is identical to today's executor path. Used when a CLI exposes
 * no interactive research mode, for tasks explicitly flagged trivial, or —
 * preferentially — when a CLI offers a structured research-plan protocol.
 */

import { CLIInvoker } from '../../cliInvoker';
import type { OutputParser } from '../../outputParser';
import type { AdapterTier, ExecutorAdapter, ExecutorTaskOutcome, ExecutorTaskRequest } from '../adapter';

export class StructuredAdapter implements ExecutorAdapter {
  readonly tier: AdapterTier = 'structured';

  constructor(
    private readonly outputParser: OutputParser,
    /** Injectable for tests; defaults to a fresh CLIInvoker. */
    private readonly invoker: CLIInvoker = new CLIInvoker(),
  ) {}

  async run(req: ExecutorTaskRequest): Promise<ExecutorTaskOutcome> {
    const result = await this.invoker.invoke({
      command: req.command,
      args: req.args,
      stdinContent: req.prompt,
      cwd: req.cwd,
      env: req.env,
      timeoutSeconds: req.timeoutSeconds,
      idleTimeoutSeconds: req.idleTimeoutSeconds,
      outputParser: this.outputParser,
    });

    // Reuse the production final-text extractor so output matches the legacy
    // executor path exactly (dynamic import avoids an orchestrator import cycle).
    const { extractFinalText } = await import('../../../orchestrator/orchestratorEngine.js');
    const finalText = extractFinalText(result.events) || (result.stdoutText ?? '');

    return {
      tier: this.tier,
      exitCode: result.exitCode,
      finalText,
      rawOutput: result.stdoutText ?? '',
      timedOut: result.timedOut || result.idledOut || result.noContentTimedOut,
      durationMs: result.durationMs,
    };
  }
}
