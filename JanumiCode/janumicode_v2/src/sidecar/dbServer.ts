/**
 * JanumiCode v2 — Database Sidecar Server
 *
 * Standalone Node.js process that owns the better-sqlite3 connection.
 * Communicates with the extension host via NDJSON over stdio.
 *
 * Protocol:
 *   Request:  {"id":"req-1","method":"exec|run|get|all|pragma","params":{"sql":"...","params":[...]}}
 *   Response: {"id":"req-1","result":...} or {"id":"req-1","error":"..."}
 *
 * Ported from v1 pattern at JanumiCode/janumicode/src/sidecar/dbServer.ts
 */

import { createInterface } from 'readline';
import { SCHEMA_DDL, VECTOR_SEARCH_DDL } from '../lib/database/schema';

// ── Types ───────────────────────────────────────────────────────────

interface RpcRequest {
  id: string;
  method: 'exec' | 'run' | 'get' | 'all' | 'pragma' | 'close' | 'ping';
  params?: {
    sql?: string;
    params?: unknown[];
    pragma?: string;
  };
}

interface RpcResponse {
  id: string;
  result?: unknown;
  error?: string;
}

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
        const rows = stmt.all(...(req.params?.params ?? []));
        return { id: req.id, result: rows };
      }

      case 'pragma': {
        const result = db.pragma(req.params?.pragma ?? '');
        return { id: req.id, result };
      }

      case 'close':
        db.close();
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
  try { db.close(); } catch { /* ignore */ }
  process.exit(0);
});

// Signal readiness
process.stdout.write(JSON.stringify({ id: '__ready__', result: { pid: process.pid, dbPath } }) + '\n');
