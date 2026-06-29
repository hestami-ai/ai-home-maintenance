/**
 * Model/provider-aware LLM-call timeout budgets.
 *
 * The harness aborts an in-flight LLM call on three signals: NO-PROGRESS (no
 * streamed chunk for N s, llmCaller), provider STALL (no socket data for N ms,
 * ollama.ts), and a WALL-CLOCK backstop (llmCaller). The historical defaults
 * (90 s / 180 s / 600 s) were tuned for fast cloud APIs and small/MoE local
 * models. They are TOO AGGRESSIVE for slow, large DENSE local models (e.g.
 * gemma4:31b on an RTX 4090):
 *
 *   With Ollama configured one-model-at-a-time, every call after a model swap
 *   pays a model RELOAD + prompt PREFILL (time-to-first-token) before the first
 *   chunk. For a ~19 GB dense model at num_ctx=131072 that routinely exceeds
 *   90 s, so the no-progress timer kills the stream mid-generation. cal-29
 *   (2026-06-28) failed exactly this way — ALL 38 `retry.scheduled` events in
 *   the AODD log were "no-progress timeout (90s without a streaming chunk)",
 *   truncating outputs → dropped results → false Phase-2 gate failure. See
 *   memory project_gemma4_31b_decomposition_divergence.
 *
 * Fix: give LOCAL providers (which incur reload+prefill) generous budgets and
 * keep CLOUD providers (fast TTFT — a real hang should fail fast) tight. The
 * no-progress timer re-arms on EVERY streamed chunk (incl. thinking), so once
 * streaming starts these generous budgets never matter — they only cover the
 * legitimate pre-first-token gap. The wall-clock stays comfortably under the
 * orchestrator's 1 h records-idle session stall (runner.ts records_idle_stall_ms)
 * even across retries. Per-knob env vars override everything.
 *
 * NOT changed (per operator): num_ctx stays 131072 (4090-optimized for
 * gemma4:31b) and there is no keep-alive lever (Ollama serializes one model at
 * a time, so the reload is inherent — the timeout must simply accommodate it).
 */
export interface LlmTimeoutBudget {
  /** No streamed chunk for this many seconds → abort (retryable). 0 disables. */
  noProgressSeconds: number;
  /** Provider streaming idle: no socket data for this many ms → abort (retryable). */
  stallMs: number;
  /** Per-attempt wall-clock backstop in seconds → abort (retryable). 0 disables. */
  maxCallSeconds: number;
}

/**
 * Providers that load the model locally and therefore pay reload + prefill
 * (time-to-first-token) latency on every call after a swap.
 */
const LOCAL_PROVIDERS = new Set(['ollama', 'ollama-local', 'llamacpp']);

/** Cloud / fast-TTFT default: a real hang should abort quickly. */
const CLOUD_BUDGET: LlmTimeoutBudget = { noProgressSeconds: 90, stallMs: 180_000, maxCallSeconds: 600 };

/**
 * Local default: cover worst-case model reload + prefill at full context.
 * Ordering noProgress(600) < stall(900) < maxCall(1200) < session-stall(3600)
 * so the no-progress timer (best retry semantics) fires first, with the
 * provider stall and wall-clock as ordered backstops, all under the 1 h
 * orchestrator records-idle stall. The final inequality (maxCall < session
 * stall) is enforced by resolveRecordsIdleStallMs below — for LOCAL runs the
 * session stall MUST exceed the per-call wall-clock, else the session watchdog
 * guillotines a single legitimately-slow call mid-stream (cal-29 P6.1 died this
 * way: a 922 s call killed by the 900 s default session stall).
 */
const LOCAL_BUDGET: LlmTimeoutBudget = { noProgressSeconds: 600, stallMs: 900_000, maxCallSeconds: 1200 };

/**
 * Records-idle SESSION stall (waitForQuiescence, runner.ts records_idle_stall_ms).
 * DISTINCT from the per-CALL budgets above: it aborts the WHOLE run when no new
 * governed_stream record appears for this long. A streaming call produces no
 * record until it COMPLETES, so this MUST exceed the per-call wall-clock —
 * otherwise a single slow-but-progressing local call is killed by the session
 * watchdog (cal-29 P6.1: 922 s call vs the 900 s default). Historically the
 * generous 1 h value was applied ONLY under --thin-slice/--full-slice; a plain
 * `run` on local models kept the 900 s default and inverted the ordering. So
 * make it model-aware: LOCAL runs get 1 h (comfortably above the 1200 s local
 * wall-clock, with retry headroom); cloud-only runs keep the 15 min default
 * (above the 600 s cloud wall-clock). env JANUMICODE_RECORDS_IDLE_STALL_MS
 * overrides. Slice modes still set 3600000 explicitly (runner.ts) — same value.
 */
const LOCAL_SESSION_STALL_MS = 3_600_000;
const CLOUD_SESSION_STALL_MS = 900_000;

/** Resolve the records-idle session-stall (ms) for a run, given whether it routes any role to a local model. */
export function resolveRecordsIdleStallMs(usesLocalModels: boolean): number {
  return envInt('JANUMICODE_RECORDS_IDLE_STALL_MS')
    ?? (usesLocalModels ? LOCAL_SESSION_STALL_MS : CLOUD_SESSION_STALL_MS);
}

/** Parse a non-negative integer env var; undefined when unset/invalid (0 is honored to disable). */
function envInt(name: string): number | undefined {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return undefined;
  const v = Number.parseInt(raw, 10);
  return Number.isFinite(v) && v >= 0 ? v : undefined;
}

/** True for providers that load the model locally (reload + prefill latency). */
export function isLocalProvider(provider?: string): boolean {
  return !!provider && LOCAL_PROVIDERS.has(provider.toLowerCase());
}

/**
 * Resolve the per-call timeout budget for a (provider, model). Local providers
 * get generous budgets (reload + prefill); cloud providers stay tight. Per-knob
 * env vars (`JANUMICODE_LLM_NO_PROGRESS_SECONDS`, `JANUMICODE_LLM_STALL_MS`,
 * `JANUMICODE_LLM_MAX_CALL_SECONDS`) override the resolved default.
 *
 * `model` is accepted for future size-aware tuning; today the local/cloud split
 * is the high-value axis (all local models incur reload+prefill).
 */
export function resolveLlmTimeouts(provider?: string, _model?: string): LlmTimeoutBudget {
  const base = isLocalProvider(provider) ? LOCAL_BUDGET : CLOUD_BUDGET;
  return {
    noProgressSeconds: envInt('JANUMICODE_LLM_NO_PROGRESS_SECONDS') ?? base.noProgressSeconds,
    stallMs: envInt('JANUMICODE_LLM_STALL_MS') ?? base.stallMs,
    maxCallSeconds: envInt('JANUMICODE_LLM_MAX_CALL_SECONDS') ?? base.maxCallSeconds,
  };
}
