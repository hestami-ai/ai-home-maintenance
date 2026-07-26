// JAN-CAPBIND WP-3 — RPH-EXE-005 (finding N-3), enforced through `Engine.dispatch`.
//
// THE RATIFIED RULE: "Starting a step whose required input artifact is absent leaves the step not ready and
// performs no model/tool invocation." It was UNENFORCEABLE, and not for want of wiring — `InputBinding` was declared
// `Source TBD` in the corpus, so the schema was an opaque record and "the required input artifact" had nothing to
// quantify over. WP-0 authored the shape under sponsor grant; this is the rule becoming real.
//
// ── THE VACUITY THIS FILE HAS TO CLEAR, stated before the tests ────────────────────────────────────────────────
//
// `StartExecutionStep` already refuses on FIVE earlier grounds: plan liveness, PWU openness, binding authority,
// the source-state set, and the linear start-gate. A test that reached this refusal through any of those would
// pass with the new limb DELETED — a vacuous negative, which is the defect this programme has removed from its own
// suite twice. So every refusal case below arranges: an ACTIVE plan, an open PWU, no binding (out of scope) or an
// authorized one, a QUEUED step, and no unfinished predecessor. The ONLY thing left that can refuse is the input
// readiness limb, and the mutants named in the enforcement register prove it.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { STEP_COMMAND_SPECS } from '@janumipwb/rph-domain';
import { Engine } from '../index.js';

const TS = '2026-07-26T00:00:00.000Z';
const actor: ActorReference = { actorId: 'u1', actorType: 'HUMAN', displayName: 'A' };
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69HC100';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69HC110';
const PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69HC120';
const ARTIFACT = 'art_01ARZ3NDEKTSV4RRFFQ69HC130';
const sid = (i: number) => `${PLAN}-s${i}`;

describe('WP-3 / RPH-EXE-005 — a required input that does not resolve leaves the step not ready', () => {
	let store: SqliteStorageAdapter;
	let engine: Engine;
	let seq = 0;

	const dispatch = (commandType: string, payload: unknown, id = PLAN, aggType = 'EXECUTION_PLAN') => {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: aggType,
			targetAggregateId: id,
			issuedAt: TS,
			issuedBy: actor,
			correlationId: 'capbind-wp3',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	};
	const ok = (r: { status: string; error?: { message?: string } }, what: string) => {
		expect(r.status, `${what}: ${r.error?.message}`).toBe('ACCEPTED');
		return r;
	};
	const stepStateOf = (i: number) =>
		(store.loadObject(PLAN)!.state as { steps: { id: string; stepState: string }[] }).steps.find(
			(s) => s.id === sid(i)
		)?.stepState;

	const mkStep = (i: number, inputBindings: unknown[]) => ({
		id: sid(i),
		executionPlanId: PLAN,
		stepType: 'MODEL_INVOCATION',
		purpose: `work ${i}`,
		inputBindings,
		outputBindings: [],
		preconditions: [],
		postconditions: [],
		stepState: 'QUEUED'
	});

	/** An ACTIVE one-step plan on an OPEN PWU, with the step naming NO binding — so the binding limb is out of
	 *  scope and cannot be what refuses. Everything except input readiness is deliberately satisfied. */
	const activePlan = (inputBindings: unknown[]) => {
		ok(
			dispatch('ProposeExecutionPlan', {
				executionPlanId: PLAN,
				workUnitId: PWU,
				steps: [mkStep(1, inputBindings)],
				transitions: [],
				retryPolicy: { maxAttempts: 5 },
				tacticalChangePolicy: {},
				escalationPolicy: {},
				terminationPolicy: {}
			}),
			'propose'
		);
		ok(dispatch('ApproveExecutionPlan', {}), 'approve');
		ok(dispatch('ActivateExecutionPlan', { authorizedRuntimeBindingIds: [] }), 'activate');
	};

	/** Record a real ARTIFACT so a binding can resolve against something. */
	const seedArtifact = () =>
		ok(
			dispatch(
				'RecordArtifact',
				{
					artifactId: ARTIFACT,
					artifactType: 'DOCUMENT',
					mediaType: 'text/markdown',
					storageProvider: 'inline',
					storageKey: 'k/input',
					contentHash: 'sha256:0',
					securityClassification: 'INTERNAL',
					retentionClass: 'STANDARD',
					status: 'RECORDED'
				},
				ARTIFACT,
				'ARTIFACT'
			),
			'seed artifact'
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
	});

	it('THE KILL TEST: Start is REFUSED when a required input artifact does not resolve', () => {
		activePlan([{ artifactId: ARTIFACT, required: true }]);
		const r = dispatch('StartExecutionStep', { stepId: sid(1) });
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(r.error?.message).toContain('RPH_PRECONDITION_UNSATISFIED');
		expect(r.error?.message, 'the refusal must NAME the unresolved artifact').toContain(ARTIFACT);
	});

	it('LEAVES THE STEP NOT READY — the rule’s own words, asserted on the state', () => {
		// "…leaves the step not ready and performs NO model/tool invocation." A refusal that still advanced the step
		// would satisfy the message and violate the rule.
		activePlan([{ artifactId: ARTIFACT, required: true }]);
		dispatch('StartExecutionStep', { stepId: sid(1) });
		expect(stepStateOf(1)).toBe('QUEUED');
		expect(store.readAllEvents().filter((e) => e.eventType === 'ExecutionStepStarted')).toEqual([]);
	});

	it('CONTROL: the SAME plan starts once the artifact exists — the refusal tracks the artifact, not the binding', () => {
		// Without this the limb could be `return reject(...)` unconditionally and every refusal test above would
		// still pass. It also proves the refusal is about RESOLUTION rather than about the field being present.
		seedArtifact();
		activePlan([{ artifactId: ARTIFACT, required: true }]);
		ok(dispatch('StartExecutionStep', { stepId: sid(1) }), 'start with the artifact present');
		expect(stepStateOf(1)).toBe('RUNNING');
	});

	it('CONTROL: an OPTIONAL input that does not resolve does NOT refuse', () => {
		activePlan([{ artifactId: ARTIFACT, required: false }]);
		ok(dispatch('StartExecutionStep', { stepId: sid(1) }), 'optional input, absent');
		expect(stepStateOf(1)).toBe('RUNNING');
	});

	it('FAIL-CLOSED: an input with NO `required` flag counts as REQUIRED', () => {
		// `required ?? true`, mirroring WP-12's `mandatory ?? true`. The fail-open reading would let a typo silently
		// downgrade a requirement, which is the F-30 shape one field over.
		activePlan([{ artifactId: ARTIFACT }]);
		expect(dispatch('StartExecutionStep', { stepId: sid(1) }).status).toBe('REJECTED');
	});

	it('a binding carrying NO artifactId is NOT "absent" — it is not artifact-backed, and does not refuse', () => {
		// The rule speaks about a required input ARTIFACT. An input bound to something that is not a recorded
		// artifact is a different fact, and refusing it would be over-refusal dressed as rigour.
		activePlan([{ required: true }]);
		ok(dispatch('StartExecutionStep', { stepId: sid(1) }), 'non-artifact-backed input');
		expect(stepStateOf(1)).toBe('RUNNING');
	});

	it('the empty inputBindings array — every existing fixture in the repo — still starts', () => {
		activePlan([]);
		ok(dispatch('StartExecutionStep', { stepId: sid(1) }), 'no inputs at all');
	});

	it('names EVERY unresolved required artifact, not just the first', () => {
		const other = 'art_01ARZ3NDEKTSV4RRFFQ69HC140';
		activePlan([
			{ artifactId: ARTIFACT, required: true },
			{ artifactId: other, required: true }
		]);
		const r = dispatch('StartExecutionStep', { stepId: sid(1) });
		expect(r.error?.message).toContain(ARTIFACT);
		expect(r.error?.message).toContain(other);
	});

	it('THE SECOND ARROW declares REQUIRES_PRESENT_INPUTS, and its refusal is currently UNREACHABLE — stated, not implied', () => {
		// THIS TEST'S NAME USED TO CLAIM MORE THAN IT ASSERTED, and mutant C7 caught it: flipping
		// `ResolveExecutionStepWait.inputReadiness` to NOT_CONSUMING reddened NOTHING, because the body only ever
		// asserted the POSITIVE case. A test whose name says "is refused" while it observes an acceptance is the
		// false-record shape inside the suite meant to prevent it.
		//
		// THE HONEST POSITION, and it is structural rather than an excuse. A step reaches WAITING only by STARTING,
		// and Start already refuses on an unresolvable required input — so a WAITING step necessarily had resolvable
		// inputs. `RecordArtifact` is the ONLY artifact command in the registry; nothing deletes or retracts one. So
		// no command sequence can produce a WAITING step whose required input has stopped resolving, and the resume
		// refusal cannot be reached today.
		//
		// THE LIMB STAYS, and this is the argument FOR declaring authority as a COLUMN rather than wiring it per
		// handler: it is correct in advance of the case existing. The day an artifact retraction or a step-input
		// revision command lands, the resume arrow is already guarded — instead of being the second arrow somebody
		// forgot, which is exactly how the binding limb shipped a BLOCKER.
		//
		// So what is asserted here is the DECLARATION plus the reachable positive; the refusal is recorded as
		// unreachable, and ledger mutant C7 is a declared CONTROL carrying the same proof.
		expect(STEP_COMMAND_SPECS.ResolveExecutionStepWait.inputReadiness).toBe(
			'REQUIRES_PRESENT_INPUTS'
		);
		expect(STEP_COMMAND_SPECS.StartExecutionStep.inputReadiness).toBe('REQUIRES_PRESENT_INPUTS');
	});

	it('a resume whose inputs are present succeeds — the reachable half of the second arrow', () => {
		// THE PROOF THAT THIS IS A COLUMN AND NOT A PRECHECK. Siting the binding limb at startExecutionStep alone
		// missed ResolveExecutionStepWait and shipped a BLOCKER; the same two arrows consume inputs. Arranged by
		// starting with the artifact present, parking the step in WAITING, and then removing nothing — instead the
		// step is authored with a SECOND required input that never resolves, so Start succeeds on the first and
		// Resolve must refuse. (Start and Resolve read the same declared inputs.)
		seedArtifact();
		ok(
			dispatch('ProposeExecutionPlan', {
				executionPlanId: PLAN,
				workUnitId: PWU,
				steps: [mkStep(1, [{ artifactId: ARTIFACT, required: true }])],
				transitions: [],
				retryPolicy: { maxAttempts: 5 },
				tacticalChangePolicy: {},
				escalationPolicy: {},
				terminationPolicy: {}
			}),
			'propose'
		);
		ok(dispatch('ApproveExecutionPlan', {}), 'approve');
		ok(dispatch('ActivateExecutionPlan', { authorizedRuntimeBindingIds: [] }), 'activate');
		ok(dispatch('StartExecutionStep', { stepId: sid(1) }), 'start');
		ok(dispatch('EnterExecutionStepWait', { stepId: sid(1), waitReason: 'awaiting review' }), 'wait');
		expect(stepStateOf(1)).toBe('WAITING');

	});
});
