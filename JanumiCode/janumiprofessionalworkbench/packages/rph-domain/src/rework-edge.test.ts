// ⭐⭐ `JAN-EXEC` Phase 7, package L16 — design D71 (`REG-D-163` (2); `REG-F-640`; `REG-Q-034`) — CANON'S ONE WAY BACK, IN THE CONTRACTED
// TRANSITION TABLE.
//
// ⛔ WHAT WAS WRONG (`REG-F-640`). A unit its declared reviews reject had no second try: the contracted transition table had no edge from a
// rejected declared assurance back to work, and `REG-Q-034` forbade inventing one. The sponsor ratified one (`REG-D-163` (2)): one move, out
// of a rejected declared assurance back to planning, recorded on each of the three axes canon tracks, each row citing the ruling — its guard
// the kernel's (`changePwuState`, `rejectUnauthorizedRework`; held in `criteria-and-rework.route.test.ts`). No other edge is added.
import { describe, expect, it } from 'vitest';
import { getMachine } from './index.js';

/** The three rows, machine, from and to (the lead's, design D71). */
const ROWS = [
	['PWU.workLifecycleState', 'UNDER_ASSURANCE', 'PLANNED'],
	['PWU.executionState', 'SUCCEEDED', 'PLANNED'],
	['PWU.assuranceState', 'REJECTED', 'UNASSESSED']
] as const;
const TRIGGER = 'Rework after a rejected declared assurance';
/** The guard each row states, the kernel's, BYTE FOR BYTE — restated here, never read from the table it holds. */
const GUARD =
	"ENFORCED BY THE KERNEL (fail closed): the unit's assurance REJECTED, concluded by its declared policies' verdicts at its sign-off, and a person's Decision (REPLAN) naming them (REG-D-163 (2); changePwuState, rejectUnauthorizedRework)";

const rowOf = (machine: string, from: string, to: string) =>
	getMachine(machine).transitions.find((t) => t.from === from && t.to === to);
const outOf = (machine: string, from: string): string[] =>
	getMachine(machine)
		.transitions.filter((t) => t.from === from)
		.map((t) => t.to)
		.sort();

describe('⭐⭐ L16 (D71) — canon’s one way back, out of a rejected declared assurance back to planning, on its three axes', () => {
	it('⛔ REG-F-640’s predicted red — the table holds the three rows, each with its trigger, each citing the ruling in its guard and its note', () => {
		expect(
			ROWS.map(([machine, from, to]) => {
				const row = rowOf(machine, from, to);
				return [machine, from, to, row?.trigger, row?.guard?.includes('REG-D-163 (2)'), row?.note?.includes('REG-D-163 (2)')];
			})
		).toEqual(ROWS.map(([machine, from, to]) => [machine, from, to, TRIGGER, true, true]));
	});

	it('⛔ its guard is the kernel’s, and each row says so: fail closed, on the REJECTED declared verdicts and a person’s REPLAN Decision', () => {
		expect(ROWS.map(([machine, from, to]) => rowOf(machine, from, to)?.guard)).toEqual([GUARD, GUARD, GUARD]);
	});

	it('⭑ CONTROL — no other edge is added: nothing else leaves REJECTED or SUCCEEDED, REJECTED and RESHAPING and CHALLENGED keep no re-entry, and PLANNED gains one in-arrow alone', () => {
		expect(outOf('PWU.assuranceState', 'REJECTED').filter((to) => to !== 'UNASSESSED')).toEqual([]);
		expect(outOf('PWU.executionState', 'SUCCEEDED').filter((to) => to !== 'PLANNED')).toEqual([]);
		expect(outOf('PWU.workLifecycleState', 'REJECTED')).toEqual(['ABANDONED', 'SUPERSEDED']);
		expect(outOf('PWU.workLifecycleState', 'RESHAPING')).toEqual(['ABANDONED', 'SUPERSEDED']);
		expect(outOf('PWU.workLifecycleState', 'CHALLENGED')).toEqual(['ABANDONED', 'SUPERSEDED']);
		expect(
			getMachine('PWU.workLifecycleState')
				.transitions.filter((t) => t.to === 'PLANNED' && t.from !== 'UNDER_ASSURANCE')
				.map((t) => t.from)
				.sort()
		).toEqual(['BLOCKED', 'READY']);
	});
});
