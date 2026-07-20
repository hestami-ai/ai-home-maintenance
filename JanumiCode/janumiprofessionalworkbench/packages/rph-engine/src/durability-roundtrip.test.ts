// W2-INC-1 (WP-2-001) — the master exit criterion, at the fixture level: "the reference fixture persists and
// replays to the same canonical state." Drive the full Reference Undertaking into a FILE-BACKED store, close it,
// reopen a brand-new adapter over the same file, and prove every aggregate's canonical state survived the
// round-trip byte-for-byte (plus the whole event log). This is the durability half of RPH-PER; the in-memory
// replay-equivalence half is RPH-PER-006/007.
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createEngine, driveReferenceUndertaking } from './index.js';

const TS = '2026-07-12T00:00:00Z';

describe('W2-INC-1 reference-fixture durability round-trip', () => {
	let path = '';
	afterEach(() => {
		for (const suffix of ['', '-wal', '-shm']) {
			const p = `${path}${suffix}`;
			if (p && existsSync(p)) rmSync(p);
		}
	});

	it('persists the whole Reference Undertaking and reopens to identical canonical state', () => {
		path = join(tmpdir(), `rph-w2-reffixture-${process.pid}-${Date.now()}.db`);
		const newEventId = () => `evt_${counter++}`;
		let counter = 1;

		const store1 = new SqliteStorageAdapter({ filename: path, now: () => TS });
		const engine1 = createEngine({ ontology, now: () => TS, newEventId, store: store1 });
		driveReferenceUndertaking(engine1);

		// Every aggregate that received an event, captured before the store is closed.
		const ids = [...new Set(store1.readAllEvents().map((e) => e.aggregateId))];
		expect(ids.length).toBeGreaterThan(10); // ~13 PWUs + intent + policies + contracts + assessment + baseline
		const before = new Map(ids.map((id) => [id, store1.loadObject(id)]));
		const eventCount = store1.readAllEvents().length;
		store1.close();

		// A fresh adapter over the same file — nothing carries over in memory.
		const store2 = new SqliteStorageAdapter({ filename: path, now: () => TS });
		try {
			for (const id of ids) {
				expect(store2.loadObject(id)).toEqual(before.get(id));
			}
			expect(store2.readAllEvents()).toHaveLength(eventCount);
		} finally {
			store2.close();
		}
	});
});
