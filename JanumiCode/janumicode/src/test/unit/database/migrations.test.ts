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
		expect(version).toBeGreaterThanOrEqual(1);
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
			'dialogue_events',
			'claims',
			'verdicts',
			'gates',
			'human_decisions',
			'dialogues',
			'intake_conversations',
		];
		for (const table of expectedTables) {
			expect(tableNames, `Missing table: ${table}`).toContain(table);
		}
	});

	it('V7: arch_capabilities has parent_capability_id column', () => {
		const db = getDatabase();
		expect(db).not.toBeNull();

		// Check column exists
		const columns = db!
			.prepare("PRAGMA table_info('arch_capabilities')")
			.all() as Array<{ name: string; type: string; dflt_value: string | null }>;
		const colNames = columns.map(c => c.name);
		expect(colNames).toContain('parent_capability_id');

		// Verify default is NULL
		const parentCol = columns.find(c => c.name === 'parent_capability_id');
		expect(parentCol).toBeDefined();
		expect(parentCol!.dflt_value).toBe('NULL');

		// Check index exists
		const indexes = db!
			.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='arch_capabilities'")
			.all() as Array<{ name: string }>;
		const indexNames = indexes.map(i => i.name);
		expect(indexNames).toContain('idx_arch_cap_parent');
	});
});
