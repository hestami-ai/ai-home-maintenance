// JAN-EXECREM WP-5 — abandoning a FAILED arm is an EXPLICIT, GOVERNED act.
//
// WHY THIS EXISTS. WP-4 made a FAILED in-edge PENDING: FAILED is the only terminal state the machine can leave
// (FAILED -> QUEUED), so a failed arm has NOT settled and a JOIN must not release around it. That is correct, and
// it removed a capability — proceeding past an arm nobody intends to retry. Restoring it by relaxing the barrier
// would simply reinstate F-16, so it is restored the other way: the operator says so, on the record.
//
// Cancelling a failed step records the abandonment AND its reason in the governed stream. The in-edge then reads
// NEUTRALIZED (CANCELLED is irrecoverable — the machine gives it no out-arrow), the join releases if another arm
// delivered, and the abandoned arm's own downstream becomes structurally dead and prunable. Silence is never taken
// as abandonment: an arm left FAILED still wedges its join, which is the point.
//
// THE THREE PLANES had to move together. The machine gained FAILED -> CANCELLED; the handler widened its source
// set; and the read-model's control table — where `FAILED: []` was NOT machine-derived and `Record<StepState, …>`
// totality could not catch it (an empty array is a valid value) — now offers `cancel`. Changing any two of those
// would leave the capability either unreachable from the UI or offered where the engine refuses it.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { controlCommandsFor } from '@janumipwb/rph-projections';
import { Engine } from '../index.js';

const TS = '2026-07-12T00:00:00Z';
const actor = { actorId: 'u1', actorType: 'HUMAN' as const, displayName: 'A' };
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69GY100';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69GY110';
const PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69GY120';
const sid = (i: number) => `${PLAN}-s${i}`;

describe('JAN-EXECREM WP-5 — abandoning a FAILED arm', () => {
	let store: SqliteStorageAdapter;
	let engine: Engine;
	let seq = 0;

	function dispatch(commandType: string, payload: unknown, id = PLAN, aggType = 'EXECUTION_PLAN') {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: aggType,
			targetAggregateId: id,
			issuedAt: TS,
			issuedBy: actor,
			correlationId: 'wp5',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	}

	const stepStateOf = (i: number) => {
		const plan = store.loadObject(PLAN)?.state as { steps: { id: string; stepState: string }[] };
		return plan.steps.find((s) => s.id === sid(i))?.stepState;
	};
	const eventsOfType = (t: string) => store.readAllEvents().filter((e) => e.eventType === t);

	const mkStep = (i: number) => ({
		id: sid(i),
		executionPlanId: PLAN,
		stepType: 'TRANSFORMATION',
		purpose: `work ${i}`,
		inputBindings: [],
		outputBindings: [],
		preconditions: [],
		postconditions: [],
		stepState: 'QUEUED'
	});
	const gedge = (from: number, to: number) => ({
		id: `${PLAN}-t${from}${to}`,
		executionPlanId: PLAN,
		sourceStepId: sid(from),
		targetStepId: sid(to),
		transitionType: 'SEQUENTIAL'
	});

	const start = (i: number) => dispatch('StartExecutionStep', { stepId: sid(i) });
	const fail = (i: number) => dispatch('FailExecutionStep', { stepId: sid(i), failureReason: 'boom' });
	const cancel = (i: number, reason = 'abandoned: the upstream service is retired') =>
		dispatch('CancelExecutionStep', { stepId: sid(i), reason });
	const complete = (i: number) =>
		dispatch('CompleteExecutionStep', {
			executionStepId: sid(i),
			executionAttemptId: `${sid(i)}-a1`,
			resultStatus: 'SUCCEEDED',
			outputArtifactIds: [],
			proposedEvidenceIds: [],
			detectedAssumptionIds: [],
			structuredResult: {},
			// WP-11 / RPH-EXE-006: these diamond arms author no artifact, and now say so explicitly.
			noOutputResult: {
				reason: 'NO_DOWNSTREAM_CONSUMABLE_RESULT',
				detail: 'Diamond fixture: the arm exercises join liveness and authors no artifact.'
			},
			executionProvenance: { executedBy: actor, originType: 'HUMAN_DECISION' }
		});

	/** A diamond: s1 fans out to s2 and s3; both rejoin at s4. */
	function activeDiamond() {
		const r = dispatch('ProposeExecutionPlan', {
			executionPlanId: PLAN,
			workUnitId: PWU,
			steps: [mkStep(1), mkStep(2), mkStep(3), mkStep(4)],
			transitions: [gedge(1, 2), gedge(1, 3), gedge(2, 4), gedge(3, 4)],
			retryPolicy: { maxAttempts: 3 },
			tacticalChangePolicy: {},
			escalationPolicy: {},
			terminationPolicy: {}
		});
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		dispatch('ApproveExecutionPlan', {});
		dispatch('ActivateExecutionPlan', { authorizedRuntimeBindingIds: [] });
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
		activeDiamond();
	});

	it('a FAILED arm WEDGES the join until it is settled (silence is not abandonment)', () => {
		start(1);
		complete(1);
		start(2);
		complete(2);
		start(3);
		expect(fail(3).status).toBe('ACCEPTED');
		const wedged = start(4);
		expect(wedged.status, 'the join must not release around an unsettled failure').toBe('REJECTED');
	});

	it('CANCELLING the failed arm records the abandonment and RELEASES the join', () => {
		start(1);
		complete(1);
		start(2);
		complete(2);
		start(3);
		fail(3);

		const abandoned = cancel(3);
		expect(abandoned.status, JSON.stringify(abandoned.error)).toBe('ACCEPTED');
		expect(stepStateOf(3)).toBe('CANCELLED');

		// The REASON is on the record — that is what makes this an act rather than an omission.
		const cancelled = eventsOfType('ExecutionStepCancelled');
		expect(cancelled).toHaveLength(1);
		expect((cancelled[0]!.payload as { reason?: string }).reason).toContain('abandoned');

		// …and only now does the join release.
		const joined = start(4);
		expect(joined.status, JSON.stringify(joined.error)).toBe('ACCEPTED');
	});

	it('the abandoned arm cannot be retried afterwards (CANCELLED is irrecoverable)', () => {
		start(1);
		complete(1);
		start(3);
		fail(3);
		expect(cancel(3).status).toBe('ACCEPTED');
		const retried = dispatch('RetryExecutionStep', { stepId: sid(3) });
		expect(retried.status, 'the machine gives CANCELLED no out-arrow').toBe('REJECTED');
		expect(stepStateOf(3)).toBe('CANCELLED');
	});

	// A widened source set with NO re-issue test is the exact unkilled-mutant shape this codebase has produced three
	// times (Fail/Retry in the CMDPRE review, and the four in WP-9). Widening Cancel's set therefore ships with one.
	it('a re-issued Cancel on an already-CANCELLED step is REFUSED and appends no second event', () => {
		start(1);
		complete(1);
		start(3);
		fail(3);
		expect(cancel(3).status).toBe('ACCEPTED');
		expect(eventsOfType('ExecutionStepCancelled')).toHaveLength(1);

		const again = cancel(3, 'a different, contradicting reason');
		expect(again.status).toBe('REJECTED');
		expect(again.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(eventsOfType('ExecutionStepCancelled'), 'no second, contradicting abandonment').toHaveLength(1);
	});

	it('every source state in the widened set is still ACCEPTED (the widening did not narrow anything)', () => {
		// QUEUED (fresh), RUNNING (started), and FAILED (the new one) — each cancels from its own arrangement.
		start(1);
		complete(1);
		expect(cancel(2).status, 'QUEUED').toBe('ACCEPTED');
		start(3);
		expect(stepStateOf(3)).toBe('RUNNING');
		expect(cancel(3).status, 'RUNNING').toBe('ACCEPTED');
	});

	it('the READ-MODEL offers cancel on a FAILED step, so the affordance matches the authority (F-11)', () => {
		expect(controlCommandsFor('FAILED')).toContain('cancel');
		// …and still does not offer it where the machine has no arrow.
		expect(controlCommandsFor('NOT_READY')).not.toContain('cancel');
		expect(controlCommandsFor('SUCCEEDED')).toEqual([]);
		expect(controlCommandsFor('CANCELLED')).toEqual([]);
	});
});
