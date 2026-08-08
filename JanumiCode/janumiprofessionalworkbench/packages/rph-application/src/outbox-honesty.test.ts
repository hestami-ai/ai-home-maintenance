// C-3 — the outbox may not report delivery it did not perform.
//
// ── WHAT WAS WRONG, AND WHY IT WAS PERMANENT ─────────────────────────────────────────────────────────────────
// `drainOutbox` looped over `this.subscribers` — a no-op when the list is empty — and then called
// `markOutboxPublished` on every pending id unconditionally. Nothing in production registers an event
// subscriber (the enforcement register already recorded this), so every event the engine ever committed was
// marked delivered to nobody.
//
// The damage is not the missed delivery; it is the `status` column. `recoverOutbox` re-drives only PENDING rows
// — deliberately, so a restart cannot duplicate an external side effect — so a row wrongly marked PUBLISHED is
// invisible to every future subscriber FOREVER. Wire a projection tomorrow and it starts from the present with
// no way to learn it missed the past.
//
// It also falsified the class's own contract: "Delivery is therefore at-least-once; subscribers SHALL be
// idempotent." With no subscriber it was at-most-zero.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from './index.js';

const TS = '2026-08-08T00:00:00Z';
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69G5M00';

describe('drainOutbox reports only delivery it performed', () => {
	let store: SqliteStorageAdapter;
	let seq = 0;

	const engineOn = (s: SqliteStorageAdapter) =>
		new Engine({
			authenticate: testAuthenticator(),
			store: s,
			now: () => TS,
			newEventId: () => `e${++seq}`
		});

	const capture = (): DomainCommand => ({
		commandId: 'c-1',
		commandType: 'CaptureIntent',
		commandSchemaVersion: 1,
		targetAggregateType: 'INTENT',
		targetAggregateId: INTENT,
		issuedAt: TS,
		correlationId: 'corr',
		idempotencyKey: 'k-1',
		payload: {
			intentId: INTENT,
			originatingExpression: 'x',
			ontologyId: 'o',
			ontologyVersion: '1'
		}
	});

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
	});

	it('with NO subscriber: delivers nothing, reports nothing, and leaves the row PENDING', () => {
		const engine = engineOn(store);
		expect(engine.as(TEST_CRED.human).dispatch(capture()).status).toBe('ACCEPTED');
		expect(store.readPendingOutbox()).toHaveLength(1);

		expect(engine.drainOutbox(), 'a drain that delivered to nobody drained nothing').toBe(0);
		expect(
			store.readPendingOutbox(),
			'the row must stay PENDING — marking it PUBLISHED hides it from every future subscriber'
		).toHaveLength(1);
	});

	// THE CONSEQUENCE, DRIVEN RATHER THAN ARGUED. This is the case the old behaviour made unreachable: a
	// subscriber wired AFTER the event was committed must still receive it. Under the old code the first drain
	// marked the row PUBLISHED, and this delivery never happened.
	it('a subscriber registered LATER still receives the event a prior drain could not deliver', () => {
		const engine = engineOn(store);
		expect(engine.as(TEST_CRED.human).dispatch(capture()).status).toBe('ACCEPTED');
		expect(engine.drainOutbox()).toBe(0); // nobody listening yet

		const seen: string[] = [];
		engine.subscribe((e) => seen.push(e.eventType));
		expect(engine.recoverOutbox()).toBe(1);
		expect(seen, 'the event survived the subscriber-less drain and was delivered on recovery').toEqual([
			'IntentCaptured'
		]);
		expect(store.readPendingOutbox()).toHaveLength(0);
	});

	// ── CONTROLS ─────────────────────────────────────────────────────────────────────────────────────────────
	// The two cases above pass if drainOutbox is broken into always returning 0 and never marking anything.
	// These fail in that world.

	it('CONTROL — with a subscriber it DOES deliver, report, and mark published', () => {
		const engine = engineOn(store);
		const seen: string[] = [];
		engine.subscribe((e) => seen.push(e.eventType));
		expect(engine.as(TEST_CRED.human).dispatch(capture()).status).toBe('ACCEPTED');

		expect(engine.drainOutbox()).toBe(1);
		expect(seen).toEqual(['IntentCaptured']);
		expect(store.readPendingOutbox()).toHaveLength(0);
	});

	it('CONTROL — an already-drained outbox reports 0 and does not re-deliver', () => {
		const engine = engineOn(store);
		const seen: string[] = [];
		engine.subscribe((e) => seen.push(e.eventType));
		engine.as(TEST_CRED.human).dispatch(capture());
		expect(engine.drainOutbox()).toBe(1);

		// at-least-once, not at-least-twice: a PUBLISHED row is never re-delivered.
		expect(engine.drainOutbox()).toBe(0);
		expect(seen).toHaveLength(1);
	});
});
