/**
 * Regression test for the writer→embedder enqueue hook.
 *
 * Bug context: thin-slice-6 ran 3,032 records to completion of Phase 3
 * with `governed_stream_vec` still at 0 rows. The cause was a missing
 * wiring step in createTestEngine.ts: `engine.setEmbeddingService(...)`
 * was called (DMR could read the table) and `embedding.start()` was
 * called (the worker loop ran), but `engine.writer.setEmbeddingService(...)`
 * was NOT called — so no record write ever fired enqueue(). The CLI
 * path goes through createTestEngine, so thin-slice runs hit this.
 *
 * Production extension.ts has all three wirings:
 *   - engine.setEmbeddingService(embedding)
 *   - engine.writer.setEmbeddingService(embedding)   ← was missing in tests/CLI
 *   - embedding.start()
 *
 * This test verifies the writer-side wire by spying on `embedding.enqueue`.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GovernedStreamWriter } from '../../../lib/orchestrator/governedStreamWriter';
import { EmbeddingService } from '../../../lib/embedding/embeddingService';
import { createTestDatabase, type Database } from '../../../lib/database/init';

let idCounter = 0;
function testId(): string { return `we-${++idCounter}`; }

describe('writer.setEmbeddingService — enqueue hook', () => {
  let db: Database;

  beforeEach(() => {
    idCounter = 0;
    db = createTestDatabase();
    db.prepare(`
      INSERT INTO workflow_runs (id, workspace_id, janumicode_version_sha, initiated_at, status)
      VALUES ('run-1', 'ws-1', 'abc', '2026-01-01T00:00:00Z', 'initiated')
    `).run();
  });

  afterEach(() => { db.close(); });

  it('does not enqueue when writer has no embedding service attached', () => {
    const writer = new GovernedStreamWriter(db, testId);
    const svc = new EmbeddingService(db, { provider: 'llamacpp', model: 'm', maxParallel: 1 });
    const spy = vi.spyOn(svc, 'enqueue');

    // Writer has NO setEmbeddingService call — mimics the broken thin-slice-6 state
    writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: 'run-1',
      janumicode_version_sha: 'abc',
      content: { description: 'embeddable content' },
    });

    expect(spy).not.toHaveBeenCalled();
  });

  it('enqueues every record write when writer has embedding service attached', () => {
    const writer = new GovernedStreamWriter(db, testId);
    const svc = new EmbeddingService(db, { provider: 'llamacpp', model: 'm', maxParallel: 1 });
    const spy = vi.spyOn(svc, 'enqueue');

    writer.setEmbeddingService(svc);

    writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: 'run-1',
      janumicode_version_sha: 'abc',
      content: { description: 'embeddable content' },
    });
    writer.writeRecord({
      record_type: 'decision_trace',
      schema_version: '1.0',
      workflow_run_id: 'run-1',
      janumicode_version_sha: 'abc',
      content: { decision_type: 'approve', payload: { statement: 'x' } },
    });

    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('enqueues even when embedder is disabled (the breaker handles the no-op internally)', () => {
    // Mimics the "circuit breaker tripped" state. The writer should still
    // call enqueue; the service short-circuits internally. This guards
    // against accidentally pre-filtering at the writer.
    const writer = new GovernedStreamWriter(db, testId);
    const svc = new EmbeddingService(db, { provider: 'llamacpp', model: 'm', maxParallel: 1 });
    writer.setEmbeddingService(svc);

    // Force-trip the breaker by accessing the private field via cast.
    (svc as unknown as { disabled: boolean; disabledReason: string }).disabled = true;
    (svc as unknown as { disabled: boolean; disabledReason: string }).disabledReason = 'test';

    const spy = vi.spyOn(svc, 'enqueue');
    writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: 'run-1',
      janumicode_version_sha: 'abc',
      content: { description: 'content' },
    });
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
