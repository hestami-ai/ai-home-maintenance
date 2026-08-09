// PWU.shapeIntegrityState is a HOLLOW AXIS: seven ratified states, nine ratified arrows, and it decides nothing.
//
// ⚠ MEASURED BEHAVIOURALLY, NOT READ. Grepping for `shapeIntegrityState` in the guards proves only what a reader
// noticed. This drives `canAdvanceWorkLifecycle` over EVERY arrow of `PWU.workLifecycleState` and, for each,
// varies ONE axis across EVERY value of its machine while holding the others fixed. An axis "influences" an arrow
// when some value flips the verdict. That answers "does this axis gate anything?" from behaviour rather than from
// text, so a guard that read the axis by any idiom — a helper, a lookup, a computed key — would still be caught.
//
// THE RESULT: `executionState` gates 1 arrow, `assuranceState` gates 2, `shapeIntegrityState` gates NOTHING.
//
// WHY IT MATTERS BEYOND TIDINESS, and why this is a pinned DEFECT rather than a curiosity:
//   1. The axis's ONLY writers are `proposePwu` (birth UNKNOWN) and `changePwuState` twice, both taking the value
//      straight from the command payload. So it is pure caller ASSERTION — no derivation, no guard, no check —
//      which is precisely what roadmap R1 forbids: "a command may never let the caller name WHAT STATE results".
//   2. It is nonetheless carried into the replay fold and the graph projection, so an asserted value travels
//      outward looking like a measured one.
//   3. W-7 retires `ChangePwuState`. Because the setter is this axis's only mover, retiring it FREEZES the axis
//      at UNKNOWN forever — and no test would fail, because no decision consults it. That is the hollow this
//      programme keeps finding, and here it is load-bearing for a scheduled increment.
import { STATE_MACHINES, canAdvanceWorkLifecycle, type PwuAxes } from '@janumipwb/rph-domain';
import { describe, expect, it } from 'vitest';

type Machine = { states: readonly string[]; transitions: readonly { from: string; to: string }[] };
const M = STATE_MACHINES as unknown as Record<string, Machine>;

const VARIABLE_AXES = ['executionState', 'assuranceState', 'shapeIntegrityState'] as const;

const BASE: PwuAxes = {
	workLifecycleState: 'PROPOSED',
	executionState: 'NOT_PLANNED',
	assuranceState: 'UNASSESSED',
	shapeIntegrityState: 'UNKNOWN'
};

/** For each axis, the `from->to` arrows whose verdict some value of that axis changes. */
function influence(): Record<string, string[]> {
	const out: Record<string, string[]> = { executionState: [], assuranceState: [], shapeIntegrityState: [] };
	for (const t of M['PWU.workLifecycleState']!.transitions) {
		for (const axis of VARIABLE_AXES) {
			const verdicts = new Set(
				M[`PWU.${axis}`]!.states.map((v) => canAdvanceWorkLifecycle(t.from, t.to, { ...BASE, [axis]: v }).ok)
			);
			if (verdicts.size > 1) out[axis]!.push(`${t.from}->${t.to}`);
		}
	}
	return out;
}

describe('which PWU axes actually gate a lifecycle transition', () => {
	it('PINNED DEFECT — shapeIntegrityState decides nothing, across every arrow and every value', () => {
		expect(
			influence().shapeIntegrityState,
			'if this is no longer empty the axis has ACQUIRED TEETH — a real improvement, and one that must be ' +
				'recorded rather than absorbed: update the W-4 entry and the hollow-axis finding'
		).toEqual([]);
	});

	it('PINNED — exactly which arrows the other two axes gate', () => {
		const inf = influence();
		expect(inf.executionState).toEqual(['EXECUTING->EVIDENCE_PENDING']);
		expect(inf.assuranceState).toEqual([
			'UNDER_ASSURANCE->CONDITIONALLY_SATISFIED',
			'UNDER_ASSURANCE->SATISFIED'
		]);
	});

	// ── CONTROL: THE PROBE IS REAL ───────────────────────────────────────────────────────────────────────────
	// ⚠ THIS CONTROL EXISTS BECAUSE THE FAILURE IT CATCHES HAPPENED TODAY. A probe of the arrow census returned
	// "0 arrows" for EVERY machine — healthy ones included — because it filtered objects with a string method.
	// Run only against the machine under suspicion, all-zeros CONFIRMS the hypothesis and the false finding gets
	// filed. A control group is the only thing that distinguishes "this axis gates nothing" from "my probe is
	// broken". So: the same harness must show POSITIVE influence for the two axes known to gate, and the arrow
	// set it walks must be the real one.
	it('CONTROL — the same harness detects influence where influence exists', () => {
		const inf = influence();
		expect(M['PWU.workLifecycleState']!.transitions.length, 'the arrow set must be real').toBe(57);
		expect(M['PWU.shapeIntegrityState']!.states.length, 'the varied value set must be real').toBe(7);
		expect(
			inf.executionState.length + inf.assuranceState.length,
			'if NO axis registers influence, the probe is broken and the pinned zero above means nothing'
		).toBeGreaterThan(0);
	});
});
