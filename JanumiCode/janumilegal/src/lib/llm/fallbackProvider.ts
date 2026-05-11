/**
 * FallbackProvider — wraps a primary LLMProvider with one or more fallbacks.
 *
 * Per Wave 10.1: `FirmLlmRouting` declares a `fallback` provider per state.
 * When the primary provider throws (network, quota, 5xx), this wrapper
 * advances to the next provider in order. The first provider whose
 * `invoke()` resolves wins.
 *
 * The wrapper preserves the LLMRequest verbatim — including `cacheNamespace`
 * — so matter-scoped cache keys remain consistent across providers.
 *
 * Failure semantics: if every provider throws, the last error propagates so
 * the caller (LlmBackedAgent) blocks the state with a meaningful message.
 */

import type { LLMProvider, LLMRequest, LLMResponse } from './provider.js';

export class FallbackProvider implements LLMProvider {
  readonly name: string;

  constructor(
    private readonly primary: LLMProvider,
    private readonly fallbacks: readonly LLMProvider[],
  ) {
    const chain = [primary, ...fallbacks].map((p) => p.name).join('->');
    this.name = `fallback(${chain})`;
  }

  async invoke(request: LLMRequest): Promise<LLMResponse> {
    const chain = [this.primary, ...this.fallbacks];
    let lastErr: Error | undefined;
    for (const provider of chain) {
      try {
        return await provider.invoke(request);
      } catch (err) {
        lastErr = err as Error;
      }
    }
    throw new Error(
      `all providers in fallback chain failed (${chain.map((p) => p.name).join(', ')}): ${lastErr?.message ?? 'unknown error'}`,
    );
  }
}
