// W2-INC-3 (WP-2-006) — the Traceability and Compatibility projections are rebuildable from the reference
// undertaking's real event log (the exit criterion "Work, ..., Traceability, and compatibility projections can
// be rebuilt"). Drives the fixture live, then folds its events through both projectors and proves the derived
// content + rebuild==incremental equivalence (RPH-PER-007 for the two views W2 adds).
import {
	compatibilityProjector,
	IncrementalProjection,
	rebuildProjection,
	traceabilityProjector
} from '@janumipwb/rph-projections';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { describe, expect, it } from 'vitest';
import { createEngine, driveReferenceUndertaking, REFERENCE_UNDERTAKING as R } from './index.js';

function build() {
	let s = 0;
	const engine = createEngine({ ontology, now: () => '2026-07-12T00:00:00Z', newEventId: () => `evt_${++s}` });
	driveReferenceUndertaking(engine);
	return engine.readAllEvents();
}

describe('W2-INC-3 Traceability + Compatibility projections rebuildable from the reference undertaking', () => {
	it('Traceability folds the 12 decomposition edges + intent traces from events', () => {
		const events = build();
		const view = rebuildProjection(traceabilityProjector, events);
		const decomposes = view.links.filter((l) => l.type === 'DECOMPOSES');
		expect(decomposes).toHaveLength(12); // root -> 7 areas, architecture -> 5 concerns
		// architecture decomposes into each concern
		for (const concern of [R.systemContext, R.multiTenancy, R.dataArch, R.integrations, R.mobileOffline]) {
			expect(decomposes.some((l) => l.from === R.architecture && l.to === concern)).toBe(true);
		}
		// every PWU traces to the intent
		expect(view.links.some((l) => l.from === R.architecture && l.to === R.intentId && l.type === 'TRACES_TO_INTENT')).toBe(true);
	});

	it('Compatibility derives a milestone for every PWU (architecture=ARCHITECTURE, promotion=COMMIT)', () => {
		const events = build();
		const view = rebuildProjection(compatibilityProjector, events);
		expect(Object.keys(view.milestoneByPwu)).toHaveLength(13);
		expect(view.milestoneByPwu[R.architecture]).toBe('ARCHITECTURE');
		expect(view.milestoneByPwu[R.promotion]).toBe('COMMIT');
		expect(view.milestoneByPwu[R.mobileOffline]).toBe('ARCHITECTURE'); // ARCHITECTURE_CONCERN kind
	});

	it('both projections rebuild identically via incremental fold (RPH-PER-007)', () => {
		const events = build();
		const traceInc = new IncrementalProjection(traceabilityProjector);
		traceInc.rebuild(events);
		expect(traceInc.current()).toEqual(rebuildProjection(traceabilityProjector, events));
		const compatInc = new IncrementalProjection(compatibilityProjector);
		compatInc.rebuild(events);
		expect(compatInc.current()).toEqual(rebuildProjection(compatibilityProjector, events));
	});
});
