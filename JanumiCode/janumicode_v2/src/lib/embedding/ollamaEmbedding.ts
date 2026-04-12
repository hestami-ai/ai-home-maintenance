/**
 * Ollama Embedding Provider — local embedding via Ollama API.
 * Based on JanumiCode Spec v2.3, §11 (governed_stream_vec).
 *
 * Uses /api/embed endpoint for batch embedding.
 * Initially for dev/testing; Voyage AI for production (Wave 7+).
 */

import * as http from 'node:http';

// ── Types ───────────────────────────────────────────────────────────

export interface EmbeddingResult {
  embeddings: number[][];
  model: string;
  totalDuration: number;
}

export interface EmbeddingProviderConfig {
  baseUrl: string;
  model: string;
  dimensions?: number;
}

// ── OllamaEmbeddingProvider ─────────────────────────────────────────

export class OllamaEmbeddingProvider {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly dimensions: number;

  constructor(config?: Partial<EmbeddingProviderConfig>) {
    this.baseUrl = config?.baseUrl ?? process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434';
    // Default: qwen3-embedding:8b — matches the Qwen-family LLM used for
    // inference. Alternative: embeddinggemma:300m (smaller, 768-dim).
    this.model = config?.model ?? 'qwen3-embedding:8b';
    this.dimensions = config?.dimensions ?? 4096;
  }

  /**
   * Generate embeddings for one or more texts.
   */
  async embed(texts: string[]): Promise<EmbeddingResult> {
    const body = {
      model: this.model,
      input: texts,
    };

    return new Promise<EmbeddingResult>((resolve, reject) => {
      const url = new URL('/api/embed', this.baseUrl);

      const req = http.request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          try {
            const raw = Buffer.concat(chunks).toString('utf-8');
            const json = JSON.parse(raw);

            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`Ollama embed error (${res.statusCode}): ${raw}`));
              return;
            }

            const embeddings = (json.embeddings ?? []) as number[][];

            // Truncate/pad to target dimensions if needed
            const normalized = embeddings.map(emb => this.normalizeDimensions(emb));

            resolve({
              embeddings: normalized,
              model: json.model ?? this.model,
              totalDuration: json.total_duration ?? 0,
            });
          } catch (err) {
            reject(new Error(`Failed to parse Ollama embed response: ${err}`));
          }
        });
      });

      req.setTimeout(60_000, () => {
        req.destroy();
        reject(new Error('Ollama embed request timed out'));
      });

      req.on('error', (err) => {
        reject(new Error(`Ollama embed connection error: ${err.message}`));
      });

      req.write(JSON.stringify(body));
      req.end();
    });
  }

  /**
   * Embed a single text.
   */
  async embedSingle(text: string): Promise<number[]> {
    const result = await this.embed([text]);
    return result.embeddings[0] ?? new Array(this.dimensions).fill(0);
  }

  /**
   * Check if the embedding model is available.
   */
  async isAvailable(): Promise<boolean> {
    try {
      const result = await this.embed(['test']);
      return result.embeddings.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Normalize embedding to target dimensions.
   */
  private normalizeDimensions(embedding: number[]): number[] {
    if (embedding.length === this.dimensions) return embedding;
    if (embedding.length > this.dimensions) return embedding.slice(0, this.dimensions);
    // Pad with zeros
    return [...embedding, ...new Array(this.dimensions - embedding.length).fill(0)];
  }

  get targetDimensions(): number {
    return this.dimensions;
  }

  get modelName(): string {
    return this.model;
  }
}
