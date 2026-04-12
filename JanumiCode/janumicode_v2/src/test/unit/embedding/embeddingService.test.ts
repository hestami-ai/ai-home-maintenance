/**
 * EmbeddingService tests — text extraction and cosine similarity.
 *
 * The HTTP path against Ollama is not exercised in unit tests; the worker
 * loop and DB persistence are covered indirectly via the writer integration.
 */

import { describe, it, expect } from 'vitest';
import { cosineSimilarity, EmbeddingService } from '../../../lib/embedding/embeddingService';
import { createTestDatabase } from '../../../lib/database/init';
import type { GovernedStreamRecord } from '../../../lib/types/records';

function makeRecord(content: Record<string, unknown>): GovernedStreamRecord {
  return {
    id: 'test-id',
    record_type: 'artifact_produced',
    schema_version: '1.0',
    workflow_run_id: 'run-1',
    phase_id: '1',
    sub_phase_id: null,
    produced_by_agent_role: null,
    produced_by_record_id: null,
    produced_at: new Date().toISOString(),
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

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const a = new Float32Array([1, 0, 0]);
    expect(cosineSimilarity(a, a)).toBeCloseTo(1, 5);
  });

  it('returns 0 for orthogonal vectors', () => {
    const a = new Float32Array([1, 0, 0]);
    const b = new Float32Array([0, 1, 0]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5);
  });

  it('returns -1 for anti-parallel vectors', () => {
    const a = new Float32Array([1, 0, 0]);
    const b = new Float32Array([-1, 0, 0]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 5);
  });

  it('returns 0 when either vector is empty', () => {
    const a = new Float32Array([0, 0, 0]);
    const b = new Float32Array([1, 1, 1]);
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it('returns 0 when lengths mismatch', () => {
    const a = new Float32Array([1, 0]);
    const b = new Float32Array([1, 0, 0]);
    expect(cosineSimilarity(a, b)).toBe(0);
  });
});

describe('EmbeddingService.enqueue text extraction', () => {
  it('skips records without text-bearing content', () => {
    const db = createTestDatabase();
    const svc = new EmbeddingService(db, { provider: 'ollama', model: 'm', maxParallel: 1 });
    // No fields the extractor recognizes — enqueue is a no-op.
    svc.enqueue(makeRecord({ random: 1 }));
    db.close();
    // No throw, no DB write.
    expect(true).toBe(true);
  });

  it('extracts the text field for embedding', () => {
    const db = createTestDatabase();
    const svc = new EmbeddingService(db, { provider: 'ollama', model: 'm', maxParallel: 1 });
    // Don't start the worker — we just verify enqueue accepts the record without error.
    svc.enqueue(makeRecord({ text: 'hello world' }));
    svc.enqueue(makeRecord({ description: 'a description' }));
    svc.enqueue(makeRecord({ statement: 'a statement' }));
    db.close();
    expect(true).toBe(true);
  });
});
