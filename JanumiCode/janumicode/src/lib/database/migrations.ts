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
		// Execute migration SQL in a transaction
		const txn = db.transaction(() => {
			// Execute the migration SQL
			db.exec(migration.sql);

			// Update schema version
			db.prepare(
				"UPDATE schema_metadata SET value = ?, updated_at = datetime('now') WHERE key = 'schema_version'"
			).run(migration.version.toString());
		});

		txn();

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
			'dialogue_turns',
			'claims',
			'claim_events',
			'verdicts',
			'gates',
			'human_decisions',
			'constraint_manifests',
			'artifacts',
			'artifact_references',
			'schema_metadata',
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
	try {
		const result = runMigrations(db);

		if (!result.success) {
			return result;
		}

		// Validate schema after initialization
		const validationResult = validateSchema(db);

		if (!validationResult.success) {
			return {
				success: false,
				error: validationResult.error,
			};
		}

		return { success: true, value: undefined };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Schema initialization failed'),
		};
	}
}
