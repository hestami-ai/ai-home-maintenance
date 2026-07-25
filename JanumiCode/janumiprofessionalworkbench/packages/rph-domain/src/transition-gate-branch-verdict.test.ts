// JAN-EXECREM WP-10, READ half — CANONICAL RULE B3: never invent a decision; fail closed in BOTH directions.
//
// The gate used to answer "which arm did this BRANCH take?" with a FRESH first-match evaluation whenever nothing
// was recorded. That conflated two different facts — "decided otherwise" and "never decided" — and made the second
// produce a *plausible* answer that CHANGES OVER TIME: a step reachable only through a not-taken edge can still
// change state, and an ATTEMPTS or STEP_STATE guard over it flips. So a BRANCH settled without recording silently
// re-resolved, and BOTH arms ran (F-15/21/23).
//
// The fourth disposition, UNRESOLVED, is where that missing fact now lives. The two planes answer it
// ASYMMETRICALLY, and the asymmetry IS the fail-closed direction:
//   START plane  — not startable (the barrier needs a SATISFIED in-edge). The plan stops with a named reason.
//   PRUNE plane  — not prunable either. A waiver-free prune may never be justified by a decision nobody took
//                  (§21.1); a symmetric "exclude everything" would hand the whole downstream to a blanket prune,
//                  which is the F-03/F-04 damage shape.
import { describe, expect, it } from 'vitest';
import {
	inEdgeDisposition,
	prunableStepIds,
	resolveBranchSelection,
	startStepGate,
	startableStepIds,
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
const cond = (id: string, from: string, to: string, result: boolean): GateTransition => ({
	id,
	sourceStepId: from,
	targetStepId: to,
	transitionType: 'CONDITIONAL',
	conditionExpression: { result }
});
const seq = (id: string, from: string, to: string): GateTransition => ({
	id,
	sourceStepId: from,
	targetStepId: to,
	transitionType: 'SEQUENTIAL'
});
const guard: EdgeGuardEvaluator = (e) =>
	(e.conditionExpression as { result?: boolean } | undefined)?.result === true;

/** s1 BRANCH (SUCCEEDED) → s2 (CONDITIONAL, true) | s3 (SEQUENTIAL default); `selected` settles it or not. */
function branchPlan(selected?: string, branchState = 'SUCCEEDED'): GatePlan {
	return {
		status: 'ACTIVE',
		steps: [
			step('s1', branchState, { stepType: 'BRANCH', ...(selected ? { selectedTransitionId: selected } : {}) }),
			step('s2', 'QUEUED'),
			step('s3', 'QUEUED')
		],
		transitions: [cond('t_cond', 's1', 's2', true), seq('t_default', 's1', 's3')]
	};
}

describe('WP-10 / KT-11 — a settled BRANCH with NO recorded decision decides NOTHING', () => {
	const undecided = branchPlan();

	it('BOTH arms read UNRESOLVED — not SATISFIED, and not NEUTRALIZED either', () => {
		// Before WP-10 these read SATISFIED / NEUTRALIZED, from an answer the gate invented on the spot.
		expect(inEdgeDisposition(undecided, undecided.transitions![0]!, guard)).toBe('UNRESOLVED');
		expect(inEdgeDisposition(undecided, undecided.transitions![1]!, guard)).toBe('UNRESOLVED');
	});

	it('neither arm is STARTABLE (the plan stops rather than guessing)', () => {
		expect(startableStepIds(undecided, guard)).toEqual([]);
	});

	it('neither arm is PRUNABLE — §21.1 forbids a waiver-free prune of an undecided arm', () => {
		// The asymmetry. If UNRESOLVED had been treated as NEUTRALIZED, BOTH arms and their whole downstream would
		// have become waiver-free prunable — a blanket bypass of the mandatory-skip rule.
		expect(prunableStepIds(undecided, guard)).toEqual([]);
	});

	it('the start gate NAMES the branch and its remedy, and does NOT say "it should be pruned"', () => {
		const r = startStepGate(undecided, 's2', guard);
		expect(r.ok).toBe(false);
		expect(r.blockerStepId).toBe('s1');
		expect(r.reason).toContain('without recording which arm it selected');
		expect(r.reason).toContain('§21.1');
		// The generic all-neutralized message would actively mislead here: pruning is exactly what must NOT happen.
		expect(r.reason).not.toContain('should be pruned');
	});

	it('a RECORDED id that matches no out-edge is ALSO unresolved (an incoherent plan invents nothing either)', () => {
		const ghost = branchPlan('t_does_not_exist');
		expect(inEdgeDisposition(ghost, ghost.transitions![0]!, guard)).toBe('UNRESOLVED');
		expect(startableStepIds(ghost, guard)).toEqual([]);
		expect(prunableStepIds(ghost, guard)).toEqual([]);
	});
});

describe('WP-10 — a DECIDED BRANCH answers exactly as before', () => {
	it('the recorded arm is SATISFIED and every other arm NEUTRALIZED', () => {
		const decided = branchPlan('t_cond');
		expect(inEdgeDisposition(decided, decided.transitions![0]!, guard)).toBe('SATISFIED');
		expect(inEdgeDisposition(decided, decided.transitions![1]!, guard)).toBe('NEUTRALIZED');
		expect(startableStepIds(decided, guard)).toEqual(['s2']);
		expect(prunableStepIds(decided, guard)).toEqual(['s3']);
	});

	it('the RECORDED arm wins even when the guard now says otherwise — the decision is history', () => {
		// The whole point of recording. The guard on t_cond is TRUE, but the plan recorded the DEFAULT; a gate that
		// re-derived would contradict the plan's own act.
		const decided = branchPlan('t_default');
		expect(startableStepIds(decided, guard)).toEqual(['s3']);
		expect(prunableStepIds(decided, guard)).toEqual(['s2']);
	});

	it('the arm is matched BY ID, so a CLONED edge reads identically (the identity trap, CLOSED)', () => {
		// `inEdgeDisposition` is a PUBLIC entry point taking an edge, so the edge a caller hands it need not be the
		// object stored in `plan.transitions` — any `map`/`filter`/spread in a read-model produces a copy. While the
		// comparison was object identity, every such caller silently got NEUTRALIZED: no type error, no failure
		// outside a branch fixture. `execution-view.test.ts` carried a test NAMED for this trap that could not
		// actually detect it, because cloning the whole plan preserves identity WITHIN the call.
		const decided = branchPlan('t_cond');
		expect(inEdgeDisposition(decided, { ...decided.transitions![0]! }, guard)).toBe('SATISFIED');
		expect(inEdgeDisposition(decided, { ...decided.transitions![1]! }, guard)).toBe('NEUTRALIZED');
	});

	it('the answer does not depend on the evaluator at all — a BRANCH no longer consults the grammar', () => {
		// Read-model/authority divergence closed by construction: the two planes cannot disagree about an arm if
		// neither of them computes it. Passing NO evaluator used to change which arm the UI offered.
		const decided = branchPlan('t_cond');
		expect(startableStepIds(decided)).toEqual(startableStepIds(decided, guard));
		expect(prunableStepIds(decided)).toEqual(prunableStepIds(decided, guard));
	});

	it('a NON-terminal BRANCH is PENDING, not unresolved — it has not settled, so nothing is missing yet', () => {
		// The ladder tests source liveness and terminality BEFORE any branch rung, so an in-flight branch is not
		// slandered as undecided.
		const running = branchPlan(undefined, 'RUNNING');
		expect(inEdgeDisposition(running, running.transitions![0]!, guard)).toBe('PENDING');
		// Neither ARM may start; s1 itself stays at the frontier because it is the entry step and non-terminal
		// (the engine's re-entry guard, not the gate, is what stops it being started twice).
		expect(startableStepIds(running, guard)).toEqual(['s1']);
		expect(prunableStepIds(running, guard)).toEqual([]);
	});
});

describe('WP-10 — resolveBranchSelection is the ACT of deciding, and the only site that evaluates', () => {
	it('first-match: the first TRUE conditional, else the SEQUENTIAL default', () => {
		expect(resolveBranchSelection(branchPlan(), 's1', guard)).toBe('t_cond');
		const falseGuard: EdgeGuardEvaluator = () => false;
		expect(resolveBranchSelection(branchPlan(), 's1', falseGuard)).toBe('t_default');
	});

	it('it IGNORES an already-recorded decision — deciding and reading are different acts', () => {
		// `advanceStep` is what refuses to re-decide; this function must not silently do it, or the "never
		// re-decide" guard would be untestable from either side.
		expect(resolveBranchSelection(branchPlan('t_default'), 's1', guard)).toBe('t_cond');
	});

	it('a non-BRANCH, and a BRANCH with no guarded arm, decide nothing', () => {
		const notABranch: GatePlan = {
			status: 'ACTIVE',
			steps: [step('s1', 'SUCCEEDED'), step('s2', 'QUEUED')],
			transitions: [cond('t1', 's1', 's2', true)]
		};
		expect(resolveBranchSelection(notABranch, 's1', guard)).toBeUndefined();
		const unguarded: GatePlan = {
			status: 'ACTIVE',
			steps: [step('s1', 'SUCCEEDED', { stepType: 'BRANCH' }), step('s2', 'QUEUED')],
			transitions: [seq('t1', 's1', 's2')]
		};
		expect(resolveBranchSelection(unguarded, 's1', guard)).toBeUndefined();
	});
});
