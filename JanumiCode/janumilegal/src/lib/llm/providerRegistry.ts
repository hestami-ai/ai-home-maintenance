/**
 * LLM provider registry — lazy SDK loading.
 *
 * Per Wave 10 design: providers are plug-ins. The user installs only the SDKs
 * they actually use. The registry lazily resolves a provider by name; if its
 * SDK is missing, the registry returns a structured error pointing at the
 * install command.
 *
 * Built-in provider names:
 *   - 'mock'       : MockLLMProvider (always available; for tests)
 *   - 'ollama'     : OllamaProvider (HTTP, no SDK)
 *   - 'anthropic'  : AnthropicProvider (lazy-loads @anthropic-ai/sdk)
 *   - 'google'     : GoogleProvider (lazy-loads @google/genai)
 */

import type { LLMProvider } from './provider.js';

export type ProviderName = 'mock' | 'ollama' | 'anthropic' | 'google';

export interface ProviderConfig {
  readonly name: ProviderName;
  /** Per-provider settings — provider-defined shape. */
  readonly settings: Readonly<Record<string, unknown>>;
}

export class ProviderResolutionError extends Error {
  constructor(message: string, readonly code: 'UNKNOWN_PROVIDER' | 'SDK_MISSING' | 'CONFIG_INVALID' | 'INIT_FAILED') {
    super(message);
    this.name = 'ProviderResolutionError';
  }
}

export type ProviderFactory = (settings: Readonly<Record<string, unknown>>) => Promise<LLMProvider>;

/**
 * Global provider registry. Provider modules register lazy factories at
 * import time. The factory is invoked once per resolve() call; callers
 * may cache the resulting provider per (name, settings).
 */
export class ProviderRegistry {
  private readonly factories = new Map<ProviderName, ProviderFactory>();

  register(name: ProviderName, factory: ProviderFactory): void {
    this.factories.set(name, factory);
  }

  has(name: ProviderName): boolean {
    return this.factories.has(name);
  }

  async resolve(config: ProviderConfig): Promise<LLMProvider> {
    const factory = this.factories.get(config.name);
    if (!factory) {
      throw new ProviderResolutionError(
        `unknown provider '${config.name}' — registered: ${Array.from(this.factories.keys()).join(', ') || '(none)'}`,
        'UNKNOWN_PROVIDER',
      );
    }
    try {
      return await factory(config.settings);
    } catch (err) {
      const e = err as Error & { code?: string };
      if (e.code === 'SDK_MISSING') throw err;
      throw new ProviderResolutionError(
        `provider '${config.name}' init failed: ${e.message}`,
        'INIT_FAILED',
      );
    }
  }

  list(): ProviderName[] {
    return Array.from(this.factories.keys());
  }
}

/** Module-level singleton — providers register into this on module load. */
export const providerRegistry = new ProviderRegistry();
