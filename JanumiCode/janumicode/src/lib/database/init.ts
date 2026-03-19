/**
 * Database Initialization and Connection Management
 * Implements Phase 1.2: SQLite Database Layer
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import type { Result } from '../types';

/**
 * Singleton database instance
 */
let dbInstance: Database.Database | null = null;

/**
 * Whether sqlite-vector extension was successfully loaded
 */
let sqliteVectorLoaded = false;

/**
 * Database configuration
 */
export interface DatabaseConfig {
	path: string; // Full path to SQLite database file
	readonly?: boolean; // Open in readonly mode
	fileMustExist?: boolean; // Throw error if file doesn't exist
	timeout?: number; // Busy timeout in milliseconds
	verbose?: (message?: unknown, ...additionalArgs: unknown[]) => void; // Verbose logging
}

/**
 * Initialize the database connection
 * @param config Database configuration
 * @returns Result containing database instance or error
 */
export function initializeDatabase(
	config: DatabaseConfig
): Result<Database.Database> {
	try {
		// Close existing connection if any
		if (dbInstance) {
			dbInstance.close();
			dbInstance = null;
		}

		// Ensure directory exists
		const dbDir = path.dirname(config.path);
		if (!fs.existsSync(dbDir)) {
			fs.mkdirSync(dbDir, { recursive: true });
		}

		// Create database connection
		dbInstance = new Database(config.path, {
			readonly: config.readonly || false,
			fileMustExist: config.fileMustExist || false,
			timeout: config.timeout || 5000,
			verbose: config.verbose,
		});

		// Load sqlite-vector extension (optional — embedding features unavailable if missing)
		try {
			const { getExtensionPath } = require('@sqliteai/sqlite-vector');
			dbInstance.loadExtension(getExtensionPath());
			sqliteVectorLoaded = true;
		} catch {
			sqliteVectorLoaded = false;
		}

		// Enable foreign keys
		dbInstance.pragma('foreign_keys = ON');

		// Set journal mode to WAL for better concurrency
		dbInstance.pragma('journal_mode = WAL');

		// Set synchronous to NORMAL (faster, still safe with WAL)
		dbInstance.pragma('synchronous = NORMAL');

		// Set busy timeout
		dbInstance.pragma(`busy_timeout = ${config.timeout || 5000}`);

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
		db.prepare("SELECT vector_init('embeddings', 'embedding', 'dimension=1024,type=FLOAT32,distance=COSINE')").get();
	} catch {
		// embeddings table may not exist yet (pre-V10) or vector_init already called
	}
}

/**
 * Get the current database instance
 * @returns Database instance or null if not initialized
 */
export function getDatabase(): Database.Database | null {
	return dbInstance;
}

/**
 * Close the database connection
 * @returns Result indicating success or failure
 */
export function closeDatabase(): Result<void> {
	try {
		if (dbInstance) {
			dbInstance.close();
			dbInstance = null;
		}
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
	if (!dbInstance) {
		return false;
	}

	try {
		// Try a simple query to verify database is accessible
		dbInstance.prepare('SELECT 1').get();
		return true;
	} catch {
		return false;
	}
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
	if (!dbInstance) {
		return null;
	}

	try {
		const pageCount = dbInstance.pragma('page_count', {
			simple: true,
		}) as number;
		const pageSize = dbInstance.pragma('page_size', {
			simple: true,
		}) as number;
		const journalMode = dbInstance.pragma('journal_mode', {
			simple: true,
		}) as string;

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
	if (!dbInstance) {
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

		// Use better-sqlite3 backup API
		dbInstance.backup(backupPath);

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
 * Deletes all rows from every data table but keeps schema_metadata intact.
 * @returns Result indicating success or failure
 */
export function clearAllData(): Result<void> {
	if (!dbInstance) {
		return {
			success: false,
			error: new Error('Database not initialized'),
		};
	}

	try {
		const txn = dbInstance.transaction((db: Database.Database) => {
			// Order matters: delete child tables before parents to respect FK constraints.
			// Includes both schema-managed and self-created inline tables.
			// Use "IF EXISTS" check since inline tables are only created on first use.
			const tables = [
				// Self-created tables that FK-reference schema tables (must go first)
				'gate_metadata',         // FK → gates
				'gate_resolutions',      // FK → gates, human_decisions
				'workflow_suspensions',  // FK → gates
				'gate_notifications',    // FK → gates
				'state_transitions',     // FK → workflow_states
				// Self-created tables without FK to schema tables
				'workflow_states',
				'overrides',
				'constraint_waivers',
				// V11 MAKER tables (children before parents)
				'repair_packets',                // FK → task_units
				'validation_packets',            // FK → task_units
				'evidence_packets',              // FK → task_units
				'claim_units',                   // FK → task_units
				'historical_invariant_packets',  // FK → task_units (nullable)
				'outcome_snapshots',             // FK → task_graphs
				'task_edges',                    // FK → task_graphs, task_units
				'task_units',                    // FK → task_graphs, self-ref
				'task_graphs',                   // FK → intent_records
				'acceptance_contracts',          // FK → intent_records
				'intent_records',
				'toolchain_detections',
				// Architecture phase tables (children before parents)
				'arch_implementation_steps',  // FK → architecture_documents
				'arch_components',            // FK → architecture_documents, self-ref
				'arch_workflows',             // FK → architecture_documents, arch_capabilities
				'arch_domain_mappings',       // FK → architecture_documents, arch_capabilities
				'arch_capabilities',          // FK → architecture_documents
				'architecture_documents',     // FK → dialogues
				// Context handoff + generated docs
				'handoff_documents',         // FK → dialogues
				'generated_documents',       // FK → dialogues
				'pending_mmp_decisions',     // FK → dialogues
				// Clarification threads
				'clarification_threads',     // FK → dialogues
				// FTS
				'fts_stream_content',
				// Schema-managed tables (children before parents)
				'embeddings',
				'narrative_memories',
				'decision_traces',
				'open_loops',
				'intake_conversations',
				'workflow_command_outputs',
				'workflow_commands',
				'cli_activity_events',
				'human_decisions',
				'gates',
				'verdicts',
				'claim_events',
				'claims',
				'artifact_references',
				'artifacts',
				'constraint_manifests',
				'dialogue_events',
				'dialogues',
			];

			for (const table of tables) {
				// Check table exists before deleting — inline tables are only
				// created on first use and may not be present in every database.
				const exists = db
					.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
					.get(table);
				if (exists) {
					db.prepare(`DELETE FROM ${table}`).run();
				}
			}
		});
		txn(dbInstance);

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
		if (dbInstance) {
			dbInstance.close();
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
