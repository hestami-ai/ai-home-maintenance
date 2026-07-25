// JAN-EXECREM WP-11 — F-01 limb A: RPH-EXE-006 becomes ENFORCED rather than tautological.
//
// WHAT WAS WRONG. `completeExecutionStep` computed `hasOutput` and then passed `explicitNoOutput: !hasOutput`, so
// the kernel evaluated `hasOutput || !hasOutput` — provably always true. A ratified conformance invariant
// (m12-conformance.json: "when completion is requested without output or explicit no-output result / then
// completion is rejected") was enforced NOWHERE in the running engine, and its reject was dead code: deleting it
// changed no test. That is worse than an unkilled mutant (CON-000 B7) — a mutant at least has a live branch.
//
// WHY IT COULD NOT BE FIXED IN THE HANDLER. The kernel was right all along; the CALLER had one fact and needed two,
// because `CompleteExecutionStepPayload` carried no field for the second. §2.6 requires state to be explicit and
// never inferred from absent output, and the wire made that distinction unrepresentable. WP-1 added
// `noOutputResult`; this file is where it starts refusing things.
//
// FIXTURE PINNING IS LOAD-BEARING, NOT INCIDENTAL. Every step here is a NON-AI TRANSFORMATION with HUMAN provenance,
// a HUMAN issuer, and an EMPTY `structuredResult`, so `aiProduced` is false on every signal and the zero-subject
// floor rule (limb B) cannot fire. Reuse the AI fixture instead and limb B refuses these inputs too — the declared
// mutation "restore `explicitNoOutput: !hasOutput`" would then survive GREEN, with the two limbs masking each other
// and neither actually killed. The mirror-image pinning is in execution-floor-zero-subject.test.ts.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-12T00:00:00Z';
const HUMAN = { actorId: 'u1', actorType: 'HUMAN' as const, displayName: 'Operator' };
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69GX100';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69GX110';
const PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69GX120';
const EVD = 'evd_01ARZ3NDEKTSV4RRFFQ69GX130';
const S1 = `${PLAN}-s1`;
/** A second step, authored WITH outputBindings — the corroboration limb's fixture. */
const S2 = `${PLAN}-s2`;

const SAYS_NOTHING = {
	reason: 'NO_DOWNSTREAM_CONSUMABLE_RESULT' as const,
	detail: 'A coordination step: it moved the work forward and authored no artifact.'
};

describe('JAN-EXECREM WP-11 / F-01 limb A — RPH-EXE-006 is a real decision', () => {
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
			issuedBy: HUMAN, // HUMAN issuer: signal 2 of stepOutputIsAiProduced stays false
			correlationId: 'wp11a',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	}

	const planOf = () => store.loadObject(PLAN)!;
	const stepStateOf = (id: string) =>
		(planOf().state as { steps: { id: string; stepState: string }[] }).steps.find((s) => s.id === id)
			?.stepState;
	const succeededEvents = () =>
		store.readAllEvents().filter((e) => e.eventType === 'ExecutionStepSucceeded');

	/** A completion payload. NON-AI on every axis, empty structuredResult — see the fixture-pinning note above. */
	const completion = (over: Record<string, unknown> = {}, stepId = S1) => ({
		executionStepId: stepId,
		executionAttemptId: `${stepId}-a1`,
		resultStatus: 'SUCCEEDED',
		outputArtifactIds: [],
		proposedEvidenceIds: [],
		detectedAssumptionIds: [],
		structuredResult: {},
		executionProvenance: { executedBy: HUMAN, originType: 'HUMAN_DECISION' },
		...over
	});

	const mkStep = (id: string, outputBindings: unknown[] = []) => ({
		id,
		executionPlanId: PLAN,
		stepType: 'TRANSFORMATION',
		purpose: 'do the work',
		inputBindings: [],
		outputBindings,
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
			dispatch('ProposeExecutionPlan', {
				executionPlanId: PLAN,
				workUnitId: PWU,
				// S2 DECLARES an output binding: its own authored plan says it produces something.
				steps: [mkStep(S1), mkStep(S2, [{ bindingKind: 'ARTIFACT', name: 'the report' }])],
				transitions: [],
				retryPolicy: { maxAttempts: 3 },
				tacticalChangePolicy: {},
				escalationPolicy: {},
				terminationPolicy: {}
			}).status
		).toBe('ACCEPTED');
		dispatch('ApproveExecutionPlan', {});
		dispatch('ActivateExecutionPlan', { authorizedRuntimeBindingIds: [] });
		expect(dispatch('StartExecutionStep', { stepId: S1 }).status).toBe('ACCEPTED');
	});

	/**
	 * Reach S2. `transitions: []` is a LINEAR plan, so S2 cannot start until S1 is terminal-success (RPH-EXE-005) —
	 * and S1 is left RUNNING by `beforeEach`. Completing it through the rule under test rather than seeding past it
	 * keeps the corroboration cases honest: they run on a plan the engine itself sequenced.
	 */
	function reachS2(): void {
		expect(
			dispatch('CompleteExecutionStep', completion({ noOutputResult: SAYS_NOTHING })).status
		).toBe('ACCEPTED');
		expect(dispatch('StartExecutionStep', { stepId: S2 }).status).toBe('ACCEPTED');
	}

	// ── the four cells ──────────────────────────────────────────────────────────────────────────────────────────

	// THE KILL TEST. This exact input is ACCEPTED before WP-11 — reproduced live by two independent verifiers, and
	// the register recorded the observed result as `ACCEPTED | undefined | state=SUCCEEDED`.
	it('MISSING: a completion naming nothing and asserting nothing is REFUSED, and moves nothing', () => {
		const before = { revision: planOf().revision, events: store.readAllEvents().length };
		const r = dispatch('CompleteExecutionStep', completion());
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		// The kernel's own code rides in the message, so a caller (and this test) can tell the four cells apart.
		expect(r.error?.message).toContain('RPH_STEP_RESULT_MISSING');
		expect(stepStateOf(S1), 'the step must stay RUNNING').toBe('RUNNING');
		expect(succeededEvents(), 'no ExecutionStepSucceeded may be appended').toHaveLength(0);
		expect(store.readAllEvents().length).toBe(before.events);
		expect(planOf().revision, 'no silent revision bump').toBe(before.revision);
	});

	it('ASSERTED: the same completion, saying so, is ACCEPTED — and the assertion is REPLAYABLE', () => {
		const r = dispatch('CompleteExecutionStep', completion({ noOutputResult: SAYS_NOTHING }));
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(stepStateOf(S1)).toBe('SUCCEEDED');
		const events = succeededEvents();
		expect(events).toHaveLength(1);
		// Validated at the door AND carried onto the event: an assertion the stream drops is one replay cannot
		// distinguish from the silent omission the rule exists to rule out.
		expect((events[0]!.payload as { noOutputResult?: unknown }).noOutputResult).toEqual(SAYS_NOTHING);
	});

	it('NAMED OUTPUT: a completion naming a recorded result needs no assertion (the seed shape)', () => {
		expect(
			dispatch(
				'ProposeEvidence',
				{
					evidenceId: EVD,
					evidenceType: 'TEST_RESULT',
					contentReference: { artifactId: 'art-x', contentHash: 'sha256:x' },
					producedBy: HUMAN,
					supportsClaimIds: [],
					contradictsClaimIds: [],
					scope: 'the step output',
					limitations: [],
					capturedAt: TS
				},
				EVD,
				'EVIDENCE'
			).status
		).toBe('ACCEPTED');
		const r = dispatch('CompleteExecutionStep', completion({ proposedEvidenceIds: [EVD] }));
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(stepStateOf(S1)).toBe('SUCCEEDED');
	});

	it('CONTRADICTORY: naming a result AND asserting no-output is REFUSED', () => {
		// The fourth cell — UNREPRESENTABLE while the caller derived `explicitNoOutput` from `hasOutput`, since the
		// derivation made the two arguments incapable of disagreeing.
		const r = dispatch(
			'CompleteExecutionStep',
			completion({ proposedEvidenceIds: [EVD], noOutputResult: SAYS_NOTHING })
		);
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
		expect(r.error?.message).toContain('RPH_STEP_RESULT_CONTRADICTORY');
		expect(stepStateOf(S1)).toBe('RUNNING');
	});

	// ── the reason split ────────────────────────────────────────────────────────────────────────────────────────

	it.each([['TIMEOUT'], ['NO_CANDIDATE_OUTPUT']])(
		'NOT SUCCESS-SHAPED: %s is a FAILURE, not a success with an excuse',
		(reason) => {
			const r = dispatch(
				'CompleteExecutionStep',
				completion({ noOutputResult: { reason, detail: 'the model never returned' } })
			);
			expect(r.status).toBe('REJECTED');
			expect(r.error?.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
			expect(r.error?.message).toContain('RPH_STEP_RESULT_NOT_SUCCESS_SHAPED');
			expect(r.error?.message, 'the refusal must name the remedy').toContain('FailExecutionStep');
			expect(stepStateOf(S1)).toBe('RUNNING');
		}
	);

	it('NO DEADLOCK: the refused timeout step still has its legitimate exit', () => {
		// A refusal that stranded the step would be a worse defect than the one being fixed. The remedy the message
		// names must actually work, on this exact step, immediately.
		dispatch(
			'CompleteExecutionStep',
			completion({ noOutputResult: { reason: 'TIMEOUT', detail: 'the model never returned' } })
		);
		const failed = dispatch('FailExecutionStep', { stepId: S1, failureReason: 'timed out' });
		expect(failed.status, JSON.stringify(failed.error)).toBe('ACCEPTED');
		expect(stepStateOf(S1)).toBe('FAILED');
	});

	it('SIDE_EFFECT_ONLY is success-shaped — a step may legitimately produce only a side effect', () => {
		const r = dispatch(
			'CompleteExecutionStep',
			completion({
				noOutputResult: { reason: 'SIDE_EFFECT_ONLY', detail: 'notified the downstream team' }
			})
		);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
	});

	// ── the corroboration limb ──────────────────────────────────────────────────────────────────────────────────

	it('CONTRADICTS PLAN: a step that DECLARES outputBindings may not assert it produced nothing', () => {
		// Why this limb exists at all: `noOutputResult` is otherwise a FREE CALLER ASSERTION — structurally the same
		// shape as the `!!waiverOrRevisionId` booleans this program is elsewhere removing, since nothing in recorded
		// state can disagree with it. The authored step's own `outputBindings` is the one thing that can.
		reachS2();
		const r = dispatch('CompleteExecutionStep', completion({ noOutputResult: SAYS_NOTHING }, S2));
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
		expect(r.error?.message).toContain('RPH_STEP_RESULT_CONTRADICTS_PLAN');
		expect(stepStateOf(S2)).toBe('RUNNING');
	});

	it('the limb constrains ONLY the asserted arm: the same step completes when it NAMES its output', () => {
		// Guards the over-refusal: a mutant reading `declaresOutputBindings` without the `explicitNoOutput` term
		// would wedge every step that honestly declares and delivers an output.
		reachS2();
		expect(
			dispatch(
				'ProposeEvidence',
				{
					evidenceId: EVD,
					evidenceType: 'TEST_RESULT',
					contentReference: { artifactId: 'art-x', contentHash: 'sha256:x' },
					producedBy: HUMAN,
					supportsClaimIds: [],
					contradictsClaimIds: [],
					scope: 'the step output',
					limitations: [],
					capturedAt: TS
				},
				EVD,
				'EVIDENCE'
			).status
		).toBe('ACCEPTED');
		const r = dispatch('CompleteExecutionStep', completion({ proposedEvidenceIds: [EVD] }, S2));
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(stepStateOf(S2)).toBe('SUCCEEDED');
	});
});
