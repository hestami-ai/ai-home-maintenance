// Drives ActivateExecutionPlan LIVE for TWO plans on the SAME PWU. Existing execution tests only ever activate
// one plan, so the one-active-plan-per-PWU guard has never been exercised at the call site — the kernel
// (canActivatePlan) is tested directly in rph-domain/src/execution.test.ts by passing otherActivePlanExists
// straight in, which proves the predicate and nothing about whether the pipeline can ever compute it as true.
//
// Guide "### 6.5 Critical transition guards" (docs/Janumi Canonical Implementation Context - Coding Agent
// Guide.md:617): "- One active Execution Plan exists per PWU."
// Guide "### 10.1 Canonical persistence model" (same file:1377): "- one active Plan per PWU;"
// DOC-002 "## 20.2 Execution Plan invariants" (docs/Recursive Professional Harness/Janumi Professional Workbench
// Recursive Professional Harness - Canonical Domain Model, Invariant Catalog, State Machines, and Event
// Contract.md:1242): "* A PWU may have only one active plan at a time."
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-12T00:00:00Z';
const actor = { actorId: 'u1', actorType: 'HUMAN' as const, displayName: 'A' };
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69G5H00';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5H10';
const PLAN_A = 'plan_01ARZ3NDEKTSV4RRFFQ69G5H20';
const PLAN_B = 'plan_01ARZ3NDEKTSV4RRFFQ69G5H30';

describe('ActivateExecutionPlan — one active plan per PWU (live pipeline)', () => {
	let store: SqliteStorageAdapter;
	let engine: Engine;
	let seq = 0;

	function dispatch(
		commandType: string,
		payload: unknown,
		targetAggregateId: string,
		targetAggregateType: string
	) {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType,
			targetAggregateId,
			issuedAt: TS,
			issuedBy: actor,
			correlationId: 'corr',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	}

	const planStatus = (planId: string) =>
		(store.loadObject(planId)?.state as { status: string } | undefined)?.status;

	// Propose a plan against PWU and drive it to APPROVED — the state ActivateExecutionPlan transitions from.
	function approvedPlan(planId: string) {
		const r = dispatch(
			'ProposeExecutionPlan',
			{
				executionPlanId: planId,
				workUnitId: PWU,
				steps: [
					{
						id: `${planId}-step`,
						executionPlanId: planId,
						stepType: 'MODEL_INVOCATION',
						purpose: 'do the work',
						inputBindings: [],
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
			},
			planId,
			'EXECUTION_PLAN'
		);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		const a = dispatch('ApproveExecutionPlan', {}, planId, 'EXECUTION_PLAN');
		expect(a.status, JSON.stringify(a.error)).toBe('ACCEPTED');
	}

	const activate = (planId: string) =>
		dispatch(
			'ActivateExecutionPlan',
			{ authorizedRuntimeBindingIds: [] },
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
		approvedPlan(PLAN_A);
		approvedPlan(PLAN_B);
	});

	it('rejects activating a SECOND plan while the PWU already has an ACTIVE one', () => {
		expect(activate(PLAN_A).status).toBe('ACCEPTED');
		expect(planStatus(PLAN_A)).toBe('ACTIVE');

		// PLAN_B names the same workUnitId and is APPROVED, so the ONLY thing that may stop it is the
		// one-active-plan-per-PWU guard. Its activation must be rejected.
		const second = activate(PLAN_B);
		expect(second.status).toBe('REJECTED');
		expect(second.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(planStatus(PLAN_B)).toBe('APPROVED');
	});

	it('leaves the PWU with exactly one ACTIVE plan after both activations are attempted', () => {
		activate(PLAN_A);
		activate(PLAN_B);
		const active = [PLAN_A, PLAN_B].filter((p) => planStatus(p) === 'ACTIVE');
		expect(active).toEqual([PLAN_A]);
	});
});
