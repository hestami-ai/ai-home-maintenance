// createEngine composition smoke: the M4 walking-skeleton flow (CaptureIntent -> IntentCaptured -> persist ->
// outbox -> projection) driven entirely through the public facade — proving createEngine wires the whole stack.
import type { DomainCommand, DomainEvent } from '@janumipwb/rph-contracts';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
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
		const engine = createEngine({ authenticate: testAuthenticator(), ontology, now: () => '2026-07-11T00:00:00Z' }).as(TEST_CRED.human);
		const root = engine.ontology.pwuTemplates.find((t) => t.isRoot);
		expect(root?.pwuKind).toBe('PRODUCT_REALIZATION');
		engine.close();
	});

	it('drives the walking-skeleton flow end-to-end through the public seam', () => {
		let n = 0;
		const engine = createEngine({ authenticate: testAuthenticator(),
			ontology,
			now: () => '2026-07-11T00:00:00Z',
			newEventId: () => `evt_${++n}`
		}).as(TEST_CRED.human);
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
		const engine = createEngine({ authenticate: testAuthenticator(),
			ontology,
			now: () => '2026-07-11T00:00:00Z',
			newEventId: () => `evt_fork_${++n}`
		}).as(TEST_CRED.human);
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
		const engine = createEngine({ authenticate: testAuthenticator(),
			ontology,
			now: () => '2026-07-11T00:00:00Z',
			newEventId: () => `evt_snapshot_${++n}`
		}).as(TEST_CRED.human);
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
		const engine = createEngine({ authenticate: testAuthenticator(),
			ontology,
			now: () => '2026-07-11T00:00:00Z',
			newEventId: () => `evt_guard_${++n}`
		}).as(TEST_CRED.human);
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
		const engine = createEngine({ authenticate: testAuthenticator(),
			ontology,
			now: () => '2026-07-11T00:00:00Z',
			newEventId: () => `evt_post_${++n}`
		}).as(TEST_CRED.human);
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

// ⭐ THE WHOLE-LOG LIMB ADMITS AN EXACT SET, AND NAMES WHAT IT REFUSES (`JAN-CRITREAD` `TT-1`, `REG-F-425`).
// A staged authoring turn must be able to commit past the canonical records of its OWN reviewer's tries — and past
// nothing else. So the log after the caller's position must be EXACTLY the admitted events. Each case below
// isolates one term: B3 has equal counts (only IDENTITY can refuse it), B4 has no foreign event (only LENGTH can
// refuse it), B5 is the original bare-number rule, unchanged. In every refusal the guarded batch must not apply.
describe('the guarded batch admits exactly the named tail of the event log', () => {
	const otherIntentId = (k: number) => `int_01ARZ3NDEKTSV4RRFFQ69G5X0${k}`;
	const otherIntent = (k: number): DomainCommand => ({
		...captureIntent(),
		commandId: `cmd-other-${k}`,
		targetAggregateId: otherIntentId(k),
		idempotencyKey: `idem-other-${k}`,
		payload: { ...(captureIntent().payload as Record<string, unknown>), intentId: otherIntentId(k) }
	});

	function arrange() {
		let n = 0;
		const engine = createEngine({
			authenticate: testAuthenticator(),
			ontology,
			now: () => '2026-07-11T00:00:00Z',
			newEventId: () => `evt_log_${++n}`
		}).as(TEST_CRED.human);
		expect(engine.dispatch(captureIntent()).status).toBe('ACCEPTED');
		const position = engine.readAllEvents().length;
		/** An event on an aggregate the guarded batch never touches — admitted or foreign by the caller's say. */
		const act = (k: number): string => {
			const r = engine.dispatch(otherIntent(k));
			expect(r.status).toBe('ACCEPTED');
			expect(r.producedEventIds).toHaveLength(1);
			return r.producedEventIds[0]!;
		};
		const guarded = (expected: number | readonly string[]) =>
			engine.dispatchBatchGuarded(
				[beginDiscovery()],
				[{ aggregateId: INTENT_ID, expectedRevision: 0 }],
				typeof expected === 'number' ? expected : { position, admittedEventIds: expected }
			);
		const untouched = () => expect(engine.loadObject(INTENT_ID)?.revision, 'the batch applied').toBe(0);
		return { engine, position, act, guarded, untouched };
	}

	it('B1 — a tail that is exactly the admitted events commits', () => {
		const { engine, act, guarded } = arrange();
		const own = act(1);
		const result = guarded([own]);
		expect(result.ok, JSON.stringify(result.guardConflict)).toBe(true);
		expect(engine.loadObject(INTENT_ID)?.revision).toBe(1);
		engine.close();
	});

	it('B2 — one foreign event beside the admitted ones refuses, and is named', () => {
		const { engine, position, act, guarded, untouched } = arrange();
		const own = act(1);
		const foreign = act(2);
		const result = guarded([own]);
		expect(result.ok).toBe(false);
		expect(result.guardConflict).toEqual({
			aggregateId: '@event-log',
			expectedRevision: position + 1,
			actualRevision: position + 2,
			unadmitted: {
				eventId: foreign,
				eventType: 'IntentCaptured',
				aggregateType: 'INTENT',
				aggregateId: otherIntentId(2)
			}
		});
		untouched();
		engine.close();
	});

	it('B3 — equal counts do not fool it: a foreign event standing in for an admitted one refuses by IDENTITY', () => {
		const { engine, position, act, guarded, untouched } = arrange();
		const foreign = act(2);
		const result = guarded(['evt_admitted_but_never_written']);
		expect(result.ok).toBe(false);
		expect(result.guardConflict).toMatchObject({
			expectedRevision: position + 1,
			actualRevision: position + 1,
			unadmitted: { eventId: foreign }
		});
		untouched();
		engine.close();
	});

	it('B4 — an admitted event missing from the log refuses by LENGTH, with nothing foreign to name', () => {
		const { engine, position, act, guarded, untouched } = arrange();
		const own = act(1);
		const result = guarded([own, 'evt_admitted_but_never_written']);
		expect(result.ok).toBe(false);
		expect(result.guardConflict).toMatchObject({
			aggregateId: '@event-log',
			expectedRevision: position + 2,
			actualRevision: position + 1
		});
		expect(result.guardConflict?.unadmitted).toBeUndefined();
		untouched();
		engine.close();
	});

	it('B5 — the bare-number form is the original rule: any growth refuses', () => {
		const { engine, position, act, guarded, untouched } = arrange();
		const foreign = act(2);
		const result = guarded(position);
		expect(result.ok).toBe(false);
		expect(result.guardConflict).toMatchObject({
			aggregateId: '@event-log',
			expectedRevision: position,
			actualRevision: position + 1,
			unadmitted: { eventId: foreign }
		});
		untouched();
		engine.close();
	});
});
