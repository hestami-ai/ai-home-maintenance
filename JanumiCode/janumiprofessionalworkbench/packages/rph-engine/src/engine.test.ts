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
		const engine = createEngine({
			authenticate: testAuthenticator(),
			ontology,
			now: () => '2026-07-11T00:00:00Z'
		}).as(TEST_CRED.human);
		const root = engine.ontology.pwuTemplates.find((t) => t.isRoot);
		expect(root?.pwuKind).toBe('PRODUCT_REALIZATION');
		engine.close();
	});

	it('drives the walking-skeleton flow end-to-end through the public seam', () => {
		let n = 0;
		const engine = createEngine({
			authenticate: testAuthenticator(),
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
		const engine = createEngine({
			authenticate: testAuthenticator(),
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
		const engine = createEngine({
			authenticate: testAuthenticator(),
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
		const engine = createEngine({
			authenticate: testAuthenticator(),
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
		const engine = createEngine({
			authenticate: testAuthenticator(),
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

// ⭐ THROUGH THE FACADE: A DECLARED DEPENDENCY REFUSES, THE CALLER'S OWN ACTS NEVER DO (`JAN-CRITREAD` `DD-3`,
// `REG-D-070`). A staged authoring turn is refused only by a change to something it declared — a member of a group,
// or a pin — and never by its own acts, which it names BY ID. `TT-1`'s exact-tail form is gone; B1–B3 carry over in
// the declared form. ⛔ B4 — an admitted event MISSING from the log, refused by LENGTH — is ABOLISHED by `REG-D-070`:
// with no length term, admitting an event that is not in the tail changes nothing (its mutant, `TT-M3`, records the
// ruling). B5 is the original bare-number rule, unchanged. In every refusal the guarded batch must not apply.
describe('the guarded batch refuses on a declared dependency, never on the caller’s own acts', () => {
	const otherIntentId = (k: number) => `int_01ARZ3NDEKTSV4RRFFQ69G5X0${k}`;
	const otherIntent = (k: number): DomainCommand => ({
		...captureIntent(),
		commandId: `cmd-other-${k}`,
		targetAggregateId: otherIntentId(k),
		idempotencyKey: `idem-other-${k}`,
		payload: { ...(captureIntent().payload as Record<string, unknown>), intentId: otherIntentId(k) }
	});
	/** The declared group: the other intents this file acts on (an intent's stored state keys it as `id`). */
	const others = {
		name: 'the other intents',
		aggregateType: 'INTENT',
		key: [{ field: 'id', oneOf: [1, 2, 3].map(otherIntentId) }]
	};

	function arrange() {
		let n = 0;
		const engine = createEngine({
			authenticate: testAuthenticator(),
			ontology,
			now: () => '2026-07-11T00:00:00Z',
			newEventId: () => `evt_log_${++n}`
		}).as(TEST_CRED.human);
		expect(engine.dispatch(captureIntent()).status).toBe('ACCEPTED');
		/** The bare-number form's position: an event COUNT, as it always was. */
		const position = engine.readAllEvents().length;
		/** The declared form's position: the store's own, read the way a turn reads it — off a fork's base. */
		const probe = engine.fork();
		const mark = probe.forkBase()!.mark;
		probe.close();
		/** An event on an aggregate the guarded batch never touches — the caller's own or foreign, by its say. */
		const act = (k: number): string => {
			const r = engine.dispatch(otherIntent(k));
			expect(r.status).toBe('ACCEPTED');
			expect(r.producedEventIds).toHaveLength(1);
			return r.producedEventIds[0]!;
		};
		const guarded = (admittedEventIds: readonly string[]) =>
			engine.dispatchBatchGuarded(
				[beginDiscovery()],
				[{ aggregateId: INTENT_ID, expectedRevision: 0 }],
				{ mark, admittedEventIds, groups: [others] }
			);
		const bare = (expected: number) =>
			engine.dispatchBatchGuarded(
				[beginDiscovery()],
				[{ aggregateId: INTENT_ID, expectedRevision: 0 }],
				expected
			);
		const untouched = () =>
			expect(engine.loadObject(INTENT_ID)?.revision, 'the batch applied').toBe(0);
		return { engine, position, act, guarded, bare, untouched };
	}

	it('B1 — a tail of the caller’s own acts on a declared member commits', () => {
		const { engine, act, guarded } = arrange();
		const own = act(1);
		const result = guarded([own]);
		expect(result.ok, JSON.stringify(result.dependencyViolations)).toBe(true);
		expect(engine.loadObject(INTENT_ID)?.revision).toBe(1);
		engine.close();
	});

	it('B2 — a foreign event on a declared member beside the caller’s own refuses, and is named', () => {
		const { engine, act, guarded, untouched } = arrange();
		const own = act(1);
		const foreign = act(2);
		const result = guarded([own]);
		expect(result.ok).toBe(false);
		expect(result.dependencyViolations).toEqual([
			{
				kind: 'GROUP',
				name: 'the other intents',
				aggregateId: otherIntentId(2),
				event: expect.objectContaining({ eventId: foreign, eventType: 'IntentCaptured' }) as unknown
			}
		]);
		untouched();
		engine.close();
	});

	it('B3 — equal counts do not fool it: a foreign event standing in for an admitted one refuses by IDENTITY', () => {
		const { engine, act, guarded, untouched } = arrange();
		const foreign = act(2);
		const result = guarded(['evt_admitted_but_never_written']);
		expect(result.ok).toBe(false);
		expect(result.dependencyViolations?.map((v) => v.event?.eventId)).toEqual([foreign]);
		untouched();
		engine.close();
	});

	it('B5 — the bare-number form is the original rule: any growth refuses', () => {
		const { engine, position, act, bare, untouched } = arrange();
		const foreign = act(2);
		const result = bare(position);
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
