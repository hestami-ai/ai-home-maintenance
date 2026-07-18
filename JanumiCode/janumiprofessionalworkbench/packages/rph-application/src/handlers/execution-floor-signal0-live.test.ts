// The LIVE wiring proof for floor-gate signal 0: completeExecutionStep must pass its ExecutionProvenance to the
// gate. The step here is deliberately invisible to all three heuristics — a TRANSFORMATION (not MODEL_INVOCATION),
// completed by a HUMAN, under no runtime binding — so the ONLY thing that can make it AI-produced is its recorded
// provenance (originType TOOL_OUTPUT). With no floor recorded, an AI-produced result must be BLOCKED (§8.4 L841/854).
// If execution.ts stopped threading p.executionProvenance, this step would look human, admit itself, and this test
// would fail — which the signal-0 unit test (function-level) cannot catch.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-17T00:00:00Z';
const human = { actorId: 'u-1', actorType: 'HUMAN' as const, displayName: 'Operator' };
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69G5S00';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5S10';
const PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69G5S20';
const STEP = 'step_01ARZ3NDEKTSV4RRFFQ69G5S30';
const ATTEMPT = 'attempt_01ARZ3NDEKTSV4RRFFQ69G5S40';
const ART = 'art_01ARZ3NDEKTSV4RRFFQ69G5S50';

describe('CompleteExecutionStep floor gate — signal 0 wiring (a human-completed non-model step, AI by provenance)', () => {
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
			issuedBy: human, // a HUMAN completes the step — heuristic 2 (AGENT/MODEL completer) cannot fire
			correlationId: 'sig0',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	}
	const stepState = () =>
		(store.loadObject(PLAN)?.state as { steps: Array<{ stepState: string }> }).steps[0]!.stepState;

	function recordArtifact() {
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
	}
	const completePayload = (over: Record<string, unknown>) => ({
		executionStepId: STEP,
		executionAttemptId: ATTEMPT,
		resultStatus: 'SUCCEEDED',
		outputArtifactIds: [ART],
		proposedEvidenceIds: [],
		detectedAssumptionIds: [],
		structuredResult: {},
		...over
	});

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
		d(
			'ProposeExecutionPlan',
			{
				executionPlanId: PLAN,
				workUnitId: PWU,
				// A TRANSFORMATION step, NOT a MODEL_INVOCATION — heuristic 1 (AI step type) cannot fire. No
				// runtimeBindingId — heuristic 3 (bound runtime) cannot fire either.
				steps: [
					{
						id: STEP,
						executionPlanId: PLAN,
						stepType: 'TRANSFORMATION',
						purpose: 'transform inputs',
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
		recordArtifact();
	});

	it('BLOCKS completion when provenance says TOOL_OUTPUT and no floor was recorded (signal 0 alone)', () => {
		const r = d(
			'CompleteExecutionStep',
			completePayload({ executionProvenance: { originType: 'TOOL_OUTPUT' } }),
			PLAN,
			'EXECUTION_PLAN'
		);
		expect(r.status, JSON.stringify(r.error)).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(stepState()).toBe('RUNNING'); // no EXECUTION credit banked off an unassessed AI output (INV-5)
	});

	it('ADMITS the same step when provenance is human/absent (control — no heuristic fires, not AI-produced)', () => {
		// originType USER_INPUT => not AI-produced; no floor is required, so the step completes.
		expect(
			d(
				'CompleteExecutionStep',
				completePayload({ executionProvenance: { originType: 'USER_INPUT' } }),
				PLAN,
				'EXECUTION_PLAN'
			).status
		).toBe('ACCEPTED');
		expect(stepState()).toBe('SUCCEEDED');
	});
});
