/**
 * Temp Database Helper
 * Creates a temporary SQLite database file with the full JanumiCode schema,
 * suitable for deterministic unit tests. The file is cleaned up after the test.
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { randomUUID } from 'crypto';
import {
	initializeDatabase,
	closeDatabase,
	getDatabase,
	getActiveDatabaseConnectionMode,
	type DatabaseConnectionMode,
} from '../../lib/database/init';
import { initializeSchema } from '../../lib/database/migrations';

export interface TempDbContext {
	/** Full path to the temporary database file */
	dbPath: string;
	/** Resolved backend mode for this test DB (direct or sidecar). */
	connectionMode: 'direct' | 'sidecar';
	/** Close the database and delete the temp file */
	cleanup: () => void;
}

export interface TempDbOptions {
	/** Force a specific connection strategy for this temp DB. */
	connectionMode?: DatabaseConnectionMode;
	/** Keep DB files on cleanup (useful for triage/debug). */
	keepFiles?: boolean;
	/**
	 * Use this exact path for the database file instead of generating a temp name.
	 * Parent directories are created if missing. Used by resumable scenario tests
	 * to point at a persistent on-disk DB across runs.
	 */
	path?: string;
	/**
	 * When true, cleanup() does NOT delete the DB file (or WAL/SHM siblings).
	 * Implied true when `path` is provided (persistent mode is the whole point).
	 */
	persist?: boolean;
}

function resolveRequestedMode(options?: TempDbOptions): DatabaseConnectionMode {
	const fromOption = options?.connectionMode;
	if (fromOption) { return fromOption; }
	const fromEnv = process.env.JANUMICODE_TEST_DB_MODE;
	if (fromEnv === 'direct' || fromEnv === 'sidecar' || fromEnv === 'auto') {
		return fromEnv;
	}
	return 'auto';
}

function shouldKeepFiles(options?: TempDbOptions): boolean {
	if (options?.keepFiles === true) { return true; }
	if (options?.persist === true || options?.path) { return true; }
	const flag = process.env.JANUMICODE_TEST_KEEP_DB ?? '';
	return flag === '1' || flag.toLowerCase() === 'true';
}

function appendTempDbArtifact(payload: Record<string, unknown>): void {
	const artifactDir = process.env.JANUMICODE_TEST_ARTIFACT_DIR;
	if (!artifactDir) { return; }
	try {
		fs.mkdirSync(artifactDir, { recursive: true });
		const file = path.join(artifactDir, 'temp-dbs.jsonl');
		fs.appendFileSync(file, JSON.stringify(payload) + '\n', 'utf8');
	} catch {
		// Ignore artifact-write failures in tests.
	}
}

/**
 * Create a temporary SQLite database with the full JanumiCode schema.
 * Call `cleanup()` in afterEach to close the connection and delete the file.
 */
export function createTempDatabase(options?: TempDbOptions): TempDbContext {
	const dbPath = options?.path
		? path.resolve(options.path)
		: path.join(os.tmpdir(), `janumicode-test-${randomUUID()}.db`);
	if (options?.path) {
		fs.mkdirSync(path.dirname(dbPath), { recursive: true });
	}
	const requestedMode = resolveRequestedMode(options);
	// src/test/helpers -> project root
	const extensionPath = path.resolve(__dirname, '..', '..', '..');

	const initResult = initializeDatabase({
		path: dbPath,
		connectionMode: requestedMode,
		extensionPath,
	});
	if (!initResult.success) {
		throw new Error(`Failed to initialize temp database: ${initResult.error.message}`);
	}
	const activeMode = getActiveDatabaseConnectionMode();
	if (activeMode !== 'direct' && activeMode !== 'sidecar') {
		throw new Error(`Unexpected database mode "${activeMode}" after temp DB initialization`);
	}

	const db = getDatabase();
	if (!db) {
		throw new Error('Database singleton is null after initialization');
	}

	const schemaResult = initializeSchema(db);
	if (!schemaResult.success) {
		throw new Error(`Failed to initialize schema: ${schemaResult.error.message}`);
	}
	// Production code in src/lib/workflow/stateMachine.ts lazily creates the
	// workflow_states and state_transitions tables on first call to
	// initializeWorkflowState/transitionWorkflow. Tests that exercise other
	// modules but read/write workflow state directly need the tables to exist
	// up front, so mirror the lazy CREATEs here.
	db.exec(`
		CREATE TABLE IF NOT EXISTS workflow_states (
			state_id TEXT PRIMARY KEY,
			dialogue_id TEXT NOT NULL UNIQUE,
			current_phase TEXT NOT NULL,
			previous_phase TEXT,
			metadata TEXT NOT NULL,
			transition_graph_version INTEGER NOT NULL DEFAULT 1,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		);
		CREATE TABLE IF NOT EXISTS state_transitions (
			transition_id TEXT PRIMARY KEY,
			workflow_state_id TEXT NOT NULL,
			from_phase TEXT NOT NULL,
			to_phase TEXT NOT NULL,
			trigger TEXT NOT NULL,
			metadata TEXT NOT NULL,
			timestamp TEXT NOT NULL,
			FOREIGN KEY (workflow_state_id) REFERENCES workflow_states(state_id)
		);
	`);
	appendTempDbArtifact({
		event: 'created',
		dbPath,
		requestedMode,
		activeMode,
		pid: process.pid,
		ts: new Date().toISOString(),
	});

	return {
		dbPath,
		connectionMode: activeMode,
		cleanup: () => {
			closeDatabase();
			appendTempDbArtifact({
				event: 'cleanup',
				dbPath,
				activeMode,
				kept: shouldKeepFiles(options),
				pid: process.pid,
				ts: new Date().toISOString(),
			});
			if (shouldKeepFiles(options)) {
				return;
			}
			// Remove DB file and any WAL/SHM files
			for (const suffix of ['', '-wal', '-shm']) {
				const filePath = dbPath + suffix;
				try {
					if (fs.existsSync(filePath)) {
						fs.unlinkSync(filePath);
					}
				} catch {
					// Ignore cleanup errors
				}
			}
		},
	};
}
