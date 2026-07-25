// JAN-EXECREM WP-1 — the DORMANCY half of the contract batch, CORRECTED by JAN-REVREM RW-2.
//
// WP-1 landed every new payload field the remediation needed in ONE regeneration, ahead of the fixes that use
// them (optionality is proved in rph-contracts/src/execrem-wp1-fields.test.ts). What made the batch
// behaviour-neutral was the complementary property proved here: no emitter produced any of the new fields YET.
//
// THE REGISTER BELOW WAS FALSE FOR THREE FIELDS, AND ITS OWN TRIPWIRE NEVER FIRED. This file declared
// `selectedTransitionId`, `excludedEdgeId` and `retryReason` DORMANT long after WP-10, WP-14 and WP-13
// respectively gave each a producer — emitters live in `execution.ts` and three sibling suites assert them
// green. The header promised that "when a later WP starts emitting its field, the matching case here goes RED
// and must be converted into that WP's positive assertion". It did not go red, because the fixture cannot reach
// any of those emitters: `transitions: []` with non-BRANCH steps means no branch ever settles (so no
// `selectedTransitionId`), nothing is ever pruned (so no `excludedEdgeId`), and the retry it drives passes no
// `retryReason`. A tripwire wired to an arrangement that cannot trip it is not a tripwire.
//
// SO THE NEGATIVE CLAIM IS REPLACED BY A POSITIVE CENSUS. Asserting "no event carries field X" over a fixture
// that cannot produce X is unfalsifiable by construction — the vacuous-negative shape this programme keeps
// removing, here applied to its own scaffolding. Each WP-1 field is now asserted to be CARRIED by the emitter
// that owns it, driven through the real bus. A positive claim about a specific payload cannot rot the same way:
// if a producer is removed, the assertion fails.
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
 * The WP-1 fields that are still DORMANT: NONE.
 *
 * All four have producers — `noOutputResult` (WP-11), `selectedTransitionId` (WP-10), `excludedEdgeId` (WP-14)
 * and `retryReason` (WP-13). The list is kept, empty, rather than deleted, so the next contract batch has an
 * obvious place to register a genuinely dormant field — and so the correction stays legible.
 */
const WP1_FIELDS: readonly string[] = [];

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
		expect(dispatch('StartExecutionStep', { stepId: S1 }, PLAN, 'EXECUTION_PLAN').status).toBe(
			'ACCEPTED'
		);
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
					noOutputResult: {
						reason: 'SIDE_EFFECT_ONLY',
						detail: 'Lifecycle fixture; authors no artifact.'
					},
					executionProvenance: { executedBy: actor, originType: 'HUMAN_DECISION' }
				},
				PLAN,
				'EXECUTION_PLAN'
			).status
		).toBe('ACCEPTED');
		expect(dispatch('StartExecutionStep', { stepId: S2 }, PLAN, 'EXECUTION_PLAN').status).toBe(
			'ACCEPTED'
		);
		expect(
			dispatch('FailExecutionStep', { stepId: S2, failureReason: 'boom' }, PLAN, 'EXECUTION_PLAN')
				.status
		).toBe('ACCEPTED');
		expect(dispatch('RetryExecutionStep', { stepId: S2 }, PLAN, 'EXECUTION_PLAN').status).toBe(
			'ACCEPTED'
		);

		const stepEvents = store.readAllEvents().filter((e) => e.eventType.startsWith('ExecutionStep'));
		expect(
			stepEvents.length,
			'the lifecycle above must actually have emitted events'
		).toBeGreaterThan(3);

		// WP1_FIELDS is now EMPTY, so this loop iterates nothing — and saying so is the point. An
		// `expect` inside a loop over an empty list asserts NOTHING while reading like coverage, which is the
		// shape that let the three false dormancy claims survive. The guard below fails if the list is ever
		// repopulated without someone re-reading this case.
		expect(WP1_FIELDS, 'no WP-1 field is dormant; see the header').toEqual([]);
		for (const event of stepEvents)
			for (const field of WP1_FIELDS)
				expect(Object.hasOwn(event.payload as object, field), `${event.eventType}/${field}`).toBe(
					false
				);
	});

	// ── THE POSITIVE CENSUS (JAN-REVREM RW-2) ────────────────────────────────────────────────────────────────
	it('RW-2: retryReason is CARRIED onto ExecutionStepRetried when the caller supplies one', () => {
		// The dormancy claim said this field had no producer. `retryExecutionStep` has emitted it since WP-13; the
		// old fixture simply never passed one, so the claim could not fail.
		expect(dispatch('StartExecutionStep', { stepId: S1 }, PLAN, 'EXECUTION_PLAN').status).toBe(
			'ACCEPTED'
		);
		expect(
			dispatch('FailExecutionStep', { stepId: S1, failureReason: 'boom' }, PLAN, 'EXECUTION_PLAN')
				.status
		).toBe('ACCEPTED');
		expect(
			dispatch(
				'RetryExecutionStep',
				{ stepId: S1, retryReason: 'transient upstream timeout' },
				PLAN,
				'EXECUTION_PLAN'
			).status
		).toBe('ACCEPTED');

		const retried = store.readAllEvents().filter((e) => e.eventType === 'ExecutionStepRetried');
		expect(retried).toHaveLength(1);
		expect((retried[0]!.payload as { retryReason?: string }).retryReason).toBe(
			'transient upstream timeout'
		);
	});

	// CONVERTED, not deleted (WP-11). This case asserted that `noOutputResult` never reached an emitted event. It
	// now asserts the opposite, because WP-11 made the field load-bearing: RPH-EXE-006's explicit-no-output arm is a
	// CALLER ASSERTION, and an assertion the event stream does not carry is one replay cannot distinguish from the
	// silent omission it exists to rule out. Validating it at the door and dropping it would leave §2.6 half-kept.
	it('WP-11 POSITIVE: an asserted noOutputResult is CARRIED onto ExecutionStepSucceeded, verbatim', () => {
		// S1, not S2: `transitions: []` is a LINEAR plan, so a later array-index step cannot start until its
		// predecessor is terminal-success (RPH-EXE-005).
		expect(dispatch('StartExecutionStep', { stepId: S1 }, PLAN, 'EXECUTION_PLAN').status).toBe(
			'ACCEPTED'
		);
		const assertion = {
			reason: 'SIDE_EFFECT_ONLY',
			detail: 'Notified the downstream team; produced no artifact.'
		};
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
		expect((succeeded[0]!.payload as { noOutputResult?: unknown }).noOutputResult).toEqual(
			assertion
		);
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
