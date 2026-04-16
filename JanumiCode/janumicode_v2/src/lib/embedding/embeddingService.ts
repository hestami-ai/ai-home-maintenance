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
  /** LLM provider — currently only `ollama` is supported. */
  provider: 'ollama';
  /**
   * Embedding model name. Recommended options (all Ollama-hosted):
   *   - `qwen3-embedding:8b` — default, Qwen-family, aligns with the
   *     primary `qwen3.5:9b` LLM. 4096-dim embeddings.
   *   - `embeddinggemma:300m` — smaller, faster alternative. 768-dim.
   */
  model: string;
  /** Maximum concurrent embedding requests. Default: 1. */
  maxParallel: number;
  /** Ollama base URL. Default: `http://localhost:11434`. */
  ollamaBaseUrl?: string;
  /**
   * Per-request timeout in milliseconds. Default: 30000 (30s). The embedding
   * endpoint can legitimately take 10+ seconds on first-call model load or
   * when Ollama is busy serving a concurrent LLM request. Keeping the timeout
   * permissive avoids the "This operation was aborted" failure cascade seen
   * when a tighter ceiling collides with a shared Ollama instance.
   */
  timeoutMs?: number;
}

interface QueuedJob {
  recordId: string;
  text: string;
}

export class EmbeddingService {
  private readonly queue: QueuedJob[] = [];
  private inFlight = 0;
  private running = false;
  private readonly baseUrl: string;

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
    this.baseUrl = config.ollamaBaseUrl ?? 'http://localhost:11434';
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
    this.queue.push({ recordId: record.id, text });
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

      if (!this.disabled) {
        // Aborts (timeout, caller cancel) are benign and recoverable — the
        // record will get re-embedded the next time the record is modified,
        // or vector search will just skip it. Logging them at WARN spammed
        // the output channel every time Ollama was busy. Log at DEBUG instead.
        const isAbort = err instanceof Error
          && (err.name === 'AbortError' || /aborted/i.test(message));
        if (isAbort) {
          getLogger().debug('embedding', 'Embed call aborted — record will be retried on next update', {
            recordId: job.recordId,
          });
        } else {
          getLogger().warn('embedding', 'Failed to embed record', {
            recordId: job.recordId,
            error: message,
          });
        }
      }
    }
  }

  private async callEmbed(text: string): Promise<Float32Array> {
    // Hard timeout — Ollama's connect can hang indefinitely without one, which
    // breaks both interactive flows and tests. Default 30s accommodates
    // first-call model load and Ollama serving a concurrent LLM request;
    // callers can tighten via config.timeoutMs for synthetic tests.
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.timeoutMs ?? 30_000,
    );
    try {
      const res = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: this.config.model, prompt: text }),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`Ollama embedding HTTP ${res.status}: ${await res.text()}`);
      }
      const json = (await res.json()) as { embedding?: number[] };
      if (!json.embedding || !Array.isArray(json.embedding)) {
        throw new Error('Ollama embedding response missing `embedding` array');
      }
      return new Float32Array(json.embedding);
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Extract a single text payload from a record's content. Returns null for
   * structural records (no text to embed).
   */
  private extractText(record: GovernedStreamRecord): string | null {
    const c = record.content;
    if (typeof c.text === 'string') return c.text;
    if (typeof c.responseText === 'string') return c.responseText;
    if (typeof c.summary === 'string') return c.summary;
    if (typeof c.description === 'string') return c.description;
    if (typeof c.statement === 'string') return c.statement;
    if (typeof c.rationale === 'string') return c.rationale;
    return null;
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
