// JAN-EXECREM WP-1 — the contract half of the remediation, proved OPTIONAL and DORMANT.
//
// WP-1 batches every vocab change the program needs into ONE regeneration, ahead of the fixes that use them.
// The ordering is not tidiness: `ExecutionStepSucceeded` is the only step event in `RATIFIED_EVENT_PAYLOADS`, so
// the commit path strict-parses it — emitting `selectedTransitionId` before the contract carried it would make
// EVERY BRANCH completion reject at runtime, and the reference seed authors no BRANCH, so the seed would give
// zero signal. Landing the fields first makes that failure mode unreachable.
//
// This file pins the two properties that make the batch safe to land alone:
//   OPTIONAL — every new field is absent-legal, so no existing caller or stored event becomes invalid.
//   DORMANT  — no emitter produces any of them yet. Each is switched on by its own later WP (noOutputResult by
//              WP-11, selectedTransitionId by WP-10, excludedEdgeId by WP-14, retryReason by WP-13), and until
//              then this test is what proves the batch changed no behaviour.
// Plus the one REMOVAL: prune provenance is derived by the gate (F-37), so the command no longer accepts a
// caller-asserted `selectedByBranchStepId`/`selectedEdgeId`.
import { describe, expect, it } from 'vitest';
import {
	CompleteExecutionStepPayloadSchema,
	ExecutionStepPrunedPayloadSchema,
	ExecutionStepRetriedPayloadSchema,
	ExecutionStepSkippedPayloadSchema,
	ExecutionStepSucceededPayloadSchema,
	PruneExecutionStepPayloadSchema
} from './messages.js';
import { NoOutputResultSchema } from './objects.js';

const STEP = 'step_01ARZ3NDEKTSV4RRFFQ69GW100';
const ATTEMPT = 'attempt_01ARZ3NDEKTSV4RRFFQ69GW110';

/** The minimal VALID payload for each carrier, with none of the WP-1 fields present. */
const MINIMAL = {
	CompleteExecutionStep: {
		executionStepId: STEP,
		executionAttemptId: ATTEMPT,
		resultStatus: 'SUCCEEDED',
		outputArtifactIds: [],
		proposedEvidenceIds: [],
		detectedAssumptionIds: [],
		// `structuredResult` is z.unknown() WITHOUT .optional(), so the key must be PRESENT (any value).
		structuredResult: {},
		executionProvenance: {
			executedBy: { actorId: 'u1', actorType: 'HUMAN', displayName: 'A' },
			originType: 'HUMAN_DECISION'
		}
	},
	ExecutionStepSucceeded: {
		executionStepId: STEP,
		executionAttemptId: ATTEMPT,
		outputArtifactIds: [],
		proposedEvidenceIds: [],
		detectedAssumptionIds: [],
		resultingExecutionState: 'SUCCEEDED',
		executionProvenance: {
			executedBy: { actorId: 'u1', actorType: 'HUMAN', displayName: 'A' },
			originType: 'HUMAN_DECISION'
		}
	},
	ExecutionStepSkipped: { stepId: STEP, stepState: 'SKIPPED' },
	ExecutionStepPruned: { stepId: STEP, stepState: 'SKIPPED' },
	ExecutionStepRetried: { stepId: STEP, stepState: 'QUEUED' }
} as const;

describe('JAN-EXECREM WP-1 — the new contract fields are OPTIONAL', () => {
	const cases: ReadonlyArray<[string, { safeParse: (v: unknown) => { success: boolean } }, unknown]> = [
		['CompleteExecutionStep', CompleteExecutionStepPayloadSchema, MINIMAL.CompleteExecutionStep],
		['ExecutionStepSucceeded', ExecutionStepSucceededPayloadSchema, MINIMAL.ExecutionStepSucceeded],
		['ExecutionStepSkipped', ExecutionStepSkippedPayloadSchema, MINIMAL.ExecutionStepSkipped],
		['ExecutionStepPruned', ExecutionStepPrunedPayloadSchema, MINIMAL.ExecutionStepPruned],
		['ExecutionStepRetried', ExecutionStepRetriedPayloadSchema, MINIMAL.ExecutionStepRetried]
	];

	it.each(cases)('%s parses with every WP-1 field ABSENT', (_name, schema, payload) => {
		const r = schema.safeParse(payload);
		expect(r.success, JSON.stringify(r)).toBe(true);
	});

	it('accepts each WP-1 field when PRESENT (so the later WP that emits it cannot be blocked by its own contract)', () => {
		const noOutput = { reason: 'SIDE_EFFECT_ONLY', detail: 'wrote to an external system; nothing to assess' };
		expect(
			CompleteExecutionStepPayloadSchema.safeParse({
				...MINIMAL.CompleteExecutionStep,
				noOutputResult: noOutput
			}).success
		).toBe(true);
		expect(
			ExecutionStepSucceededPayloadSchema.safeParse({
				...MINIMAL.ExecutionStepSucceeded,
				noOutputResult: noOutput,
				selectedTransitionId: 'tr_1'
			}).success
		).toBe(true);
		expect(
			ExecutionStepSkippedPayloadSchema.safeParse({ ...MINIMAL.ExecutionStepSkipped, selectedTransitionId: 'tr_1' })
				.success
		).toBe(true);
		expect(
			ExecutionStepPrunedPayloadSchema.safeParse({ ...MINIMAL.ExecutionStepPruned, excludedEdgeId: 'tr_2' }).success
		).toBe(true);
		expect(
			ExecutionStepRetriedPayloadSchema.safeParse({ ...MINIMAL.ExecutionStepRetried, retryReason: 'transient' })
				.success
		).toBe(true);
	});
});

describe('JAN-EXECREM WP-1 — NoOutputResult is a total, justified assertion', () => {
	it('requires BOTH a closed-set reason and a detail — a bare boolean would record the claim without its justification', () => {
		expect(NoOutputResultSchema.safeParse({ reason: 'SIDE_EFFECT_ONLY', detail: 'x' }).success).toBe(true);
		expect(NoOutputResultSchema.safeParse({ reason: 'SIDE_EFFECT_ONLY' }).success, 'detail is required').toBe(false);
		expect(NoOutputResultSchema.safeParse({ detail: 'x' }).success, 'reason is required').toBe(false);
	});

	it('pins the closed reason set (an off-set reason is refused, so the assertion cannot be free text)', () => {
		for (const reason of [
			'NO_DOWNSTREAM_CONSUMABLE_RESULT',
			'SIDE_EFFECT_ONLY',
			'TIMEOUT',
			'NO_CANDIDATE_OUTPUT'
		])
			expect(NoOutputResultSchema.safeParse({ reason, detail: 'd' }).success, reason).toBe(true);
		expect(NoOutputResultSchema.safeParse({ reason: 'BECAUSE_I_SAID_SO', detail: 'd' }).success).toBe(false);
	});
});

describe('JAN-EXECREM WP-1 — prune provenance is no longer caller-assertable (F-37)', () => {
	it('PruneExecutionStep accepts only the stepId', () => {
		expect(PruneExecutionStepPayloadSchema.safeParse({ stepId: STEP }).success).toBe(true);
	});

	it.each([['selectedByBranchStepId'], ['selectedEdgeId']])(
		'REFUSES a caller-asserted %s — the gate derives which edge excluded the step; a caller cannot assert it',
		(field) => {
			const r = PruneExecutionStepPayloadSchema.safeParse({ stepId: STEP, [field]: 'tr_1' });
			expect(r.success).toBe(false);
		}
	);
});
