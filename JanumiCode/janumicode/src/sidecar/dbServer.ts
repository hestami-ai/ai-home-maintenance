/**
 * Database Sidecar Server
 *
 * Standalone Node.js process that owns the better-sqlite3 connection.
 * Communicates with the extension host via NDJSON over stdio.
 *
 * This process runs under a bundled Node.js LTS binary (not Electron),
 * so the native better-sqlite3 addon always matches the Node ABI.
 *
 * Usage:
 *   node dist/sidecar/dbServer.js
 *
 * Protocol: One JSON object per line on stdin (requests) and stdout (responses).
 * stderr is reserved for diagnostics (never protocol).
 */

import Database from 'better-sqlite3';
import { createInterface } from 'node:readline';
import * as path from 'node:path';
import * as fs from 'node:fs';

// ── Types ────────────────────────────────────────────────────────────

interface RPCRequest {
	id: string;
	method: string;
	params: Record<string, unknown>;
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

// ── State ────────────────────────────────────────────────────────────

let db: Database.Database | null = null;
let vectorLoaded = false;

/**
 * Prepared statement cache — avoids re-parsing hot SQL strings.
 * Bounded by MAX_CACHE_SIZE; evicts oldest entries (FIFO) when full.
 */
const stmtCache = new Map<string, Database.Statement>();
const MAX_CACHE_SIZE = 500;

function getStmt(sql: string): Database.Statement {
	let stmt = stmtCache.get(sql);
	if (!stmt) {
		stmt = db!.prepare(sql);
		stmtCache.set(sql, stmt);
		// FIFO eviction
		if (stmtCache.size > MAX_CACHE_SIZE) {
			const oldest = stmtCache.keys().next().value as string;
			stmtCache.delete(oldest);
		}
	}
	return stmt;
}

function clearStmtCache(): void {
	stmtCache.clear();
}

// ── Helpers ──────────────────────────────────────────────────────────

function requireDb(): Database.Database {
	if (!db) {
		throw Object.assign(new Error('Database not initialized'), { code: 'DB_NOT_INIT' });
	}
	return db;
}

/** Flatten params: handles both positional array and single-object (named) */
function flattenParams(params: unknown): unknown[] {
	if (params === undefined || params === null) { return []; }
	if (Array.isArray(params)) { return params; }
	return [params];
}

// ── Method Handlers ──────────────────────────────────────────────────

function handleInit(params: Record<string, unknown>): unknown {
	const dbPath = params.path as string;
	if (!dbPath) {
		throw Object.assign(new Error('Missing required param: path'), { code: 'INVALID_PARAMS' });
	}

	// Close existing connection if any
	if (db) {
		clearStmtCache();
		db.close();
		db = null;
		vectorLoaded = false;
	}

	// Ensure directory exists
	const dbDir = path.dirname(dbPath);
	if (!fs.existsSync(dbDir)) {
		fs.mkdirSync(dbDir, { recursive: true });
	}

	db = new Database(dbPath, {
		readonly: (params.readonly as boolean) ?? false,
		fileMustExist: (params.fileMustExist as boolean) ?? false,
		timeout: (params.timeout as number) ?? 5000,
	});

	// Load sqlite-vector extension (optional)
	try {
		 
		const { getExtensionPath } = require('@sqliteai/sqlite-vector');
		db.loadExtension(getExtensionPath());
		vectorLoaded = true;
	} catch {
		vectorLoaded = false;
	}

	// Pragmas
	db.pragma('foreign_keys = ON');
	db.pragma('journal_mode = WAL');
	db.pragma('synchronous = NORMAL');
	db.pragma(`busy_timeout = ${(params.timeout as number) ?? 5000}`);

	return { ok: true, vectorLoaded };
}

function handleClose(): unknown {
	if (db) {
		clearStmtCache();
		db.close();
		db = null;
		vectorLoaded = false;
	}
	return { ok: true };
}

function handleRun(params: Record<string, unknown>): unknown {
	requireDb();
	const sql = params.sql as string;
	const p = flattenParams(params.params);
	const result = getStmt(sql).run(...p);
	return {
		changes: result.changes,
		lastInsertRowid: typeof result.lastInsertRowid === 'bigint'
			? Number(result.lastInsertRowid)
			: result.lastInsertRowid,
	};
}

function handleGet(params: Record<string, unknown>): unknown {
	requireDb();
	const sql = params.sql as string;
	const p = flattenParams(params.params);
	return getStmt(sql).get(...p) ?? null;
}

function handleAll(params: Record<string, unknown>): unknown {
	requireDb();
	const sql = params.sql as string;
	const p = flattenParams(params.params);
	return getStmt(sql).all(...p);
}

function handleExec(params: Record<string, unknown>): unknown {
	requireDb().exec(params.sql as string);
	return { ok: true };
}

function handleTransaction(params: Record<string, unknown>): unknown {
	const d = requireDb();
	const operations = params.operations as TransactionOp[];
	if (!Array.isArray(operations)) {
		throw Object.assign(new Error('transaction requires operations array'), { code: 'INVALID_PARAMS' });
	}

	const txn = d.transaction((ops: TransactionOp[]) => {
		return ops.map(op => {
			switch (op.method) {
				case 'run': {
					const result = getStmt(op.sql).run(...flattenParams(op.params));
					return {
						changes: result.changes,
						lastInsertRowid: typeof result.lastInsertRowid === 'bigint'
							? Number(result.lastInsertRowid)
							: result.lastInsertRowid,
					};
				}
				case 'get':
					return getStmt(op.sql).get(...flattenParams(op.params)) ?? null;
				case 'all':
					return getStmt(op.sql).all(...flattenParams(op.params));
				case 'exec':
					d.exec(op.sql);
					return { ok: true };
				default:
					throw new Error(`Unknown transaction op method: ${op.method}`);
			}
		});
	});

	return txn(operations);
}

function handlePragma(params: Record<string, unknown>): unknown {
	const d = requireDb();
	const pragma = params.pragma as string;
	const simple = (params.simple as boolean) ?? false;
	return d.pragma(pragma, { simple });
}

function handleBackup(params: Record<string, unknown>): unknown {
	const d = requireDb();
	const backupPath = params.path as string;
	if (!backupPath) {
		throw Object.assign(new Error('Missing required param: path'), { code: 'INVALID_PARAMS' });
	}
	const backupDir = path.dirname(backupPath);
	if (!fs.existsSync(backupDir)) {
		fs.mkdirSync(backupDir, { recursive: true });
	}
	d.backup(backupPath);
	return { ok: true };
}

function handleStats(): unknown {
	const d = requireDb();
	const pageCount = d.pragma('page_count', { simple: true }) as number;
	const pageSize = d.pragma('page_size', { simple: true }) as number;
	const journalMode = d.pragma('journal_mode', { simple: true }) as string;
	return {
		pageCount,
		pageSize,
		sizeBytes: pageCount * pageSize,
		walMode: journalMode.toLowerCase() === 'wal',
	};
}

function handleClearAllData(params: Record<string, unknown>): unknown {
	const d = requireDb();
	const tables = params.tables as string[];
	if (!Array.isArray(tables)) {
		throw Object.assign(new Error('clearAllData requires tables array'), { code: 'INVALID_PARAMS' });
	}

	const txn = d.transaction((tableList: string[]) => {
		for (const table of tableList) {
			const exists = d
				.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
				.get(table);
			if (exists) {
				d.prepare(`DELETE FROM ${table}`).run();
			}
		}
	});
	txn(tables);

	return { ok: true };
}

function handleVectorInit(): unknown {
	const d = requireDb();
	if (!vectorLoaded) {
		return { ok: false, reason: 'sqlite-vector not loaded' };
	}
	try {
		d.prepare("SELECT vector_init('embeddings', 'embedding', 'dimension=1024,type=FLOAT32,distance=COSINE')").get();
	} catch {
		// Table may not exist yet or vector_init already called
	}
	return { ok: true };
}

function handlePing(): unknown {
	if (db) {
		db.prepare('SELECT 1').get();
	}
	return { ok: true };
}

// ── Dispatch ─────────────────────────────────────────────────────────

function dispatch(method: string, params: Record<string, unknown>): unknown {
	switch (method) {
		case 'init':          return handleInit(params);
		case 'close':         return handleClose();
		case 'run':           return handleRun(params);
		case 'get':           return handleGet(params);
		case 'all':           return handleAll(params);
		case 'exec':          return handleExec(params);
		case 'transaction':   return handleTransaction(params);
		case 'pragma':        return handlePragma(params);
		case 'backup':        return handleBackup(params);
		case 'stats':         return handleStats();
		case 'clearAllData':  return handleClearAllData(params);
		case 'vectorInit':    return handleVectorInit();
		case 'ping':          return handlePing();
		default:
			throw Object.assign(new Error(`Unknown method: ${method}`), { code: 'METHOD_NOT_FOUND' });
	}
}

// ── Main ─────────────────────────────────────────────────────────────

function main(): void {
	const rl = createInterface({ input: process.stdin, terminal: false });

	rl.on('line', (line: string) => {
		if (!line.trim()) { return; }

		let req: RPCRequest;
		try {
			req = JSON.parse(line);
		} catch {
			const resp: RPCResponse = {
				id: '__parse_error__',
				error: { code: 'PARSE_ERROR', message: 'Invalid JSON' },
			};
			process.stdout.write(JSON.stringify(resp) + '\n');
			return;
		}

		let resp: RPCResponse;
		try {
			const result = dispatch(req.method, req.params ?? {});
			resp = { id: req.id, result };
		} catch (err: unknown) {
			const e = err as Error & { code?: string };
			resp = {
				id: req.id,
				error: {
					code: e.code ?? 'INTERNAL_ERROR',
					message: e.message,
				},
			};
		}

		process.stdout.write(JSON.stringify(resp) + '\n');
	});

	rl.on('close', () => {
		// Parent closed stdin — shut down gracefully
		if (db) {
			clearStmtCache();
			db.close();
			db = null;
		}
		process.exit(0);
	});

	// Signal readiness
	process.stdout.write(JSON.stringify({ id: '__ready__', result: { ready: true } }) + '\n');
}

// Entry point guard
if (require.main === module) {
	main();
}
