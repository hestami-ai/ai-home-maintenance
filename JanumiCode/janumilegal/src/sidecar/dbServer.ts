/**
 * Database sidecar process.
 *
 * Decouples better-sqlite3's native ABI from the VS Code Electron host.
 * The extension host spawns this process with `child_process.fork` (or
 * spawn-with-stdio) and exchanges NDJSON messages over stdin/stdout.
 *
 * Wave 0: implements the NDJSON protocol and the SQL execution surface.
 * Wave 1+ adds: SharedArrayBuffer sync bridge for synchronous extension-host
 * code paths, request batching, and connection pooling for per-matter files.
 */

import Database from 'better-sqlite3';
import readline from 'node:readline';
import type { RpcRequest, RpcResponse } from '../lib/database/types.js';
import { runMigrations, validateSchema } from '../lib/database/migrations.js';

const connections = new Map<string, Database.Database>();

function send(resp: RpcResponse): void {
  process.stdout.write(JSON.stringify(resp) + '\n');
}

function handle(req: RpcRequest): RpcResponse {
  try {
    if (req.method === 'open') {
      if (!req.dbPath) throw new Error('open requires dbPath');
      let db = connections.get(req.dbPath);
      if (!db) {
        db = new Database(req.dbPath);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
        runMigrations(db);
        const v = validateSchema(db);
        if (!v.ok) throw new Error('schema validation failed: ' + v.errors.join('; '));
        connections.set(req.dbPath, db);
      }
      return { id: req.id, ok: true, result: { opened: true } };
    }

    if (req.method === 'close') {
      if (!req.dbPath) throw new Error('close requires dbPath');
      const db = connections.get(req.dbPath);
      if (db) {
        db.close();
        connections.delete(req.dbPath);
      }
      return { id: req.id, ok: true };
    }

    if (!req.dbPath) throw new Error('sql request requires dbPath');
    const db = connections.get(req.dbPath);
    if (!db) throw new Error(`db not open: ${req.dbPath}`);
    if (!req.sql) throw new Error('missing sql');

    const params = (req.params ?? []) as readonly unknown[];

    switch (req.method) {
      case 'exec': {
        db.exec(req.sql);
        return { id: req.id, ok: true };
      }
      case 'all': {
        const rows = db.prepare(req.sql).all(...params);
        return { id: req.id, ok: true, result: rows };
      }
      case 'get': {
        const row = db.prepare(req.sql).get(...params);
        return { id: req.id, ok: true, result: row };
      }
      case 'run': {
        const info = db.prepare(req.sql).run(...params);
        return {
          id: req.id,
          ok: true,
          result: {
            changes: info.changes,
            lastInsertRowid: Number(info.lastInsertRowid),
          },
        };
      }
      default:
        throw new Error(`unknown method: ${(req as RpcRequest).method}`);
    }
  } catch (err) {
    return { id: req.id, ok: false, error: (err as Error).message };
  }
}

const rl = readline.createInterface({ input: process.stdin, terminal: false });
rl.on('line', (line) => {
  if (!line.trim()) return;
  let req: RpcRequest;
  try {
    req = JSON.parse(line) as RpcRequest;
  } catch (err) {
    send({ id: 'parse_error', ok: false, error: (err as Error).message });
    return;
  }
  send(handle(req));
});

process.on('SIGTERM', () => {
  for (const db of connections.values()) {
    try {
      db.close();
    } catch {
      // best effort
    }
  }
  process.exit(0);
});
