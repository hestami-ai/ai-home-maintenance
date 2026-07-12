// The M4 walking skeleton: a single CaptureIntent flows through the entire stack —
// validate -> produce IntentCaptured -> persist events+outbox atomically -> drain outbox -> project —
// with idempotency and optimistic concurrency. This is the smallest end-to-end proof of the architecture.
import type { DomainCommand, DomainEvent } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from './index.js';

const ULID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const INTENT_ID = `int_${ULID}`;
const actor = { actorId: 'user-1', actorType: 'HUMAN' as const, displayName: 'Alice' };

function captureIntent(over: Partial<DomainCommand> = {}): DomainCommand {
	return {
		commandId: 'cmd-1',
		commandType: 'CaptureIntent',
		commandSchemaVersion: 1,
		targetAggregateType: 'INTENT',
		targetAggregateId: INTENT_ID,
		issuedAt: '2026-07-11T00:00:00Z',
		issuedBy: actor,
		correlationId: 'corr-1',
		idempotencyKey: 'idem-1',
		payload: {
			intentId: INTENT_ID,
			originatingExpression: 'Build a field service management SaaS',
			ontologyId: 'product-realization-pwa',
			ontologyVersion: '1.0.0'
		},
		...over
	};
}

describe('M4 walking skeleton: CaptureIntent -> IntentCaptured -> persist -> outbox -> projection', () => {
	let store: SqliteStorageAdapter;
	let engine: Engine;
	let projection: Map<string, { intentStatus: string; originatingExpression: string }>;
	let seq = 0;

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => '2026-07-11T00:00:00Z' });
		seq = 0;
		engine = new Engine({
			store,
			now: () => '2026-07-11T00:00:00Z',
			newEventId: () => `evt_${++seq}`
		});
		projection = new Map();
		// A minimal Work-view projection built from events (full rebuildable projections = M5).
		engine.subscribe((event: DomainEvent) => {
			if (event.eventType === 'IntentCaptured') {
				const p = event.payload as { intentId: string; originatingExpression: string };
				projection.set(p.intentId, {
					intentStatus: 'RAW',
					originatingExpression: p.originatingExpression
				});
			}
		});
	});

	it('accepts the command, persists the event + object, and drains the outbox to the projection', () => {
		const result = engine.dispatch(captureIntent());
		expect(result.status).toBe('ACCEPTED');
		expect(result.producedEventIds).toEqual(['evt_1']);

		// persisted object state
		const obj = store.loadObject(INTENT_ID);
		expect(obj?.objectType).toBe('INTENT');
		expect((obj?.state as { intentStatus: string }).intentStatus).toBe('RAW');

		// persisted event
		const events = store.readAggregateEvents('INTENT', INTENT_ID);
		expect(events).toHaveLength(1);
		expect(events[0]!.eventType).toBe('IntentCaptured');

		// outbox -> projection
		expect(store.readPendingOutbox()).toHaveLength(1);
		const drained = engine.drainOutbox();
		expect(drained).toBe(1);
		expect(store.readPendingOutbox()).toHaveLength(0);
		expect(projection.get(INTENT_ID)?.originatingExpression).toBe(
			'Build a field service management SaaS'
		);
	});

	it('is idempotent: re-dispatching the same idempotencyKey returns DUPLICATE with no new event', () => {
		engine.dispatch(captureIntent());
		const again = engine.dispatch(captureIntent());
		expect(again.status).toBe('DUPLICATE');
		expect(again.producedEventIds).toEqual(['evt_1']);
		expect(store.readAggregateEvents('INTENT', INTENT_ID)).toHaveLength(1);
	});

	it('rejects a second CaptureIntent for an existing aggregate with RPH_REVISION_CONFLICT', () => {
		engine.dispatch(captureIntent());
		const conflict = engine.dispatch(
			captureIntent({ commandId: 'cmd-2', idempotencyKey: 'idem-2' })
		);
		expect(conflict.status).toBe('CONFLICT');
		expect(conflict.error?.code).toBe('RPH_REVISION_CONFLICT');
	});

	it('rejects a malformed payload with VALIDATION_FAILED (unknown property)', () => {
		const bad = captureIntent({
			idempotencyKey: 'idem-bad',
			payload: { intentId: INTENT_ID, sneaky: true } as never
		});
		const result = engine.dispatch(bad);
		expect(result.status).toBe('VALIDATION_FAILED');
		expect(result.error?.code).toBe('RPH_VALIDATION_SCHEMA_FAILED');
	});
});
