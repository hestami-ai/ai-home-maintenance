// JAN-EXECREM WP-1 — the DORMANCY half of the contract batch.
//
// WP-1 lands every new payload field the remediation needs in ONE regeneration, ahead of the fixes that use
// them (see the ordering argument in rph-contracts/src/execrem-wp1-fields.test.ts). Optionality is proved there;
// what makes the batch *behaviour-neutral* is the complementary property proved here: **no emitter produces any
// of the new fields yet.** Each is switched on by its own later work package —
//   noOutputResult        -> WP-11 (RPH-EXE-006 + the zero-subject floor gate)
//   selectedTransitionId  -> WP-10 (settlement / "decides once")
//   excludedEdgeId        -> WP-14 (prune provenance, derived)
//   retryReason           -> WP-13 (schema-complete emitted payloads)
// so until each lands, this test is the evidence that adding the contract changed nothing observable.
//
// It is also the tripwire in the other direction: when a later WP starts emitting its field, the matching case
// here goes RED and must be converted into that WP's positive assertion. That is intentional — a dormancy claim
// nobody re-checks is exactly the sort of stale guarantee this program exists to eliminate.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-12T00:00:00Z';
const actor = { actorId: 'u1', actorType: 'HUMAN' as const, displayName: 'A' };
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69GW200';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69GW210';
const PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69GW220';
const S1 = `${PLAN}-s1`;
const S2 = `${PLAN}-s2`;

/**
 * The WP-1 fields still DORMANT. `noOutputResult` has left this list: WP-11 switched it on, so the case below was
 * converted into that WP's positive assertion exactly as the header promises — a dormancy claim that outlived its
 * dormancy would be a stale guarantee, which is the thing this program exists to eliminate.
 */
const WP1_FIELDS = ['selectedTransitionId', 'excludedEdgeId', 'retryReason'] as const;

describe('JAN-EXECREM WP-1 — the new contract fields are DORMANT (no emitter produces them yet)', () => {
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
			correlationId: 'wp1',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	}

	const mkStep = (id: string) => ({
		id,
		executionPlanId: PLAN,
		stepType: 'TRANSFORMATION',
		purpose: 'work',
		inputBindings: [],
		outputBindings: [],
		preconditions: [],
		postconditions: [],
		stepState: 'QUEUED'
	});

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
		expect(
			dispatch(
				'ProposeExecutionPlan',
				{
					executionPlanId: PLAN,
					workUnitId: PWU,
					steps: [mkStep(S1), mkStep(S2)],
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
	});

	it('drives the step lifecycle (start / complete / fail / retry) and emits NO WP-1 field', () => {
		// s1: start -> complete. s2: start -> fail -> retry. Between them these exercise every step event whose
		// payload WP-1 widened except the skip/prune pair, covered below.
		expect(dispatch('StartExecutionStep', { stepId: S1 }, PLAN, 'EXECUTION_PLAN').status).toBe('ACCEPTED');
		expect(
			dispatch(
				'CompleteExecutionStep',
				{
					executionStepId: S1,
					executionAttemptId: `${S1}-a1`,
					resultStatus: 'SUCCEEDED',
					outputArtifactIds: [],
					proposedEvidenceIds: [],
					detectedAssumptionIds: [],
					structuredResult: {},
					noOutputResult: { reason: 'SIDE_EFFECT_ONLY', detail: 'Lifecycle fixture; authors no artifact.' },
					executionProvenance: { executedBy: actor, originType: 'HUMAN_DECISION' }
				},
				PLAN,
				'EXECUTION_PLAN'
			).status
		).toBe('ACCEPTED');
		expect(dispatch('StartExecutionStep', { stepId: S2 }, PLAN, 'EXECUTION_PLAN').status).toBe('ACCEPTED');
		expect(
			dispatch('FailExecutionStep', { stepId: S2, failureReason: 'boom' }, PLAN, 'EXECUTION_PLAN').status
		).toBe('ACCEPTED');
		expect(dispatch('RetryExecutionStep', { stepId: S2 }, PLAN, 'EXECUTION_PLAN').status).toBe('ACCEPTED');

		const stepEvents = store.readAllEvents().filter((e) => e.eventType.startsWith('ExecutionStep'));
		expect(stepEvents.length, 'the lifecycle above must actually have emitted events').toBeGreaterThan(3);

		for (const event of stepEvents)
			for (const field of WP1_FIELDS)
				expect(
					Object.hasOwn(event.payload as object, field),
					`${event.eventType} must not yet carry '${field}' — if the WP that emits it has landed, convert ` +
						`this case into that WP's positive assertion rather than deleting it`
				).toBe(false);
	});

	// CONVERTED, not deleted (WP-11). This case asserted that `noOutputResult` never reached an emitted event. It
	// now asserts the opposite, because WP-11 made the field load-bearing: RPH-EXE-006's explicit-no-output arm is a
	// CALLER ASSERTION, and an assertion the event stream does not carry is one replay cannot distinguish from the
	// silent omission it exists to rule out. Validating it at the door and dropping it would leave §2.6 half-kept.
	it('WP-11 POSITIVE: an asserted noOutputResult is CARRIED onto ExecutionStepSucceeded, verbatim', () => {
		// S1, not S2: `transitions: []` is a LINEAR plan, so a later array-index step cannot start until its
		// predecessor is terminal-success (RPH-EXE-005).
		expect(dispatch('StartExecutionStep', { stepId: S1 }, PLAN, 'EXECUTION_PLAN').status).toBe('ACCEPTED');
		const assertion = { reason: 'SIDE_EFFECT_ONLY', detail: 'Notified the downstream team; produced no artifact.' };
		const r = dispatch(
			'CompleteExecutionStep',
			{
				executionStepId: S1,
				executionAttemptId: `${S1}-a1`,
				resultStatus: 'SUCCEEDED',
				outputArtifactIds: [],
				proposedEvidenceIds: [],
				detectedAssumptionIds: [],
				structuredResult: {},
				noOutputResult: assertion,
				executionProvenance: { executedBy: actor, originType: 'HUMAN_DECISION' }
			},
			PLAN,
			'EXECUTION_PLAN'
		);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		const succeeded = store.readAllEvents().filter((e) => e.eventType === 'ExecutionStepSucceeded');
		expect(succeeded).toHaveLength(1);
		// Both the reason AND the detail: the detail is the record of WHY, which a bare boolean would have lost.
		expect((succeeded[0]!.payload as { noOutputResult?: unknown }).noOutputResult).toEqual(assertion);
	});

	it('a SKIPPED step emits no selectedTransitionId (WP-10 switches it on)', () => {
		const skip = dispatch(
			'SkipExecutionStep',
			{ stepId: S1, mandatory: false },
			PLAN,
			'EXECUTION_PLAN'
		);
		expect(skip.status, JSON.stringify(skip.error)).toBe('ACCEPTED');
		const skipped = store.readAllEvents().filter((e) => e.eventType === 'ExecutionStepSkipped');
		expect(skipped).toHaveLength(1);
		expect(Object.hasOwn(skipped[0]!.payload as object, 'selectedTransitionId')).toBe(false);
	});
});
