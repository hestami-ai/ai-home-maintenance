// JAN-EXECREM WP-7 — condition-grammar hardening + the ONE fail-closed evaluation wrapper (SM-5).
// Closes F-22/F-39 (free-string state), F-41/F-43/F-44 (empty combinator = fail-OPEN), F-32/F-35 (the untested
// comparator), and pins F-46 (STEP_SUCCEEDED vs the gate's terminal-success).
//
// THE THEME. This grammar's every stated default is fail-CLOSED — a malformed expression is false, a missing step
// is false. Three holes let a guard be true, or permanently false, for reasons no author intended.
import { describe, expect, it } from 'vitest';
import { StepStateSchema } from '@janumipwb/rph-contracts';
import {
	ConditionExpressionSchema,
	buildConditionSubject,
	evaluateCondition,
	evaluateGuardExpression,
	type ConditionExpression,
	type ConditionSubject
} from './condition-grammar.js';

const subject = (over: Partial<Record<string, Partial<{ stepState: string; outputArtifactIds: string[]; attemptsMade: number; structuredResult: unknown }>>> = {}): ConditionSubject => ({
	steps: Object.fromEntries(
		Object.entries({ s1: {}, s2: {}, ...over }).map(([id, v]) => [
			id,
			{
				stepState: 'QUEUED',
				outputArtifactIds: [],
				attemptsMade: 0,
				...(v as object)
			}
		])
	)
});

describe('WP-7 / F-22 + F-39 — STEP_STATE.state is the RATIFIED enum, not a free string', () => {
	const withState = (state: string) => ({ op: 'STEP_STATE', stepId: 's1', state });

	it.each(StepStateSchema.options.map((s) => [s]))('accepts the ratified state %s', (state) => {
		expect(ConditionExpressionSchema.safeParse(withState(state)).success).toBe(true);
	});

	// The harm: a typo'd state parsed happily and then compared unequal to every real stepState, so the guard was
	// PERMANENTLY FALSE while looking deliberately authored — a dead arm nothing reported.
	it.each([['SUCEEDED'], ['succeeded'], ['DONE'], ['']])('REFUSES the off-contract state %s', (state) => {
		expect(ConditionExpressionSchema.safeParse(withState(state)).success).toBe(false);
	});
});

describe('WP-7 / F-41 + F-43 + F-44 — an empty combinator is a fail-OPEN guard, now unrepresentable', () => {
	it('REFUSES ALL with no operands (it was vacuously TRUE)', () => {
		expect(ConditionExpressionSchema.safeParse({ op: 'ALL', operands: [] }).success).toBe(false);
	});

	it('REFUSES ANY with no operands (vacuously false, but equally meaningless)', () => {
		expect(ConditionExpressionSchema.safeParse({ op: 'ANY', operands: [] }).success).toBe(false);
	});

	it('still accepts a single-operand combinator', () => {
		const one = { op: 'ALL', operands: [{ op: 'STEP_SUCCEEDED', stepId: 's1' }] };
		expect(ConditionExpressionSchema.safeParse(one).success).toBe(true);
	});

	// The evaluator's own identity for an empty list is pinned SEPARATELY, and labelled unreachable-through-the-
	// schema, so a later `.every` -> `.some` slip cannot pass silently just because the schema now blocks the input.
	it('PIN (unreachable through the schema): evaluateCondition keeps `every`/`some` identities for an empty list', () => {
		const emptyAll = { op: 'ALL', operands: [] } as unknown as ConditionExpression;
		const emptyAny = { op: 'ANY', operands: [] } as unknown as ConditionExpression;
		expect(evaluateCondition(emptyAll, subject()), 'ALL[] is vacuously true — why .min(1) exists').toBe(true);
		expect(evaluateCondition(emptyAny, subject())).toBe(false);
	});
});

describe('WP-7 / F-32 + F-35 — every numeric comparator is exercised, including `<=`', () => {
	const attempts = (cmp: string, value: number) =>
		({ op: 'ATTEMPTS', stepId: 's1', cmp, value }) as unknown as ConditionExpression;
	const subj = subject({ s1: { attemptsMade: 3 } });

	// `<=` had ZERO coverage anywhere in the repo — a mutant rewriting it survived the entire suite.
	it.each([
		['==', 3, true],
		['==', 4, false],
		['>=', 3, true],
		['>=', 4, false],
		['>', 2, true],
		['>', 3, false],
		['<', 4, true],
		['<', 3, false],
		['<=', 3, true],
		['<=', 2, false],
		['<=', 4, true]
	])('attemptsMade=3 %s %d -> %s', (cmp, value, expected) => {
		expect(evaluateCondition(attempts(cmp as string, value as number), subj)).toBe(expected);
	});

	it('the comparator set is exactly the five the evaluator implements', () => {
		for (const cmp of ['==', '>=', '>', '<', '<='])
			expect(
				ConditionExpressionSchema.safeParse({ op: 'ATTEMPTS', stepId: 's1', cmp, value: 1 }).success,
				cmp
			).toBe(true);
		expect(
			ConditionExpressionSchema.safeParse({ op: 'ATTEMPTS', stepId: 's1', cmp: '!=', value: 1 }).success
		).toBe(false);
	});
});

describe('WP-7 / SM-5 — evaluateGuardExpression is fail-closed in all three ways', () => {
	const subj = subject({ s1: { stepState: 'SUCCEEDED' } });

	it('a well-formed, resolvable guard evaluates normally', () => {
		expect(evaluateGuardExpression({ op: 'STEP_SUCCEEDED', stepId: 's1' }, subj)).toBe(true);
		expect(evaluateGuardExpression({ op: 'STEP_SUCCEEDED', stepId: 's2' }, subj)).toBe(false);
	});

	it('an unparseable expression is FALSE (not a throw, not true)', () => {
		expect(evaluateGuardExpression({ op: 'NOT_A_REAL_OP' }, subj)).toBe(false);
		expect(evaluateGuardExpression(undefined, subj)).toBe(false);
		expect(evaluateGuardExpression('a string', subj)).toBe(false);
	});

	// THE FAIL-OPEN THIS CLOSES. A leaf over a missing step is false, but NOT inverts it to TRUE — so a dangling
	// reference could SATISFY a guard. Propose-time rejects dangling refs, but a STORED plan predates that rule and
	// the runtime must not depend on the author having been validated.
	it('a DANGLING step reference makes the WHOLE expression false — NOT cannot invert it to true', () => {
		const notGhost = { op: 'NOT', operand: { op: 'STEP_SUCCEEDED', stepId: 'ghost' } };
		expect(evaluateCondition(notGhost as unknown as ConditionExpression, subj), 'raw evaluator inverts').toBe(
			true
		);
		expect(evaluateGuardExpression(notGhost, subj), 'the wrapper refuses to be satisfied by a ghost').toBe(
			false
		);
	});

	it('a dangling reference ANYWHERE in a combinator poisons the whole guard', () => {
		const mixed = {
			op: 'ANY',
			operands: [{ op: 'STEP_SUCCEEDED', stepId: 's1' }, { op: 'STEP_SUCCEEDED', stepId: 'ghost' }]
		};
		// s1 SUCCEEDED would satisfy ANY on its own; the unresolvable sibling still fails the whole thing closed.
		expect(evaluateGuardExpression(mixed, subj)).toBe(false);
	});
});

describe('WP-7 / F-46 — STEP_SUCCEEDED is deliberately narrower than the gate’s terminal-success', () => {
	it('a SKIPPED step does NOT satisfy STEP_SUCCEEDED (it produced no result to branch on)', () => {
		const skipped = subject({ s1: { stepState: 'SKIPPED' } });
		expect(evaluateGuardExpression({ op: 'STEP_SUCCEEDED', stepId: 's1' }, skipped)).toBe(false);
	});

	it('the author who means “done, however” says so explicitly', () => {
		const skipped = subject({ s1: { stepState: 'SKIPPED' } });
		const doneHowever = {
			op: 'ANY',
			operands: [
				{ op: 'STEP_SUCCEEDED', stepId: 's1' },
				{ op: 'STEP_STATE', stepId: 's1', state: 'SKIPPED' }
			]
		};
		expect(evaluateGuardExpression(doneHowever, skipped)).toBe(true);
	});
});

// JAN-EXECREM WP-10 / KT-5. The branch decision is stamped onto the settling event's payload AFTER the condition
// subject has been folded from that same event. That ordering is safe ONLY while the fold ignores the field — if a
// future fold ever read `selectedTransitionId`, the decision would depend on itself and Rule B1's replay identity
// would become a fixpoint problem rather than a computation. This pins the independence rather than assuming it.
describe('WP-10 / KT-5 — the subject fold IGNORES selectedTransitionId (no decision-depends-on-itself)', () => {
	const base = {
		eventType: 'ExecutionStepSucceeded',
		aggregateId: 'p1',
		payload: { executionStepId: 's1', outputArtifactIds: ['a1'], structuredResult: { outcome: 'PASS' } }
	};

	it('folding with and without the field yields an IDENTICAL subject', () => {
		const steps = [{ id: 's1', stepState: 'SUCCEEDED' }];
		const without = buildConditionSubject(steps, [base], 'p1');
		const withField = buildConditionSubject(
			steps,
			[{ ...base, payload: { ...base.payload, selectedTransitionId: 'p1-t1-2' } }],
			'p1'
		);
		expect(withField).toEqual(without);
	});

	it('and the same holds for the SKIP settling event, which also carries the decision', () => {
		const steps = [{ id: 's1', stepState: 'SKIPPED' }];
		const skipped = { eventType: 'ExecutionStepSkipped', aggregateId: 'p1', payload: { stepId: 's1' } };
		expect(
			buildConditionSubject(
				steps,
				[{ ...skipped, payload: { ...skipped.payload, selectedTransitionId: 'p1-t1-3' } }],
				'p1'
			)
		).toEqual(buildConditionSubject(steps, [skipped], 'p1'));
	});
});

describe('WP-7 — the subject fold is unchanged and still replay-pure', () => {
	it('folds attempts and outputs from this plan’s own events only', () => {
		const s = buildConditionSubject(
			[{ id: 's1', stepState: 'SUCCEEDED' }],
			[
				{ eventType: 'ExecutionStepStarted', aggregateId: 'p1', payload: { stepId: 's1' } },
				{ eventType: 'ExecutionStepStarted', aggregateId: 'OTHER', payload: { stepId: 's1' } },
				{
					eventType: 'ExecutionStepSucceeded',
					aggregateId: 'p1',
					payload: { executionStepId: 's1', outputArtifactIds: ['a1'] }
				}
			],
			'p1'
		);
		expect(s.steps.s1?.attemptsMade, 'the foreign aggregate must not count').toBe(1);
		expect(s.steps.s1?.outputArtifactIds).toEqual(['a1']);
	});
});
