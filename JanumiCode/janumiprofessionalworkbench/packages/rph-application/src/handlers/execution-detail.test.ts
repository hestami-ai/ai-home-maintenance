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

	/** Record a de minimis floor over the STEP's output. The step is a MODEL_INVOCATION, so §8.4 L841 makes
	 *  Reasoning Review mandatory and L854 blocks its protected transition without one — every completion
	 *  below therefore needs a floor, not just the one that asserts blocking. */
	let asmt = 0;
	function recordFloor(dispositions: Record<string, string>) {
		for (const [policyId, disposition] of Object.entries(dispositions)) {
			const id = `asmt_${String(++asmt).padStart(26, '0')}`;
			dispatch(
				'RequestAssuranceAssessment',
				{
					assessmentId: id,
					assurancePolicyId: policyId,
					policyVersion: '1.0.0',
					subjectObjectIds: [STEP],
					subjectSemanticVersions: { [STEP]: 1 },
					claimIds: []
				},
				id,
				'ASSURANCE_ASSESSMENT'
			);
			dispatch(
				'CompleteAssuranceAssessment',
				{ validatorResult: { dispositionRecommendation: disposition } },
				id,
				'ASSURANCE_ASSESSMENT'
			);
		}
	}
	const SATISFIED_FLOOR = {
		'floor.schema-invariant': 'SATISFIED',
		'floor.identity-provenance': 'SATISFIED',
		'floor.reasoning-review': 'SATISFIED'
	};

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
		// This step is a MODEL_INVOCATION. Until the floor gate derived `aiProduced` honestly it completed with
		// NO Reasoning Review at all, and this test passed — it encoded the defect rather than the contract.
		// The floor is the step's premise, not this test's subject: the subject is still "a started step with a
		// recorded result completes".
		recordFloor(SATISFIED_FLOOR);
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

	it('a recorded non-SATISFIED floor over the step output blocks completion (§8.4, INV-5)', () => {
		dispatch('StartExecutionStep', { stepId: STEP }, PLAN, 'EXECUTION_PLAN');
		expect(stepState()).toBe('RUNNING');

		// Record a de minimis floor over the step's output whose independent reasoning review is REJECTED.
		recordFloor({ ...SATISFIED_FLOOR, 'floor.reasoning-review': 'REJECTED' });

		const complete = {
			executionStepId: STEP,
			executionAttemptId: 'attempt_01ARZ3NDEKTSV4RRFFQ69G5FF0',
			resultStatus: 'SUCCEEDED',
			outputArtifactIds: ['art_01ARZ3NDEKTSV4RRFFQ69G5FG0'],
			proposedEvidenceIds: [],
			detectedAssumptionIds: [],
			structuredResult: {},
			executionProvenance: {}
		};
		// The floor gate blocks completion — step success does not imply assurance (INV-5).
		const blocked = dispatch('CompleteExecutionStep', complete, PLAN, 'EXECUTION_PLAN');
		expect(blocked.status).toBe('REJECTED');
		expect(blocked.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(stepState()).toBe('RUNNING');
		// Only the failed policy blocks; the two SATISFIED ones do not appear.
		expect(blocked.error?.message).toContain('floor.reasoning-review=REJECTED');
	});

	/**
	 * BLOCKED ON §16 item 12 — a real capability, deliberately unreachable, NOT a deleted assertion.
	 *
	 * §8.15 permits a governance waiver over the floor; the floor is not among the four things §8.4 L854 says
	 * may never suppress Reasoning Review. So this test's EXPECTATION is legitimate. What is missing is the
	 * contract: §8.15 L1101 / DOC-004 §12.2 require a waiver to record "the exact policy, criterion, finding,
	 * object and semantic version", and the Decision object has no criterion field, DOC-007 defines no waiver
	 * instance shape, and the vocab's citation for `scope` points at DOC-002 §34.2 — a bare list of command
	 * names. §16 item 12 names it exactly: "waiver lacks a complete instance/wire/storage contract."
	 *
	 * Until then the gate fails closed, because the alternative was the Boolean item 12 forbids by name: this
	 * very waiver — scoped in its own payload to "de minimis assurance floor" — used to discharge a REJECTED
	 * independent Reasoning Review. Un-skip when item 12 lands a criterion binding; `waiverCovers` and
	 * `waiverStillDischarges` (rph-domain) are already written and already unit-proven.
	 */
	it.skip('an EFFECTIVE waiver scoped to the floor lets a blocked step complete (§8.15; needs §16 item 12)', () => {
		dispatch('StartExecutionStep', { stepId: STEP }, PLAN, 'EXECUTION_PLAN');
		recordFloor({ ...SATISFIED_FLOOR, 'floor.reasoning-review': 'REJECTED' });
		const complete = {
			executionStepId: STEP,
			executionAttemptId: 'attempt_01ARZ3NDEKTSV4RRFFQ69G5FF0',
			resultStatus: 'SUCCEEDED',
			outputArtifactIds: ['art_01ARZ3NDEKTSV4RRFFQ69G5FG0'],
			proposedEvidenceIds: [],
			detectedAssumptionIds: [],
			structuredResult: {},
			executionProvenance: {}
		};
		const WAIVER = 'dec_01ARZ3NDEKTSV4RRFFQ69G5FH0';
		dispatch(
			'RequestWaiver',
			{
				subjectObjectIds: [STEP],
				scope: 'floor.reasoning-review',
				rationale: 'Accepted residual risk.',
				duration: 'until superseded',
				affectedObjectIds: [STEP]
			},
			WAIVER,
			'DECISION'
		);
		dispatch(
			'GrantWaiver',
			{ waiverDecisionId: WAIVER, effectiveAt: TS, duration: 'until superseded' },
			WAIVER,
			'DECISION'
		);
		const done = dispatch('CompleteExecutionStep', complete, PLAN, 'EXECUTION_PLAN');
		expect(done.status, JSON.stringify(done.error)).toBe('ACCEPTED');
		expect(stepState()).toBe('SUCCEEDED');
	});
});
