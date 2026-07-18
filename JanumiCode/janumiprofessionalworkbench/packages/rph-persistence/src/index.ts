// @janumipwb/rph-persistence — the SQLite StorageAdapter. All SQL lives here behind the dialect-neutral
// StorageAdapter port (from rph-ports). Dev/test backend = bun:sqlite; a better-sqlite3 backend for Node
// hosts implements the same SqlDriver.
export const RPH_PERSISTENCE_VERSION = '0.0.0';

export { createSqliteDriver } from './sql-driver.js';
export type { SqlDriver, SqlStatement, SqlRunResult } from './sql-driver.js';
export { SCHEMA_SQL } from './schema.js';
export { SqliteStorageAdapter } from './sqlite-storage-adapter.js';
export { SnapshotOverlayStorageAdapter } from './snapshot-overlay-storage-adapter.js';
