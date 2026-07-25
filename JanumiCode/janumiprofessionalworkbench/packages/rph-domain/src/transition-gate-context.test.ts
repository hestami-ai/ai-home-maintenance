// JAN-EXECREM WP-2 — the GateContext seam (SM-1), proved by CALL COUNT rather than by a clock.
//
// F-34: `inEdgeDisposition` re-ran `liveStepIds` — a full BFS — for EVERY in-edge, and `liveStepIds` itself used
// the O(E) `inEdgesOf`/`outEdgesOf` array filters once per node. So `startableStepIds` over a fan-out of width N
// cost N steps x N in-edges x BFS(V·E), and it re-invoked the CALLER'S guard evaluator once per edge per pass.
//
// The kill test below counts guard-evaluator invocations. That is deliberate and is the whole point of the WP:
//   - A WALL-CLOCK assertion would be flaky on a shared runner and would pass for the wrong reason on a fast one.
//   - An invocation count is DETERMINISTIC, and it is also the property that actually matters to a caller: the
//     evaluator is theirs, it can be expensive, and a pure gate has no business calling it a hundred times for one
//     question. Before the seam this was ~101x at width 100; the ceiling asserted here is one call per guarded
//     edge per public entry point.
// Everything else here pins that the refactor was SEMANTICALLY inert — same answers, same ordering, same
// first-wins resolution of a duplicate step id.
import { describe, expect, it } from 'vitest';
import {
	inEdgeDisposition,
	prunableStepIds,
	resolveBranchSelection,
	startableStepIds,
	startStepGate,
	type EdgeGuardEvaluator,
	type GatePlan,
	type GateStep,
	type GateTransition
} from './transition-gate.js';

const step = (id: string, stepState: string, extra: Partial<GateStep> = {}): GateStep => ({
	id,
	stepState,
	...extra
});
const edge = (
	sourceStepId: string | undefined,
	targetStepId: string,
	extra: Partial<GateTransition> = {}
): GateTransition => ({ ...(sourceStepId ? { sourceStepId } : {}), targetStepId, ...extra });

/**
 * A fan-out of `width` guarded arms off one settled source — the shape whose cost F-34 measured.
 *
 * `stepType` is a parameter because JAN-EXECREM WP-10 moved where a guard is evaluated at READ time:
 *   - BRANCH: the arm is now READ from the recorded decision, so the grammar is not evaluated at all. Pass
 *     `selected` to settle it, exactly as a settling command would.
 *   - non-BRANCH: out-edges are INDEPENDENT filters, so each guarded edge is still evaluated on its own (the
 *     disposition ladder's last rung). This is the only read-time evaluator site that survives WP-10, and it is
 *     therefore where the F-34 cost ceiling still has something to measure. Propose-time validation forbids
 *     AUTHORING this shape, but the gate must still answer for a plan stored before that rule existed.
 */
function fanOutPlan(
	width: number,
	opts: { readonly stepType?: string; readonly selected?: string } = {}
): GatePlan {
	const { stepType = 'BRANCH', selected } = opts;
	const source: GateStep = {
		id: 's0',
		stepState: 'SUCCEEDED',
		...(stepType ? { stepType } : {}),
		...(selected ? { selectedTransitionId: selected } : {})
	};
	const steps: GateStep[] = [source];
	const transitions: GateTransition[] = [];
	for (let i = 1; i <= width; i += 1) {
		steps.push(step(`s${i}`, 'QUEUED'));
		transitions.push(
			edge('s0', `s${i}`, {
				id: `t${i}`,
				transitionType: 'CONDITIONAL',
				conditionExpression: { op: 'ALWAYS_FALSE', arm: i }
			})
		);
	}
	// The SEQUENTIAL default last, as propose-time validation requires of a BRANCH.
	steps.push(step('sd', 'QUEUED'));
	transitions.push(edge('s0', 'sd', { id: 'td' }));
	return { status: 'ACTIVE', steps, transitions };
}

/** The surviving read-time evaluator site (see above): guarded edges off a settled NON-BRANCH source.
 *  A REAL stepType, not `undefined` — passing `undefined` re-triggers the `= 'BRANCH'` default and would have made
 *  this fixture a branch again, which is precisely what the non-vacuity assertion below caught. */
const guardedFanOut = (width: number) => fanOutPlan(width, { stepType: 'TRANSFORMATION' });

/** A guard evaluator that records every invocation. */
function countingGuard(result = false): { evaluate: EdgeGuardEvaluator; calls: GateTransition[] } {
	const calls: GateTransition[] = [];
	return {
		calls,
		evaluate: (e) => {
			calls.push(e);
			return result;
		}
	};
}

describe('JAN-EXECREM WP-2 — the guard evaluator is called at most once per guarded edge (F-34)', () => {
	const WIDTH = 25;

	it.each([
		['startableStepIds', (p: GatePlan, g: EdgeGuardEvaluator) => startableStepIds(p, g)],
		['prunableStepIds', (p: GatePlan, g: EdgeGuardEvaluator) => prunableStepIds(p, g)],
		['startStepGate', (p: GatePlan, g: EdgeGuardEvaluator) => startStepGate(p, 's1', g)]
	])('%s evaluates each guarded edge at most once', (_name, call) => {
		const plan = guardedFanOut(WIDTH);
		const guard = countingGuard(false);
		call(plan, guard.evaluate);

		const guardedEdgeCount = (plan.transitions ?? []).filter(
			(t) => t.conditionExpression !== undefined || t.transitionType === 'CONDITIONAL'
		).length;
		expect(guardedEdgeCount).toBe(WIDTH);
		// The ceiling is the whole assertion: before the GateContext this was O(width^2) for startableStepIds.
		expect(
			guard.calls.length,
			`expected <= ${guardedEdgeCount} guard evaluations, got ${guard.calls.length}`
		).toBeLessThanOrEqual(guardedEdgeCount);
	});

	it('scales LINEARLY in the fan-out width, not quadratically (the shape of the defect, not a timing)', () => {
		const narrow = countingGuard(false);
		const wide = countingGuard(false);
		startableStepIds(guardedFanOut(10), narrow.evaluate);
		startableStepIds(guardedFanOut(40), wide.evaluate);
		// 4x the arms must cost ~4x the evaluations, never ~16x. A generous bound still kills the quadratic form.
		expect(wide.calls.length).toBeLessThanOrEqual(narrow.calls.length * 6);
		// NON-VACUITY: the ceiling above is only meaningful if the evaluator is actually being called. Without this,
		// a future change that stopped evaluating here entirely would leave both counts at 0 and the bound green.
		expect(narrow.calls.length).toBeGreaterThan(0);
	});

	// STRONGER THAN A CEILING, and new with WP-10: a well-formed settled BRANCH costs ZERO guard evaluations at read
	// time, because its arm is a RECORDED FACT rather than a computation. F-34 bounded the cost of re-deriving; the
	// re-derivation is gone, so there is nothing left to bound on this shape. Asserting the zero is what stops the
	// ceiling test above from silently becoming a test of nothing if it is ever pointed back at a BRANCH fixture.
	it.each([
		['startableStepIds', (p: GatePlan, g: EdgeGuardEvaluator) => startableStepIds(p, g)],
		['prunableStepIds', (p: GatePlan, g: EdgeGuardEvaluator) => prunableStepIds(p, g)],
		['startStepGate', (p: GatePlan, g: EdgeGuardEvaluator) => startStepGate(p, 's1', g)]
	])('%s evaluates NO guard on a SETTLED BRANCH — the decision is read, not recomputed', (_name, call) => {
		const plan = fanOutPlan(WIDTH, { selected: 'td' });
		const guard = countingGuard(false);
		call(plan, guard.evaluate);
		expect(guard.calls).toHaveLength(0);
	});

	it('and the settled BRANCH still ANSWERS — the recorded default arm is the live one', () => {
		// Non-vacuity for the three cases above: zero calls would also be true of a gate that answered nothing.
		const plan = fanOutPlan(WIDTH, { selected: 'td' });
		expect(startableStepIds(plan, countingGuard(false).evaluate)).toEqual(['sd']);
	});
});

describe('JAN-EXECREM WP-2 — the seam is semantically inert', () => {
	const guardTrueFor = (id: string): EdgeGuardEvaluator => (e) => e.id === id;

	it('inEdgeDisposition agrees edge-by-edge with the barrier the gate actually uses', () => {
		const plan = fanOutPlan(4, { selected: 't2' }); // arm 2 was recorded; every other arm is neutralized
		const guard = guardTrueFor('t2');
		let satisfied = 0;
		let neutralized = 0;
		for (const t of plan.transitions ?? []) {
			const d = inEdgeDisposition(plan, t, guard);
			const target = t.targetStepId!;
			const startable = startableStepIds(plan, guard).includes(target);
			// A step whose ONLY in-edge is SATISFIED must be startable; one whose only in-edge is NEUTRALIZED must not.
			if (d === 'SATISFIED') {
				satisfied += 1;
				expect(startable, `${target} via ${t.id}`).toBe(true);
			}
			if (d === 'NEUTRALIZED') {
				neutralized += 1;
				expect(startable, `${target} via ${t.id}`).toBe(false);
			}
		}
		// NON-VACUITY. Both implications are conditional, so a plan whose every edge came back PENDING (or, since
		// WP-10, UNRESOLVED) would satisfy this test having checked nothing. Counting is what makes it an assertion.
		expect(satisfied, 'the selected arm must be SATISFIED').toBe(1);
		expect(neutralized, 'every other arm must be NEUTRALIZED').toBe(4);
	});

	// RE-POINTED by WP-10, not weakened. First-match is still the rule; it moved to the WRITE path, where it runs
	// ONCE at settlement instead of being re-derived on every read. Asserting it through `resolveBranchSelection` is
	// asserting it at the only place it now lives — and the second half proves the recorded answer is what the gate
	// then reads back, which is the property the old single assertion was standing in for.
	it('BRANCH first-match still follows AUTHORED edge order (the index preserves it)', () => {
		const undecided = fanOutPlan(3);
		// Two guards true at once: first-match must take the EARLIER authored arm, never the later.
		const guard: EdgeGuardEvaluator = (e) => e.id === 't2' || e.id === 't3';
		expect(resolveBranchSelection(undecided, 's0', guard)).toBe('t2');
		expect(startableStepIds(fanOutPlan(3, { selected: 't2' }), guard)).toEqual(['s2']);
	});

	it('a duplicate step id still resolves FIRST-wins, as plan.steps.find did (F-10 is not yet fixed)', () => {
		// Two steps share an id; the gate must see the FIRST, so the edge into it is PENDING (QUEUED), not SATISFIED.
		const plan: GatePlan = {
			status: 'ACTIVE',
			steps: [step('dup', 'QUEUED'), step('dup', 'SUCCEEDED'), step('t', 'QUEUED')],
			transitions: [edge('dup', 't', { id: 'e1' })]
		};
		expect(inEdgeDisposition(plan, plan.transitions![0]!, undefined)).toBe('PENDING');
		expect(startableStepIds(plan, undefined)).not.toContain('t');
	});

	it('an entry edge (no sourceStepId) is still SATISFIED, and half-edges still take no part in selection', () => {
		const plan: GatePlan = {
			status: 'ACTIVE',
			steps: [step('a', 'QUEUED')],
			transitions: [edge(undefined, 'a', { id: 'entry' })]
		};
		expect(inEdgeDisposition(plan, plan.transitions![0]!, undefined)).toBe('SATISFIED');
	});
});
