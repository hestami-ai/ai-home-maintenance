// JAN-EXECPLAN-DR-003 DWP-02 — SkipExecutionStep (fail-closed canSkipStep) + CancelExecutionStep (cleanup), making
// the ratified →SKIPPED / →CANCELLED step arrows reachable. Skip is FAIL-CLOSED: mandatoriness is
// `ExecutionStep.strength`, DECLARED BY THE PLAN (REG-F-105, ruled REG-D-041 — it was `mandatory` in the skip
// PAYLOAD, i.e. asserted by the very party §21.1 constrains), and a step that declares nothing, or declares
// CONDITIONAL, needs an authorized waiver/revision (never fail-open). Cancel is CLEANUP:
// permitted even under a SUPERSEDED plan (RPH-EXE-002 forbids new WORK, not termination). A SKIPPED step advances the
// DWP-01 start-gate (SKIPPED is terminal-success). Exec ≠ assurance (INV-5).
import type { DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-12T00:00:00Z';
const actor = { actorId: 'u1', actorType: 'HUMAN' as const, displayName: 'A' };
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69G5M00';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5M10';
const PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69G5M20';
const PLAN2 = 'plan_01ARZ3NDEKTSV4RRFFQ69G5M30';

describe('SkipExecutionStep / CancelExecutionStep (DWP-02)', () => {
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
			correlationId: 'corr',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	}

	const stepId = (i: number) => `${PLAN}-s${i}`;
	const stepStateOf = (i: number, planId = PLAN) => {
		const plan = store.loadObject(planId)?.state as { steps: Array<{ id: string; stepState: string }> };
		return plan.steps.find((s) => s.id === stepId(i))?.stepState;
	};
	const planStatus = (planId: string) =>
		(store.loadObject(planId)?.state as { status?: string } | undefined)?.status;

	const step = (i: number, stepState: string, strength?: string) => ({
		id: stepId(i),
		executionPlanId: PLAN,
		stepType: 'TRANSFORMATION',
		purpose: `work ${i}`,
		inputBindings: [],
		outputBindings: [],
		preconditions: [],
		postconditions: [],
		stepState,
		// Omitted on purpose when not supplied: an absent `strength` is the REAL shape of every plan authored
		// before 2026-08-10, and the fail-closed default is one of the things this file tests.
		...(strength === undefined ? {} : { strength })
	});

	/**
	 * Propose + approve + activate PLAN with steps at the given states, and (optionally) the given declared
	 * strengths. `strengths` is positional and sparse: an entry left undefined declares nothing, which is the
	 * pre-REG-F-105 shape and must still be treated as MANDATORY.
	 */
	function activePlan(stepStates: string[], strengths: (string | undefined)[] = []) {
		const r = dispatch(
			'ProposeExecutionPlan',
			{
				executionPlanId: PLAN,
				workUnitId: PWU,
				steps: stepStates.map((s, i) => step(i + 1, s, strengths[i])),
				transitions: [],
				retryPolicy: {},
				tacticalChangePolicy: {},
				escalationPolicy: {},
				terminationPolicy: {}
			},
			PLAN,
			'EXECUTION_PLAN'
		);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(dispatch('ApproveExecutionPlan', {}, PLAN, 'EXECUTION_PLAN').status).toBe('ACCEPTED');
		expect(
			dispatch('ActivateExecutionPlan', { authorizedRuntimeBindingIds: [] }, PLAN, 'EXECUTION_PLAN')
				.status
		).toBe('ACCEPTED');
	}

	const skip = (i: number, extra: Record<string, unknown> = {}) =>
		dispatch('SkipExecutionStep', { stepId: stepId(i), ...extra }, PLAN, 'EXECUTION_PLAN');
	const cancel = (i: number, reason = 'no longer needed') =>
		dispatch('CancelExecutionStep', { stepId: stepId(i), reason }, PLAN, 'EXECUTION_PLAN');
	const start = (i: number) => dispatch('StartExecutionStep', { stepId: stepId(i) }, PLAN, 'EXECUTION_PLAN');

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

	// ── Skip: fail-closed on the PLAN'S declaration ───────────────────────────────────────────────────────────────
	// All three cases send the IDENTICAL request — `{ stepId }` and nothing else. What differs is what the approved
	// plan says about the step. Before REG-F-105 the difference was in the request, which meant the caller decided
	// whether the rule applied to it; these three now differ only in a fact the caller cannot reach.
	it('skips a step the PLAN declares ADVISORY, with no waiver → SKIPPED', () => {
		activePlan(['QUEUED', 'QUEUED'], [undefined, 'ADVISORY']);
		const r = skip(2);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(stepStateOf(2)).toBe('SKIPPED');
	});

	it('REJECTS skipping a step the PLAN declares MANDATORY, with no waiver — fail-closed (§21.1)', () => {
		activePlan(['QUEUED'], ['MANDATORY']);
		const r = skip(1);
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(stepStateOf(1)).toBe('QUEUED'); // untouched
	});

	it('REJECTS skipping a step that declares NO strength — absent is mandatory (never fail-open)', () => {
		// Every plan authored before the field, including the seeded reference undertaking, is this shape.
		activePlan(['QUEUED']);
		const r = skip(1);
		expect(r.status, 'an absent strength must default to MANDATORY').toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
	});

	it('REJECTS skipping a CONDITIONAL step — ambiguity resolves to material (Guide §8.4)', () => {
		// No ratified applicability predicate exists to evaluate the condition against, so CONDITIONAL gates
		// exactly as MANDATORY does. The day the predicate is ratified, this is a test to revisit deliberately.
		activePlan(['QUEUED'], ['CONDITIONAL']);
		const r = skip(1);
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(stepStateOf(1)).toBe('QUEUED');
	});

	// REWRITTEN by JAN-EXECREM WP-12c (F-30), and the rewrite is the point. This case passed a LITERAL STRING —
	// `'dec_waiver_1'` — naming no object anywhere, and it went through, because the handler asked
	// `!!p.waiverOrRevisionId`. So the test that existed to prove §21.1's authorization worked was in fact the
	// proof that it did not: it ENSHRINED the fail-open. A real EFFECTIVE decision is minted instead.
	it('ALLOWS skipping a MANDATORY step WITH a REAL authorized plan revision → SKIPPED', () => {
		activePlan(['QUEUED']);
		const decisionId = 'dec_01ARZ3NDEKTSV4RRFFQ69G5M90';
		expect(
			dispatch(
				'ProposeDecision',
				{
					decisionType: 'REPLAN',
					subjectObjectIds: [PLAN],
					selectedOption: 'skip the step under an authorized plan revision',
					rationale: 'the step was superseded by a change of approach',
					authority: actor,
					executionSkipAuthorization: {
						executionPlanId: PLAN,
						executionStepIds: [stepId(1)],
						rationale: 'this step alone is retired by the revision'
					}
				},
				decisionId,
				'DECISION'
			).status
		).toBe('ACCEPTED');
		expect(
			dispatch(
				'ApproveDecision',
				{
					selectedOption: 'skip the step under an authorized plan revision',
					rationale: 'approved',
					consideredEvidenceIds: [],
					consideredObservationIds: [],
					subjectSemanticVersions: { [PLAN]: 1 }
				},
				decisionId,
				'DECISION'
			).status
		).toBe('ACCEPTED');

		const r = skip(1, { waiverOrRevisionId: decisionId });
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(stepStateOf(1)).toBe('SKIPPED');
	});

	it('REFUSES the literal string this test used to pass — a bare id is not an authorization', () => {
		// The kill test for the rewrite above. `'dec_waiver_1'` names nothing; under the shipped code it retired a
		// mandatory step.
		activePlan(['QUEUED']);
		const r = skip(1, { waiverOrRevisionId: 'dec_waiver_1' });
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
		expect(r.error?.message).toContain('names no recorded object');
		expect(stepStateOf(1)).toBe('QUEUED');
	});

	it('a SKIPPED step advances the DWP-01 start-gate (the next step becomes startable)', () => {
		activePlan(['QUEUED', 'QUEUED'], ['ADVISORY']);
		expect(skip(1).status).toBe('ACCEPTED'); // s1 SKIPPED
		// s1 is terminal-success (SKIPPED) → the gate now lets s2 start (no deadlock).
		const s2 = start(2);
		expect(s2.status, JSON.stringify(s2.error)).toBe('ACCEPTED');
		expect(stepStateOf(2)).toBe('RUNNING');
	});

	// ── Cancel: cleanup, even post-supersession ───────────────────────────────────────────────────────────────────
	it('cancels a RUNNING step → CANCELLED (records the reason on the event)', () => {
		activePlan(['QUEUED']);
		expect(start(1).status).toBe('ACCEPTED'); // s1 RUNNING
		const r = cancel(1, 'operator aborted');
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(stepStateOf(1)).toBe('CANCELLED');
		const evt = store.readAllEvents().find((e) => e.eventType === 'ExecutionStepCancelled');
		expect((evt?.payload as { reason?: string })?.reason).toBe('operator aborted');
	});

	it('cancels a step under a SUPERSEDED plan — cleanup is permitted post-supersession (RPH-EXE-002, §19 L3-M11)', () => {
		activePlan(['QUEUED']);
		// Supersede PLAN with a successor plan on the SAME PWU, then cancel the (now orphaned) step.
		const successor = {
			executionPlanId: PLAN2,
			workUnitId: PWU,
			steps: [{ ...step(1, 'QUEUED'), id: `${PLAN2}-s1`, executionPlanId: PLAN2 }],
			transitions: [],
			retryPolicy: {},
			tacticalChangePolicy: {},
			escalationPolicy: {},
			terminationPolicy: {}
		};
		expect(dispatch('ProposeExecutionPlan', successor, PLAN2, 'EXECUTION_PLAN').status).toBe('ACCEPTED');
		expect(
			dispatch('SupersedeExecutionPlan', { supersedingExecutionPlanId: PLAN2 }, PLAN, 'EXECUTION_PLAN')
				.status
		).toBe('ACCEPTED');
		expect(planStatus(PLAN)).toBe('SUPERSEDED');
		// Cancel is cleanup — no plan-ACTIVE precheck.
		const c = cancel(1);
		expect(c.status, JSON.stringify(c.error)).toBe('ACCEPTED');
		expect(stepStateOf(1)).toBe('CANCELLED');
	});

	it('REJECTS skip/start under a SUPERSEDED plan — those open NEW work (RPH-EXE-002)', () => {
		activePlan(['QUEUED'], ['ADVISORY']);
		const successor = {
			executionPlanId: PLAN2,
			workUnitId: PWU,
			steps: [{ ...step(1, 'QUEUED'), id: `${PLAN2}-s1`, executionPlanId: PLAN2 }],
			transitions: [],
			retryPolicy: {},
			tacticalChangePolicy: {},
			escalationPolicy: {},
			terminationPolicy: {}
		};
		dispatch('ProposeExecutionPlan', successor, PLAN2, 'EXECUTION_PLAN');
		dispatch('SupersedeExecutionPlan', { supersedingExecutionPlanId: PLAN2 }, PLAN, 'EXECUTION_PLAN');
		// ADVISORY on purpose: the refusal under test is RPH-EXE-002 (a superseded plan opens no new work). If the
		// step were MANDATORY the case would pass on the §21.1 refusal instead and assert nothing about supersession.
		expect(skip(1).error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(start(1).error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(stepStateOf(1)).toBe('QUEUED');
	});
});
