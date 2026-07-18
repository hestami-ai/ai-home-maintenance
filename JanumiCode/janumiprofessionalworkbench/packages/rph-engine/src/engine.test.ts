// createEngine composition smoke: the M4 walking-skeleton flow (CaptureIntent -> IntentCaptured -> persist ->
// outbox -> projection) driven entirely through the public facade — proving createEngine wires the whole stack.
import type { DomainCommand, DomainEvent } from '@janumipwb/rph-contracts';
import { contentHash } from '@janumipwb/rph-contracts/hash';
// The TEST is the composition root here: it chooses which PWA to load and injects it (the engine itself is
// PWA-agnostic and imports no concrete PWA — rph-product-realization-pwa is a devDependency for this reason).
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { describe, expect, it } from 'vitest';
import { createEngine } from './index.js';

const INTENT_ID = 'int_01ARZ3NDEKTSV4RRFFQ69G5FAV';

function captureIntent(): DomainCommand {
	return {
		commandId: 'cmd-1',
		commandType: 'CaptureIntent',
		commandSchemaVersion: 1,
		targetAggregateType: 'INTENT',
		targetAggregateId: INTENT_ID,
		issuedAt: '2026-07-11T00:00:00Z',
		issuedBy: { actorId: 'user-1', actorType: 'HUMAN', displayName: 'Alice' },
		correlationId: 'corr-1',
		idempotencyKey: 'idem-1',
		payload: {
			intentId: INTENT_ID,
			originatingExpression: 'Build a field service management SaaS',
			ontologyId: 'product-realization-pwa',
			ontologyVersion: '1.0.0'
		}
	};
}

function beginDiscovery(): DomainCommand {
	return {
		...captureIntent(),
		commandId: 'cmd-2',
		commandType: 'BeginIntentDiscovery',
		idempotencyKey: 'idem-2',
		payload: {}
	};
}

describe('createEngine — the composition facade', () => {
	it('stands up an in-memory engine with the Product Realization PWA ontology loaded (root Product Realization PWU)', () => {
		const engine = createEngine({ ontology, now: () => '2026-07-11T00:00:00Z' });
		const root = engine.ontology.pwuTemplates.find((t) => t.isRoot);
		expect(root?.pwuKind).toBe('PRODUCT_REALIZATION');
		engine.close();
	});

	it('drives the walking-skeleton flow end-to-end through the public seam', () => {
		let n = 0;
		const engine = createEngine({
			ontology,
			now: () => '2026-07-11T00:00:00Z',
			newEventId: () => `evt_${++n}`
		});
		const projected: string[] = [];
		engine.subscribe((e: DomainEvent) => {
			if (e.eventType === 'IntentCaptured')
				projected.push((e.payload as { intentId: string }).intentId);
		});

		const result = engine.dispatch(captureIntent());
		expect(result.status).toBe('ACCEPTED');

		// persisted object queryable through the seam
		const obj = engine.loadObject(INTENT_ID);
		expect(obj?.objectType).toBe('INTENT');
		expect((obj?.state as { intentStatus: string }).intentStatus).toBe('RAW');

		// event log queryable through the seam
		expect(engine.readAllEvents().map((e) => e.eventType)).toEqual(['IntentCaptured']);

		// outbox -> projection through the seam
		expect(engine.drainOutbox()).toBe(1);
		expect(projected).toEqual([INTENT_ID]);

		// idempotent re-dispatch: no new event
		expect(engine.dispatch(captureIntent()).status).toBe('DUPLICATE');
		expect(engine.readAllEvents()).toHaveLength(1);

		engine.close();
	});

	it('forks a point-in-time candidate that exercises real handlers without mutating canonical state', () => {
		let n = 0;
		const engine = createEngine({
			ontology,
			now: () => '2026-07-11T00:00:00Z',
			newEventId: () => `evt_fork_${++n}`
		});
		const candidate = engine.fork();

		expect(candidate.dispatch(captureIntent()).status).toBe('ACCEPTED');
		expect(candidate.loadObject(INTENT_ID)).toBeDefined();
		expect(candidate.readAllEvents().map((event) => event.eventType)).toEqual(['IntentCaptured']);

		// The fork is a candidate, not optimistic canonical mutation.
		expect(engine.loadObject(INTENT_ID)).toBeUndefined();
		expect(engine.readAllEvents()).toEqual([]);

		candidate.close();
		engine.close();
	});

	it('a fork is point-in-time: later canonical writes do not leak into the candidate', () => {
		let n = 0;
		const engine = createEngine({
			ontology,
			now: () => '2026-07-11T00:00:00Z',
			newEventId: () => `evt_snapshot_${++n}`
		});
		const candidate = engine.fork();

		expect(engine.dispatch(captureIntent()).status).toBe('ACCEPTED');
		expect(engine.loadObject(INTENT_ID)).toBeDefined();
		expect(candidate.loadObject(INTENT_ID)).toBeUndefined();
		expect(candidate.readAllEvents()).toEqual([]);
		// The late canonical receipt must not leak either: the same command is new in the point-in-time fork.
		expect(candidate.dispatch(captureIntent()).status).toBe('ACCEPTED');

		candidate.close();
		engine.close();
	});

	it('guards the base revision and exact resultant object state inside the replay transaction', () => {
		let n = 0;
		const engine = createEngine({
			ontology,
			now: () => '2026-07-11T00:00:00Z',
			newEventId: () => `evt_guard_${++n}`
		});
		expect(engine.dispatch(captureIntent()).status).toBe('ACCEPTED');
		const candidate = engine.fork();
		expect(candidate.dispatch(beginDiscovery()).status).toBe('ACCEPTED');
		const expected = candidate.loadObject(INTENT_ID)!;

		const committed = engine.dispatchBatchGuarded(
			[beginDiscovery()],
			[{ aggregateId: INTENT_ID, expectedRevision: 0 }],
			1,
			[{ aggregateId: INTENT_ID, expectedContentHash: contentHash(expected) }]
		);
		expect(committed.ok).toBe(true);
		expect(engine.loadObject(INTENT_ID)).toEqual(expected);

		candidate.close();
		engine.close();
	});

	it('rolls back replay when a resultant-state postcondition does not match', () => {
		let n = 0;
		const engine = createEngine({
			ontology,
			now: () => '2026-07-11T00:00:00Z',
			newEventId: () => `evt_post_${++n}`
		});
		expect(engine.dispatch(captureIntent()).status).toBe('ACCEPTED');
		const before = engine.loadObject(INTENT_ID);

		const rejected = engine.dispatchBatchGuarded(
			[beginDiscovery()],
			[{ aggregateId: INTENT_ID, expectedRevision: 0 }],
			1,
			[{ aggregateId: INTENT_ID, expectedContentHash: 'sha256:deliberately-wrong' }]
		);
		expect(rejected.ok).toBe(false);
		expect(rejected.postconditionConflict?.aggregateId).toBe(INTENT_ID);
		expect(engine.loadObject(INTENT_ID)).toEqual(before);
		expect(engine.readAllEvents()).toHaveLength(1);

		engine.close();
	});
});
