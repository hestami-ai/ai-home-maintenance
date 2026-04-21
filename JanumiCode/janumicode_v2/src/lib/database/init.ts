/**
 * Database initialization — creates or opens the Governed Stream database.
 *
 * Two connection modes:
 *   - "direct": Uses better-sqlite3 directly in-process. Required for tests,
 *     a future plain-Node CLI, and any caller running under the same Node
 *     ABI that better-sqlite3 was compiled against.
 *   - "sidecar": Spawns a child Node process that owns the better-sqlite3
 *     connection. Main thread bridges synchronously via a worker_threads
 *     worker + SharedArrayBuffer + Atomics.wait. Required in the VS Code
 *     extension host because Electron's bundled Node has a different
 *     NODE_MODULE_VERSION than the system Node that pnpm built against.
 *
 * Default behavior (mode: 'auto'): detect the runtime environment and pick
 * the right mode up front. We do NOT try-then-fall-back, because direct
 * mode is a guaranteed failure under Electron and the failure is noisy.
 *
 * Detection (in order):
 *   1. `process.versions.electron` is defined → Electron host → sidecar.
 *   2. `process.env.VSCODE_PID` is set       → VS Code extension host → sidecar.
 *   3. otherwise                              → direct.
 */

import { SCHEMA_DDL, VECTOR_SEARCH_DDL } from './schema';
import { createDatabaseRPCClient } from './rpcClient';

export type DatabaseConnectionMode = 'auto' | 'direct' | 'sidecar';

export interface DatabaseOptions {
  /** Path to SQLite database file. Use ':memory:' for in-memory. */
  path: string;
  /** Open as read-only (direct mode only). */
  readonly?: boolean;
  /** Fail if the file does not exist (no auto-create). */
  fileMustExist?: boolean;
  /** Connection strategy. Default: env JANUMICODE_DB_MODE or 'auto'. */
  connectionMode?: DatabaseConnectionMode;
  /**
   * Extension root path — required for sidecar mode so the factory can
   * locate dist/sidecar/dbServer.js and dist/rpcWorker.js.
   */
  extensionPath?: string;
}

export interface Database {
  prepare(sql: string): Statement;
  exec(sql: string): void;
  close(): void;
  transaction<T>(fn: () => T): () => T;
  pragma(pragma: string): unknown;
}

export interface Statement {
  run(...params: unknown[]): RunResult;
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
  bind(...params: unknown[]): Statement;
}

export interface RunResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

/**
 * Initialize the database. In auto mode, detects the runtime environment
 * and picks the right backend up front (no try-then-fall-back).
 */
export function initializeDatabase(options: DatabaseOptions): Database {
  const requested = options.connectionMode
    ?? (process.env.JANUMICODE_DB_MODE as DatabaseConnectionMode | undefined)
    ?? 'auto';

  const mode: 'direct' | 'sidecar' =
    requested === 'auto' ? detectRuntimeMode() : requested;

  return mode === 'sidecar' ? initializeSidecar(options) : initializeDirect(options);
}

/**
 * Returns 'sidecar' when running inside the VS Code extension host (or any
 * other Electron-hosted process), 'direct' otherwise. The sidecar child
 * process itself is plain Node, so this check correctly returns 'direct'
 * when called from inside the sidecar — which is what we want, because the
 * sidecar IS where better-sqlite3 loads in-process.
 */
function detectRuntimeMode(): 'direct' | 'sidecar' {
  if (typeof process.versions.electron === 'string') return 'sidecar';
  if (process.env.VSCODE_PID) return 'sidecar';
  return 'direct';
}

function initializeDirect(options: DatabaseOptions): Database {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const BetterSqlite3 = require('better-sqlite3');

  const db = new BetterSqlite3(options.path, {
    readonly: options.readonly ?? false,
    fileMustExist: options.fileMustExist ?? false,
  });

  if (!options.readonly) {
    db.exec(SCHEMA_DDL);
    db.exec(VECTOR_SEARCH_DDL);
    ensureSchemaColumns(db);
  }

  return db as Database;
}

/**
 * Apply additive column migrations for columns introduced after the
 * initial schema. `CREATE TABLE IF NOT EXISTS` in SCHEMA_DDL leaves
 * pre-existing tables untouched, so new optional columns are added
 * here with tolerated-duplicate behaviour.
 *
 * Add new entries at the bottom. Never rename or drop columns here —
 * that requires a proper migration with data rewrite.
 */
function ensureSchemaColumns(db: { exec: (sql: string) => void }): void {
  const additive: ReadonlyArray<{ table: string; column: string; ddl: string }> = [
    // Phase 1.0a Intent Lens Classification stores its chosen lens on
    // the workflow run so downstream phase handlers can read it
    // without re-querying the artifact_produced record.
    { table: 'workflow_runs', column: 'intent_lens', ddl: 'TEXT' },
    // Wave 6 — recursive requirements decomposition telemetry. Caps are
    // config-driven (see ConfigManager.decomposition.*); these counters
    // are written by the orchestrator at pass entry/exit and used to
    // enforce budget_cap / depth_cap safety rails.
    { table: 'workflow_runs', column: 'decomposition_budget_calls_used', ddl: 'INTEGER DEFAULT 0' },
    { table: 'workflow_runs', column: 'decomposition_max_depth_reached', ddl: 'INTEGER DEFAULT 0' },
  ];
  for (const { table, column, ddl } of additive) {
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('duplicate column name')) continue;
      throw err;
    }
  }
}

function initializeSidecar(options: DatabaseOptions): Database {
  if (!options.extensionPath) {
    throw new Error(
      'Sidecar mode requires options.extensionPath so we can locate ' +
        'dist/sidecar/dbServer.js and dist/rpcWorker.js.',
    );
  }
  if (options.path === ':memory:') {
    throw new Error('In-memory databases are not supported in sidecar mode.');
  }
  // The sidecar script runs SCHEMA_DDL + VECTOR_SEARCH_DDL on startup,
  // so no schema exec is needed here.
  return createDatabaseRPCClient(options.extensionPath, options.path);
}

/**
 * Create a temporary in-memory database for testing. Always direct mode.
 */
export function createTestDatabase(): Database {
  return initializeDirect({ path: ':memory:' });
}

/**
 * Close a WAL-mode SQLite database cleanly. Runs
 * `PRAGMA wal_checkpoint(TRUNCATE)` first so the on-disk .db file is
 * self-contained (no orphaned -wal sidecar) — matters whenever a user
 * wants to inspect the file with an external tool (online viewers, CLI
 * against just the .db, filesystem diff between runs).
 *
 * Without the explicit TRUNCATE, better-sqlite3's own close() performs
 * at most a PASSIVE checkpoint, which can leave a non-empty -wal file on
 * disk. Online SQLite viewers that only accept a single file upload then
 * see a nearly-empty database and fail with confusing "schema not found"
 * errors because the tables whose DDL was recorded during startup may
 * have been written to the .db fine, but their row data still lives in
 * the WAL. Worse, on an unclean extension shutdown (VS Code kill, crash)
 * even the initial schema write might not yet have been checkpointed.
 *
 * The pragma is best-effort — if it fails (another connection holds a
 * write lock, etc.) we still call close(), because correctness isn't
 * affected; only the shape of the .db on disk.
 */
export function closeWithCheckpoint(db: Pick<Database, 'pragma' | 'close'>): void {
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
  } catch {
    /* best-effort */
  }
  db.close();
}
