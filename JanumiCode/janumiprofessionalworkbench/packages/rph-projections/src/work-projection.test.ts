import type { DomainEvent } from '@janumipwb/rph-contracts';
import { describe, expect, it } from 'vitest';
import { IncrementalProjection, rebuildProjection } from './projector.js';
import { isQualifiedSuccess, workProjector } from './work-projection.js';

const actor = { actorId: 'u1', actorType: 'HUMAN' as const, displayName: 'A' };

function evt(seq: number, eventType: string, payload: unknown): DomainEvent {
	return {
		eventId: `evt_${seq}`,
		eventType,
		eventSchemaVersion: 1,
		aggregateType: 'INTENT',
		aggregateId: `agg_${seq}`,
		aggregateRevision: 0,
		occurredAt: '2026-07-11T00:00:00Z',
		recordedAt: '2026-07-11T00:00:00Z',
		actor,
		correlationId: 'c1',
		payload
	};
}

const stream: DomainEvent[] = [
	evt(1, 'IntentCaptured', { intentId: 'int_1', originatingExpression: 'Build X' }),
	evt(2, 'PwuProposed', { pwuId: 'pwu_1', title: 'Architecture' })
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

	it('RPH-PER-007: rebuild-from-empty is deterministic (identical view every time)', () => {
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
