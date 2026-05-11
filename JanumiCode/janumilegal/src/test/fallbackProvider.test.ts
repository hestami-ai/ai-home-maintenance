/**
 * FallbackProvider tests — verify the chain advances on failure and stops
 * on the first success.
 */

import { describe, it, expect } from 'vitest';
import { FallbackProvider } from '../lib/llm/fallbackProvider.js';
import type { LLMProvider, LLMRequest, LLMResponse } from '../lib/llm/provider.js';

class StubProvider implements LLMProvider {
  readonly calls: LLMRequest[] = [];
  constructor(readonly name: string, private readonly behavior: 'ok' | 'throw', private readonly content = `from ${name}`) {}
  async invoke(req: LLMRequest): Promise<LLMResponse> {
    this.calls.push(req);
    if (this.behavior === 'throw') throw new Error(`${this.name} failed`);
    return { content: this.content };
  }
}

const baseReq: LLMRequest = {
  messages: [{ role: 'user', content: 'hi' }],
  cacheNamespace: 'm_test',
};

describe('FallbackProvider', () => {
  it('returns primary response when primary succeeds; never calls fallback', async () => {
    const primary = new StubProvider('p1', 'ok');
    const fallback = new StubProvider('p2', 'ok');
    const wrapped = new FallbackProvider(primary, [fallback]);
    const r = await wrapped.invoke(baseReq);
    expect(r.content).toBe('from p1');
    expect(primary.calls.length).toBe(1);
    expect(fallback.calls.length).toBe(0);
  });

  it('advances to fallback when primary throws', async () => {
    const primary = new StubProvider('p1', 'throw');
    const fallback = new StubProvider('p2', 'ok');
    const wrapped = new FallbackProvider(primary, [fallback]);
    const r = await wrapped.invoke(baseReq);
    expect(r.content).toBe('from p2');
    expect(primary.calls.length).toBe(1);
    expect(fallback.calls.length).toBe(1);
  });

  it('throws an aggregate error when every provider fails', async () => {
    const primary = new StubProvider('p1', 'throw');
    const fallback = new StubProvider('p2', 'throw');
    const wrapped = new FallbackProvider(primary, [fallback]);
    await expect(wrapped.invoke(baseReq)).rejects.toThrow(/all providers in fallback chain failed/);
  });

  it('preserves the cacheNamespace verbatim across the chain', async () => {
    const primary = new StubProvider('p1', 'throw');
    const fallback = new StubProvider('p2', 'ok');
    const wrapped = new FallbackProvider(primary, [fallback]);
    await wrapped.invoke({ ...baseReq, cacheNamespace: 'm_unique_ns' });
    expect(primary.calls[0].cacheNamespace).toBe('m_unique_ns');
    expect(fallback.calls[0].cacheNamespace).toBe('m_unique_ns');
  });

  it('exposes its chained name for log clarity', () => {
    const wrapped = new FallbackProvider(new StubProvider('p1', 'ok'), [new StubProvider('p2', 'ok')]);
    expect(wrapped.name).toBe('fallback(p1->p2)');
  });
});
