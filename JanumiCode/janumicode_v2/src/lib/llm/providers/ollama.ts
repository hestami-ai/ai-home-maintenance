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
import { parseJsonWithRecovery } from '../jsonRecovery';
import { resolveLlmTimeouts } from '../llmTimeouts';
import { getLogger } from '../../logging/logger';

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

    const modelLc = options.model.toLowerCase();
    const isQwen = modelLc.startsWith('qwen');
    // Gemma (e.g. `gemma4:e4b`, `gemma3n:e4b`) has a 128K context
    // ceiling and its own sampling profile. Applied here rather than
    // in a routing-level override so any caller that points at a gemma
    // model gets the right defaults automatically.
    const isGemma = modelLc.startsWith('gemma');
    // Large gemma4 MoE coders (gemma4:26b-a4b-it-qat, gemma4:12b-it-qat) run
    // comfortably at the full 256K window on the 4090 (verified live); the small
    // gemma4:e4b stays at the 131072 ceiling below.
    const isGemmaLarge = isGemma && (modelLc.includes('26b') || modelLc.includes('12b'));
    // Granite4.1 (`granite4.1:30b-q4_K_M`) is a non-thinking model.
    // Ollama rejects `think: true` for non-thinking families with
    // `"<model>" does not support thinking`. Skip the flag.
    const isGranite = modelLc.startsWith('granite');
    // gpt-oss is a thinking-mode model that, like qwen/gemma, merges
    // the response into the `thinking` field when `format: json` is
    // set on /api/generate — so we apply the same json-format carve-out
    // and parse JSON from the response text instead.
    const isGptOss = modelLc.startsWith('gpt-oss');
    // Apriel (e.g. `servicenow-ai/apriel-1.6-15b-thinker:q4_k_m`) is a
    // thinking-mode model. Treat like gpt-oss for json-format handling.
    // Practical context ceiling on the RTX 4090 is 50K.
    const isApriel = modelLc.includes('apriel');
    // ornith (e.g. `ornith:35b-q4_K_M`) is a qwen3.5-based thinking model
    // evaluated as an alternative harness backing model. Operator-specified
    // sampling profile: num_ctx 131072, temperature 0.6, top_k 20, top_p 0.95,
    // stop `<|im_end|>`. Treated like qwen for the json-format carve-out (it
    // merges the response into `thinking` when `format: json` is set).
    const isOrnith = modelLc.startsWith('ornith');
    const supportsThinking = !isGranite;
    const skipJsonFormat = isQwen || isGemma || isGptOss || isApriel || isOrnith;
    const onChunk = (options as LLMStreamingCallOptions).onChunk;

    // Model-family temperature overrides. Qwen thinking models loop at
    // low temperatures (see big comment in the original impl). The gemma4 docs
    // mandate a FIXED sampling profile — temperature=1, top_k=64, top_p=0.95 —
    // for ALL gemma calls. A prior hardcoded `temperature = 0` (greedy) here
    // made gemma4:26b repeat its Phase-7 test-case output ~16× until the 1.5 MB
    // log cap fired, while the SAME prompt at temperature=1 (verified directly
    // via Ollama) completed cleanly. So gemma is pinned to 1 (top_k/top_p set
    // in the options block below) — never greedy. Non-family callers keep their
    // own temperature.
    let temperature: number;
    if (isQwen) temperature = 1;
    else if (isGemma) temperature = 1;
    else if (isOrnith) temperature = 0.6;
    else temperature = options.temperature ?? 0.7;

    // Token cap (`num_predict`) — off by default to match the
    // Postman-verified payload that works reliably. The original
    // reason we set it was to bound the qwen3 thinking spiral, but
    // the real cause of that spiral was a temperature mismatch (see
    // temperature comment above). With correct temperature + the
    // size-cap + idle-stall timer, we don't need a
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
      // NOTA BENE: All of JanumiCode requires thinking / reasoning models at every stage,
      // EXCEPT non-thinking families (e.g. granite4.1) where Ollama rejects the flag.
      ...(supportsThinking ? { think: true } : {}),
      options: {
        temperature,
        // Per-family context windows: gemma → 131072 (native max; was
        // 128000 which rounded down ~3K tokens of usable window),
        // granite4.1 → 11K (practical ceiling for granite4.1:30b on an
        // RTX 4090 — the model+hardware combo can't address more;
        // Ollama would otherwise truncate silently), gpt-oss → 131072
        // (also native max; same rounding fix as gemma), apriel → 50K
        // (RTX 4090 ceiling for apriel-1.6:15b), default (qwen) → 262K.
        num_ctx: isGemmaLarge ? 262144 : isGemma ? 131072 : isGranite ? 11000 : isGptOss ? 131072 : isApriel ? 50000 : isOrnith ? 131072 : 262141,
        ...(isQwen ? { presence_penalty: 1.5, top_k: 20, top_p: 0.95, min_p: 0, repeat_penalty: 1 } : {}),
        ...(isGemma ? { top_k: 64, top_p: 0.95 } : {}),
        ...(isOrnith ? { top_k: 20, top_p: 0.95, stop: ['<|im_end|>'] } : {}),
        ...(numPredict > 0 ? { num_predict: numPredict } : {}),
      },
    };

    if (options.system) body.system = options.system;
    // Skip format: json for thinking-mode models (qwen, gemma) — when
    // set, Ollama merges the thinking and response into a single
    // `thinking` field with an empty `response`, losing the ability to
    // judge both the reasoning chain and the output. Instead we rely
    // on the prompt template to request JSON and parse it from the
    // response text.
    if (options.responseFormat === 'json' && !skipJsonFormat) {
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
          if (firstFrameHead === null) firstFrameHead = JSON.stringify(frame).slice(0, 160);
          const response = typeof frame.response === 'string' ? frame.response : '';
          const thinking = typeof frame.thinking === 'string' ? frame.thinking : '';
          if (response.length > 0) {
            fullResponse += response;
            onChunk({ text: response, channel: 'response' });
          }
          if (thinking.length > 0) {
            if (firstThinkingHead === null) firstThinkingHead = thinking.slice(0, 160);
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

      // Abort wiring: LLMCaller trips this signal for size-cap,
      // tiny-chunk flailing, or session abort. Kill the in-flight
      // request; LLMCaller decides retryability based on its own
      // abortReason (it overrides this error on the way out).
      if (abortSignal) {
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
    // Large gemma4 MoE coders (gemma4:26b-a4b-it-qat, gemma4:12b-it-qat) run
    // comfortably at the full 256K window on the 4090 (verified live); the small
    // gemma4:e4b stays at the 131072 ceiling below.
    const isGemmaLarge = isGemma && (modelLc.includes('26b') || modelLc.includes('12b'));
    const isGptOss = modelLc.startsWith('gpt-oss');
    const isGranite = modelLc.startsWith('granite');
    const isApriel = modelLc.startsWith('apriel');
    const isOrnith = modelLc.startsWith('ornith');
    const messages: Array<Record<string, unknown>> = [];
    if (options.system) messages.push({ role: 'system', content: options.system });
    messages.push({ role: 'user', content: options.prompt });

    let temperature: number;
    if (isQwen) temperature = 1;
    else if (isGemma) temperature = 1;
    else if (isOrnith) temperature = 0.6;
    else temperature = options.temperature ?? 0.7;

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
        num_ctx: isGemmaLarge ? 262144 : isGemma ? 131072 : isGranite ? 11000 : isGptOss ? 131072 : isApriel ? 50000 : isOrnith ? 131072 : 262141,
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
