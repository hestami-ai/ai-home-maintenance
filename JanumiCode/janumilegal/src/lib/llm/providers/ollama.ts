/**
 * Ollama provider.
 *
 * Calls a local Ollama server via HTTP. No SDK dependency.
 * Default endpoint: http://127.0.0.1:11434/api/chat
 *
 * Wave 10 calibration target — local Ollama is the cheap path for thin-slice
 * and gold-matter runs. Production lens activations route to Anthropic/Google
 * per FirmConfig.llmRouting.
 */

import type { LLMProvider, LLMRequest, LLMResponse } from '../provider.js';
import { providerRegistry } from '../providerRegistry.js';

export interface OllamaSettings {
  readonly endpoint?: string;        // default http://127.0.0.1:11434
  readonly defaultModel?: string;    // default llama3.1:8b
  readonly timeoutMs?: number;       // default 120000
}

export class OllamaProvider implements LLMProvider {
  readonly name = 'ollama';
  private readonly endpoint: string;
  private readonly defaultModel: string;
  private readonly timeoutMs: number;

  constructor(settings: OllamaSettings = {}) {
    this.endpoint = settings.endpoint ?? 'http://127.0.0.1:11434';
    this.defaultModel = settings.defaultModel ?? 'llama3.1:8b';
    this.timeoutMs = settings.timeoutMs ?? 120_000;
  }

  async invoke(request: LLMRequest): Promise<LLMResponse> {
    const model = request.model ?? this.defaultModel;
    const messages: Array<{ role: string; content: string }> = [];
    if (request.system) messages.push({ role: 'system', content: request.system });
    for (const m of request.messages) messages.push({ role: m.role, content: m.content });

    const body = {
      model,
      messages,
      stream: false,
      options: {
        temperature: request.temperature ?? 0.2,
        num_predict: request.maxTokens ?? 4096,
      },
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let resp: Response;
    try {
      resp = await fetch(`${this.endpoint}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!resp.ok) {
      throw new Error(`ollama returned ${resp.status}: ${(await resp.text()).slice(0, 500)}`);
    }
    const json = (await resp.json()) as {
      message?: { content?: string };
      done_reason?: string;
      eval_count?: number;
      prompt_eval_count?: number;
    };
    return {
      content: json.message?.content ?? '',
      stopReason: json.done_reason,
      usage: {
        inputTokens: json.prompt_eval_count,
        outputTokens: json.eval_count,
      },
    };
  }
}

// Lazy factory — registers on module load. Ollama has no SDK dependency, so
// the factory is synchronous-equivalent (just returns a new instance).
providerRegistry.register('ollama', async (settings) => new OllamaProvider(settings as OllamaSettings));
