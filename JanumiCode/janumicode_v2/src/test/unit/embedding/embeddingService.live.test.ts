/**
 * Live-ollama tests for the embedding pipeline.
 *
 * Covers two A.1 changes:
 *   1. embedding.start() is wired in the test harness so records actually
 *      get embedded (the original cause of `governed_stream_vec` being
 *      empty in thin-slice-5).
 *   2. extractEmbeddingText() recursively walks content + skips pure
 *      plumbing — reasoning-trail records (agent_reasoning_step etc.)
 *      should be embedded; mirror_presented etc. should be skipped.
 *
 * Skipped gracefully when ollama isn't reachable. Requires:
 *   - `ollama serve` running on OLLAMA_URL
 *   - `qwen3-embedding:8b` model pulled (or override via env)
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { EmbeddingService } from '../../../lib/embedding/embeddingService';
import { createTestDatabase, type Database } from '../../../lib/database/init';
import type { GovernedStreamRecord, RecordType } from '../../../lib/types/records';

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434';
const EMBED_MODEL = process.env.JANUMICODE_LIVE_EMBED_MODEL ?? 'qwen3-embedding:8b';

let ollamaReachable = false;

async function probeOllama(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`);
    return res.ok;
  } catch {
    return false;
  }
}

beforeAll(async () => {
  ollamaReachable = await probeOllama();
  if (!ollamaReachable) {
    console.warn(`[live-ollama] skipping embedding tests — ${OLLAMA_URL} not reachable`);
  }
});

function makeRecord(record_type: RecordType, content: Record<string, unknown>, id = 'rec-1'): GovernedStreamRecord {
  return {
    id,
    record_type,
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

async function waitForVecRow(db: Database, recordId: string, timeoutMs = 60_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const row = db.prepare(`SELECT 1 FROM governed_stream_vec WHERE record_id = ?`).get(recordId);
    if (row) return true;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  return false;
}

describe('EmbeddingService [live-ollama]', () => {
  let db: Database;
  let svc: EmbeddingService;

  beforeEach(() => {
    db = createTestDatabase();
    svc = new EmbeddingService(db, {
      provider: 'ollama',
      model: EMBED_MODEL,
      maxParallel: 1,
      ollamaBaseUrl: OLLAMA_URL,
      timeoutMs: 60_000,
    });
    db.prepare(`
      INSERT INTO workflow_runs (id, workspace_id, janumicode_version_sha, initiated_at, status)
      VALUES ('run-1', 'ws-1', 'abc', '2026-01-01T00:00:00Z', 'initiated')
    `).run();
  });

  afterEach(() => {
    svc.stop();
    db.close();
  });

  it('embeds an artifact_produced record with nested content (A.1 recursive walk)', async () => {
    if (!ollamaReachable) return;
    svc.start();

    // Insert into governed_stream so vec table FK is satisfied
    const rec = makeRecord('artifact_produced', {
      kind: 'business_domains_bloom',
      domains: [
        { name: 'Authentication', description: 'OAuth-based user identity and session handling' },
        { name: 'Notifications', description: 'Real-time WebSocket-based delivery' },
      ],
    }, 'rec-artifact-1');
    db.prepare(`
      INSERT INTO governed_stream (
        id, record_type, schema_version, workflow_run_id, phase_id, sub_phase_id,
        produced_by_agent_role, produced_by_record_id, produced_at, effective_at,
        janumicode_version_sha, authority_level, derived_from_system_proposal,
        is_current_version, superseded_by_id, superseded_at, superseded_by_record_id,
        source_workflow_run_id, derived_from_record_ids, quarantined, sanitized,
        sanitized_fields, content
      ) VALUES (?, ?, '1.0', 'run-1', '1', null, null, null, ?, null, 'abc', 2, 0, 1, null, null, null, 'run-1', '[]', 0, 0, '[]', ?)
    `).run(rec.id, rec.record_type, rec.produced_at, JSON.stringify(rec.content));

    svc.enqueue(rec);
    const embedded = await waitForVecRow(db, rec.id);
    expect(embedded).toBe(true);
  }, 120_000);

  it('embeds reasoning-trail records (NOT skipped — needed for drift detection)', async () => {
    if (!ollamaReachable) return;
    svc.start();

    const rec = makeRecord('agent_reasoning_step', {
      kind: 'agent_reasoning_step',
      thinking: 'I considered using bcrypt but rejected it because the spec calls for Argon2id with specific memory/time parameters.',
    }, 'rec-reasoning-1');
    db.prepare(`
      INSERT INTO governed_stream (
        id, record_type, schema_version, workflow_run_id, phase_id, sub_phase_id,
        produced_by_agent_role, produced_by_record_id, produced_at, effective_at,
        janumicode_version_sha, authority_level, derived_from_system_proposal,
        is_current_version, superseded_by_id, superseded_at, superseded_by_record_id,
        source_workflow_run_id, derived_from_record_ids, quarantined, sanitized,
        sanitized_fields, content
      ) VALUES (?, ?, '1.0', 'run-1', '1', null, null, null, ?, null, 'abc', 2, 0, 1, null, null, null, 'run-1', '[]', 0, 0, '[]', ?)
    `).run(rec.id, rec.record_type, rec.produced_at, JSON.stringify(rec.content));

    svc.enqueue(rec);
    const embedded = await waitForVecRow(db, rec.id);
    expect(embedded).toBe(true);
  }, 120_000);

  it('does NOT embed pure-plumbing records (file_system_write_record skipped)', async () => {
    if (!ollamaReachable) return;
    svc.start();

    const rec = makeRecord('file_system_write_record', {
      kind: 'file_system_write_record',
      path: '/some/path.ts',
      operation: 'create',
    }, 'rec-plumbing-1');
    db.prepare(`
      INSERT INTO governed_stream (
        id, record_type, schema_version, workflow_run_id, phase_id, sub_phase_id,
        produced_by_agent_role, produced_by_record_id, produced_at, effective_at,
        janumicode_version_sha, authority_level, derived_from_system_proposal,
        is_current_version, superseded_by_id, superseded_at, superseded_by_record_id,
        source_workflow_run_id, derived_from_record_ids, quarantined, sanitized,
        sanitized_fields, content
      ) VALUES (?, ?, '1.0', 'run-1', '1', null, null, null, ?, null, 'abc', 2, 0, 1, null, null, null, 'run-1', '[]', 0, 0, '[]', ?)
    `).run(rec.id, rec.record_type, rec.produced_at, JSON.stringify(rec.content));

    svc.enqueue(rec);
    // Wait a reasonable interval — if the embedder were going to fire it
    // would have queued by now. Short window so the test doesn't drag.
    await new Promise(resolve => setTimeout(resolve, 3_000));
    const row = db.prepare(`SELECT 1 FROM governed_stream_vec WHERE record_id = ?`).get(rec.id);
    expect(row).toBeUndefined();
  }, 30_000);
});
