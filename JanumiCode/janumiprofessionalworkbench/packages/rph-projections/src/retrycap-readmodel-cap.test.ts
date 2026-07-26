// JAN-RETRYCAP / N-12 — the read-model withholds `retry` on a step the engine would refuse.
//
// THE FINDING. `planPermitsAffordance` gated on three spec columns, all decided by DECLARED STATE. RPH-EXE-008's
// retry cap is a fourth command-layer refusal decided by a COUNT OVER THE EVENT STREAM, and no column can hold a
// number that changes every time the step starts — so a column-driven filter is blind to it BY CONSTRUCTION. The
// UI therefore offered `retry` on every FAILED step under an ACTIVE plan, including one already exhausted, and the
// engine refused the click. F-29's fourth instance, and the first that the fix for the third could not have caught.
//
// WHY THE POSITIVE HALF IS MOST OF THIS FILE. This limb can only ever REMOVE an affordance, so a mutant that
// withheld `retry` unconditionally — or withheld every affordance once the cap is reached — would satisfy every
// refusal case below. The second of those is the dangerous one and it is a WEDGE: exhaustion is exactly when an
// operator needs `cancel` and `skip`, and RPH-EXE-008 itself answers an exhausted retry by naming REPLAN_EXECUTION
// among the permitted actions. Withholding the exits at the cap would close the door the rule prescribes.
import { describe, expect, it } from 'vitest';
import { DEFAULT_RETRY_CAP, STEP_COMMAND_SPECS, type StepCommandType } from '@janumipwb/rph-domain';
import { executionPlanView, type ExecutionPlanInput } from './execution-view.js';

const PLAN = 'plan_retrycap';

const step = (over: Record<string, unknown> = {}) => ({
	id: 's1',
	stepType: 'MODEL_INVOCATION',
	purpose: 'work',
	stepState: 'FAILED',
	...over
});

const plan = (over: Partial<ExecutionPlanInput> = {}): ExecutionPlanInput => ({
	id: PLAN,
	workUnitId: 'pwu_1',
	status: 'ACTIVE',
	steps: [step()],
	...over
});

/** The affordances the view offers for the single step of `input`. */
const affordancesOf = (input: ExecutionPlanInput) => {
	const s = executionPlanView(input).steps[0]!;
	return { advance: s.advanceCommands, control: s.controlCommands };
};

describe('N-12 — the retry cap is mirrored, so the UI stops offering a click the engine refuses', () => {
	it('WITHHOLDS retry on a FAILED step that has reached the cap', () => {
		const r = affordancesOf(
			plan({ steps: [step({ attemptsMade: 3 })], retryPolicy: { maxAttempts: 3 } })
		);
		expect(r.advance).not.toContain('retry');
	});

	it('OFFERS retry while attempts remain — the over-refusal half', () => {
		// Without this, a limb that withheld `retry` unconditionally would pass every refusal case in this file and
		// silently remove a legal action instead of an illegal one.
		const r = affordancesOf(
			plan({ steps: [step({ attemptsMade: 2 })], retryPolicy: { maxAttempts: 3 } })
		);
		expect(r.advance).toContain('retry');
	});

	it('THE WEDGE GUARD: at the cap, the exit is still offered', () => {
		// A limb that emptied the action column at the cap would strand the step — the shape RW-0 withdrew a limb
		// for. Every UNCAPPED row in the spec table is a promise that this stays true.
		//
		// THIS ASSERTION WAS WRITTEN WRONG FIRST, AND THE CORRECTION IS THE INTERESTING PART. It also demanded
		// `skip`, on the reasoning that RPH-EXE-008 answers an exhausted retry with REPLAN_EXECUTION and a REPLAN
		// Decision authorizes a skip. It failed: `SkipExecutionStep` declares sourceStates READY|QUEUED, so skip is
		// not machine-legal from FAILED AT ALL — and reaching QUEUED needs a retry, which is exactly what the cap
		// refuses. **At the cap, `cancel` is the only step-level exit**, and every remedy RPH-EXE-008 names is
		// above the step level. Recorded as N-17 rather than patched: it is a real gap in the ladder, not a defect
		// in this limb.
		const r = affordancesOf(
			plan({ steps: [step({ attemptsMade: 9 })], retryPolicy: { maxAttempts: 3 } })
		);
		expect(r.control).toContain('cancel');
	});

	it('…and the cap is not what removed skip — a below-cap FAILED step has no skip either', () => {
		// The control that stops the assertion above from silently becoming "the cap removes skip, and that is
		// fine". If a future change DID make the cap withhold skip, these two would diverge and this reddens.
		const atCap = affordancesOf(
			plan({ steps: [step({ attemptsMade: 3 })], retryPolicy: { maxAttempts: 3 } })
		);
		const belowCap = affordancesOf(
			plan({ steps: [step({ attemptsMade: 1 })], retryPolicy: { maxAttempts: 3 } })
		);
		expect(atCap.control).toEqual(belowCap.control);
	});

	it('treats an ABSENT count as UNGATED, not exhausted — the disclosed fail-open', () => {
		// Same disposition as `runtimeBinding` and `pwuWorkLifecycleState` (DS §6b R9): a caller that cannot supply
		// the fact gets the pre-N-12 behaviour rather than a silently emptied action column. The engine still
		// refuses, so the cost is a rejected click, not an illegal act.
		const r = affordancesOf(plan({ steps: [step()], retryPolicy: { maxAttempts: 1 } }));
		expect(r.advance).toContain('retry');
	});

	// ── THE CAP CONVENTION IS THE KERNEL'S, NOT THIS LAYER'S ────────────────────────────────────────────────────
	describe('the cap comes from retryCapFrom, so the projection cannot invent its own', () => {
		it('applies the DEFAULT when the plan declares no RetryPolicy at all', () => {
			const atDefault = affordancesOf(plan({ steps: [step({ attemptsMade: DEFAULT_RETRY_CAP })] }));
			const belowDefault = affordancesOf(
				plan({ steps: [step({ attemptsMade: DEFAULT_RETRY_CAP - 1 })] })
			);
			expect(atDefault.advance).not.toContain('retry');
			expect(belowDefault.advance).toContain('retry');
		});

		it('falls back to the DEFAULT on a degenerate cap rather than refusing everything', () => {
			// 0 / negative / non-integer / non-numeric would each produce a cap that refuses the FIRST retry — an
			// unusable plan authored by a typo. Fail-SAFE: the conventional cap, not an unbounded one and not zero.
			for (const maxAttempts of [0, -1, 2.5, 'three', null])
				expect(
					affordancesOf(plan({ steps: [step({ attemptsMade: 1 })], retryPolicy: { maxAttempts } }))
						.advance,
					`maxAttempts=${String(maxAttempts)}`
				).toContain('retry');
		});
	});

	// ── THE COLUMN ─────────────────────────────────────────────────────────────────────────────────────────────
	describe('the retryBudget column decides WHICH commands the cap governs', () => {
		it('declares a disposition and a rationale for every step command', () => {
			const types = Object.keys(STEP_COMMAND_SPECS) as StepCommandType[];
			expect(types.length).toBeGreaterThanOrEqual(9);
			for (const t of types) {
				expect(['CONSUMES_RETRY_BUDGET', 'UNCAPPED'], t).toContain(
					STEP_COMMAND_SPECS[t].retryBudget
				);
				expect(STEP_COMMAND_SPECS[t].retryBudgetRationale.length, t).toBeGreaterThan(20);
			}
		});

		it('names RetryExecutionStep, and ONLY it, as spending the budget', () => {
			// The engine caps exactly one command. A second row flipping to CONSUMES_RETRY_BUDGET without a matching
			// engine precheck would make this read-model withhold an affordance the engine allows — the inverse of
			// F-29, and just as wrong.
			const spending = (Object.keys(STEP_COMMAND_SPECS) as StepCommandType[]).filter(
				(t) => STEP_COMMAND_SPECS[t].retryBudget === 'CONSUMES_RETRY_BUDGET'
			);
			expect(spending).toEqual(['RetryExecutionStep']);
		});

		it('leaves the two arrows into RUNNING UNCAPPED — a resume must not be charged as an attempt', () => {
			// The load-bearing asymmetry with `bindingAuthority` and `inputReadiness`, which are REQUIRES_* on both
			// of these rows. A resume emits no ExecutionStepStarted, so it continues the attempt Start already
			// opened; charging it would let a wait/resume cycle exhaust a plan that had run exactly once.
			expect(STEP_COMMAND_SPECS.StartExecutionStep.retryBudget).toBe('UNCAPPED');
			expect(STEP_COMMAND_SPECS.ResolveExecutionStepWait.retryBudget).toBe('UNCAPPED');
		});
	});

	it('does not disturb a step that is not FAILED', () => {
		// `lastAttemptFailed` is derived from the step's own state, so a RUNNING step at a nominal "cap" keeps its
		// ordinary affordances — the cap governs re-attempts, not work in flight.
		const r = affordancesOf(
			plan({
				steps: [step({ stepState: 'RUNNING', attemptsMade: 9 })],
				retryPolicy: { maxAttempts: 3 }
			})
		);
		expect(r.advance).toContain('complete');
		expect(r.advance).toContain('fail');
	});
});

// ── N-21 — RPH-EXE-005 IS MIRRORED TOO, AND ITS ABSENCE WAS MINE ────────────────────────────────────────────────
//
// JAN-CAPBIND WP-3 gave the engine a fourth authority column (`inputReadiness`) and wired it at BOTH arrows into
// RUNNING. This read-model was never told. So `start` and `resolve` were offered on a step whose required input
// artifact does not exist, and the engine refused the click — F-29 on a RATIFIED rule, one work package before I
// closed the same shape for the retry cap and called that "the fourth instance".
//
// The mirror is one line in `planPermitsAffordance` because the limb is gated on the COLUMN, not on a command
// name: both arrows are covered at once, and a tenth command declaring REQUIRES_PRESENT_INPUTS is withheld here on
// the day it is declared.
describe('N-21 — the read-model withholds start when a REQUIRED input does not resolve', () => {
	const queued = (over: Record<string, unknown> = {}) =>
		step({ stepState: 'QUEUED', ...over });

	it('THE KILL TEST: an unresolved required input withholds start', () => {
		const r = affordancesOf(plan({ steps: [queued({ unresolvedRequiredInputs: ['art_missing'] })] }));
		expect(r.advance).not.toContain('start');
	});

	it('OFFERS start when every required input resolves — a RESOLVED empty array permits', () => {
		// The over-refusal half, and the asymmetry that matters: an empty array is "checked, all present" and must
		// permit; only a NON-EMPTY resolved array gates.
		const r = affordancesOf(plan({ steps: [queued({ unresolvedRequiredInputs: [] })] }));
		expect(r.advance).toContain('start');
	});

	it('treats an ABSENT fact as UNGATED — the same disclosed fail-open as every sibling', () => {
		const r = affordancesOf(plan({ steps: [queued()] }));
		expect(r.advance).toContain('start');
	});

	it('withholds RESUME too — the second arrow into RUNNING, covered by the column not by a name', () => {
		// The omission that made the binding limb a BLOCKER was exactly this arrow. Gating on `inputReadiness`
		// rather than on `start` is what makes covering it free.
		const r = affordancesOf(
			plan({ steps: [step({ stepState: 'WAITING', unresolvedRequiredInputs: ['art_missing'] })] })
		);
		expect(r.control).not.toContain('resolve');
	});

	it('THE WEDGE GUARD: cancel survives an unresolvable input', () => {
		// A step whose required artifact can never appear must still have an exit, or an unsatisfiable input strands
		// the arm permanently — the shape RW-0 withdrew a limb for. `CancelExecutionStep` is CLEANUP_EXEMPT on every
		// column precisely so this stays true.
		const r = affordancesOf(
			plan({ steps: [step({ stepState: 'RUNNING', unresolvedRequiredInputs: ['art_missing'] })] })
		);
		expect(r.control).toContain('cancel');
	});
});
