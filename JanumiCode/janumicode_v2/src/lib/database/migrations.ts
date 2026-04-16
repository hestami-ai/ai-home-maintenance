/**
 * Database migration framework.
 * Based on JanumiCode Spec v2.3, §13.
 *
 * Tracks applied migrations in a migrations table.
 * Migrations are idempotent — safe to run multiple times.
 */

import type { Database } from './init';

export interface Migration {
  id: string;
  description: string;
  sql: string;
}

/**
 * Ensure the migrations tracking table exists.
 */
export function ensureMigrationsTable(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
}

/**
 * Get list of already-applied migration IDs.
 */
export function getAppliedMigrations(db: Database): string[] {
  ensureMigrationsTable(db);
  const rows = db.prepare('SELECT id FROM _migrations ORDER BY applied_at').all() as { id: string }[];
  return rows.map(r => r.id);
}

/**
 * Apply pending migrations in order.
 * Returns the count of newly applied migrations.
 */
export function applyMigrations(db: Database, migrations: Migration[]): number {
  ensureMigrationsTable(db);
  const applied = new Set(getAppliedMigrations(db));
  let count = 0;

  for (const migration of migrations) {
    if (applied.has(migration.id)) continue;

    try {
      db.exec(migration.sql);
      db.prepare(
        'INSERT INTO _migrations (id, description, applied_at) VALUES (?, ?, ?)',
      ).run(migration.id, migration.description, new Date().toISOString());
      count++;
    } catch (err) {
      // Tolerate "duplicate column" errors (schema already has the column)
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('duplicate column name')) continue;
      throw err;
    }
  }

  return count;
}

/**
 * Validate the current schema matches expectations.
 */
export function validateSchema(db: Database): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  // Check core tables exist
  // detail_files, schema_versions, record_references, llm_api_calls were
  // removed after the ghost-table audit: all four were redundant with
  // governed_stream records / JSON columns and never populated by
  // production code.
  const expectedTables = [
    'workflow_runs', 'governed_stream', 'phase_gates',
    'sub_phase_execution_log', 'agent_invocation_trace',
    'memory_edge', 'file_system_writes',
    // Architecture Canvas tables
    'sub_artifact', 'sub_artifact_edge', 'canvas_layout_state',
  ];

  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table'",
  ).all() as { name: string }[];

  const tableNames = new Set(tables.map(t => t.name));

  for (const expected of expectedTables) {
    if (!tableNames.has(expected)) {
      issues.push(`Missing table: ${expected}`);
    }
  }

  return { valid: issues.length === 0, issues };
}
