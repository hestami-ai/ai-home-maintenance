/**
 * llama.cpp HTTP-server LLM provider adapter.
 *
 * Targets `llama-server` (the official `llama.cpp` HTTP server, OpenAI-
 * compatible) running locally on a configurable port. Distinct from
 * the canonical `openai` provider because:
 *
 *   1. llama-server v8951+ exposes a dual-channel response: thinking
 *      tokens arrive as `delta.reasoning_content` and visible response
 *      tokens as `delta.content`. The OpenAI public API never emits
 *      `reasoning_content`. Forking the openai provider to handle both
 *      shapes would pollute the canonical adapter.
 *
 *   2. llama-server accepts llama.cpp-specific sampling params
 *      (`min_p`, `presence_penalty`, `repeat_penalty`, `top_k`) on the
 *      request body. These aren't in the OpenAI request schema; the
 *      canonical openai provider would silently drop them.
 *
 *   3. llama-server is single-model-per-instance, but JanumiCode runs
 *      multiple roles concurrently (decomposer, embeddings, reasoning
 *      review). The harness brings up several llama-server instances
 *      on different ports and points each role at its own URL via
 *      `llm_routing.<role>.primary.base_url`. The openai provider
 *      carries one global URL.
 *
 *   4. llama-server adds non-OpenAI introspection endpoints
 *      (`/health`, `/props`) the calibration harness uses to verify
 *      "is the right model loaded?" before issuing a request.
 *
 * No `<think>...</think>` regex parsing is needed — server emits the
 * two channels natively as separate fields. See the smoke-test results
 * documented in calibration notes.
 */

import * as http from 'node:http';
import type {
  LLMCallOptions,
  LLMCallResult,
  LLMProviderAdapter,
  LLMStreamingCallOptions,
} from '../llmCaller';
import { LLMError } from '../llmCaller';
import { parseJsonWithRecovery } from '../jsonRecovery';

/** Per-instance config captured at construction time. */
export interface LlamaCppProviderOptions {
  /** Base URL (e.g. `http://127.0.0.1:11435`). Defaults to env / 11435. */
  baseUrl?: string;
}

/** OpenAI chat-completions delta shape with llama.cpp's reasoning_content extension. */
interface DeltaFrame {
  content?: string | null;
  reasoning_content?: string | null;
  role?: string;
}

/**
 * Resolve provider-default sampling params for known model families.
 * Mirrors the per-family overrides in the Ollama provider so any
 * caller that points at qwen / gemma gets sensible defaults without
 * having to thread provider-specific knobs through every callsite.
 */
function familyDefaults(modelLc: string): {
  temperature: number;
  topK?: number;
  topP?: number;
  minP?: number;
  presencePenalty?: number;
  repeatPenalty?: number;
} {
  if (modelLc.includes('qwen')) {
    // Sampling profile from ByteShape's Qwen3.5-A3B model card.
    return {
      temperature: 1, topK: 20, topP: 0.95, minP: 0,
      presencePenalty: 1.5, repeatPenalty: 1,
    };
  }
  if (modelLc.includes('gemma')) {
    // Gemma 4 sampling per Google's recommended defaults.
    return { temperature: 1, topK: 64, topP: 0.95 };
  }
  return { temperature: 0.7 };
}

export class LlamaCppProvider implements LLMProviderAdapter {
  readonly name = 'llamacpp';
  private readonly baseUrl: string;

  constructor(options: LlamaCppProviderOptions = {}) {
    this.baseUrl = options.baseUrl
      ?? process.env.LLAMACPP_URL
      ?? 'http://127.0.0.1:11435';
  }

  /**
   * Health probe. Returns true when the server reports `status: ok`.
   * Used by the calibration harness to confirm a freshly-spawned
   * llama-server is ready before issuing a request.
   */
  async health(): Promise<boolean> {
    try {
      const url = new URL('/health', this.baseUrl);
      const body = await this.httpGet(url);
      const parsed = JSON.parse(body) as { status?: string };
      return parsed.status === 'ok';
    } catch {
      return false;
    }
  }

  /**
   * Return the model path the server has loaded. Used by the harness
   * to assert "the right model is up for this phase" — when a config
   * expects gemma-4 but the server still has qwen3.5 loaded, the
   * mismatch is caught before any inference is attempted.
   */
  async loadedModelPath(): Promise<string | null> {
    try {
      const url = new URL('/props', this.baseUrl);
      const body = await this.httpGet(url);
      const parsed = JSON.parse(body) as { model_path?: string };
      return parsed.model_path ?? null;
    } catch {
      return null;
    }
  }

  async call(options: LLMCallOptions): Promise<LLMCallResult> {
    const onChunk = (options as LLMStreamingCallOptions).onChunk;
    const modelLc = options.model.toLowerCase();
    const fam = familyDefaults(modelLc);

    // Compose the OpenAI chat-completions body. llama-server tolerates
    // unknown fields gracefully but accepts the llama.cpp-extended
    // sampling knobs (min_p, presence_penalty, repeat_penalty, top_k)
    // on the same payload.
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
    if (options.system) messages.push({ role: 'system', content: options.system });
    messages.push({ role: 'user', content: options.prompt });

    // Llama.cpp's `n_predict` equivalent on OpenAI shape is
    // `max_tokens`. Caller's value wins; otherwise let the server use
    // its boot-time `-n` default. Sampling params come from the
    // model-family default; absent fields are simply omitted (server
    // applies its own default).
    const body: Record<string, unknown> = {
      model: options.model,
      messages,
      stream: !!onChunk,
      temperature: options.temperature ?? fam.temperature,
    };
    if (options.maxTokens) body.max_tokens = options.maxTokens;
    if (fam.topK !== undefined) body.top_k = fam.topK;
    if (fam.topP !== undefined) body.top_p = fam.topP;
    if (fam.minP !== undefined) body.min_p = fam.minP;
    if (fam.presencePenalty !== undefined) body.presence_penalty = fam.presencePenalty;
    if (fam.repeatPenalty !== undefined) body.repeat_penalty = fam.repeatPenalty;

    // JSON response-format hint. llama-server respects
    // `response_format: { type: 'json_object' }` and constrains the
    // grammar accordingly. Skip for thinking-mode families because
    // the visible `content` field is naturally JSON in well-prompted
    // calls and constraining the grammar can interact poorly with
    // `reasoning_content` interleaving.
    if (options.responseFormat === 'json'
        && !modelLc.includes('qwen')
        && !modelLc.includes('gemma')) {
      body.response_format = { type: 'json_object' };
    }

    // Per-call baseUrl wins over the constructor default. The
    // calibration harness uses this to route different roles at
    // different llama-server instances (qwen on 11435, gemma on
    // 11437, etc.) without juggling multiple provider registrations.
    const effectiveBase = options.baseUrl ?? this.baseUrl;
    const url = new URL('/v1/chat/completions', effectiveBase);

    if (onChunk) {
      return this.streamingCall(url, body, options, onChunk);
    }
    return this.nonStreamingCall(url, body, options);
  }

  /** Non-streaming chat completion. */
  private async nonStreamingCall(
    url: URL,
    body: Record<string, unknown>,
    options: LLMCallOptions,
  ): Promise<LLMCallResult> {
    return new Promise<LLMCallResult>((resolve, reject) => {
      const req = http.request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf-8');
          if (res.statusCode && res.statusCode >= 400) {
            reject(this.mapHttpError(res.statusCode, raw));
            return;
          }
          try {
            const json = JSON.parse(raw);
            const msg = json.choices?.[0]?.message ?? {};
            const text: string = msg.content ?? '';
            const thinking: string | undefined = msg.reasoning_content || undefined;
            let parsed: Record<string, unknown> | null = null;
            if (options.responseFormat === 'json') {
              parsed = parseJsonWithRecovery(text).parsed;
            }
            resolve({
              text, parsed, thinking,
              toolCalls: [],
              provider: 'llamacpp',
              model: json.model ?? options.model,
              inputTokens: json.usage?.prompt_tokens ?? null,
              outputTokens: json.usage?.completion_tokens ?? null,
              usedFallback: false,
              retryAttempts: 0,
            });
          } catch (err) {
            reject(new LLMError(`Failed to parse llama.cpp response: ${err}`, 'unknown'));
          }
        });
      });
      req.setTimeout(600_000, () => {
        req.destroy();
        reject(new LLMError('llama.cpp request timed out', 'network_timeout', undefined, true));
      });
      req.on('error', (err) => {
        reject(new LLMError(`llama.cpp connection error: ${err.message}`, 'network_timeout', undefined, true));
      });
      req.write(JSON.stringify(body));
      req.end();
    });
  }

  /**
   * Streaming chat completion. Parses SSE `data: {...}` frames and
   * routes `delta.reasoning_content` to thinking channel and
   * `delta.content` to response channel. Mirrors the Ollama provider's
   * idle-stall detector so a wedged stream is killed promptly rather
   * than hanging the run.
   */
  private streamingCall(
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
          const status = res.statusCode;
          const errChunks: Buffer[] = [];
          res.on('data', (c) => errChunks.push(c));
          res.on('end', () => {
            reject(this.mapHttpError(status, Buffer.concat(errChunks).toString('utf-8')));
          });
          return;
        }

        // Mutable accumulators captured by the SSE handler. Local
        // single-element arrays are used so the helper can mutate
        // primitives by index (TS doesn't allow direct ref-out
        // semantics for primitives).
        const acc: StreamAccumulator = {
          fullResponse: '', fullThinking: '', finalModel: options.model,
          promptTokens: null, completionTokens: null,
        };

        // Stream-level idle-stall detector. Mirrors the Ollama
        // provider's STALL_MS knob; same env var name so operators
        // tune both with one setting.
        const stallMs = Number.parseInt(process.env.JANUMICODE_LLM_STALL_MS ?? '180000', 10);
        let idleTimer: NodeJS.Timeout | null = null;
        const resetIdleTimer = (): void => {
          if (idleTimer) clearTimeout(idleTimer);
          idleTimer = setTimeout(() => {
            req.destroy();
            reject(new LLMError(
              `llama.cpp stream stalled — no data for ${Math.round(stallMs / 1000)}s`,
              'network_timeout', undefined, true,
            ));
          }, stallMs);
        };
        resetIdleTimer();

        let buffer = '';
        res.on('data', (chunk: Buffer) => {
          resetIdleTimer();
          buffer += chunk.toString('utf-8');
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) processSseLine(line, acc, onChunk);
        });

        res.on('end', () => {
          if (idleTimer) clearTimeout(idleTimer);
          let parsed: Record<string, unknown> | null = null;
          if (options.responseFormat === 'json') {
            parsed = parseJsonWithRecovery(acc.fullResponse).parsed;
          }
          resolve({
            text: acc.fullResponse,
            parsed,
            thinking: acc.fullThinking || undefined,
            toolCalls: [],
            provider: 'llamacpp',
            model: acc.finalModel,
            inputTokens: acc.promptTokens,
            outputTokens: acc.completionTokens,
            usedFallback: false,
            retryAttempts: 0,
          });
        });
      });

      req.setTimeout(600_000, () => {
        req.destroy();
        reject(new LLMError('llama.cpp request timed out', 'network_timeout', undefined, true));
      });
      req.on('error', (err) => {
        reject(new LLMError(`llama.cpp connection error: ${err.message}`, 'network_timeout', undefined, true));
      });

      // Abort wiring matches the Ollama provider: the LLMCaller can
      // trip an abort for size-cap violations or session abort, and
      // we destroy the request to free the slot immediately. The
      // retry loop in LLMCaller decides whether to retry based on
      // its own `abortReason`, not the rejection here.
      if (abortSignal) {
        if (abortSignal.aborted) {
          req.destroy();
          reject(new LLMError('llama.cpp request aborted', 'unknown', undefined, false));
          return;
        }
        abortSignal.addEventListener('abort', () => {
          req.destroy();
          reject(new LLMError('llama.cpp stream aborted', 'unknown', undefined, false));
        }, { once: true });
      }

      req.write(JSON.stringify(body));
      req.end();
    });
  }

  /** Map an HTTP error to the LLMError taxonomy LLMCaller's retry loop expects. */
  private mapHttpError(status: number, body: string): LLMError {
    const snippet = body.slice(0, 500);
    if (status === 429) return new LLMError(`llama.cpp rate-limited: ${snippet}`, 'rate_limit', status, true);
    if (status >= 500) return new LLMError(`llama.cpp server error ${status}: ${snippet}`, 'unknown', status, true);
    return new LLMError(`llama.cpp request failed ${status}: ${snippet}`, 'unknown', status, false);
  }

  /** Plain HTTP GET helper for /health and /props. */
  private httpGet(url: URL): Promise<string> {
    return new Promise((resolve, reject) => {
      const req = http.get(url, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      });
      req.on('error', reject);
      req.setTimeout(5_000, () => { req.destroy(); reject(new Error('timeout')); });
    });
  }
}

/**
 * Accumulator threaded through `processSseLine` so the streaming
 * handler stays small. Captures both text channels, the model id
 * the server announces in each frame, and the usage block (which
 * llama-server only emits in the final frame).
 */
interface StreamAccumulator {
  fullResponse: string;
  fullThinking: string;
  finalModel: string;
  promptTokens: number | null;
  completionTokens: number | null;
}

/**
 * Parse one SSE line and apply its content to the accumulator + emit
 * onChunk callbacks. Handles three shapes:
 *   - blank or non-`data:` lines → ignore
 *   - `data: [DONE]` → terminator, ignore
 *   - `data: {<json>}` → parse + apply
 *
 * Lifted to module scope so the stream handler in `streamingCall`
 * stays under SonarLint's cognitive-complexity ceiling.
 */
function processSseLine(
  line: string,
  acc: StreamAccumulator,
  onChunk: (c: { text: string; channel: 'response' | 'thinking' }) => void,
): void {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data:')) return;
  const payload = trimmed.slice(5).trim();
  if (!payload || payload === '[DONE]') return;
  let frame: {
    model?: string;
    choices?: Array<{ delta?: DeltaFrame; finish_reason?: string }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  try {
    frame = JSON.parse(payload);
  } catch {
    // llama-server occasionally emits keep-alive partials that don't
    // parse as full JSON. Drop them silently — the next frame will
    // carry the actual content.
    return;
  }
  if (frame.model) acc.finalModel = frame.model;
  applyDelta(frame.choices?.[0]?.delta, acc, onChunk);
  if (frame.usage?.prompt_tokens !== undefined) acc.promptTokens = frame.usage.prompt_tokens;
  if (frame.usage?.completion_tokens !== undefined) acc.completionTokens = frame.usage.completion_tokens;
}

/**
 * Apply a single delta frame's text fields to the accumulator and
 * emit the matching channel onChunk callback. llama-server emits
 * `content` and `reasoning_content` as separate fields per delta, so
 * each delta hits exactly one channel (or neither, on usage-only
 * keep-alives).
 */
function applyDelta(
  delta: DeltaFrame | undefined,
  acc: StreamAccumulator,
  onChunk: (c: { text: string; channel: 'response' | 'thinking' }) => void,
): void {
  if (!delta) return;
  const c = delta.content;
  if (typeof c === 'string' && c.length > 0) {
    acc.fullResponse += c;
    onChunk({ text: c, channel: 'response' });
  }
  const r = delta.reasoning_content;
  if (typeof r === 'string' && r.length > 0) {
    acc.fullThinking += r;
    onChunk({ text: r, channel: 'thinking' });
  }
}
