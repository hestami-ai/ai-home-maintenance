// REG-F-012 (2026-08-04) — the first forward migration this engine has ever run, and the ladder that runs it.
//
// `SCHEMA_VERSION` was 1 from W2-INC-1 until now, so "bump this and register a forward migration" had never been
// exercised: the adapter's older-than arm THREW, and the 0 arm stamped without migrating. Both were correct while
// the only version was the baseline, and both are wrong the moment a second one exists — a durable store
// (`apps/rph-demo` opens one by filename) would either refuse to open or come up stamped v2 with a v1 table.
//
// FOUR STORES, AND THEY ARE DIFFERENT STORES, not one case with decorations:
//   fresh              — no tables, user_version 0. SCHEMA_SQL builds the current shape; nothing to migrate.
//   pre-versioning     — v1 tables, user_version 0. The adapter cannot distinguish this from `fresh` AFTER
//                        SCHEMA_SQL has run (every statement is CREATE … IF NOT EXISTS), which is why the
//                        constructor captures the distinction BEFORE. Stamping this one without migrating is
//                        precisely the bug the pre-ladder code would now have.
//   v1-stamped         — v1 tables, user_version 1. The ordinary upgrade.
//   newer              — user_version 3. Still fails closed; a migration ladder is forward-only.
import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MIGRATIONS, planMigration, SCHEMA_VERSION } from './schema.js';
import { createSqliteDriver, type SqlDriver } from './sql-driver.js';
import { SqliteStorageAdapter } from './sqlite-storage-adapter.js';

/** `command_receipts` exactly as schema v1 declared it — no `payload_hash`. */
const V1_RECEIPTS_SQL = `
CREATE TABLE IF NOT EXISTS command_receipts (
	idempotency_key TEXT PRIMARY KEY,
	command_id TEXT NOT NULL,
	command_type TEXT NOT NULL,
	target_aggregate_id TEXT NOT NULL,
	status TEXT NOT NULL,
	produced_event_ids TEXT NOT NULL,
	result_hash TEXT,
	created_at TEXT NOT NULL
);`;

/** A store carrying one v1 receipt. `stampVersion` 0 models a store that predates versioning. */
function v1Store(stampVersion: number): SqlDriver {
	const driver = createSqliteDriver();
	driver.exec(V1_RECEIPTS_SQL);
	driver
		.prepare(
			'INSERT INTO command_receipts(idempotency_key,command_id,command_type,target_aggregate_id,status,produced_event_ids,result_hash,created_at) VALUES(?,?,?,?,?,?,?,?)'
		)
		.run('old-key', 'old-cmd', 'CaptureIntent', 'int_OLD', 'ACCEPTED', '["e1"]', null, 'then');
	driver.exec(`PRAGMA user_version = ${stampVersion}`);
	return driver;
}

const columnsOf = (driver: SqlDriver): string[] =>
	(driver.prepare('PRAGMA table_info(command_receipts)').all() as { name: string }[]).map(
		(c) => c.name
	);

const versionOf = (driver: SqlDriver): number =>
	(driver.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;

describe('REG-F-012 — planMigration, the ladder as a pure decision', () => {
	// The refusing arm is UNREACHABLE through the adapter today: every version below SCHEMA_VERSION has a
	// registered step. A guard nothing can reach is a guard nothing proves, so the decision is a pure function
	// and the gap is constructed here directly.
	it('refuses a GAP rather than skipping it', () => {
		expect(() => planMigration(1, 3, { 1: 'ALTER TABLE t ADD COLUMN a;' })).toThrow(
			/no forward migration registered from schema version 2 to 3/
		);
	});

	it('returns the registered steps in order', () => {
		expect(planMigration(1, 3, { 1: 'FIRST;', 2: 'SECOND;' })).toEqual(['FIRST;', 'SECOND;']);
	});

	it('a store already at the target migrates by doing nothing', () => {
		expect(planMigration(SCHEMA_VERSION, SCHEMA_VERSION)).toEqual([]);
	});

	it('the real ladder is complete from every version this build knows', () => {
		// Derived from the constant, not restated: adding a v3 without registering MIGRATIONS[2] reddens here.
		expect(() => planMigration(1, SCHEMA_VERSION)).not.toThrow();
		expect(Object.keys(MIGRATIONS).map(Number).sort()).toEqual(
			Array.from({ length: SCHEMA_VERSION - 1 }, (_, i) => i + 1)
		);
	});
});

describe('REG-F-012 — the v1 → v2 migration on a real store', () => {
	it('a V1-STAMPED store gains payload_hash, keeps its rows, and is stamped at the current version', () => {
		const driver = v1Store(1);
		expect(columnsOf(driver), 'precondition: the column is not there yet').not.toContain(
			'payload_hash'
		);

		const store = new SqliteStorageAdapter({ driver });

		expect(columnsOf(driver)).toContain('payload_hash');
		expect(versionOf(driver)).toBe(SCHEMA_VERSION);
		const migrated = store.getReceipt('old-key');
		expect(migrated?.commandType, 'the pre-existing row survived').toBe('CaptureIntent');
		expect(
			migrated?.payloadHash,
			'and it carries NO hash — the migration adds a column, it does not invent values for it'
		).toBeUndefined();
		driver.close();
	});

	// The arm the pre-ladder code got right for the wrong reason: while SCHEMA_VERSION was 1, stamping a
	// user_version-0 store at 1 without migrating was correct. With a v2 it would mark a v1 table as v2.
	it('a PRE-VERSIONING store (v1 tables, user_version 0) is migrated, not merely stamped', () => {
		const driver = v1Store(0);
		new SqliteStorageAdapter({ driver });
		expect(columnsOf(driver), 'THE POINT: stamping without migrating would leave this absent').toContain(
			'payload_hash'
		);
		expect(versionOf(driver)).toBe(SCHEMA_VERSION);
		driver.close();
	});

	// CONTROL, with its own mutant: making `hasExistingSchema` always return true reddens THIS test (a fresh
	// store would be handed to the ladder as though it were v1) and leaves the two above green.
	it('CONTROL: a FRESH store is created at the current shape and migrates nothing', () => {
		const driver = createSqliteDriver();
		new SqliteStorageAdapter({ driver });
		expect(columnsOf(driver)).toContain('payload_hash');
		expect(versionOf(driver)).toBe(SCHEMA_VERSION);
		expect(
			driver.prepare('SELECT COUNT(*) AS n FROM command_receipts').get(),
			'and it is empty — the ladder did not run against a table it just built'
		).toEqual({ n: 0 });
		driver.close();
	});

	// CONTROL: forward-only. A ladder must not make the newer-schema guard soft.
	it('CONTROL: a store written by a NEWER schema still fails closed', () => {
		const driver = createSqliteDriver();
		driver.exec(`PRAGMA user_version = ${SCHEMA_VERSION + 1}`);
		expect(() => new SqliteStorageAdapter({ driver })).toThrow(/newer than/);
		driver.close();
	});

	it('migrating is idempotent across reopen of a DURABLE store', () => {
		const path = join(tmpdir(), `rph-migration-${process.pid}.db`);
		const cleanup = () => {
			for (const suffix of ['', '-wal', '-shm']) {
				if (existsSync(`${path}${suffix}`)) rmSync(`${path}${suffix}`);
			}
		};
		cleanup();
		try {
			new SqliteStorageAdapter({ filename: path }).close();
			// Second open sees user_version === SCHEMA_VERSION and returns before the ladder. Re-running
			// `ALTER TABLE … ADD COLUMN` would throw "duplicate column name", so this is a real assertion.
			expect(() => new SqliteStorageAdapter({ filename: path }).close()).not.toThrow();
		} finally {
			cleanup();
		}
	});
});
