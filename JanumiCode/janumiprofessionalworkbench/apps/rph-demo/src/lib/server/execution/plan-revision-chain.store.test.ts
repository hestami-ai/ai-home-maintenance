// ⭐⭐ `JAN-EXEC` Phase 7, P7-6R, R-1a (`docs/_working/DESIGN-the-stopped-unit-recovery.md` §7 item 1; `REG-D-104` (1);
// `REG-F-511`) — THE PLAN-REVISION CHAIN, DRIVEN IN THE ENGINE WITH NO ROUTE.
//
// The design's RD5 builds a re-run from commands that already exist: a person's Decision, a new plan B, the supersession
// of the refused plan A citing B, the cancellation of A's waiting step, B approved and activated, the unit's execution
// axis WAITING→RUNNING, and B's step started — the new attempt on the record. ⛔ NO TEST HELD BOTH `SupersedeExecutionPlan`
// AND `ActivateExecutionPlan` BEFORE THIS FILE (the design's §3, "Not yet driven"), so the chain's admission was a reading
// of guards, not a measurement. ⭑ PREDICTED, UNTESTED, BEFORE THIS FILE FIRST RAN: ADMITTED. A guard that refuses is the
// first finding, and its verbatim message is what this file would then pin.
//
// ⭐ THE STATE IS K1's AS THE ROUTE LEAVES IT — EXECUTING, plan A ACTIVE, its one step RUNNING, one recorded work product
// whose review was refused — and then RD2's wait, recorded as the route records it from R-1b on: the step WAITING and the
// unit's execution axis WAITING. ⚠ ARRANGED HERE BY THE SAME COMMANDS THE ROUTE DISPATCHES, NOT BY THE ROUTE: this file is
// the engine's half (R-1a), so a later change to what the route does at a refusal cannot move what it measures. The review
// is a stub registry over the real floor recorder (`rph-engine` `recordAssuranceRecordingPlan`), as
// `rph-engine/src/floor-execution-plane.test.ts` drives it — so the gate judges recorded assessments, not a mock.
//
// ⭑ TWO CHAINS, BECAUSE RD5 HAS TWO STEP KINDS:
//   · RERUN_REVIEW — a REVIEW step (`ASSURANCE_INVOCATION`) that runs no producer, its input A's work product; the floors
//     are recorded again over that work product and B completes NAMING IT (the design's §7 item 1, literally).
//     ⚠ WITH NO RUNTIME BINDING, and that departs from RD5 item 5 on purpose: a binding grants an EXECUTOR's capabilities
//     (`step-binding.ts`'s vocabulary — network, file-system, process-execution — minted as the producer's tools), and a
//     review step opens no executor. A binding there would be a grant nobody exercises: a record, not a control. A step
//     naming no binding is `OUT_OF_SCOPE` to the binding limb, as every TRANSFORMATION step is.
//   · RERUN_WORK — a PRODUCER step (`MODEL_INVOCATION`), its binding requested and authorized as Begin & Execute does, in
//     RD5's own order (proposed before its binding exists: `rejectMisboundStep` admits a binding that does not resolve
//     YET); B records its own work product and completes naming it.
// Each ends as §7 item 1 requires: A SUPERSEDED and its step CANCELLED; B ACTIVE and its step SUCCEEDED; the unit's
// execution SUCCEEDED citing B; and a Start on A's step REFUSED (STA-8: *"only beginning new work under the superseded plan
// is barred"*).
//
// ⛔ HERMETIC: nothing here calls a model or a program — the review is a stub validator, the work product a literal.
import { vi } from 'vitest';

vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
});

import {
	createValidatorRegistry,
	FLOOR_POLICY_IDS,
	identityProvenanceValidatorInstance,
	reasoningReviewResultFromJudgement,
	runFloorAndPlanRecording,
	schemaInvariantValidatorInstance,
	type AssuranceSubject,
	type Identity,
	type Validator
} from '@janumipwb/rph-assurance';
import { attemptsMadeFrom } from '@janumipwb/rph-domain';
import { getObject, listByType, recordAssuranceRecordingPlan } from '@janumipwb/rph-engine';
import { beforeEach, describe, expect, it } from 'vitest';
import { reasoningReviewCriteria } from '../floor.js';
import { actingActor } from '../identity.js';
import {
	dispatchBatch,
	getArtifactStore,
	getEngine,
	hostNow,
	mintUiId,
	resetEngine,
	uiSession
} from '../workbench.js';
import { modelWorkUnit } from './begin-execute.testing.js';
import { stepBindingFor } from './step-binding.js';

const PWU = 'PROFESSIONAL_WORK_UNIT';
const PLAN = 'EXECUTION_PLAN';
type Step = readonly [command: string, aggType: string, aggId: string, payload: unknown];

/** The model that "produced" the work product, as the route records it (`executedBy`, `model:<id>`). */
const PRODUCER_MODEL = 'stand-in-executor';
/** The reviewing model: a DIFFERENT model, so the reasoning review's `DIFFERENT_MODEL` independence holds. */
const JUDGE: Identity = {
	actorType: 'AGENT',
	agentId: 'judge',
	modelId: 'fixture-assurance-model',
	providerId: 'fixture'
};

/** Run `steps` as ONE atomic batch, as the route's `runSteps` does; the refusal as `<Command>: <message>`, or null. */
function batch(steps: readonly Step[]): string | null {
	const r = dispatchBatch(
		steps.map(([commandType, targetAggregateType, targetAggregateId, payload]) => ({
			commandType,
			targetAggregateType,
			targetAggregateId,
			payload
		}))
	);
	if (r.ok) return null;
	const at = r.failedIndex ?? r.results.length - 1;
	return `${steps[at]?.[0] ?? '(unknown)'}: ${r.results[at]?.error?.message ?? r.results[at]?.status ?? 'REJECTED'}`;
}

/** The route's `chg` — a ChangePwuState hop citing `supportingObjectIds`. */
const chg = (
	pwuId: string,
	previousState: string,
	newState: string,
	executionState: string,
	supportingObjectIds: readonly string[] = []
): Step => [
	'ChangePwuState',
	PWU,
	pwuId,
	{
		previousState,
		newState,
		executionState,
		assuranceState: 'UNASSESSED',
		shapeIntegrityState: 'PRESERVED',
		reasonCode: 'CONTROLLER',
		supportingObjectIds
	}
];

/** A one-step plan, shaped as Begin & Execute proposes one. */
const proposePlan = (
	planId: string,
	pwuId: string,
	step: {
		readonly id: string;
		readonly stepType: string;
		readonly purpose: string;
		readonly runtimeBindingId?: string;
		readonly inputBindings?: readonly { artifactId: string; required: boolean }[];
	}
): Step => [
	'ProposeExecutionPlan',
	PLAN,
	planId,
	{
		executionPlanId: planId,
		workUnitId: pwuId,
		steps: [
			{
				id: step.id,
				executionPlanId: planId,
				stepType: step.stepType,
				...(step.runtimeBindingId ? { runtimeBindingId: step.runtimeBindingId } : {}),
				purpose: step.purpose,
				inputBindings: [...(step.inputBindings ?? [])],
				outputBindings: [],
				preconditions: [],
				postconditions: [],
				stepState: 'QUEUED'
			}
		],
		transitions: [],
		retryPolicy: {},
		tacticalChangePolicy: {},
		escalationPolicy: {},
		terminationPolicy: {}
	}
];

/**
 * A reasoning-review stub. `concludes: false` answers no criterion, recommending SATISFIED — the measured run's empty
 * findings list (`REG-F-552`), which the floor records INCONCLUSIVE; `concludes: true` answers every criterion unfailed.
 */
function reasoningReview(concludes: boolean): Validator {
	return {
		policyId: FLOOR_POLICY_IDS.REASONING_REVIEW,
		validatorId: 'test.reasoning-review',
		evaluate: (subject) =>
			Promise.resolve(
				reasoningReviewResultFromJudgement(
					subject,
					JUDGE,
					'test.reasoning-review',
					{
						findings: concludes
							? reasoningReviewCriteria(uiSession()).map((c) => ({
									criterionId: c.id,
									failed: false,
									statement: 'evaluated; the failure class is absent'
								}))
							: [],
						recommendation: 'SATISFIED'
					},
					reasoningReviewCriteria(uiSession())
				)
			)
	};
}

/** Run the three floor policies over `artifactId` and RECORD them, as the route's floor run records them (`uiSession`). */
async function recordFloor(artifactId: string, concludes: boolean): Promise<boolean> {
	const registry = createValidatorRegistry();
	registry.register(schemaInvariantValidatorInstance);
	registry.register(identityProvenanceValidatorInstance);
	registry.register(reasoningReview(concludes));
	const subject: AssuranceSubject = {
		subjectId: artifactId,
		objectType: 'ARTIFACT',
		semanticVersion: getEngine().loadObject(artifactId)?.semanticVersion ?? 1,
		isAiProduced: true,
		producer: {
			actorType: 'AGENT',
			agentId: `execution.model-invocation:${artifactId}`,
			modelId: PRODUCER_MODEL,
			providerId: 'stand-in'
		}
	};
	const plan = await runFloorAndPlanRecording(
		subject,
		{
			schemaInvariant: { schemaValid: true, invariantViolations: [] },
			identityProvenance: {
				hasStableId: true,
				hasSemanticVersion: true,
				hasProvenance: true,
				hasProducer: true,
				traceComplete: true
			}
		},
		registry
	);
	recordAssuranceRecordingPlan(uiSession(), plan, {
		issuedAt: hostNow(),
		correlationId: `chain-floor:${artifactId}`,
		idPrefix: mintUiId('wpfloor'),
		newId: mintUiId
	});
	return plan.gatePermitsTransition;
}

/** Record a work product's bytes and its ARTIFACT, naming the attempt that made it (RD6, `<stepId>#<n>`). */
async function recordWorkProduct(pwuId: string, attemptKey: string, text: string): Promise<string> {
	const stored = await getArtifactStore().put({
		tenantPrefix: 'tnt-local',
		bytes: text,
		mediaType: 'text/plain',
		purgeability: 'RETAINED_BY_PARTICIPATION'
	});
	const artifactId = mintUiId('art');
	expect(
		batch([
			[
				'RecordArtifact',
				'ARTIFACT',
				artifactId,
				{
					artifactId,
					artifactType: 'work-product',
					mediaType: 'text/plain',
					storageProvider: 'jpwb:content-plane',
					storageKey: stored.storageKey,
					contentHash: stored.contentHash,
					byteSize: stored.byteSize,
					producingPwuId: pwuId,
					producingExecutionAttemptId: attemptKey,
					securityClassification: 'unclassified',
					retentionClass: 'retained-by-participation',
					status: 'recorded'
				}
			]
		]),
		'arrangement: the work product was not recorded'
	).toBeNull();
	return artifactId;
}

/** A completion of `stepId` naming `outputArtifactIds`, executed by the producing model, as the route records one. */
const complete = (
	planId: string,
	stepId: string,
	outputArtifactIds: readonly string[],
	producingExecutionAttemptId?: string
): Step => [
	'CompleteExecutionStep',
	PLAN,
	planId,
	{
		executionStepId: stepId,
		executionAttemptId: mintUiId('attempt'),
		resultStatus: 'SUCCEEDED',
		outputArtifactIds: [...outputArtifactIds],
		proposedEvidenceIds: [],
		detectedAssumptionIds: [],
		structuredResult: {},
		executionProvenance: {
			originType: 'MODEL_GENERATION',
			...(producingExecutionAttemptId ? { producingExecutionAttemptId } : {}),
			executedBy: {
				actorId: `model:${PRODUCER_MODEL}`,
				actorType: 'AGENT',
				displayName: 'Execution model'
			}
		}
	}
];

/** The plan's status and each step's state, as the store holds them. */
function planOf(planId: string): { status: string; steps: string[] } {
	const plan = getObject(getEngine(), planId) as
		{ status?: string; steps?: { stepState?: string }[] } | undefined;
	return {
		status: String(plan?.status),
		steps: (plan?.steps ?? []).map((s) => String(s.stepState))
	};
}

/** The unit's four axes. */
function axesOf(pwuId: string): string[] {
	const u = getObject(getEngine(), pwuId) as Record<string, unknown>;
	return [u.workLifecycleState, u.executionState, u.assuranceState, u.shapeIntegrityState].map(
		String
	);
}

/** The latest reasoning-review assessments over `artifactId`, in the order they were recorded. */
const reviewsOf = (artifactId: string) =>
	listByType(getEngine(), 'ASSURANCE_ASSESSMENT').filter(
		(a) =>
			a.state.assurancePolicyId === FLOOR_POLICY_IDS.REASONING_REVIEW &&
			(a.state.subjectObjectIds as readonly string[]).includes(artifactId)
	);

/**
 * ⭐ K1, THEN RD2's WAIT: a model unit begun as Begin & Execute begins it, its one try's work product recorded, its review
 * INCONCLUSIVE, its completion REFUSED by the floor — and then the wait the route records at that refusal from R-1b on.
 */
async function aUnitWaitingAfterARefusedReview() {
	const pwuId = await modelWorkUnit();
	const planA = mintUiId('plan');
	const stepA = mintUiId('step');
	const bindA = mintUiId('bind');
	const binding = stepBindingFor('MODEL_INVOCATION', 'MODEL', bindA, stepA)!;
	expect(
		batch([
			['BeginPwuShaping', PWU, pwuId, {}],
			['RequestRuntimeBinding', 'RUNTIME_BINDING', bindA, binding.request],
			[
				'AuthorizeRuntimeBinding',
				'RUNTIME_BINDING',
				bindA,
				{ grantedCapabilities: [...binding.request.requestedCapabilities] }
			],
			[
				'MarkPwuReady',
				PWU,
				pwuId,
				{ shapeReadinessAssessmentId: 'assess_shape', expectedSemanticVersion: 1 }
			],
			proposePlan(planA, pwuId, {
				id: stepA,
				stepType: 'MODEL_INVOCATION',
				runtimeBindingId: bindA,
				purpose: 'Attempt the work described by the type’s prompt template'
			}),
			['ApproveExecutionPlan', PLAN, planA, {}],
			['ActivateExecutionPlan', PLAN, planA, { authorizedRuntimeBindingIds: [bindA] }],
			chg(pwuId, 'READY', 'PLANNED', 'PLANNED', [planA]),
			chg(pwuId, 'PLANNED', 'EXECUTING', 'QUEUED', [planA]),
			['StartExecutionStep', PLAN, planA, { stepId: stepA }],
			chg(pwuId, 'EXECUTING', 'EXECUTING', 'RUNNING', [planA])
		]),
		'arrangement: Begin & Execute’s batch was refused'
	).toBeNull();
	const attemptA = `${stepA}#${attemptsMadeFrom(getEngine().readAllEvents(), planA, stepA)}`;
	expect(attemptA, 'arrangement: the attempt key is not `<stepId>#1`').toBe(`${stepA}#1`);
	const art = await recordWorkProduct(pwuId, attemptA, '{"summary":"the first attempt"}');
	expect(await recordFloor(art, false), 'arrangement: the review concluded').toBe(false);
	expect(
		reviewsOf(art).map((a) => a.state.assessmentState),
		'arrangement: the review is not INCONCLUSIVE'
	).toEqual(['INCONCLUSIVE']);
	// ⛔ K1's STOP: the floor refuses the completion naming the work product, and the step stays RUNNING.
	expect(
		batch([
			complete(planA, stepA, [art], attemptA),
			chg(pwuId, 'EXECUTING', 'EXECUTING', 'SUCCEEDED', [planA])
		]),
		'arrangement: the floor admitted the completion'
	).toMatch(
		/^CompleteExecutionStep: CompleteExecutionStep blocked: the de minimis assurance floor is not SATISFIED for result /
	);
	// RD2 — the wait, its own batch: the step WAITING, the unit's execution WAITING.
	expect(
		batch([
			[
				'EnterExecutionStepWait',
				PLAN,
				planA,
				{
					stepId: stepA,
					waitReason: `The assurance floor refused the completion: ${art} floor.reasoning-review=INCONCLUSIVE.`
				}
			],
			chg(pwuId, 'EXECUTING', 'EXECUTING', 'WAITING', [planA])
		]),
		'arrangement: RD2’s wait was refused'
	).toBeNull();
	expect(axesOf(pwuId), 'arrangement: the unit is not waiting').toEqual([
		'EXECUTING',
		'WAITING',
		'UNASSESSED',
		'PRESERVED'
	]);
	expect(planOf(planA), 'arrangement: plan A is not ACTIVE with its step WAITING').toEqual({
		status: 'ACTIVE',
		steps: ['WAITING']
	});
	const refusingObservations = listByType(getEngine(), 'ASSURANCE_OBSERVATION')
		.filter((o) => reviewsOf(art).some((a) => a.id === o.state.assessmentId))
		.map((o) => o.id);
	return { pwuId, planA, stepA, attemptA, art, refusingObservations };
}

/** RD4 — the person's Decision, proposed and approved: authority the person, a HUMAN actor. */
function decision(
	decisionId: string,
	selectedOption: 'RERUN_REVIEW' | 'RERUN_WORK',
	subjectObjectIds: readonly string[],
	consideredObservationIds: readonly string[],
	rationale: string
): Step[] {
	return [
		[
			'ProposeDecision',
			'DECISION',
			decisionId,
			{
				decisionType: 'REPLAN',
				subjectObjectIds: [...subjectObjectIds],
				selectedOption,
				rationale,
				authority: actingActor(uiSession()),
				consideredObservationIds: [...consideredObservationIds]
			}
		],
		[
			'ApproveDecision',
			'DECISION',
			decisionId,
			{
				selectedOption,
				rationale,
				consideredEvidenceIds: [],
				consideredObservationIds: [...consideredObservationIds],
				subjectSemanticVersions: { [subjectObjectIds[0]!]: 1 }
			}
		]
	];
}

/** The four assertions §7 item 1 requires of every chain, and STA-8's refusal of new work under the superseded plan. */
function expectTheChainHeld(k: { pwuId: string; planA: string; stepA: string }, planB: string) {
	expect(planOf(k.planA), 'A is not SUPERSEDED with its step CANCELLED').toEqual({
		status: 'SUPERSEDED',
		steps: ['CANCELLED']
	});
	expect(planOf(planB), 'B is not ACTIVE with its step SUCCEEDED').toEqual({
		status: 'ACTIVE',
		steps: ['SUCCEEDED']
	});
	expect(axesOf(k.pwuId), 'the unit’s execution is not SUCCEEDED').toEqual([
		'EXECUTING',
		'SUCCEEDED',
		'UNASSESSED',
		'PRESERVED'
	]);
	// ⛔ STA-8: a Start on the superseded plan's step is refused — new work under a plan nobody now authorizes.
	expect(batch([['StartExecutionStep', PLAN, k.planA, { stepId: k.stepA }]])).toBe(
		`StartExecutionStep: StartExecutionStep requires an ACTIVE plan: ${k.planA} is SUPERSEDED — a superseded or terminal plan mints no new success credit (RPH-EXE-002). starting OPENS AN ATTEMPT, which is both new work and the first half of an execution episode; a superseded plan opens none (RPH-EXE-002). Cancel the step instead.`
	);
	// ⭑ The supersession is the chain's only link, and it is READ FROM THE EVENT (`REG-F-232`: no aggregate field holds it).
	const superseded = getEngine()
		.readAllEvents()
		.filter((e) => e.eventType === 'ExecutionPlanSuperseded' && e.aggregateId === k.planA)
		.map((e) => (e.payload as { supersedingExecutionPlanId?: string }).supersedingExecutionPlanId);
	expect(superseded, 'A’s supersession does not name B').toEqual([planB]);
}

beforeEach(() => {
	resetEngine('reference');
});

describe('⭐ R-1a (REG-D-104 (1), REG-F-511) — the plan-revision chain, from K1’s state to a SUCCEEDED unit, in the engine with no route', () => {
	it('⭐ RERUN_REVIEW: a Decision, a review step that runs no producer, A superseded and its waiting step cancelled, B started; the floors recorded again over A’s work product; B completes NAMING IT, and the unit SUCCEEDS citing B', async () => {
		const k = await aUnitWaitingAfterARefusedReview();
		const decisionId = mintUiId('dec');
		const planB = mintUiId('plan');
		const stepB = mintUiId('step');

		// ── RD5's BATCH, IN ORDER, ONE TRANSACTION ─────────────────────────────────────────────────────────────────────
		const chain = batch([
			...decision(
				decisionId,
				'RERUN_REVIEW',
				[k.pwuId, k.planA, k.art],
				k.refusingObservations,
				'The review did not conclude; re-run it over the recorded work product.'
			),
			proposePlan(planB, k.pwuId, {
				id: stepB,
				stepType: 'ASSURANCE_INVOCATION',
				purpose: `Re-run the review of ${k.art}, which attempt ${k.attemptA} produced; no producer runs`,
				inputBindings: [{ artifactId: k.art, required: true }]
			}),
			['SupersedeExecutionPlan', PLAN, k.planA, { supersedingExecutionPlanId: planB }],
			[
				'CancelExecutionStep',
				PLAN,
				k.planA,
				{
					stepId: k.stepA,
					reason: `Superseded by ${planB} under the person’s Decision ${decisionId}.`
				}
			],
			['ApproveExecutionPlan', PLAN, planB, {}],
			['ActivateExecutionPlan', PLAN, planB, { authorizedRuntimeBindingIds: [] }],
			chg(k.pwuId, 'EXECUTING', 'EXECUTING', 'RUNNING', [planB]),
			['StartExecutionStep', PLAN, planB, { stepId: stepB }]
		]);
		// ⭐ THE PREDICTION, HELD: ADMITTED.
		expect(chain, 'RD5’s batch was refused — that refusal is the finding').toBeNull();
		expect(
			attemptsMadeFrom(getEngine().readAllEvents(), planB, stepB),
			'B’s Start is not a new attempt on the record'
		).toBe(1);
		expect(getObject(getEngine(), decisionId)).toMatchObject({
			decisionType: 'REPLAN',
			selectedOption: 'RERUN_REVIEW',
			status: 'EFFECTIVE',
			subjectObjectIds: [k.pwuId, k.planA, k.art],
			consideredObservationIds: k.refusingObservations,
			authority: { actorType: 'HUMAN' }
		});

		// ⛔ THE CONTROL: before the re-review, B's completion naming A's work product is refused — the gate judges the
		// recorded review, and B being a new plan does not clear it.
		expect(
			batch([complete(planB, stepB, [k.art], k.attemptA)]),
			'B completed over a review that still did not conclude'
		).toMatch(
			/^CompleteExecutionStep: CompleteExecutionStep blocked: the de minimis assurance floor is not SATISFIED for result /
		);

		// ── THE RE-REVIEW: the floors recorded again over A's work product, and this time the review concludes ─────────
		expect(await recordFloor(k.art, true), 'the re-review did not conclude').toBe(true);
		// ⭑ THE FLOOR GATE reads the latest assessment per policy BY `updatedAt` (`latestAssessmentByPolicy`), so a re-review
		// recorded later is the one it reads — that, and only that, is what this pins.
		// ⚠ `P76F-A` A6: ~~RD10 (`REG-F-433`): the re-review is LATER than the refused review, so the latest-per-policy read
		// does not tie.~~ RD10 struck that line: ~~`REG-F-433`'s reader (`loadReviewerAnswer`) sorts by `attemptOrdinal` alone,
		// and a re-review's first try ties the original's at 1, so it returns the OLDER answer.~~ That reader, and the run
		// report's pairing by subject, were B7's (`REG-F-433`'s join key) — ⭐ landed: both now join by the floor-run token
		// (the report by each assessment's; the reader by the shown review's, `P76F-C` C2).
		const [refused, rerun] = reviewsOf(k.art);
		expect(
			[refused?.state.assessmentState, rerun?.state.assessmentState],
			'the record does not hold both reviews, the refused one first'
		).toEqual(['INCONCLUSIVE', 'SATISFIED']);
		expect(
			String(rerun!.state.updatedAt) > String(refused!.state.updatedAt),
			'the re-review is not later by updatedAt, which is what the floor gate reads'
		).toBe(true);

		expect(
			batch([
				complete(planB, stepB, [k.art], k.attemptA),
				chg(k.pwuId, 'EXECUTING', 'EXECUTING', 'SUCCEEDED', [planB])
			]),
			'B’s completion naming A’s work product, or the unit’s hop to SUCCEEDED citing B, was refused'
		).toBeNull();
		expectTheChainHeld(k, planB);
		// ⭑ B's completion names A's work product, and the attempt that made it (RD6), on the record.
		const succeeded = getEngine()
			.readAllEvents()
			.filter((e) => e.eventType === 'ExecutionStepSucceeded' && e.aggregateId === planB)
			.map((e) => e.payload as Record<string, unknown>);
		expect(succeeded).toHaveLength(1);
		expect(succeeded[0]!.outputArtifactIds).toEqual([k.art]);
		expect(
			(succeeded[0]!.executionProvenance as { producingExecutionAttemptId?: string })
				.producingExecutionAttemptId
		).toBe(k.attemptA);
	});

	it('⭐ RERUN_WORK: the same chain with a producer step, its binding requested and authorized in RD5’s order; B records its own work product, completes naming it, and the unit SUCCEEDS citing B', async () => {
		const k = await aUnitWaitingAfterARefusedReview();
		const decisionId = mintUiId('dec');
		const planB = mintUiId('plan');
		const stepB = mintUiId('step');
		const bindB = mintUiId('bind');
		const binding = stepBindingFor('MODEL_INVOCATION', 'MODEL', bindB, stepB)!;

		const chain = batch([
			...decision(
				decisionId,
				'RERUN_WORK',
				[k.pwuId, k.planA, k.art],
				k.refusingObservations,
				'Re-run the work in a fresh session.'
			),
			// RD5 item 2 BEFORE item 5: B names a binding that does not exist yet — admitted, "not yet right is not wrong
			// forever" (`rejectMisboundStep`).
			proposePlan(planB, k.pwuId, {
				id: stepB,
				stepType: 'MODEL_INVOCATION',
				runtimeBindingId: bindB,
				purpose: 'Attempt the work again, in a fresh session'
			}),
			['SupersedeExecutionPlan', PLAN, k.planA, { supersedingExecutionPlanId: planB }],
			[
				'CancelExecutionStep',
				PLAN,
				k.planA,
				{
					stepId: k.stepA,
					reason: `Superseded by ${planB} under the person’s Decision ${decisionId}.`
				}
			],
			['RequestRuntimeBinding', 'RUNTIME_BINDING', bindB, binding.request],
			[
				'AuthorizeRuntimeBinding',
				'RUNTIME_BINDING',
				bindB,
				{ grantedCapabilities: [...binding.request.requestedCapabilities] }
			],
			['ApproveExecutionPlan', PLAN, planB, {}],
			['ActivateExecutionPlan', PLAN, planB, { authorizedRuntimeBindingIds: [bindB] }],
			chg(k.pwuId, 'EXECUTING', 'EXECUTING', 'RUNNING', [planB]),
			['StartExecutionStep', PLAN, planB, { stepId: stepB }]
		]);
		expect(chain, 'RD5’s batch was refused — that refusal is the finding').toBeNull();

		const attemptB = `${stepB}#${attemptsMadeFrom(getEngine().readAllEvents(), planB, stepB)}`;
		const artB = await recordWorkProduct(k.pwuId, attemptB, '{"summary":"the second attempt"}');
		expect(await recordFloor(artB, true), 'the second attempt’s review did not conclude').toBe(
			true
		);
		expect(
			batch([
				complete(planB, stepB, [artB], attemptB),
				chg(k.pwuId, 'EXECUTING', 'EXECUTING', 'SUCCEEDED', [planB])
			]),
			'B’s completion, or the unit’s hop to SUCCEEDED citing B, was refused'
		).toBeNull();
		expectTheChainHeld(k, planB);
		// ⭑ The refused attempt's work product and its review stay on the record (ASR-12: a finding never disappears).
		expect(reviewsOf(k.art).map((a) => a.state.assessmentState)).toEqual(['INCONCLUSIVE']);
	});
});
