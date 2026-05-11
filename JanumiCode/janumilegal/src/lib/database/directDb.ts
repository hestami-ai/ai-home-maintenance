/**
 * Direct better-sqlite3 connection (test/dev mode).
 *
 * Per the dual-mode pattern: tests and headless tooling open the DB directly;
 * VS Code Electron host (Wave 1+) uses the sidecar over the worker bridge.
 *
 * No application code outside `src/lib/database/` may instantiate this.
 */

import Database from 'better-sqlite3';
import { runMigrations, validateSchema } from './migrations.js';

export function openDirect(dbPath: string): Database.Database {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  const v = validateSchema(db);
  if (!v.ok) {
    db.close();
    throw new Error('schema validation failed: ' + v.errors.join('; '));
  }
  return db;
}
