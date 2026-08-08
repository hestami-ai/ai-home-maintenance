// JAN-EXECREM WP-11 — F-01 limb B: the §8.4 de minimis assurance floor no longer skips a step that names nothing.
//
// THE DEFECT, IN ONE LINE. The floor gate is `for (const subject of subjects) { ... }`, and a loop over an empty
// list is not a gate — it is a no-op wearing one's clothes. An AI-produced step naming ZERO results produced zero
// subjects, so §8.4 ran zero times and the step succeeded; its sibling naming one real artifact was REJECTED. The
// single population the floor exists to catch escaped it by the cheapest possible move: naming nothing. The
// register reproduced this exact input returning `ACCEPTED | state=SUCCEEDED`.
//
// AND IT WAS NOT INERT. `execution.ts` carries `structuredResult` verbatim onto `ExecutionStepSucceeded`,
// `condition-grammar.ts` folds it into the condition subject, and `RESULT_EQUALS` resolves a dot-path over it — so
// unassessed AI content does not merely sit in the log, it can STEER BRANCH SELECTION. Unassessed AI output with
// real control-flow authority is why this is a BLOCKER rather than a hygiene item.
//
// WHY THE RULE IS NARROW. Coding Agent Guide L1964: "A timeout/no-output Attempt remains recorded but has no
// candidate output to review." A blanket "AI + zero subjects ⇒ refuse" would over-refuse exactly that legitimate
// case, so the discriminator is whether the step SHIPPED something. Test 2 and test 3 below are the guards on the
// over-refusal, and they matter as much as test 1: this is the one fix in the programme that can refuse too much.
//
// FIXTURE PINNING (the mirror of execution-exe006-explicit-result.test.ts): every completion here carries a
// `noOutputResult`, i.e. a payload limb A ACCEPTS. Omit it and limb A refuses these inputs first, the limb-B
// mutation "aiProduced && ... -> false && ..." survives GREEN, and neither limb is actually killed.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import { testDirectory } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-15T00:00:00Z';
/** AI on every axis the pipeline can observe, so "AI-produced" is left to no reading. */
const AGENT: ActorReference = {
	actorId: 'agent-7',
	actorType: 'AGENT',
	displayName: 'Executor Agent'
};
const MODEL_ACTOR = { actorId: 'model-7', actorType: 'MODEL', displayName: 'gpt-oss:20b' };
const HUMAN: ActorReference = { actorId: 'u1', actorType: 'HUMAN', displayName: 'Operator' };

// Dispatches as BOTH: the floor's AI-produced determination turns on who acted, so the actor is the variable
// under test and each one needs its own session.
const DIR = testDirectory([
	{ ...AGENT, tenantId: 't', organizationId: 'o' },
	{ ...HUMAN, tenantId: 't', organizationId: 'o' }
]);

const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69GY100';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69GY110';
const PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69GY120';
const AI_STEP = `${PLAN}-s1`;
const HUMAN_STEP = `${PLAN}-s2`;
const ART = 'art_01ARZ3NDEKTSV4RRFFQ69GY130';

const SAYS_NOTHING = {
	reason: 'NO_DOWNSTREAM_CONSUMABLE_RESULT' as const,
	detail: 'The model returned nothing downstream-consumable.'
};

describe('JAN-EXECREM WP-11 / F-01 limb B — the zero-subject floor', () => {
	let store: SqliteStorageAdapter;
	let engine: Engine;
	let seq = 0;

	function dispatch(
		commandType: string,
		payload: unknown,
		id = PLAN,
		aggType = 'EXECUTION_PLAN',
		issuedBy: ActorReference = AGENT
	) {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: aggType,
			targetAggregateId: id,
			issuedAt: TS,
			correlationId: 'wp11b',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.as(DIR.credentialFor(issuedBy.actorId)).dispatch(command);
	}

	const planOf = () => store.loadObject(PLAN)!;
	const stepStateOf = (id: string) =>
		(planOf().state as { steps: { id: string; stepState: string }[] }).steps.find(
			(s) => s.id === id
		)?.stepState;
	const succeededEvents = () =>
		store.readAllEvents().filter((e) => e.eventType === 'ExecutionStepSucceeded');

	const mkStep = (id: string, stepType: string) => ({
		id,
		executionPlanId: PLAN,
		stepType,
		purpose: 'generate the architecture',
		inputBindings: [],
		outputBindings: [],
		preconditions: [],
		postconditions: [],
		stepState: 'QUEUED'
	});

	/** An AI completion: MODEL producer, MODEL_GENERATION origin, and a no-output assertion limb A accepts. */
	const aiCompletion = (over: Record<string, unknown> = {}) => ({
		executionStepId: AI_STEP,
		executionAttemptId: `${AI_STEP}-a1`,
		resultStatus: 'SUCCEEDED',
		outputArtifactIds: [],
		proposedEvidenceIds: [],
		detectedAssumptionIds: [],
		structuredResult: {},
		noOutputResult: SAYS_NOTHING,
		executionProvenance: {
			executedBy: { ...MODEL_ACTOR, modelId: 'gpt-oss:20b' },
			originType: 'MODEL_GENERATION'
		},
		...over
	});

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({
			authenticate: DIR.authenticate,
			store,
			now: () => TS,
			newEventId: () => `e${++seq}`
		});
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
				// HIGH on every axis: no reading of the risk profile makes the floor optional here.
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
		expect(
			dispatch('ProposeExecutionPlan', {
				executionPlanId: PLAN,
				workUnitId: PWU,
				steps: [mkStep(AI_STEP, 'MODEL_INVOCATION'), mkStep(HUMAN_STEP, 'TRANSFORMATION')],
				transitions: [],
				retryPolicy: {},
				tacticalChangePolicy: {},
				escalationPolicy: {},
				terminationPolicy: {}
			}).status
		).toBe('ACCEPTED');
		dispatch('ApproveExecutionPlan', {});
		dispatch('ActivateExecutionPlan', { authorizedRuntimeBindingIds: [] });
		// NO ASSURANCE_ASSESSMENT is ever recorded in this file. The mandatory Reasoning Review §8.4 L841 requires
		// for AI-produced work is MISSING, not passed — and §8.4 L854: "A missing … required review cannot satisfy
		// assurance or permit its protected transition."
	});

	// THE HEADLINE BLOCKER'S KILL TEST.
	it('an AI step that ships content while naming NOTHING is REFUSED', () => {
		expect(dispatch('StartExecutionStep', { stepId: AI_STEP }).status).toBe('ACCEPTED');
		const before = { revision: planOf().revision, events: store.readAllEvents().length };

		const r = dispatch(
			'CompleteExecutionStep',
			aiCompletion({ structuredResult: { architecture: 'generated by the model' } })
		);

		expect(r.status, 'this exact input returned ACCEPTED | state=SUCCEEDED before WP-11').toBe(
			'REJECTED'
		);
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(r.error?.message, 'the refusal must name the remedy').toContain('RecordArtifact');
		expect(stepStateOf(AI_STEP)).toBe('RUNNING');
		expect(
			succeededEvents(),
			'the unassessed result must not reach the governed stream'
		).toHaveLength(0);
		expect(store.readAllEvents()).toHaveLength(before.events);
		expect(planOf().revision).toBe(before.revision);
	});

	// OVER-REFUSAL GUARD 1 — the Coding Agent Guide L1964 case.
	it('an AI step that genuinely produced NOTHING, and says so, is ACCEPTED', () => {
		expect(dispatch('StartExecutionStep', { stepId: AI_STEP }).status).toBe('ACCEPTED');
		const r = dispatch('CompleteExecutionStep', aiCompletion({ structuredResult: {} }));
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(stepStateOf(AI_STEP)).toBe('SUCCEEDED');
	});

	// OVER-REFUSAL GUARD 2 — the demo's own path. §8.4 step 3 is AI-scoped; a human step owes no Reasoning Review.
	it('a NON-AI step with zero subjects is untouched by this rule, content or not', () => {
		// `transitions: []` is a LINEAR plan, so the AI step must be terminal-success before this one can start
		// (RPH-EXE-005). It is SKIPPED rather than completed, so this case does not depend on any AI-completion rule
		// — the point is that a HUMAN step is judged by nothing here at all.
		expect(
			dispatch(
				'SkipExecutionStep',
				{ stepId: AI_STEP, mandatory: false },
				PLAN,
				'EXECUTION_PLAN',
				HUMAN
			).status
		).toBe('ACCEPTED');
		expect(
			dispatch('StartExecutionStep', { stepId: HUMAN_STEP }, PLAN, 'EXECUTION_PLAN', HUMAN).status
		).toBe('ACCEPTED');
		const r = dispatch(
			'CompleteExecutionStep',
			{
				executionStepId: HUMAN_STEP,
				executionAttemptId: `${HUMAN_STEP}-a1`,
				resultStatus: 'SUCCEEDED',
				outputArtifactIds: [],
				proposedEvidenceIds: [],
				detectedAssumptionIds: [],
				structuredResult: { notes: 'the operator reviewed the design and recorded a decision' },
				noOutputResult: SAYS_NOTHING,
				executionProvenance: { executedBy: HUMAN, originType: 'HUMAN_DECISION' }
			},
			PLAN,
			'EXECUTION_PLAN',
			HUMAN
		);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(stepStateOf(HUMAN_STEP)).toBe('SUCCEEDED');
	});

	// NON-REGRESSION: the sibling behaviour that already worked must keep working, and must keep being refused for
	// its OWN reason (the per-subject floor loop) rather than for this new one.
	it('an AI step naming a recorded artifact with a MISSING floor is still refused, by the per-subject gate', () => {
		expect(dispatch('StartExecutionStep', { stepId: AI_STEP }).status).toBe('ACCEPTED');
		expect(
			dispatch(
				'RecordArtifact',
				{
					artifactId: ART,
					artifactType: 'ARCHITECTURE_BASELINE',
					mediaType: 'text/markdown',
					storageProvider: 'workspace-local',
					storageKey: `artifacts/${ART}.md`,
					contentHash: `sha256:${ART}`,
					producingPwuId: PWU,
					producingExecutionAttemptId: `${AI_STEP}-a1`,
					securityClassification: 'INTERNAL',
					retentionClass: 'PROJECT_LIFETIME',
					status: 'RECORDED'
				},
				ART,
				'ARTIFACT'
			).status
		).toBe('ACCEPTED');
		const r = dispatch(
			'CompleteExecutionStep',
			aiCompletion({
				outputArtifactIds: [ART],
				structuredResult: { architecture: 'generated by the model' },
				noOutputResult: undefined // it NAMES an output, so asserting no-output would be contradictory
			})
		);
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		// The per-subject message names the subject and its version; the zero-subject one names RecordArtifact.
		// Asserting which fired is what keeps the two rules from being confused for one another.
		expect(r.error?.message, 'the PER-SUBJECT floor must be what refused').toContain(
			'de minimis assurance floor is not SATISFIED'
		);
		expect(stepStateOf(AI_STEP)).toBe('RUNNING');
	});
});
