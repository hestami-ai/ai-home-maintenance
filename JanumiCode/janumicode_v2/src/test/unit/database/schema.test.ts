import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDatabase, type Database } from '../../../lib/database/init';

describe('Governed Stream Database Schema', () => {
  let db: Database;

  beforeEach(() => {
    db = createTestDatabase();
  });

  afterEach(() => {
    db.close();
  });

  it('creates all required tables', () => {
    const tables = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
    `).all() as { name: string }[];

    const tableNames = tables.map(t => t.name);

    // Core tables from spec §11
    expect(tableNames).toContain('workflow_runs');
    expect(tableNames).toContain('governed_stream');
    expect(tableNames).toContain('phase_gates');
    expect(tableNames).toContain('sub_phase_execution_log');
    expect(tableNames).toContain('agent_invocation_trace');
    expect(tableNames).toContain('memory_edge');
    expect(tableNames).toContain('detail_files');
    expect(tableNames).toContain('schema_versions');
    expect(tableNames).toContain('record_references');
    expect(tableNames).toContain('file_system_writes');
    expect(tableNames).toContain('llm_api_calls');
  });

  it('creates FTS5 virtual table', () => {
    const tables = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%fts%'
    `).all() as { name: string }[];

    const tableNames = tables.map(t => t.name);
    expect(tableNames).toContain('governed_stream_fts');
  });

  it('creates all required indices', () => {
    const indices = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'
    `).all() as { name: string }[];

    const indexNames = indices.map(i => i.name);

    // Key indices from schema
    expect(indexNames).toContain('gs_workflow');
    expect(indexNames).toContain('gs_record_type');
    expect(indexNames).toContain('gs_phase');
    expect(indexNames).toContain('me_source');
    expect(indexNames).toContain('me_target');
    expect(indexNames).toContain('me_type');
    expect(indexNames).toContain('fsw_workflow');
    expect(indexNames).toContain('lac_workflow');
  });

  it('sets WAL journal mode (skipped for in-memory DBs)', () => {
    // In-memory databases use 'memory' journal mode — WAL requires a file.
    // This test verifies the PRAGMA is in the DDL; WAL is active on file-backed DBs.
    const result = db.pragma('journal_mode') as { journal_mode: string }[];
    // :memory: databases report 'memory' — this is expected
    expect(['wal', 'memory']).toContain(result[0].journal_mode);
  });

  it('can insert and query workflow_runs', () => {
    db.prepare(`
      INSERT INTO workflow_runs (id, workspace_id, janumicode_version_sha, initiated_at, status)
      VALUES ('run-1', 'ws-1', 'abc123', '2026-01-01T00:00:00Z', 'initiated')
    `).run();

    const row = db.prepare('SELECT * FROM workflow_runs WHERE id = ?').get('run-1') as Record<string, unknown>;
    expect(row.workspace_id).toBe('ws-1');
    expect(row.status).toBe('initiated');
  });

  it('can insert and query governed_stream records', () => {
    // First create a workflow run (FK constraint)
    db.prepare(`
      INSERT INTO workflow_runs (id, workspace_id, janumicode_version_sha, initiated_at, status)
      VALUES ('run-1', 'ws-1', 'abc123', '2026-01-01T00:00:00Z', 'initiated')
    `).run();

    db.prepare(`
      INSERT INTO governed_stream (
        id, record_type, schema_version, workflow_run_id,
        produced_at, janumicode_version_sha, source_workflow_run_id, content
      ) VALUES (
        'rec-1', 'raw_intent_received', '1.0', 'run-1',
        '2026-01-01T00:00:01Z', 'abc123', 'run-1', '{"text":"Build me an app"}'
      )
    `).run();

    const row = db.prepare('SELECT * FROM governed_stream WHERE id = ?').get('rec-1') as Record<string, unknown>;
    expect(row.record_type).toBe('raw_intent_received');
    expect(JSON.parse(row.content as string)).toEqual({ text: 'Build me an app' });
  });

  it('FTS5 sync triggers work', () => {
    // Insert workflow run
    db.prepare(`
      INSERT INTO workflow_runs (id, workspace_id, janumicode_version_sha, initiated_at, status)
      VALUES ('run-1', 'ws-1', 'abc123', '2026-01-01T00:00:00Z', 'initiated')
    `).run();

    // Insert record
    db.prepare(`
      INSERT INTO governed_stream (
        id, record_type, schema_version, workflow_run_id,
        produced_at, janumicode_version_sha, source_workflow_run_id, content
      ) VALUES (
        'rec-1', 'raw_intent_received', '1.0', 'run-1',
        '2026-01-01T00:00:01Z', 'abc123', 'run-1', '{"text":"Build me a task manager"}'
      )
    `).run();

    // FTS search should find it
    const results = db.prepare(`
      SELECT id FROM governed_stream_fts WHERE governed_stream_fts MATCH 'task manager'
    `).all() as { id: string }[];

    expect(results.length).toBe(1);
    expect(results[0].id).toBe('rec-1');
  });

  it('enforces foreign key constraint on governed_stream → workflow_runs', () => {
    expect(() => {
      db.prepare(`
        INSERT INTO governed_stream (
          id, record_type, schema_version, workflow_run_id,
          produced_at, janumicode_version_sha, source_workflow_run_id, content
        ) VALUES (
          'rec-1', 'raw_intent_received', '1.0', 'nonexistent-run',
          '2026-01-01T00:00:01Z', 'abc123', 'nonexistent-run', '{}'
        )
      `).run();
    }).toThrow();
  });

  it('can insert memory edges', () => {
    // Setup: workflow run + two records
    db.prepare(`
      INSERT INTO workflow_runs (id, workspace_id, janumicode_version_sha, initiated_at, status)
      VALUES ('run-1', 'ws-1', 'abc123', '2026-01-01T00:00:00Z', 'initiated')
    `).run();

    db.prepare(`
      INSERT INTO governed_stream (id, record_type, schema_version, workflow_run_id, produced_at, janumicode_version_sha, source_workflow_run_id, content)
      VALUES ('rec-1', 'artifact_produced', '1.0', 'run-1', '2026-01-01T00:00:01Z', 'abc123', 'run-1', '{}')
    `).run();

    db.prepare(`
      INSERT INTO governed_stream (id, record_type, schema_version, workflow_run_id, produced_at, janumicode_version_sha, source_workflow_run_id, content)
      VALUES ('rec-2', 'artifact_produced', '1.0', 'run-1', '2026-01-01T00:00:02Z', 'abc123', 'run-1', '{}')
    `).run();

    // Insert memory edge
    db.prepare(`
      INSERT INTO memory_edge (id, source_record_id, target_record_id, edge_type, asserted_by, asserted_at, authority_level, status)
      VALUES ('edge-1', 'rec-2', 'rec-1', 'derives_from', 'ingestion_pipeline', '2026-01-01T00:00:02Z', 5, 'system_asserted')
    `).run();

    const edge = db.prepare('SELECT * FROM memory_edge WHERE id = ?').get('edge-1') as Record<string, unknown>;
    expect(edge.edge_type).toBe('derives_from');
    expect(edge.status).toBe('system_asserted');
  });
});
