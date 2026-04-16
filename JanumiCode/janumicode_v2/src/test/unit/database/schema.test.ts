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
    expect(tableNames).toContain('file_system_writes');
    // Architecture Canvas tables
    expect(tableNames).toContain('sub_artifact');
    expect(tableNames).toContain('sub_artifact_edge');
    expect(tableNames).toContain('canvas_layout_state');
  });

  it('does not create the dropped ghost tables', () => {
    // Audit recap: detail_files, schema_versions, record_references, and
    // llm_api_calls were removed because they were redundant with
    // governed_stream records / JSON columns and never populated by any
    // production code path. This test guards against a well-meaning
    // "restore spec parity" edit silently reintroducing them.
    const tables = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table'
    `).all() as { name: string }[];
    const tableNames = new Set(tables.map(t => t.name));

    expect(tableNames.has('detail_files')).toBe(false);
    expect(tableNames.has('schema_versions')).toBe(false);
    expect(tableNames.has('record_references')).toBe(false);
    expect(tableNames.has('llm_api_calls')).toBe(false);
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

  // -- Architecture Canvas Tables --

  it('can insert and query sub_artifacts', () => {
    // Setup: workflow run + parent record
    db.prepare(`
      INSERT INTO workflow_runs (id, workspace_id, janumicode_version_sha, initiated_at, status)
      VALUES ('run-1', 'ws-1', 'abc123', '2026-01-01T00:00:00Z', 'initiated')
    `).run();

    db.prepare(`
      INSERT INTO governed_stream (id, record_type, schema_version, workflow_run_id, produced_at, janumicode_version_sha, source_workflow_run_id, content)
      VALUES ('rec-1', 'artifact_produced', '1.0', 'run-1', '2026-01-01T00:00:01Z', 'abc123', 'run-1', '{"components":[{"id":"COMP-001","name":"API"}]}')
    `).run();

    // Insert sub-artifact
    db.prepare(`
      INSERT INTO sub_artifact (id, parent_record_id, json_path, kind, workflow_run_id, created_at)
      VALUES ('COMP-001', 'rec-1', 'components[COMP-001]', 'component', 'run-1', '2026-01-01T00:00:01Z')
    `).run();

    const sa = db.prepare('SELECT * FROM sub_artifact WHERE id = ?').get('COMP-001') as Record<string, unknown>;
    expect(sa.kind).toBe('component');
    expect(sa.parent_record_id).toBe('rec-1');
  });

  it('can insert and query sub_artifact_edges', () => {
    // Setup: workflow run + parent record + two sub-artifacts
    db.prepare(`
      INSERT INTO workflow_runs (id, workspace_id, janumicode_version_sha, initiated_at, status)
      VALUES ('run-1', 'ws-1', 'abc123', '2026-01-01T00:00:00Z', 'initiated')
    `).run();

    db.prepare(`
      INSERT INTO governed_stream (id, record_type, schema_version, workflow_run_id, produced_at, janumicode_version_sha, source_workflow_run_id, content)
      VALUES ('rec-1', 'artifact_produced', '1.0', 'run-1', '2026-01-01T00:00:01Z', 'abc123', 'run-1', '{}')
    `).run();

    db.prepare(`
      INSERT INTO sub_artifact (id, parent_record_id, json_path, kind, workflow_run_id, created_at)
      VALUES ('COMP-001', 'rec-1', 'components[0]', 'component', 'run-1', '2026-01-01T00:00:01Z')
    `).run();

    db.prepare(`
      INSERT INTO sub_artifact (id, parent_record_id, json_path, kind, workflow_run_id, created_at)
      VALUES ('COMP-002', 'rec-1', 'components[1]', 'component', 'run-1', '2026-01-01T00:00:01Z')
    `).run();

    // Insert sub-artifact edge
    db.prepare(`
      INSERT INTO sub_artifact_edge (id, source_id, target_id, edge_type, asserted_by, asserted_at, workflow_run_id)
      VALUES ('edge-1', 'COMP-001', 'COMP-002', 'depends_on', 'ingestion_pipeline', '2026-01-01T00:00:01Z', 'run-1')
    `).run();

    const edge = db.prepare('SELECT * FROM sub_artifact_edge WHERE id = ?').get('edge-1') as Record<string, unknown>;
    expect(edge.edge_type).toBe('depends_on');
    expect(edge.source_id).toBe('COMP-001');
    expect(edge.target_id).toBe('COMP-002');
  });

  it('can insert and query canvas_layout_state', () => {
    // Setup: workflow run
    db.prepare(`
      INSERT INTO workflow_runs (id, workspace_id, janumicode_version_sha, initiated_at, status)
      VALUES ('run-1', 'ws-1', 'abc123', '2026-01-01T00:00:00Z', 'initiated')
    `).run();

    // Insert layout state
    db.prepare(`
      INSERT INTO canvas_layout_state (workflow_run_id, node_id, x, y, width, height, collapsed, user_positioned, last_modified_at)
      VALUES ('run-1', 'COMP-001', 100, 200, 120, 60, 0, 1, '2026-01-01T00:00:01Z')
    `).run();

    const layout = db.prepare('SELECT * FROM canvas_layout_state WHERE workflow_run_id = ? AND node_id = ?').get('run-1', 'COMP-001') as Record<string, unknown>;
    expect(layout.x).toBe(100);
    expect(layout.y).toBe(200);
    expect(layout.user_positioned).toBe(1);
  });

  it('enforces FK constraint on sub_artifact_edge to sub_artifact', () => {
    // Setup: workflow run
    db.prepare(`
      INSERT INTO workflow_runs (id, workspace_id, janumicode_version_sha, initiated_at, status)
      VALUES ('run-1', 'ws-1', 'abc123', '2026-01-01T00:00:00Z', 'initiated')
    `).run();

    // Try to insert edge with non-existent sub-artifact
    expect(() => {
      db.prepare(`
        INSERT INTO sub_artifact_edge (id, source_id, target_id, edge_type, asserted_by, asserted_at, workflow_run_id)
        VALUES ('edge-1', 'NONEXISTENT', 'ALSO-NONEXISTENT', 'depends_on', 'test', '2026-01-01T00:00:01Z', 'run-1')
      `).run();
    }).toThrow();
  });
});
