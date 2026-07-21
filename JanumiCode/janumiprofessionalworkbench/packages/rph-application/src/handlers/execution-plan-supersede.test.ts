// JAN-EXECPLAN-DR-002 DWP-02 — SupersedeExecutionPlan drives {…|ACTIVE}→SUPERSEDED, validating that the cited
// successor resolves to an EXECUTION_PLAN on the SAME PWU (§19 L3-11). RPH-EXE-002 ("a superseded plan creates no
// new execution attempts and no new step may begin") is enforced on BOTH startExecutionStep AND retryExecutionStep
// — a retry re-opens the attempt cycle, which the start-only precheck did not cover (§19 L3-5).
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-12T00:00:00Z';
const actor = { actorId: 'u1', actorType: 'HUMAN' as const, displayName: 'A' };
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69G5K00';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5K10';
const PWU2 = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5K11';
const PLAN_A = 'plan_01ARZ3NDEKTSV4RRFFQ69G5K20'; // the plan we supersede (ACTIVE, on PWU)
const PLAN_B = 'plan_01ARZ3NDEKTSV4RRFFQ69G5K30'; // valid same-PWU successor
const PLAN_C = 'plan_01ARZ3NDEKTSV4RRFFQ69G5K40'; // foreign successor (on PWU2)
const S_QUEUED = `${PLAN_A}-sq`;
const S_FAILED = `${PLAN_A}-sf`;

describe('SupersedeExecutionPlan + RPH-EXE-002 (DWP-02)', () => {
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

	const planStatus = (planId: string) =>
		(store.loadObject(planId)?.state as { status?: string } | undefined)?.status;

	const mkStep = (planId: string, id: string, stepState: string) => ({
		id,
		executionPlanId: planId,
		stepType: 'TRANSFORMATION',
		purpose: 'work',
		inputBindings: [],
		outputBindings: [],
		preconditions: [],
		postconditions: [],
		stepState
	});

	function proposePwu(pwuId: string) {
		dispatch(
			'ProposePwu',
			{
				pwuId,
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
			pwuId,
			'PROFESSIONAL_WORK_UNIT'
		);
	}

	function proposePlan(planId: string, pwuId: string, steps: ReturnType<typeof mkStep>[]) {
		expect(
			dispatch(
				'ProposeExecutionPlan',
				{
					executionPlanId: planId,
					workUnitId: pwuId,
					steps,
					transitions: [],
					retryPolicy: {},
					tacticalChangePolicy: {},
					escalationPolicy: {},
					terminationPolicy: {}
				},
				planId,
				'EXECUTION_PLAN'
			).status
		).toBe('ACCEPTED');
	}

	const supersede = (planId: string, successorId: string) =>
		dispatch(
			'SupersedeExecutionPlan',
			{ supersedingExecutionPlanId: successorId },
			planId,
			'EXECUTION_PLAN'
		);

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
		proposePwu(PWU);
		proposePwu(PWU2);
		// PLAN_A: ACTIVE on PWU, with a QUEUED and a FAILED step (to probe start + retry after supersession).
		proposePlan(PLAN_A, PWU, [mkStep(PLAN_A, S_QUEUED, 'QUEUED'), mkStep(PLAN_A, S_FAILED, 'FAILED')]);
		dispatch('ApproveExecutionPlan', {}, PLAN_A, 'EXECUTION_PLAN');
		dispatch('ActivateExecutionPlan', { authorizedRuntimeBindingIds: [] }, PLAN_A, 'EXECUTION_PLAN');
		// PLAN_B: a valid same-PWU successor (need only exist). PLAN_C: a foreign successor on PWU2.
		proposePlan(PLAN_B, PWU, [mkStep(PLAN_B, `${PLAN_B}-s`, 'QUEUED')]);
		proposePlan(PLAN_C, PWU2, [mkStep(PLAN_C, `${PLAN_C}-s`, 'QUEUED')]);
	});

	it('supersedes an ACTIVE plan citing a valid same-PWU successor', () => {
		const r = supersede(PLAN_A, PLAN_B);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(planStatus(PLAN_A)).toBe('SUPERSEDED');
	});

	it('REJECTS a supersession citing a nonexistent successor (L3-11)', () => {
		const r = supersede(PLAN_A, 'plan_01ARZ3NDEKTSV4RRFFQ69G5KZZ0');
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
		expect(planStatus(PLAN_A)).toBe('ACTIVE');
	});

	it('REJECTS a supersession citing a successor on a DIFFERENT PWU (L3-11)', () => {
		const r = supersede(PLAN_A, PLAN_C);
		expect(r.status).toBe('REJECTED');
		expect(r.error?.message).toContain('different PWU');
		expect(planStatus(PLAN_A)).toBe('ACTIVE');
	});

	it('RPH-EXE-002: after supersession, neither StartExecutionStep NOR RetryExecutionStep may proceed (L3-5)', () => {
		expect(supersede(PLAN_A, PLAN_B).status).toBe('ACCEPTED');
		const start = dispatch('StartExecutionStep', { stepId: S_QUEUED }, PLAN_A, 'EXECUTION_PLAN');
		expect(start.status, 'start under a superseded plan must reject').toBe('REJECTED');
		expect(start.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		const retry = dispatch('RetryExecutionStep', { stepId: S_FAILED }, PLAN_A, 'EXECUTION_PLAN');
		expect(retry.status, 'retry under a superseded plan must reject (RPH-EXE-002)').toBe('REJECTED');
		expect(retry.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(retry.error?.message).toContain('RPH-EXE-002');
	});

	it('REJECTS superseding a terminal (CANCELLED) plan — illegal transition', () => {
		dispatch('CancelExecutionPlan', { reason: 'x' }, PLAN_A, 'EXECUTION_PLAN');
		expect(planStatus(PLAN_A)).toBe('CANCELLED');
		expect(supersede(PLAN_A, PLAN_B).error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
	});
});
