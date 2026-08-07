// JAN-EXECREM WP-12b — the DECLARED authority table becomes ENFORCEMENT: F-26 (plan liveness) + F-28 (PWU openness).
//
// F-26. Five of nine step commands carried a hand-inlined `plan.status !== 'ACTIVE'` block; four did not, and
// nothing anywhere stated which absence was intended. Settling it required naming the axis, and the axis is NOT
// "opens new work" — it is "MINTS SUCCESS CREDIT OR A DURABLE DECISION". The codebase already behaved that way and
// said otherwise: Skip and Prune open no work whatsoever, yet both were gated, because both mint TERMINAL-SUCCESS.
// Complete mints terminal-success AND a durable BRANCH decision AND is the fact the PWU success claim rests on —
// and was ACCEPTED on a SUPERSEDED plan, writing `selectedTransitionId` onto dead state. It moves to the gated side.
// Fail, Cancel and EnterWait stay exempt, now DECLARED with their own positive tests: a system that makes failure
// harder to report than success is worse than one that checks neither.
//
// F-28. RPH-PWU-010 ("a baselined PWU cannot resume execution in place") is ratified and was enforced NOWHERE:
// `canResumeExecutionOnPwu` had exactly two repo-wide references — its own definition and its own unit test — while
// the conformance manifest certified the rule COVERED. A pure-predicate unit test was accepted as evidence for a
// rule whose ratified `then` is "the command is REJECTED".
//
// WHY THE NAMED CASES BELOW DO NOT READ THE TABLE. A matrix generated from `STEP_COMMAND_SPECS` can only prove
// TOTALITY — that every row has a case. It cannot prove the CLASSIFICATION, because mutating a row flips the
// generated expectation along with the behaviour and the matrix stays green. That is the tautology family
// recurring inside its own remedy. So the classification is asserted by hardcoded cases that state the answer.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { STEP_COMMAND_SPECS, STEP_COMMAND_TYPES } from '@janumipwb/rph-domain';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';
import { seedForeignWorkUnitId_LEGACY_ONLY } from './__tests__/plan-fixtures.js';

const TS = '2026-07-12T00:00:00Z';
const actor: ActorReference = { actorId: 'u1', actorType: 'HUMAN', displayName: 'A' };
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69H2100';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69H2110';
const PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69H2120';
const PLAN2 = 'plan_01ARZ3NDEKTSV4RRFFQ69H2130';
const sid = (i: number) => `${PLAN}-s${i}`;
const tid = (a: number, b: number) => `${PLAN}-t${a}-${b}`;

const SAYS_NOTHING = {
	reason: 'NO_DOWNSTREAM_CONSUMABLE_RESULT' as const,
	detail: 'A coordination step; it authors no artifact.'
};

describe('JAN-EXECREM WP-12b — declared authority: plan liveness (F-26) + PWU openness (F-28)', () => {
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
			issuedBy: actor,
			correlationId: 'wp12b',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	}
	const ok = (r: { status: string; error?: { message?: string } }, what: string) => {
		expect(r.status, `${what}: ${r.error?.message}`).toBe('ACCEPTED');
		return r;
	};
	const planState = () =>
		store.loadObject(PLAN)!.state as {
			status: string;
			steps: Array<{ id: string; stepState: string; selectedTransitionId?: string }>;
		};
	const stepStateOf = (i: number) => planState().steps.find((s) => s.id === sid(i))?.stepState;
	const pwuLifecycle = () =>
		(store.loadObject(PWU)!.state as { workLifecycleState: string }).workLifecycleState;

	const mkStep = (i: number, stepType = 'HUMAN_INTERACTION') => ({
		id: sid(i),
		executionPlanId: PLAN,
		stepType,
		purpose: `work ${i}`,
		inputBindings: [],
		outputBindings: [],
		preconditions: [],
		postconditions: [],
		stepState: 'QUEUED'
	});

	const chg = (
		previousState: string,
		newState: string,
		executionState: string,
		supportingObjectIds: string[] = []
	) =>
		dispatch(
			'ChangePwuState',
			{
				previousState,
				newState,
				executionState,
				assuranceState: 'UNASSESSED',
				shapeIntegrityState: 'PRESERVED',
				reasonCode: 'fixture',
				supportingObjectIds
			},
			PWU,
			'PROFESSIONAL_WORK_UNIT'
		);

	const complete = (i: number) =>
		dispatch('CompleteExecutionStep', {
			executionStepId: sid(i),
			executionAttemptId: `${sid(i)}-a1`,
			resultStatus: 'SUCCEEDED',
			outputArtifactIds: [],
			proposedEvidenceIds: [],
			detectedAssumptionIds: [],
			structuredResult: {},
			noOutputResult: SAYS_NOTHING,
			executionProvenance: { executedBy: actor, originType: 'HUMAN_DECISION' }
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
	});

	/** An ACTIVE 3-step plan on an OPEN PWU, with s1 left RUNNING and s2/s3 QUEUED. */
	function activePlanWithRunningStep(transitions: unknown[] = [], steps = [mkStep(1), mkStep(2), mkStep(3)]) {
		ok(chg('PROPOSED', 'SHAPING', 'NOT_PLANNED'), 'shaping');
		ok(chg('SHAPING', 'READY', 'NOT_PLANNED'), 'ready');
		ok(
			dispatch('ProposeExecutionPlan', {
				executionPlanId: PLAN,
				workUnitId: PWU,
				steps,
				transitions,
				retryPolicy: {},
				tacticalChangePolicy: {},
				escalationPolicy: {},
				terminationPolicy: {}
			}),
			'ProposeExecutionPlan'
		);
		ok(dispatch('ApproveExecutionPlan', {}), 'ApproveExecutionPlan');
		ok(dispatch('ActivateExecutionPlan', { authorizedRuntimeBindingIds: [] }), 'ActivateExecutionPlan');
		ok(dispatch('StartExecutionStep', { stepId: sid(1) }), 'StartExecutionStep');
	}

	/** Supersede the plan out from under its running step — the F-26 fixture. */
	function supersedePlan() {
		ok(
			dispatch(
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
			'successor'
		);
		ok(dispatch('SupersedeExecutionPlan', { supersedingExecutionPlanId: PLAN2 }), 'supersede');
		expect(planState().status).toBe('SUPERSEDED');
	}

	// ── F-26: the CLASSIFICATION, in hardcoded named cases ──────────────────────────────────────────────────────

	it('liveness/complete-under-superseded-REJECTS — the behaviour change', () => {
		// ACCEPTED before WP-12b, and it wrote selectedTransitionId onto a plan the sponsor had killed.
		activePlanWithRunningStep();
		supersedePlan();
		const r = complete(1);
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(r.error?.message).toContain('requires an ACTIVE plan');
		expect(stepStateOf(1), 'the step must not have moved').toBe('RUNNING');
	});

	it('liveness/complete-under-cancelled-REJECTS', () => {
		activePlanWithRunningStep();
		ok(dispatch('CancelExecutionPlan', { reason: 'withdrawn' }), 'CancelExecutionPlan');
		expect(complete(1).status).toBe('REJECTED');
		expect(stepStateOf(1)).toBe('RUNNING');
	});

	it('liveness/branch-complete-under-superseded-records-no-selection', () => {
		// The compound consequence: a refused Complete must not leave a branch decision behind either.
		activePlanWithRunningStep(
			[
				{
					id: tid(1, 2),
					executionPlanId: PLAN,
					sourceStepId: sid(1),
					targetStepId: sid(2),
					transitionType: 'CONDITIONAL',
					conditionExpression: { op: 'STEP_SUCCEEDED', stepId: sid(1) }
				},
				{
					id: tid(1, 3),
					executionPlanId: PLAN,
					sourceStepId: sid(1),
					targetStepId: sid(3),
					transitionType: 'SEQUENTIAL'
				}
			],
			[mkStep(1, 'BRANCH'), mkStep(2), mkStep(3)]
		);
		supersedePlan();
		expect(complete(1).status).toBe('REJECTED');
		expect(planState().steps[0]!.selectedTransitionId, 'no decision on a dead plan').toBeUndefined();
	});

	// THE DECLARED EXEMPTIONS, each with a POSITIVE test. These are the kill tests for the exemptions themselves:
	// if someone later "hardens" Fail/Cancel/EnterWait by adding a plan gate, they go RED — which is precisely the
	// declaration F-26 observed that Complete never had.
	it('liveness/fail-under-superseded-ACCEPTS — failure must never be harder to report than success', () => {
		activePlanWithRunningStep();
		supersedePlan();
		ok(dispatch('FailExecutionStep', { stepId: sid(1), failureReason: 'boom' }), 'fail');
		expect(stepStateOf(1)).toBe('FAILED');
	});

	it('liveness/cancel-under-superseded-ACCEPTS — the exit every other refusal points at', () => {
		activePlanWithRunningStep();
		supersedePlan();
		ok(dispatch('CancelExecutionStep', { stepId: sid(1), reason: 'abandoned' }), 'cancel');
		expect(stepStateOf(1)).toBe('CANCELLED');
	});

	it('liveness/wait-under-cancelled-ACCEPTS — a running step may always record that it is blocked', () => {
		activePlanWithRunningStep();
		ok(dispatch('CancelExecutionPlan', { reason: 'withdrawn' }), 'CancelExecutionPlan');
		ok(dispatch('EnterExecutionStepWait', { stepId: sid(1), waitReason: 'awaiting input' }), 'wait');
		expect(stepStateOf(1)).toBe('WAITING');
	});

	it('liveness/resolvewait-under-superseded-REJECTS — resuming re-opens RUNNING', () => {
		// The asymmetry that made Complete-ungated indefensible: the surface refused the LESSER act while
		// permitting the greater one, on the same plan at the same instant.
		activePlanWithRunningStep();
		ok(dispatch('EnterExecutionStepWait', { stepId: sid(1) }), 'wait');
		supersedePlan();
		expect(dispatch('ResolveExecutionStepWait', { stepId: sid(1) }).status).toBe('REJECTED');
		expect(stepStateOf(1)).toBe('WAITING');
	});

	// ── F-26 TOTALITY (generated FROM the table — proves coverage, NOT classification) ──────────────────────────

	it('TOTALITY: every REQUIRES_ACTIVE_PLAN command is refused on a superseded plan', () => {
		// Generated, so a tenth command cannot ship without a case. It is deliberately paired with the hardcoded
		// cases above, which are what actually pin WHICH commands belong on which side.
		const gated = STEP_COMMAND_TYPES.filter(
			(t) => STEP_COMMAND_SPECS[t].planLiveness === 'REQUIRES_ACTIVE_PLAN'
		);
		expect(gated.length, 'the gated set must not be empty (a vacuous sweep proves nothing)').toBe(6);
		for (const commandType of gated) {
			// Fresh engine per command so each starts from the same arrangement.
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
			activePlanWithRunningStep();
			supersedePlan();
			// Each command's OWN payload shape — a merged one fails SCHEMA validation before reaching the guard,
			// which would make every case here vacuous in a new way (the WP-9 lesson).
			const payloads: Record<string, unknown> = {
				StartExecutionStep: { stepId: sid(1) },
				CompleteExecutionStep: {
					executionStepId: sid(1),
					executionAttemptId: `${sid(1)}-a1`,
					resultStatus: 'SUCCEEDED',
					outputArtifactIds: [],
					proposedEvidenceIds: [],
					detectedAssumptionIds: [],
					structuredResult: {},
					noOutputResult: SAYS_NOTHING,
					executionProvenance: { executedBy: actor, originType: 'HUMAN_DECISION' }
				},
				RetryExecutionStep: { stepId: sid(1) },
				SkipExecutionStep: { stepId: sid(1), mandatory: false },
				PruneExecutionStep: { stepId: sid(1) },
				ResolveExecutionStepWait: { stepId: sid(1) }
			};
			const payload = payloads[commandType];
			expect(payload, `${commandType} needs a payload in this sweep`).toBeDefined();
			const r = dispatch(commandType, payload);
			expect(r.status, `${commandType} on a SUPERSEDED plan`).toBe('REJECTED');
			expect(r.error?.code, commandType).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		}
	});

	// ── F-28: RPH-PWU-010 gets a production caller ──────────────────────────────────────────────────────────────

	/**
	 * Close the PWU while its plan is live and its step is RUNNING.
	 *
	 * ABANDONED rather than BASELINED, and the choice is disclosed: BASELINED is reachable only from SATISFIED,
	 * i.e. behind the entire assurance chain, while ABANDONED is reachable from READY — and a sponsor abandoning a
	 * unit of work whose plan is already running is the realistic shape of this rule. It also exercises the
	 * GENERALISED limb (`RPH_CLOSED_PWU_NO_NEW_EXECUTION`), which is the authored extension and therefore the part
	 * most in need of a live test; BASELINED keeps its own ratified code and its existing conformance unit test.
	 *
	 * The design's real requirement — that RPH-EXE-001 (one ACTIVE plan) must not MASQUERADE as this guard — is met
	 * by construction: exactly one plan exists here, and every assertion below names the openness code.
	 */
	function closePwu() {
		// executionState HOLDS at NOT_PLANNED: the four axes are orthogonal, and closing the unit of work
		// says nothing about the execution axis, which the running plan owns.
		ok(chg('READY', 'ABANDONED', 'NOT_PLANNED'), 'abandon');
		expect(pwuLifecycle()).toBe('ABANDONED');
	}

	it('openness/start-under-closed-pwu-REJECTS', () => {
		activePlanWithRunningStep();
		closePwu();
		const r = dispatch('StartExecutionStep', { stepId: sid(2) });
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(r.error?.message).toContain('RPH-PWU-010');
		expect(stepStateOf(2)).toBe('QUEUED');
	});

	it('openness/complete-under-closed-pwu-REJECTS', () => {
		activePlanWithRunningStep();
		closePwu();
		const r = complete(1);
		expect(r.status).toBe('REJECTED');
		expect(r.error?.message).toContain('RPH-PWU-010');
		expect(stepStateOf(1)).toBe('RUNNING');
	});

	it('openness/cancel-under-closed-pwu-ACCEPTS — closing a PWU must never strand its live steps', () => {
		activePlanWithRunningStep();
		closePwu();
		ok(dispatch('CancelExecutionStep', { stepId: sid(1), reason: 'the unit of work was abandoned' }), 'cancel');
		expect(stepStateOf(1)).toBe('CANCELLED');
	});

	it('openness/fail-under-closed-pwu-ACCEPTS', () => {
		activePlanWithRunningStep();
		closePwu();
		ok(dispatch('FailExecutionStep', { stepId: sid(1), failureReason: 'boom' }), 'fail');
		expect(stepStateOf(1)).toBe('FAILED');
	});

	it('openness/activate-under-closed-pwu-REJECTS — activation is the other privilege-granting command', () => {
		// Gating the step commands alone would leave the hole where a plan is activated AFTER the PWU closed and
		// then simply used. Exactly ONE plan exists, so RPH-EXE-001 cannot be what refused.
		ok(chg('PROPOSED', 'SHAPING', 'NOT_PLANNED'), 'shaping');
		ok(chg('SHAPING', 'READY', 'NOT_PLANNED'), 'ready');
		ok(
			dispatch('ProposeExecutionPlan', {
				executionPlanId: PLAN,
				workUnitId: PWU,
				steps: [mkStep(1)],
				transitions: [],
				retryPolicy: {},
				tacticalChangePolicy: {},
				escalationPolicy: {},
				terminationPolicy: {}
			}),
			'propose'
		);
		ok(dispatch('ApproveExecutionPlan', {}), 'approve');
		ok(chg('READY', 'ABANDONED', 'NOT_PLANNED'), 'abandon');
		const r = dispatch('ActivateExecutionPlan', { authorizedRuntimeBindingIds: [] });
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(r.error?.message, 'the OPENNESS guard, not the one-active-plan rule').toContain('RPH-PWU-010');
		expect((store.loadObject(PLAN)!.state as { status: string }).status).toBe('APPROVED');
	});

	it('authoring is NOT executing: proposing and approving on a closed PWU remain ACCEPTED (§20.2)', () => {
		// The over-refusal guard. §20.2 is explicit that approval grants no runtime privileges, so neither
		// authoring nor approving is gated — only the acts that actually open or credit execution.
		ok(chg('PROPOSED', 'SHAPING', 'NOT_PLANNED'), 'shaping');
		ok(chg('SHAPING', 'READY', 'NOT_PLANNED'), 'ready');
		ok(chg('READY', 'ABANDONED', 'NOT_PLANNED'), 'abandon');
		ok(
			dispatch('ProposeExecutionPlan', {
				executionPlanId: PLAN,
				workUnitId: PWU,
				steps: [mkStep(1)],
				transitions: [],
				retryPolicy: {},
				tacticalChangePolicy: {},
				escalationPolicy: {},
				terminationPolicy: {}
			}),
			'propose on a closed PWU'
		);
		ok(dispatch('ApproveExecutionPlan', {}), 'approve on a closed PWU');
	});

	it('a LEGACY plan whose workUnitId names a non-PWU is refused at the GATE, not silently admitted', () => {
		// The fail-closed branch inside `pwuOpennessRefusal`. Once propose asserts the type (below) this branch is
		// unreachable through the bus — but it is NOT dead: it is the path a plan STORED BEFORE that rule takes,
		// which is the "legacy plans are never re-validated" residual this programme disclosed rather than closed.
		// Seeding it is what turns a defence-in-depth guard into one that can actually fail.
		activePlanWithRunningStep();
		seedForeignWorkUnitId_LEGACY_ONLY(store, PLAN, INTENT);
		const r = dispatch('StartExecutionStep', { stepId: sid(2) });
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
		expect(r.error?.message, 'a guard that fails OPEN on a malformed reference is not a guard').toContain(
			'does not resolve to a PROFESSIONAL_WORK_UNIT'
		);
		expect(stepStateOf(2)).toBe('QUEUED');
	});

	it('a plan whose workUnitId names a NON-PWU object is refused at propose (the read is TOTAL)', () => {
		// Without this, the openness gate reads `undefined` for a plan pointing at an Artifact and silently
		// admits it — a guard that fails OPEN on a malformed reference is not a guard.
		const r = dispatch('ProposeExecutionPlan', {
			executionPlanId: PLAN,
			workUnitId: INTENT, // a real object, wrong type
			steps: [mkStep(1)],
			transitions: [],
			retryPolicy: {},
			tacticalChangePolicy: {},
			escalationPolicy: {},
			terminationPolicy: {}
		});
		expect(r.status).toBe('REJECTED');
		expect(r.error?.message).toContain('PROFESSIONAL_WORK_UNIT');
	});
});
