import { describe, it, expect } from 'vitest';
import { ProviderRegistry, ProviderResolutionError } from '../lib/llm/providerRegistry.js';
import '../lib/llm/providers/index.js';
import { providerRegistry } from '../lib/llm/providerRegistry.js';

describe('ProviderRegistry', () => {
  it('registers built-in provider names', () => {
    expect(providerRegistry.has('mock')).toBe(true);
    expect(providerRegistry.has('ollama')).toBe(true);
    expect(providerRegistry.has('anthropic')).toBe(true);
    expect(providerRegistry.has('google')).toBe(true);
  });

  it('UNKNOWN_PROVIDER for unregistered name', async () => {
    const reg = new ProviderRegistry();
    await expect(reg.resolve({ name: 'mock' as never, settings: {} })).rejects.toThrow(ProviderResolutionError);
  });

  it('resolves the mock provider with scripted responses', async () => {
    const p = await providerRegistry.resolve({
      name: 'mock',
      settings: { script: [{ response: { content: '{"hello": "world"}' } }] },
    });
    const resp = await p.invoke({ messages: [{ role: 'user', content: 'x' }], cacheNamespace: 'm_test' });
    expect(resp.content).toBe('{"hello": "world"}');
  });

  it('Anthropic resolution surfaces SDK_MISSING with remediation when @anthropic-ai/sdk is absent', async () => {
    // The SDK is NOT in package.json; resolution should fail with a clear message.
    let err: unknown;
    try {
      await providerRegistry.resolve({ name: 'anthropic', settings: {} });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect((err as Error).message).toMatch(/@anthropic-ai\/sdk|SDK|install/i);
  });

  it('Google resolution surfaces SDK_MISSING when @google/genai is absent', async () => {
    let err: unknown;
    try {
      await providerRegistry.resolve({ name: 'google', settings: {} });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect((err as Error).message).toMatch(/@google\/genai|SDK|install/i);
  });
});
