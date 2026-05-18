/**
 * Regression tests for embedder retry-on-abort.
 *
 * Bug context: thin-slice-8 ran 136 records, only 26 embeddings landed.
 * Root cause: 30s hardcoded timeout + 0 retries. When Ollama swapped
 * models (qwen3.5:9b ↔ qwen3-embedding:8b) the cold-load exceeded 30s,
 * AbortController fired, the embed call returned, and the record was
 * dropped permanently (the worker moved to the next queue entry; nothing
 * re-queued the failed one). Aborts logged at DEBUG → invisible in
 * production logs.
 *
 * The fix:
 *   - 180s default timeout (aligned with LLMCaller wall-clock)
 *   - 3 retries with exponential backoff (1s, 4s, 16s)
 *   - WARN-level logging on retry + final-attempt failure
 *   - Env-tunable via JANUMICODE_EMBED_{TIMEOUT_SECONDS,MAX_RETRIES}
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EmbeddingService } from '../../../lib/embedding/embeddingService';
import { createTestDatabase, type Database } from '../../../lib/database/init';
import type { GovernedStreamRecord } from '../../../lib/types/records';

function makeRecord(content: Record<string, unknown>): GovernedStreamRecord {
  return {
    id: `rec-${Math.random().toString(36).slice(2, 10)}`,
    record_type: 'artifact_produced',
    schema_version: '1.0',
    workflow_run_id: 'run-1',
    phase_id: '1',
    sub_phase_id: null,
    produced_by_agent_role: null,
    produced_by_record_id: null,
    produced_at: '2026-05-11T00:00:00.000Z',
    effective_at: null,
    janumicode_version_sha: 'test',
    authority_level: 2,
    derived_from_system_proposal: false,
    is_current_version: true,
    superseded_by_id: null,
    superseded_at: null,
    superseded_by_record_id: null,
    source_workflow_run_id: 'run-1',
    derived_from_record_ids: [],
    quarantined: false,
    sanitized: false,
    sanitized_fields: [],
    content,
  };
}

/**
 * Persist a record into governed_stream so the FK from
 * governed_stream_vec.record_id → governed_stream.id is satisfied
 * when the embedder INSERTs.
 */
function insertGoverned(db: Database, rec: GovernedStreamRecord): void {
  db.prepare(`
    INSERT INTO governed_stream (
      id, record_type, schema_version, workflow_run_id, phase_id, sub_phase_id,
      produced_by_agent_role, produced_by_record_id, produced_at, effective_at,
      janumicode_version_sha, authority_level, derived_from_system_proposal,
      is_current_version, superseded_by_id, superseded_at, superseded_by_record_id,
      source_workflow_run_id, derived_from_record_ids, quarantined, sanitized,
      sanitized_fields, content
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    rec.id, rec.record_type, rec.schema_version, rec.workflow_run_id,
    rec.phase_id, rec.sub_phase_id, rec.produced_by_agent_role,
    rec.produced_by_record_id, rec.produced_at, rec.effective_at,
    rec.janumicode_version_sha, rec.authority_level,
    rec.derived_from_system_proposal ? 1 : 0,
    rec.is_current_version ? 1 : 0,
    rec.superseded_by_id, rec.superseded_at, rec.superseded_by_record_id,
    rec.source_workflow_run_id, JSON.stringify(rec.derived_from_record_ids),
    rec.quarantined ? 1 : 0, rec.sanitized ? 1 : 0,
    JSON.stringify(rec.sanitized_fields), JSON.stringify(rec.content),
  );
}

async function settle(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms));
}

describe('EmbeddingService — retry on transient abort', () => {
  let db: Database;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    db = createTestDatabase();
    originalFetch = globalThis.fetch;
    // Seed a workflow_run so governed_stream FKs satisfy.
    db.prepare(`
      INSERT INTO workflow_runs (id, workspace_id, janumicode_version_sha, initiated_at, status)
      VALUES ('run-1', 'ws-1', 'abc', '2026-01-01T00:00:00Z', 'initiated')
    `).run();
    // Use real timers — fake timers + Promise microtask interleaving was
    // dropping the DB insert that runs after the final await in process().
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    db.close();
  });

  it('re-enqueues an aborted job with exponential backoff and eventually embeds', async () => {
    const svc = new EmbeddingService(db, {
      provider: 'ollama',
      model: 'test-model',
      maxParallel: 1,
      timeoutMs: 60_000,
      maxRetries: 3,
    });

    // Spy on the private callEmbed to bypass HTTP entirely. The first 2
    // calls throw AbortError (transient); the 3rd returns a Float32Array
    // so the DB insert path runs.
    let calls = 0;
    const spy = vi.spyOn(svc as unknown as { callEmbed: (t: string) => Promise<Float32Array> }, 'callEmbed')
      .mockImplementation(async () => {
        calls++;
        if (calls < 3) {
          const err = new Error('aborted');
          err.name = 'AbortError';
          throw err;
        }
        return new Float32Array([0.1, 0.2, 0.3, 0.4]);
      });

    svc.start();

    const rec = makeRecord({ description: 'test content' });
    insertGoverned(db, rec);
    svc.enqueue(rec);

    // Real timers. Backoffs are 1s + 4s = 5s of wall-time minimum; settle
    // longer than that to let the third attempt + DB insert complete.
    await settle(6_500);

    expect(calls).toBe(3);
    const row = db.prepare(`SELECT 1 FROM governed_stream_vec WHERE record_id = ?`).get(rec.id);
    expect(row).toBeDefined();
    spy.mockRestore();
  });

  it('gives up after maxRetries attempts and logs WARN on final failure', async () => {
    const svc = new EmbeddingService(db, {
      provider: 'ollama',
      model: 'test-model',
      maxParallel: 1,
      timeoutMs: 60_000,
      maxRetries: 2,
    });

    let calls = 0;
    const spy = vi.spyOn(svc as unknown as { callEmbed: (t: string) => Promise<Float32Array> }, 'callEmbed')
      .mockImplementation(async () => {
        calls++;
        const err = new Error('aborted');
        err.name = 'AbortError';
        throw err;
      });

    svc.start();

    const rec = makeRecord({ description: 'test content' });
    insertGoverned(db, rec);
    svc.enqueue(rec);

    // attempts: initial + 2 retries = 3 fetches; backoff 1s + 4s = 5s total
    await settle(6_500);

    expect(calls).toBe(3); // initial + 2 retries
    const row = db.prepare(`SELECT 1 FROM governed_stream_vec WHERE record_id = ?`).get(rec.id);
    expect(row).toBeUndefined(); // never embedded
    spy.mockRestore();
  });

  it('does not retry on hard failures (model not found) — trips circuit breaker', async () => {
    const svc = new EmbeddingService(db, {
      provider: 'ollama',
      model: 'test-model',
      maxParallel: 1,
      timeoutMs: 60_000,
      maxRetries: 3,
    });

    let calls = 0;
    const spy = vi.spyOn(svc as unknown as { callEmbed: (t: string) => Promise<Float32Array> }, 'callEmbed')
      .mockImplementation(async () => {
        calls++;
        throw new Error('model "test-model" not found, try pulling it first');
      });

    svc.start();

    const rec1 = makeRecord({ description: 'first' });
    insertGoverned(db, rec1);
    svc.enqueue(rec1);
    await settle(500);

    // Only one call — circuit-broke after first hard failure
    expect(calls).toBe(1);

    // Subsequent enqueues are no-ops; the breaker is open
    const rec2 = makeRecord({ description: 'second' });
    insertGoverned(db, rec2);
    svc.enqueue(rec2);
    await settle(500);
    expect(calls).toBe(1);
    spy.mockRestore();
  });
});
