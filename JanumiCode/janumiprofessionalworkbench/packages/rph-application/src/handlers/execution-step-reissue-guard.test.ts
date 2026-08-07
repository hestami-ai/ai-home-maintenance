// CMDPRE post-build adversarial review (2026-07-24) — the two unkilled `requireFrom` mutants the mutation-coverage
// lens confirmed on the ExecutionStep step family. Both guards were LIVE and correct but had NO kill test: every
// FailExecutionStep in the suites fails a RUNNING step, and every RetryExecutionStep retries a FAILED step, so
// deleting requireFrom (or widening it to admit the target) left the whole suite green (CON-000 B7 anti-vacuity).
//
// advanceStep (execution.ts:601-608) runs requireFrom BEFORE checkTransition, and checkTransition admits a NOOP —
// so requireFrom is the SOLE guard against a same-state re-issue on the step machine (which declares NO illegal
// self-edge; the only illegal self-edge in the system is Baseline AUTHORITATIVE->AUTHORITATIVE, DWP-07). Without
// these gates a re-issue would append a second, contradicting ExecutionStepFailed / ExecutionStepRetried for a
// transition that did not happen — the exact INV-2/INV-6 harm the JAN-CMDPRE series closes elsewhere.
//
// MUTATION RED-PROOF (performed live, this changeset): widening failExecutionStep.requireFrom to
// ['RUNNING','FAILED'] makes the FailExecutionStep test below RED and leaves the Retry test green; widening
// retryExecutionStep.requireFrom to ['FAILED','QUEUED'] makes the RetryExecutionStep test RED and leaves the Fail
// test green. Each kill test kills exactly its own mutant.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-12T00:00:00Z';
const actor = { actorId: 'u1', actorType: 'HUMAN' as const, displayName: 'A' };
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69G5R00';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5R10';
const PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69G5R20';
const STEP = `${PLAN}-s`;

describe('ExecutionStep re-issue guards — requireFrom kill tests (CMDPRE review remediation)', () => {
	let store: SqliteStorageAdapter;
	let engine: AuthedEngine;
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
			idempotencyKey: `k-${n}`, // distinct each time — a re-issue is a fresh request, not a transport retry
			payload
		};
		return engine.dispatch(command);
	}

	function eventsOfType(t: string) {
		return store.readAllEvents().filter((e) => e.eventType === t);
	}

	function activePlan() {
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
					retryPolicy: { maxAttempts: 3 },
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

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({ authenticate: testAuthenticator(), store, now: () => TS, newEventId: () => `e${++seq}` }).as(TEST_CRED.human);
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
		activePlan();
	});

	it('FailExecutionStep from an already-FAILED step is REFUSED and appends no second ExecutionStepFailed', () => {
		// Legitimate widest path first: a RUNNING step CAN fail.
		expect(dispatch('StartExecutionStep', { stepId: STEP }, PLAN, 'EXECUTION_PLAN').status).toBe(
			'ACCEPTED'
		);
		expect(
			dispatch('FailExecutionStep', { stepId: STEP, failureReason: 'boom' }, PLAN, 'EXECUTION_PLAN')
				.status
		).toBe('ACCEPTED');
		expect(eventsOfType('ExecutionStepFailed')).toHaveLength(1);

		// The kill: re-issue Fail on the now-FAILED step with a DIFFERENT reason. requireFrom['RUNNING'] refuses it;
		// checkTransition would otherwise admit FAILED->FAILED as a NOOP and append a contradicting second event.
		const reFail = dispatch(
			'FailExecutionStep',
			{ stepId: STEP, failureReason: 'a different, contradicting reason' },
			PLAN,
			'EXECUTION_PLAN'
		);
		expect(reFail.status).toBe('REJECTED');
		expect(reFail.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(eventsOfType('ExecutionStepFailed')).toHaveLength(1); // no second append
	});

	it('RetryExecutionStep from an already-QUEUED step (post-retry) is REFUSED and appends no second ExecutionStepRetried', () => {
		// Legitimate path: start -> fail -> retry moves the step FAILED->QUEUED (attemptsMade=1, well under the cap).
		expect(dispatch('StartExecutionStep', { stepId: STEP }, PLAN, 'EXECUTION_PLAN').status).toBe(
			'ACCEPTED'
		);
		expect(
			dispatch('FailExecutionStep', { stepId: STEP, failureReason: 'boom' }, PLAN, 'EXECUTION_PLAN')
				.status
		).toBe('ACCEPTED');
		expect(dispatch('RetryExecutionStep', { stepId: STEP }, PLAN, 'EXECUTION_PLAN').status).toBe(
			'ACCEPTED'
		);
		expect(eventsOfType('ExecutionStepRetried')).toHaveLength(1);

		// The kill: re-issue Retry on the now-QUEUED step. The retry-cap precheck does NOT fire (lastAttemptFailed is
		// false on a QUEUED step, so mustSelectAlternateAction is false), so requireFrom['FAILED'] is the sole guard;
		// checkTransition would otherwise admit QUEUED->QUEUED as a NOOP and append a second re-queue marker.
		const reRetry = dispatch('RetryExecutionStep', { stepId: STEP }, PLAN, 'EXECUTION_PLAN');
		expect(reRetry.status).toBe('REJECTED');
		expect(reRetry.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(eventsOfType('ExecutionStepRetried')).toHaveLength(1); // no second append
	});
});
