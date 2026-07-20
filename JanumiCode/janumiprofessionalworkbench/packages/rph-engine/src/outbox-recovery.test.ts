// W2-INC-2 (WP-2-007) — restart recovery: "restart recovery avoids duplicate external side effects."
//
// dispatch() commits state + events + outbox atomically but does NOT deliver the outbox (delivery is a separate
// drain). So a process that commits and then crashes leaves the events durably PENDING in the outbox, undelivered.
// On restart, recoverOutbox() SHALL re-drive every PENDING message exactly once, and a second recovery SHALL
// deliver nothing (an already-PUBLISHED message is never re-delivered). This test simulates the crash with a
// file-backed store closed WITHOUT draining, then reopens a fresh engine and recovers.
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createEngine, driveReferenceUndertaking } from './index.js';

const TS = '2026-07-12T00:00:00Z';

describe('W2-INC-2 restart outbox recovery', () => {
	let path = '';
	afterEach(() => {
		for (const suffix of ['', '-wal', '-shm']) {
			const p = `${path}${suffix}`;
			if (p && existsSync(p)) rmSync(p);
		}
	});

	it('re-drives PENDING outbox exactly once on restart, and not again', () => {
		path = join(tmpdir(), `rph-w2-recovery-${process.pid}-${Date.now()}.db`);
		let counter = 1;
		const newEventId = () => `evt_${counter++}`;

		// --- session 1: commit a full undertaking, then "crash" (close without draining) ---
		const store1 = new SqliteStorageAdapter({ filename: path, now: () => TS });
		const engine1 = createEngine({ ontology, now: () => TS, newEventId, store: store1 });
		driveReferenceUndertaking(engine1);
		const committed = store1.readAllEvents().length;
		// Premise: dispatch did NOT auto-deliver — every committed event is still PENDING in the outbox.
		expect(store1.readPendingOutbox()).toHaveLength(committed);
		store1.close(); // crash before delivery

		// --- session 2: restart, wire a subscriber, recover ---
		const store2 = new SqliteStorageAdapter({ filename: path, now: () => TS });
		try {
			const engine2 = createEngine({ ontology, now: () => TS, newEventId, store: store2 });
			const delivered: string[] = [];
			engine2.subscribe((e) => delivered.push(e.eventId));

			const recovered = engine2.recoverOutbox();
			expect(recovered).toBe(committed); // every PENDING message re-driven
			expect(delivered).toHaveLength(committed); // each delivered exactly once
			expect(new Set(delivered).size).toBe(committed); // no duplicates within the recovery

			// A second recovery finds nothing PENDING — no duplicate external side effect.
			expect(engine2.recoverOutbox()).toBe(0);
			expect(delivered.length).toBe(committed);
		} finally {
			store2.close();
		}
	});
});
