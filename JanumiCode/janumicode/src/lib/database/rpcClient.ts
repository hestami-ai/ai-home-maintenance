/**
 * Database RPC Client
 *
 * Drop-in replacement for better-sqlite3's Database object. Proxies all
 * calls through a Worker thread → sidecar process over SharedArrayBuffer.
 *
 * Store files call getDatabase().prepare(sql).run/get/all(...) — this class
 * provides that exact interface so no consumer code needs to change.
 */

import { Worker } from 'node:worker_threads';
import * as path from 'node:path';

// ── SharedArrayBuffer Layout (must match rpcWorker.ts) ───────────────

const CTRL_OFFSET = 0;
const DATA_OFFSET = 16;
const CTRL_IDLE = 0;
const CTRL_REQUEST_READY = 1;
const CTRL_RESPONSE_READY = 2;
const MAX_MSG_SIZE = 4 * 1024 * 1024; // 4MB per message
const SAB_SIZE = DATA_OFFSET + (MAX_MSG_SIZE * 2); // request + response regions

// ── Types ────────────────────────────────────────────────────────────

export interface RunResult {
	changes: number;
	lastInsertRowid: number | bigint;
}

interface RPCResponse {
	id: string;
	result?: unknown;
	error?: { code: string; message: string };
}

interface TransactionOp {
	method: 'run' | 'get' | 'all' | 'exec';
	sql: string;
	params?: unknown[];
}

// ── PreparedStatementProxy ───────────────────────────────────────────

/**
 * Mimics better-sqlite3's Statement interface.
 * Each call delegates to the RPC client synchronously.
 */
class PreparedStatementProxy {
	constructor(
		private _client: DatabaseRPCClient,
		private _sql: string,
	) {}

	run(...params: unknown[]): RunResult {
		return this._client._rpcSync('run', { sql: this._sql, params: this._flattenParams(params) }) as RunResult;
	}

	get(...params: unknown[]): unknown {
		return this._client._rpcSync('get', { sql: this._sql, params: this._flattenParams(params) });
	}

	all(...params: unknown[]): unknown[] {
		return this._client._rpcSync('all', { sql: this._sql, params: this._flattenParams(params) }) as unknown[];
	}

	private _flattenParams(params: unknown[]): unknown[] {
		// Stores call stmt.run(a, b, c) — positional params
		// Some call stmt.run({...}) — named params (single object arg)
		if (params.length === 1 && typeof params[0] === 'object' && params[0] !== null && !Array.isArray(params[0])) {
			return params; // Pass the object as-is for named binding
		}
		return params;
	}
}

// ── DatabaseRPCClient ────────────────────────────────────────────────

/**
 * Drop-in replacement for better-sqlite3's Database.
 * All calls are synchronous from the caller's perspective (using Atomics.wait).
 */
export class DatabaseRPCClient {
	private _worker: Worker;
	private _sharedBuffer: SharedArrayBuffer;
	private _ctrl: Int32Array;
	private _dataView: Uint8Array;
	private _encoder = new TextEncoder();
	private _decoder = new TextDecoder();
	private _nextId = 0;
	private _closed = false;

	/** Transaction recording state */
	private _recording = false;
	private _recordedOps: TransactionOp[] = [];

	/**
	 * Whether sqlite-vector extension was loaded by the sidecar.
	 * Set after the init RPC response.
	 */
	vectorLoaded = false;

	constructor(nodeBinary: string, sidecarScript: string, workerScript: string) {
		this._sharedBuffer = new SharedArrayBuffer(SAB_SIZE);
		this._ctrl = new Int32Array(this._sharedBuffer, CTRL_OFFSET, 4);
		this._dataView = new Uint8Array(this._sharedBuffer, DATA_OFFSET);

		// Initialize control to idle
		Atomics.store(this._ctrl, 0, CTRL_IDLE);

		this._worker = new Worker(workerScript, {
			workerData: {
				sharedBuffer: this._sharedBuffer,
				nodeBinary,
				sidecarScript,
			},
		});

		this._worker.on('message', (msg: { type: string; message?: string }) => {
			if (msg.type === 'log') {
				// Forward sidecar/worker logs to stderr (extension output channel picks these up)
				process.stderr?.write?.(`[db-sidecar] ${msg.message}\n`);
			}
		});

		this._worker.on('error', (err) => {
			process.stderr?.write?.(`[db-worker] Error: ${err.message}\n`);
		});

		// Block until worker is ready (sidecar has started)
		this._waitForReady();
	}

	// ── Public API (matches better-sqlite3 Database interface) ────────

	prepare(sql: string): PreparedStatementProxy {
		return new PreparedStatementProxy(this, sql);
	}

	pragma(pragma: string, options?: { simple?: boolean }): unknown {
		return this._rpcSync('pragma', { pragma, simple: options?.simple ?? false });
	}

	exec(sql: string): void {
		this._rpcSync('exec', { sql });
	}

	backup(destPath: string): void {
		this._rpcSync('backup', { path: destPath });
	}

	close(): void {
		if (this._closed) { return; }
		this._closed = true;
		try {
			this._rpcSync('close', {});
		} catch {
			// Sidecar may already be dead
		}
		this._worker.postMessage({ type: 'shutdown' });
		// Give the worker a moment to clean up, then terminate
		setTimeout(() => {
			this._worker.terminate().catch(() => {});
		}, 3000);
	}

	/**
	 * Transaction support via recording pattern.
	 *
	 * Enters "recording mode" during fn() execution — prepare().run/get/all
	 * calls are captured instead of sent. After fn() returns, all recorded
	 * operations are sent as a single atomic transaction batch.
	 *
	 * Limitation: get()/all() return null/[] during recording since the
	 * operations haven't executed yet. This is acceptable because all
	 * existing transactions use pre-generated UUIDs and don't depend on
	 * intermediate query results.
	 */
	transaction<T>(fn: (db: DatabaseRPCClient) => T): (...args: unknown[]) => T {
		return (..._args: unknown[]) => {
			if (this._recording) {
				// Nested transaction — just execute directly (SQLite savepoints)
				return fn(this);
			}

			this._recording = true;
			this._recordedOps = [];

			let capturedResult: T;
			try {
				capturedResult = fn(this);
			} finally {
				this._recording = false;
			}

			// Send all recorded ops as an atomic batch
			if (this._recordedOps.length > 0) {
				this._rpcSync('transaction', { operations: this._recordedOps });
			}
			this._recordedOps = [];

			return capturedResult;
		};
	}

	// ── Internal RPC ─────────────────────────────────────────────────

	/**
	 * Synchronous RPC call via SharedArrayBuffer + Atomics.wait.
	 *
	 * If in recording mode (inside a transaction fn), run/get/all/exec
	 * operations are captured instead of sent.
	 */
	_rpcSync(method: string, params: Record<string, unknown>): unknown {
		// Transaction recording — capture instead of execute
		if (this._recording && (method === 'run' || method === 'get' || method === 'all' || method === 'exec')) {
			this._recordedOps.push({
				method: method as TransactionOp['method'],
				sql: params.sql as string,
				params: params.params as unknown[] | undefined,
			});
			// Return stub values
			if (method === 'run') { return { changes: 0, lastInsertRowid: 0 }; }
			if (method === 'get') { return null; }
			if (method === 'all') { return []; }
			return undefined;
		}

		if (this._closed) {
			throw new Error('Database connection is closed');
		}

		const id = `rpc_${this._nextId++}`;
		const reqJson = JSON.stringify({ id, method, params });
		const reqBytes = this._encoder.encode(reqJson);

		if (reqBytes.length > MAX_MSG_SIZE) {
			throw new Error(`Request too large: ${reqBytes.length} bytes (max ${MAX_MSG_SIZE})`);
		}

		// Write request to SAB
		this._dataView.set(reqBytes, 0);
		this._ctrl[1] = reqBytes.length; // request length

		// Signal request ready and wake worker
		Atomics.store(this._ctrl, 0, CTRL_REQUEST_READY);
		Atomics.notify(this._ctrl, 0);

		// Block until response is ready
		// Timeout: 60 seconds (generous for large operations like backup)
		const waitResult = Atomics.wait(this._ctrl, 0, CTRL_REQUEST_READY, 60_000);
		if (waitResult === 'timed-out') {
			Atomics.store(this._ctrl, 0, CTRL_IDLE);
			throw new Error(`RPC call '${method}' timed out after 60s`);
		}

		// Read response from SAB
		const respLen = this._ctrl[2]; // response length
		const respBytes = this._dataView.slice(MAX_MSG_SIZE, MAX_MSG_SIZE + respLen);
		const respJson = this._decoder.decode(respBytes);

		// Reset control to idle
		Atomics.store(this._ctrl, 0, CTRL_IDLE);

		const resp: RPCResponse = JSON.parse(respJson);
		if (resp.error) {
			const err = new Error(resp.error.message);
			(err as Error & { code?: string }).code = resp.error.code;
			throw err;
		}

		return resp.result;
	}

	// ── Private helpers ──────────────────────────────────────────────

	/**
	 * Block until the worker signals ready (sidecar has started).
	 * Uses Atomics.wait on ctrl[3] (the ready flag in SharedArrayBuffer).
	 * This works because Atomics.wait blocks without needing the event loop,
	 * and the worker sets ctrl[3] via Atomics.store + Atomics.notify.
	 */
	private _waitForReady(): void {
		// ctrl[3] = ready flag. Worker sets it to 1 when sidecar is ready.
		const result = Atomics.wait(this._ctrl, 3, 0, 30_000);
		if (result === 'timed-out') {
			throw new Error('Timed out waiting for database sidecar to start');
		}
	}
}

// ── Factory ──────────────────────────────────────────────────────────

/**
 * Resolve paths and create a DatabaseRPCClient.
 * extensionPath is the root of the extension (where dist/ lives).
 */
export function createDatabaseRPCClient(extensionPath: string): DatabaseRPCClient {
	// In production: use bundled runtime/node
	// In development: use system 'node' from PATH (NOT process.execPath which is Electron)
	const runtimeNodePath = path.join(extensionPath, 'runtime', process.platform === 'win32' ? 'node.exe' : 'node');
	const nodeBinary = require('fs').existsSync(runtimeNodePath)
		? runtimeNodePath
		: (process.platform === 'win32' ? 'node.exe' : 'node');

	const sidecarScript = path.join(extensionPath, 'dist', 'sidecar', 'dbServer.js');
	const workerScript = path.join(extensionPath, 'dist', 'rpcWorker.js');

	return new DatabaseRPCClient(nodeBinary, sidecarScript, workerScript);
}
