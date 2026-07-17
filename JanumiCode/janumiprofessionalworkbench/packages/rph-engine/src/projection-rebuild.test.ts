// RPH-PER-007 — Projection rebuild, proved against the live engine.
//
//   "Given all domain events and empty projection tables. When projections are rebuilt. Then Work, Assurance, and
//    Compatibility views match the expected fixture projections."
//
// WHY THIS FILE EXISTS. The test that claimed this ratified property asserted:
//
//     expect(rebuildProjection(workProjector, stream)).toEqual(rebuildProjection(workProjector, stream));
//
// — the fold compared to ITSELF, over a hand-authored TWO-event stream, with no fixture anywhere. It proves the
// function is deterministic. Ratified PER-007 asks for "ALL domain events" and a match against something
// independent. Neither was there.
//
// It was not merely weak. It was CONCEALING A BROKEN VIEW: workProjector handled `IntentCaptured` and
// `PwuProposed` and defaulted on everything else, so rebuilt over the reference undertaking's real stream it
// reported every PWU as PROPOSED/NOT_PLANNED/UNASSESSED while the objects were BASELINED/SUCCEEDED/SATISFIED.
// A broken fold equals a broken fold, and the suite stayed green. This is the third instance of the same
// anti-pattern in this codebase (professionalWorkGraph twice on one engine; PER-006's "rebuild equivalence" that
// never rebuilt; this) — a test that compares a thing to itself and reports coverage.
//
// WHAT "the expected fixture projections" MEANS HERE. A golden file I generate from current behaviour would pin
// my own output and prove only stability. The stronger and more honest oracle is already in the system: the
// MATERIALIZED state, produced by a completely different path (command handlers writing objects) from the same
// events. If the fold and the write-side disagree, one of them is wrong — and that is a real finding either way.
// The Work view's whole job is to describe those objects to a surface.
import { rebuildProjection, workProjector, type WorkView } from '@janumipwb/rph-projections';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { describe, expect, it } from 'vitest';
import { createEngine, driveReferenceUndertaking, REFERENCE_UNDERTAKING } from './index.js';

describe('RPH-PER-007 — projection rebuild', () => {
	function build() {
		const engine = createEngine({
			ontology,
			now: () => '2026-07-12T00:00:00Z',
			newEventId: (() => {
				let s = 0;
				return () => `evt_${++s}`;
			})()
		});
		driveReferenceUndertaking(engine);
		return engine;
	}

	const PWU_IDS = Object.entries(REFERENCE_UNDERTAKING)
		.filter(([k]) => k !== 'intentId')
		.map(([, v]) => v);

	it('the Work view rebuilt from ALL domain events matches the materialized objects', () => {
		const engine = build();
		const view = rebuildProjection(workProjector, engine.readAllEvents()) as WorkView;

		const mismatches: string[] = [];
		for (const id of PWU_IDS) {
			const n = view.nodes[id];
			expect(n, `PWU ${id} is missing from the rebuilt Work view`).toBeDefined();
			const m = engine.loadObject(id)?.state as Record<string, unknown>;
			for (const axis of [
				'workLifecycleState',
				'executionState',
				'assuranceState',
				'shapeIntegrityState'
			] as const) {
				if (n![axis] !== m[axis]) {
					mismatches.push(`${id}.${axis}: view=${String(n![axis])} object=${String(m[axis])}`);
				}
			}
		}
		expect(mismatches, mismatches.join(' | ')).toEqual([]);
	});

	it("the view's qualifiedSuccess agrees with the objects — no green without assurance, at the render boundary", () => {
		const engine = build();
		const view = rebuildProjection(workProjector, engine.readAllEvents()) as WorkView;

		// The whole point of the Work view: a surface renders THIS, so this is where a false green would appear.
		const mobile = view.nodes[REFERENCE_UNDERTAKING.mobileOffline];
		expect(mobile?.executionState, 'the work succeeded').toBe('SUCCEEDED');
		expect(mobile?.assuranceState, 'but assurance only conditionally satisfied').toBe(
			'CONDITIONALLY_SATISFIED'
		);
		expect(mobile?.qualifiedSuccess, 'so it must NOT render green').toBe(false);

		const arch = view.nodes[REFERENCE_UNDERTAKING.architecture];
		expect(arch?.qualifiedSuccess, 'assured and baselined — green is earned here').toBe(true);
	});

	it('rebuild-from-empty is deterministic AND non-trivial (a constant fold could satisfy determinism alone)', () => {
		const engine = build();
		const events = engine.readAllEvents();
		const a = rebuildProjection(workProjector, events) as WorkView;
		const b = rebuildProjection(workProjector, events) as WorkView;
		expect(a).toEqual(b);
		// The guard the old self-comparison test lacked: prove the fold actually distinguishes things. Without
		// this, `initial: () => ({nodes:{}})` with an apply that did nothing would pass the line above.
		const states = new Set(PWU_IDS.map((id) => a.nodes[id]?.workLifecycleState));
		expect(states.size, 'the rebuilt view must distinguish PWU states').toBeGreaterThan(2);
		expect(states).toContain('BASELINED');
	});
});
