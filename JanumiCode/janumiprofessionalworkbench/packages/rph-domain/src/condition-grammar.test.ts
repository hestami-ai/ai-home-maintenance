import { describe, expect, it } from 'vitest';
import {
	buildConditionSubject,
	conditionStepRefs,
	ConditionExpressionSchema,
	evaluateCondition,
	type ConditionExpression,
	type ConditionSubject
} from './condition-grammar.js';

// JAN-EXECPLAN-DR-004 DWP-02 — the hand-authored, replay-safe condition grammar. The schema parses (a recursive
// discriminated union the contract generator could NOT emit); the evaluator is pure over a projected subject; the
// subject is folded from committed step state + this plan's events.

const subject = (steps: ConditionSubject['steps']): ConditionSubject => ({ steps });
const st = (
	stepState: string,
	extra: Partial<{ outputArtifactIds: string[]; attemptsMade: number; structuredResult: unknown }> = {}
) => ({ stepState, outputArtifactIds: extra.outputArtifactIds ?? [], attemptsMade: extra.attemptsMade ?? 0, ...(extra.structuredResult !== undefined ? { structuredResult: extra.structuredResult } : {}) });

describe('ConditionExpressionSchema — parses the hand-authored recursive union', () => {
	it('accepts a leaf', () => {
		expect(ConditionExpressionSchema.safeParse({ op: 'STEP_SUCCEEDED', stepId: 's1' }).success).toBe(true);
	});
	it('accepts a deeply nested ALL/ANY/NOT (recursion works)', () => {
		const expr = {
			op: 'ALL',
			operands: [
				{ op: 'STEP_SUCCEEDED', stepId: 's1' },
				{ op: 'NOT', operand: { op: 'ANY', operands: [{ op: 'STEP_STATE', stepId: 's2', state: 'FAILED' }] } },
				{ op: 'ATTEMPTS', stepId: 's3', cmp: '<', value: 3 }
			]
		};
		expect(ConditionExpressionSchema.safeParse(expr).success).toBe(true);
	});
	it('REJECTS an unknown op', () => {
		expect(ConditionExpressionSchema.safeParse({ op: 'NONSENSE', stepId: 's1' }).success).toBe(false);
	});
	it('REJECTS a leaf missing a required field', () => {
		expect(ConditionExpressionSchema.safeParse({ op: 'STEP_STATE', stepId: 's1' }).success).toBe(false); // no state
	});
	it('REJECTS an unknown extra field (strict)', () => {
		expect(ConditionExpressionSchema.safeParse({ op: 'STEP_SUCCEEDED', stepId: 's1', extra: 1 }).success).toBe(false);
	});
	it('REJECTS a bad numeric comparator', () => {
		expect(ConditionExpressionSchema.safeParse({ op: 'ATTEMPTS', stepId: 's1', cmp: '!=', value: 1 }).success).toBe(false);
	});
});

describe('evaluateCondition — pure over the subject', () => {
	const subj = subject({
		s1: st('SUCCEEDED', { outputArtifactIds: ['a', 'b'], attemptsMade: 2, structuredResult: { review: { outcome: 'REJECT' }, n: 5 } }),
		s2: st('FAILED', { attemptsMade: 4 }),
		s3: st('QUEUED')
	});
	const ev = (e: ConditionExpression) => evaluateCondition(e, subj);

	it('STEP_STATE / STEP_SUCCEEDED', () => {
		expect(ev({ op: 'STEP_STATE', stepId: 's2', state: 'FAILED' })).toBe(true);
		expect(ev({ op: 'STEP_STATE', stepId: 's2', state: 'SUCCEEDED' })).toBe(false);
		expect(ev({ op: 'STEP_SUCCEEDED', stepId: 's1' })).toBe(true);
		expect(ev({ op: 'STEP_SUCCEEDED', stepId: 's3' })).toBe(false);
	});
	it('OUTPUT_COUNT (numeric comparators)', () => {
		expect(ev({ op: 'OUTPUT_COUNT', stepId: 's1', cmp: '>=', value: 2 })).toBe(true);
		expect(ev({ op: 'OUTPUT_COUNT', stepId: 's1', cmp: '>', value: 2 })).toBe(false);
		expect(ev({ op: 'OUTPUT_COUNT', stepId: 's3', cmp: '==', value: 0 })).toBe(true);
	});
	it('ATTEMPTS (numeric comparators)', () => {
		expect(ev({ op: 'ATTEMPTS', stepId: 's2', cmp: '>=', value: 4 })).toBe(true);
		expect(ev({ op: 'ATTEMPTS', stepId: 's1', cmp: '<', value: 3 })).toBe(true);
	});
	it('RESULT_EQUALS (dot-path over structuredResult)', () => {
		expect(ev({ op: 'RESULT_EQUALS', stepId: 's1', path: 'review.outcome', value: 'REJECT' })).toBe(true);
		expect(ev({ op: 'RESULT_EQUALS', stepId: 's1', path: 'review.outcome', value: 'APPROVE' })).toBe(false);
		expect(ev({ op: 'RESULT_EQUALS', stepId: 's1', path: 'n', value: 5 })).toBe(true);
		expect(ev({ op: 'RESULT_EQUALS', stepId: 's1', path: 'missing.deep', value: 'x' })).toBe(false);
	});
	it('ALL / ANY / NOT', () => {
		expect(ev({ op: 'ALL', operands: [{ op: 'STEP_SUCCEEDED', stepId: 's1' }, { op: 'STEP_STATE', stepId: 's2', state: 'FAILED' }] })).toBe(true);
		expect(ev({ op: 'ALL', operands: [{ op: 'STEP_SUCCEEDED', stepId: 's1' }, { op: 'STEP_SUCCEEDED', stepId: 's3' }] })).toBe(false);
		expect(ev({ op: 'ANY', operands: [{ op: 'STEP_SUCCEEDED', stepId: 's3' }, { op: 'STEP_SUCCEEDED', stepId: 's1' }] })).toBe(true);
		expect(ev({ op: 'NOT', operand: { op: 'STEP_SUCCEEDED', stepId: 's3' } })).toBe(true);
	});
	it('a missing (bad-ref) step is conservatively false', () => {
		expect(ev({ op: 'STEP_SUCCEEDED', stepId: 'nope' })).toBe(false);
	});
});

describe('buildConditionSubject — replay-safe fold from committed state + this plan events', () => {
	const PLAN = 'plan_1';
	it('folds stepState, attemptsMade (Started count), outputArtifactIds + structuredResult (Succeeded)', () => {
		const steps = [{ id: 's1', stepState: 'SUCCEEDED' }, { id: 's2', stepState: 'QUEUED' }];
		const events = [
			{ eventType: 'ExecutionStepStarted', aggregateId: PLAN, payload: { stepId: 's1' } },
			{ eventType: 'ExecutionStepStarted', aggregateId: PLAN, payload: { stepId: 's1' } }, // 2 attempts
			{ eventType: 'ExecutionStepSucceeded', aggregateId: PLAN, payload: { executionStepId: 's1', outputArtifactIds: ['a'], structuredResult: { ok: true } } },
			{ eventType: 'ExecutionStepStarted', aggregateId: 'other_plan', payload: { stepId: 's1' } } // different plan → ignored
		];
		const subj = buildConditionSubject(steps, events, PLAN);
		expect(subj.steps.s1?.stepState).toBe('SUCCEEDED');
		expect(subj.steps.s1?.attemptsMade).toBe(2);
		expect(subj.steps.s1?.outputArtifactIds).toEqual(['a']);
		expect(subj.steps.s1?.structuredResult).toEqual({ ok: true });
		expect(subj.steps.s2?.attemptsMade).toBe(0);
	});
	it('is deterministic — the same events yield the same subject (replay-stable)', () => {
		const steps = [{ id: 's1', stepState: 'RUNNING' }];
		const events = [{ eventType: 'ExecutionStepStarted', aggregateId: PLAN, payload: { stepId: 's1' } }];
		expect(buildConditionSubject(steps, events, PLAN)).toEqual(buildConditionSubject(steps, events, PLAN));
	});
});

describe('conditionStepRefs — every referenced step (for propose-time ref resolution)', () => {
	it('collects refs from nested combinators', () => {
		const expr: ConditionExpression = {
			op: 'ALL',
			operands: [
				{ op: 'STEP_SUCCEEDED', stepId: 's1' },
				{ op: 'NOT', operand: { op: 'STEP_STATE', stepId: 's2', state: 'FAILED' } },
				{ op: 'ANY', operands: [{ op: 'ATTEMPTS', stepId: 's3', cmp: '<', value: 2 }] }
			]
		};
		expect(conditionStepRefs(expr).sort()).toEqual(['s1', 's2', 's3']);
	});
});
