/**
 * Ollama LLM provider adapter.
 * Used for local development and testing.
 */

import * as http from 'node:http';
import { StringDecoder } from 'node:string_decoder';
import type {
  LLMCallOptions,
  LLMCallResult,
  LLMProviderAdapter,
  LLMStreamingCallOptions,
  ToolCall,
} from '../llmCaller';
import { LLMError } from '../llmCaller';
import { tryParseJson } from '../jsonRecovery';
import { resolveLlmTimeouts } from '../llmTimeouts';
import { getLogger } from '../../logging/logger';
import { assertNotReplayMode } from '../../replay/gpuGuard';

/**
 * Stateful NDJSON frame decoder for streaming HTTP bodies. Fixes two boundary
 * hazards a naive `chunk.toString('utf-8') + split('\n')` mishandles:
 *
 *   1. **Multi-byte UTF-8 split across TCP chunks.** `StringDecoder` buffers an
 *      incomplete trailing byte sequence until the next chunk completes it. A
 *      raw `Buffer.toString('utf-8')` instead emits U+FFFD and DISCARDS the
 *      split bytes — corrupting that NDJSON line so `JSON.parse` throws and the
 *      entire frame is silently lost. For gemma4:31b this dropped the large
 *      first thinking frame after the 131072-token prefill (em-dash/smart-quote
 *      heavy, split across many slow TCP reads) → intermittent thinking
 *      head-truncation (cal-29). e4b's small/fast frames rarely span a boundary,
 *      so it never truncated.
 *   2. **NDJSON line split across chunks.** The trailing partial line is buffered
 *      until the next chunk; `flush()` then processes any final newline-less
 *      frame at stream end (previously dropped).
 *
 * Unparseable lines are surfaced via `onDrop` — never silently swallowed.
 */
export class NdjsonStreamDecoder {
  private readonly decoder = new StringDecoder('utf8');
  private buffer = '';
  constructor(private readonly onDrop?: (line: string) => void) {}

  /** Feed a chunk; returns the frames whose lines completed within it. */
  push(chunk: Buffer): Array<Record<string, unknown>> {
    this.buffer += this.decoder.write(chunk);
    const parts = this.buffer.split('\n');
    this.buffer = parts.pop() ?? ''; // keep the trailing (possibly partial) line
    return this.parse(parts);
  }

  /** Flush at stream end — decode buffered bytes and process the final frame. */
  flush(): Array<Record<string, unknown>> {
    this.buffer += this.decoder.end();
    const parts = this.buffer.length > 0 ? this.buffer.split('\n') : [];
    this.buffer = '';
    return this.parse(parts);
  }

  private parse(lines: string[]): Array<Record<string, unknown>> {
    const out: Array<Record<string, unknown>> = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        out.push(JSON.parse(line) as Record<string, unknown>);
      } catch {
        this.onDrop?.(line);
      }
    }
    return out;
  }
}

/**
 * Module-level helper for the streaming idle-stall timer. Extracted from the
 * `setTimeout` callback inside `streamingGenerateCall` to keep function nesting
 * within limits (S2004). It only reads its inputs — no closure writes — so the
 * captured `req`/`reject`/`stallMs` are passed explicitly via `setTimeout`'s
 * extra-args forwarding, preserving the original behavior exactly.
 */
function onOllamaStreamIdleStall(
  req: http.ClientRequest,
  reject: (reason?: unknown) => void,
  stallMs: number,
): void {
  req.destroy();
  reject(new LLMError(
    `Ollama stream stalled — no data for ${Math.round(stallMs / 1000)}s`,
    'network_timeout',
    undefined,
    true,
  ));
}

/**
 * Module-level helper that wires an optional AbortSignal to the in-flight
 * streaming request. Extracted from `streamingGenerateCall` to keep that
 * function's cognitive complexity within limits (S3776). Behavior is identical
 * to the former inline block: with no signal it does nothing; otherwise it
 * kills the request and rejects on abort (immediately if already aborted).
 * LLMCaller trips this signal for size-cap, tiny-chunk flailing, or session
 * abort, and decides retryability based on its own abortReason (it overrides
 * this error on the way out). The captured `req`/`reject` are passed explicitly
 * — no closure writes — preserving the original behavior exactly.
 */
function wireOllamaStreamAbort(
  abortSignal: AbortSignal | undefined,
  req: http.ClientRequest,
  reject: (reason?: unknown) => void,
): void {
  if (!abortSignal) return;
  const onAbort = (): void => {
    req.destroy();
    reject(new LLMError(
      'Ollama stream aborted',
      'context_exceeded',
      undefined,
      true,
    ));
  };
  if (abortSignal.aborted) onAbort();
  else abortSignal.addEventListener('abort', onAbort, { once: true });
}

/** Shape of a single Ollama chat-API tool-call frame. */
type OllamaChatToolCallFrame = { function?: { name?: string; arguments?: unknown } };

/** Filter predicate: keep frames that carry a function name. */
function ollamaChatToolCallHasName(tc: OllamaChatToolCallFrame): boolean {
  return Boolean(tc.function?.name);
}

/** Map a raw Ollama chat tool-call frame to the internal ToolCall shape. */
function ollamaChatFrameToToolCall(tc: OllamaChatToolCallFrame): ToolCall {
  let params: Record<string, unknown> = {};
  const args = tc.function!.arguments;
  if (typeof args === 'string') {
    try { params = JSON.parse(args); } catch { /* leave empty */ }
  } else if (args && typeof args === 'object') {
    params = args as Record<string, unknown>;
  }
  return { name: tc.function!.name!, params };
}

/**
 * Per-family Ollama context window (num_ctx). Pure function of the lowercased
 * model name — extracted from chatCall to keep its cognitive complexity within
 * limits (S3776). Mirrors the identical branch chain in call(); the branch order
 * (isGemmaLarge before isGemma) is significant and preserved exactly.
 *
 * Large gemma4 MoE coders (gemma4:26b-a4b-it-qat, gemma4:12b-it-qat) run
 * comfortably at the full 256K window on the 4090 (verified live); the small
 * gemma4:e4b stays at the 131072 ceiling.
 */
function resolveOllamaNumCtx(modelLc: string): number {
  const isGemma = modelLc.startsWith('gemma');
  const isGemmaLarge = isGemma && (modelLc.includes('26b') || modelLc.includes('12b'));
  if (isGemmaLarge) return 262144;
  if (isGemma) return 131072;
  if (modelLc.startsWith('granite')) return 11000;
  if (modelLc.startsWith('gpt-oss')) return 131072;
  if (modelLc.startsWith('apriel')) return 50000;
  if (modelLc.startsWith('ornith')) return 131072;
  return 262141;
}

/**
 * Model-family classification flags derived once from the lowercased model name.
 * Shared by the /api/generate body builders so temperature, context window,
 * sampling profile, and json-format handling all read the same booleans.
 */
type OllamaModelFamily = {
  isQwen: boolean;
  isGemma: boolean;
  isGemmaLarge: boolean;
  isGranite: boolean;
  isGptOss: boolean;
  isApriel: boolean;
  isOrnith: boolean;
  supportsThinking: boolean;
  skipJsonFormat: boolean;
};

/**
 * Classify an Ollama model by family from its lowercased name. Extracted from
 * `call()` verbatim to keep that function's cognitive complexity within limits
 * (S3776) — the flag definitions and their subtleties are unchanged:
 *   - Gemma (`gemma4:e4b`, `gemma3n:e4b`) has a 128K context ceiling and its own
 *     sampling profile.
 *   - Large gemma4 MoE coders (gemma4:26b-a4b-it-qat, gemma4:12b-it-qat) run at
 *     the full 256K window on the 4090; the small gemma4:e4b stays at 131072.
 *   - Granite4.1 is a non-thinking model — Ollama rejects `think: true` for it.
 *   - gpt-oss/apriel/ornith are thinking-mode models that, like qwen/gemma, merge
 *     the response into `thinking` when `format: json` is set, so they skip it.
 *   - apriel (`servicenow-ai/apriel-1.6-15b-thinker:q4_k_m`) is matched by
 *     substring — deliberately `includes`, not `startsWith`.
 */
function resolveOllamaModelFamily(modelLc: string): OllamaModelFamily {
  const isQwen = modelLc.startsWith('qwen');
  const isGemma = modelLc.startsWith('gemma');
  const isGemmaLarge = isGemma && (modelLc.includes('26b') || modelLc.includes('12b'));
  const isGranite = modelLc.startsWith('granite');
  const isGptOss = modelLc.startsWith('gpt-oss');
  const isApriel = modelLc.includes('apriel');
  const isOrnith = modelLc.startsWith('ornith');
  const supportsThinking = !isGranite;
  const skipJsonFormat = isQwen || isGemma || isGptOss || isApriel || isOrnith;
  return {
    isQwen, isGemma, isGemmaLarge, isGranite, isGptOss, isApriel, isOrnith,
    supportsThinking, skipJsonFormat,
  };
}

/**
 * Per-family temperature for /api/generate. Extracted from `call()` (S3776);
 * branch order and values are identical. Qwen thinking models loop at low
 * temperatures; the gemma4 docs mandate a fixed profile at temperature 1 (a
 * prior greedy temperature=0 made gemma4:26b repeat its Phase-7 output ~16x).
 * Non-family callers keep their own temperature.
 */
function resolveOllamaGenerateTemperature(fam: OllamaModelFamily, options: LLMCallOptions): number {
  if (fam.isQwen) return 1;
  if (fam.isGemma) return 1;
  if (fam.isOrnith) return 0.6;
  return options.temperature ?? 0.7;
}

/**
 * Per-family context window (num_ctx) for /api/generate. Extracted from `call()`
 * (S3776) preserving the exact branch order and values — note `isApriel` here is
 * a substring match, so this INTENTIONALLY differs from `resolveOllamaNumCtx`
 * (used by the chat path) which matches apriel by prefix. gemma -> 131072
 * (native max), large gemma4 -> 262144, granite4.1 -> 11000 (RTX 4090 ceiling),
 * gpt-oss -> 131072, apriel -> 50000, ornith -> 131072, default (qwen) -> 262141.
 */
function resolveOllamaGenerateNumCtx(fam: OllamaModelFamily): number {
  if (fam.isGemmaLarge) return 262144;
  if (fam.isGemma) return 131072;
  if (fam.isGranite) return 11000;
  if (fam.isGptOss) return 131072;
  if (fam.isApriel) return 50000;
  if (fam.isOrnith) return 131072;
  return 262141;
}

/**
 * Build the nested `options` block for an /api/generate body. Extracted from
 * `call()` (S3776); the per-family sampling overrides and their spread order are
 * unchanged.
 */
function buildOllamaGenerateRequestOptions(
  fam: OllamaModelFamily,
  temperature: number,
  numCtx: number,
  numPredict: number,
): Record<string, unknown> {
  return {
    temperature,
    num_ctx: numCtx,
    ...(fam.isQwen ? { presence_penalty: 1.5, top_k: 20, top_p: 0.95, min_p: 0, repeat_penalty: 1 } : {}),
    ...(fam.isGemma ? { top_k: 64, top_p: 0.95 } : {}),
    ...(fam.isOrnith ? { top_k: 20, top_p: 0.95, stop: ['<|im_end|>'] } : {}),
    ...(numPredict > 0 ? { num_predict: numPredict } : {}),
  };
}

/**
 * Assemble the complete /api/generate request body. Extracted from `call()`
 * (S3776) so the family/temperature/context/format branching lives in small
 * pure helpers. Behavior is identical to the former inline block:
 *   - `stream` mirrors whether the caller passed an onChunk callback.
 *   - `think: true` is set for every family EXCEPT non-thinking ones (granite).
 *   - `num_predict` (token cap) is off by default; opt in via `options.maxTokens`
 *     or JANUMICODE_LLM_NUM_PREDICT.
 *   - `format: 'json'` is set only when JSON was requested AND the family does
 *     not merge response into `thinking` under format:json (qwen/gemma/gpt-oss/
 *     apriel/ornith skip it and rely on prompt template + response-text parsing).
 */
export function buildOllamaGenerateBody(options: LLMCallOptions, streaming: boolean): Record<string, unknown> {
  const modelLc = options.model.toLowerCase();
  const fam = resolveOllamaModelFamily(modelLc);
  const temperature = resolveOllamaGenerateTemperature(fam, options);
  // Token cap (`num_predict`) — off by default to match the Postman-verified
  // payload. Env opt-in kept for emergencies; pass `options.maxTokens` explicitly
  // when a specific phase legitimately needs to bound long outputs.
  const numPredict = options.maxTokens
    ?? Number.parseInt(process.env.JANUMICODE_LLM_NUM_PREDICT ?? '0', 10);
  const numCtx = resolveOllamaGenerateNumCtx(fam);

  const body: Record<string, unknown> = {
    model: options.model,
    prompt: options.prompt,
    stream: streaming,
    // Qwen3 thinking models loop on their reasoning chain when `think` is unset.
    // All of JanumiCode requires thinking models at every stage EXCEPT
    // non-thinking families (e.g. granite4.1) where Ollama rejects the flag.
    ...(fam.supportsThinking ? { think: true } : {}),
    options: buildOllamaGenerateRequestOptions(fam, temperature, numCtx, numPredict),
  };

  if (options.system) body.system = options.system;
  // Skip format: json for thinking-mode models — when set, Ollama merges the
  // thinking and response into a single `thinking` field with an empty
  // `response`. Instead we rely on the prompt template to request JSON and parse
  // it from the response text.
  if (options.responseFormat === 'json' && !fam.skipJsonFormat) {
    body.format = 'json';
  }
  return body;
}

export class OllamaProvider implements LLMProviderAdapter {
  readonly name = 'ollama';
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434';
  }

  async call(options: LLMCallOptions): Promise<LLMCallResult> {
    assertNotReplayMode(`OllamaProvider.call model=${options.model}`);
    // When tools are present, route through the chat endpoint which supports
    // function-calling. Without tools, keep the legacy /api/generate path so
    // existing callers (Phase 1, Reasoning Review, etc.) are unchanged.
    if (options.tools && options.tools.length > 0) {
      return this.chatCall(options);
    }

    // Stream whenever the LLMCaller passed a chunk callback — that's the signal
    // that the caller wants live output. Non-streaming callers (older tests,
    // provider identity probes) get the original batch behavior. The full
    // per-family request body (temperature, num_ctx, think, sampling profile,
    // json-format carve-out) is assembled by buildOllamaGenerateBody.
    const onChunk = (options as LLMStreamingCallOptions).onChunk;
    const body = buildOllamaGenerateBody(options, !!onChunk);

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

    return this.nonStreamingGenerateCall(url, body, options);
  }

  /**
   * Parse a batched /api/generate response and settle the call promise.
   * Extracted from the former inline `res.on('end')` handler in `call()`
   * (S3776) with identical behavior: HTTP >= 400 rejects via mapHttpError; a
   * parse failure rejects with an 'unknown' LLMError; otherwise it resolves with
   * the same LLMCallResult shape. Buffer concat + JSON.parse stay inside the try
   * so their throws are caught exactly as before.
   */
  private handleGenerateResponse(
    statusCode: number | undefined,
    chunks: Buffer[],
    options: LLMCallOptions,
    resolve: (result: LLMCallResult) => void,
    reject: (reason?: unknown) => void,
  ): void {
    try {
      const raw = Buffer.concat(chunks).toString('utf-8');

      if (statusCode && statusCode >= 400) {
        reject(this.mapHttpError(statusCode, raw));
        return;
      }

      const json = JSON.parse(raw);
      const thinking: string | undefined = json.thinking || undefined;
      const responseText: string = json.response || '';

      // For qwen thinking models without format:json, the JSON is in the
      // response text (possibly wrapped in markdown fences). Extract it.
      const text = responseText || '';

      let parsed: Record<string, unknown> | null = null;
      if (options.responseFormat === 'json') {
        parsed = tryParseJson(text).parsed;
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
  }

  /**
   * Batched (non-streaming) /api/generate request. Extracted from `call()`
   * (S3776); the request wiring (timeout, error mapping, write/end) is
   * unchanged — the `res.on('end')` body now delegates to
   * handleGenerateResponse.
   */
  private nonStreamingGenerateCall(
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
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          this.handleGenerateResponse(res.statusCode, chunks, options, resolve, reject);
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

        let fullResponse = '';
        let fullThinking = '';
        let finalModel = options.model;
        let promptEval: number | null = null;
        let eval_: number | null = null;
        let droppedFrames = 0;
        // Stream diagnostics (gemma4:31b thinking head-truncation investigation,
        // cal-29). Per-call counts + the head of the FIRST thinking frame let us
        // distinguish a capture-side drop (droppedFrames>0) from genuine model
        // output (droppedFrames==0 yet thinking starts mid-thought). Emitted at
        // stream end only when JANUMICODE_OLLAMA_STREAM_DEBUG is set.
        let frameCount = 0;
        let thinkingFrameCount = 0;
        let firstFrameHead: string | null = null;
        let firstThinkingHead: string | null = null;

        // Idle-stall detector (B7). Ollama's thinking-mode streams can
        // legitimately run for minutes, but a stream that hasn't emitted
        // a single frame for STALL_MS is either hung or looping on a
        // silent queue. When it fires we kill the HTTP request; the
        // retry loop in LLMCaller decides whether to try again. Model-aware:
        // Ollama is a LOCAL provider, so this is the generous local stall
        // (900 s) — a ~19 GB dense model's reload + prefill at full context
        // can legitimately emit nothing for >180 s before the first token
        // (cal-29). Sits above the llmCaller no-progress timer (600 s) as a
        // backstop. env JANUMICODE_LLM_STALL_MS overrides. See llmTimeouts.ts.
        const stallMs = resolveLlmTimeouts('ollama', options.model).stallMs;
        let idleTimer: NodeJS.Timeout | null = null;
        const resetIdleTimer = (): void => {
          if (idleTimer) clearTimeout(idleTimer);
          idleTimer = setTimeout(onOllamaStreamIdleStall, stallMs, req, reject, stallMs);
        };
        resetIdleTimer();

        // Ollama streams ND-JSON — one JSON object per line. The decoder uses a
        // StringDecoder so multi-byte UTF-8 chars split across TCP chunks are
        // reassembled (a raw toString('utf-8') replaces the split bytes with
        // U+FFFD, corrupting the text). Lines that still fail to parse are logged
        // via onDrop — never silently swallowed (the prior `catch {}` hid them).
        const ndjson = new NdjsonStreamDecoder((line) => {
          droppedFrames++;
          getLogger().warn('llm', 'Ollama stream dropped an unparseable NDJSON frame (possible truncation)', {
            model: options.model,
            frame_chars: line.length,
            has_replacement_char: line.includes('�'),
            head: line.slice(0, 80),
          });
        });

        const handleFrame = (frame: Record<string, unknown>): void => {
          frameCount++;
          firstFrameHead ??= JSON.stringify(frame).slice(0, 160);
          const response = typeof frame.response === 'string' ? frame.response : '';
          const thinking = typeof frame.thinking === 'string' ? frame.thinking : '';
          if (response.length > 0) {
            fullResponse += response;
            onChunk({ text: response, channel: 'response' });
          }
          if (thinking.length > 0) {
            firstThinkingHead ??= thinking.slice(0, 160);
            thinkingFrameCount++;
            fullThinking += thinking;
            onChunk({ text: thinking, channel: 'thinking' });
          }
          if (typeof frame.model === 'string') finalModel = frame.model;
          if (typeof frame.prompt_eval_count === 'number') promptEval = frame.prompt_eval_count;
          if (typeof frame.eval_count === 'number') eval_ = frame.eval_count;
        };

        res.on('data', (chunk: Buffer) => {
          resetIdleTimer();
          for (const frame of ndjson.push(chunk)) handleFrame(frame);
        });

        res.on('end', () => {
          if (idleTimer) clearTimeout(idleTimer);
          for (const frame of ndjson.flush()) handleFrame(frame);
          if (droppedFrames > 0) {
            getLogger().warn('llm', 'Ollama stream completed with dropped frames', {
              model: options.model, dropped_frames: droppedFrames,
            });
          }
          if (process.env.JANUMICODE_OLLAMA_STREAM_DEBUG) {
            // Diagnostic: if a truncated-thinking capture shows dropped_frames=0,
            // the model genuinely emitted no preamble (not a capture bug). If
            // dropped_frames>0, a frame was lost on our side. first_thinking_head
            // shows exactly where the captured thinking begins.
            getLogger().warn('llm', 'Ollama stream diagnostics', {
              model: options.model,
              frames: frameCount,
              thinking_frames: thinkingFrameCount,
              thinking_chars: fullThinking.length,
              response_chars: fullResponse.length,
              dropped_frames: droppedFrames,
              first_frame_head: firstFrameHead,
              first_thinking_head: firstThinkingHead,
            });
          }
          const text = fullResponse;
          let parsed: Record<string, unknown> | null = null;
          if (options.responseFormat === 'json') {
            parsed = tryParseJson(text).parsed;
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

      // Abort wiring (see wireOllamaStreamAbort). Must run before req.write so
      // an already-aborted signal tears the request down before it is sent.
      wireOllamaStreamAbort(abortSignal, req, reject);

      req.write(JSON.stringify(body));
      req.end();
    });
  }

  /**
   * Tool-calling path via Ollama's chat API. Requires Ollama >= 0.5.0 and
   * a model that supports function calling (e.g. qwen3.5, llama3.1+).
   */
  private chatCall(options: LLMCallOptions): Promise<LLMCallResult> {
    const modelLc = options.model.toLowerCase();
    const isQwen = modelLc.startsWith('qwen');
    const isGemma = modelLc.startsWith('gemma');
    const isOrnith = modelLc.startsWith('ornith');
    const messages: Array<Record<string, unknown>> = [];
    if (options.system) messages.push({ role: 'system', content: options.system });
    messages.push({ role: 'user', content: options.prompt });

    let temperature: number;
    if (isQwen) temperature = 1;
    else if (isGemma) temperature = 1;
    else if (isOrnith) temperature = 0.6;
    else temperature = options.temperature ?? 0.7;

    // Mirrors the per-family num_ctx in call() (see the options block below).
    const numCtx = resolveOllamaNumCtx(modelLc);

    const body: Record<string, unknown> = {
      model: options.model,
      messages,
      stream: false,
      ...(isQwen || isGemma || isOrnith ? { think: true } : {}),
      tools: options.tools!.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.input_schema,
        },
      })),
      options: {
        temperature,
        // Mirrors the per-family num_ctx in callGenerate (single source of
        // truth would be cleaner but the two paths take different option
        // shapes). Keep these in sync when adjusting.
        num_ctx: numCtx,
        ...(isQwen ? { presence_penalty: 1.5, top_k: 20, top_p: 0.95, min_p: 0, repeat_penalty: 1 } : {}),
        ...(isGemma ? { top_k: 64, top_p: 0.95 } : {}),
        ...(isOrnith ? { top_k: 20, top_p: 0.95, stop: ['<|im_end|>'] } : {}),
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
              .filter(ollamaChatToolCallHasName)
              .map(ollamaChatFrameToToolCall);

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
