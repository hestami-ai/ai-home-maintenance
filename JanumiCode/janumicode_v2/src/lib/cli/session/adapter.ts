/**
 * Cross-CLI executor-adapter contract.
 *
 * A single interface spanning the 3-tier interactivity spectrum so the Phase-9
 * scheduler can run a coding-agent task without knowing whether it's a one-shot
 * structured invocation or a multi-turn TUI session. Tier selection is the
 * capability registry's job (M4); the scheduler just calls `run`.
 *
 *   - `structured`         — one-shot JSON/stdin (wraps the existing CLIInvoker).
 *   - `interactive_prompt` — line-oriented prompt/response over PTY.
 *   - `full_tui`           — slash-command/chat TUI over PTY (research→plan→implement).
 *
 * For Phase-9 tasks the DEFAULT is the highest interactive tier a CLI supports,
 * because the filesystem research/plan step is mandatory (phases 1–8 are
 * FS-blind); `structured` is the fallback/exception.
 */

export type AdapterTier = 'structured' | 'interactive_prompt' | 'full_tui';

export interface ExecutorTaskRequest {
  /** Executable, e.g. 'goose' / 'claude'. */
  command: string;
  args: string[];
  cwd: string;
  /** The fully-assembled task prompt (orientation + packet + ownership + criteria). */
  prompt: string;
  env?: Record<string, string>;
  /** Hard wall-clock cap. */
  timeoutSeconds?: number;
  /** Idle (no-output) cap. */
  idleTimeoutSeconds?: number;
}

export interface ExecutorTaskOutcome {
  /** Which tier actually ran (telemetry + audit). */
  tier: AdapterTier;
  exitCode: number | null;
  /** Best-effort final assistant text / result. */
  finalText: string;
  /** Raw captured output (stdout for structured; raw PTY bytes for TUI). */
  rawOutput: string;
  timedOut: boolean;
  durationMs: number;
}

export interface ExecutorAdapter {
  readonly tier: AdapterTier;
  /** Run the task to completion and return its outcome. */
  run(req: ExecutorTaskRequest): Promise<ExecutorTaskOutcome>;
}
