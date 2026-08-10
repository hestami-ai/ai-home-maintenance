// JAN-EXECREM WP-12 — F-08 (BLOCKER): ONE definition of execution success, shared by both planes.
//
// THE DEFECT. `rejectUnbackedExecutionSuccess` is the sole guard on the premise the entire assurance chain rests
// on — `pwuGuards.ts` gates EXECUTING -> EVIDENCE_PENDING on exactly `executionState === 'SUCCEEDED'`. It enforced
// `steps.some(s => s.stepState === 'SUCCEEDED')`: no status term, and `some` rather than `every`. Meanwhile
// `completeExecutionPlan` enforced all three limbs (≥1 step, EVERY step SUCCEEDED|SKIPPED, ≥1 SUCCEEDED) and its
// own docstring claimed the two planes "cannot diverge". The claim was one-directional — the plan plane cited the
// PWU rule; the PWU rule cited nothing.
//
// So a plan the engine ITSELF refuses to call complete could still back its PWU's success claim. Reproduced live,
// three ways: 1-of-5 steps succeeded with four QUEUED; a SUPERSEDED plan (one the sponsor explicitly killed); and
// — sharpest — a FAILED plan, which the engine records as failed while the PWU cites it as evidence of success.
//
// WHY THE EXISTING SUITE COULD NOT CATCH IT: `pwu.test.ts`'s `succeededPlanFor` always builds a ONE-step plan that
// succeeds and leaves the plan ACTIVE. Against that single shape, `some` and `every` agree, and a missing status
// term is invisible. The fixture below is parameterised over exactly the two axes the defect lived in — step
// completeness and final plan status — because a fixture with one shape can only ever test one shape.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-12T00:00:00Z';
const actor: ActorReference = { actorId: 'u1', actorType: 'HUMAN', displayName: 'A' };
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69H1100';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69H1110';
const PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69H1120';
const PLAN2 = 'plan_01ARZ3NDEKTSV4RRFFQ69H1130';
const sid = (i: number) => `${PLAN}-s${i}`;

const SAYS_NOTHING = {
	reason: 'NO_DOWNSTREAM_CONSUMABLE_RESULT' as const,
	detail: 'A coordination step; it authors no artifact.'
};

/** How the fixture should leave the plan once its steps are arranged. */
type FinalStatus = 'ACTIVE' | 'COMPLETED' | 'SUPERSEDED' | 'FAILED' | 'CANCELLED';

interface PlanShape {
	readonly stepCount: number;
	/** 1-based indices to drive to SUCCEEDED. */
	readonly succeed: readonly number[];
	/** 1-based indices to drive to SKIPPED (optional steps, so §21.1 needs no waiver). */
	readonly skip?: readonly number[];
	readonly finalStatus?: FinalStatus;
}

describe('JAN-EXECREM WP-12 / F-08 — a PWU success claim needs a plan that EVIDENCES success', () => {
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
			correlationId: 'wp12',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	}
	const onPlan = (commandType: string, payload: unknown, planId = PLAN) =>
		dispatch(commandType, payload, planId, 'EXECUTION_PLAN');
	const ok = (r: { status: string; error?: { message?: string } }, what: string) => {
		expect(r.status, `${what}: ${r.error?.message}`).toBe('ACCEPTED');
		return r;
	};

	const planStatus = (id = PLAN) => (store.loadObject(id)!.state as { status: string }).status;
	const executionState = () =>
		(store.loadObject(PWU)!.state as { executionState: string }).executionState;

	/** Claim PWU execution success, citing `planIds`. This is the command under test throughout. */
	const claimSuccess = (planIds: string[] = [PLAN]) =>
		dispatch(
			'ChangePwuState',
			{
				previousState: 'EXECUTING',
				newState: 'EXECUTING',
				executionState: 'SUCCEEDED',
				assuranceState: 'UNASSESSED',
				shapeIntegrityState: 'PRESERVED',
				reasonCode: 'execution-complete',
				supportingObjectIds: planIds
			},
			PWU,
			'PROFESSIONAL_WORK_UNIT'
		);

	const mkStep = (i: number) => ({
		id: sid(i),
		executionPlanId: PLAN,
		stepType: 'HUMAN_INTERACTION',
		purpose: `work ${i}`,
		inputBindings: [],
		outputBindings: [],
		preconditions: [],
		postconditions: [],
		stepState: 'QUEUED',
		// §21.1 IS NOT ON TRIAL IN THIS FILE (REG-F-105, ruled REG-D-041). Skipping used to be granted by
		// `mandatory: false` inside the SKIP PAYLOAD — the skipper's own word. That field is gone, so the PLAN now
		// declares what the request used to assert. Marking these steps ADVISORY isolates the execution-success allow-list
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
				boundaries: {
					inScope: ['the governed work under test'],
					outOfScope: ['not yet known'],
					permittedChanges: [],
					prohibitedChanges: []
				},
				obligationIds: [],
				constraintIds: [],
				assumptionIds: [],
				expectedOutputs: [{ outputId: 'out_fixture', kind: 'DOCUMENT' }],
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
		// REG-F-072 — SHAPING and READY leave the walk: those two arrows belong to BeginPwuShaping and
		// MarkPwuReady, which is also what makes the PWU genuinely shaped rather than merely flipped.
		ok(dispatch('BeginIntentDiscovery', {}, INTENT, 'INTENT'), 'intent discovery');
		ok(dispatch('ProvisionIntent', { ambiguityIds: [] }, INTENT, 'INTENT'), 'intent provisional');
		ok(dispatch('BeginPwuShaping', {}, PWU, 'PROFESSIONAL_WORK_UNIT'), 'shaping');
		ok(
			dispatch(
				'MarkPwuReady',
				{ shapeReadinessAssessmentId: 'assess_shape', expectedSemanticVersion: 1 },
				PWU,
				'PROFESSIONAL_WORK_UNIT'
			),
			'ready'
		);
		// Walk the PWU to EXECUTING/RUNNING so the success claim is the ONLY thing under test.
		// The remaining arrows, in order (PWU.workLifecycleState): READY -> PLANNED -> EXECUTING.
		for (const [previousState, newState, exec] of [
			['READY', 'PLANNED', 'PLANNED'],
			// executionState advances PLANNED -> QUEUED -> RUNNING, so the EXECUTING hop takes QUEUED and a
			// subsequent HOLD carries it to RUNNING (a hold that moves an orthogonal axis is the dominant case).
			['PLANNED', 'EXECUTING', 'QUEUED'],
			['EXECUTING', 'EXECUTING', 'RUNNING']
		] as const)
			ok(
				dispatch(
					'ChangePwuState',
					{
						previousState,
						newState,
						executionState: exec,
						assuranceState: 'UNASSESSED',
						shapeIntegrityState: 'PRESERVED',
						reasonCode: 'fixture-walk',
						supportingObjectIds: []
					},
					PWU,
					'PROFESSIONAL_WORK_UNIT'
				),
				`walk to ${newState}`
			);
	});

	/**
	 * Build a plan of `stepCount` steps, drive the named ones to SUCCEEDED / SKIPPED, then leave the plan in
	 * `finalStatus`. The two axes this varies — step completeness and plan status — are exactly the two the
	 * shipped guard ignored.
	 */
	function arrangePlan(shape: PlanShape): void {
		const { stepCount, succeed, skip = [], finalStatus = 'ACTIVE' } = shape;
		ok(
			onPlan('ProposeExecutionPlan', {
				executionPlanId: PLAN,
				workUnitId: PWU,
				steps: Array.from({ length: stepCount }, (_, i) => mkStep(i + 1)),
				transitions: [],
				retryPolicy: {},
				tacticalChangePolicy: {},
				escalationPolicy: {},
				terminationPolicy: {}
			}),
			'ProposeExecutionPlan'
		);
		ok(onPlan('ApproveExecutionPlan', {}), 'ApproveExecutionPlan');
		ok(onPlan('ActivateExecutionPlan', { authorizedRuntimeBindingIds: [] }), 'ActivateExecutionPlan');

		// A LINEAR plan advances in array order, so the steps are driven in order rather than by set membership.
		for (let i = 1; i <= stepCount; i += 1) {
			if (succeed.includes(i)) {
				ok(onPlan('StartExecutionStep', { stepId: sid(i) }), `start ${i}`);
				ok(
					onPlan('CompleteExecutionStep', {
						executionStepId: sid(i),
						executionAttemptId: `${sid(i)}-a1`,
						resultStatus: 'SUCCEEDED',
						outputArtifactIds: [],
						proposedEvidenceIds: [],
						detectedAssumptionIds: [],
						structuredResult: {},
						noOutputResult: SAYS_NOTHING,
						executionProvenance: { executedBy: actor, originType: 'HUMAN_DECISION' }
					}),
					`complete ${i}`
				);
			} else if (skip.includes(i)) {
				ok(onPlan('SkipExecutionStep', { stepId: sid(i) }), `skip ${i}`);
			}
		}

		if (finalStatus === 'COMPLETED') ok(onPlan('CompleteExecutionPlan', {}), 'CompleteExecutionPlan');
		if (finalStatus === 'FAILED')
			ok(onPlan('FailExecutionPlan', { failureReason: 'the approach did not work' }), 'FailExecutionPlan');
		if (finalStatus === 'CANCELLED')
			ok(onPlan('CancelExecutionPlan', { reason: 'the sponsor withdrew it' }), 'CancelExecutionPlan');
		if (finalStatus === 'SUPERSEDED') {
			ok(
				onPlan(
					'ProposeExecutionPlan',
					{
						executionPlanId: PLAN2,
						workUnitId: PWU,
						steps: [{ ...mkStep(1), id: `${PLAN2}-s1`, executionPlanId: PLAN2 }],
						transitions: [],
						retryPolicy: {},
						tacticalChangePolicy: {},
						escalationPolicy: {},
						terminationPolicy: {}
					},
					PLAN2
				),
				'ProposeExecutionPlan(successor)'
			);
			ok(onPlan('SupersedeExecutionPlan', { supersedingExecutionPlanId: PLAN2 }), 'SupersedeExecutionPlan');
		}
		expect(planStatus(), 'the fixture must actually reach the status it claims').toBe(finalStatus);
	}

	/** Every refusal below must leave the axis where it was — a refused claim that still moved state is no refusal. */
	function expectRefused(r: ReturnType<typeof claimSuccess>, limb: string): void {
		expect(r.status, `expected refusal via ${limb}`).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_EVIDENCE_MISSING');
		expect(r.error?.message, 'the refusal must name WHICH limb the cited plan failed').toContain(limb);
		expect(executionState(), 'the axis must not have moved').toBe('RUNNING');
	}

	// ── THE KILL TESTS: all four were ACCEPTED before WP-12 ─────────────────────────────────────────────────────

	it('PARTIAL: 1 of 5 steps succeeded — the plan cannot complete, and cannot back the claim either', () => {
		arrangePlan({ stepCount: 5, succeed: [1] });
		// The plan plane already refused this. The PWU plane did not — that asymmetry IS the finding.
		const planLevel = onPlan('CompleteExecutionPlan', {});
		expect(planLevel.status, 'the plan plane always refused this').toBe('REJECTED');
		expectRefused(claimSuccess(), 'RPH_PLAN_STEPS_NOT_TERMINAL_SUCCESS');
	});

	it('SUPERSEDED: a plan the sponsor explicitly killed backs nothing', () => {
		arrangePlan({ stepCount: 1, succeed: [1], finalStatus: 'SUPERSEDED' });
		expectRefused(claimSuccess(), 'RPH_PLAN_NOT_LIVE_FOR_SUCCESS');
	});

	it('FAILED: a plan the engine RECORDS as failed cannot evidence success', () => {
		// The sharpest variant, and one the raising lens did not name: the same object simultaneously asserting
		// "this failed" and backing "this succeeded".
		arrangePlan({ stepCount: 2, succeed: [1], finalStatus: 'FAILED' });
		expectRefused(claimSuccess(), 'RPH_PLAN_NOT_LIVE_FOR_SUCCESS');
	});

	it('CANCELLED: likewise', () => {
		arrangePlan({ stepCount: 2, succeed: [1], finalStatus: 'CANCELLED' });
		expectRefused(claimSuccess(), 'RPH_PLAN_NOT_LIVE_FOR_SUCCESS');
	});

	it('ALL-SKIPPED: a plan that produced nothing backs nothing — at BOTH planes, identically', () => {
		arrangePlan({ stepCount: 2, succeed: [], skip: [1, 2] });
		const planLevel = onPlan('CompleteExecutionPlan', {});
		expect(planLevel.status).toBe('REJECTED');
		expect(planLevel.error?.message).toContain('RPH_PLAN_PRODUCED_NOTHING');
		// The SAME kernel code at the other plane — which is the whole point of one definition.
		expectRefused(claimSuccess(), 'RPH_PLAN_PRODUCED_NOTHING');
	});

	// ── THE OVER-REFUSAL GUARDS: the legitimate paths must survive ──────────────────────────────────────────────

	it('ACTIVE + every step succeeded is ACCEPTED — the reference seed’s exact shape', () => {
		// The seed claims PWU success while its plan is still ACTIVE and never issues CompleteExecutionPlan. A
		// COMPLETED-only rule would have broken it; this case is the executable form of that constraint.
		arrangePlan({ stepCount: 1, succeed: [1] });
		ok(claimSuccess(), 'claim');
		expect(executionState()).toBe('SUCCEEDED');
	});

	it('COMPLETED is ACCEPTED too — the natural order is equally legitimate', () => {
		arrangePlan({ stepCount: 2, succeed: [1, 2], finalStatus: 'COMPLETED' });
		ok(claimSuccess(), 'claim');
		expect(executionState()).toBe('SUCCEEDED');
	});

	it('SKIPPED alongside SUCCEEDED is ACCEPTED — it is an ALLOW-LIST, not a negation', () => {
		// And why an allow-list matters: the reachable terminal step set includes CANCELLED and SUPERSEDED, which a
		// "terminal and not FAILED" rule would silently admit as success.
		arrangePlan({ stepCount: 2, succeed: [1], skip: [2] });
		ok(claimSuccess(), 'claim');
		expect(executionState()).toBe('SUCCEEDED');
	});

	it('a CANCELLED step is not terminal-success, so its plan backs no claim', () => {
		arrangePlan({ stepCount: 2, succeed: [1] });
		ok(onPlan('CancelExecutionStep', { stepId: sid(2), reason: 'abandoned' }), 'cancel step 2');
		expectRefused(claimSuccess(), 'RPH_PLAN_STEPS_NOT_TERMINAL_SUCCESS');
	});

	// ── SCOPE: what this guard deliberately does NOT touch ──────────────────────────────────────────────────────

	it('citing NOTHING is still refused, with the full remedy spelled out', () => {
		arrangePlan({ stepCount: 1, succeed: [1] });
		const r = claimSuccess([]);
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_EVIDENCE_MISSING');
		expect(r.error?.message).toContain('Supplied: [nothing]');
	});

	it('recording FAILURE never needs permission — only SUCCEEDED is guarded', () => {
		// `pwu.ts`'s standing rule: a system that makes failure harder to report than success is worse than one
		// that checks neither. A mutant guarding the whole axis would turn this red.
		arrangePlan({ stepCount: 2, succeed: [1], finalStatus: 'FAILED' });
		ok(
			dispatch(
				'ChangePwuState',
				{
					previousState: 'EXECUTING',
					newState: 'EXECUTING',
					executionState: 'FAILED',
					assuranceState: 'UNASSESSED',
					shapeIntegrityState: 'PRESERVED',
					reasonCode: 'the approach did not work',
					supportingObjectIds: [PLAN]
				},
				PWU,
				'PROFESSIONAL_WORK_UNIT'
			),
			'record failure'
		);
		expect(executionState()).toBe('FAILED');
	});
});
