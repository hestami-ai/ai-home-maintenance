/**
 * Temp Database Helper
 * Creates a temporary SQLite database file with the full JanumiCode schema,
 * suitable for deterministic unit tests. The file is cleaned up after the test.
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { randomUUID } from 'crypto';
import { initializeDatabase, closeDatabase, getDatabase } from '../../lib/database/init';
import { initializeSchema } from '../../lib/database/migrations';

export interface TempDbContext {
	/** Full path to the temporary database file */
	dbPath: string;
	/** Close the database and delete the temp file */
	cleanup: () => void;
}

/**
 * Create a temporary SQLite database with the full JanumiCode schema.
 * Call `cleanup()` in afterEach to close the connection and delete the file.
 */
export function createTempDatabase(): TempDbContext {
	const dbPath = path.join(os.tmpdir(), `janumicode-test-${randomUUID()}.db`);

	const initResult = initializeDatabase({ path: dbPath });
	if (!initResult.success) {
		throw new Error(`Failed to initialize temp database: ${initResult.error.message}`);
	}

	const db = getDatabase();
	if (!db) {
		throw new Error('Database singleton is null after initialization');
	}

	const schemaResult = initializeSchema(db);
	if (!schemaResult.success) {
		throw new Error(`Failed to initialize schema: ${schemaResult.error.message}`);
	}

	return {
		dbPath,
		cleanup: () => {
			closeDatabase();
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
