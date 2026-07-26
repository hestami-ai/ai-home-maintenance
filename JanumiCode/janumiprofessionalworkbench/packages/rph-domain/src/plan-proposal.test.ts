// JAN-EXECREM WP-6 — propose-time structural admissibility. Closes F-09/F-27, F-10 (BLOCKER), F-33.
//
// THE SHAPE OF THE DEFECT. `ProposeExecutionPlan` is the only writer of a plan's steps[]/transitions[], but it ran
// three transition-scoped validators, and the structural one SHORT-CIRCUITED on an empty transitions[]. So a LINEAR
// plan — the shape the reference seed and most suites use — got NO step validation at all.
//
// THE ANTI-VACUITY TEST is therefore a duplicate step id on a plan with `transitions: []`. It is RED under any
// mutant that folds the step rules back inside the transition-shaped validator, which is precisely how the gap
// arose. Every rule below is asserted on a LINEAR plan wherever the rule permits one.
import { describe, expect, it } from 'vitest';
import { validateProposedPlan, type PlanProposalInput } from './plan-proposal.js';
import { StepStateSchema } from '@janumipwb/rph-contracts';

const PLAN = 'plan_1';
const step = (id: string, over: Record<string, unknown> = {}) => ({
	id,
	executionPlanId: PLAN,
	stepType: 'TRANSFORMATION',
	stepState: 'QUEUED',
	...over
});
const input = (over: Partial<PlanProposalInput> = {}): PlanProposalInput => ({
	executionPlanId: PLAN,
	steps: [step('s1')],
	transitions: [],
	...over
});

describe('WP-6 — the rules hold on a LINEAR plan (transitions: []), which is where they were absent', () => {
	it('accepts a well-formed linear plan', () => {
		expect(validateProposedPlan(input({ steps: [step('s1'), step('s2')] }))).toEqual({ ok: true });
	});

	// F-10 (BLOCKER) — THE anti-vacuity case. `advanceStep` resolves by findIndex, so a duplicate is unaddressable
	// by any command: it can never start, be skipped or pruned, and it blocks completion forever.
	it('REFUSES a duplicate step id — with NO transitions at all (the anti-vacuity case)', () => {
		const r = validateProposedPlan(input({ steps: [step('dup'), step('dup')], transitions: [] }));
		expect(r.ok).toBe(false);
		expect(r.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
		expect(r.message).toContain('declared more than once');
		expect(r.message, 'the message must explain the harm, not just name the rule').toContain('block');
	});

	it('REFUSES a step-less plan (it would complete vacuously)', () => {
		const r = validateProposedPlan(input({ steps: [] }));
		expect(r.ok).toBe(false);
		expect(r.message).toContain('at least one step');
	});

	it('REFUSES an empty or blank step id', () => {
		expect(validateProposedPlan(input({ steps: [step('')] })).ok).toBe(false);
		expect(validateProposedPlan(input({ steps: [step('   ')] })).ok).toBe(false);
	});

	it('REFUSES a step belonging to a different plan', () => {
		const r = validateProposedPlan(input({ steps: [step('s1', { executionPlanId: 'plan_other' })] }));
		expect(r.ok).toBe(false);
		expect(r.message).toContain('not this plan');
	});

	it('REFUSES a pre-authored BRANCH decision (a selection is RECORDED when the branch resolves)', () => {
		const r = validateProposedPlan(input({ steps: [step('s1', { selectedTransitionId: 't1' })] }));
		expect(r.ok).toBe(false);
		expect(r.message).toContain('selectedTransitionId');
	});
});

// F-09 / F-27. DS-004 §3 says steps "rest QUEUED — a convention this design relies on and ENFORCES". Nothing
// enforced it. An authored NOT_READY step is the worst case: the machine has no command that drives one out and it
// is not terminal, so the step can never start, never reach terminal-success, and blocks completion permanently.
describe('WP-6 / F-09 + F-27 — a proposed step must rest at QUEUED, exhaustively over the state enum', () => {
	const ALL_STATES = StepStateSchema.options;

	it('the enum is the ten states the rule is written against', () => {
		expect(ALL_STATES).toHaveLength(10);
	});

	it.each(ALL_STATES.map((st) => [st]))('stepState %s', (stepState) => {
		const r = validateProposedPlan(input({ steps: [step('s1', { stepState })] }));
		if (stepState === 'QUEUED') {
			expect(r.ok, 'QUEUED is the at-rest state').toBe(true);
			return;
		}
		expect(r.ok, `${stepState} must be refused at propose`).toBe(false);
		expect(r.message).toContain('must rest at QUEUED');
	});

	it('names the two distinct harms — claimed work, and an unadvanceable step', () => {
		const advanced = validateProposedPlan(input({ steps: [step('s1', { stepState: 'SUCCEEDED' })] }));
		expect(advanced.message).toContain('claims work');
		const stuck = validateProposedPlan(input({ steps: [step('s1', { stepState: 'NOT_READY' })] }));
		expect(stuck.message).toContain('no command can advance');
	});
});

describe('WP-6 / F-33 — the CONDITIONAL <-> conditionExpression biconditional', () => {
	const two = [step('s1'), step('s2')];
	const cond = { op: 'STEP_SUCCEEDED' as const, stepId: 's1' };

	it('REFUSES a CONDITIONAL edge with no expression (a permanently dead arm)', () => {
		const r = validateProposedPlan(
			input({
				steps: two,
				transitions: [{ id: 't1', sourceStepId: 's1', targetStepId: 's2', transitionType: 'CONDITIONAL' }]
			})
		);
		expect(r.ok).toBe(false);
		expect(r.message).toContain('no conditionExpression');
	});

	it('REFUSES an expression on a non-CONDITIONAL edge (the label and the runtime must agree)', () => {
		const r = validateProposedPlan(
			input({
				steps: two,
				transitions: [
					{
						id: 't1',
						sourceStepId: 's1',
						targetStepId: 's2',
						transitionType: 'SEQUENTIAL',
						conditionExpression: cond
					}
				]
			})
		);
		expect(r.ok).toBe(false);
		expect(r.message).toContain('not CONDITIONAL');
	});

	it('REFUSES a transition belonging to a different plan', () => {
		const r = validateProposedPlan(
			input({
				steps: two,
				transitions: [
					{ id: 't1', executionPlanId: 'plan_other', sourceStepId: 's1', targetStepId: 's2' }
				]
			})
		);
		expect(r.ok).toBe(false);
		expect(r.message).toContain('not this plan');
	});
});

describe('WP-6 — the three ABSORBED rules keep their exact codes and messages', () => {
	const two = [step('s1'), step('s2')];

	it('duplicate transition id (verbatim)', () => {
		const r = validateProposedPlan(
			input({
				steps: two,
				transitions: [
					{ id: 'dup', sourceStepId: 's1', targetStepId: 's2' },
					{ id: 'dup', sourceStepId: 's2', targetStepId: 's1' }
				]
			})
		);
		expect(r.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
		expect(r.message).toContain('transition id "dup" is declared more than once');
		expect(r.message).toContain('a BRANCH records its decision by transition id');
	});

	it('malformed condition keeps the SCHEMA code (not the semantic one)', () => {
		const r = validateProposedPlan(
			input({
				steps: two,
				transitions: [
					{
						id: 't1',
						sourceStepId: 's1',
						targetStepId: 's2',
						transitionType: 'CONDITIONAL',
						conditionExpression: { op: 'NOT_A_REAL_OP' }
					}
				]
			})
		);
		expect(r.code).toBe('RPH_VALIDATION_SCHEMA_FAILED');
		expect(r.message).toContain('conditionExpression is malformed (DR-004 DWP-02)');
	});

	it('a condition referencing an undeclared step (verbatim)', () => {
		const r = validateProposedPlan(
			input({
				steps: two,
				transitions: [
					{
						id: 't1',
						sourceStepId: 's1',
						targetStepId: 's2',
						transitionType: 'CONDITIONAL',
						conditionExpression: { op: 'STEP_SUCCEEDED', stepId: 'ghost' }
					}
				]
			})
		);
		expect(r.message).toContain('references step "ghost"');
		expect(r.message).toContain('not a declared step in the plan (DR-004 DWP-02)');
	});

	it('malformed graph (verbatim wrapper)', () => {
		// Two entries — the graph rule the wrapper reports.
		const r = validateProposedPlan(
			input({
				steps: [step('s1'), step('s2'), step('s3')],
				transitions: [{ id: 't1', sourceStepId: 's1', targetStepId: 's2' }]
			})
		);
		expect(r.ok).toBe(false);
		expect(r.message).toContain('malformed transition graph —');
		expect(r.message).toContain('(DR-004 DWP-01)');
	});
});

// ── JAN-BINDEXCL / N-11 (MAJOR) — L4, RUNTIME BINDING EXCLUSIVITY ────────────────────────────────────────────
//
// THE FINDING. A binding names exactly ONE step (`RuntimeBinding.executionStepId`, ratified and required), so two
// steps naming one binding is a contradiction the proposal states about ITSELF. At most one of them can start;
// RW-3's Start-time SCOPE limb then refuses the other FOREVER, and its refusal's remedy is INERT — nothing
// rewrites a step's `runtimeBindingId` after propose, and nothing rewrites a binding's `executionStepId` after
// request. So "request a binding for this step" mints one no step names.
//
// THIS IS THE ANTI-VACUITY SHAPE OF THE WHOLE FILE, one rule further on: it is decidable from the step set ALONE,
// and it is asserted on a plan with `transitions: []` for the same reason F-10 is.
//
// THE OVER-REFUSAL HALF IS NOT OPTIONAL HERE. This rule can only refuse; a check that refused every plan naming
// any binding would satisfy every negative case below, and would make the reference seed's own shape unproposable.
describe('WP-N11 / L4 — at most one step may name any given runtimeBindingId', () => {
	const bound = (id: string, runtimeBindingId?: string) =>
		step(id, runtimeBindingId === undefined ? {} : { runtimeBindingId });

	it('REFUSES two steps naming ONE binding — on a LINEAR plan (the anti-vacuity case)', () => {
		const r = validateProposedPlan(
			input({ steps: [bound('s1', 'rb_1'), bound('s2', 'rb_1')], transitions: [] })
		);
		expect(r.ok).toBe(false);
		expect(r.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
		// Both steps AND the binding, because an operator repairing this needs to know which three things collide.
		expect(r.message).toContain('"s1"');
		expect(r.message).toContain('"s2"');
		expect(r.message).toContain('rb_1');
	});

	it('names the harm and the reason the harm is PERMANENT, not just the rule', () => {
		// The sibling rules in this file all do; the whole argument for refusing at propose rather than at Start is
		// that the Start-time refusal cannot say anything actionable, so this one must.
		const r = validateProposedPlan(input({ steps: [bound('s1', 'rb_1'), bound('s2', 'rb_1')] }));
		expect(r.message).toContain('exactly one executionStepId');
		expect(r.message).toContain('could ever start');
		expect(r.message, 'the remedy must be one the engine can actually perform').toContain(
			'Give each step its own binding'
		);
	});

	it('catches a collision between NON-ADJACENT steps — it is a set rule, not a neighbour comparison', () => {
		const r = validateProposedPlan(
			input({ steps: [bound('s1', 'rb_1'), bound('s2', 'rb_2'), bound('s3', 'rb_1')] })
		);
		expect(r.ok).toBe(false);
		expect(r.message).toContain('"s1"');
		expect(r.message).toContain('"s3"');
	});

	// ── THE OVER-REFUSAL HALF ────────────────────────────────────────────────────────────────────────────────
	it('ACCEPTS distinct bindings on distinct steps', () => {
		expect(
			validateProposedPlan(input({ steps: [bound('s1', 'rb_1'), bound('s2', 'rb_2')] }))
		).toEqual({ ok: true });
	});

	it('ACCEPTS a plan whose steps name NO binding at all — the reference seed’s own shape', () => {
		// Load-bearing, not merely permissive: the reference seed authors no RuntimeBinding whatsoever, so a rule
		// that treated "no binding" as a shared claim would make every existing plan unproposable. Same disposition
		// as the Start-time limb, where it is stated as OUT OF SCOPE rather than as a fail-open.
		expect(validateProposedPlan(input({ steps: [bound('s1'), bound('s2'), bound('s3')] }))).toEqual({
			ok: true
		});
	});

	it('does not let the EMPTY STRING become a claim two steps can collide on', () => {
		expect(validateProposedPlan(input({ steps: [bound('s1', ''), bound('s2', '')] }))).toEqual({
			ok: true
		});
		expect(validateProposedPlan(input({ steps: [bound('s1', ''), bound('s2')] }))).toEqual({
			ok: true
		});
	});

	it('ACCEPTS one step naming one binding (the ordinary case)', () => {
		expect(validateProposedPlan(input({ steps: [bound('s1', 'rb_1')] }))).toEqual({ ok: true });
	});

	// ── ORDER ────────────────────────────────────────────────────────────────────────────────────────────────
	it('runs AFTER step-id uniqueness, so a duplicate id is reported as a duplicate id', () => {
		// Two steps with the SAME id sharing a binding is not a binding problem — it is F-10, and reporting the
		// binding first would send an operator to fix the wrong thing. L3 owns it.
		const r = validateProposedPlan(input({ steps: [bound('dup', 'rb_1'), bound('dup', 'rb_1')] }));
		expect(r.ok).toBe(false);
		expect(r.message).toContain('declared more than once');
		expect(r.message).not.toContain('exactly one executionStepId');
	});
});
