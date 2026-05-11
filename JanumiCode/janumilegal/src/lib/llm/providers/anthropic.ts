/**
 * Anthropic provider — lazy-loads @anthropic-ai/sdk.
 *
 * The SDK is NOT in package.json dependencies. The user installs it only if
 * they intend to route to Anthropic:
 *
 *   pnpm add @anthropic-ai/sdk
 *
 * If the SDK is missing, resolving 'anthropic' throws ProviderResolutionError
 * with code SDK_MISSING and a clear remediation message.
 */

import type { LLMProvider, LLMRequest, LLMResponse } from '../provider.js';
import { providerRegistry, ProviderResolutionError } from '../providerRegistry.js';

export interface AnthropicSettings {
  readonly apiKey?: string;
  readonly defaultModel?: string;     // e.g. 'claude-opus-4-7' or 'claude-sonnet-4-6'
  readonly timeoutMs?: number;
  /** Enables prompt caching headers; matter-scoped cacheNamespace is used as the cache key prefix. */
  readonly enablePromptCaching?: boolean;
}

export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';
  private readonly client: unknown; // SDK client; typed `unknown` to avoid hard SDK dep at type-check time
  private readonly defaultModel: string;
  private readonly timeoutMs: number;
  private readonly enablePromptCaching: boolean;

  constructor(client: unknown, settings: AnthropicSettings) {
    this.client = client;
    this.defaultModel = settings.defaultModel ?? 'claude-sonnet-4-6';
    this.timeoutMs = settings.timeoutMs ?? 120_000;
    this.enablePromptCaching = settings.enablePromptCaching ?? true;
  }

  async invoke(request: LLMRequest): Promise<LLMResponse> {
    const model = request.model ?? this.defaultModel;
    const messages = request.messages.map((m) => ({ role: m.role, content: m.content }));
    const params: Record<string, unknown> = {
      model,
      max_tokens: request.maxTokens ?? 4096,
      temperature: request.temperature ?? 0.2,
      messages,
    };
    if (request.system) params.system = request.system;
    // The SDK's prompt-cache header model is more nuanced; for Wave 10 we
    // pass cacheNamespace as metadata.user_id so the per-matter prompt cache
    // namespace is available at the provider routing layer without leaking
    // matter identifiers in headers.
    if (this.enablePromptCaching) {
      params.metadata = { user_id: request.cacheNamespace };
    }

    // SDK's messages.create returns a typed response; we narrow with `any` here
    // because the SDK types aren't a hard dep at compile time.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sdkClient = this.client as any;
    const resp = (await Promise.race([
      sdkClient.messages.create(params),
      new Promise((_, reject) => setTimeout(() => reject(new Error('anthropic call timed out')), this.timeoutMs)),
    ])) as {
      content?: Array<{ type: string; text?: string }>;
      stop_reason?: string;
      usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
    };

    const textBlocks = (resp.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '');
    return {
      content: textBlocks.join(''),
      stopReason: resp.stop_reason,
      usage: {
        inputTokens: resp.usage?.input_tokens,
        outputTokens: resp.usage?.output_tokens,
        cacheReadTokens: resp.usage?.cache_read_input_tokens,
        cacheCreationTokens: resp.usage?.cache_creation_input_tokens,
      },
    };
  }
}

providerRegistry.register('anthropic', async (settings) => {
  const s = settings as AnthropicSettings;
  let sdk: unknown;
  try {
    sdk = (await import('@anthropic-ai/sdk' as string)).default;
  } catch (err) {
    throw new ProviderResolutionError(
      `Anthropic provider requires '@anthropic-ai/sdk'. Install it: pnpm add @anthropic-ai/sdk\n  underlying: ${(err as Error).message}`,
      'SDK_MISSING',
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SdkClass = sdk as any;
  const apiKey = s.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new ProviderResolutionError(
      `Anthropic provider requires ANTHROPIC_API_KEY env var or settings.apiKey`,
      'CONFIG_INVALID',
    );
  }
  const client = new SdkClass({ apiKey });
  return new AnthropicProvider(client, s);
});
