/**
 * Ollama LLM provider adapter.
 * Used for local development and testing.
 */

import * as http from 'node:http';
import type {
  LLMCallOptions,
  LLMCallResult,
  LLMProviderAdapter,
  LLMStreamingCallOptions,
  ToolCall,
} from '../llmCaller';
import { LLMError } from '../llmCaller';
import { parseJsonWithRecovery } from '../jsonRecovery';

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

    const isQwen = options.model.toLowerCase().startsWith('qwen');
    const onChunk = (options as LLMStreamingCallOptions).onChunk;

    // Qwen thinking models: match the Postman-verified payload exactly.
    // The user confirmed the canonical Hestami IQC prompt converges in
    // ~1min with `temperature: 1.0, presence_penalty: 1.5, top_p: 0.95,
    // top_k: 20, num_ctx: 262144, think: true` — and loops past 10min
    // when the caller sneaks in a lower temperature (0.3 for structured
    // JSON output in Phase 1's IQC). Low temp + presence_penalty 1.5
    // is toxic for qwen3 thinking: the model can't sample its way out
    // of self-correction because entropy is too low to break recency
    // penalties. We therefore ignore the caller's temperature on qwen
    // and apply the Postman baseline. Non-qwen providers still honor
    // options.temperature as usual.
    const temperature = isQwen ? 1 : (options.temperature ?? 0.7);

    // Token cap (`num_predict`) — off by default to match the
    // Postman-verified payload that works reliably. The original
    // reason we set it was to bound the qwen3 thinking spiral, but
    // the real cause of that spiral was a temperature mismatch (see
    // temperature comment above). With correct temperature + the
    // streaming loop detector + idle-stall timer, we don't need a
    // server-side token cap. Env opt-in kept for emergencies; pass
    // `options.maxTokens` explicitly when a specific phase legit
    // needs to bound long outputs.
    const numPredict = options.maxTokens
      ?? Number.parseInt(process.env.JANUMICODE_LLM_NUM_PREDICT ?? '0', 10);

    const body: Record<string, unknown> = {
      model: options.model,
      prompt: options.prompt,
      // Stream whenever the LLMCaller passed a chunk callback — that's the
      // signal that the caller wants live output. Non-streaming callers
      // (older tests, provider identity probes) get the original batch
      // behavior.
      stream: !!onChunk,
      // Qwen3 thinking models loop on their reasoning chain when `think`
      // is unset — verified by the user against /api/generate where the
      // same prompt+options completed in ~67s with `think: true` but ran
      // unboundedly without it.
      // NOTA BENE: All of JanumiCode requires thinking / reasoning models at every stage.
      think: true,
      options: {
        temperature,
        num_ctx: 262144,
        ...(isQwen ? { presence_penalty: 1.5, top_k: 20, top_p: 0.95 } : {}),
        ...(numPredict > 0 ? { num_predict: numPredict } : {}),
      },
    };

    if (options.system) body.system = options.system;
    // Skip format: json for qwen thinking models — when set, Ollama
    // merges the thinking and response into a single `thinking` field
    // with an empty `response`, losing the ability to judge both the
    // reasoning chain and the output. Instead we rely on the prompt
    // template to request JSON and parse it from the response text.
    if (options.responseFormat === 'json' && !isQwen) {
      body.format = 'json';
    }

    const url = new URL('/api/generate', this.baseUrl);

    // Optional request-body dump (set JANUMICODE_OLLAMA_DUMP=<dir> to
    // enable). Writes one JSON file per Ollama call so the operator
    // can diff the exact payload against a known-good Postman body —
    // this is how we found the temperature mismatch that was causing
    // the qwen3 thinking-mode spiral. Cheap when unset; silent
    // best-effort when set.
    this.dumpRequestBody(body, options);

    if (onChunk) {
      return this.streamingGenerateCall(url, body, options, onChunk);
    }

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
            const thinking: string | undefined = json.thinking || undefined;
            const responseText: string = json.response || '';

            // For qwen thinking models without format:json, the JSON
            // is in the response text (possibly wrapped in markdown
            // fences). Extract it.
            const text = responseText || '';

            let parsed: Record<string, unknown> | null = null;
            if (options.responseFormat === 'json') {
              parsed = parseJsonWithRecovery(text).parsed;
            }

            resolve({
              text,
              parsed,
              thinking,
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
   * Streaming variant of /api/generate — fires onChunk for each ND-JSON
   * frame Ollama emits, and resolves with the full concatenated result
   * after the `done: true` frame. Keeps the final LLMCallResult shape
   * identical to the non-streaming path so the LLMCaller's downstream
   * writeOutputRecords() doesn't need to branch.
   */
  private streamingGenerateCall(
    url: URL,
    body: Record<string, unknown>,
    options: LLMCallOptions,
    onChunk: (chunk: { text: string; channel: 'response' | 'thinking' }) => void,
  ): Promise<LLMCallResult> {
    const abortSignal = (options as LLMStreamingCallOptions).abortSignal;
    return new Promise<LLMCallResult>((resolve, reject) => {
      const req = http.request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }, (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          const chunks: Buffer[] = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            reject(this.mapHttpError(res.statusCode!, Buffer.concat(chunks).toString('utf-8')));
          });
          return;
        }

        let buffer = '';
        let fullResponse = '';
        let fullThinking = '';
        let finalModel = options.model;
        let promptEval: number | null = null;
        let eval_: number | null = null;

        // Idle-stall detector (B7). Ollama's thinking-mode streams can
        // legitimately run for minutes, but a stream that hasn't emitted
        // a single frame for STALL_MS is either hung or looping on a
        // silent queue. When it fires we kill the HTTP request; the
        // retry loop in LLMCaller decides whether to try again.
        const stallMs = Number.parseInt(process.env.JANUMICODE_LLM_STALL_MS ?? '180000', 10);
        let idleTimer: NodeJS.Timeout | null = null;
        const resetIdleTimer = (): void => {
          if (idleTimer) clearTimeout(idleTimer);
          idleTimer = setTimeout(() => {
            req.destroy();
            reject(new LLMError(
              `Ollama stream stalled — no data for ${Math.round(stallMs / 1000)}s`,
              'network_timeout',
              undefined,
              true,
            ));
          }, stallMs);
        };
        resetIdleTimer();

        res.on('data', (chunk: Buffer) => {
          resetIdleTimer();
          buffer += chunk.toString('utf-8');
          // Ollama streams ND-JSON — one JSON object per line.
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const frame = JSON.parse(line) as {
                response?: string;
                thinking?: string;
                done?: boolean;
                model?: string;
                prompt_eval_count?: number;
                eval_count?: number;
              };
              if (typeof frame.response === 'string' && frame.response.length > 0) {
                fullResponse += frame.response;
                onChunk({ text: frame.response, channel: 'response' });
              }
              if (typeof frame.thinking === 'string' && frame.thinking.length > 0) {
                fullThinking += frame.thinking;
                onChunk({ text: frame.thinking, channel: 'thinking' });
              }
              if (frame.model) finalModel = frame.model;
              if (typeof frame.prompt_eval_count === 'number') promptEval = frame.prompt_eval_count;
              if (typeof frame.eval_count === 'number') eval_ = frame.eval_count;
            } catch {
              // Skip malformed frames — Ollama occasionally emits blank lines.
            }
          }
        });

        res.on('end', () => {
          if (idleTimer) clearTimeout(idleTimer);
          const text = fullResponse;
          let parsed: Record<string, unknown> | null = null;
          if (options.responseFormat === 'json') {
            parsed = parseJsonWithRecovery(text).parsed;
          }
          resolve({
            text,
            parsed,
            thinking: fullThinking || undefined,
            toolCalls: [],
            provider: 'ollama',
            model: finalModel,
            inputTokens: promptEval,
            outputTokens: eval_,
            usedFallback: false,
            retryAttempts: 0,
          });
        });
      });

      req.setTimeout(600_000, () => {
        req.destroy();
        reject(new LLMError('Ollama request timed out', 'network_timeout', undefined, true));
      });

      req.on('error', (err) => {
        reject(new LLMError(`Ollama connection error: ${err.message}`, 'network_timeout', undefined, true));
      });

      // Abort wiring: when the LLMCaller's loop detector trips its
      // signal, kill the in-flight request so qwen3 thinking spirals
      // can't keep emitting tokens forever. Marked non-retryable —
      // retrying a confirmed loop would just hit the same trap.
      if (abortSignal) {
        const onAbort = (): void => {
          req.destroy();
          reject(new LLMError(
            'Ollama stream aborted by loop detector',
            'context_exceeded',
            undefined,
            false,
          ));
        };
        if (abortSignal.aborted) onAbort();
        else abortSignal.addEventListener('abort', onAbort, { once: true });
      }

      req.write(JSON.stringify(body));
      req.end();
    });
  }

  /**
   * Tool-calling path via Ollama's chat API. Requires Ollama >= 0.5.0 and
   * a model that supports function calling (e.g. qwen3.5, llama3.1+).
   */
  private chatCall(options: LLMCallOptions): Promise<LLMCallResult> {
    const isQwen = options.model.toLowerCase().startsWith('qwen');
    const messages: Array<Record<string, unknown>> = [];
    if (options.system) messages.push({ role: 'system', content: options.system });
    messages.push({ role: 'user', content: options.prompt });

    const body: Record<string, unknown> = {
      model: options.model,
      messages,
      stream: false,
      ...(isQwen ? { think: true } : {}),
      tools: options.tools!.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.input_schema,
        },
      })),
      options: {
        temperature: options.temperature ?? (isQwen ? 1 : 0.7),
        num_ctx: 262144,
        ...(isQwen ? { presence_penalty: 1.5, top_k: 20, top_p: 0.95 } : {}),
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

  /**
   * Write the exact body we're about to POST to Ollama into a
   * dump directory. Off by default; enabled with
   * `JANUMICODE_OLLAMA_DUMP=<dir>`. Used to diff JanumiCode's payload
   * against a known-good reference (Postman export) when the model's
   * behavior diverges between the two.
   *
   * The filename encodes the sub-phase so a phase-by-phase run
   * produces one file per call in order. Silent best-effort — a
   * write failure must not break the LLM call path.
   */
  private dumpRequestBody(body: Record<string, unknown>, options: LLMCallOptions): void {
    const dumpDir = process.env.JANUMICODE_OLLAMA_DUMP;
    if (!dumpDir) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('node:fs') as typeof import('node:fs');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const path = require('node:path') as typeof import('node:path');
      fs.mkdirSync(dumpDir, { recursive: true });
      const subPhase = (options.traceContext?.subPhaseId ?? 'no-sub-phase').replace('.', '_');
      const filename = `req-${subPhase}-${Date.now()}.json`;
      fs.writeFileSync(path.join(dumpDir, filename), JSON.stringify(body, null, 2), 'utf-8');
    } catch {
      // best-effort
    }
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
