/**
 * Ollama LLM provider adapter.
 * Used for local development and testing.
 */

import * as http from 'node:http';
import type {
  LLMCallOptions,
  LLMCallResult,
  LLMProviderAdapter,
  ToolCall,
} from '../llmCaller';
import { LLMError } from '../llmCaller';

export class OllamaProvider implements LLMProviderAdapter {
  readonly name = 'ollama';
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434';
  }

  async call(options: LLMCallOptions): Promise<LLMCallResult> {
    // When tools are present, route through the chat endpoint which supports
    // function-calling. Without tools, keep the legacy /api/generate path so
    // existing callers (Phase 1, Reasoning Review, etc.) are unchanged.
    if (options.tools && options.tools.length > 0) {
      return this.chatCall(options);
    }

    const body: Record<string, unknown> = {
      model: options.model,
      prompt: options.prompt,
      stream: false,
      options: {
        temperature: options.temperature ?? 0.7,
        ...(options.maxTokens ? { num_predict: options.maxTokens } : {}),
      },
    };

    if (options.system) body.system = options.system;
    if (options.responseFormat === 'json') body.format = 'json';

    const url = new URL('/api/generate', this.baseUrl);

    return new Promise<LLMCallResult>((resolve, reject) => {
      const req = http.request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          try {
            const raw = Buffer.concat(chunks).toString('utf-8');

            if (res.statusCode && res.statusCode >= 400) {
              reject(this.mapHttpError(res.statusCode, raw));
              return;
            }

            const json = JSON.parse(raw);
            const text = json.response ?? '';

            let parsed: Record<string, unknown> | null = null;
            if (options.responseFormat === 'json') {
              try { parsed = JSON.parse(text); } catch { /* not valid JSON */ }
            }

            resolve({
              text,
              parsed,
              toolCalls: [],
              provider: 'ollama',
              model: json.model ?? options.model,
              inputTokens: json.prompt_eval_count ?? null,
              outputTokens: json.eval_count ?? null,
              usedFallback: false,
              retryAttempts: 0,
            });
          } catch (err) {
            reject(new LLMError(`Failed to parse Ollama response: ${err}`, 'unknown'));
          }
        });
      });

      req.setTimeout(600_000, () => {
        req.destroy();
        reject(new LLMError('Ollama request timed out', 'network_timeout', undefined, true));
      });

      req.on('error', (err) => {
        reject(new LLMError(`Ollama connection error: ${err.message}`, 'network_timeout', undefined, true));
      });

      req.write(JSON.stringify(body));
      req.end();
    });
  }

  /**
   * Tool-calling path via Ollama's chat API. Requires Ollama >= 0.5.0 and
   * a model that supports function calling (e.g. qwen3.5, llama3.1+).
   */
  private chatCall(options: LLMCallOptions): Promise<LLMCallResult> {
    const messages: Array<Record<string, unknown>> = [];
    if (options.system) messages.push({ role: 'system', content: options.system });
    messages.push({ role: 'user', content: options.prompt });

    const body: Record<string, unknown> = {
      model: options.model,
      messages,
      stream: false,
      tools: options.tools!.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.input_schema,
        },
      })),
      options: {
        temperature: options.temperature ?? 0.7,
        ...(options.maxTokens ? { num_predict: options.maxTokens } : {}),
      },
    };

    const url = new URL('/api/chat', this.baseUrl);

    return new Promise<LLMCallResult>((resolve, reject) => {
      const req = http.request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          try {
            const raw = Buffer.concat(chunks).toString('utf-8');

            if (res.statusCode && res.statusCode >= 400) {
              reject(this.mapHttpError(res.statusCode, raw));
              return;
            }

            const json = JSON.parse(raw);
            const message = (json.message ?? {}) as {
              content?: string;
              tool_calls?: Array<{
                function?: { name?: string; arguments?: unknown };
              }>;
            };

            const text = message.content ?? '';
            const toolCalls: ToolCall[] = (message.tool_calls ?? [])
              .filter(tc => tc.function?.name)
              .map(tc => {
                let params: Record<string, unknown> = {};
                const args = tc.function!.arguments;
                if (typeof args === 'string') {
                  try { params = JSON.parse(args); } catch { /* leave empty */ }
                } else if (args && typeof args === 'object') {
                  params = args as Record<string, unknown>;
                }
                return { name: tc.function!.name!, params };
              });

            resolve({
              text,
              parsed: null,
              toolCalls,
              provider: 'ollama',
              model: json.model ?? options.model,
              inputTokens: json.prompt_eval_count ?? null,
              outputTokens: json.eval_count ?? null,
              usedFallback: false,
              retryAttempts: 0,
            });
          } catch (err) {
            reject(new LLMError(`Failed to parse Ollama chat response: ${err}`, 'unknown'));
          }
        });
      });

      req.setTimeout(600_000, () => {
        req.destroy();
        reject(new LLMError('Ollama request timed out', 'network_timeout', undefined, true));
      });

      req.on('error', (err) => {
        reject(new LLMError(`Ollama connection error: ${err.message}`, 'network_timeout', undefined, true));
      });

      req.write(JSON.stringify(body));
      req.end();
    });
  }

  private mapHttpError(status: number, body: string): LLMError {
    if (status === 429) return new LLMError(body, 'rate_limit', status, true);
    if (status === 503 || status === 504) return new LLMError(body, 'service_unavailable', status, true);
    if (status === 401 || status === 403) return new LLMError(body, 'auth_error', status);
    if (status === 500) return new LLMError(body, 'model_error', status, true);
    if (status === 400) {
      if (body.includes('context length') || body.includes('too long')) {
        return new LLMError(body, 'context_exceeded', status);
      }
      return new LLMError(body, 'schema_error', status);
    }
    return new LLMError(body, 'unknown', status);
  }
}
