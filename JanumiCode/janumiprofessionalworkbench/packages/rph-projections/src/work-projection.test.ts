import type { DomainEvent } from '@janumipwb/rph-contracts';
import { describe, expect, it } from 'vitest';
import { IncrementalProjection, rebuildProjection } from './projector.js';
import { isQualifiedSuccess, workProjector } from './work-projection.js';

const actor = { actorId: 'u1', actorType: 'HUMAN' as const, displayName: 'A' };

function evt(seq: number, eventType: string, payload: unknown, aggregateId?: string): DomainEvent {
	return {
		eventId: `evt_${seq}`,
		eventType,
		eventSchemaVersion: 1,
		aggregateType: 'INTENT',
		aggregateId: aggregateId ?? `agg_${seq}`,
		aggregateRevision: 0,
		occurredAt: '2026-07-11T00:00:00Z',
		recordedAt: '2026-07-11T00:00:00Z',
		actor,
		correlationId: 'c1',
		payload
	};
}

// The PwuProposed payload here was `{ pwuId, title }` — missing the four axes DOC-007 §11.3 REQUIRES and that
// the real event has carried since Increment 22. It passed because workProjector hardcoded the seeded axes
// instead of reading them; the fixture and the fold were wrong in exactly compensating ways, which is what a
// hand-authored fixture buys you. Now that the fold reads §11.3, the fixture has to be a §11.3 event.
const stream: DomainEvent[] = [
	evt(1, 'IntentCaptured', { intentId: 'int_1', originatingExpression: 'Build X' }),
	evt(
		2,
		'PwuProposed',
		{
			pwuId: 'pwu_1',
			pwuKind: 'ARCHITECTURE',
			title: 'Architecture',
			intentId: 'int_1',
			workLifecycleState: 'PROPOSED',
			executionState: 'NOT_PLANNED',
			assuranceState: 'UNASSESSED',
			shapeIntegrityState: 'UNKNOWN'
		},
		'pwu_1'
	)
];

describe('no-green-without-assurance rule (isQualifiedSuccess)', () => {
	it('is true ONLY when execution SUCCEEDED and assurance SATISFIED', () => {
		expect(isQualifiedSuccess('SUCCEEDED', 'SATISFIED')).toBe(true);
		expect(isQualifiedSuccess('SUCCEEDED', 'REJECTED')).toBe(false);
		expect(isQualifiedSuccess('SUCCEEDED', 'CONDITIONALLY_SATISFIED')).toBe(false);
		expect(isQualifiedSuccess('SUCCEEDED', undefined)).toBe(false);
		expect(isQualifiedSuccess('RUNNING', 'SATISFIED')).toBe(false);
	});
});

describe('Work projection', () => {
	it('folds IntentCaptured into an INTENT node (not a qualified success)', () => {
		const view = rebuildProjection(workProjector, [stream[0]!]);
		const n = view.nodes['int_1'];
		expect(n?.objectType).toBe('INTENT');
		expect(n?.intentStatus).toBe('RAW');
		expect(n?.title).toBe('Build X');
		expect(n?.qualifiedSuccess).toBe(false);
	});

	it('folds PwuProposed into a PWU node with the four state axes distinct', () => {
		const view = rebuildProjection(workProjector, stream);
		const n = view.nodes['pwu_1'];
		expect(n?.workLifecycleState).toBe('PROPOSED');
		expect(n?.executionState).toBe('NOT_PLANNED');
		expect(n?.assuranceState).toBe('UNASSESSED');
		expect(n?.shapeIntegrityState).toBe('UNKNOWN');
		expect(n?.qualifiedSuccess).toBe(false);
	});

	// RETITLED 2026-07-17. This claimed RPH-PER-007 and asserted the fold equals ITSELF over a hand-authored
	// two-event stream. Ratified PER-007 wants "all domain events" rebuilt and matched against something
	// independent; this compared a thing to itself, which is true of any pure function and of any broken one.
	//
	// It was actively CONCEALING a defect: workProjector defaulted on every event but IntentCaptured and
	// PwuProposed, so over a real stream it reported every PWU as PROPOSED while the objects were BASELINED.
	// A broken fold equals a broken fold. RPH-PER-007 is now proved for real in rph-engine's
	// projection-rebuild.test.ts, against the live 251-event reference undertaking and the materialized objects.
	//
	// What survives here is the honest, narrow claim: the fold is pure.
	it('the fold is pure (identical view every time) — NOT RPH-PER-007; see projection-rebuild.test.ts', () => {
		expect(rebuildProjection(workProjector, stream)).toEqual(
			rebuildProjection(workProjector, stream)
		);
	});

	it('is idempotent and matches a full rebuild (applying an event twice is a no-op)', () => {
		const inc = new IncrementalProjection(workProjector);
		inc.apply(stream[0]!);
		inc.apply(stream[0]!); // duplicate
		inc.apply(stream[1]!);
		expect(inc.checkpoint).toBe(2);
		expect(Object.keys(inc.current().nodes).sort()).toEqual(['int_1', 'pwu_1']);
		expect(inc.current()).toEqual(rebuildProjection(workProjector, stream));
	});

	it('rebuild() drops prior state and re-folds to the same result', () => {
		const inc = new IncrementalProjection(workProjector);
		inc.apply(evt(9, 'IntentCaptured', { intentId: 'stale', originatingExpression: 'gone' }));
		inc.rebuild(stream);
		expect(inc.current().nodes['stale']).toBeUndefined();
		expect(inc.current()).toEqual(rebuildProjection(workProjector, stream));
	});
});
