// The execution-plane floor's SUBJECT — the two holes that closed when the floor stopped subjecting over the step.
//
// Both were invisible while the gate judged the ExecutionStep, because a step has no semanticVersion to judge at
// (DOC-002 §21's interface does not extend ObjectEnvelope; EXECUTION_STEP is absent from §4's object union;
// DOC-009 §10.2's `execution_steps` is the one execution table whose id does not reference
// professional_work_objects). Passing `subjectVersion: undefined` made floor-gate's version check vacuous:
// `opts.subjectVersion === undefined || rec?.version === opts.subjectVersion` is unconditionally true.
//
// 1. THE STALE FLOOR — flagged in Increment 2 and disclosed as open: "the execution plane also accepts a STALE
//    floor for the same reason, which §8.4 L854 forbids" ("A missing, STALE, malformed, failed, unavailable, or
//    independence-invalid required review cannot satisfy assurance or permit its protected transition").
// 2. THE UNRECORDED-OUTPUT BYPASS — a step naming an output that is not a recorded object.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';
import { floorValidatorResult } from './__tests__/floor-fixtures.js';

const TS = '2026-07-16T00:00:00Z';
const AGENT: ActorReference = { actorId: 'agent-9', actorType: 'AGENT', displayName: 'Executor' };

const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69G5V00';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5V10';
const PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69G5V20';
const STEP = 'step_01ARZ3NDEKTSV4RRFFQ69G5V30';
const ATTEMPT = 'attempt_01ARZ3NDEKTSV4RRFFQ69G5V40';
const ART = 'art_01ARZ3NDEKTSV4RRFFQ69G5V50';
const GHOST = 'art_01ARZ3NDEKTSV4RRFFQ69G5V60';

describe('Execution floor subject: the result, at its exact version — not the step', () => {
	let store: SqliteStorageAdapter;
	let engine: Engine;
	let seq = 0;

	function d(commandType: string, payload: unknown, id: string, type: string) {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: type,
			targetAggregateId: id,
			issuedAt: TS,
			issuedBy: AGENT,
			correlationId: 'floor-subject',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	}

	const stepState = () =>
		(store.loadObject(PLAN)?.state as { steps: Array<{ stepState: string }> }).steps[0]!.stepState;

	function recordArtifact(id: string) {
		d(
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

	let asmt = 0;
	/** A full SATISFIED floor over `subject`, recorded against `atVersion`. */
	function recordSatisfiedFloor(subject: string, atVersion: number) {
		for (const policyId of [
			'floor.schema-invariant',
			'floor.identity-provenance',
			'floor.reasoning-review'
		]) {
			const id = `asmt_${String(++asmt).padStart(26, '0')}`;
			d(
				'RequestAssuranceAssessment',
				{
					assessmentId: id,
					assurancePolicyId: policyId,
					policyVersion: '1.0.0',
					subjectObjectIds: [subject],
					subjectSemanticVersions: { [subject]: atVersion },
					claimIds: []
				},
				id,
				'ASSURANCE_ASSESSMENT'
			);
			d(
				'CompleteAssuranceAssessment',
				{
					validatorResult: floorValidatorResult({
						assessmentId: id,
						policyId,
						subjectId: subject,
						subjectSemanticVersion: atVersion,
						disposition: 'SATISFIED'
					})
				},
				id,
				'ASSURANCE_ASSESSMENT'
			);
		}
	}

	const completePayload = (artifactIds: string[]) => ({
		executionStepId: STEP,
		executionAttemptId: ATTEMPT,
		resultStatus: 'SUCCEEDED',
		outputArtifactIds: artifactIds,
		proposedEvidenceIds: [],
		detectedAssumptionIds: [],
		structuredResult: {},
		executionProvenance: {}
	});

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		asmt = 0;
		engine = new Engine({ store, now: () => TS, newEventId: () => `e${++seq}` });
		d(
			'CaptureIntent',
			{ intentId: INTENT, originatingExpression: 'x', ontologyId: 'o', ontologyVersion: '1' },
			INTENT,
			'INTENT'
		);
		d(
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
					consequence: 'HIGH',
					uncertainty: 'HIGH',
					irreversibility: 'HIGH',
					securitySensitivity: 'HIGH',
					regulatoryExposure: 'HIGH'
				}
			},
			PWU,
			'PROFESSIONAL_WORK_UNIT'
		);
		d(
			'ProposeExecutionPlan',
			{
				executionPlanId: PLAN,
				workUnitId: PWU,
				steps: [
					{
						id: STEP,
						executionPlanId: PLAN,
						stepType: 'MODEL_INVOCATION',
						purpose: 'generate the architecture',
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
		d('ApproveExecutionPlan', {}, PLAN, 'EXECUTION_PLAN');
		d('ActivateExecutionPlan', { authorizedRuntimeBindingIds: [] }, PLAN, 'EXECUTION_PLAN');
		d('StartExecutionStep', { stepId: STEP }, PLAN, 'EXECUTION_PLAN');
	});

	it('a floor SATISFIED at the output current version permits completion', () => {
		recordArtifact(ART);
		recordSatisfiedFloor(ART, 1);
		const r = d('CompleteExecutionStep', completePayload([ART]), PLAN, 'EXECUTION_PLAN');
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(stepState()).toBe('SUCCEEDED');
	});

	it('a STALE floor — SATISFIED at a version the output no longer carries — does NOT permit completion', () => {
		recordArtifact(ART);
		// The floor was recorded against v2. The artifact is at v1. Same subject, same policies, all SATISFIED —
		// and it must still not authorize, because §8.4 L854 puts a STALE review in the same class as a missing
		// one. While the subject was the step this was unverifiable: no version existed to compare against, so
		// floor-gate's version check passed unconditionally and any floor authorized any state of the output.
		recordSatisfiedFloor(ART, 2);
		const r = d('CompleteExecutionStep', completePayload([ART]), PLAN, 'EXECUTION_PLAN');
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		// MISSING, not REJECTED: a floor bound to another version is not a floor for THIS one.
		expect(r.error?.message).toContain('MISSING');
		expect(stepState()).toBe('RUNNING');
	});

	it('an output that is not a recorded object blocks completion — the bypass, closed', () => {
		// Naming a ghost id used to be free: with the STEP as subject, the output was never resolved at all. With
		// the RESULT as subject, an unrecorded output would contribute no subject — so without this check, a step
		// could dodge the floor entirely by naming an artifact that does not exist. §8.4 L854 forbids a missing
		// required review from permitting the transition, and an output nobody recorded cannot have been reviewed.
		const r = d('CompleteExecutionStep', completePayload([GHOST]), PLAN, 'EXECUTION_PLAN');
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
		expect(r.error?.message).toContain(GHOST);
		expect(stepState()).toBe('RUNNING');
	});

	it('a verdict that names a subject but no version for it is REJECTED — DOC-004 invariant 2', () => {
		// FOUND BY MUTATION, and it is the hole the §20 strictObject could not close. `subjectSemanticVersions:
		// Record<string, number>` is satisfied by `{}`, so a verdict naming a subject with NO version for it is
		// schema-valid — and meaningless: nothing downstream can tell whether the judgement still applies to the
		// object as it now stands, which is the entire premise of the version-bound floor (Increment 10b).
		//
		// Emptying that record in the recorder left every test green. Making ValidatorResult a real contract
		// bought the SHAPE; only this buys the INVARIANT. DOC-004 invariant 2: "Every assessment identifies its
		// subject semantic version."
		recordArtifact(ART);
		const id = `asmt_${String(++asmt).padStart(26, '0')}`;
		d(
			'RequestAssuranceAssessment',
			{
				assessmentId: id,
				assurancePolicyId: 'floor.schema-invariant',
				policyVersion: '1.0.0',
				subjectObjectIds: [ART],
				subjectSemanticVersions: { [ART]: 1 },
				claimIds: []
			},
			id,
			'ASSURANCE_ASSESSMENT'
		);
		const verdict = floorValidatorResult({
			assessmentId: id,
			policyId: 'floor.schema-invariant',
			subjectId: ART,
			subjectSemanticVersion: 1,
			disposition: 'SATISFIED'
		});
		const r = d(
			'CompleteAssuranceAssessment',
			{ validatorResult: { ...verdict, subjectSemanticVersions: {} } },
			id,
			'ASSURANCE_ASSESSMENT'
		);
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_VALIDATOR_OUTPUT_INVALID');
		expect(r.error?.message).toContain(ART);
	});

	it('EVERY result is judged, not just the first — §8.4 L844 individuates per result', () => {
		// "Each independently downstream-consumable result is its own transformation boundary unless an explicit
		// grouping records every subject/version and its rationale." No grouping record exists in the contract, so
		// a second output with no floor blocks even though the first output is fully SATISFIED.
		recordArtifact(ART);
		recordSatisfiedFloor(ART, 1);
		const SECOND = 'art_01ARZ3NDEKTSV4RRFFQ69G5V70';
		recordArtifact(SECOND);
		const r = d('CompleteExecutionStep', completePayload([ART, SECOND]), PLAN, 'EXECUTION_PLAN');
		expect(r.status).toBe('REJECTED');
		expect(r.error?.message).toContain(SECOND);
		expect(stepState()).toBe('RUNNING');
	});
});
