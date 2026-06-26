/**
 * Executor lifecycle backstops — the SINGLE source of truth for how long the
 * harness waits on a launched coding-agent CLI/TUI (mimo, goose, claude_code,
 * codex, gemini …) before stepping in.
 *
 * Policy (see the Option-4 design discussion): the launched executor OWNS its
 * turn and self-terminates on its own signal (mimo `session.idle`, a process
 * exit, a goose completion sentinel). The harness NEVER imposes a duration cap —
 * research→plan→implement takes as long as it takes. It only intervenes on
 * PATHOLOGY, via two generous backstops, using each adapter's proper abort path
 * (mimo `POST /abort`, PTY/spawn tree-kill):
 *
 *   - idle-watchdog : no progress (no event / no output) for `IDLE` → genuinely stuck.
 *   - wall-clock    : an absolute ceiling (`IDLE + 1h`) so a noisily-stuck turn still ends.
 *
 * Defaults are deliberately huge because RPI duration is unknown up front; tune
 * via env. Both adapters and the AgentInvoker `cliConfig` read from here so every
 * executor inherits the SAME policy instead of its own short local default (the
 * short defaults were what let undici's 300s guillotine mimo mid-generation).
 */

const DEFAULT_IDLE_S = 24 * 60 * 60;       // 24h of zero progress → stuck
const WALLCLOCK_MARGIN_S = 60 * 60;        // wall-clock = idle + 1h (= 25h default)

function envPositiveInt(name: string): number | undefined {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : undefined;
}

/** Idle-watchdog threshold in seconds. `JANUMICODE_EXECUTOR_IDLE_TIMEOUT_S` overrides. */
export function resolveExecutorIdleTimeoutS(): number {
  return envPositiveInt('JANUMICODE_EXECUTOR_IDLE_TIMEOUT_S') ?? DEFAULT_IDLE_S;
}

/**
 * Wall-clock backstop in seconds. `JANUMICODE_EXECUTOR_WALLCLOCK_TIMEOUT_S`
 * overrides; otherwise it is `idle + 1h` so the absolute ceiling always sits
 * above the idle-watchdog (whatever the idle value resolves to).
 */
export function resolveExecutorWallclockTimeoutS(idleS: number = resolveExecutorIdleTimeoutS()): number {
  return envPositiveInt('JANUMICODE_EXECUTOR_WALLCLOCK_TIMEOUT_S') ?? idleS + WALLCLOCK_MARGIN_S;
}

export function resolveExecutorIdleTimeoutMs(): number {
  return resolveExecutorIdleTimeoutS() * 1000;
}

export function resolveExecutorWallclockTimeoutMs(idleMs: number = resolveExecutorIdleTimeoutMs()): number {
  return resolveExecutorWallclockTimeoutS(Math.round(idleMs / 1000)) * 1000;
}
