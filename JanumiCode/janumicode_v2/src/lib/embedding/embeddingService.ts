/**
 * EmbeddingService — async-after-write embedding pipeline.
 *
 * Records are enqueued by GovernedStreamWriter on every successful write.
 * A background worker pulls from the queue and POSTs to the Ollama embeddings
 * endpoint, then persists the resulting Float32Array into the
 * `governed_stream_vec` table for later vector similarity search.
 *
 * Failures are logged but never propagated — the write path stays fast and
 * vector search degrades gracefully when records have not yet been embedded.
 */

import type { Database } from '../database/init';
import type { GovernedStreamRecord } from '../types/records';
import { getLogger } from '../logging';

export interface EmbeddingServiceConfig {
  /**
   * Embedding backend.
   *   - `ollama`   — POSTs `/api/embeddings` with `{model, prompt}`
   *                  and parses Ollama's `{embedding: [...]}` shape.
   *   - `llamacpp` — POSTs `/v1/embeddings` with `{model, input}` and
   *                  parses OpenAI's `{data: [{embedding}]}` shape.
   *                  Used when llama-swap is the unified backend so
   *                  the embedding model lives on the same proxy as
   *                  the chat models — no Ollama process needed.
   */
  provider: 'ollama' | 'llamacpp';
  /**
   * Embedding model name. Recommended options:
   *   - `qwen3-embedding:8b` — default Ollama tag.
   *   - `qwen3-embedding-8b` — llama-swap key (no colon).
   *   - `embeddinggemma:300m` — smaller, faster alternative (Ollama).
   */
  model: string;
  /** Maximum concurrent embedding requests. Default: 1. */
  maxParallel: number;
  /**
   * Ollama base URL — kept for backward compat. When provider is
   * `llamacpp`, prefer `baseUrl` (which falls back to this if unset).
   */
  ollamaBaseUrl?: string;
  /**
   * Generic backend base URL. Used by both providers when set; takes
   * precedence over `ollamaBaseUrl`. For llamacpp, this is the
   * llama-swap proxy port (typically `http://127.0.0.1:11435`).
   */
  baseUrl?: string;
  /**
   * Per-request timeout in milliseconds. Default 180_000 (180s) — aligned
   * with LLMCaller's `JANUMICODE_LLM_MAX_CALL_SECONDS` (180s default).
   *
   * Background: 30s was the original default, predating the LLMCaller's
   * timeout architecture. On single-GPU systems where Ollama swaps models
   * between the workflow's primary model (e.g. qwen3.5:9b) and the
   * embedding model (e.g. qwen3-embedding:8b), a model-swap + cold load
   * can exceed 30s, aborting the embed call. Combined with no-retry,
   * those records were silently dropped. Aligning with LLMCaller's
   * tolerance gives model swaps room to complete.
   *
   * Override via `JANUMICODE_EMBED_TIMEOUT_SECONDS` env var.
   */
  timeoutMs?: number;
  /**
   * Maximum re-enqueue attempts on transient errors (abort / timeout).
   * Default 3 — matches LLMCaller's `maxRetries`. Records the embedder
   * fails to embed are re-enqueued with exponential backoff (1s, 4s, 16s).
   * Aborts on the final attempt are logged at WARN.
   *
   * Override via `JANUMICODE_EMBED_MAX_RETRIES` env var.
   */
  maxRetries?: number;
}

interface QueuedJob {
  recordId: string;
  text: string;
  /** 0-based attempt count. Each transient failure re-enqueues with attempt+1. */
  attempt: number;
}

/**
 * Timeout + retry defaults, aligned with LLMCaller's timeout architecture.
 * Both env-overridable so operators can dial without code changes.
 *
 * `JANUMICODE_EMBED_TIMEOUT_SECONDS`  — per-call wall-clock budget
 * `JANUMICODE_EMBED_MAX_RETRIES`      — re-enqueue attempts on transient abort
 */
const DEFAULT_TIMEOUT_MS = Number.parseInt(
  process.env.JANUMICODE_EMBED_TIMEOUT_SECONDS ?? '180', 10) * 1000;
const DEFAULT_MAX_RETRIES = Number.parseInt(
  process.env.JANUMICODE_EMBED_MAX_RETRIES ?? '3', 10);

/** Exponential backoff in ms between retry attempts. */
const RETRY_BACKOFF_MS = [1_000, 4_000, 16_000];

export class EmbeddingService {
  private readonly queue: QueuedJob[] = [];
  private inFlight = 0;
  private running = false;
  private readonly baseUrl: string;
  private readonly maxRetries: number;

  /**
   * Circuit-breaker state. If the embedding backend returns a hard error
   * (model not found, auth failure, etc.) we log the failure ONCE with
   * clear remediation instructions and then silently skip subsequent
   * records so we don't flood the output channel with identical warnings.
   * `softFailures` counts errors while the circuit is open; we log a
   * periodic summary every 100 dropped records.
   */
  private disabled = false;
  private disabledReason = '';
  private softFailures = 0;

  constructor(
    private readonly db: Database,
    private readonly config: EmbeddingServiceConfig,
  ) {
    // Generic baseUrl wins over ollama-specific config; legacy field
    // kept so existing callers don't break.
    this.baseUrl = config.baseUrl ?? config.ollamaBaseUrl ?? 'http://localhost:11434';
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
  }

  start(): void {
    this.running = true;
    this.tick();
  }

  stop(): void {
    this.running = false;
  }

  /**
   * Enqueue a record for background embedding.
   * Returns immediately. Records without text-bearing content are skipped.
   * If the circuit breaker has tripped, also skip — the user has been told
   * how to fix it, there's nothing more to do here.
   */
  enqueue(record: GovernedStreamRecord): void {
    if (this.disabled) {
      this.softFailures++;
      if (this.softFailures % 100 === 0) {
        getLogger().warn('embedding', 'Embedding service disabled — records not being embedded', {
          reason: this.disabledReason,
          droppedRecordsSinceDisable: this.softFailures,
        });
      }
      return;
    }
    const text = this.extractText(record);
    if (!text) return;
    this.queue.push({ recordId: record.id, text, attempt: 0 });
    this.tick();
  }

  /**
   * Embed an arbitrary query string for vector search at retrieval time.
   * This call is NOT queued — it runs immediately so the retriever can use
   * the result. Callers should already be inside a priority lane.
   *
   * Respects the circuit breaker: if the backend has been declared
   * unreachable, throws fast instead of hanging on a fresh HTTP request.
   * Callers should catch and degrade gracefully.
   */
  async embedQuery(text: string): Promise<Float32Array> {
    if (this.disabled) {
      throw new Error(`Embedding backend disabled: ${this.disabledReason}`);
    }
    try {
      return await this.callEmbed(text);
    } catch (err) {
      // Trip the breaker only on genuinely permanent failures — missing
      // model, connection refused. Aborts (timeout, caller cancel) are
      // transient: they routinely fire when Ollama is busy serving a
      // concurrent LLM request, and permanently disabling vector search
      // on the first one was pernicious. Let the caller retry.
      const msg = err instanceof Error ? err.message : String(err);
      const isHard = /ECONNREFUSED|fetch failed|\bmodel\b.*\bnot found\b/i.test(msg);
      if (isHard) {
        this.disabled = true;
        this.disabledReason = msg;
      }
      throw err;
    }
  }

  private tick(): void {
    while (
      this.running &&
      this.inFlight < this.config.maxParallel &&
      this.queue.length > 0
    ) {
      const job = this.queue.shift()!;
      this.inFlight++;
      this.process(job)
        .catch(() => {/* errors logged inside process */})
        .finally(() => {
          this.inFlight--;
          this.tick();
        });
    }
  }

  private async process(job: QueuedJob): Promise<void> {
    try {
      const vec = await this.callEmbed(job.text);
      const buf = Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength);
      this.db
        .prepare(
          `INSERT OR REPLACE INTO governed_stream_vec
             (record_id, embedding, embedding_model, embedded_at)
           VALUES (?, ?, ?, ?)`,
        )
        .run(job.recordId, buf, this.config.model, new Date().toISOString());
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      // Circuit breaker: trip on hard backend errors that will obviously
      // recur for every record (model missing, auth failure, Ollama not
      // reachable). Log a ONE-TIME warning with remediation, then silence
      // per-record failures until the service is recreated.
      const isModelMissing = /\bmodel\b.*\bnot found\b|try pulling it first/i.test(message);
      const isConnectionRefused = /ECONNREFUSED|fetch failed|connect ENOENT/i.test(message);
      const isHardFailure = isModelMissing || isConnectionRefused;

      if (isHardFailure && !this.disabled) {
        this.disabled = true;
        this.disabledReason = message;
        if (isModelMissing) {
          getLogger().warn(
            'embedding',
            `Embedding model "${this.config.model}" is not available in Ollama. ` +
              `Vector search will be disabled until you pull the model. Remediation: run ` +
              `\`ollama pull ${this.config.model}\` in a terminal, then reload the window.`,
            { recordId: job.recordId },
          );
        } else {
          getLogger().warn(
            'embedding',
            'Embedding backend unreachable. Vector search will be disabled until Ollama is running. ' +
              `Remediation: start Ollama (\`ollama serve\`) and reload the window.`,
            { recordId: job.recordId, error: message },
          );
        }
        // Drop anything still queued so we don't hammer the backend.
        this.softFailures += this.queue.length;
        this.queue.length = 0;
        return;
      }

      // Non-hard failures (transient aborts, generic errors) are handled
      // out-of-line to keep this method's control flow shallow. Skip when
      // the circuit breaker has already tripped — the user has been notified.
      if (!this.disabled) {
        this.handleTransientFailure(job, err, message);
      }
    }
  }

  /**
   * Log / retry a non-hard embedding failure. Extracted verbatim from
   * `process` so the primary path stays shallow.
   *
   * Retry transient aborts (model-swap latency, brief Ollama contention)
   * by re-enqueueing with exponential backoff. Records were previously
   * dropped silently after a single 30s abort — see thin-slice-8 postmortem
   * where ~80% of records went unembedded.
   */
  private handleTransientFailure(job: QueuedJob, err: unknown, message: string): void {
    const isAbort = err instanceof Error
      && (err.name === 'AbortError' || /aborted/i.test(message));

    if (isAbort && job.attempt < this.maxRetries) {
      const backoff = RETRY_BACKOFF_MS[Math.min(job.attempt, RETRY_BACKOFF_MS.length - 1)];
      getLogger().warn('embedding', 'Embed call aborted — re-enqueueing with backoff', {
        recordId: job.recordId,
        attempt: job.attempt + 1,
        maxRetries: this.maxRetries,
        backoffMs: backoff,
      });
      setTimeout(() => {
        // Honor stop() / circuit breaker if either fired during backoff.
        if (!this.running || this.disabled) return;
        this.queue.push({ ...job, attempt: job.attempt + 1 });
        this.tick();
      }, backoff).unref?.();
    } else if (isAbort) {
      getLogger().warn('embedding', 'Embed call aborted on final attempt — record will not be embedded', {
        recordId: job.recordId,
        attempts: job.attempt + 1,
      });
    } else {
      getLogger().warn('embedding', 'Failed to embed record', {
        recordId: job.recordId,
        error: message,
        attempt: job.attempt + 1,
      });
    }
  }

  private async callEmbed(text: string): Promise<Float32Array> {
    // Wall-clock timeout — mirrors LLMCaller's JANUMICODE_LLM_MAX_CALL_SECONDS
    // architecture. Default 180s accommodates Ollama model-swap latency
    // (qwen3.5:9b ↔ qwen3-embedding:8b can take 30-60s of cold-load when
    // VRAM is tight). Tests can override via config.timeoutMs.
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );
    try {
      // Branch on provider — llamacpp uses OpenAI's /v1/embeddings
      // shape, ollama uses /api/embeddings. Each shapes its request +
      // parses the response slightly differently.
      const vec = this.config.provider === 'llamacpp'
        ? await this.embedViaLlamacpp(text, controller.signal)
        : await this.embedViaOllama(text, controller.signal);
      return vec;
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Ollama: POST /api/embeddings → `{embedding: [...]}` */
  private async embedViaOllama(text: string, signal: AbortSignal): Promise<Float32Array> {
    const res = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: this.config.model, prompt: text }),
      signal,
    });
    if (!res.ok) {
      throw new Error(`Ollama embedding HTTP ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as { embedding?: number[] };
    if (!json.embedding || !Array.isArray(json.embedding)) {
      throw new Error('Ollama embedding response missing `embedding` array');
    }
    return new Float32Array(json.embedding);
  }

  /**
   * llama.cpp: POST /v1/embeddings → OpenAI standard
   *   `{data: [{embedding: [...], index: 0}], usage: {...}}`.
   *
   * Single-input form: pass `input: text` (string). llama-server
   * tolerates string-or-array; using string keeps the existing
   * single-text-per-call shape this service was designed around.
   */
  private async embedViaLlamacpp(text: string, signal: AbortSignal): Promise<Float32Array> {
    const res = await fetch(`${this.baseUrl}/v1/embeddings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: this.config.model, input: text }),
      signal,
    });
    if (!res.ok) {
      throw new Error(`llamacpp embedding HTTP ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as {
      data?: Array<{ embedding?: number[] }>;
    };
    const emb = json.data?.[0]?.embedding;
    if (!emb || !Array.isArray(emb)) {
      throw new Error('llamacpp embedding response missing `data[0].embedding`');
    }
    return new Float32Array(emb);
  }

  private extractText(record: GovernedStreamRecord): string | null {
    return extractEmbeddingText(record);
  }
}

/**
 * Extract a text payload from a record's content for embedding.
 *
 * Excludes pure-plumbing records (json_repair_record, file_system_write_record,
 * mirror/decision-bundle presented, execution-wave timing markers,
 * workflow_run_closure). Reasoning-trail records are NOT excluded — they
 * carry the agent reasoning trail used for intent-fidelity / drift detection.
 *
 * For included records, walks content recursively and concatenates every
 * scalar string field, stripping noisy metadata keys (IDs, timestamps,
 * model/tool config). Truncates at MAX_TEXT_CHARS to bound embedding cost.
 *
 * Returns null when the record type is skipped or no extractable text remains.
 *
 * Exported for unit-testability; production callers use the EmbeddingService
 * instance, which delegates here.
 */
export function extractEmbeddingText(record: GovernedStreamRecord): string | null {
  if (SKIPPED_RECORD_TYPES.has(record.record_type)) return null;
  const parts: string[] = [];
  collectStrings(record.content, parts, 0);
  if (parts.length === 0) return null;
  const joined = parts.join('\n');
  return joined.length > MAX_TEXT_CHARS ? joined.slice(0, MAX_TEXT_CHARS) : joined;
}

const MAX_TEXT_CHARS = 8000;
const MAX_TEXT_DEPTH = 6;

// Pure-plumbing record types skipped at embedding time — they carry no
// semantic content (timing markers, error envelopes, presentation echoes).
// Reasoning-trail records (agent_invocation, agent_output,
// agent_reasoning_step, reasoning_review_*) ARE embedded; the Governed
// Stream is lossless per spec §1.5 CI-10 and DMR's intent-fidelity /
// drift-detection use cases need them searchable. DMR down-weights them
// in materiality scoring rather than excluding them from retrieval.
const SKIPPED_RECORD_TYPES = new Set<string>([
  'json_repair_record',
  'file_system_write_record',
  'mirror_presented',
  'decision_bundle_presented',
  'execution_wave_started',
  'execution_wave_completed',
  'workflow_run_closure',
]);

// Content keys that are pure metadata; their string values pollute the
// embedding text but carry no semantic signal worth retrieving on.
const NOISY_KEYS = new Set<string>([
  'id', 'record_id', 'node_id', 'invariant_id', 'harness_id',
  'parent_node_id', 'target_record_id', 'source_record_id',
  'workflow_run_id', 'phase_id', 'sub_phase_id', 'janumicode_version_sha',
  'started_at', 'produced_at', 'effective_at', 'embedded_at', 'superseded_at',
  'duration_ms', 'input_tokens', 'output_tokens', 'tool_call_count',
  'retry_attempts', 'used_fallback', 'response_format', 'tool_count',
  'provider', 'model', 'temperature', 'max_tokens', 'tools', 'system',
  'auto_approved', 'auto_approved_by', 'attribution',
]);

function collectStrings(value: unknown, out: string[], depth: number): void {
  if (depth > MAX_TEXT_DEPTH) return;
  if (typeof value === 'string') {
    const s = value.trim();
    if (s.length >= 2 && s.length <= 4000) out.push(s);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out, depth + 1);
    return;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (NOISY_KEYS.has(k)) continue;
      collectStrings(v, out, depth + 1);
    }
  }
}

/** Cosine similarity between two equal-length Float32Arrays. */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
