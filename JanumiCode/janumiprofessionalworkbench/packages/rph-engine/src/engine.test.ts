// createEngine composition smoke: the M4 walking-skeleton flow (CaptureIntent -> IntentCaptured -> persist ->
// outbox -> projection) driven entirely through the public facade — proving createEngine wires the whole stack.
import type { DomainCommand, DomainEvent } from '@janumipwb/rph-contracts';
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
});
