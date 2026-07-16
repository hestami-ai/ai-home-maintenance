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
	function recordFloor(dispositions: Record<string, string>): Record<string, string> {
		const ids: Record<string, string> = {};
		for (const [policyId, disposition] of Object.entries(dispositions)) {
			const id = `asmt_${String(++asmt).padStart(26, '0')}`;
			ids[policyId] = id;
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
		return ids;
	}

	/** Record an OPEN finding against an assessment — what a waiver must name to discharge (DOC-004 §12.2). */
	function recordFinding(assessmentId: string, findingCode: string): string {
		const id = `obs_${String(++asmt).padStart(26, '0')}`;
		dispatch(
			'RecordAssuranceObservation',
			{
				assessmentId,
				observationType: 'FINDING',
				findingCode,
				severity: 'BLOCKING',
				statement: `${findingCode} not satisfied.`
			},
			id,
			'ASSURANCE_OBSERVATION'
		);
		return id;
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
	 * STILL BLOCKED — but the reason CHANGED, and the new one is narrower and concrete.
	 *
	 * §16 item 12 is no longer the blocker: `WaiverDetail` now gives the waiver its policy/criterion/expiry, and the
	 * authoring-plane twin (pwa-authoring.test.ts) proves the capability works there — an exactly-scoped waiver
	 * discharges its policy, and a waiver naming a different criterion does not.
	 *
	 * What blocks it HERE is the execution plane's missing subject-version binding. DOC-004 §12.2 requires a waiver
	 * to name "exact object and semantic version" and RPH-GOV-005 forbids bleeding "to another version", so
	 * `waiverCovers` is version-exact. The execution-plane gate passes no `subjectVersion` (an ExecutionStep is a
	 * sub-object of the plan and carries no `semanticVersion`), so version-exactness is unverifiable and
	 * `waiverDischargesFloorPolicy` fails closed. This is the same hole flagged in Increment 2: the execution plane
	 * also accepts a STALE floor for the same reason, which §8.4 L854 forbids.
	 *
	 * UN-SKIP WHEN: the execution plane binds a semantic version to a step's floor subject. Then this passes
	 * unchanged — the gate, the contract, and the kernel are all already in place.
	 */
	it.skip('an EFFECTIVE waiver naming the exact failed criterion lets a blocked step complete (needs execution-plane subject-version binding)', () => {
		dispatch('StartExecutionStep', { stepId: STEP }, PLAN, 'EXECUTION_PLAN');
		const ids = recordFloor({ ...SATISFIED_FLOOR, 'floor.reasoning-review': 'REJECTED' });
		const findingId = recordFinding(ids['floor.reasoning-review']!, 'RR-04-completeness-shortcut');
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
		expect(dispatch('CompleteExecutionStep', complete, PLAN, 'EXECUTION_PLAN').status).toBe(
			'REJECTED'
		);
		const WAIVER = 'dec_01ARZ3NDEKTSV4RRFFQ69G5FH0';
		dispatch(
			'RequestWaiver',
			{
				subjectObjectIds: [STEP],
				scope: 'floor.reasoning-review',
				rationale: 'Accepted residual risk.',
				duration: 'until superseded',
				affectedObjectIds: [STEP],
				waivedPolicyId: 'floor.reasoning-review',
				waivedCriterionId: 'RR-04-completeness-shortcut',
				waivedFindingIds: [findingId],
				compensatingControls: ['Manual review before release.'],
				reviewConditions: ['Revisit next attempt.']
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
