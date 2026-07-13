// Drives the embedded ExecutionStep lifecycle (start/complete) and the RuntimeBinding lifecycle LIVE, proving the
// remaining runtime commands are wired: a step advances QUEUED -> RUNNING -> SUCCEEDED inside the plan aggregate
// (and a completed step must record a result), and a runtime binding advances REQUESTED -> AUTHORIZED.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-12T00:00:00Z';
const actor = { actorId: 'u1', actorType: 'HUMAN' as const, displayName: 'A' };
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69G5FAV';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5FB0';
const PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69G5FC0';
const STEP = 'step_01ARZ3NDEKTSV4RRFFQ69G5FD0';
const BIND = 'bind_01ARZ3NDEKTSV4RRFFQ69G5FE0';

describe('ExecutionStep + RuntimeBinding handlers (live)', () => {
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

	function stepState(): string {
		const plan = store.loadObject(PLAN)?.state as { steps: Array<{ stepState: string }> };
		return plan.steps[0]!.stepState;
	}

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
		// A plan carrying one step already QUEUED (ready to run).
		dispatch(
			'ProposeExecutionPlan',
			{
				executionPlanId: PLAN,
				workUnitId: PWU,
				steps: [
					{
						id: STEP,
						executionPlanId: PLAN,
						stepType: 'MODEL_INVOCATION',
						purpose: 'generate architecture',
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
			PLAN,
			'EXECUTION_PLAN'
		);
		dispatch('ApproveExecutionPlan', {}, PLAN, 'EXECUTION_PLAN');
		dispatch('ActivateExecutionPlan', { authorizedRuntimeBindingIds: [] }, PLAN, 'EXECUTION_PLAN');
	});

	it('starts a step QUEUED -> RUNNING and completes it -> SUCCEEDED (with a recorded result)', () => {
		expect(stepState()).toBe('QUEUED');
		expect(dispatch('StartExecutionStep', { stepId: STEP }, PLAN, 'EXECUTION_PLAN').status).toBe(
			'ACCEPTED'
		);
		expect(stepState()).toBe('RUNNING');
		const done = dispatch(
			'CompleteExecutionStep',
			{
				executionStepId: STEP,
				executionAttemptId: 'attempt_01ARZ3NDEKTSV4RRFFQ69G5FF0',
				resultStatus: 'SUCCEEDED',
				outputArtifactIds: ['art_01ARZ3NDEKTSV4RRFFQ69G5FG0'],
				proposedEvidenceIds: [],
				detectedAssumptionIds: [],
				structuredResult: {},
				executionProvenance: {}
			},
			PLAN,
			'EXECUTION_PLAN'
		);
		expect(done.status).toBe('ACCEPTED');
		expect(stepState()).toBe('SUCCEEDED');
	});

	it('fails a running step (RUNNING -> FAILED) and retries it (FAILED -> QUEUED)', () => {
		dispatch('StartExecutionStep', { stepId: STEP }, PLAN, 'EXECUTION_PLAN');
		const r = dispatch(
			'FailExecutionStep',
			{ stepId: STEP, failureReason: 'boom' },
			PLAN,
			'EXECUTION_PLAN'
		);
		expect(r.status).toBe('ACCEPTED');
		expect(stepState()).toBe('FAILED');
		expect(dispatch('RetryExecutionStep', { stepId: STEP }, PLAN, 'EXECUTION_PLAN').status).toBe(
			'ACCEPTED'
		);
		expect(stepState()).toBe('QUEUED');
	});

	it('drives a runtime binding REQUESTED -> AUTHORIZED', () => {
		expect(
			dispatch(
				'RequestRuntimeBinding',
				{
					runtimeBindingId: BIND,
					executionStepId: STEP,
					roleId: 'architect',
					requestedCapabilities: []
				},
				BIND,
				'RUNTIME_BINDING'
			).status
		).toBe('ACCEPTED');
		expect(
			(store.loadObject(BIND)?.state as { authorizationStatus: string }).authorizationStatus
		).toBe('REQUESTED');
		expect(
			dispatch('AuthorizeRuntimeBinding', { grantedCapabilities: [] }, BIND, 'RUNTIME_BINDING')
				.status
		).toBe('ACCEPTED');
		expect(
			(store.loadObject(BIND)?.state as { authorizationStatus: string }).authorizationStatus
		).toBe('AUTHORIZED');
	});
});
