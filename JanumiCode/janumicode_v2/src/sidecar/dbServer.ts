/**
 * JanumiCode v2 — Database Sidecar Server
 *
 * Standalone Node.js process that owns the better-sqlite3 connection.
 * Communicates with the extension host via NDJSON over stdio.
 *
 * Protocol:
 *   Request:  {"id":"req-1","method":"exec|run|get|all|pragma","params":{"sql":"...","params":[...]}}
 *   Response: {"id":"req-1","result":...} or {"id":"req-1","error":"..."} or
 *             {"id":"req-1","error":{ code: ..., ... }}    ← structured error
 *
 * Ported from v1 pattern at JanumiCode/janumicode/src/sidecar/dbServer.ts
 */

import { createInterface } from 'readline';
import { SCHEMA_DDL, VECTOR_SEARCH_DDL } from '../lib/database/schema';
import { closeWithCheckpoint } from '../lib/database/init';
import {
  DEFAULT_MAX_ROWS_PER_RPC,
  DEFAULT_MAX_BYTES_PER_RPC,
  enforceRpcResultLimits,
} from './dbServerLimits';

// ── Types ───────────────────────────────────────────────────────────

interface RpcRequest {
  id: string;
  method: 'exec' | 'run' | 'get' | 'all' | 'pragma' | 'close' | 'ping';
  params?: {
    sql?: string;
    params?: unknown[];
    pragma?: string;
    /**
     * Optional per-call override for the row ceiling. Callers acknowledge
     * the SAB-bridge risk explicitly when supplying this. Default comes
     * from JANUMICODE_RPC_MAX_ROWS env or the constant at top.
     */
    maxRows?: number;
    /**
     * Optional per-call override for the byte ceiling.
     * Default comes from JANUMICODE_RPC_MAX_BYTES env.
     */
    maxBytes?: number;
  };
}

interface RpcResponse {
  id: string;
  result?: unknown;
  /** Either a plain message string, or a structured error object (e.g. RpcResultTooLarge). */
  error?: string | Record<string, unknown>;
}

// ── Result-size ceilings ────────────────────────────────────────────
//
// Last line of defense against client-side `.all()` queries that would
// blow the 32MB SharedArrayBuffer that bridges the sidecar to the
// extension host. Configurable via env so cal-runs can probe behavior
// without rebuilding. Per-call overrides are accepted in the RPC params
// and take precedence over these defaults.

const MAX_ROWS_PER_RPC = process.env.JANUMICODE_RPC_MAX_ROWS
  ? Number.parseInt(process.env.JANUMICODE_RPC_MAX_ROWS, 10) || DEFAULT_MAX_ROWS_PER_RPC
  : DEFAULT_MAX_ROWS_PER_RPC;

const MAX_BYTES_PER_RPC = process.env.JANUMICODE_RPC_MAX_BYTES
  ? Number.parseInt(process.env.JANUMICODE_RPC_MAX_BYTES, 10) || DEFAULT_MAX_BYTES_PER_RPC
  : DEFAULT_MAX_BYTES_PER_RPC;

// ── Startup ─────────────────────────────────────────────────────────

const dbPath = process.argv[2];
if (!dbPath) {
  process.stderr.write('Usage: node dbServer.js <db-path>\n');
  process.exit(1);
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Database = require('better-sqlite3');
const db = new Database(dbPath);

// Initialize schema. The vector-search table is a plain BLOB-backed table
// (no sqlite-vec dependency), created unconditionally alongside the base schema.
db.exec(SCHEMA_DDL);
db.exec(VECTOR_SEARCH_DDL);

// ── Statement Cache ─────────────────────────────────────────────────

const CACHE_MAX = 500;
const stmtCache = new Map<string, ReturnType<typeof db.prepare>>();

function getCachedStatement(sql: string) {
  let stmt = stmtCache.get(sql);
  if (!stmt) {
    stmt = db.prepare(sql);
    stmtCache.set(sql, stmt);

    // FIFO eviction
    if (stmtCache.size > CACHE_MAX) {
      const firstKey = stmtCache.keys().next().value;
      if (firstKey !== undefined) {
        stmtCache.delete(firstKey);
      }
    }
  }
  return stmt;
}

// ── Request Handler ─────────────────────────────────────────────────

function handleRequest(req: RpcRequest): RpcResponse {
  try {
    switch (req.method) {
      case 'ping':
        return { id: req.id, result: 'pong' };

      case 'exec':
        db.exec(req.params?.sql ?? '');
        return { id: req.id, result: { changes: 0 } };

      case 'run': {
        const stmt = getCachedStatement(req.params?.sql ?? '');
        const info = stmt.run(...(req.params?.params ?? []));
        return {
          id: req.id,
          result: {
            changes: info.changes,
            lastInsertRowid: Number(info.lastInsertRowid),
          },
        };
      }

      case 'get': {
        const stmt = getCachedStatement(req.params?.sql ?? '');
        const row = stmt.get(...(req.params?.params ?? []));
        return { id: req.id, result: row ?? null };
      }

      case 'all': {
        const stmt = getCachedStatement(req.params?.sql ?? '');
        const rows = stmt.all(...(req.params?.params ?? [])) as unknown[];
        // Enforce server-side row/byte ceilings BEFORE handing rows to
        // the SAB bridge. A structured RpcResultTooLarge error here is
        // far more actionable than the cryptic "offset is out of bounds"
        // RangeError the SAB write would otherwise raise.
        const maxRows = req.params?.maxRows ?? MAX_ROWS_PER_RPC;
        const maxBytes = req.params?.maxBytes ?? MAX_BYTES_PER_RPC;
        const limitError = enforceRpcResultLimits(rows, { maxRows, maxBytes });
        if (limitError) {
          return { id: req.id, error: limitError };
        }
        return { id: req.id, result: rows };
      }

      case 'pragma': {
        const result = db.pragma(req.params?.pragma ?? '');
        return { id: req.id, result };
      }

      case 'close':
        closeCleanly();
        return { id: req.id, result: 'closed' };

      default:
        return { id: req.id, error: `Unknown method: ${req.method}` };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { id: req.id, error: message };
  }
}

// ── NDJSON stdio transport ──────────────────────────────────────────

const rl = createInterface({ input: process.stdin });

rl.on('line', (line) => {
  try {
    const req = JSON.parse(line) as RpcRequest;
    const res = handleRequest(req);
    process.stdout.write(JSON.stringify(res) + '\n');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    process.stdout.write(JSON.stringify({ id: 'unknown', error: `Parse error: ${message}` }) + '\n');
  }
});

rl.on('close', () => {
  try { closeCleanly(); } catch { /* ignore */ }
  process.exit(0);
});

function closeCleanly(): void {
  closeWithCheckpoint(db);
}

// Signal readiness
process.stdout.write(JSON.stringify({ id: '__ready__', result: { pid: process.pid, dbPath } }) + '\n');
