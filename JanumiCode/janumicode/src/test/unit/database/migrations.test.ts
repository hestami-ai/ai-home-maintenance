import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import { getDatabase } from '../../../lib/database/init';
import { getCurrentSchemaVersion, validateSchema } from '../../../lib/database/migrations';

describe('Database Migrations', () => {
	let tempDb: TempDbContext;

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
	});

	afterEach(() => {
		tempDb.cleanup();
		teardownTestLogger();
	});

	it('creates database with latest schema version', () => {
		const db = getDatabase();
		expect(db).not.toBeNull();
		const version = getCurrentSchemaVersion(db!);
		expect(version).toBeGreaterThanOrEqual(13);
	});

	it('validates schema successfully', () => {
		const db = getDatabase();
		expect(db).not.toBeNull();
		const result = validateSchema(db!);
		expect(result.success).toBe(true);
	});

	it('creates all expected core tables', () => {
		const db = getDatabase();
		expect(db).not.toBeNull();
		const tables = db!
			.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
			.all() as Array<{ name: string }>;
		const tableNames = tables.map(t => t.name);

		const expectedTables = [
			'dialogue_turns',
			'claims',
			'verdicts',
			'gates',
			'human_decisions',
			'dialogues',
			'intake_conversations',
			'intake_turns',
		];
		for (const table of expectedTables) {
			expect(tableNames, `Missing table: ${table}`).toContain(table);
		}
	});
});
