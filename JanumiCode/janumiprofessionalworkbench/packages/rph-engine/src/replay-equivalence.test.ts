// RPH-PER-006 — Aggregate replay equivalence, proved against the live engine.
//
//   "Given an event stream for an Intent or PWU. When the aggregate is reconstructed. Then its state matches the
//    materialized current state."
//
// Ratified, and untested until now. This is the durability promise underneath every claim the workbench makes
// about its governed stream: if the aggregate cannot be rebuilt from its own events, the log is a diary kept
// beside the truth rather than the truth itself, and "we can reason over what the system did" is false.
//
// The subject is the REFERENCE UNDERTAKING driven live — thirteen PWUs through shaping, execution, assurance,
// governance and baselining. Not a hand-authored two-event fixture: the property is only interesting over a
// stream complex enough to get wrong.
import { replayPwuAxes } from '@janumipwb/rph-projections';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { describe, expect, it } from 'vitest';
import { createEngine, driveReferenceUndertaking, REFERENCE_UNDERTAKING } from './index.js';

describe('RPH-PER-006 — aggregate replay equivalence', () => {
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

	it("every PWU's four axes rebuild from its own event stream and match the materialized state", () => {
		const engine = build();
		const all = engine.readAllEvents();
		expect(PWU_IDS).toHaveLength(13);

		const mismatches: string[] = [];
		let compared = 0;
		for (const id of PWU_IDS) {
			const materialized = engine.loadObject(id)?.state as Record<string, unknown> | undefined;
			expect(materialized, `PWU ${id} is not materialized`).toBeDefined();

			// The aggregate's OWN stream, in revision order — the same slice readAggregateEvents would return.
			const stream = all.filter((e) => e.aggregateId === id);
			expect(stream.length, `PWU ${id} has no events`).toBeGreaterThan(0);

			const replayed = replayPwuAxes(stream);
			expect(replayed, `PWU ${id} did not rebuild at all`).toBeDefined();

			for (const axis of [
				'workLifecycleState',
				'executionState',
				'assuranceState',
				'shapeIntegrityState'
			] as const) {
				compared += 1;
				if (replayed![axis] !== materialized![axis]) {
					mismatches.push(
						`${id}.${axis}: replayed=${replayed![axis]} materialized=${String(materialized![axis])}`
					);
				}
			}
		}
		expect(compared).toBe(52); // 13 PWUs x 4 axes
		expect(mismatches, mismatches.join(' | ')).toEqual([]);
	});

	it('the rebuild is a pure fold: replaying twice yields the same state (RPH-PER-002 in the aggregate dimension)', () => {
		const engine = build();
		const stream = engine
			.readAllEvents()
			.filter((e) => e.aggregateId === REFERENCE_UNDERTAKING.architecture);
		expect(replayPwuAxes(stream)).toEqual(replayPwuAxes(stream));
		// And the doubled stream folds to the same place — events are facts, not increments, so re-applying one
		// cannot move the aggregate further.
		expect(replayPwuAxes([...stream, ...stream])).toEqual(replayPwuAxes(stream));
	});

	it('an aggregate with no creation event rebuilds to nothing rather than to a default', () => {
		// A reducer that invented a starting state here would report a PWU that was never proposed as PROPOSED —
		// fabricating an object out of an empty stream. Absence must rebuild as absence.
		expect(replayPwuAxes([])).toBeUndefined();
	});

	it('PROOF THE PROPERTY IS LOAD-BEARING: the terminal states differ across PWUs, so equality is not trivial', () => {
		// If every PWU ended in the same state, the test above could pass with a reducer that returned a constant.
		const engine = build();
		const all = engine.readAllEvents();
		const terminal = new Set(
			PWU_IDS.map(
				(id) => replayPwuAxes(all.filter((e) => e.aggregateId === id))?.workLifecycleState
			)
		);
		expect(
			terminal.size,
			'the reference undertaking must exercise distinct terminal states'
		).toBeGreaterThan(2);
		expect(terminal).toContain('BASELINED');
		expect(terminal).toContain('CONDITIONALLY_SATISFIED');
	});
});
