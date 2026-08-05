// REG-E-025 — the read-model withholds `retry` on a step whose §36.2 failure class forbids it.
//
// ── THE FINDING, AND I CREATED IT (adversarial review, 2026-08-05) ────────────────────────────────────────────
// Landing DOC-002 §36's control-action mapping gave `retryExecutionStep` a FIFTH authority limb: a step whose
// last failure class does not permit RETRY may not be retried. The read-model was not told, so the execution tab
// went on offering `retry` on such a step and the engine refused the click.
//
// That is F-29's "no affordance the engine would reject" — the SIXTH instance, created by the same commit that
// added the refusal, one work package after I wrote a register entry about the fifth. The pattern is not that
// people forget; it is that ADDING AN ENGINE REFUSAL IS STRUCTURALLY INCOMPLETE until the read-model has it, and
// nothing in the type system says so.
//
// ── WHY THE POSITIVE HALF IS HALF THIS FILE ──────────────────────────────────────────────────────────────────
// This limb can only ever REMOVE an affordance, so a mutant withholding `retry` unconditionally passes every
// refusal case. Two over-refusal guards below: a retryable class must still offer it, and an UNCLASSIFIED
// failure must still offer it — the second is the disclosed fail-open, and a limb that treated "no class" as
// "forbidden" would silently break every plan whose steps fail without a classification, which is all of them
// today.
import { describe, expect, it } from 'vitest';
import { executionPlanView, type ExecutionPlanInput } from './execution-view.js';

const step = (over: Record<string, unknown> = {}) => ({
	id: 's1',
	stepType: 'MODEL_INVOCATION',
	purpose: 'work',
	stepState: 'FAILED',
	...over
});

const plan = (over: Partial<ExecutionPlanInput> = {}): ExecutionPlanInput => ({
	id: 'plan_failureclass',
	workUnitId: 'pwu_1',
	status: 'ACTIVE',
	steps: [step()],
	...over
});

const viewOf = (over: Record<string, unknown>) =>
	executionPlanView(plan({ steps: [step(over)] })).steps[0]!;

describe('REG-E-025 — the §36 control-action mapping is mirrored into the affordances', () => {
	it('WITHHOLDS retry when the last failure class does not permit it', () => {
		expect(viewOf({ lastFailureClass: 'RETRY_EXHAUSTION' }).advanceCommands).not.toContain('retry');
	});

	it('OFFERS retry for a class that permits it — the over-refusal half', () => {
		expect(viewOf({ lastFailureClass: 'TOOL_FAILURE' }).advanceCommands).toContain('retry');
	});

	it('OFFERS retry when the failure is UNCLASSIFIED — the disclosed fail-open', () => {
		// Absent means ungated, exactly as `attemptsMade` and `runtimeBinding` are. Today NO production path
		// classifies a failure, so a limb that read absence as "forbidden" would empty the retry affordance for
		// the entire product.
		expect(viewOf({}).advanceCommands).toContain('retry');
	});

	it('THE WEDGE GUARD: the step-level exit survives the refusal', () => {
		// The mistake this guards is real and was made once already, on the retry cap: withholding the exits at
		// the moment the operator most needs them. `cancel` is the only step-level exit from FAILED, and every
		// remedy §36 names for RETRY_EXHAUSTION lives above the step.
		const v = viewOf({ lastFailureClass: 'RETRY_EXHAUSTION' });
		expect(v.controlCommands).toContain('cancel');
	});

	it('the withheld affordance carries its REASON — a vanishing button explains itself', () => {
		// This file's sibling rule (N-12): removing the click also removes the engine's rejection message, so the
		// view must carry what that message said. Sourced from the same kernel call that withheld the affordance,
		// so the notice and the withholding cannot disagree.
		const v = viewOf({ lastFailureClass: 'RETRY_EXHAUSTION' });
		expect(v.retryForbiddenByFailureClass?.failureClass).toBe('RETRY_EXHAUSTION');
		expect(v.retryForbiddenByFailureClass?.permittedControlActions).toContain('REPLAN_EXECUTION');
		expect(v.retryForbiddenByFailureClass?.permittedControlActions).toContain('REJECT');
		// ABSENT, not empty, when the class is retryable — "no notice" and "an empty notice" would render
		// differently and only one of them is true.
		expect(viewOf({ lastFailureClass: 'TOOL_FAILURE' }).retryForbiddenByFailureClass).toBeUndefined();
		expect(viewOf({}).retryForbiddenByFailureClass).toBeUndefined();
	});

	it('is INDEPENDENT of the retry cap — inside budget and still forbidden', () => {
		// The two refusals answer different questions: the cap counts attempts, this reads what the failure was.
		// A step on attempt 1 of 9 is nowhere near its cap and must still be refused here, or this limb is just
		// the cap wearing a different name.
		const v = executionPlanView(
			plan({
				steps: [step({ attemptsMade: 1, lastFailureClass: 'RETRY_EXHAUSTION' })],
				retryPolicy: { maxAttempts: 9 }
			})
		).steps[0]!;
		expect(v.advanceCommands).not.toContain('retry');
		expect(v.retryExhaustion, 'the CAP is not reached — this refusal is the class, not the count').toBeUndefined();
	});
});
