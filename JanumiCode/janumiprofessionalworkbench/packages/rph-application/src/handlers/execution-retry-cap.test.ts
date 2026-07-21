// JAN-EXECPLAN-DR-002 DWP-04 — the retry cap RPH-EXE-008, wired to the ready-made retryDecision kernel.
// MAX-TOTAL-ATTEMPTS (1-based): attemptsMade = count(ExecutionStepStarted) (NOT +Retried, §19 L3-3). At
// maxAttempts=3, EXACTLY 2 retries proceed (opening attempts 2,3); the retry at attemptsMade=3 is REFUSED with the
// permitted control actions (§19 L3-4). maxAttempts is read as a convention on the Source-TBD RetryPolicy, with the
// default 3 for absent/degenerate values (§19 L3-6).
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-12T00:00:00Z';
const actor = { actorId: 'u1', actorType: 'HUMAN' as const, displayName: 'A' };
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69G5M00';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5M10';
const PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69G5M20';
const STEP = `${PLAN}-s`;

describe('RetryExecutionStep — RPH-EXE-008 cap (DWP-04)', () => {
	let store: SqliteStorageAdapter;
	let engine: Engine;
	let seq = 0;

	function dispatch(commandType: string, payload: unknown, id: string, aggType: string) {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: aggType,
			targetAggregateId: id,
			issuedAt: TS,
			issuedBy: actor,
			correlationId: 'corr',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	}

	function activePlan(retryPolicy: Record<string, unknown>) {
		expect(
			dispatch(
				'ProposeExecutionPlan',
				{
					executionPlanId: PLAN,
					workUnitId: PWU,
					steps: [
						{
							id: STEP,
							executionPlanId: PLAN,
							stepType: 'TRANSFORMATION',
							purpose: 'work',
							inputBindings: [],
							outputBindings: [],
							preconditions: [],
							postconditions: [],
							stepState: 'QUEUED'
						}
					],
					transitions: [],
					retryPolicy,
					tacticalChangePolicy: {},
					escalationPolicy: {},
					terminationPolicy: {}
				},
				PLAN,
				'EXECUTION_PLAN'
			).status
		).toBe('ACCEPTED');
		dispatch('ApproveExecutionPlan', {}, PLAN, 'EXECUTION_PLAN');
		dispatch('ActivateExecutionPlan', { authorizedRuntimeBindingIds: [] }, PLAN, 'EXECUTION_PLAN');
	}

	/** One attempt cycle: start (QUEUED→RUNNING) + fail (RUNNING→FAILED) + retry (FAILED→QUEUED) — returns the
	 *  retry result. Start increments the ExecutionStepStarted count that the cap reads. */
	function attemptThenRetry() {
		expect(dispatch('StartExecutionStep', { stepId: STEP }, PLAN, 'EXECUTION_PLAN').status).toBe(
			'ACCEPTED'
		);
		expect(
			dispatch('FailExecutionStep', { stepId: STEP, failureReason: 'boom' }, PLAN, 'EXECUTION_PLAN')
				.status
		).toBe('ACCEPTED');
		return dispatch('RetryExecutionStep', { stepId: STEP }, PLAN, 'EXECUTION_PLAN');
	}

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({ store, now: () => TS, newEventId: () => `e${++seq}` });
		dispatch(
			'CaptureIntent',
			{ intentId: INTENT, originatingExpression: 'x', ontologyId: 'o', ontologyVersion: '1' },
			INTENT,
			'INTENT'
		);
		dispatch(
			'ProposePwu',
			{
				pwuId: PWU,
				pwuKind: 'ARCHITECTURE',
				title: 'Arch',
				description: 'd',
				intentId: INTENT,
				boundaries: { inScope: [], outOfScope: [], permittedChanges: [], prohibitedChanges: [] },
				obligationIds: [],
				constraintIds: [],
				assumptionIds: [],
				expectedOutputs: [],
				assurancePolicyIds: [],
				riskProfile: {
					consequence: 'MEDIUM',
					uncertainty: 'MEDIUM',
					irreversibility: 'LOW',
					securitySensitivity: 'LOW',
					regulatoryExposure: 'NONE'
				}
			},
			PWU,
			'PROFESSIONAL_WORK_UNIT'
		);
	});

	it('@maxAttempts=3: exactly TWO retries proceed, the THIRD is refused (MAX-TOTAL-ATTEMPTS, L3-4)', () => {
		activePlan({ maxAttempts: 3 });
		expect(attemptThenRetry().status, 'retry 1 (attemptsMade=1)').toBe('ACCEPTED');
		expect(attemptThenRetry().status, 'retry 2 (attemptsMade=2)').toBe('ACCEPTED');
		const r3 = attemptThenRetry(); // attemptsMade=3 → 3<3 false → exhausted
		expect(r3.status, 'retry 3 must be refused').toBe('REJECTED');
		expect(r3.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(r3.error?.message).toContain('RPH-EXE-008');
		expect(r3.error?.message).toContain('CHANGE_TACTIC'); // the exhaustion control actions, verbatim
		expect(r3.error?.message).toContain('ABANDON');
	});

	it('@maxAttempts=1: the FIRST retry is refused (zero-retry floor, L3-6)', () => {
		activePlan({ maxAttempts: 1 });
		const r1 = attemptThenRetry(); // attemptsMade=1 → 1<1 false → exhausted immediately
		expect(r1.status).toBe('REJECTED');
		expect(r1.error?.code).toBe('RPH_INVARIANT_VIOLATION');
	});

	it('absent maxAttempts → the DEFAULT 3 (2 retries proceed, not all-refused)', () => {
		activePlan({}); // no maxAttempts key
		expect(attemptThenRetry().status).toBe('ACCEPTED');
		expect(attemptThenRetry().status).toBe('ACCEPTED');
		expect(attemptThenRetry().status).toBe('REJECTED');
	});

	it('degenerate maxAttempts=0 → the DEFAULT 3, never forbid-all (L3-6)', () => {
		// maxAttempts=0 is invalid (a step ran, so ≥1 attempt is always possible); it must coerce to the default,
		// not to a cap that forbids the first retry. (NaN/negative/non-integer take the same coercion path.)
		activePlan({ maxAttempts: 0 });
		expect(attemptThenRetry().status, 'maxAttempts=0 must coerce to the default, not forbid all').toBe(
			'ACCEPTED'
		);
	});
});
