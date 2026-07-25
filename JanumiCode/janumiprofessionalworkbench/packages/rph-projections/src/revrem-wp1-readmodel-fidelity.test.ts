// JAN-REVREM RW-1 — the two read-model fidelity defects the post-build adversarial review confirmed.
//
// Both are the SAME invariant WP-15 exists to enforce ("no affordance the engine would reject"), broken in the
// two places WP-15 did not look — and both were invisible to the whole suite.
//
// #4 PRUNE ESCAPED THE FILTER ENTIRELY. `prunableStepIds` was a bare passthrough to a gate that knows only
// `plan.status`, while `PruneExecutionStep` declares `pwuOpenness: REQUIRES_OPEN_PWU` and WP-12b made the engine
// refuse it on a closed PWU. The read-model offered a Prune the engine rejects. The reason nobody noticed is
// itself the finding: `prune` was absent from `COMMAND_BY_AFFORDANCE`, so the `Record<…>` totality that catches
// exactly this omission could not see it — the same invisibility WP-8 diagnosed, one layer down.
//
// #6 THE CLOSED-PWU SET WAS A HAND-COPIED SECOND SOURCE. `new Set(['BASELINED','ABANDONED','SUPERSEDED'])`, with
// a comment calling it "the machine's own terminal set" while being unbound to it. The authority DERIVES the set
// and says so; `JAN-EXECREM-RESIDUALS.md` §2 then recorded the rule as "derived rather than hardcoded" — true of
// one side, false of the other.
//
// AND THE TEST THAT COVERED IT COULD NOT FAIL. The existing WP-15 case iterates
// `for (const closed of ['BASELINED','ABANDONED','SUPERSEDED'])` — the same three literals — so it moves in
// lockstep with the bug. The test below asserts the read-model's set EQUALS the machine's, which is the only
// form that can detect drift; retyping the values would recreate exactly the blindness being fixed.
import { getMachine } from '@janumipwb/rph-domain';
import { describe, expect, it } from 'vitest';
import {
	executionPlanView,
	planAffordancesFor,
	prunableStepIds,
	type ExecutionPlanInput
} from './execution-view.js';

const PLAN = 'plan_rw1';

/** A settled BRANCH whose s2 arm was NOT taken — so s2 is genuinely prunable. */
const branchPlan = (pwuWorkLifecycleState?: string, status = 'ACTIVE'): ExecutionPlanInput => ({
	id: PLAN,
	workUnitId: 'pwu_rw1',
	status,
	...(pwuWorkLifecycleState === undefined ? {} : { pwuWorkLifecycleState }),
	steps: [
		{
			id: 's1',
			stepType: 'BRANCH',
			purpose: 'branch',
			stepState: 'SUCCEEDED',
			selectedTransitionId: 't13'
		},
		{ id: 's2', stepType: 'TRANSFORMATION', purpose: 'dead arm', stepState: 'QUEUED' },
		{ id: 's3', stepType: 'TRANSFORMATION', purpose: 'taken arm', stepState: 'QUEUED' }
	],
	transitions: [
		// The arm the branch did NOT take: CONDITIONAL, so it is excludable at all. Both arms SEQUENTIAL would
		// leave the branch with nothing to exclude and s2 would not be prunable — the fixture, not the gate.
		{
			id: 't12',
			sourceStepId: 's1',
			targetStepId: 's2',
			transitionType: 'CONDITIONAL',
			conditionExpression: { op: 'RESULT_EQUALS', stepId: 's1', path: 'outcome', value: 'PASS' }
		},
		{ id: 't13', sourceStepId: 's1', targetStepId: 's3', transitionType: 'SEQUENTIAL' }
	]
});

describe('RW-1 / #6 — the closed-PWU set is DERIVED, and provably so', () => {
	it('THE ANTI-DRIFT TEST: the read-model gates on exactly the machine’s terminalStates', () => {
		// Asserted as an EQUALITY against the machine rather than by retyping the values — the only form that can
		// notice a fourth terminal state being ratified. The old test retyped the literals and therefore moved with
		// the defect.
		const terminal = getMachine('PWU.workLifecycleState').terminalStates;
		expect(terminal.length, 'the machine must actually declare a terminal set').toBeGreaterThan(0);

		for (const state of terminal)
			expect(
				planAffordancesFor('ACTIVE', 'QUEUED', state).advance,
				`${state} is terminal in the machine, so the read-model must withhold execution affordances`
			).toEqual([]);

		// …and the NON-terminal states are unaffected, so the gate is not simply refusing everything.
		const open = getMachine('PWU.workLifecycleState').states.filter((s) => !terminal.includes(s));
		expect(open.length).toBeGreaterThan(0);
		for (const state of open)
			expect(planAffordancesFor('ACTIVE', 'QUEUED', state).advance, state).toEqual(['start']);
	});
});

describe('RW-1 / #4 — Prune is gated by the same authority as every other affordance', () => {
	it('THE KILL TEST: a closed PWU offers NO prune, though the plan is still ACTIVE', () => {
		// The engine refuses PruneExecutionStep here (pwuOpenness: REQUIRES_OPEN_PWU). Before RW-1 the read-model
		// offered it anyway, because `prunableStepIds` never consulted the PWU at all.
		for (const closed of getMachine('PWU.workLifecycleState').terminalStates)
			expect(prunableStepIds(executionPlanView(branchPlan(closed))), closed).toEqual([]);
	});

	it('…and an OPEN PWU still offers it (the over-refusal half)', () => {
		// Without this, gating prune to [] unconditionally would pass the kill test — over-refusal wearing the
		// fix's clothes, which this lineage has already shipped once.
		expect(prunableStepIds(executionPlanView(branchPlan('EXECUTING')))).toEqual(['s2']);
	});

	it('an ABSENT PWU state does not gate — the disclosed fail-OPEN, consistent with every other affordance', () => {
		expect(prunableStepIds(executionPlanView(branchPlan(undefined)))).toEqual(['s2']);
	});

	it('a non-ACTIVE plan offers no prune either', () => {
		expect(prunableStepIds(executionPlanView(branchPlan('EXECUTING', 'SUPERSEDED')))).toEqual([]);
	});

	it('the view CARRIES the PWU state, so prunableStepIds can see it at all', () => {
		// The mechanical reason prune escaped: `prunableStepIds` takes a VIEW, and the view did not carry the fact.
		expect(executionPlanView(branchPlan('BASELINED')).pwuWorkLifecycleState).toBe('BASELINED');
		expect(executionPlanView(branchPlan(undefined)).pwuWorkLifecycleState).toBeUndefined();
	});
});
