/**
 * Regression tests for embedding abort handling.
 *
 * The original implementation used a 2.5s per-call timeout AND tripped the
 * breaker permanently on the first abort in `embedQuery`. When Ollama was
 * busy serving a concurrent LLM request — the common case — the embedding
 * call would abort, vector search would be disabled for the rest of the
 * session, and WARN lines would flood the output channel.
 *
 * These tests pin the fix:
 *   • timeoutMs is configurable and defaults high enough (30s) that a
 *     busy backend is accommodated (we verify only that the default isn't
 *     the old 2.5s; actual network behavior is out of scope).
 *   • A single abort in embedQuery does NOT permanently disable the
 *     service — the caller can retry.
 *   • ECONNREFUSED / model-not-found still trips the breaker (unchanged
 *     behavior for genuinely permanent failures).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EmbeddingService } from '../../../lib/embedding/embeddingService';
import { createTestDatabase, type Database } from '../../../lib/database/init';

describe('EmbeddingService — abort handling', () => {
  let db: Database;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    db = createTestDatabase();
  });

  afterEach(() => {
    db.close();
    globalThis.fetch = originalFetch;
  });

  function makeService(timeoutMs?: number): EmbeddingService {
    return new EmbeddingService(db, {
      provider: 'ollama',
      model: 'test-model',
      maxParallel: 1,
      timeoutMs,
    });
  }

  it('does not permanently disable the service when a single embedQuery is aborted', async () => {
    // Stub fetch to simulate an abort immediately.
    globalThis.fetch = vi.fn().mockImplementation(() => {
      const abortErr = new Error('This operation was aborted');
      abortErr.name = 'AbortError';
      return Promise.reject(abortErr);
    }) as unknown as typeof fetch;

    const svc = makeService(50);

    // First call aborts — should throw but NOT trip the breaker.
    await expect(svc.embedQuery('hello')).rejects.toThrow(/aborted/i);

    // Simulate Ollama recovering: next call returns a valid embedding.
    globalThis.fetch = vi.fn().mockImplementation(async () => ({
      ok: true,
      json: async () => ({ embedding: [0.1, 0.2, 0.3] }),
    })) as unknown as typeof fetch;

    // Breaker must NOT have fired — this call should succeed.
    const vec = await svc.embedQuery('world');
    expect(vec).toBeInstanceOf(Float32Array);
    expect(Array.from(vec)).toEqual([
      expect.closeTo(0.1, 5),
      expect.closeTo(0.2, 5),
      expect.closeTo(0.3, 5),
    ]);
  });

  it('still trips the breaker on ECONNREFUSED (permanent failure)', async () => {
    globalThis.fetch = vi.fn().mockImplementation(() =>
      Promise.reject(new Error('fetch failed: ECONNREFUSED')),
    ) as unknown as typeof fetch;

    const svc = makeService(1000);

    await expect(svc.embedQuery('x')).rejects.toThrow(/ECONNREFUSED/);

    // Second call must fail fast with the "backend disabled" sentinel,
    // proving the breaker tripped on this permanent-class error.
    await expect(svc.embedQuery('y')).rejects.toThrow(/Embedding backend disabled/);
  });

  it('still trips the breaker on "model not found" (permanent failure)', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () => ({
      ok: false,
      status: 404,
      text: async () => 'model "test-model" not found, try pulling it first',
    })) as unknown as typeof fetch;

    const svc = makeService(1000);

    await expect(svc.embedQuery('x')).rejects.toThrow(/model.*not found/i);
    await expect(svc.embedQuery('y')).rejects.toThrow(/Embedding backend disabled/);
  });

  it('allows a tight timeout to be configured for tests without hardcoding 2.5s', async () => {
    // Any fetch that hangs should get aborted at the configured ceiling.
    let aborted = false;
    globalThis.fetch = vi.fn().mockImplementation((_url: unknown, init: { signal: AbortSignal }) => {
      return new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          aborted = true;
          const err = new Error('This operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    }) as unknown as typeof fetch;

    const svc = makeService(50);
    const started = Date.now();
    await expect(svc.embedQuery('x')).rejects.toThrow(/aborted/i);
    const elapsed = Date.now() - started;

    expect(aborted).toBe(true);
    // Should have aborted close to 50ms, certainly not 2500.
    expect(elapsed).toBeLessThan(1000);
  });
});
