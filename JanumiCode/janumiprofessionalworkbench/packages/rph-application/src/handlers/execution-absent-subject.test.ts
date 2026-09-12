// ABSENT SUBJECTS IN THE EXECUTION HANDLERS — what `execution.ts` does when the thing it was told to act on, or
// the thing it was told to record, IS NOT THERE.
//
// ── THE PROPERTY THIS FILE PROTECTS ──────────────────────────────────────────────────────────────────────────
//
// Every handler in `execution.ts` reads facts it did not author: a step id supplied by a caller, an aggregate id
// on the command envelope, a binding's `executionStepId`, an optional result the caller may simply not have. The
// engine's obligation in each case is the SAME, and it is not "do not crash":
//
//   * REFUSE BY NAMING WHAT IS MISSING, not by whatever guard happens to fire first. A command that names a step
//     the plan does not declare must be told THAT, not that the plan is not ACTIVE — the second sends an operator
//     to activate a plan that would still refuse them.
//   * RENDER AN ABSENCE AS AN ABSENCE. `(unset)` in a refusal, and a MISSING KEY on an emitted event — never an
//     empty-looking value that a reader cannot distinguish from a real one, and never a fabricated empty.
//   * SKIP WHAT IS NOT GATABLE RATHER THAN SHORT-CIRCUITING ON IT. An id that resolves to the wrong kind of
//     object carries no verdict; the loop that met it must keep going and reach the one that does.
//
// Each of these is a distinct decision taken somewhere in `execution.ts`, each was taken deliberately (the
// handler's own docblocks argue three of them at length), and each was UNPINNED: no test in this package's 112
// files reached the arm. `advanceStep`'s "step not found" refusal and the `?? {}` that lets prune provenance be
// derived from a plan that does not exist were the two UNCOVERED LINES of the whole file.
//
// ── WHAT THIS FILE DELIBERATELY DOES NOT CLOSE ───────────────────────────────────────────────────────────────
//
//   * IT DOES NOT PROVE THE ASSUMPTION GUARD IS LIVE — `execution-assumption-guard.test.ts` already does, and
//     duplicating it would be two tests failing together. T7 below pins only that a NON-assumption entry is
//     stepped OVER, by arranging a list where a real dead assumption sits BEHIND one: the refusal must still name
//     the assumption, never the intent in front of it.
//   * IT DOES NOT TOUCH the `?? 'fallback'` arms over kernel verdicts (`canActivatePlan`, `canSkipStep`,
//     `stepMayBecomeReady`, `validateStepCompletion`, `validateProposedPlan`, `bindingPermitsExecution`). Every
//     one of those kernels populates BOTH `errorCode` and `reason` on every refusing return, so those fallbacks
//     are unreachable defensive text, not behaviour. Lighting them would need a production change.
//   * IT ASSERTS NO STEP-COMMAND SYMMETRY. `Step … not found` is reached identically by all nine step commands
//     (it is in `advanceStep`, above the spec table), so one command proves the arm; `exebind-wp1` owns the
//     table-iterating shape for the limbs that ARE per-command.
//   * ⚠ THE FOUR KEY-ABSENCE ASSERTIONS CANNOT SEE ONE MUTATION, AND SAYING SO IS THE POINT. Events are
//     `JSON.stringify`d on commit and `JSON.parse`d on read (`sqlite-storage-adapter.ts`), and JSON DROPS a key
//     whose value is `undefined` — measured: `'b' in JSON.parse(JSON.stringify({ b: undefined }))` is `false`. So
//     replacing a conditional spread with an UNCONDITIONAL one (`structuredResult: p.structuredResult`) leaves
//     `'structuredResult' in payload` still false and these assertions still GREEN. What they DO catch is the
//     fabricating form — `?? {}`, `?? ''`, a neighbouring field read by mistake — which is the one that puts a
//     FALSE value in the governed stream rather than merely a redundant key. Stated here rather than discovered
//     later, because an assertion whose blind spot is unrecorded reads as proving more than it does.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-09-12T00:00:00Z';
const actor: ActorReference = { actorId: 'u1', actorType: 'HUMAN', displayName: 'A' };
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69KA000';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69KA010';
const PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69KA020';
const BINDING = 'bind_01ARZ3NDEKTSV4RRFFQ69KA030';
const ASM = 'asm_01ARZ3NDEKTSV4RRFFQ69KA040';
/** An aggregate id nothing ever creates — the subject of the "plan does not exist" case. */
const ABSENT_PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69KA0ZZ';
/** A step id no plan in this file declares — the subject of the "step not found" case. */
const ABSENT_STEP = `${PLAN}-sZZ`;

const sid = (i: number) => `${PLAN}-s${i}`;
const tid = (from: number, to: number) => `${PLAN}-t${from}-${to}`;

const SAYS_NOTHING = {
	reason: 'NO_DOWNSTREAM_CONSUMABLE_RESULT' as const,
	detail: 'A sequencing step; it authors no artifact.'
};

describe('execution.ts — a command whose subject is absent must say so, and record the absence as one', () => {
	let store: SqliteStorageAdapter;
	let engine: AuthedEngine;
	let seq = 0;

	function dispatch(commandType: string, payload: unknown, id = PLAN, aggType = 'EXECUTION_PLAN') {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: aggType,
			targetAggregateId: id,
			issuedAt: TS,
			correlationId: 'absent-subject',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	}

	const ok = (r: { status: string; error?: { message?: string } }, what: string) => {
		expect(r.status, `${what}: ${r.error?.message}`).toBe('ACCEPTED');
		return r;
	};

	const eventsOfType = (t: string) => store.readAllEvents().filter((e) => e.eventType === t);
	const payloadOfType = (t: string, nth = 0) =>
		eventsOfType(t)[nth]?.payload as Record<string, unknown>;
	const stepStateOf = (id: string) =>
		(
			store.loadObject(PLAN)!.state as { steps: Array<{ id: string; stepState: string }> }
		).steps.find((s) => s.id === id)?.stepState;

	const mkStep = (i: number, over: Record<string, unknown> = {}) => ({
		id: sid(i),
		executionPlanId: PLAN,
		stepType: 'TRANSFORMATION',
		purpose: `work ${i}`,
		inputBindings: [],
		outputBindings: [],
		preconditions: [],
		postconditions: [],
		stepState: 'QUEUED',
		...over
	});
	const gedge = (from: number, to: number) => ({
		id: tid(from, to),
		executionPlanId: PLAN,
		sourceStepId: sid(from),
		targetStepId: sid(to),
		transitionType: 'SEQUENTIAL'
	});
	const cedge = (from: number, to: number, conditionExpression: unknown) => ({
		id: tid(from, to),
		executionPlanId: PLAN,
		sourceStepId: sid(from),
		targetStepId: sid(to),
		transitionType: 'CONDITIONAL',
		conditionExpression
	});

	function proposePwu(assumptionIds: string[] = []) {
		return dispatch(
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
				assumptionIds,
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
	}

	function proposePlan(over: Record<string, unknown> = {}) {
		return dispatch('ProposeExecutionPlan', {
			executionPlanId: PLAN,
			workUnitId: PWU,
			steps: [mkStep(1)],
			transitions: [],
			retryPolicy: { maxAttempts: 3 },
			tacticalChangePolicy: {},
			escalationPolicy: {},
			terminationPolicy: {},
			...over
		});
	}

	const approve = () => dispatch('ApproveExecutionPlan', {});
	const activate = () => dispatch('ActivateExecutionPlan', { authorizedRuntimeBindingIds: [] });

	/** An ACTIVE plan over `steps` / `transitions`, with the PWU already seeded. */
	function activePlan(over: Record<string, unknown> = {}) {
		ok(proposePwu(), 'propose pwu');
		ok(proposePlan(over), 'propose plan');
		ok(approve(), 'approve');
		ok(activate(), 'activate');
	}

	const complete = (i: number, over: Record<string, unknown> = {}) =>
		dispatch('CompleteExecutionStep', {
			executionStepId: sid(i),
			executionAttemptId: `${sid(i)}-a1`,
			resultStatus: 'SUCCEEDED',
			outputArtifactIds: [],
			proposedEvidenceIds: [],
			detectedAssumptionIds: [],
			noOutputResult: SAYS_NOTHING,
			executionProvenance: { executedBy: actor, originType: 'HUMAN_DECISION' },
			...over
		});

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({
			authenticate: testAuthenticator(),
			store,
			now: () => TS,
			newEventId: () => `e${++seq}`
		}).as(TEST_CRED.human);
		ok(
			dispatch(
				'CaptureIntent',
				{ intentId: INTENT, originatingExpression: 'x', ontologyId: 'o', ontologyVersion: '1' },
				INTENT,
				'INTENT'
			),
			'capture intent'
		);
	});

	// ── T1 — THE SUBJECT STEP ────────────────────────────────────────────────────────────────────────────────

	it('names the missing STEP, and does so before the plan-liveness limb that would otherwise answer first', () => {
		ok(proposePwu(), 'propose pwu');
		ok(proposePlan(), 'propose plan');
		ok(approve(), 'approve'); // APPROVED, deliberately NOT ACTIVE

		// THE ORDERING ASSERTION. `advanceStep` locates the step BEFORE `stepAuthorityRefusal` runs, so an operator
		// who mistyped a step id on a not-yet-activated plan is told about the STEP. Were the authority limbs sited
		// first, this same dispatch would answer "requires an ACTIVE plan" — a true statement about a different
		// defect, and one whose remedy (activate the plan) leaves the command still refused.
		const onApproved = dispatch('StartExecutionStep', { stepId: ABSENT_STEP });
		expect(onApproved.status).toBe('REJECTED');
		expect(onApproved.error?.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
		expect(onApproved.error?.message).toBe(
			`Step ${ABSENT_STEP} not found in execution plan ${PLAN}`
		);
		expect(
			onApproved.error?.message,
			'the plan-liveness limb must not be what answers here'
		).not.toContain('requires an ACTIVE plan');

		// …and the same refusal on an ACTIVE plan, where no other limb could have produced it.
		ok(activate(), 'activate');
		const onActive = dispatch('StartExecutionStep', { stepId: ABSENT_STEP });
		expect(onActive.status).toBe('REJECTED');
		expect(onActive.error?.message).toBe(`Step ${ABSENT_STEP} not found in execution plan ${PLAN}`);

		expect(eventsOfType('ExecutionStepStarted'), 'nothing started').toHaveLength(0);
		expect(stepStateOf(sid(1)), 'the real step is untouched').toBe('QUEUED');
	});

	// ── T2 — THE SUBJECT PLAN ────────────────────────────────────────────────────────────────────────────────

	it('refuses a prune against a plan that does not exist, having derived provenance from the absent plan without throwing', () => {
		// `pruneExecutionStep` derives its event provenance BEFORE `advanceStep` loads the aggregate — it must, "or
		// the cut is already gone". So on a nonexistent plan the derivation runs FIRST, over `loadPlanState`'s empty
		// bag, and `toGatePlan` maps a plan with no `steps`, no `transitions` and no `status`. Every one of those is
		// a defaulted read; drop any of them and this dispatch raises a TypeError out of `Engine.dispatch` instead
		// of returning the governed refusal below — the bus converts no handler throw.
		const r = dispatch('PruneExecutionStep', { stepId: ABSENT_STEP }, ABSENT_PLAN);
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
		expect(r.error?.message).toBe(`Aggregate ${ABSENT_PLAN} does not exist`);
		expect(
			store.readAllEvents().filter((e) => e.aggregateId === ABSENT_PLAN),
			'a refused prune writes nothing under the id it named'
		).toHaveLength(0);
	});

	// ── T3 — THE BINDING THAT NAMES NO STEP ──────────────────────────────────────────────────────────────────

	it('renders a binding that names NO step as "(unset)" in the scope refusal, not as a blank step name', () => {
		// The arrangement is the one `bindingAuthorityRefusal` documents: propose FIRST (a dangling binding id is
		// deliberately allowed, because `RequestRuntimeBinding` needs a step id that only exists once the plan is
		// authored), then create the binding with no step of its own.
		ok(proposePwu(), 'propose pwu');
		ok(proposePlan({ steps: [mkStep(1, { runtimeBindingId: BINDING })] }), 'propose plan');
		ok(
			dispatch(
				'RequestRuntimeBinding',
				{
					runtimeBindingId: BINDING,
					executionStepId: '', // the binding names no step at all
					roleId: 'role-architect',
					requestedCapabilities: [{ capability: 'file-system' }]
				},
				BINDING,
				'RUNTIME_BINDING'
			),
			'request binding'
		);
		ok(
			dispatch(
				'AuthorizeRuntimeBinding',
				{ grantedCapabilities: [{ capability: 'file-system' }] },
				BINDING,
				'RUNTIME_BINDING'
			),
			'authorize binding'
		);
		ok(approve(), 'approve');
		ok(activate(), 'activate');

		const r = dispatch('StartExecutionStep', { stepId: sid(1) });
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		// `|| '(unset)'`, NOT `?? '(unset)'`: the resolved-but-empty `executionStepId` is exactly the case the
		// nullish form would let through as "authorized for step , not for step …", which reads as a rendering bug
		// rather than as the fail-closed refusal it is.
		expect(r.error?.message).toContain(`was authorized for step (unset), not for step ${sid(1)}`);
		expect(stepStateOf(sid(1)), 'the step did not start').toBe('QUEUED');
	});

	// ── T4 — THE RESULT THE CALLER DID NOT HAVE ──────────────────────────────────────────────────────────────

	it('omits structuredResult from ExecutionStepSucceeded entirely when the command carried none, and carries it when it did', () => {
		activePlan({ steps: [mkStep(1), mkStep(2)] });

		// ⚠ THE KEY IS SENT, ITS VALUE IS `undefined`, AND THAT IS THE ONLY REACHABLE FORM OF THIS CASE — measured,
		// not assumed. `CompleteExecutionStepPayloadSchema` declares `structuredResult: z.unknown()`, which zod 4
		// treats as NONOPTIONAL on key PRESENCE: dropping the key is refused at the bus with
		// "expected nonoptional, received undefined", while sending it as an explicit `undefined` parses. So the
		// caller who has no structured result — a TypeScript caller forwarding an optional — reaches the handler
		// with the field present and undefined, which is exactly what the producer's conditional spread guards.
		ok(dispatch('StartExecutionStep', { stepId: sid(1) }), 'start s1');
		ok(complete(1, { structuredResult: undefined }), 'complete s1 with no structuredResult');
		ok(dispatch('StartExecutionStep', { stepId: sid(2) }), 'start s2');
		ok(complete(2, { structuredResult: { note: 'the value the caller did have' } }), 'complete s2');

		const first = payloadOfType('ExecutionStepSucceeded', 0);
		const second = payloadOfType('ExecutionStepSucceeded', 1);
		// KEY ABSENT, not `structuredResult: undefined`. The governed stream is replayed by consumers that read
		// presence; a fabricated `undefined` says "this step returned nothing" where the truth is "this step said
		// nothing about what it returned".
		expect('structuredResult' in first, 'absence is recorded as absence').toBe(false);
		expect(first.executionStepId).toBe(sid(1));
		// The other arm, which discriminates: an unconditional spread would redden the line above, and deleting the
		// field from the producer would redden this one. Neither mutation reddens both.
		expect(second.structuredResult).toEqual({ note: 'the value the caller did have' });
	});

	// ── T5 — THE POLICIES THE AUTHOR DID NOT DECLARE ─────────────────────────────────────────────────────────

	it('rides only the plan policies the proposal actually declared, omitting an empty one rather than fabricating it', () => {
		ok(proposePwu(), 'propose pwu');
		ok(
			proposePlan({
				retryPolicy: {}, // declared empty — must NOT appear on the event
				tacticalChangePolicy: { mode: 'BOUNDED' },
				escalationPolicy: { to: 'sponsor' },
				terminationPolicy: { onFailure: 'STOP' }
			}),
			'propose plan'
		);

		const p = payloadOfType('ExecutionPlanProposed');
		expect(p.tacticalChangePolicy).toEqual({ mode: 'BOUNDED' });
		expect(p.escalationPolicy).toEqual({ to: 'sponsor' });
		expect(p.terminationPolicy).toEqual({ onFailure: 'STOP' });
		// The discriminating half: the emptiness test is what makes the three above conditional at all. Remove it and
		// `retryPolicy: {}` rides too — "not specified" becomes indistinguishable from "specified as nothing".
		expect('retryPolicy' in p, 'an undeclared policy is absent, not empty').toBe(false);
	});

	// ── T6 — THE STEP A TACTICAL CHANGE WAS NOT SCOPED TO ────────────────────────────────────────────────────

	it('names the step on TacticalChangeApplied only when the change was scoped to one', () => {
		activePlan();

		ok(
			dispatch('ApplyTacticalChange', {
				stepId: sid(1),
				changeType: 'REORDER',
				rationale: 'scoped to the step',
				authorizingPolicyId: 'pol-tactical'
			}),
			'step-scoped change'
		);
		ok(
			dispatch('ApplyTacticalChange', {
				changeType: 'REORDER',
				rationale: 'plan-wide',
				authorizingPolicyId: 'pol-tactical'
			}),
			'plan-wide change'
		);

		const scoped = payloadOfType('TacticalChangeApplied', 0);
		const planWide = payloadOfType('TacticalChangeApplied', 1);
		expect(scoped.stepId).toBe(sid(1));
		// A plan-wide tactical change has no step, and the event must not invent one — `stepId` is optional on the
		// ratified shape precisely so that "the whole plan" is expressible.
		expect('stepId' in planWide, 'a plan-wide change names no step').toBe(false);
	});

	// ── T7 — THE ID THAT RESOLVES TO THE WRONG KIND OF OBJECT ────────────────────────────────────────────────

	it('steps OVER a PWU assumptionId that is not an ASSUMPTION and still reaches the dead assumption behind it', () => {
		// The list is MIXED and ORDERED: the intent id sits FIRST, so the loop must skip it to reach the expired
		// assumption. `continue` is the sound reading — an id of the wrong kind carries no status, so it carries no
		// verdict either — and the alternative (fail-closed on anything unreadable) would refuse this approval while
		// naming the INTENT as the dead assumption, which is a false statement about a live object.
		ok(
			dispatch(
				'DetectAssumption',
				{
					assumptionId: ASM,
					statement: 'The tenant identity model is stable',
					introducedBy: actor,
					affectedObjectIds: [PWU],
					materiality: 'MATERIAL'
				},
				ASM,
				'ASSUMPTION'
			),
			'detect assumption'
		);
		ok(proposePwu([INTENT, ASM]), 'propose pwu with a mixed assumption list');
		ok(proposePlan(), 'propose plan');
		ok(
			dispatch(
				'ExpireAssumption',
				{ expirationCondition: 'stale as of review' },
				ASM,
				'ASSUMPTION'
			),
			'expire assumption'
		);

		const r = approve();
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(r.error?.message).toContain('RPH-ASM-006');
		expect(r.error?.message, 'the refusal names the assumption it reached').toContain(ASM);
		expect(
			r.error?.message,
			'and never the intent it stepped over — that would be a verdict on an object with no status'
		).not.toContain(INTENT);
		expect(
			(store.loadObject(PLAN)!.state as { status: string }).status,
			'the plan did not advance'
		).toBe('UNDER_REVIEW');
	});

	// ── T8 — THE DECISION A CANCELLED BRANCH NEVER TOOK ──────────────────────────────────────────────────────

	it('records a prune cut by a CANCELLED branch with no selectedEdgeId, because no arm was ever selected', () => {
		// A BRANCH that is CANCELLED before it decides neutralizes its out-edges by its STATE (the irrecoverable
		// rung), not by a decision — so the cut has a branch and an excluded edge but no selected one. R12's rule
		// is that the three BRANCH fields keep their exact meaning: an absent decision is ABSENT, so a consumer
		// learns nothing NEW rather than something FALSE.
		activePlan({
			steps: [mkStep(1, { stepType: 'BRANCH' }), mkStep(2), mkStep(3)],
			transitions: [
				cedge(1, 2, { op: 'RESULT_EQUALS', stepId: sid(1), path: 'outcome', value: 'PASS' }),
				gedge(1, 3)
			]
		});

		ok(
			dispatch('CancelExecutionStep', { stepId: sid(1), reason: 'withdrawn before it ran' }),
			'cancel the branch'
		);
		ok(
			dispatch('PruneExecutionStep', { stepId: sid(2) }),
			'prune the arm the branch can no longer take'
		);

		const pruned = payloadOfType('ExecutionStepPruned');
		expect(pruned.cause).toBe('BRANCH_DECISION');
		expect(pruned.selectedByBranchStepId).toBe(sid(1));
		expect(pruned.excludedEdgeId).toBe(tid(1, 2));
		expect(
			'selectedEdgeId' in pruned,
			'a branch that never decided selected no edge — the field is absent, not empty'
		).toBe(false);
		expect(stepStateOf(sid(2))).toBe('SKIPPED');
	});
});
