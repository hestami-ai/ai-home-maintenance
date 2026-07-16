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
const ATTEMPT = 'attempt_01ARZ3NDEKTSV4RRFFQ69G5FF0';
/** The step's OUTPUT — and therefore the floor's subject. Recorded as a real Artifact (DOC-009 §18.1), not a
 *  dangling id: until RecordArtifact existed, this fixture named an object that was never created, and the gate
 *  only tolerated it because it subjected over the STEP instead of the result. */
const ART = 'art_01ARZ3NDEKTSV4RRFFQ69G5FG0';

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

	/** Record the step's OUTPUT as a real Artifact — the floor's subject, and the only thing here that can BE one:
	 *  DOC-004 invariant 2 requires an assessment to identify its subject semantic version, and an ExecutionStep
	 *  has no envelope to carry one. Fields per DOC-009 §18.1. */
	function recordArtifact(id = ART) {
		dispatch(
			'RecordArtifact',
			{
				artifactId: id,
				artifactType: 'ARCHITECTURE_BASELINE',
				mediaType: 'text/markdown',
				storageProvider: 'workspace-local',
				storageKey: `artifacts/${id}.md`,
				contentHash: `sha256:${id}`,
				producingPwuId: PWU,
				producingExecutionAttemptId: ATTEMPT,
				securityClassification: 'INTERNAL',
				retentionClass: 'PROJECT_LIFETIME',
				status: 'RECORDED'
			},
			id,
			'ARTIFACT'
		);
	}

	/** Record a de minimis floor over the step's OUTPUT (the Artifact). The step is a MODEL_INVOCATION, so §8.4
	 *  L841 makes Reasoning Review mandatory and L854 blocks its protected transition without one — every
	 *  completion below therefore needs a floor, not just the one that asserts blocking.
	 *
	 *  The subject moved from STEP to ART: the floor gate now judges the result, per §8.4 L844 ("Each
	 *  independently downstream-consumable result is its own transformation boundary"). `subjectSemanticVersions`
	 *  is still asserted by the caller here because RequestAssuranceAssessment trusts the payload — a separate,
	 *  logged vacuity finding. The GATE, however, derives the version from the store, so a lie here would not
	 *  buy a pass. */
	let asmt = 0;
	function recordFloor(
		dispositions: Record<string, string>,
		subject = ART
	): Record<string, string> {
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
					subjectObjectIds: [subject],
					subjectSemanticVersions: { [subject]: 1 },
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
		// recorded result completes". Recording the output is likewise premise: this fixture used to name an
		// artifact id that no command could create, which only worked while the gate looked at the step instead.
		recordArtifact();
		recordFloor(SATISFIED_FLOOR);
		const done = dispatch(
			'CompleteExecutionStep',
			{
				executionStepId: STEP,
				executionAttemptId: ATTEMPT,
				resultStatus: 'SUCCEEDED',
				outputArtifactIds: [ART],
				proposedEvidenceIds: [],
				detectedAssumptionIds: [],
				structuredResult: {},
				executionProvenance: {}
			},
			PLAN,
			'EXECUTION_PLAN'
		);
		expect(done.status, JSON.stringify(done.error)).toBe('ACCEPTED');
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
		recordArtifact();
		recordFloor({ ...SATISFIED_FLOOR, 'floor.reasoning-review': 'REJECTED' });

		const complete = {
			executionStepId: STEP,
			executionAttemptId: ATTEMPT,
			resultStatus: 'SUCCEEDED',
			outputArtifactIds: [ART],
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
	 * UN-SKIPPED 2026-07-16 — and the reason it was skipped was MY OWN ERROR, recorded here because the error is
	 * more instructive than the fix.
	 *
	 * This test previously read: "UN-SKIP WHEN: the execution plane binds a semantic version to a step's floor
	 * subject." That was wrong, and wrong in a dangerous direction: it framed the blocker as a small piece of
	 * missing wiring, when the corpus in fact FORBIDS what it asked for. An ExecutionStep can never carry a
	 * semanticVersion — DOC-002 §21's interface does not extend ObjectEnvelope, EXECUTION_STEP is absent from
	 * §4's ProfessionalWorkObjectType union, and DOC-009 §10.2's `execution_steps` is the one execution table
	 * whose id does NOT reference `professional_work_objects`. Had I "un-skipped" it as written, I would have
	 * minted a version for a non-object to satisfy a check — ceremony that makes the gate report success.
	 *
	 * The real defect was the SUBJECT. §8.4 records the floor over the "material professional transformation" —
	 * "bind the exact subject/output" — and L844: "Each independently downstream-consumable result is its own
	 * transformation boundary." Never the step. The gate's own comment said "the step's OUTPUT" all along while
	 * the code passed the step id.
	 *
	 * So the floor now subjects over the Artifact, which CAN satisfy DOC-004 invariant 2 ("Every assessment
	 * identifies its subject semantic version") and DOC-004 §12.2's "exact object and semantic version" — because
	 * DOC-009 §18.1 makes it a Professional Work Object with an envelope. The waiver was never the blocker; the
	 * subject was.
	 */
	it('an EFFECTIVE waiver naming the exact failed criterion lets a blocked step complete', () => {
		dispatch('StartExecutionStep', { stepId: STEP }, PLAN, 'EXECUTION_PLAN');
		recordArtifact();
		const ids = recordFloor({ ...SATISFIED_FLOOR, 'floor.reasoning-review': 'REJECTED' });
		const findingId = recordFinding(ids['floor.reasoning-review']!, 'RR-04-completeness-shortcut');
		const complete = {
			executionStepId: STEP,
			executionAttemptId: ATTEMPT,
			resultStatus: 'SUCCEEDED',
			outputArtifactIds: [ART],
			proposedEvidenceIds: [],
			detectedAssumptionIds: [],
			structuredResult: {},
			executionProvenance: {}
		};
		expect(dispatch('CompleteExecutionStep', complete, PLAN, 'EXECUTION_PLAN').status).toBe(
			'REJECTED'
		);
		const WAIVER = 'dec_01ARZ3NDEKTSV4RRFFQ69G5FH0';
		// The waiver names the ARTIFACT — the assessed object — not the step. That is what makes it a legal
		// waiver under DOC-004 §12.2, and it is version-bound because governance pins subjectSemanticVersions
		// from the store.
		dispatch(
			'RequestWaiver',
			{
				subjectObjectIds: [ART],
				scope: 'floor.reasoning-review',
				rationale: 'Accepted residual risk.',
				duration: 'until superseded',
				affectedObjectIds: [ART],
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
