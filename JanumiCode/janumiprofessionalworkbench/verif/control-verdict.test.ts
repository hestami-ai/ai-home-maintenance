// THE FIRST TEST ON THE GATE'S VERDICT LAYER — REG-F-165.
//
// ⚠ THERE WAS NONE, AND THAT IS THE FINDING RATHER THAN THE PREAMBLE. `scripts/mutants/run.ts` has ZERO exports
// and executes on import, so `controlVerdict`, `compileVerdict` and `pkgOf` were unreachable by any suite. The
// mutation ledger cannot mutate what nothing observes, so the layer deciding what every OTHER verdict means was
// the one layer with no test on it — and it stayed that way because a script's decision logic is invisible to
// testing by default, not because anyone decided it was safe.
//
// What that cost, concretely: `gradeControl`'s empty-report arm. A control run that EXITED NON-ZERO and wrote a
// report naming NO failing test file was graded CONTROL_HELD — a non-measurement scored as a pass — sitting one
// line below the arm written to refuse exactly that. `failedFiles` distinguishes a MISSING report (`undefined`)
// from NO FAILURES (`[]`) and its comment records that conflating them would be *"a fail-OPEN hole in the fix for
// a fail-open hole"*. The present-but-empty report is the THIRD case, and it took the hold path.
//
// ⚠ FIXTURES, NOT THE REAL LEDGER, AND FOR REG-F-122's REASON. The failing arms cannot occur while the harness is
// healthy, so a test over real runs could never enter the branches it exists to prove. The inputs here are exactly
// what the runner observed at the call site — which is why `gradeControl` had to be made pure to be testable.
import { describe, expect, it } from 'vitest';
import { gradeControl } from '../scripts/mutants/verdict.js';

const WHY = 'SURVIVAL IS THE FINDING — this branch is dead and its deadness is the record.';

describe('REG-F-165 — a control is graded on a DIFFERENCE, and a non-measurement is never a hold', () => {
	it('a passing run HOLDS, and carries the entry own rationale', () => {
		const g = gradeControl(true, undefined, undefined, WHY);
		expect(g.verdict).toBe('CONTROL_HELD');
		expect(g.detail).toContain('SURVIVAL IS THE FINDING');
	});

	it('a failed run with NO REPORT is INCONCLUSIVE — there is no difference to take', () => {
		const g = gradeControl(false, undefined, [], WHY);
		expect(g.verdict).toBe('INCONCLUSIVE');
		expect(g.detail).toContain('wrote no report');
	});

	// ⚠ THE ARM THIS FILE EXISTS FOR. Non-zero exit, report present, nothing named. Something failed and no test
	// file owns it — a setup throw, an unhandled rejection, a worker crash, a config error. The failure is REAL and
	// UNATTRIBUTED, so the one conclusion unavailable is that the control held.
	it('a failed run whose report names NOTHING is INCONCLUSIVE, not held', () => {
		const g = gradeControl(false, [], [], WHY);
		expect(
			g.verdict,
			'an unattributed failure graded as a hold is a non-measurement scored as a pass'
		).toBe('INCONCLUSIVE');
		expect(g.detail).toContain('names NO failing test file');
	});

	it('a failed run whose reds were ALREADY red HOLDS on the difference, and discloses the baseline', () => {
		const g = gradeControl(false, ['a.test.ts'], ['a.test.ts'], WHY);
		expect(g.verdict).toBe('CONTROL_HELD');
		expect(g.detail, 'the weaker claim must not read as the stronger one').toContain('1 suite(s) already red');
	});

	it('a GENUINELY new red is SURVIVED, and NAMES what reddened', () => {
		const g = gradeControl(false, ['a.test.ts', 'b.test.ts'], ['a.test.ts'], WHY);
		expect(g.verdict).toBe('SURVIVED');
		expect(g.detail).toContain('b.test.ts');
		expect(g.detail).toContain('NEWLY reddened 1 suite(s)');
	});

	// ⚠ THE DETAIL MAY NOT STATE A CAUSE IT DID NOT MEASURE — `measured.ts`'s whole reason for existing, which had
	// survived in the detail string of the arm that reports it. Only ONE of the nine controls edits prose; the rest
	// mutate live code or checked data, so "the prose-only edit … something asserts on prose" was a cause asserted
	// about eight mutants that do not touch prose at all.
	it('CONTROL — the SURVIVED detail names the evidence and does NOT assert a cause', () => {
		const g = gradeControl(false, ['x.test.ts'], [], WHY);
		expect(g.detail, 'a cause the runner never measured').not.toContain('prose');
		expect(g.detail, 'the evidence it DID observe').toContain('x.test.ts');
	});

	// CONTROL — the assertions above are all satisfied by a function that returns INCONCLUSIVE for everything,
	// which would block the gate permanently while looking rigorous. This holds the discriminating half: the
	// three NON-inconclusive arms must remain reachable, so a future tightening cannot quietly swallow them.
	it('CONTROL — HELD and SURVIVED are both still reachable, so the tightening did not swallow them', () => {
		const verdicts = new Set([
			gradeControl(true, undefined, undefined, WHY).verdict,
			gradeControl(false, ['a.test.ts'], ['a.test.ts'], WHY).verdict,
			gradeControl(false, ['b.test.ts'], [], WHY).verdict
		]);
		expect([...verdicts].sort((x, y) => x.localeCompare(y))).toEqual(['CONTROL_HELD', 'SURVIVED']);
	});
});
