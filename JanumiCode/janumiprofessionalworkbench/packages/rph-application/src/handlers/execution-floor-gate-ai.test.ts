// Drives the EXECUTION-plane floor gate LIVE for the case its sibling (execution-detail.test.ts) leaves open: a step
// whose output is AI-produced but which has NO recorded floor at all. That sibling proves the gate blocks once a
// non-SATISFIED floor EXISTS; the complement — nothing was ever assessed — is the one an unassessed agent actually
// takes, and it is the path §8.4 says must resolve to material rather than to silent admission.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-15T00:00:00Z';
// Every command here is issued by an AGENT, and the step is a MODEL_INVOCATION whose provenance names a MODEL: the
// producer is AI on every axis the pipeline can observe, so no reading of "AI-produced" is left to ambiguity.
const AGENT: ActorReference = {
	actorId: 'agent-7',
	actorType: 'AGENT',
	displayName: 'Executor Agent'
};
const MODEL_ACTOR = { actorId: 'model-7', actorType: 'MODEL', displayName: 'gpt-oss:20b' };

const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69G5T00';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5T10';
const PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69G5T20';
const STEP = 'step_01ARZ3NDEKTSV4RRFFQ69G5T30';
const ATTEMPT = 'attempt_01ARZ3NDEKTSV4RRFFQ69G5T40';
/** The step's output — the floor's SUBJECT (§8.4 "bind the exact subject/output"), and a real recorded object. */
const ART = 'art_01ARZ3NDEKTSV4RRFFQ69G5T50';

describe('CompleteExecutionStep floor gate — an AI-produced step with NO recorded floor (§8.4)', () => {
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
			correlationId: 'exec-floor',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	}

	const stepState = () =>
		(store.loadObject(PLAN)?.state as { steps: Array<{ stepState: string }> }).steps[0]!.stepState;

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
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
	});

	it('rejects completing an AI-produced step whose floor was never recorded', () => {
		expect(d('StartExecutionStep', { stepId: STEP }, PLAN, 'EXECUTION_PLAN').status).toBe(
			'ACCEPTED'
		);
		expect(stepState()).toBe('RUNNING');

		// The output must be a REAL recorded Artifact — this line used to say "a real output artifact" while naming
		// an id no command could create, because nothing could create one. It matters twice over: it satisfies
		// validateStepCompletion (RPH-EXE-006), AND it gives the floor a legal subject to be MISSING over. Without
		// it the command now dies earlier, on the unrecorded-result check, and would never reach the floor gate
		// this test exists to prove.
		d(
			'RecordArtifact',
			{
				artifactId: ART,
				artifactType: 'ARCHITECTURE_BASELINE',
				mediaType: 'text/markdown',
				storageProvider: 'workspace-local',
				storageKey: `artifacts/${ART}.md`,
				contentHash: `sha256:${ART}`,
				producingPwuId: PWU,
				producingExecutionAttemptId: ATTEMPT,
				securityClassification: 'INTERNAL',
				retentionClass: 'PROJECT_LIFETIME',
				status: 'RECORDED'
			},
			ART,
			'ARTIFACT'
		);
		const complete = {
			executionStepId: STEP,
			executionAttemptId: ATTEMPT,
			resultStatus: 'SUCCEEDED',
			outputArtifactIds: [ART],
			proposedEvidenceIds: [],
			detectedAssumptionIds: [],
			structuredResult: { architecture: 'generated by the model' },
			executionProvenance: { executedBy: MODEL_ACTOR, modelId: 'gpt-oss:20b' }
		};

		// No ASSURANCE_ASSESSMENT was ever recorded over this step's output: the mandatory Reasoning Review that §8.4
		// L841 requires for an AI-produced result ("a Reasoning Review Assessment when the transformation is produced
		// by or materially shaped by an AI/agent") is MISSING, not passed. §8.4 L844: "the producer cannot exempt its
		// own output, and ambiguity resolves to material." §8.4 L854: "A missing, stale, malformed, failed,
		// unavailable, or independence-invalid required review cannot satisfy assurance or permit its protected
		// transition." §8.4 L856: "Required, inherited, deferred, waived, and inapplicable **additional** coverage are
		// explainable; gaps are never silent."
		//
		// HISTORY, kept because it is the reason this test exists: `execution.ts` used to pass a hardcoded
		// `{ aiProduced: false }`, so floor-gate's "not AI-produced AND never assessed ⇒ permitted" rule
		// short-circuited and the step admitted itself — the gate was unreachable for exactly the population it
		// exists to catch. `aiProduced` is now DERIVED (stepOutputIsAiProduced), and the floor is judged over the
		// step's RESULT rather than over the step, which has no semanticVersion to judge at.
		const r = d('CompleteExecutionStep', complete, PLAN, 'EXECUTION_PLAN');
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		// The step must not have banked EXECUTION credit off an unassessed AI output (INV-5).
		expect(stepState()).toBe('RUNNING');
	});
});
