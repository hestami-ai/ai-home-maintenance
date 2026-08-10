// JAN-EXECREM WP-13 / F-25 — every emitted ExecutionStep* payload conforms to its OWN declared schema.
//
// THE DEFECT. `advanceStep` emitted `args.eventPayload !== undefined ? args.eventPayload : command.payload`, and
// two handlers supplied no `eventPayload` at all — so `ExecutionStepFailed` and `ExecutionStepRetried` emitted the
// raw COMMAND payload. Both declared shapes require `stepState`; neither command payload carries it, and Retry's
// command additionally carried `retryReason`, which the strictObject did not then declare. So both events failed
// their own schemas, on two counts for Retried.
//
// WHY NOTHING CAUGHT IT. Neither event is in `RATIFIED_EVENT_PAYLOADS`, so the runtime (d2) gate never validated
// them — and the gate's registry is derived from vocab PROVENANCE, not from convenience. Consequence for replay:
// FAILED and the post-retry QUEUED were the ONLY two step states in the whole machine a log-driven fold could not
// observe, and they are exactly the two RPH-EXE-008's retry cap governs. A rebuilt aggregate showed a clean run of
// attempts with no failures and no retries.
//
// A DELIBERATE DIVERGENCE FROM THE SUGGESTED FIX, recorded rather than taken silently. The finding proposed
// "register both event types in RATIFIED_EVENT_PAYLOADS". That registry is DERIVED from vocab provenance — an
// event is in it iff its `sourceSection` is present and not UNRATIFIED-AUTHORED — and both events are annotated
// UNRATIFIED-AUTHORED because DOC-007 schematizes no interface for them. Registering them would have meant
// FALSIFYING a provenance annotation to buy gate coverage, which is exactly the kind of trade this programme
// exists to refuse. Instead: (1) the payloads are made conformant, (2) `eventPayload` is now REQUIRED on
// `advanceStep` so the implicit command-payload fallback cannot recur for ANY handler, and (3) this sweep
// validates every emitted step payload against its DECLARED schema regardless of ratified status — which is
// strictly stronger than the (d2) gate and does not depend on provenance at all.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { EVENTS } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-12T00:00:00Z';
const actor: ActorReference = { actorId: 'u1', actorType: 'HUMAN', displayName: 'A' };
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69H5100';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69H5110';
const PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69H5120';
const sid = (i: number) => `${PLAN}-s${i}`;

const SAYS_NOTHING = {
	reason: 'NO_DOWNSTREAM_CONSUMABLE_RESULT' as const,
	detail: 'A coordination step; it authors no artifact.'
};

describe('JAN-EXECREM WP-13 / F-25 — emitted step payloads conform to their declared shapes', () => {
	let store: SqliteStorageAdapter;
	let engine: AuthedEngine;
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
			correlationId: 'wp13',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	}
	const ok = (r: { status: string; error?: { message?: string } }, what: string) => {
		expect(r.status, `${what}: ${r.error?.message}`).toBe('ACCEPTED');
		return r;
	};

	const mkStep = (i: number) => ({
		id: sid(i),
		executionPlanId: PLAN,
		stepType: 'TRANSFORMATION',
		purpose: `work ${i}`,
		inputBindings: [],
		outputBindings: [],
		preconditions: [],
		postconditions: [],
		stepState: 'QUEUED',
		// §21.1 IS NOT ON TRIAL IN THIS FILE (REG-F-105, ruled REG-D-041). Skipping used to be granted by
		// `mandatory: false` inside the SKIP PAYLOAD — the skipper's own word. That field is gone, so the PLAN now
		// declares what the request used to assert. Marking these steps ADVISORY isolates emitted payload conformance
		// exactly as the boolean did, with the difference that a declaration is a fact of the approved plan.
		strength: 'ADVISORY'
	});

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
		ok(
			dispatch('ProposeExecutionPlan', {
				executionPlanId: PLAN,
				workUnitId: PWU,
				steps: [mkStep(1), mkStep(2), mkStep(3), mkStep(4)],
				transitions: [],
				retryPolicy: { maxAttempts: 5 },
				tacticalChangePolicy: {},
				escalationPolicy: {},
				terminationPolicy: {}
			}),
			'propose'
		);
		ok(dispatch('ApproveExecutionPlan', {}), 'approve');
		ok(dispatch('ActivateExecutionPlan', { authorizedRuntimeBindingIds: [] }), 'activate');
	});

	/**
	 * Drive EVERY step event type this surface can produce, on one plan.
	 *
	 * THE SWEEP THAT EXISTED WAS VACUOUS FOR TEN OF ELEVEN TYPES because it ran only over the reference stream —
	 * which never fails, retries, skips, prunes, cancels, waits or branches. "Every emitted event conforms" was
	 * true and meaningless. This drive is the second stream, and the denominator below is PINNED so a future
	 * change that stops producing one of these types fails here rather than quietly shrinking the sweep.
	 */
	function driveEveryStepEvent(): void {
		// s1: start -> wait -> resolve -> fail -> retry -> start -> succeed  (Started x2, Waiting, WaitResolved,
		// Failed, Retried, Succeeded)
		ok(dispatch('StartExecutionStep', { stepId: sid(1) }), 'start s1');
		ok(dispatch('EnterExecutionStepWait', { stepId: sid(1), waitReason: 'awaiting input' }), 'wait');
		ok(dispatch('ResolveExecutionStepWait', { stepId: sid(1), resolution: 'input arrived' }), 'resolve');
		ok(dispatch('FailExecutionStep', { stepId: sid(1), failureReason: 'boom', failureClass: 'TIMEOUT' }), 'fail');
		ok(dispatch('RetryExecutionStep', { stepId: sid(1), retryReason: 'transient, worth another go' }), 'retry');
		ok(dispatch('StartExecutionStep', { stepId: sid(1) }), 'restart s1');
		ok(
			dispatch('CompleteExecutionStep', {
				executionStepId: sid(1),
				executionAttemptId: `${sid(1)}-a2`,
				resultStatus: 'SUCCEEDED',
				outputArtifactIds: [],
				proposedEvidenceIds: [],
				detectedAssumptionIds: [],
				structuredResult: {},
				noOutputResult: SAYS_NOTHING,
				executionProvenance: { executedBy: actor, originType: 'HUMAN_DECISION' }
			}),
			'complete s1'
		);
		// s2: skipped. s3: started then cancelled.
		ok(dispatch('SkipExecutionStep', { stepId: sid(2) }), 'skip s2');
		ok(dispatch('StartExecutionStep', { stepId: sid(3) }), 'start s3');
		ok(dispatch('CancelExecutionStep', { stepId: sid(3), reason: 'operator aborted' }), 'cancel s3');
	}

	it('THE KILL TEST: every emitted ExecutionStep* payload parses against its OWN declared schema', () => {
		driveEveryStepEvent();
		const stepEvents = store.readAllEvents().filter((e) => e.eventType.startsWith('ExecutionStep'));
		const failures: string[] = [];
		for (const event of stepEvents) {
			const schema = (EVENTS as Record<string, { payload?: { safeParse(v: unknown): { success: boolean; error?: unknown } } }>)[
				event.eventType
			]?.payload;
			expect(schema, `${event.eventType} has no declared payload schema`).toBeDefined();
			const parsed = schema!.safeParse(event.payload);
			if (!parsed.success)
				failures.push(`${event.eventType}: ${JSON.stringify(event.payload)} -> ${JSON.stringify(parsed.error)}`);
		}
		// Before WP-13: ExecutionStepFailed failed on a missing required `stepState`, and ExecutionStepRetried on
		// BOTH a missing `stepState` and an unrecognized `retryReason`.
		expect(failures).toEqual([]);
	});

	it('THE DENOMINATOR IS PINNED — the sweep above cannot silently shrink', () => {
		// The shipped conformance sweep ran over the reference stream and validated whatever happened to appear,
		// asserting nothing about WHICH types it had seen. That is why it was green while two event types were
		// non-conformant: it had never observed either. A sweep with no denominator proves only that the events it
		// did not check were not checked.
		driveEveryStepEvent();
		const observed = new Set(
			store.readAllEvents().filter((e) => e.eventType.startsWith('ExecutionStep')).map((e) => e.eventType)
		);
		expect([...observed].sort()).toEqual([
			'ExecutionStepCancelled',
			'ExecutionStepFailed',
			'ExecutionStepRetried',
			'ExecutionStepSkipped',
			'ExecutionStepStarted',
			'ExecutionStepSucceeded',
			'ExecutionStepWaitResolved',
			'ExecutionStepWaiting'
		]);
	});

	it('ExecutionStepFailed carries the RESULTING state and its failure detail, not the command shape', () => {
		driveEveryStepEvent();
		const failed = store.readAllEvents().find((e) => e.eventType === 'ExecutionStepFailed')!;
		expect(failed.payload).toEqual({
			stepId: sid(1),
			failureReason: 'boom',
			failureClass: 'TIMEOUT',
			stepState: 'FAILED'
		});
	});

	it('ExecutionStepRetried carries the RESULTING QUEUED state, and its retryReason is now DECLARED', () => {
		driveEveryStepEvent();
		const retried = store.readAllEvents().find((e) => e.eventType === 'ExecutionStepRetried')!;
		expect(retried.payload).toEqual({
			stepId: sid(1),
			retryReason: 'transient, worth another go',
			stepState: 'QUEUED'
		});
	});

	it('the retry cycle is now VISIBLE to a log-driven fold — FAILED and the post-retry QUEUED both appear', () => {
		// The consequence that made this MAJOR rather than cosmetic: these were the only two step states in the
		// machine a replay could not observe, and they are the two the retry cap governs.
		driveEveryStepEvent();
		const states = store
			.readAllEvents()
			.filter((e) => e.eventType.startsWith('ExecutionStep'))
			.map((e) => (e.payload as { stepState?: string }).stepState)
			.filter((s): s is string => s !== undefined);
		expect(states).toContain('FAILED');
		expect(states).toContain('QUEUED');
	});
});
