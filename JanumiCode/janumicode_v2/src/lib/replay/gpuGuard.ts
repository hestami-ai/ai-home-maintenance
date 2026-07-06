/**
 * No-GPU guarantee for replay mode.
 *
 * When `JANUMICODE_REPLAY_MODE=1`, the extension is driven from recorded
 * calibration-run data and MUST NOT contact the local GPU (Ollama), the
 * remote LLM APIs, or any CLI/TUI coding agent (mimo/goose/opencode) — the
 * single local GPU is reserved for a parallel V&V thread.
 *
 * Replay registers replay/fail-loud adapters as the *sole* LLM providers and
 * short-circuits the AgentInvoker, so no live transport should ever be
 * reached. These guards are defense-in-depth: any code path that still tries
 * to construct/call a live transport throws loudly here instead of silently
 * hitting `127.0.0.1:11434` or spawning a subprocess.
 *
 * The check is a single env read — in production (`JANUMICODE_REPLAY_MODE`
 * unset) every guard is a cheap no-op branch.
 */

export const REPLAY_MODE_ENV = 'JANUMICODE_REPLAY_MODE';
export const REPLAY_ENGINE_ENV = 'JANUMICODE_REPLAY_ENGINE';

/** Thrown when a live transport is reached while replay mode is active. */
export class ReplayGpuGuardError extends Error {
  constructor(context: string) {
    super(
      `[replay] Live transport blocked (${REPLAY_MODE_ENV}=1): ${context}. `
      + 'Replay must never contact the GPU / LLM API / CLI agent — this '
      + 'indicates a code path that bypassed the replay adapters.',
    );
    this.name = 'ReplayGpuGuardError';
  }
}

/** True when the process is running in GPU-free replay mode. */
export function isReplayMode(): boolean {
  return process.env[REPLAY_MODE_ENV] === '1';
}

/**
 * True when Tier-2 engine replay is additionally enabled — the real
 * OrchestratorEngine is re-driven with recorded LLM/CLI outputs replayed at
 * Seam A/B. Implies {@link isReplayMode}.
 */
export function isEngineReplayMode(): boolean {
  return isReplayMode() && process.env[REPLAY_ENGINE_ENV] === '1';
}

/**
 * Throw if called while in replay mode. Placed at the network/subprocess hot
 * paths of every live transport (the four LLM provider `call()` methods, the
 * node-pty spawn, and the mimo `serve` spawn) so an accidental live call in
 * replay mode fails fast and points at the offending role/sub-phase.
 */
export function assertNotReplayMode(context: string): void {
  if (isReplayMode()) {
    throw new ReplayGpuGuardError(context);
  }
}
