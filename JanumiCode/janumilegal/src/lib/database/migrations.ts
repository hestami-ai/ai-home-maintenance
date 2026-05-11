/**
 * Migration runner + schema validator.
 *
 * Wave 0 ships SCHEMA_V1 only. Future waves add migrations as additive deltas;
 * the runner tolerates "duplicate column name" errors when a consolidated schema
 * already includes a column from a later migration (lesson from JanumiCode v2).
 */

import type Database from 'better-sqlite3';
import { SCHEMA_V1_STATEMENTS, SCHEMA_V1_VERSION, SCOPED_DOMAIN_TABLES } from './schema.js';

export interface Migration {
  readonly version: number;
  readonly statements: readonly string[];
}

export const MIGRATIONS: readonly Migration[] = [
  { version: SCHEMA_V1_VERSION, statements: SCHEMA_V1_STATEMENTS },
];

export function runMigrations(db: Database.Database): void {
  // Bootstrap schema_version if not present
  db.exec(`CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`);

  const currentVersion = (db
    .prepare('SELECT MAX(version) AS v FROM schema_version')
    .get() as { v: number | null }).v ?? 0;

  for (const migration of MIGRATIONS) {
    if (migration.version <= currentVersion) continue;
    db.transaction(() => {
      for (const stmt of migration.statements) {
        try {
          db.exec(stmt);
        } catch (err) {
          const msg = (err as Error).message ?? '';
          if (/duplicate column name/i.test(msg)) {
            // Tolerated: consolidated schema already includes this column
            continue;
          }
          throw err;
        }
      }
      db.prepare('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)').run(
        migration.version,
        new Date().toISOString(),
      );
    })();
  }
}

export interface SchemaValidationResult {
  ok: boolean;
  errors: string[];
}

/**
 * Asserts the tenancy invariant: every table in SCOPED_DOMAIN_TABLES has
 * firm_id, client_id, matter_id columns.
 */
export function validateSchema(db: Database.Database): SchemaValidationResult {
  const errors: string[] = [];
  for (const table of SCOPED_DOMAIN_TABLES) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    const colNames = new Set(cols.map((c) => c.name));
    for (const required of ['firm_id', 'client_id', 'matter_id']) {
      if (!colNames.has(required)) {
        errors.push(`table ${table} missing required scope column: ${required}`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}
