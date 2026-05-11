/**
 * Google (Gemini) provider — lazy-loads @google/genai.
 *
 *   pnpm add @google/genai
 *
 * If missing, resolving 'google' throws SDK_MISSING.
 */

import type { LLMProvider, LLMRequest, LLMResponse } from '../provider.js';
import { providerRegistry, ProviderResolutionError } from '../providerRegistry.js';

export interface GoogleSettings {
  readonly apiKey?: string;
  readonly defaultModel?: string; // e.g. 'gemini-1.5-pro'
  readonly timeoutMs?: number;
}

export class GoogleProvider implements LLMProvider {
  readonly name = 'google';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly client: any;
  private readonly defaultModel: string;
  private readonly timeoutMs: number;

  constructor(client: unknown, settings: GoogleSettings) {
    this.client = client;
    this.defaultModel = settings.defaultModel ?? 'gemini-1.5-pro';
    this.timeoutMs = settings.timeoutMs ?? 120_000;
  }

  async invoke(request: LLMRequest): Promise<LLMResponse> {
    const model = request.model ?? this.defaultModel;
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
    for (const m of request.messages) {
      contents.push({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] });
    }
    const config: Record<string, unknown> = {
      maxOutputTokens: request.maxTokens ?? 4096,
      temperature: request.temperature ?? 0.2,
    };
    if (request.system) config.systemInstruction = { parts: [{ text: request.system }] };

    const resp = (await Promise.race([
      this.client.models.generateContent({ model, contents, config }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('google call timed out')), this.timeoutMs)),
    ])) as {
      text?: string;
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };

    const text =
      resp.text ??
      (resp.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('') ??
      '';
    return {
      content: text,
      stopReason: resp.candidates?.[0]?.finishReason,
      usage: {
        inputTokens: resp.usageMetadata?.promptTokenCount,
        outputTokens: resp.usageMetadata?.candidatesTokenCount,
      },
    };
  }
}

providerRegistry.register('google', async (settings) => {
  const s = settings as GoogleSettings;
  let mod: { GoogleGenAI?: unknown };
  try {
    mod = (await import('@google/genai' as string)) as { GoogleGenAI?: unknown };
  } catch (err) {
    throw new ProviderResolutionError(
      `Google provider requires '@google/genai'. Install it: pnpm add @google/genai\n  underlying: ${(err as Error).message}`,
      'SDK_MISSING',
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SdkClass = mod.GoogleGenAI as any;
  if (!SdkClass) {
    throw new ProviderResolutionError(`@google/genai did not export GoogleGenAI`, 'SDK_MISSING');
  }
  const apiKey = s.apiKey ?? process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new ProviderResolutionError(
      `Google provider requires GOOGLE_API_KEY or GEMINI_API_KEY env var or settings.apiKey`,
      'CONFIG_INVALID',
    );
  }
  const client = new SdkClass({ apiKey });
  return new GoogleProvider(client, s);
});
