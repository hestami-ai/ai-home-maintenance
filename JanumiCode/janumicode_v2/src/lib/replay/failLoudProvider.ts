/**
 * Fail-loud LLM provider for Tier-1 replay.
 *
 * Tier-1 replay is pure record-playback: recorded `governed_stream` rows are
 * fed straight into the webview, so the engine never runs and no LLM call
 * should occur. We still must register *something* under every provider name
 * referenced by `llm_routing`, otherwise `OrchestratorEngine.validateLLMRouting()`
 * fails at startup. This adapter satisfies that name check while guaranteeing
 * that any actual `call()` throws instead of contacting the GPU.
 *
 * Tier-2 engine replay (`JANUMICODE_REPLAY_ENGINE=1`) replaces these with the
 * recorded-output `ReplayLLMProvider`.
 */

import type {
  LLMCallOptions,
  LLMCallResult,
  LLMProviderAdapter,
} from '../llm/llmCaller';
import { ReplayGpuGuardError } from './gpuGuard';

/** The provider names the engine + liaison may route to. */
export const LIVE_PROVIDER_NAMES = ['ollama', 'anthropic', 'google', 'llamacpp'] as const;

export class FailLoudProvider implements LLMProviderAdapter {
  constructor(public readonly name: string) {}

  // eslint-disable-next-line @typescript-eslint/require-await
  async call(options: LLMCallOptions): Promise<LLMCallResult> {
    const role = options.traceContext?.agentRole ?? '?';
    const subPhase = options.traceContext?.subPhaseId ?? '?';
    throw new ReplayGpuGuardError(
      `LLM call attempted via '${this.name}' (role=${role}, sub_phase=${subPhase}, `
      + `model=${options.model}). Tier-1 replay is record-playback only — set `
      + `JANUMICODE_REPLAY_ENGINE=1 to replay recorded outputs instead.`,
    );
  }
}

/** Build one {@link FailLoudProvider} per provider name (defaults to all live names). */
export function buildFailLoudProviders(
  names: readonly string[] = LIVE_PROVIDER_NAMES,
): FailLoudProvider[] {
  return names.map((n) => new FailLoudProvider(n));
}
