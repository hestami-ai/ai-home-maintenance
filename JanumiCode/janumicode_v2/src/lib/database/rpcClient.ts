/**
 * Database RPC Client — synchronous bridge to the sidecar process.
 *
 * Uses SharedArrayBuffer + Atomics.wait/notify to make async IPC
 * appear synchronous to callers (stores, GovernedStreamWriter, etc.).
 *
 * Architecture:
 *   Extension Host (main thread)
 *     ↕ SharedArrayBuffer + Atomics
 *   RPC Worker (worker_threads)
 *     ↕ NDJSON over stdio
 *   Sidecar Process (child_process)
 *     ↕ better-sqlite3
 *   SQLite DB
 *
 * Ported from v1 pattern. Implements the Database interface from init.ts.
 */

import { Worker } from 'worker_threads';
import * as path from 'node:path';
import * as fs from 'node:fs';
import type { Database, Statement, RunResult } from './init';

// ── SharedArrayBuffer Layout ────────────────────────────────────────
//
// Byte 0-3:   Int32 control flag (0=idle, 1=request pending, 2=response ready, 3=error)
// Byte 4-7:   Int32 response length
// Byte 8+:    Request/response data (UTF-8 encoded JSON)
//
const CTRL_OFFSET = 0;
const LEN_OFFSET = 1; // Int32 index (byte 4)
const DATA_OFFSET = 8;
const BUFFER_SIZE = 4 * 1024 * 1024; // 4MB max per message

const CTRL_IDLE = 0;
const CTRL_REQUEST = 1;
const CTRL_RESPONSE = 2;
const CTRL_ERROR = 3;

export interface RpcClientOptions {
  /** Path to the database file */
  dbPath: string;
  /** Path to the RPC worker script (dist/rpcWorker.js) */
  workerPath: string;
  /** Path to the sidecar script (dist/sidecar/dbServer.js) */
  sidecarPath: string;
  /** Path to Node.js binary for sidecar (defaults to process.execPath) */
  nodePath?: string;
}

export class DatabaseRPCClient implements Database {
  private sab: SharedArrayBuffer;
  private ctrl: Int32Array;
  private data: Uint8Array;
  private worker: Worker;
  private closed = false;

  constructor(options: RpcClientOptions) {
    this.sab = new SharedArrayBuffer(BUFFER_SIZE);
    this.ctrl = new Int32Array(this.sab, 0, 2);
    this.data = new Uint8Array(this.sab, DATA_OFFSET);

    this.worker = new Worker(options.workerPath, {
      workerData: {
        sab: this.sab,
        dbPath: options.dbPath,
        sidecarPath: options.sidecarPath,
        nodePath: options.nodePath ?? process.execPath,
      },
    });

    // Wait for worker to signal ready
    this.callSync('ping', {});
  }

  // ── Database Interface ──────────────────────────────────────────

  prepare(sql: string): Statement {
    return new RpcStatement(this, sql);
  }

  exec(sql: string): void {
    this.callSync('exec', { sql });
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    try {
      this.callSync('close', {});
    } catch {
      // Best effort
    }
    this.worker.terminate();
  }

  transaction<T>(fn: () => T): () => T {
    return () => {
      this.exec('BEGIN');
      try {
        const result = fn();
        this.exec('COMMIT');
        return result;
      } catch (err) {
        this.exec('ROLLBACK');
        throw err;
      }
    };
  }

  pragma(pragma: string): unknown {
    return this.callSync('pragma', { pragma });
  }

  // ── Synchronous RPC ─────────────────────────────────────────────

  callSync(method: string, params: Record<string, unknown>): unknown {
    if (this.closed && method !== 'close') {
      throw new Error('Database connection is closed');
    }

    const request = JSON.stringify({ method, params });
    const encoded = new TextEncoder().encode(request);

    if (encoded.byteLength > BUFFER_SIZE - DATA_OFFSET) {
      throw new Error(`RPC request too large: ${encoded.byteLength} bytes (max ${BUFFER_SIZE - DATA_OFFSET})`);
    }

    // Write request to shared buffer
    this.data.set(encoded);
    Atomics.store(this.ctrl, LEN_OFFSET, encoded.byteLength);
    Atomics.store(this.ctrl, CTRL_OFFSET, CTRL_REQUEST);
    Atomics.notify(this.ctrl, CTRL_OFFSET);

    // Wait for response
    const timeout = 30000; // 30s
    const waitResult = Atomics.wait(this.ctrl, CTRL_OFFSET, CTRL_REQUEST, timeout);

    if (waitResult === 'timed-out') {
      throw new Error(`RPC call timed out after ${timeout}ms: ${method}`);
    }

    const ctrlValue = Atomics.load(this.ctrl, CTRL_OFFSET);
    const responseLen = Atomics.load(this.ctrl, LEN_OFFSET);
    const responseBytes = this.data.slice(0, responseLen);
    const responseJson = new TextDecoder().decode(responseBytes);

    // Reset control flag
    Atomics.store(this.ctrl, CTRL_OFFSET, CTRL_IDLE);

    if (ctrlValue === CTRL_ERROR) {
      throw new Error(`RPC error: ${responseJson}`);
    }

    try {
      return JSON.parse(responseJson);
    } catch {
      return responseJson;
    }
  }
}

// ── RPC Statement ───────────────────────────────────────────────────

class RpcStatement implements Statement {
  constructor(
    private client: DatabaseRPCClient,
    private sql: string,
  ) {}

  run(...params: unknown[]): RunResult {
    const result = this.client.callSync('run', {
      sql: this.sql,
      params,
    }) as { changes: number; lastInsertRowid: number };

    return {
      changes: result.changes,
      lastInsertRowid: result.lastInsertRowid,
    };
  }

  get(...params: unknown[]): unknown {
    return this.client.callSync('get', {
      sql: this.sql,
      params,
    });
  }

  all(...params: unknown[]): unknown[] {
    return this.client.callSync('all', {
      sql: this.sql,
      params,
    }) as unknown[];
  }

  bind(..._params: unknown[]): Statement {
    // bind() not used in JanumiCode — parameters passed directly to run/get/all
    return this;
  }
}

// ── Factory ──────────────────────────────────────────────────────────

/**
 * Resolve script paths + node binary and create a DatabaseRPCClient.
 *
 * `extensionPath` is the root of the extension, where `dist/` lives.
 *
 * The Node binary picked here MUST match the ABI that `better-sqlite3` was
 * compiled against. In Electron the extension host's `process.execPath`
 * points at the Electron binary, whose NODE_MODULE_VERSION usually differs
 * from the version pnpm installed against — loading the native module in-
 * process throws the "compiled against a different Node.js" error the user
 * hit. We therefore:
 *
 *   1. Prefer a bundled runtime at `<extensionPath>/runtime/node[.exe]`
 *      (marketplace builds can ship one).
 *   2. Fall back to system `node` from PATH (which is the same Node that
 *      ran `pnpm install`, so the prebuilt binary matches).
 *
 * We explicitly do NOT use `process.execPath` here.
 */
export function createDatabaseRPCClient(
  extensionPath: string,
  dbPath: string,
): DatabaseRPCClient {
  const runtimeNodeName = process.platform === 'win32' ? 'node.exe' : 'node';
  const bundledNode = path.join(extensionPath, 'runtime', runtimeNodeName);
  const nodeBinary = fs.existsSync(bundledNode) ? bundledNode : runtimeNodeName;

  const sidecarPath = path.join(extensionPath, 'dist', 'sidecar', 'dbServer.js');
  const workerPath = path.join(extensionPath, 'dist', 'rpcWorker.js');

  if (!fs.existsSync(sidecarPath)) {
    throw new Error(`Sidecar script not found at ${sidecarPath}`);
  }
  if (!fs.existsSync(workerPath)) {
    throw new Error(`RPC worker script not found at ${workerPath}`);
  }

  return new DatabaseRPCClient({
    dbPath,
    workerPath,
    sidecarPath,
    nodePath: nodeBinary,
  });
}
