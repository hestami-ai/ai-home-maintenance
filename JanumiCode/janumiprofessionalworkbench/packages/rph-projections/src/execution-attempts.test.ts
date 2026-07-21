import { describe, expect, it } from 'vitest';
import type { DomainEvent } from '@janumipwb/rph-contracts';
import { attemptsByStep, executionAttempts } from './execution-attempts.js';

// JAN-EXECPLAN-DR-002 DWP-03. The pure Execution Attempt fold: attempt_number = count(Started) ALONE (Retried is
// NOT an attempt — §19 L3-3), a deterministic idempotency_key, succeeded-only provenance (§19 L3-8), and the
// AI-no-binding advisory (stepType from the caller, since events don't carry it).

let seq = 0;
const ev = (
	eventType: string,
	aggregateId: string,
	payload: Record<string, unknown>,
	occurredAt = '2026-07-12T00:00:00Z'
): DomainEvent => ({
	eventId: `e${++seq}`,
	eventType,
	eventSchemaVersion: 1,
	aggregateType: 'EXECUTION_PLAN',
	aggregateId,
	aggregateRevision: seq,
	occurredAt,
	recordedAt: occurredAt,
	actor: { actorId: 'u', actorType: 'HUMAN', displayName: 'U' },
	correlationId: 'c',
	payload
});

const PLAN = 'plan_1';
const STEP = 'step_1';

describe('executionAttempts — the §10.4 fold', () => {
	it('a start→succeed step yields ONE attempt (number 1, provenance carried, state SUCCEEDED)', () => {
		const prov = { originType: 'MODEL_GENERATION', executedBy: { actorType: 'AGENT' } };
		const attempts = executionAttempts([
			ev('ExecutionStepStarted', PLAN, { stepId: STEP, runtimeBindingId: 'rb_1', stepState: 'RUNNING' }),
			ev('ExecutionStepSucceeded', PLAN, { executionStepId: STEP, executionProvenance: prov }, '2026-07-12T00:05:00Z')
		]);
		expect(attempts).toHaveLength(1);
		expect(attempts[0]).toMatchObject({
			executionPlanId: PLAN,
			stepId: STEP,
			attemptNumber: 1,
			idempotencyKey: 'step_1#1',
			state: 'SUCCEEDED',
			runtimeBindingId: 'rb_1',
			startedAt: '2026-07-12T00:00:00Z',
			completedAt: '2026-07-12T00:05:00Z'
		});
		expect(attempts[0]?.provenance).toEqual(prov);
	});

	it('start→fail→retry→start→succeed yields TWO attempts — count(Started)=2, NOT 3 (Retried not counted, L3-3)', () => {
		const attempts = executionAttempts([
			ev('ExecutionStepStarted', PLAN, { stepId: STEP }),
			ev('ExecutionStepFailed', PLAN, { stepId: STEP, failureReason: 'boom' }),
			ev('ExecutionStepRetried', PLAN, { stepId: STEP }),
			ev('ExecutionStepStarted', PLAN, { stepId: STEP, runtimeBindingId: 'rb_2' }),
			ev('ExecutionStepSucceeded', PLAN, { executionStepId: STEP })
		]);
		expect(attempts).toHaveLength(2);
		expect(attempts.map((a) => a.attemptNumber)).toEqual([1, 2]);
		// distinct, deterministic keys per attempt
		expect(attempts.map((a) => a.idempotencyKey)).toEqual(['step_1#1', 'step_1#2']);
		expect(attempts[0]).toMatchObject({ state: 'FAILED', error: 'boom' });
		expect(attempts[1]).toMatchObject({ state: 'SUCCEEDED', runtimeBindingId: 'rb_2' });
	});

	it('a FAILED-only attempt carries the error and NO provenance (L3-8)', () => {
		const attempts = executionAttempts([
			ev('ExecutionStepStarted', PLAN, { stepId: STEP }),
			ev('ExecutionStepFailed', PLAN, { stepId: STEP, failureReason: 'model timeout' })
		]);
		expect(attempts[0]).toMatchObject({ state: 'FAILED', error: 'model timeout' });
		expect(attempts[0]?.provenance).toBeUndefined();
	});

	it('the fold is replay-stable — same events fold to identical attempts', () => {
		const events = [
			ev('ExecutionStepStarted', PLAN, { stepId: STEP }),
			ev('ExecutionStepSucceeded', PLAN, { executionStepId: STEP })
		];
		expect(executionAttempts(events)).toEqual(executionAttempts(events));
	});
});

describe('executionAttempts — the AI-no-binding advisory (stepType from the caller)', () => {
	const started = (bindingId?: string) =>
		ev('ExecutionStepStarted', PLAN, {
			stepId: STEP,
			...(bindingId ? { runtimeBindingId: bindingId } : {}),
			stepState: 'RUNNING'
		});

	it('FIRES for an AI step (MODEL_INVOCATION) opened with no runtime_binding_id', () => {
		const attempts = executionAttempts([started()], { [STEP]: 'MODEL_INVOCATION' });
		expect(attempts[0]?.aiNoBinding).toBe(true);
	});

	it('is SILENT for an AI step that DID bind a runtime binding', () => {
		const attempts = executionAttempts([started('rb_1')], { [STEP]: 'MODEL_INVOCATION' });
		expect(attempts[0]?.aiNoBinding).toBe(false);
		expect(attempts[0]?.runtimeBindingId).toBe('rb_1');
	});

	it('is SILENT for a non-AI (TRANSFORMATION/HUMAN) step with no binding (honest absence, not an advisory)', () => {
		const attempts = executionAttempts([started()], { [STEP]: 'TRANSFORMATION' });
		expect(attempts[0]?.aiNoBinding).toBe(false);
	});

	it('is SILENT when no stepType map is supplied (advisory needs the caller’s aggregate)', () => {
		expect(executionAttempts([started()])[0]?.aiNoBinding).toBe(false);
	});
});

describe('attemptsByStep — per-step rollup for the UI', () => {
	it('groups attempts, preserving order, with count + latest state', () => {
		const attempts = executionAttempts([
			ev('ExecutionStepStarted', PLAN, { stepId: STEP }),
			ev('ExecutionStepFailed', PLAN, { stepId: STEP, failureReason: 'x' }),
			ev('ExecutionStepRetried', PLAN, { stepId: STEP }),
			ev('ExecutionStepStarted', PLAN, { stepId: STEP }),
			ev('ExecutionStepSucceeded', PLAN, { executionStepId: STEP })
		]);
		const byStep = attemptsByStep(attempts);
		expect(byStep).toHaveLength(1);
		expect(byStep[0]).toMatchObject({ stepId: STEP, attemptCount: 2, latestState: 'SUCCEEDED' });
	});
});
