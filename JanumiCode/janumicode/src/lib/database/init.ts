/**
 * Database Initialization and Connection Management
 *
 * Uses a sidecar process for SQLite access. The sidecar runs under a
 * separate Node.js binary (bundled or system), fully decoupled from
 * Electron's ABI. Communication is via NDJSON over stdio, bridged
 * synchronously through SharedArrayBuffer + Atomics.wait.
 *
 * All 9 store files and 58 consumer files use getDatabase() to get the
 * database instance — they are unchanged.
 */

import type Database from 'better-sqlite3';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import type { Result } from '../types';
import { DatabaseRPCClient, createDatabaseRPCClient } from './rpcClient';

// ── Singleton ────────────────────────────────────────────────────────

/**
 * The RPC client instance, typed as Database.Database for consumer compatibility.
 * Stores call getDatabase().prepare(sql).run/get/all() — the RPC client
 * implements this exact interface.
 */
let dbInstance: Database.Database | null = null;

/** The underlying RPC client (for sidecar-specific operations) */
let rpcClient: DatabaseRPCClient | null = null;

/** Whether sqlite-vector extension was successfully loaded by the sidecar */
let sqliteVectorLoaded = false;
let activeDatabasePath: string | null = null;
let activeDatabaseInstanceId: string | null = null;
let dbInstanceCounter = 0;

// ── Configuration ────────────────────────────────────────────────────

export interface DatabaseConfig {
	path: string;
	readonly?: boolean;
	fileMustExist?: boolean;
	timeout?: number;
	verbose?: (message?: unknown, ...additionalArgs: unknown[]) => void;
	/** Extension root path — needed to locate sidecar, worker, and bundled node */
	extensionPath?: string;
	/** Connection strategy. default: 'auto' */
	connectionMode?: DatabaseConnectionMode;
}

export type DatabaseConnectionMode = 'auto' | 'direct' | 'sidecar';

let activeConnectionMode: Exclude<DatabaseConnectionMode, 'auto'> | null = null;

// ── Initialization ───────────────────────────────────────────────────

/**
 * Try to load better-sqlite3 directly (works when the Node ABI matches,
 * i.e. in tests, CLI scripts, and development outside Electron).
 * Returns null if the native module can't be loaded (ABI mismatch in Electron).
 */
function tryDirectInit(config: DatabaseConfig): Database.Database | null {
	try {
		const BetterSqlite3 = require('better-sqlite3');
		const db = new BetterSqlite3(config.path, {
			readonly: config.readonly || false,
			fileMustExist: config.fileMustExist || false,
			timeout: config.timeout || 5000,
			verbose: config.verbose,
		});

		// Load sqlite-vector extension (optional)
		try {
			const { getExtensionPath } = require('@sqliteai/sqlite-vector');
			db.loadExtension(getExtensionPath());
			sqliteVectorLoaded = true;
		} catch {
			sqliteVectorLoaded = false;
		}

		// Pragmas
		db.pragma('foreign_keys = ON');
		db.pragma('journal_mode = WAL');
		db.pragma('synchronous = NORMAL');
		db.pragma(`busy_timeout = ${config.timeout || 5000}`);

		return db;
	} catch {
		// ABI mismatch or module not found — fall back to sidecar
		return null;
	}
}

/**
 * Initialize the database connection.
 *
 * Strategy:
 * 1. Try direct better-sqlite3 (works in tests, CLI, system Node.js)
 * 2. If that fails (Electron ABI mismatch), use the sidecar process
 *
 * @param config Database configuration
 * @returns Result containing database-like instance or error
 */
export function initializeDatabase(
	config: DatabaseConfig
): Result<Database.Database> {
	try {
		const connectionMode = config.connectionMode ?? 'auto';

		// Close existing connection if any
		if (rpcClient) {
			rpcClient.close();
			rpcClient = null;
		}
		if (dbInstance) {
			try { dbInstance.close(); } catch { /* may already be closed */ }
			dbInstance = null;
		}
		sqliteVectorLoaded = false;
		activeConnectionMode = null;
		activeDatabasePath = null;
		activeDatabaseInstanceId = null;

		// Ensure directory exists
		const dbDir = path.dirname(config.path);
		if (!fs.existsSync(dbDir)) {
			fs.mkdirSync(dbDir, { recursive: true });
		}

		if (connectionMode !== 'sidecar') {
			// Strategy 1: Direct better-sqlite3 (tests, CLI, system Node.js)
			const directDb = tryDirectInit(config);
			if (directDb) {
				dbInstance = directDb;
				activeConnectionMode = 'direct';
				activeDatabasePath = path.resolve(config.path);
				activeDatabaseInstanceId = `db-${++dbInstanceCounter}-${randomUUID().slice(0, 8)}`;
				return { success: true, value: dbInstance };
			}
			if (connectionMode === 'direct') {
				return {
					success: false,
					error: new Error('Direct database mode requested but better-sqlite3 could not be initialized'),
				};
			}
		}

		// Strategy 2: Sidecar process (Electron / marketplace)
		const extensionPath = config.extensionPath ?? path.resolve(__dirname, '..');
		rpcClient = createDatabaseRPCClient(extensionPath);

		const initResult = rpcClient._rpcSync('init', {
			path: config.path,
			readonly: config.readonly ?? false,
			fileMustExist: config.fileMustExist ?? false,
			timeout: config.timeout ?? 5000,
		}) as { ok: boolean; vectorLoaded: boolean };

		sqliteVectorLoaded = initResult.vectorLoaded ?? false;
		dbInstance = rpcClient as unknown as Database.Database;
		activeConnectionMode = 'sidecar';
		activeDatabasePath = path.resolve(config.path);
		activeDatabaseInstanceId = `db-${++dbInstanceCounter}-${randomUUID().slice(0, 8)}`;

		return { success: true, value: dbInstance };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Unknown database initialization error'),
		};
	}
}

/**
 * Check if sqlite-vector extension is loaded
 */
export function isSqliteVectorLoaded(): boolean {
	return sqliteVectorLoaded;
}

/**
 * Initialize the vector index on the embeddings table.
 * Must be called per-connection after sqlite-vector is loaded and the embeddings table exists.
 */
export function initializeVectorIndex(db: Database.Database): void {
	if (!sqliteVectorLoaded) {
		return;
	}
	try {
		// The sidecar handles the actual SQLite call
		db.prepare("SELECT vector_init('embeddings', 'embedding', 'dimension=1024,type=FLOAT32,distance=COSINE')").get();
	} catch {
		// embeddings table may not exist yet (pre-V10) or vector_init already called
	}
}

/**
 * Get the current database instance
 * @returns Database-like instance or null if not initialized
 */
export function getDatabase(): Database.Database | null {
	return dbInstance;
}

/**
 * Close the database connection and shut down the sidecar.
 * @returns Result indicating success or failure
 */
export function closeDatabase(): Result<void> {
	try {
		if (rpcClient) {
			rpcClient.close();
			rpcClient = null;
			dbInstance = null;
		} else if (dbInstance) {
			dbInstance.close();
			dbInstance = null;
		}
		sqliteVectorLoaded = false;
		activeConnectionMode = null;
		activeDatabasePath = null;
		activeDatabaseInstanceId = null;
		return { success: true, value: undefined };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Unknown database close error'),
		};
	}
}

/**
 * Execute a database transaction
 * @param fn Function to execute within transaction
 * @returns Result containing function return value or error
 */
export function transaction<T>(
	fn: (db: Database.Database) => T
): Result<T> {
	if (!dbInstance) {
		return {
			success: false,
			error: new Error('Database not initialized'),
		};
	}

	try {
		const txn = dbInstance.transaction(fn);
		const result = txn(dbInstance);
		return { success: true, value: result };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Transaction failed'),
		};
	}
}

/**
 * Check if database is initialized and accessible
 * @returns True if database is ready, false otherwise
 */
export function isDatabaseReady(): boolean {
	if (rpcClient) {
		try {
			rpcClient._rpcSync('ping', {});
			return true;
		} catch {
			return false;
		}
	}
	if (!dbInstance) {
		return false;
	}
	try {
		dbInstance.prepare('SELECT 1').get();
		return true;
	} catch {
		return false;
	}
}

/**
 * Get which connection backend is active for the current singleton.
 */
export function getActiveDatabaseConnectionMode():
	| Exclude<DatabaseConnectionMode, 'auto'>
	| 'none' {
	return activeConnectionMode ?? 'none';
}

/**
 * Get the absolute path for the currently active database, if initialized.
 */
export function getActiveDatabasePath(): string | null {
	return activeDatabasePath;
}

/**
 * Get the logical database instance identifier for correlation in logs.
 */
export function getActiveDatabaseInstanceId(): string | null {
	return activeDatabaseInstanceId;
}

/**
 * Get database statistics
 * @returns Database statistics or null if not initialized
 */
export function getDatabaseStats(): {
	pageCount: number;
	pageSize: number;
	sizeBytes: number;
	walMode: boolean;
} | null {
	if (rpcClient) {
		try {
			return rpcClient._rpcSync('stats', {}) as {
				pageCount: number;
				pageSize: number;
				sizeBytes: number;
				walMode: boolean;
			};
		} catch {
			return null;
		}
	}
	if (!dbInstance) {
		return null;
	}
	try {
		const pageCount = dbInstance.pragma('page_count', { simple: true }) as number;
		const pageSize = dbInstance.pragma('page_size', { simple: true }) as number;
		const journalMode = dbInstance.pragma('journal_mode', { simple: true }) as string;
		return {
			pageCount,
			pageSize,
			sizeBytes: pageCount * pageSize,
			walMode: journalMode.toLowerCase() === 'wal',
		};
	} catch {
		return null;
	}
}

/**
 * Backup database to a file
 * @param backupPath Path to backup file
 * @returns Result indicating success or failure
 */
export function backupDatabase(backupPath: string): Result<void> {
	if (!rpcClient && !dbInstance) {
		return {
			success: false,
			error: new Error('Database not initialized'),
		};
	}

	try {
		// Ensure backup directory exists
		const backupDir = path.dirname(backupPath);
		if (!fs.existsSync(backupDir)) {
			fs.mkdirSync(backupDir, { recursive: true });
		}

		if (rpcClient) {
			rpcClient._rpcSync('backup', { path: backupPath });
		} else {
			dbInstance!.backup(backupPath);
		}
		return { success: true, value: undefined };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Backup failed'),
		};
	}
}

/**
 * Clear all data from the database while preserving schema.
 * Uses a dedicated sidecar RPC method that handles the read-then-delete
 * logic server-side (inside the sidecar's transaction).
 * @returns Result indicating success or failure
 */
export function clearAllData(): Result<void> {
	if (!rpcClient && !dbInstance) {
		return {
			success: false,
			error: new Error('Database not initialized'),
		};
	}

	try {
		const tables = [
			// Self-created tables that FK-reference schema tables (must go first)
			'gate_metadata', 'gate_resolutions', 'workflow_suspensions',
			'gate_notifications', 'state_transitions',
			// Self-created tables without FK to schema tables
			'workflow_states', 'overrides', 'constraint_waivers',
			// V11 MAKER tables (children before parents)
			'repair_packets', 'validation_packets', 'evidence_packets',
			'claim_units', 'historical_invariant_packets', 'outcome_snapshots',
			'task_edges', 'task_units', 'task_graphs', 'acceptance_contracts',
			'intent_records', 'toolchain_detections',
			// Architecture phase tables (children before parents)
			'arch_implementation_steps', 'arch_components', 'arch_workflows',
			'arch_domain_mappings', 'arch_capabilities', 'architecture_documents',
			// Context handoff + generated docs
			'handoff_documents', 'generated_documents', 'pending_mmp_decisions',
			'webview_drafts',
			// Deep Memory Agent tables (children before parents)
			'memory_context_packets', 'memory_extraction_runs',
			'memory_edges', 'memory_objects',
			// Clarification threads
			'clarification_threads',
			// FTS
			'fts_stream_content',
			// Schema-managed tables (children before parents)
			'embeddings', 'narrative_memories', 'decision_traces', 'open_loops',
			'intake_conversations', 'workflow_command_outputs', 'workflow_commands',
			'cli_activity_events', 'human_decisions', 'gates', 'verdicts',
			'claim_events', 'claims', 'artifact_references', 'artifacts',
			'constraint_manifests', 'dialogue_events', 'dialogues',
		];

		if (rpcClient) {
			rpcClient._rpcSync('clearAllData', { tables });
		} else {
			// Direct mode — execute in transaction
			const db = dbInstance!;
			const txn = db.transaction(() => {
				for (const table of tables) {
					const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
					if (exists) {
						db.prepare(`DELETE FROM ${table}`).run();
					}
				}
			});
			txn();
		}
		return { success: true, value: undefined };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to clear database'),
		};
	}
}

/**
 * Restore database from a backup file
 * @param backupPath Path to backup file
 * @param targetPath Path to restore to
 * @returns Result indicating success or failure
 */
export function restoreDatabase(
	backupPath: string,
	targetPath: string
): Result<void> {
	try {
		if (!fs.existsSync(backupPath)) {
			return {
				success: false,
				error: new Error(`Backup file not found: ${backupPath}`),
			};
		}

		// Close current database if open
		if (rpcClient) {
			rpcClient.close();
			rpcClient = null;
			dbInstance = null;
		}

		// Ensure target directory exists
		const targetDir = path.dirname(targetPath);
		if (!fs.existsSync(targetDir)) {
			fs.mkdirSync(targetDir, { recursive: true });
		}

		// Copy backup to target
		fs.copyFileSync(backupPath, targetPath);

		return { success: true, value: undefined };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Restore failed'),
		};
	}
}
