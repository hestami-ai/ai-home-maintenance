/**
 * Wave 6 dedup — embedding client used to flag near-duplicate assumption
 * entries via cosine similarity. The implementation is deliberately
 * minimal (no retry, no streaming, no batch-splitting) because it runs
 * inside the saturation loop and adds to per-pass latency. Callers should
 * treat failures as "skip dedup for this pass, raw delta is the fallback
 * signal."
 *
 * Default provider: local ollama on `qwen3-embedding:8b` (32K-context
 * embedding model, 4096-dim output). Override via env:
 *   JANUMICODE_EMBEDDING_URL    — ollama base URL (default 127.0.0.1:11434)
 *   JANUMICODE_EMBEDDING_MODEL  — model id (default qwen3-embedding:8b)
 */
/* eslint-disable @typescript-eslint/no-require-imports */

import * as http from 'node:http';
import * as https from 'node:https';

export interface EmbeddingClient {
  /**
   * Compute embeddings for one or more input strings. Returns a
   * parallel array of embedding vectors (float32-equivalent numbers).
   */
  embed(inputs: string[], options?: { signal?: AbortSignal }): Promise<number[][]>;
}

export class OllamaEmbeddingClient implements EmbeddingClient {
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(opts?: { baseUrl?: string; model?: string }) {
    this.baseUrl = opts?.baseUrl
      ?? process.env.JANUMICODE_EMBEDDING_URL
      ?? process.env.OLLAMA_URL
      ?? 'http://127.0.0.1:11434';
    this.model = opts?.model
      ?? process.env.JANUMICODE_EMBEDDING_MODEL
      ?? 'qwen3-embedding:8b';
  }

  async embed(inputs: string[], options?: { signal?: AbortSignal }): Promise<number[][]> {
    if (inputs.length === 0) return [];
    const body = JSON.stringify({ model: this.model, input: inputs });
    const url = new URL('/api/embed', this.baseUrl);
    const client = url.protocol === 'https:' ? https : http;
    // Connection + idle timeouts. The request fails fast when ollama
    // isn't reachable (unit-test envs, misconfigured ops, etc.) so the
    // dedup path can degrade cleanly to no-dedup rather than blocking
    // the saturation loop. Configurable; defaults are generous enough
    // for a cold 8B-embedding model on a local box.
    const connectTimeoutMs = Number.parseInt(
      process.env.JANUMICODE_EMBEDDING_CONNECT_TIMEOUT_MS ?? '2000', 10);
    const idleTimeoutMs = Number.parseInt(
      process.env.JANUMICODE_EMBEDDING_IDLE_TIMEOUT_MS ?? '60000', 10);
    return new Promise<number[][]>((resolve, reject) => {
      const req = client.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: idleTimeoutMs,
      }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          try {
            const raw = Buffer.concat(chunks).toString('utf-8');
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`ollama /api/embed HTTP ${res.statusCode}: ${raw.slice(0, 300)}`));
              return;
            }
            const parsed = JSON.parse(raw) as { embeddings?: number[][] };
            if (!Array.isArray(parsed.embeddings)) {
              reject(new Error(`ollama /api/embed unexpected response: ${raw.slice(0, 300)}`));
              return;
            }
            resolve(parsed.embeddings);
          } catch (err) {
            reject(err instanceof Error ? err : new Error(String(err)));
          }
        });
      });
      // Separate connection-establishment timer. Node's built-in
      // `timeout` option measures socket idle, not connect — a server
      // that accepts TCP but never responds would hang the full idle
      // window. A dedicated timer gives us fast-fail on unreachable.
      const connectTimer = setTimeout(() => {
        req.destroy(new Error(`embed connect timeout after ${connectTimeoutMs}ms`));
      }, connectTimeoutMs);
      req.on('socket', (socket) => {
        socket.once('connect', () => clearTimeout(connectTimer));
      });
      req.on('error', (err) => {
        clearTimeout(connectTimer);
        reject(err);
      });
      req.on('timeout', () => {
        req.destroy(new Error(`embed idle timeout after ${idleTimeoutMs}ms`));
      });
      if (options?.signal) {
        const onAbort = () => {
          clearTimeout(connectTimer);
          req.destroy(new Error('aborted'));
        };
        if (options.signal.aborted) onAbort();
        else options.signal.addEventListener('abort', onAbort, { once: true });
      }
      req.write(body);
      req.end();
    });
  }
}

// ── Similarity math ────────────────────────────────────────────────

/**
 * Cosine similarity between two vectors. Returns NaN on mismatched
 * dimensions or zero-norm vectors — caller should treat NaN as
 * "cannot compare" (i.e., don't flag as duplicate).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return Number.NaN;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return Number.NaN;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Find the most-similar prior entry (above threshold). Returns null if
 * no prior vector exceeds the threshold. Uses a linear scan — fine for
 * typical assumption-set sizes (up to a few thousand); consider an
 * ANN index if the set grows much larger.
 */
export function findNearestAbove(
  candidate: number[],
  priors: Array<{ id: string; vector: number[] }>,
  threshold: number,
): { id: string; similarity: number } | null {
  let bestId: string | null = null;
  let bestSim = -Infinity;
  for (const p of priors) {
    const s = cosineSimilarity(candidate, p.vector);
    if (Number.isFinite(s) && s > bestSim) {
      bestSim = s;
      bestId = p.id;
    }
  }
  if (bestId == null || bestSim < threshold) return null;
  return { id: bestId, similarity: bestSim };
}
