/**
 * Database Migration System
 * Implements Phase 1.7: Migration System
 * Provides versioned schema updates with rollback support
 */

import type Database from 'better-sqlite3';
import { MIGRATIONS, type Migration } from './schema';
import type { Result } from '../types';

/**
 * Get current schema version from database
 * @param db Database instance
 * @returns Current schema version or 0 if not initialized
 */
export function getCurrentSchemaVersion(db: Database.Database): number {
	try {
		// Check if schema_metadata table exists
		const tableExists = db
			.prepare(
				"SELECT name FROM sqlite_master WHERE type='table' AND name='schema_metadata'"
			)
			.get();

		if (!tableExists) {
			return 0;
		}

		// Get schema version
		const result = db
			.prepare("SELECT value FROM schema_metadata WHERE key = 'schema_version'")
			.get() as { value: string } | undefined;

		return result ? parseInt(result.value, 10) : 0;
	} catch (error) {
		// Use safe import to avoid circular dependency during early boot
		try {
			const { getLogger } = require('../logging');
			getLogger().child({ component: 'database' }).error('Error getting schema version', {
				error: error instanceof Error ? error.message : String(error),
			});
		} catch {
			// Logger not yet initialized during early boot — swallow silently
		}
		return 0;
	}
}

/**
 * Apply a single migration
 * @param db Database instance
 * @param migration Migration to apply
 * @returns Result indicating success or failure
 */
function applyMigration(
	db: Database.Database,
	migration: Migration
): Result<void> {
	try {
		// Execute migration SQL — not wrapped in db.transaction() because
		// the RPC client's transaction recording pattern cannot preserve
		// try/catch semantics inside the function body.
		try {
			db.exec(migration.sql);
		} catch (execErr) {
			const msg = (execErr as Error).message ?? '';
			// On a fresh DB, SCHEMA_V1 creates tables with all columns.
			// Later ALTER TABLE ADD COLUMN migrations may fail with
			// "duplicate column name" — this is safe to skip.
			if (!msg.includes('duplicate column name')) {
				throw execErr;
			}
		}

		// Update schema version — never downgrade (consolidated schemas may set it higher)
		const currentInDb = getCurrentSchemaVersion(db);
		const targetVersion = Math.max(currentInDb, migration.version);
		db.prepare(
			"UPDATE schema_metadata SET value = ?, updated_at = datetime('now') WHERE key = 'schema_version'"
		).run(targetVersion.toString());

		return { success: true, value: undefined };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error(`Migration v${migration.version} failed`),
		};
	}
}

/**
 * Run all pending migrations
 * @param db Database instance
 * @returns Result containing applied migrations or error
 */
export function runMigrations(
	db: Database.Database
): Result<Migration[]> {
	try {
		const currentVersion = getCurrentSchemaVersion(db);
		const pendingMigrations = MIGRATIONS.filter(
			(m) => m.version > currentVersion
		);

		if (pendingMigrations.length === 0) {
			return { success: true, value: [] };
		}

		const appliedMigrations: Migration[] = [];

		for (const migration of pendingMigrations) {
			// Re-check version: consolidated schemas (SCHEMA_V1) may have jumped
			// the version past subsequent migrations, making them unnecessary.
			const currentVer = getCurrentSchemaVersion(db);
			if (migration.version <= currentVer) {
				continue;
			}

			const result = applyMigration(db, migration);

			if (!result.success) {
				return {
					success: false,
					error: new Error(
						`Migration v${migration.version} failed: ${result.error.message}`
					),
				};
			}

			appliedMigrations.push({
				...migration,
				appliedAt: new Date().toISOString(),
			});
		}

		return { success: true, value: appliedMigrations };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Migration process failed'),
		};
	}
}

/**
 * Get migration history from database
 * @param db Database instance
 * @returns Array of applied migrations with timestamps
 */
export function getMigrationHistory(
	db: Database.Database
): Migration[] {
	const currentVersion = getCurrentSchemaVersion(db);

	return MIGRATIONS.filter((m) => m.version <= currentVersion).map(
		(m) => ({
			...m,
			appliedAt: 'unknown', // Could be enhanced to track actual application time
		})
	);
}

/**
 * Check if migrations are needed
 * @param db Database instance
 * @returns True if pending migrations exist
 */
export function hasPendingMigrations(db: Database.Database): boolean {
	const currentVersion = getCurrentSchemaVersion(db);
	return MIGRATIONS.some((m) => m.version > currentVersion);
}

/**
 * Get pending migrations
 * @param db Database instance
 * @returns Array of pending migrations
 */
export function getPendingMigrations(
	db: Database.Database
): Migration[] {
	const currentVersion = getCurrentSchemaVersion(db);
	return MIGRATIONS.filter((m) => m.version > currentVersion);
}

/**
 * Validate database schema integrity
 * @param db Database instance
 * @returns Result indicating if schema is valid
 */
export function validateSchema(db: Database.Database): Result<boolean> {
	try {
		// Check that all expected tables exist
		const expectedTables = [
			'dialogue_events',
			'claims',
			'claim_events',
			'verdicts',
			'gates',
			'human_decisions',
			'constraint_manifests',
			'artifacts',
			'artifact_references',
			'schema_metadata',
			'narrative_memories',
			'decision_traces',
			'open_loops',
			'embeddings',
			// V11: MAKER Agent Integration Control Plane
			'intent_records',
			'acceptance_contracts',
			'task_graphs',
			'task_units',
			'task_edges',
			'claim_units',
			'evidence_packets',
			'validation_packets',
			'repair_packets',
			'historical_invariant_packets',
			'outcome_snapshots',
			'toolchain_detections',
			// V13: Clarification threads
			'clarification_threads',
			// Architecture phase tables
			'architecture_documents',
			'arch_capabilities',
			'arch_domain_mappings',
			'arch_workflows',
			'arch_components',
			'arch_implementation_steps',
			// V10: Generated documents
			'generated_documents',
		];

		const existingTablesResult = db
			.prepare(
				"SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
			)
			.all() as { name: string }[];

		const existingTables = new Set(
			existingTablesResult.map((t) => t.name)
		);

		const missingTables = expectedTables.filter(
			(t) => !existingTables.has(t)
		);

		if (missingTables.length > 0) {
			return {
				success: false,
				error: new Error(
					`Missing tables: ${missingTables.join(', ')}`
				),
			};
		}

		// Check schema version matches latest migration
		const currentVersion = getCurrentSchemaVersion(db);
		const latestVersion = Math.max(...MIGRATIONS.map((m) => m.version));

		if (currentVersion !== latestVersion) {
			return {
				success: false,
				error: new Error(
					`Schema version mismatch: current=${currentVersion}, latest=${latestVersion}`
				),
			};
		}

		return { success: true, value: true };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Schema validation failed'),
		};
	}
}

/**
 * Initialize database with schema
 * Convenience function that runs all migrations on a fresh database
 * @param db Database instance
 * @returns Result indicating success or failure
 */
export function initializeSchema(db: Database.Database): Result<void> {
	const log = (...args: unknown[]) => {
		try {
			const { getLogger } = require('../logging');
			getLogger().child({ component: 'migrations' }).info(args[0], args[1]);
		} catch { /* logger not ready */ }
	};

	try {
		const currentVersion = getCurrentSchemaVersion(db);
		log('Schema init starting', { currentVersion, totalMigrations: MIGRATIONS.length, latestVersion: Math.max(...MIGRATIONS.map(m => m.version)) });

		const result = runMigrations(db);

		if (!result.success) {
			log('runMigrations FAILED', { error: result.error.message });
			return result;
		}

		log('Migrations applied', { count: result.value.length, applied: result.value.map(m => `v${m.version}`) });

		// Validate schema after initialization
		const validationResult = validateSchema(db);

		if (!validationResult.success) {
			log('validateSchema FAILED', { error: validationResult.error.message });
			return {
				success: false,
				error: validationResult.error,
			};
		}

		const finalVersion = getCurrentSchemaVersion(db);
		log('Schema init complete', { finalVersion });

		return { success: true, value: undefined };
	} catch (error) {
		log('Schema init EXCEPTION', { error: error instanceof Error ? error.message : String(error) });
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Schema initialization failed'),
		};
	}
}
