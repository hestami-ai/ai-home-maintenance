// W2-INC-2 (WP-2-007) — restart recovery: "restart recovery avoids duplicate external side effects."
//
// dispatch() commits state + events + outbox atomically but does NOT deliver the outbox (delivery is a separate
// drain). So a process that commits and then crashes leaves the events durably PENDING in the outbox, undelivered.
// On restart, recoverOutbox() SHALL re-drive every PENDING message exactly once, and a second recovery SHALL
// deliver nothing (an already-PUBLISHED message is never re-delivered). This test simulates the crash with a
// file-backed store closed WITHOUT draining, then reopens a fresh engine and recovers.
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import type { Principal } from '@janumipwb/rph-ports';
import { testDirectory } from '@janumipwb/rph-ports/testing';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createEngine, driveReferenceUndertaking } from './index.js';

const TS = '2026-07-12T00:00:00Z';

// ── THE DRIVE RUNS AS THE UNDERTAKING OWNER (D-1) ────────────────────────────────────────────────────────────
// `driveReferenceUndertaking` proposes each promotion Decision with `authority: { actorId: 'owner-1',
// actorType: 'HUMAN' }`, and REG-F-014 refuses a Decision whose declared authority is not its issuer. The drive
// used to assert that identity in the envelope (`issuedBy: ACTOR`); the SESSION carries it now, so only a
// session that IS `owner-1` can drive it — as `u1` the drive throws and there is no committed undertaking to
// crash with.
//
// ONE DIRECTORY, TWO SESSIONS, AND THAT IS THE POINT OF THE TEST. Session 2 is a genuinely fresh engine over the
// reopened file; it authenticates against the same directory because a restart re-establishes an identity from
// the same host, not a new cast. Recovery itself dispatches nothing, so its session only has to resolve.
const OWNER: Principal = {
	actorId: 'owner-1',
	actorType: 'HUMAN',
	displayName: 'Undertaking Owner',
	tenantId: 'tenant-test',
	organizationId: 'org-test',
	executionInstanceId: 'exec-production'
};
const DIR = testDirectory([OWNER]);
const OWNER_CRED = DIR.credentialFor(OWNER.actorId);

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
		const engine1 = createEngine({
			authenticate: DIR.authenticate,
			ontology,
			now: () => TS,
			newEventId,
			store: store1
		}).as(OWNER_CRED);
		driveReferenceUndertaking(engine1);
		const committed = store1.readAllEvents().length;
		// Premise: dispatch did NOT auto-deliver — every committed event is still PENDING in the outbox.
		expect(store1.readPendingOutbox()).toHaveLength(committed);
		store1.close(); // crash before delivery

		// --- session 2: restart, wire a subscriber, recover ---
		const store2 = new SqliteStorageAdapter({ filename: path, now: () => TS });
		try {
			const engine2 = createEngine({
				authenticate: DIR.authenticate,
				ontology,
				now: () => TS,
				newEventId,
				store: store2
			}).as(OWNER_CRED);
			const delivered: string[] = [];
			engine2.subscribe((e) => delivered.push(e.eventId));

			const recovered = engine2.recoverOutbox();
			expect(recovered).toBe(committed); // every PENDING message re-driven
			expect(delivered).toHaveLength(committed); // each delivered exactly once
			expect(new Set(delivered).size).toBe(committed); // no duplicates within the recovery

			// A second recovery finds nothing PENDING — no duplicate external side effect.
			expect(engine2.recoverOutbox()).toBe(0);
			expect(delivered).toHaveLength(committed);
		} finally {
			store2.close();
		}
	});
});
