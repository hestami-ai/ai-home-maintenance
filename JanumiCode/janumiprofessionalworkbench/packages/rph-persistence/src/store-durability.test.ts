// ⭐ `StorageAdapter.durability` — DERIVED FROM THE CONNECTION THAT WAS OPENED (`JAN-CRITREAD` J1-1b; `REG-D-071`
// Q5 (b), `REG-D-072` D5).
//
// ── WHY IT IS DERIVED AND NOT DECLARED ────────────────────────────────────────────────────────────────────────
// The one reader is the `Engine`'s refusal to admit test-stipulated answers over a durable store. A class-level
// declaration would answer the wrong question: `SqliteArtifactStore` declares `DURABLE` on its class
// (`sqlite-artifact-store.ts:64`) and an instance built with no filename is in memory all the same. Here a driver
// can be injected with no filename in sight, so only SQLite itself can say what was opened.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createSqliteDriver } from './sql-driver.js';
import { SnapshotOverlayStorageAdapter } from './snapshot-overlay-storage-adapter.js';
import { SqliteStorageAdapter } from './sqlite-storage-adapter.js';

let dir = '';
const opened: { close(): void }[] = [];
const keep = <T extends { close(): void }>(s: T): T => {
	opened.push(s);
	return s;
};

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'rph-durability-'));
});
afterEach(() => {
	for (const s of opened.splice(0)) s.close();
	// Best-effort on Windows, where an unlink of a file still held open is refused.
	try {
		rmSync(dir, { recursive: true, force: true });
	} catch {
		/* the temp directory is the backstop */
	}
});

describe('⭐ what a store holds outlives the process only if the connection it opened is a FILE', () => {
	it('⛔ a store opened on a file is DURABLE', () => {
		// THE MUTANT THAT KILLS THIS: declare the answer on the class (`'NOT_DURABLE'`) instead of reading it.
		expect(keep(new SqliteStorageAdapter({ filename: join(dir, 'a.db') })).durability).toBe('DURABLE');
	});

	it('⛔ and so is one whose FILE driver was injected — the constructor never saw a filename', () => {
		const store = keep(new SqliteStorageAdapter({ driver: createSqliteDriver(join(dir, 'b.db')) }));
		expect(store.durability).toBe('DURABLE');
	});

	it('⭐ the default store, and an injected :memory: driver, are NOT_DURABLE', () => {
		expect(keep(new SqliteStorageAdapter()).durability).toBe('NOT_DURABLE');
		expect(keep(new SqliteStorageAdapter({ driver: createSqliteDriver(':memory:') })).durability).toBe(
			'NOT_DURABLE'
		);
	});

	it('⭐ a connection SQLite does not describe as having a `main` database is UNKNOWN — never NOT_DURABLE', () => {
		// No real connection lacks a `main` row; a driver this adapter was handed can still say so. The answer must
		// then be the one the Engine treats as DURABLE (`admit-stipulated-answers.test.ts`), because an adapter that
		// cannot tell what it opened must not be where test answers are admitted.
		const real = createSqliteDriver(':memory:');
		const noMain = new Proxy(real, {
			get: (t, k) =>
				k === 'prepare'
					? (sql: string) =>
							sql === 'PRAGMA database_list'
								? { all: () => [{ seq: 1, name: 'temp', file: '' }] }
								: t.prepare(sql)
					: Reflect.get(t, k, t)
		});
		expect(keep(new SqliteStorageAdapter({ driver: noMain })).durability).toBe('UNKNOWN');
	});

	it('⛔ a fork reports its SOURCE — its writes are committed back into that store', () => {
		// THE MUTANT: the overlay answers for itself (it IS in memory). A fork of a durable store would then look
		// ephemeral, and an admitting engine could be built over one.
		const durable = keep(new SqliteStorageAdapter({ filename: join(dir, 'c.db') }));
		expect(new SnapshotOverlayStorageAdapter(durable).durability).toBe('DURABLE');
		expect(new SnapshotOverlayStorageAdapter(keep(new SqliteStorageAdapter())).durability).toBe('NOT_DURABLE');
	});
});
