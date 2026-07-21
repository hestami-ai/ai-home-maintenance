// JAN-EXECPLAN-DR-002 DWP-01 — CompleteExecutionPlan / FailExecutionPlan drive the ratified data-only plan-terminal
// transitions (ACTIVE→COMPLETED / →FAILED). The completion CONDITION (§20.1 "all required steps reach terminal
// success") is a SUCCESS ALLOW-LIST — steps.length>0 AND every step SUCCEEDED-or-SKIPPED — NOT the negation
// "terminal ∧ ¬FAILED" (which would admit CANCELLED/SUPERSEDED, §19 L3-2) and NOT vacuous on an empty plan (L3-1).
// Steps are seeded directly at their target stepState in ProposeExecutionPlan (no step handlers run — SKIPPED/
// CANCELLED/SUPERSEDED have none, 3C), which is exactly how the allow-list is exercised against every terminal state.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-12T00:00:00Z';
const actor = { actorId: 'u1', actorType: 'HUMAN' as const, displayName: 'A' };
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69G5J00';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5J10';
const PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69G5J20';

describe('CompleteExecutionPlan / FailExecutionPlan — plan-terminal lifecycle (DWP-01)', () => {
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

	const step = (i: number, stepState: string) => ({
		id: `${PLAN}-s${i}`,
		executionPlanId: PLAN,
		stepType: 'TRANSFORMATION',
		purpose: 'work',
		inputBindings: [],
		outputBindings: [],
		preconditions: [],
		postconditions: [],
		stepState
	});

	/** Propose a plan with steps at the given states + approve it (UNDER_REVIEW→APPROVED). */
	function approvedPlan(stepStates: string[]) {
		const r = dispatch(
			'ProposeExecutionPlan',
			{
				executionPlanId: PLAN,
				workUnitId: PWU,
				steps: stepStates.map((s, i) => step(i, s)),
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
	}

	/** Propose + approve + activate a plan with steps at the given states. */
	function activePlan(stepStates: string[]) {
		approvedPlan(stepStates);
		expect(
			dispatch('ActivateExecutionPlan', { authorizedRuntimeBindingIds: [] }, PLAN, 'EXECUTION_PLAN')
				.status
		).toBe('ACCEPTED');
	}

	const complete = () => dispatch('CompleteExecutionPlan', {}, PLAN, 'EXECUTION_PLAN');
	const fail = (reason = 'unrecoverable') =>
		dispatch('FailExecutionPlan', { failureReason: reason }, PLAN, 'EXECUTION_PLAN');

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

	it('COMPLETES an ACTIVE plan whose every step is SUCCEEDED', () => {
		activePlan(['SUCCEEDED', 'SUCCEEDED']);
		const r = complete();
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(planStatus(PLAN)).toBe('COMPLETED');
	});

	it('COMPLETES when steps are SUCCEEDED or (authorized-)SKIPPED', () => {
		activePlan(['SUCCEEDED', 'SKIPPED']);
		expect(complete().status).toBe('ACCEPTED');
		expect(planStatus(PLAN)).toBe('COMPLETED');
	});

	it('REJECTS completing an EMPTY-step plan (no vacuous completion, L3-1)', () => {
		activePlan([]);
		const r = complete();
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(r.error?.message).toContain('no steps');
		expect(planStatus(PLAN)).toBe('ACTIVE');
	});

	it('REJECTS completing with a non-terminal (QUEUED/RUNNING) step', () => {
		activePlan(['SUCCEEDED', 'QUEUED']);
		expect(complete().status).toBe('REJECTED');
		expect(planStatus(PLAN)).toBe('ACTIVE');
	});

	it('REJECTS completing with a FAILED step', () => {
		activePlan(['SUCCEEDED', 'FAILED']);
		expect(complete().error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(planStatus(PLAN)).toBe('ACTIVE');
	});

	it('REJECTS completing with a CANCELLED or SUPERSEDED step (allow-list, not terminal∧¬FAILED — L3-2)', () => {
		activePlan(['SUCCEEDED', 'CANCELLED']);
		expect(complete().status, 'CANCELLED must not count as success').toBe('REJECTED');
		expect(planStatus(PLAN)).toBe('ACTIVE');
	});

	it('REJECTS completing an ALL-SKIPPED plan — ≥1 step must SUCCEED (DR-003 DWP-02, §19 L3-M7)', () => {
		// Now that SkipExecutionStep makes SKIPPED reachable, an all-SKIPPED plan satisfies the allow-list yet has
		// PRODUCED NOTHING — it must not "complete". This aligns the plan-level rule with the ratified PWU-level
		// rejectUnbackedExecutionSuccess (which needs a SUCCEEDED step). Fail or supersede such a plan instead.
		activePlan(['SKIPPED', 'SKIPPED']);
		const r = complete();
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(r.error?.message).toContain('no SUCCEEDED step');
		expect(planStatus(PLAN)).toBe('ACTIVE');
	});

	it('FAILS an ACTIVE plan (records the failureReason)', () => {
		activePlan(['SUCCEEDED', 'FAILED']);
		expect(fail('a step failed unrecoverably').status).toBe('ACCEPTED');
		expect(planStatus(PLAN)).toBe('FAILED');
	});

	it('REJECTS completing / failing a non-ACTIVE (APPROVED) plan — illegal transition', () => {
		approvedPlan(['SUCCEEDED']); // approved, NOT activated
		expect(complete().error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(fail().error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(planStatus(PLAN)).toBe('APPROVED');
	});
});
