// JAN-EXECPLAN-DR-003 DWP-02 — SkipExecutionStep (fail-closed canSkipStep) + CancelExecutionStep (cleanup), making
// the ratified →SKIPPED / →CANCELLED step arrows reachable. Skip is FAIL-CLOSED: `mandatory` is caller-asserted and
// defaults to TRUE, so an unmarked step needs an authorized waiver/revision (never fail-open). Cancel is CLEANUP:
// permitted even under a SUPERSEDED plan (RPH-EXE-002 forbids new WORK, not termination). A SKIPPED step advances the
// DWP-01 start-gate (SKIPPED is terminal-success). Exec ≠ assurance (INV-5).
import type { DomainCommand } from '@janumipwb/rph-contracts';
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

	const step = (i: number, stepState: string) => ({
		id: stepId(i),
		executionPlanId: PLAN,
		stepType: 'TRANSFORMATION',
		purpose: `work ${i}`,
		inputBindings: [],
		outputBindings: [],
		preconditions: [],
		postconditions: [],
		stepState
	});

	/** Propose + approve + activate PLAN with steps at the given states. */
	function activePlan(stepStates: string[]) {
		const r = dispatch(
			'ProposeExecutionPlan',
			{
				executionPlanId: PLAN,
				workUnitId: PWU,
				steps: stepStates.map((s, i) => step(i + 1, s)),
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
	});

	// ── Skip: fail-closed on mandatory ────────────────────────────────────────────────────────────────────────────
	it('skips an explicitly OPTIONAL step (mandatory:false) with no waiver → SKIPPED', () => {
		activePlan(['QUEUED', 'QUEUED']);
		const r = skip(2, { mandatory: false });
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(stepStateOf(2)).toBe('SKIPPED');
	});

	it('REJECTS skipping a MANDATORY step (mandatory:true) with no waiver — fail-closed (§21.1)', () => {
		activePlan(['QUEUED']);
		const r = skip(1, { mandatory: true });
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(stepStateOf(1)).toBe('QUEUED'); // untouched
	});

	it('REJECTS skipping a step with mandatory OMITTED — the default is mandatory (never fail-open)', () => {
		activePlan(['QUEUED']);
		const r = skip(1); // no mandatory field at all
		expect(r.status, 'omitted mandatory must default to TRUE').toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
	});

	it('ALLOWS skipping a MANDATORY step WITH an authorized waiverOrRevisionId → SKIPPED', () => {
		activePlan(['QUEUED']);
		const r = skip(1, { mandatory: true, waiverOrRevisionId: 'dec_waiver_1' });
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(stepStateOf(1)).toBe('SKIPPED');
	});

	it('a SKIPPED step advances the DWP-01 start-gate (the next step becomes startable)', () => {
		activePlan(['QUEUED', 'QUEUED']);
		expect(skip(1, { mandatory: false }).status).toBe('ACCEPTED'); // s1 SKIPPED
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
		activePlan(['QUEUED']);
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
		expect(skip(1, { mandatory: false }).error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(start(1).error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(stepStateOf(1)).toBe('QUEUED');
	});
});
