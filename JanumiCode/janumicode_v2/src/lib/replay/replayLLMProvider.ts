/**
 * Replay LLM provider — Tier-2 Seam A.
 *
 * A hermetic {@link LLMProviderAdapter} that returns recorded outputs from a
 * {@link ReplayFixtureMap} instead of calling a live model. Registered as the
 * SOLE provider under every provider name in engine-replay mode, so there is
 * nothing live to fall through to on a miss (closing the non-hermetic hole in
 * LLMCaller.call, which falls to the live adapter on a resume-cache miss).
 *
 * Match policy: exact canonical key → normalized key (volatile tokens scrubbed,
 * the prompt-drift mitigation) → miss. On a miss, `strict` (CI/regression)
 * throws {@link ReplayMissError}; lenient (interactive dev) returns an
 * empty-success result and logs, so one drifted prompt doesn't hard-stop an
 * exploration.
 */

import type {
  LLMCallOptions,
  LLMCallResult,
  LLMProviderAdapter,
} from '../llm/llmCaller';
import { getLogger } from '../logging';
import { LIVE_PROVIDER_NAMES } from './failLoudProvider';
import { ReplayFixtureMap, replayOutputToLLMResult } from './replayFixtureMap';

export class ReplayMissError extends Error {
  constructor(context: string) {
    super(`[replay] No recorded LLM output for ${context}. The re-rendered prompt did not `
      + 'match any recorded call (exact or normalized). Re-capture with the current '
      + 'prompt templates, or run non-strict (unset JANUMICODE_REPLAY_STRICT).');
    this.name = 'ReplayMissError';
  }
}

export class ReplayLLMProvider implements LLMProviderAdapter {
  constructor(
    public readonly name: string,
    private readonly map: ReplayFixtureMap,
    private readonly strict: boolean,
  ) {}

  // eslint-disable-next-line @typescript-eslint/require-await
  async call(options: LLMCallOptions): Promise<LLMCallResult> {
    const hit = this.map.lookupLLM({
      provider: options.provider,
      model: options.model,
      responseFormat: options.responseFormat ?? 'text',
      temperature: options.temperature ?? null,
      maxTokens: options.maxTokens ?? null,
      system: options.system ?? null,
      prompt: options.prompt,
      tools: options.tools ?? [],
      toolChoice: options.toolChoice ?? null,
    });
    const ctx = `${options.provider}/${options.model} `
      + `role=${options.traceContext?.agentRole ?? '?'} sub=${options.traceContext?.subPhaseId ?? '?'}`;
    if (hit) {
      if (hit.match === 'normalized') {
        getLogger().debug('ui', 'replay LLM matched via normalized key', { ctx });
      }
      return replayOutputToLLMResult(hit.output);
    }
    if (this.strict) throw new ReplayMissError(`${ctx} (prompt ${options.prompt.length} chars)`);
    getLogger().warn('ui', 'replay LLM MISS (lenient) — returning empty-success', { ctx });
    return emptyResult(options);
  }
}

/** Empty-but-valid result for a lenient miss (mirrors MockLLMProvider). */
function emptyResult(options: LLMCallOptions): LLMCallResult {
  const isJson = options.responseFormat === 'json';
  return {
    text: isJson ? '{}' : '',
    parsed: isJson ? {} : null,
    toolCalls: [],
    provider: options.provider,
    model: options.model,
    inputTokens: 0,
    outputTokens: isJson ? 1 : 0,
    usedFallback: false,
    retryAttempts: 0,
  };
}

/** One {@link ReplayLLMProvider} per provider name the engine/liaison route to. */
export function buildReplayLLMProviders(
  map: ReplayFixtureMap,
  strict: boolean,
  names: readonly string[] = LIVE_PROVIDER_NAMES,
): ReplayLLMProvider[] {
  return names.map((n) => new ReplayLLMProvider(n, map, strict));
}
