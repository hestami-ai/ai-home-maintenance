// JAN-REVREM RW-6 — MAJOR #5: the read-model's THIRD authority limb (RPH-EXE-003).
//
// THE DEFECT. `stepAuthorityRefusal` consults three authority columns — `planLiveness`, `pwuOpenness` and (since
// RW-0) `bindingAuthority`. This read-model consulted two. So the UI offered **Start** on a step whose runtime
// binding is REQUESTED, DENIED, REVOKED, or authorized for a DIFFERENT step, and the engine refused the click.
//
// That is F-29's invariant — "no affordance the engine would reject" — broken for the THIRD time by a newly added
// engine limb whose read-model counterpart nobody added: after RPH-PWU-010 (WP-12b, fixed late by WP-15) and Prune
// (RW-0, absent from the affordance map entirely). Three instances of one mechanism, which is why the fix gates on
// the COLUMN rather than on a list of affordances — see the `resolve` case below, which is the proof of that claim.
//
// C-3 in JAN-REVREM-DS-001 §6 disclosed this as "not fully closable without threading a fourth input through the
// projection" and scoped it to RW-1, where it did not land. It is closed here, by DS §6b R7-R9.
import { describe, expect, it } from 'vitest';
import {
	planAffordancesFor,
	plansForPwus,
	executionPlanView,
	type ExecutionStepInput,
	type StepBindingFacts
} from './execution-view.js';

const STEP = 'stp_the-one-being-afforded';

/** A QUEUED step with the given binding facts. QUEUED because `start` is the affordance the engine gates. */
const queuedStep = (runtimeBinding?: StepBindingFacts, bindingId = 'bind_x'): ExecutionStepInput => ({
	id: STEP,
	stepType: 'AI_TASK',
	purpose: 'the step whose authority is in question',
	stepState: 'QUEUED',
	runtimeBindingId: bindingId,
	...(runtimeBinding === undefined ? {} : { runtimeBinding })
});

const advanceFor = (s: ExecutionStepInput): readonly string[] =>
	executionPlanView({
		id: 'exp_1',
		workUnitId: 'pwu_1',
		status: 'ACTIVE',
		steps: [s]
	}).steps[0]!.advanceCommands;

const controlFor = (s: ExecutionStepInput): readonly string[] =>
	executionPlanView({
		id: 'exp_1',
		workUnitId: 'pwu_1',
		status: 'ACTIVE',
		steps: [s]
	}).steps[0]!.controlCommands;

describe('RW-6 — Start is withheld exactly when the engine would refuse the binding', () => {
	it('withholds start on a REQUESTED binding — the BLOCKER case, as the UI sees it', () => {
		expect(
			advanceFor(queuedStep({ resolves: true, boundStepId: STEP, authorizationStatus: 'REQUESTED' }))
		).not.toContain('start');
	});

	it('OFFERS start on an AUTHORIZED binding — without this the limb could be `return false`', () => {
		expect(
			advanceFor(queuedStep({ resolves: true, boundStepId: STEP, authorizationStatus: 'AUTHORIZED' }))
		).toEqual(['start']);
	});

	it('OFFERS start on a PARTIALLY_AUTHORIZED binding — the acceptance limb the kernel permits', () => {
		// The engine permits this status, and N-6 records that no command can currently PRODUCE it. If the read-model
		// refused it, the two layers would disagree the moment N-6 is closed — and nothing would be testing the
		// disagreement, because no command can reach the state to reveal it.
		expect(
			advanceFor(
				queuedStep({ resolves: true, boundStepId: STEP, authorizationStatus: 'PARTIALLY_AUTHORIZED' })
			)
		).toEqual(['start']);
	});

	it('withholds start when the binding names ANOTHER step, even though its status is AUTHORIZED', () => {
		// The SCOPE limb (RW-3, §8.1). Status alone is not authority: a binding granted for other work — with whatever
		// capabilities that step's risk justified — is not this step's authority at all.
		expect(
			advanceFor(
				queuedStep({
					resolves: true,
					boundStepId: 'stp_some-other-work',
					authorizationStatus: 'AUTHORIZED'
				})
			)
		).not.toContain('start');
	});

	it('withholds start when the binding does not resolve — a RESOLVED NEGATIVE gates', () => {
		expect(advanceFor(queuedStep({ resolves: false }))).not.toContain('start');
	});
});

describe('RW-6 — the two absences mean opposite things (DS §6b R9)', () => {
	it('OFFERS start when the caller supplied NO facts — fail-OPEN, asserted so it cannot be quietly tightened', () => {
		// A caller that cannot resolve bindings gets the pre-RW-6 answer rather than a silently emptied action column.
		// The engine still refuses, so the cost is a rejected click and not an illegal act. This test exists because
		// the tempting "safer" reading — absent means unauthorized — empties the UI for every caller that has not been
		// updated, which looks like a bug in the plan rather than in the projection.
		expect(advanceFor(queuedStep(undefined))).toEqual(['start']);
	});

	it('OFFERS start when the step names NO binding at all — OUT OF SCOPE, and load-bearing', () => {
		// The rule's antecedent is "WITH a runtime binding". The reference seed authors no RuntimeBinding whatsoever,
		// so gating this case would make every existing plan permanently unstartable — which is what ledger mutant B5
		// proves at the engine layer by asserting the seed itself breaks.
		expect(advanceFor(queuedStep({ resolves: false }, ''))).toEqual(['start']);
	});
});

describe('RW-6 — the gate follows the COLUMN, not a hardcoded pair of affordances', () => {
	it('withholds RESOLVE on a WAITING step whose binding is unauthorized', () => {
		// THE PROOF OF R7. `ResolveExecutionStepWait` is the SECOND arrow into RUNNING and declares
		// `REQUIRES_AUTHORIZED_BINDING`; it was the two-arrows BLOCKER at the engine layer. If this read-model had
		// gated on the literal affordance `start`, this case would pass a click straight into a refusal — and nothing
		// else in this file would have noticed.
		expect(
			controlFor({
				...queuedStep({ resolves: true, boundStepId: STEP, authorizationStatus: 'REVOKED' }),
				stepState: 'WAITING'
			})
		).not.toContain('resolve');
	});

	it('still OFFERS cancel on that same step — gating the exit of last resort would STRAND it', () => {
		// The over-refusal guard, and it is not hypothetical: `CancelExecutionStep` declares `NOT_EXECUTING` precisely
		// so a step with a revoked binding can still be abandoned. Ledger mutant R6 proves the engine side by gating
		// cancel and watching the strand appear.
		expect(
			controlFor({
				...queuedStep({ resolves: true, boundStepId: STEP, authorizationStatus: 'REVOKED' }),
				stepState: 'WAITING'
			})
		).toContain('cancel');
	});

	it('leaves every OTHER affordance of an unauthorized step untouched', () => {
		// A QUEUED step with a bad binding may still be skipped (with authorization) or cancelled. Withholding those
		// would be a second defect wearing the first one's fix as a disguise.
		expect(
			controlFor(queuedStep({ resolves: true, boundStepId: STEP, authorizationStatus: 'DENIED' }))
		).toEqual(['skip', 'cancel']);
	});
});

describe('RW-6 — plansForPwus ATTACHES the facts, which is how the production caller supplies them', () => {
	// The projection gating correctly is worth nothing if the caller never hands it the facts — that would be closing
	// MAJOR #5 on paper. `plansForPwus` is the seam the demo's load() goes through, keyed by BINDING id because the
	// binding is the object the caller looks up.
	const row = (runtimeBindingId?: string, runtimeBinding?: StepBindingFacts) => ({
		id: 'exp_1',
		workUnitId: 'pwu_1',
		status: 'ACTIVE',
		steps: [
			{
				id: STEP,
				stepType: 'AI_TASK',
				purpose: 'p',
				stepState: 'QUEUED',
				...(runtimeBindingId === undefined ? {} : { runtimeBindingId }),
				...(runtimeBinding === undefined ? {} : { runtimeBinding })
			}
		]
	});
	const advance = (
		r: ReturnType<typeof row>,
		facts: Readonly<Record<string, StepBindingFacts>> = {}
	) => plansForPwus([r], ['pwu_1'], {}, facts)[0]!.steps[0]!.advanceCommands;

	it('attaches a matching binding’s facts and gates on them', () => {
		expect(
			advance(row('bind_x'), {
				bind_x: { resolves: true, boundStepId: STEP, authorizationStatus: 'REQUESTED' }
			})
		).not.toContain('start');
	});

	it('leaves a step whose binding is ABSENT FROM THE MAP ungated — not resolved is not unauthorized', () => {
		expect(advance(row('bind_unknown'), { bind_x: { resolves: true } })).toEqual(['start']);
	});

	it('does not invent facts for a step naming no binding', () => {
		expect(advance(row(undefined), { bind_x: { resolves: false } })).toEqual(['start']);
	});

	it('lets the ROW win over the map, so an explicit fact is never overwritten by a lookup', () => {
		// The row is the more specific statement. If the map could override it, a caller could not express "I have
		// already resolved this one differently" — and the two sources would silently disagree.
		expect(
			advance(row('bind_x', { resolves: true, boundStepId: STEP, authorizationStatus: 'AUTHORIZED' }), {
				bind_x: { resolves: false }
			})
		).toEqual(['start']);
	});

	it('passing NO map changes nothing, including for steps that name bindings', () => {
		expect(advance(row('bind_x'))).toEqual(['start']);
	});
});

describe('RW-6 — planAffordancesFor keeps its pre-RW-6 behaviour for every existing caller', () => {
	it('is unchanged when called with three arguments, so no caller had to be edited', () => {
		// The fourth parameter is optional and absent means ungated (R9). Asserted rather than assumed, because "I
		// added an optional parameter so nothing broke" is a claim about every call site in the repo.
		expect(planAffordancesFor('ACTIVE', 'QUEUED').advance).toEqual(['start']);
		expect(planAffordancesFor('ACTIVE', 'QUEUED', 'IN_PROGRESS').advance).toEqual(['start']);
		expect(planAffordancesFor('ACTIVE', 'WAITING').control).toEqual(['cancel', 'resolve']);
	});
});
