// JAN-EXECREM WP-15 — "No affordance the engine would reject" becomes STRUCTURAL (F-29).
//
// DWP-06 declares the invariant in its own header, and prohibits inventing affordances from machine topology.
// `advanceCommandsFor(stepState)` nonetheless mirrors a precondition over (planStatus, stepState) while taking
// only stepState, and the template rendered its result unconditionally — so RETRY was offered on a FAILED step
// under a CANCELLED or SUPERSEDED plan, and the engine refused it. That is exactly the read-model/authority
// divergence the plan-ACTIVE gate on `prunableStepIds` was added to prevent, reintroduced on the retry path.
//
// WHY IT HAPPENED, AND WHY THE FIX IS A DELETION. Four sibling affordances had each grown their OWN inline
// plan-status condition in the Svelte template. Retry never got one. A rule copied into five templates has five
// chances to be forgotten and no way to notice; the sixth copy would not have helped. The condition now lives
// ONCE, in the read-model, reading `planLiveness` off the command's own spec row — the same declaration the
// engine enforces (WP-12b). The plan status was already sitting unused on `ExecutionPlanInput.status` at the
// exact construction site.
//
// BOTH-SIDES PAIRS THROUGHOUT. A test that only asserts the refusal is satisfied by a projection that offers
// nothing at all, which would be a worse defect wearing the fix's clothes.
import { describe, expect, it } from 'vitest';
import {
	executionPlanView,
	planAffordancesFor,
	plansForPwus,
	type ExecutionPlanInput
} from './execution-view.js';

const PLAN = 'plan_x';
const view = (status: string, stepState: string) => {
	const input: ExecutionPlanInput = {
		id: PLAN,
		workUnitId: 'pwu_x',
		status,
		steps: [{ id: 's1', stepType: 'TRANSFORMATION', purpose: 'work', stepState }],
		transitions: []
	};
	return executionPlanView(input).steps[0]!;
};

describe('WP-15 / F-29 — the retry affordance is plan-aware', () => {
	it('THE KILL TEST: a FAILED step under a non-ACTIVE plan offers NO retry', () => {
		// The engine refuses RetryExecutionStep on a superseded plan (RPH-EXE-002); the UI used to offer it anyway.
		for (const status of ['SUPERSEDED', 'CANCELLED', 'FAILED', 'COMPLETED', 'APPROVED'])
			expect(planAffordancesFor(status, 'FAILED').advance, status).toEqual([]);
	});

	it('…and a FAILED step under an ACTIVE plan STILL offers retry (the over-refusal half)', () => {
		expect(planAffordancesFor('ACTIVE', 'FAILED').advance).toEqual(['retry']);
	});
});

describe('WP-15 — the DECLARED cleanup exemptions survive a dead plan, and only those', () => {
	it('SUPERSEDED + RUNNING offers cancel and wait — NOT the empty set', () => {
		// The deliberate exemption, pinned. Cancel is the exit every other refusal message points at, and a running
		// step must be able to record that it is blocked; withholding either would strand live work.
		expect(planAffordancesFor('SUPERSEDED', 'RUNNING').control).toEqual(['cancel', 'wait']);
	});

	it('SUPERSEDED + RUNNING withholds COMPLETE but keeps FAIL — the axis is credit, not work', () => {
		// The sharpest expression of WP-12b's classification, and it cuts BOTH ways in one assertion. Complete
		// moved to the gated side (it mints terminal-success and a durable branch decision), so its affordance had
		// to move with it — otherwise this very programme would re-break the invariant it is fixing. Fail is
		// CLEANUP_EXEMPT and is NOT withheld: a running step must be able to record that it failed, whatever the
		// plan's status, and a filter that dropped it would be over-refusal wearing the fix's clothes.
		expect(planAffordancesFor('SUPERSEDED', 'RUNNING').advance).toEqual(['fail']);
		expect(planAffordancesFor('ACTIVE', 'RUNNING').advance).toEqual(['complete', 'fail']);
	});

	it('SUPERSEDED + QUEUED offers no ADVANCE at all', () => {
		// Without this the deletion of the `start` row would be MASKED: `startableStepByPlan` carries its own
		// plan-ACTIVE gate, so the UI would look correct for the wrong reason.
		expect(planAffordancesFor('SUPERSEDED', 'QUEUED').advance).toEqual([]);
		expect(planAffordancesFor('ACTIVE', 'QUEUED').advance).toEqual(['start']);
	});

	it('SUPERSEDED + QUEUED offers cancel but NOT skip — skip mints terminal-success', () => {
		expect(planAffordancesFor('SUPERSEDED', 'QUEUED').control).toEqual(['cancel']);
		expect(planAffordancesFor('ACTIVE', 'QUEUED').control).toEqual(['skip', 'cancel']);
	});

	it('SUPERSEDED + WAITING offers cancel but NOT resolve — resuming re-opens RUNNING', () => {
		expect(planAffordancesFor('SUPERSEDED', 'WAITING').control).toEqual(['cancel']);
		expect(planAffordancesFor('ACTIVE', 'WAITING').control).toEqual(['cancel', 'resolve']);
	});

	it('SUPERSEDED + FAILED still offers cancel — the WP-5 abandon path is never withheld', () => {
		expect(planAffordancesFor('SUPERSEDED', 'FAILED').control).toEqual(['cancel']);
	});
});

describe('WP-15 — the PWU-openness limb (RPH-PWU-010), so this fix does not reopen F-29 elsewhere', () => {
	// WP-12b gave the engine a SECOND authority limb: a closed PWU opens no new execution. A plan on a closed PWU
	// keeps status ACTIVE, so gating on plan status alone would leave the UI offering Start on a plan the engine
	// now refuses — F-29's own invariant re-broken in a new place, by its remedy.
	it('an ACTIVE plan on a CLOSED PWU withholds the execution affordances', () => {
		for (const closed of ['BASELINED', 'ABANDONED', 'SUPERSEDED']) {
			expect(planAffordancesFor('ACTIVE', 'QUEUED', closed).advance, closed).toEqual([]);
			expect(planAffordancesFor('ACTIVE', 'FAILED', closed).advance, closed).toEqual([]);
		}
	});

	it('…and still offers CLEANUP, so closing a PWU never strands its live steps', () => {
		expect(planAffordancesFor('ACTIVE', 'RUNNING', 'BASELINED').control).toEqual(['cancel', 'wait']);
		expect(planAffordancesFor('ACTIVE', 'RUNNING', 'BASELINED').advance).toEqual(['fail']);
	});

	it('an OPEN PWU changes nothing (the over-refusal half)', () => {
		for (const open of ['EXECUTING', 'READY', 'PLANNED', 'SATISFIED'])
			expect(planAffordancesFor('ACTIVE', 'QUEUED', open).advance, open).toEqual(['start']);
	});

	it('an ABSENT PWU state does not gate — the disclosed fail-OPEN default', () => {
		// Recorded, not hidden: a caller that cannot supply the PWU's state gets the pre-WP-15 behaviour rather
		// than a silently emptied action column. The engine still refuses, so the cost is a rejected click.
		expect(planAffordancesFor('ACTIVE', 'QUEUED', undefined).advance).toEqual(['start']);
	});

	it('the plan view carries it through, and plansForPwus supplies it from the PWU map', () => {
		const input: ExecutionPlanInput = {
			id: PLAN,
			workUnitId: 'pwu_x',
			status: 'ACTIVE',
			steps: [{ id: 's1', stepType: 'TRANSFORMATION', purpose: 'work', stepState: 'QUEUED' }],
			transitions: []
		};
		expect(executionPlanView({ ...input, pwuWorkLifecycleState: 'BASELINED' }).steps[0]!.advanceCommands).toEqual(
			[]
		);
		const [viaScope] = plansForPwus([input], ['pwu_x'], { pwu_x: 'BASELINED' });
		expect(viaScope!.steps[0]!.advanceCommands, 'the production caller path').toEqual([]);
	});
});

describe('WP-15 — fail-closed, and total', () => {
	it('an OFF-CONTRACT plan status offers cleanup only, never the gated set', () => {
		// Only the literal 'ACTIVE' opens the gated affordances. A status this projection has never heard of must
		// not be treated as live.
		expect(planAffordancesFor('NOT_A_REAL_STATUS', 'FAILED').advance).toEqual([]);
		expect(planAffordancesFor('', 'RUNNING').control).toEqual(['cancel', 'wait']);
	});

	it('an off-contract STEP state still offers nothing (never fabricate)', () => {
		expect(planAffordancesFor('ACTIVE', 'NONSENSE')).toEqual({ advance: [], control: [] });
	});

	it('a terminal step offers nothing, however live the plan', () => {
		for (const stepState of ['SUCCEEDED', 'SKIPPED', 'CANCELLED', 'SUPERSEDED'])
			expect(planAffordancesFor('ACTIVE', stepState), stepState).toEqual({ advance: [], control: [] });
	});
});

describe('WP-15 — the VIEW carries the filtered sets, so the template needs no condition', () => {
	it('the step view under a superseded plan shows no retry', () => {
		// The whole point of threading the status into the projection: the template renders what it is given.
		expect(view('SUPERSEDED', 'FAILED').advanceCommands).toEqual([]);
		expect(view('SUPERSEDED', 'FAILED').controlCommands).toEqual(['cancel']);
	});

	it('the same step under an ACTIVE plan shows retry', () => {
		expect(view('ACTIVE', 'FAILED').advanceCommands).toEqual(['retry']);
	});
});
