// JAN-EXECREM WP-14 — two never-populated fields, both now DERIVED and neither caller-assertable (F-31, F-37).
//
// F-31 — THE BINDING. `StartExecutionStepPayloadSchema` is a strictObject carrying only `stepId`, so the handler's
// `p.runtimeBindingId` read was UNREACHABLE: a command carrying the field is refused at the schema boundary before
// any handler runs. Consequences: `ExecutionStepStarted.runtimeBindingId` had NO producer and could never be
// populated; `aiNoBinding` — an advisory defined as "an AI step opened this attempt with no recorded binding" —
// was therefore TRUE for every AI attempt the engine would ever emit, which is an advisory carrying no
// information; and the test that "proved" the silent branch hand-crafted an event shape no producer could emit.
//
// THE DISPOSITION IS ARGUED, NOT DEFAULTED. The tempting repair — widen the command — is the wrong one. The
// ratified relation is Binding -> Step (RequestRuntimeBinding names an executionStepId), `ExecutionStepSchema`
// already carries the field, and three consumers already read `step.runtimeBindingId` as authoritative. A
// per-invocation binding on Start would be a SECOND, LATER, UNAUTHORIZED source of truth for a fact the approved
// plan already fixed. The strictObject was accidentally preventing exactly that, so it stays and the producer
// reads the plan. Both dispositions are pinned below at the schema boundary.
//
// F-37 — THE PRUNE PROVENANCE. The sole justification DR-004 §19-M1 gave for minting `ExecutionStepPruned` rather
// than reusing the waived-skip event was that it carries provenance ("do not conflate a system prune with a user
// waiver"). No producer ever populated it, so the two events differed only by TYPE and never by CONTENT.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-12T00:00:00Z';
const actor: ActorReference = { actorId: 'u1', actorType: 'HUMAN', displayName: 'A' };
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69H6100';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69H6110';
const PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69H6120';
const BINDING = 'rb_01ARZ3NDEKTSV4RRFFQ69H6130';
const sid = (i: number) => `${PLAN}-s${i}`;
const tid = (a: number, b: number) => `${PLAN}-t${a}-${b}`;

const SAYS_NOTHING = {
	reason: 'NO_DOWNSTREAM_CONSUMABLE_RESULT' as const,
	detail: 'A coordination step; it authors no artifact.'
};

describe('JAN-EXECREM WP-14 — binding + prune provenance are DERIVED, never asserted', () => {
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
			correlationId: 'wp14',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	}
	const ok = (r: { status: string; error?: { message?: string } }, what: string) => {
		expect(r.status, `${what}: ${r.error?.message}`).toBe('ACCEPTED');
		return r;
	};
	const eventsOf = (type: string) => store.readAllEvents().filter((e) => e.eventType === type);
	const planState = () =>
		store.loadObject(PLAN)!.state as { authorizedRuntimeBindingIds?: string[] };

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

	function activate(steps: unknown[], transitions: unknown[] = [], bindings: string[] = []) {
		ok(
			dispatch('ProposeExecutionPlan', {
				executionPlanId: PLAN,
				workUnitId: PWU,
				steps,
				transitions,
				retryPolicy: {},
				tacticalChangePolicy: {},
				escalationPolicy: {},
				terminationPolicy: {}
			}),
			'propose'
		);
		ok(dispatch('ApproveExecutionPlan', {}), 'approve');
		ok(dispatch('ActivateExecutionPlan', { authorizedRuntimeBindingIds: bindings }), 'activate');
	}

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({ authenticate: testAuthenticator(), store, now: () => TS, newEventId: () => `e${++seq}` }).as(TEST_CRED.human);
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

	// ── F-31: the binding ───────────────────────────────────────────────────────────────────────────────────────

	/**
	 * Mint the binding this suite's steps name, and AUTHORIZE it.
	 *
	 * FIXTURE CORRECTED BY JAN-EXEBIND WP-B1, and the correction is the finding. This suite authored steps naming
	 * `BINDING` while **no RUNTIME_BINDING of that id ever existed** — which was fine only because nothing resolved
	 * the field. RPH-EXE-003 now does, and fails closed on an unresolvable authority, so the arrangement stopped
	 * being legal the moment the ratified rule became enforced.
	 *
	 * That is DS-001 §4 item 3 exactly — "tests codified the holes as intent" — and the response is the one this
	 * lineage has taken every time: MAKE THE FIXTURE HONEST, never weaken the rule to keep a suite green. The
	 * assertions below are unchanged; only the arrangement is now one the engine could actually produce.
	 */
	const mintAuthorizedBinding = () => {
		ok(
			dispatch(
				'RequestRuntimeBinding',
				{
					runtimeBindingId: BINDING,
					executionStepId: sid(1),
					roleId: 'role-executor',
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
	};

	it('THE KILL TEST: the Started event records the binding the APPROVED PLAN authored', () => {
		// RED before WP-14: the emitted payload was byte-for-byte `{stepId, stepState:'RUNNING'}` — the event field
		// had no producer at all.
		mintAuthorizedBinding();
		activate([mkStep(1, { stepType: 'MODEL_INVOCATION', runtimeBindingId: BINDING })], [], [BINDING]);
		ok(dispatch('StartExecutionStep', { stepId: sid(1) }), 'start');
		expect(eventsOf('ExecutionStepStarted')[0]!.payload).toEqual({
			stepId: sid(1),
			runtimeBindingId: BINDING,
			stepState: 'RUNNING'
		});
	});

	it('an UNBOUND step records no binding — the field is honest, not defaulted', () => {
		activate([mkStep(1, { stepType: 'MODEL_INVOCATION' })]);
		ok(dispatch('StartExecutionStep', { stepId: sid(1) }), 'start');
		expect(Object.hasOwn(eventsOf('ExecutionStepStarted')[0]!.payload as object, 'runtimeBindingId')).toBe(
			false
		);
	});

	it('THE ARGUED DISPOSITION, PINNED: a caller may NOT assert the binding on StartExecutionStep', () => {
		// The strictObject is the guarantee. If a later edit widened the command "to make the field settable", this
		// goes RED — which is the point: the approved plan fixes the binding, and a per-invocation override would
		// be a second, later, unauthorized source of truth for it.
		activate([mkStep(1, { stepType: 'MODEL_INVOCATION', runtimeBindingId: BINDING })]);
		const r = dispatch('StartExecutionStep', { stepId: sid(1), runtimeBindingId: 'rb_someone_elses' });
		expect(r.status).toBe('VALIDATION_FAILED');
		expect(r.error?.code).toBe('RPH_VALIDATION_SCHEMA_FAILED');
	});

	it('the activation allowlist is WRITTEN to the plan, not merely emitted', () => {
		// It was carried on the event and never persisted, so the ratified allowlist existed only in the log and
		// nothing could read it back. Any rule citing it would have been dead on arrival.
		activate([mkStep(1)], [], [BINDING]);
		expect(planState().authorizedRuntimeBindingIds).toEqual([BINDING]);
	});

	it('an activation authorizing NO bindings records an empty list, not an absent one', () => {
		// The seed's exact shape. An absent field and an empty list are different claims: "not recorded" vs
		// "authorized nothing".
		activate([mkStep(1)]);
		expect(planState().authorizedRuntimeBindingIds).toEqual([]);
	});

	// ── F-37: prune provenance ──────────────────────────────────────────────────────────────────────────────────

	/** s1 BRANCH -> s2 (guarded, FALSE) | s3 (default, taken); s2 -> s4 so the dead arm has a downstream. */
	function branchPlan() {
		activate(
			// s3 is the LIVE arm this file SKIPS to prove a skip records no prune provenance. The plan declares it
			// ADVISORY because the request can no longer claim it (REG-F-105): the other three stay MANDATORY, so
			// the declaration is scoped to the one step the file actually needs skippable.
			[mkStep(1, { stepType: 'BRANCH' }), mkStep(2), mkStep(3, { strength: 'ADVISORY' }), mkStep(4)],
			[
				{
					id: tid(1, 2),
					executionPlanId: PLAN,
					sourceStepId: sid(1),
					targetStepId: sid(2),
					transitionType: 'CONDITIONAL',
					conditionExpression: { op: 'RESULT_EQUALS', stepId: sid(1), path: 'outcome', value: 'PASS' }
				},
				{
					id: tid(1, 3),
					executionPlanId: PLAN,
					sourceStepId: sid(1),
					targetStepId: sid(3),
					transitionType: 'SEQUENTIAL'
				},
				{
					id: tid(2, 4),
					executionPlanId: PLAN,
					sourceStepId: sid(2),
					targetStepId: sid(4),
					transitionType: 'SEQUENTIAL'
				}
			]
		);
		ok(dispatch('StartExecutionStep', { stepId: sid(1) }), 'start branch');
		ok(
			dispatch('CompleteExecutionStep', {
				executionStepId: sid(1),
				executionAttemptId: `${sid(1)}-a1`,
				resultStatus: 'SUCCEEDED',
				outputArtifactIds: [],
				proposedEvidenceIds: [],
				detectedAssumptionIds: [],
				structuredResult: { outcome: 'FAIL' }, // the guard is FALSE -> the DEFAULT arm (s3) is taken
				noOutputResult: SAYS_NOTHING,
				executionProvenance: { executedBy: actor, originType: 'HUMAN_DECISION' }
			}),
			'complete branch'
		);
	}

	it('THE KILL TEST: a pruned step records WHICH branch cut it, which arm was taken, and which was cut', () => {
		// Before WP-14 the payload was `{stepId, stepState:'SKIPPED'}` — indistinguishable in content from a
		// waived skip, which is the exact conflation the separate event type was minted to prevent.
		branchPlan();
		ok(dispatch('PruneExecutionStep', { stepId: sid(2) }), 'prune the dead arm');
		expect(eventsOf('ExecutionStepPruned')[0]!.payload).toEqual({
			stepId: sid(2),
			// JAN-REVREM RW-7 (N-8): the payload now NAMES its cause. This assertion changed because the contract
			// changed by design (DS-001 §6c R11), not to make a red test go away — and it is stronger for it: a prune
			// whose cause went missing would now fail here rather than pass with three of four fields.
			cause: 'BRANCH_DECISION',
			selectedByBranchStepId: sid(1),
			selectedEdgeId: tid(1, 3), // the arm the branch TOOK
			excludedEdgeId: tid(1, 2), // the arm that was CUT — the one s2 hangs off
			stepState: 'SKIPPED'
		});
	});

	it('THE TRANSITIVE CASE: a step deep in the dead arm is attributed to the same cut', () => {
		// The reason provenance WALKS the dead subgraph instead of reading the step's own in-edges: s4's only
		// in-edge comes from s2, another DEAD step — not from the branch. Reading immediate in-edges would find
		// provenance for the first step of a dead arm and nothing for the rest of it.
		branchPlan();
		ok(dispatch('PruneExecutionStep', { stepId: sid(4) }), 'prune the downstream');
		expect(eventsOf('ExecutionStepPruned')[0]!.payload).toEqual({
			stepId: sid(4),
			cause: 'BRANCH_DECISION',
			selectedByBranchStepId: sid(1),
			selectedEdgeId: tid(1, 3),
			excludedEdgeId: tid(1, 2),
			stepState: 'SKIPPED'
		});
	});

	it('RW-7 / N-8: a step cut by a CANCELLED predecessor records DEAD_PREDECESSOR, through the ENGINE', () => {
		// TEST 7 OF THE RW-7 BATTERY, and it is at the engine layer on purpose. The domain battery proves the walk
		// DERIVES the new cause; this proves the handler EMITS it. Keeping only the first would be F-31's exact shape
		// — provenance derived correctly and dropped on the way out — which is a defect this very file exists to have
		// closed once already.
		//
		// A LINEAR plan, not `branchPlan()`: no BRANCH anywhere, so nothing can supply a BRANCH_DECISION and the
		// DEAD_PREDECESSOR arm is the only thing that could possibly answer.
		activate(
			[mkStep(1), mkStep(2), mkStep(3)],
			[
				{
					id: tid(1, 2),
					executionPlanId: PLAN,
					sourceStepId: sid(1),
					targetStepId: sid(2),
					transitionType: 'SEQUENTIAL'
				},
				{
					id: tid(2, 3),
					executionPlanId: PLAN,
					sourceStepId: sid(2),
					targetStepId: sid(3),
					transitionType: 'SEQUENTIAL'
				}
			]
		);
		ok(
			dispatch('CancelExecutionStep', { stepId: sid(2), reason: 'abandoning this arm' }),
			'cancel the middle step'
		);
		ok(dispatch('PruneExecutionStep', { stepId: sid(3) }), 'prune below the cancelled step');
		const payload = eventsOf('ExecutionStepPruned')[0]!.payload as Record<string, unknown>;
		expect(payload.cause).toBe('DEAD_PREDECESSOR');
		expect(payload.deadPredecessorStepId).toBe(sid(2));
		expect(payload.deadPredecessorStepState).toBe('CANCELLED');
		expect(payload.excludedEdgeId).toBe(tid(2, 3));
		// R12: the BRANCH fields stay ABSENT rather than being filled with something false.
		expect(Object.hasOwn(payload, 'selectedByBranchStepId')).toBe(false);
		expect(Object.hasOwn(payload, 'selectedEdgeId')).toBe(false);
	});

	it('THE ARGUED DISPOSITION, PINNED: a caller may NOT assert prune provenance either', () => {
		branchPlan();
		const r = dispatch('PruneExecutionStep', { stepId: sid(2), selectedEdgeId: tid(1, 9) });
		expect(r.status).toBe('VALIDATION_FAILED');
		expect(r.error?.code).toBe('RPH_VALIDATION_SCHEMA_FAILED');
	});

	it('a SKIP records no prune provenance — the two events differ in CONTENT, which was the whole point', () => {
		// DR-004 §19-M1 minted ExecutionStepPruned so a system prune could not be confused with a user waiver.
		// That is only true if the two carry different content.
		branchPlan();
		ok(dispatch('SkipExecutionStep', { stepId: sid(3) }), 'skip the LIVE arm');
		const skipped = eventsOf('ExecutionStepSkipped')[0]!.payload as object;
		expect(Object.hasOwn(skipped, 'selectedByBranchStepId')).toBe(false);
		expect(Object.hasOwn(skipped, 'excludedEdgeId')).toBe(false);
	});
});
