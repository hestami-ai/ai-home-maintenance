// JAN-EXECPLAN-DR-003 DWP-01 — the linear start-gate. StartExecutionStep gains a predecessor precheck: a step may
// start ONLY when every EARLIER step (array index in plan.steps) is terminal-success (SUCCEEDED/SKIPPED) — RPH-EXE-005
// read linearly (Fork F), enforced AT START so nothing runs out of order. This is the AUTHORITY the pure read-model
// `startableStepId` (rph-projections/execution-view.ts) mirrors for the UI. Array index IS the order (F-2: the strict
// ExecutionStep contract has NO `ordinal` — it is persistence-only). No cascade, no readying events, no machine
// change: steps stay seeded at QUEUED and the plan drives itself (complete step N → step N+1 becomes startable).
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-12T00:00:00Z';
const actor = { actorId: 'u1', actorType: 'HUMAN' as const, displayName: 'A' };
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69G5K00';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5K10';
const PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69G5K20';
const ATTEMPT = 'attempt_01ARZ3NDEKTSV4RRFFQ69G5K30';

describe('StartExecutionStep — the linear start-gate (DWP-01, RPH-EXE-005 / fork F)', () => {
	let store: SqliteStorageAdapter;
	let engine: Engine;
	let seq = 0;

	function dispatch(commandType: string, payload: unknown, id: string, aggType: string) {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: aggType,
			targetAggregateId: id,
			issuedAt: TS,
			issuedBy: actor,
			correlationId: 'corr',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	}

	const stepId = (i: number) => `${PLAN}-s${i}`;
	const stepStateOf = (i: number) => {
		const plan = store.loadObject(PLAN)?.state as { steps: Array<{ id: string; stepState: string }> };
		return plan.steps.find((s) => s.id === stepId(i))?.stepState;
	};

	/** A TRANSFORMATION step (NOT MODEL_INVOCATION) so a no-output completion clears the floor gate — the gate has no
	 *  result subject to judge, keeping this suite focused on SEQUENCING, not assurance. */
	const step = (i: number, stepState: string) => ({
		id: stepId(i),
		executionPlanId: PLAN,
		stepType: 'TRANSFORMATION',
		purpose: `work ${i}`,
		inputBindings: [],
		outputBindings: [],
		preconditions: [],
		postconditions: [],
		stepState
	});

	/** Propose + approve + activate a plan whose steps sit at the given states (seeded directly — the gate is
	 *  exercised against every arrangement without needing to drive each predecessor there by command). */
	function activePlan(stepStates: string[]) {
		const r = dispatch(
			'ProposeExecutionPlan',
			{
				executionPlanId: PLAN,
				workUnitId: PWU,
				steps: stepStates.map((s, i) => step(i + 1, s)),
				transitions: [],
				retryPolicy: {},
				tacticalChangePolicy: {},
				escalationPolicy: {},
				terminationPolicy: {}
			},
			PLAN,
			'EXECUTION_PLAN'
		);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(dispatch('ApproveExecutionPlan', {}, PLAN, 'EXECUTION_PLAN').status).toBe('ACCEPTED');
		expect(
			dispatch('ActivateExecutionPlan', { authorizedRuntimeBindingIds: [] }, PLAN, 'EXECUTION_PLAN')
				.status
		).toBe('ACCEPTED');
	}

	const start = (i: number) => dispatch('StartExecutionStep', { stepId: stepId(i) }, PLAN, 'EXECUTION_PLAN');
	/** Complete a RUNNING step with an explicit no-output result (no floor subject → no assurance gate). */
	const complete = (i: number) =>
		dispatch(
			'CompleteExecutionStep',
			{
				executionStepId: stepId(i),
				executionAttemptId: ATTEMPT,
				resultStatus: 'SUCCEEDED',
				outputArtifactIds: [],
				proposedEvidenceIds: [],
				detectedAssumptionIds: [],
				structuredResult: {},
				executionProvenance: {}
			},
			PLAN,
			'EXECUTION_PLAN'
		);

	/** A SEQUENTIAL transition edge from step `from` to step `to` (by index). */
	const gedge = (from: number, to: number) => ({
		id: `${PLAN}-t${from}-${to}`,
		executionPlanId: PLAN,
		sourceStepId: stepId(from),
		targetStepId: stepId(to),
		transitionType: 'SEQUENTIAL'
	});
	/** A CONDITIONAL transition edge guarded by `condition` (DWP-02). */
	const cedge = (from: number, to: number, condition: unknown) => ({
		id: `${PLAN}-t${from}-${to}`,
		executionPlanId: PLAN,
		sourceStepId: stepId(from),
		targetStepId: stepId(to),
		transitionType: 'CONDITIONAL',
		conditionExpression: condition
	});
	/** Propose a plan carrying a transition graph — returns the raw result (so a test can assert a reject). */
	const proposeGraph = (stepStates: string[], transitions: unknown[]) =>
		dispatch(
			'ProposeExecutionPlan',
			{
				executionPlanId: PLAN,
				workUnitId: PWU,
				steps: stepStates.map((s, i) => step(i + 1, s)),
				transitions,
				retryPolicy: {},
				tacticalChangePolicy: {},
				escalationPolicy: {},
				terminationPolicy: {}
			},
			PLAN,
			'EXECUTION_PLAN'
		);
	/** Propose + approve + activate a graph plan (asserting each step accepted). */
	function activeGraphPlan(stepStates: string[], transitions: unknown[]) {
		const r = proposeGraph(stepStates, transitions);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(dispatch('ApproveExecutionPlan', {}, PLAN, 'EXECUTION_PLAN').status).toBe('ACCEPTED');
		expect(
			dispatch('ActivateExecutionPlan', { authorizedRuntimeBindingIds: [] }, PLAN, 'EXECUTION_PLAN').status
		).toBe('ACCEPTED');
	}

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

	it('starts the FIRST step of a fresh multi-step plan (no earlier steps → gate passes)', () => {
		activePlan(['QUEUED', 'QUEUED']);
		expect(start(1).status, 'first step has no predecessor').toBe('ACCEPTED');
		expect(stepStateOf(1)).toBe('RUNNING');
	});

	it('REJECTS starting a later step while an earlier one is still QUEUED (out-of-order)', () => {
		activePlan(['QUEUED', 'QUEUED']);
		const r = start(2);
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(r.error?.message).toContain('terminal-success');
		expect(stepStateOf(2)).toBe('QUEUED'); // untouched
	});

	it('REJECTS starting step 2 while step 1 is RUNNING (a running predecessor is not terminal-success)', () => {
		activePlan(['QUEUED', 'QUEUED']);
		expect(start(1).status).toBe('ACCEPTED'); // step 1 now RUNNING
		expect(start(2).status, 'step 1 is RUNNING, not terminal-success').toBe('REJECTED');
	});

	it('ALLOWS starting step 2 once step 1 is SUCCEEDED (seeded predecessor)', () => {
		activePlan(['SUCCEEDED', 'QUEUED']);
		const r = start(2);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(stepStateOf(2)).toBe('RUNNING');
	});

	it('ALLOWS starting step 2 when step 1 is SKIPPED (SKIPPED counts as terminal-success — no deadlock)', () => {
		activePlan(['SKIPPED', 'QUEUED']);
		expect(start(2).status).toBe('ACCEPTED');
	});

	it('REJECTS starting step 2 when an earlier step is FAILED (terminal but NOT success — blocks the sequence)', () => {
		activePlan(['FAILED', 'QUEUED']);
		const r = start(2);
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
	});

	it('enforces the TRANSITIVE rule: a NON-immediate earlier step blocks the start (not just the predecessor)', () => {
		// The case a 2-step plan CANNOT exercise, and the one that distinguishes the real "every earlier step" rule
		// (steps.slice(0, idx)) from a mere "immediate predecessor" (steps[idx-1]) check: step 2 (step 3's immediate
		// predecessor) is SUCCEEDED, but step 1 (a NON-immediate earlier step) is still QUEUED. An immediate-only check
		// would WRONGLY admit start(3); the gate MUST reject it, naming step 1 as the blocker.
		activePlan(['QUEUED', 'SUCCEEDED', 'QUEUED']);
		const r = start(3);
		expect(r.status, 'a non-immediate earlier QUEUED step must block the start').toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(r.error?.message, 'the blocker is the NON-immediate step 1').toContain(stepId(1));
		expect(stepStateOf(3)).toBe('QUEUED');
	});

	it('admits a start only once EVERY earlier step (not just the predecessor) is terminal-success', () => {
		activePlan(['SUCCEEDED', 'SUCCEEDED', 'QUEUED']);
		const r = start(3);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(stepStateOf(3)).toBe('RUNNING');
	});

	it('drives itself: start s1 → complete s1 → s2 becomes startable, all in order', () => {
		activePlan(['QUEUED', 'QUEUED']);
		expect(start(1).status).toBe('ACCEPTED'); // s1 RUNNING
		expect(start(2).status, 's2 not yet startable — s1 is RUNNING').toBe('REJECTED');
		const done = complete(1);
		expect(done.status, JSON.stringify(done.error)).toBe('ACCEPTED'); // s1 SUCCEEDED
		const s2 = start(2);
		expect(s2.status, JSON.stringify(s2.error)).toBe('ACCEPTED'); // now the gate lets s2 run
		expect(stepStateOf(1)).toBe('SUCCEEDED');
		expect(stepStateOf(2)).toBe('RUNNING');
	});

	it('a single-step plan starts unchanged (back-compat regression — the reference/demo drive)', () => {
		activePlan(['QUEUED']);
		expect(start(1).status).toBe('ACCEPTED');
		expect(stepStateOf(1)).toBe('RUNNING');
	});

	// DR-004 DWP-01 (Tier 3C-ii) — the transition GRAPH. The engine gate uses the SAME rph-domain predicate the
	// read-model uses; a malformed graph is rejected at propose; a graph plan drives via the in-edge barrier.
	it('REJECTS a malformed transition graph at propose (dangling target id)', () => {
		const r = proposeGraph(['QUEUED', 'QUEUED'], [
			gedge(1, 2),
			{ id: 'bad', executionPlanId: PLAN, sourceStepId: stepId(1), targetStepId: 'no_such_step', transitionType: 'SEQUENTIAL' }
		]);
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
		expect(r.error?.message).toContain('transition graph');
	});

	it('drives a 2-node graph via the in-edge gate (entry starts; the successor waits then starts)', () => {
		activeGraphPlan(['QUEUED', 'QUEUED'], [gedge(1, 2)]);
		expect(start(1).status, 's1 is the graph entry (no in-edges)').toBe('ACCEPTED'); // → RUNNING
		expect(start(2).status, 's2 in-edge PENDING (s1 not terminal)').toBe('REJECTED');
		expect(complete(1).status).toBe('ACCEPTED'); // s1 SUCCEEDED → s2 in-edge SATISFIED
		const s2 = start(2);
		expect(s2.status, JSON.stringify(s2.error)).toBe('ACCEPTED');
		expect(stepStateOf(2)).toBe('RUNNING');
	});

	// DR-004 DWP-04 (adjacent defect) — the machine classifies RUNNING→RUNNING as a NOOP, so a re-issued Start was
	// ABSORBED and still emitted a second ExecutionStepStarted. attemptsMade counts exactly those events, so a
	// double-dispatched Start silently burned one of the plan's retries (RPH-EXE-008) without opening a real attempt.
	it('REFUSES to re-start an already-RUNNING step (a NOOP re-issue would inflate attemptsMade)', () => {
		activePlan(['QUEUED']);
		expect(start(1).status).toBe('ACCEPTED');
		const again = start(1);
		expect(again.status).toBe('REJECTED');
		expect(again.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(again.error?.message).toContain('to be QUEUED, but it is RUNNING');
		expect(store.readAllEvents().filter((e) => e.eventType === 'ExecutionStepStarted')).toHaveLength(1);
	});

	// DR-004 DWP-02 (Tier 3C-ii) — CONDITIONAL edges: the guard is evaluated against the plan's committed subject.
	// A guarded arm may leave ONLY a BRANCH step (DWP-07): propose-time validation and the runtime gate now agree on
	// which node selects exclusively, so these fixtures type s1 BRANCH and give it the required SEQUENTIAL default last.
	const proposeBranch = (transitions: unknown[]) =>
		dispatch(
			'ProposeExecutionPlan',
			{
				executionPlanId: PLAN,
				workUnitId: PWU,
				steps: [{ ...step(1, 'QUEUED'), stepType: 'BRANCH' }, step(2, 'QUEUED'), step(3, 'QUEUED')],
				transitions,
				retryPolicy: {},
				tacticalChangePolicy: {},
				escalationPolicy: {},
				terminationPolicy: {}
			},
			PLAN,
			'EXECUTION_PLAN'
		);
	const activeBranch = (transitions: unknown[]) => {
		const r = proposeBranch(transitions);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(dispatch('ApproveExecutionPlan', {}, PLAN, 'EXECUTION_PLAN').status).toBe('ACCEPTED');
		expect(
			dispatch('ActivateExecutionPlan', { authorizedRuntimeBindingIds: [] }, PLAN, 'EXECUTION_PLAN').status
		).toBe('ACCEPTED');
	};

	it('a CONDITIONAL in-edge with a TRUE guard makes the target startable once the source succeeds', () => {
		activeBranch([cedge(1, 2, { op: 'STEP_SUCCEEDED', stepId: stepId(1) }), gedge(1, 3)]);
		expect(start(1).status).toBe('ACCEPTED'); // s1 entry
		expect(complete(1).status).toBe('ACCEPTED'); // s1 SUCCEEDED
		const s2 = start(2);
		expect(s2.status, JSON.stringify(s2.error)).toBe('ACCEPTED'); // STEP_SUCCEEDED(s1) is true → SATISFIED
	});

	it('a CONDITIONAL in-edge with a FALSE guard leaves the target non-startable (NEUTRALIZED)', () => {
		activeBranch([cedge(1, 2, { op: 'ATTEMPTS', stepId: stepId(1), cmp: '>', value: 99 }), gedge(1, 3)]);
		expect(start(1).status).toBe('ACCEPTED');
		expect(complete(1).status).toBe('ACCEPTED'); // s1 SUCCEEDED (attemptsMade = 1)
		expect(start(2).status, 'attempts(s1)=1 is not > 99 → guard false → s2 neutralized').toBe('REJECTED');
	});

	it('REJECTS a malformed conditionExpression at propose (RPH_VALIDATION_SCHEMA_FAILED)', () => {
		const r = proposeBranch([cedge(1, 2, { op: 'NONSENSE', stepId: stepId(1) }), gedge(1, 3)]);
		expect(r.status, JSON.stringify(r.error)).not.toBe('ACCEPTED');
		expect(r.error?.code).toBe('RPH_VALIDATION_SCHEMA_FAILED');
	});

	it('REJECTS a condition referencing an undeclared step at propose', () => {
		const r = proposeBranch([cedge(1, 2, { op: 'STEP_SUCCEEDED', stepId: 'ghost_step' }), gedge(1, 3)]);
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
		expect(r.error?.message).toContain('ghost_step');
	});

	// DWP-07: the two planes must agree on which node branches. A guarded arm leaving a non-BRANCH step used to pass
	// propose validation and then get FULL exclusive semantics at runtime — so a PARALLEL_GROUP mixing one guarded arm
	// with unconditional ones silently lost every arm but the first match.
	it('REJECTS a CONDITIONAL out-edge from a non-BRANCH step at propose (the two planes cannot drift)', () => {
		const r = proposeGraph(
			['QUEUED', 'QUEUED'],
			[cedge(1, 2, { op: 'STEP_SUCCEEDED', stepId: stepId(1) })]
		);
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
		expect(r.error?.message).toContain('not BRANCH');
	});

	it('REJECTS a BRANCH whose unconditional default is not LAST (it would make later arms unreachable)', () => {
		const r = proposeBranch([gedge(1, 3), cedge(1, 2, { op: 'STEP_SUCCEEDED', stepId: stepId(1) })]);
		expect(r.status).toBe('REJECTED');
		expect(r.error?.message).toContain('LAST out-edge');
	});

	// DR-004 DWP-03 (Tier 3C-ii) — BRANCH: first-match selection + prune-to-SKIPPED, driven to completion.
	describe('BRANCH + prune (DWP-03)', () => {
		const prune = (i: number) => dispatch('PruneExecutionStep', { stepId: stepId(i) }, PLAN, 'EXECUTION_PLAN');
		/** Propose+approve+activate a BRANCH plan: s1 BRANCH → [s2 (COND STEP_SUCCEEDED s1), s3 (SEQ default)]. */
		function activeBranchPlan() {
			const r = dispatch(
				'ProposeExecutionPlan',
				{
					executionPlanId: PLAN,
					workUnitId: PWU,
					steps: [{ ...step(1, 'QUEUED'), stepType: 'BRANCH' }, step(2, 'QUEUED'), step(3, 'QUEUED')],
					transitions: [cedge(1, 2, { op: 'STEP_SUCCEEDED', stepId: stepId(1) }), gedge(1, 3)],
					retryPolicy: {},
					tacticalChangePolicy: {},
					escalationPolicy: {},
					terminationPolicy: {}
				},
				PLAN,
				'EXECUTION_PLAN'
			);
			expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
			expect(dispatch('ApproveExecutionPlan', {}, PLAN, 'EXECUTION_PLAN').status).toBe('ACCEPTED');
			expect(
				dispatch('ActivateExecutionPlan', { authorizedRuntimeBindingIds: [] }, PLAN, 'EXECUTION_PLAN').status
			).toBe('ACCEPTED');
		}

		it('selects one arm (first-match), prunes the not-taken arm to SKIPPED, and completes', () => {
			activeBranchPlan();
			expect(start(1).status).toBe('ACCEPTED'); // s1 BRANCH is the entry
			expect(complete(1).status).toBe('ACCEPTED'); // s1 SUCCEEDED → STEP_SUCCEEDED(s1) true → s2 selected
			expect(start(2).status, 's2 is the selected arm').toBe('ACCEPTED');
			expect(start(3).status, 's3 is the not-taken default → NEUTRALIZED → not startable').toBe('REJECTED');
			const pr = prune(3);
			expect(pr.status, JSON.stringify(pr.error)).toBe('ACCEPTED'); // system prune → SKIPPED
			expect(stepStateOf(3)).toBe('SKIPPED');
			expect(complete(2).status).toBe('ACCEPTED'); // s2 SUCCEEDED
			// s1 SUCCEEDED, s2 SUCCEEDED, s3 SKIPPED → the plan completes (≥1 SUCCEEDED, all terminal-success).
			const done = dispatch('CompleteExecutionPlan', {}, PLAN, 'EXECUTION_PLAN');
			expect(done.status, JSON.stringify(done.error)).toBe('ACCEPTED');
		});
	});

	// DR-004 DWP-05 (Tier 3C-ii) — PARALLEL_GROUP fan-out + barrier JOIN. No gate logic is added here: the set frontier
	// and the in-edge barrier shipped in DWP-01 and PARALLEL_GROUP is a node KIND the gate deliberately does not
	// special-case (D2 — parallelism is TOPOLOGY, ≥2 unconditional out-edges, not an edge type). What this suite proves
	// is that the AGGREGATE and its per-step machinery survive N concurrently-RUNNING steps: nothing in the handlers
	// assumed a single active step, and N starts against one aggregate serialize without a lost update.
	describe('PARALLEL_GROUP + JOIN (DWP-05)', () => {
		const fail = (i: number) =>
			dispatch(
				'FailExecutionStep',
				{ stepId: stepId(i), failureReason: `step ${i} failed` },
				PLAN,
				'EXECUTION_PLAN'
			);
		const retry = (i: number) =>
			dispatch('RetryExecutionStep', { stepId: stepId(i) }, PLAN, 'EXECUTION_PLAN');
		const revisionOf = () => store.loadObject(PLAN)?.revision;
		const startedCount = (i: number) =>
			store
				.readAllEvents()
				.filter(
					(e) =>
						e.eventType === 'ExecutionStepStarted' &&
						(e.payload as { stepId?: string })?.stepId === stepId(i)
				).length;

		/** s1 (PARALLEL_GROUP) → s2 ∥ s3 → s4 (join). The canonical fan-out/join shape. */
		function activeParallelPlan() {
			const r = dispatch(
				'ProposeExecutionPlan',
				{
					executionPlanId: PLAN,
					workUnitId: PWU,
					steps: [
						{ ...step(1, 'QUEUED'), stepType: 'PARALLEL_GROUP' },
						step(2, 'QUEUED'),
						step(3, 'QUEUED'),
						step(4, 'QUEUED')
					],
					transitions: [gedge(1, 2), gedge(1, 3), gedge(2, 4), gedge(3, 4)],
					retryPolicy: {},
					tacticalChangePolicy: {},
					escalationPolicy: {},
					terminationPolicy: {}
				},
				PLAN,
				'EXECUTION_PLAN'
			);
			expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
			expect(dispatch('ApproveExecutionPlan', {}, PLAN, 'EXECUTION_PLAN').status).toBe('ACCEPTED');
			expect(
				dispatch('ActivateExecutionPlan', { authorizedRuntimeBindingIds: [] }, PLAN, 'EXECUTION_PLAN').status
			).toBe('ACCEPTED');
			// The PARALLEL_GROUP node itself is an ordinary step that runs first; its SUCCESS is what opens the fan-out.
			expect(start(1).status).toBe('ACCEPTED');
			expect(complete(1).status).toBe('ACCEPTED');
		}

		it('runs BOTH arms concurrently, then JOINS only after the last one succeeds', () => {
			activeParallelPlan();
			expect(start(1).status, 's1 already SUCCEEDED — no restart').not.toBe('ACCEPTED');

			// Both arms start; neither start clobbers the other's stepState (each command reloads the aggregate).
			expect(start(2).status).toBe('ACCEPTED');
			expect(start(3).status).toBe('ACCEPTED');
			expect(stepStateOf(2)).toBe('RUNNING');
			expect(stepStateOf(3)).toBe('RUNNING'); // ← the lost-update guard: s2 is still RUNNING too

			// The join is blocked while EITHER arm is unfinished, and says which one.
			expect(start(4).status, 'both arms still RUNNING').toBe('REJECTED');
			expect(complete(2).status).toBe('ACCEPTED');
			const blocked = start(4);
			expect(blocked.status, 'one arm still RUNNING').toBe('REJECTED');
			expect(blocked.error?.message).toContain(stepId(3));

			expect(complete(3).status).toBe('ACCEPTED');
			const joined = start(4);
			expect(joined.status, JSON.stringify(joined.error)).toBe('ACCEPTED');
			expect(complete(4).status).toBe('ACCEPTED');
			const done = dispatch('CompleteExecutionPlan', {}, PLAN, 'EXECUTION_PLAN');
			expect(done.status, JSON.stringify(done.error)).toBe('ACCEPTED');
		});

		it('serializes N starts on the aggregate revision — one revision per accepted command, no lost update', () => {
			activeParallelPlan();
			const before = revisionOf()!;
			expect(start(2).status).toBe('ACCEPTED');
			expect(start(3).status).toBe('ACCEPTED');
			// Each accepted step command commits exactly one revision (commitState's expectedRevision check); the
			// second start read the FIRST one's committed state, which is why both arms survive.
			expect(revisionOf()).toBe(before + 2);
			expect([stepStateOf(2), stepStateOf(3)]).toEqual(['RUNNING', 'RUNNING']);
		});

		it('keeps retry + the attempt cap PER STEP — one arm failing and retrying leaves its sibling untouched', () => {
			activeParallelPlan();
			start(2);
			start(3);
			expect(fail(2).status).toBe('ACCEPTED');
			expect(stepStateOf(3), 'the sibling is unaffected by its arm failing').toBe('RUNNING');
			expect(retry(2).status).toBe('ACCEPTED');
			expect(stepStateOf(2)).toBe('QUEUED');
			expect(start(2).status, 'the retried arm is startable again (its in-edge is still SATISFIED)').toBe(
				'ACCEPTED'
			);
			// attemptsMade is counted per stepId: the retried arm is on attempt 2, its sibling still on attempt 1.
			expect(startedCount(2)).toBe(2);
			expect(startedCount(3)).toBe(1);
		});

		it('the JOIN still fires when one arm FAILED (neutralized, not wedged) — but the PLAN cannot complete', () => {
			// D7 chose "no PENDING ∧ ≥1 SATISFIED" precisely so a failed arm neutralizes rather than wedging the join
			// forever. That is not a fabricated success: the plan-completion allow-list independently refuses to close
			// a plan holding a FAILED step, so the failure still has to be dealt with.
			activeParallelPlan();
			start(2);
			start(3);
			expect(complete(2).status).toBe('ACCEPTED');
			expect(fail(3).status).toBe('ACCEPTED');
			const joined = start(4);
			expect(joined.status, JSON.stringify(joined.error)).toBe('ACCEPTED');
			expect(complete(4).status).toBe('ACCEPTED');
			const done = dispatch('CompleteExecutionPlan', {}, PLAN, 'EXECUTION_PLAN');
			expect(done.status, 'a FAILED step is not terminal-success').toBe('REJECTED');
			expect(done.error?.message).toContain('FAILED');
		});
	});

	// DR-004 DWP-04 (Tier 3C-ii) — WAIT: the machine declared RUNNING↔WAITING but no command could reach it and no
	// event could record the resume (the DS-004 F-6 unreachable-state + replay hole). Both are now closed.
	describe('WAIT + resume (DWP-04)', () => {
		const wait = (i: number, waitReason?: string) =>
			dispatch(
				'EnterExecutionStepWait',
				{ stepId: stepId(i), ...(waitReason ? { waitReason } : {}) },
				PLAN,
				'EXECUTION_PLAN'
			);
		const resolve = (i: number, resolution?: string) =>
			dispatch(
				'ResolveExecutionStepWait',
				{ stepId: stepId(i), ...(resolution ? { resolution } : {}) },
				PLAN,
				'EXECUTION_PLAN'
			);
		const eventsOfType = (t: string) => store.readAllEvents().filter((e) => e.eventType === t);

		it('suspends a RUNNING step to WAITING and resumes it to RUNNING, then completes', () => {
			activePlan(['QUEUED']);
			expect(start(1).status).toBe('ACCEPTED');
			const w = wait(1, 'blocked on an external approval');
			expect(w.status, JSON.stringify(w.error)).toBe('ACCEPTED');
			expect(stepStateOf(1)).toBe('WAITING');
			const r = resolve(1, 'approval granted');
			expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
			expect(stepStateOf(1)).toBe('RUNNING');
			expect(complete(1).status).toBe('ACCEPTED');
		});

		it('records BOTH halves as governed-stream facts carrying the RESULTING state (the replay hole)', () => {
			activePlan(['QUEUED']);
			start(1);
			wait(1, 'awaiting fixture');
			resolve(1, 'fixture arrived');
			const waiting = eventsOfType('ExecutionStepWaiting');
			const resumed = eventsOfType('ExecutionStepWaitResolved');
			expect(waiting).toHaveLength(1);
			expect(waiting[0]?.payload).toMatchObject({
				stepId: stepId(1),
				waitReason: 'awaiting fixture',
				stepState: 'WAITING'
			});
			expect(resumed).toHaveLength(1);
			expect(resumed[0]?.payload).toMatchObject({
				stepId: stepId(1),
				resolution: 'fixture arrived',
				stepState: 'RUNNING'
			});
		});

		it('does NOT count the resume as an attempt (the retry cap reads ExecutionStepStarted only, RPH-EXE-008)', () => {
			activePlan(['QUEUED']);
			start(1);
			wait(1);
			resolve(1);
			// One RUNNING episode = one attempt, however many times it paused: the resume must not re-mint a Started.
			expect(eventsOfType('ExecutionStepStarted')).toHaveLength(1);
		});

		it('REJECTS a wait from a non-RUNNING state and a resume from a non-WAITING state (the machine gates both)', () => {
			activePlan(['QUEUED']);
			expect(wait(1).status, 'QUEUED has no →WAITING arrow').toBe('REJECTED');
			expect(start(1).status).toBe('ACCEPTED');
			expect(resolve(1).status, 'RUNNING has no →RUNNING resume arrow').toBe('REJECTED');
		});

		it('permits a wait under a NON-ACTIVE plan but REFUSES the resume (suspend ≠ opening work, RPH-EXE-002)', () => {
			activePlan(['QUEUED']);
			expect(start(1).status).toBe('ACCEPTED');
			expect(
				dispatch('CancelExecutionPlan', { reason: 'sponsor pulled it' }, PLAN, 'EXECUTION_PLAN').status
			).toBe('ACCEPTED');
			// A running step must still be able to say honestly that it is blocked — cancel-shaped, not start-shaped.
			const w = wait(1, 'blocked');
			expect(w.status, JSON.stringify(w.error)).toBe('ACCEPTED');
			expect(stepStateOf(1)).toBe('WAITING');
			// Resuming re-opens RUNNING (where attempts execute), so it is start-shaped and must be refused.
			const r = resolve(1);
			expect(r.status).toBe('REJECTED');
			expect(r.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
			expect(r.error?.message).toContain('Cancel the step instead');
			expect(stepStateOf(1)).toBe('WAITING');
		});
	});

	// ── DWP-07: adversarial-audit remediation at the AUTHORITY layer. Each reproduces a real defect in the landed code.
	describe('DWP-07 — audit remediation (command authorization)', () => {
		const wait = (i: number) =>
			dispatch('EnterExecutionStepWait', { stepId: stepId(i) }, PLAN, 'EXECUTION_PLAN');
		const prune = (i: number) =>
			dispatch('PruneExecutionStep', { stepId: stepId(i) }, PLAN, 'EXECUTION_PLAN');
		const startedCount = (i: number) =>
			store
				.readAllEvents()
				.filter(
					(e) =>
						e.eventType === 'ExecutionStepStarted' &&
						(e.payload as { stepId?: string })?.stepId === stepId(i)
				).length;

		// A command must be issuable only from the states its OWN vocab declares. The machine alone is not enough: it
		// legalises WAITING->RUNNING for the RESUME, and Start was riding that arrow.
		it('REFUSES StartExecutionStep on a WAITING step — that arrow belongs to ResolveExecutionStepWait', () => {
			activePlan(['QUEUED']);
			expect(start(1).status).toBe('ACCEPTED');
			expect(wait(1).status).toBe('ACCEPTED');
			expect(stepStateOf(1)).toBe('WAITING');

			const forced = start(1);
			expect(forced.status).toBe('REJECTED');
			expect(forced.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
			expect(forced.error?.message).toContain('drivesFrom QUEUED');
			// The step did NOT silently resume, and no second attempt was opened against the retry cap (RPH-EXE-008).
			expect(stepStateOf(1)).toBe('WAITING');
			expect(startedCount(1)).toBe(1);
			// The legitimate route still works, and records the resume as its own governed fact.
			expect(dispatch('ResolveExecutionStepWait', { stepId: stepId(1) }, PLAN, 'EXECUTION_PLAN').status).toBe(
				'ACCEPTED'
			);
			expect(startedCount(1), 'a resume is not an attempt').toBe(1);
		});

		// A re-issued Complete used to be NOOP-absorbed while still emitting a second ExecutionStepSucceeded — and the
		// condition subject folds last-write-wins, so it could retroactively rewrite the basis of a resolved BRANCH.
		it('REFUSES a second CompleteExecutionStep on a SUCCEEDED step (it would rewrite the recorded result)', () => {
			activePlan(['QUEUED']);
			start(1);
			expect(complete(1).status).toBe('ACCEPTED');
			const again = complete(1);
			expect(again.status).toBe('REJECTED');
			expect(again.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
			expect(
				store.readAllEvents().filter((e) => e.eventType === 'ExecutionStepSucceeded')
			).toHaveLength(1);
		});

		// The prune exemption from canSkipStep is only defensible if the step really IS excluded by the plan's own
		// logic. Unchecked, PruneExecutionStep was a universal skip that bypassed the mandatory/waiver rule (§21.1).
		it('REFUSES to prune a REACHABLE step — prune is not a back door around the mandatory-skip waiver', () => {
			activePlan(['QUEUED', 'QUEUED']); // a LINEAR plan: no transitions, so nothing is ever excluded
			const r = prune(2);
			expect(r.status).toBe('REJECTED');
			expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
			expect(r.error?.message).toContain('still reachable');
			expect(stepStateOf(2)).toBe('QUEUED');
			// The honest route for a reachable step is Skip, which enforces the waiver rule and refuses fail-closed.
			const mandatorySkip = dispatch(
				'SkipExecutionStep',
				{ stepId: stepId(2) },
				PLAN,
				'EXECUTION_PLAN'
			);
			expect(mandatorySkip.status, 'mandatory defaults TRUE, so an unwaived skip is refused').toBe('REJECTED');
		});

		it('REFUSES to prune the step a BRANCH actually SELECTED, while still permitting the not-taken arm', () => {
			activeBranch([cedge(1, 2, { op: 'STEP_SUCCEEDED', stepId: stepId(1) }), gedge(1, 3)]);
			expect(start(1).status).toBe('ACCEPTED');
			expect(complete(1).status).toBe('ACCEPTED'); // guard true → s2 selected, s3 excluded
			const selected = prune(2);
			expect(selected.status, 'the taken arm is reachable').toBe('REJECTED');
			expect(selected.error?.message).toContain('still reachable');
			expect(prune(3).status, 'the not-taken arm is genuinely excluded').toBe('ACCEPTED');
			expect(stepStateOf(3)).toBe('SKIPPED');
		});

		// The headline BLOCKER, end to end through the engine: pruning one step of a dead arm must not make the REST
		// of that arm startable. The DWP-03 fixture could not catch this — its not-taken arm was a leaf.
		it('does not RESURRECT a dead arm: after pruning it, its interior is still refused a start', () => {
			// s1 BRANCH -> s2 (guard FALSE, excluded) -> s4 ; and -> s3 (default, taken).
			const r = dispatch(
				'ProposeExecutionPlan',
				{
					executionPlanId: PLAN,
					workUnitId: PWU,
					steps: [
						{ ...step(1, 'QUEUED'), stepType: 'BRANCH' },
						step(2, 'QUEUED'),
						step(3, 'QUEUED'),
						step(4, 'QUEUED')
					],
					transitions: [
						cedge(1, 2, { op: 'ATTEMPTS', stepId: stepId(1), cmp: '>', value: 99 }), // never true
						gedge(1, 3),
						gedge(2, 4)
					],
					retryPolicy: {},
					tacticalChangePolicy: {},
					escalationPolicy: {},
					terminationPolicy: {}
				},
				PLAN,
				'EXECUTION_PLAN'
			);
			expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
			expect(dispatch('ApproveExecutionPlan', {}, PLAN, 'EXECUTION_PLAN').status).toBe('ACCEPTED');
			expect(
				dispatch('ActivateExecutionPlan', { authorizedRuntimeBindingIds: [] }, PLAN, 'EXECUTION_PLAN').status
			).toBe('ACCEPTED');

			expect(start(1).status).toBe('ACCEPTED');
			expect(complete(1).status).toBe('ACCEPTED'); // guard false → s3 taken; s2 and its interior s4 excluded
			expect(start(4).status, 's4 is interior to the dead arm').toBe('REJECTED');

			expect(prune(2).status, JSON.stringify(prune(2))).toBe('ACCEPTED');
			expect(stepStateOf(2)).toBe('SKIPPED');
			// THE DEFECT: before DWP-07 the prune made s2 terminal-SUCCESS, which SATISFIED s2->s4 and let s4 start.
			const resurrect = start(4);
			expect(resurrect.status, 'the pruned arm must stay dead').toBe('REJECTED');
			expect(stepStateOf(4)).toBe('QUEUED');
			// …and s4 is still offered for prune, so the arm can actually be cleared and the plan can complete.
			expect(prune(4).status).toBe('ACCEPTED');
			expect(stepStateOf(4)).toBe('SKIPPED');

			expect(start(3).status).toBe('ACCEPTED');
			expect(complete(3).status).toBe('ACCEPTED');
			const done = dispatch('CompleteExecutionPlan', {}, PLAN, 'EXECUTION_PLAN');
			expect(done.status, JSON.stringify(done.error)).toBe('ACCEPTED');
		});
	});

	// ── DWP-08: the DWP-07 remediation was itself incomplete. It keyed "this step is DEAD" on WHICH COMMAND drove the
	// step to SKIPPED (only prune set the marker), so SkipExecutionStep — the same READY|QUEUED→SKIPPED arrow, offered
	// by the UI on the very same row — reproduced the original resurrection in full. Deadness is now STRUCTURAL.
	describe('DWP-08 — deadness is structural, not command-keyed', () => {
		const prune = (i: number) => dispatch('PruneExecutionStep', { stepId: stepId(i) }, PLAN, 'EXECUTION_PLAN');
		const skip = (i: number) =>
			dispatch('SkipExecutionStep', { stepId: stepId(i), mandatory: false }, PLAN, 'EXECUTION_PLAN');

		/** s1 BRANCH --COND(never true)--> s2 --> s4 ; s1 --SEQ default--> s3. s4 is INTERIOR to the excluded arm. */
		function activeExcludedArmPlan() {
			const r = dispatch(
				'ProposeExecutionPlan',
				{
					executionPlanId: PLAN,
					workUnitId: PWU,
					steps: [
						{ ...step(1, 'QUEUED'), stepType: 'BRANCH' },
						step(2, 'QUEUED'),
						step(3, 'QUEUED'),
						step(4, 'QUEUED')
					],
					transitions: [
						cedge(1, 2, { op: 'ATTEMPTS', stepId: stepId(1), cmp: '>', value: 99 }),
						gedge(1, 3),
						gedge(2, 4)
					],
					retryPolicy: {},
					tacticalChangePolicy: {},
					escalationPolicy: {},
					terminationPolicy: {}
				},
				PLAN,
				'EXECUTION_PLAN'
			);
			expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
			expect(dispatch('ApproveExecutionPlan', {}, PLAN, 'EXECUTION_PLAN').status).toBe('ACCEPTED');
			expect(
				dispatch('ActivateExecutionPlan', { authorizedRuntimeBindingIds: [] }, PLAN, 'EXECUTION_PLAN').status
			).toBe('ACCEPTED');
			expect(start(1).status).toBe('ACCEPTED');
			expect(complete(1).status).toBe('ACCEPTED'); // guard false → s3 taken; s2 and its interior s4 excluded
		}

		it('a WAIVER-skip of an excluded step does NOT resurrect its downstream (the DWP-07 hole)', () => {
			activeExcludedArmPlan();
			expect(start(4).status, 'excluded before any skip').toBe('REJECTED');
			// The operator uses Skip — which the UI offers on the same row as Prune — rather than Prune.
			expect(skip(2).status, JSON.stringify(skip(2))).toBe('ACCEPTED');
			expect(stepStateOf(2)).toBe('SKIPPED');
			const resurrect = start(4);
			expect(resurrect.status, 'a waiver over s2 cannot re-authorise s4 on the arm the BRANCH excluded').toBe(
				'REJECTED'
			);
			expect(stepStateOf(4)).toBe('QUEUED');
			// s4 remains prunable, so the plan can still be driven to completion.
			expect(prune(4).status).toBe('ACCEPTED');
			expect(start(3).status).toBe('ACCEPTED');
			expect(complete(3).status).toBe('ACCEPTED');
			expect(dispatch('CompleteExecutionPlan', {}, PLAN, 'EXECUTION_PLAN').status).toBe('ACCEPTED');
		});

		it('reaches the identical verdict whichever command terminated the excluded step', () => {
			activeExcludedArmPlan();
			expect(prune(2).status).toBe('ACCEPTED');
			expect(start(4).status, 'pruned route').toBe('REJECTED');
		});

		// The read-model half must agree, since the UI renders from it and the engine from the gate.
		it('a waived-away excluded arm is still offered for Prune, and never for Start', () => {
			activeExcludedArmPlan();
			skip(2);
			const plan = store.loadObject(PLAN)?.state as Record<string, unknown>;
			const steps = plan.steps as Array<{ id: string; stepState: string }>;
			expect(steps.find((s) => s.id === stepId(4))?.stepState).toBe('QUEUED');
			expect(start(4).status).toBe('REJECTED');
			expect(prune(4).status).toBe('ACCEPTED');
		});

		// The read-model must not offer a prune the engine's drivesFrom refuses. RUNNING/WAITING are live work.
		it('never offers Prune for a RUNNING step — live work is CANCELLED, not pruned', () => {
			activeExcludedArmPlan();
			// s3 is the taken arm; start it so it is RUNNING, then confirm prune refuses it on BOTH halves.
			expect(start(3).status).toBe('ACCEPTED');
			const r = prune(3);
			expect(r.status).toBe('REJECTED');
			expect(stepStateOf(3)).toBe('RUNNING');
		});
	});

	// ── DWP-09: a BRANCH decision is a POINT-IN-TIME fact, not a computation to redo on every read. The condition
	// subject does not stand still — a step reachable only through a not-taken edge can still change state, and an
	// ATTEMPTS/STEP_STATE guard over it flips — so re-deriving let a settled branch silently re-resolve and both arms
	// become live. The decision is now RECORDED when the branch succeeds.
	describe('DWP-09 — a resolved BRANCH does not re-resolve', () => {
		const prune = (i: number) => dispatch('PruneExecutionStep', { stepId: stepId(i) }, PLAN, 'EXECUTION_PLAN');
		const planState = () => store.loadObject(PLAN)?.state as Record<string, unknown>;
		const stepOf = (i: number) =>
			(planState().steps as Array<Record<string, unknown>>).find((s) => s.id === stepId(i));

		/**
		 * s1 BRANCH --COND[ s4 is SKIPPED ]--> s2 ; --SEQ default--> s3. The guard references s4, which is NOT an
		 * ancestor of s1 and is still QUEUED when the branch resolves — so the guard is false and the DEFAULT wins.
		 * Later, s4 changes state, which under re-derivation would flip the guard TRUE and hand the branch to s2.
		 */
		function activeLateFlipPlan() {
			const r = dispatch(
				'ProposeExecutionPlan',
				{
					executionPlanId: PLAN,
					workUnitId: PWU,
					steps: [
						{ ...step(1, 'QUEUED'), stepType: 'BRANCH' },
						step(2, 'QUEUED'),
						step(3, 'QUEUED'),
						step(4, 'QUEUED')
					],
					transitions: [
						cedge(1, 2, { op: 'STEP_STATE', stepId: stepId(4), state: 'SKIPPED' }),
						gedge(1, 3),
						gedge(3, 4)
					],
					retryPolicy: {},
					tacticalChangePolicy: {},
					escalationPolicy: {},
					terminationPolicy: {}
				},
				PLAN,
				'EXECUTION_PLAN'
			);
			expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
			expect(dispatch('ApproveExecutionPlan', {}, PLAN, 'EXECUTION_PLAN').status).toBe('ACCEPTED');
			expect(
				dispatch('ActivateExecutionPlan', { authorizedRuntimeBindingIds: [] }, PLAN, 'EXECUTION_PLAN').status
			).toBe('ACCEPTED');
		}

		it('records the selected out-edge on the BRANCH step when it succeeds', () => {
			activeLateFlipPlan();
			expect(stepOf(1)?.selectedTransitionId, 'not decided before the branch runs').toBeUndefined();
			expect(start(1).status).toBe('ACCEPTED');
			expect(complete(1).status).toBe('ACCEPTED');
			// s4 is QUEUED, so STEP_STATE(s4,'SKIPPED') is false → the SEQUENTIAL default (s1→s3) is selected.
			expect(stepOf(1)?.selectedTransitionId).toBe(`${PLAN}-t1-3`);
		});

		it('HOLDS the decision when a later state change would have flipped the guard', () => {
			activeLateFlipPlan();
			start(1);
			complete(1); // default arm (s3) selected; s2 excluded
			expect(start(2).status, 's2 is the not-taken arm').toBe('REJECTED');
			expect(start(3).status, 's3 is the taken arm').toBe('ACCEPTED');
			expect(complete(3).status).toBe('ACCEPTED');

			// Now make the guard TRUE after the fact: s4 becomes SKIPPED. Under re-derivation the branch would
			// re-resolve to s2, making the LOSING arm live while the winning arm has already run — both arms.
			expect(
				dispatch('SkipExecutionStep', { stepId: stepId(4), mandatory: false }, PLAN, 'EXECUTION_PLAN').status
			).toBe('ACCEPTED');
			expect(stepStateOf(4)).toBe('SKIPPED');

			const flipped = start(2);
			expect(flipped.status, 'the branch already decided; it must not re-resolve').toBe('REJECTED');
			expect(stepStateOf(2)).toBe('QUEUED');
			// The excluded arm is still prunable, so the plan can be closed out honestly.
			expect(prune(2).status).toBe('ACCEPTED');
			const done = dispatch('CompleteExecutionPlan', {}, PLAN, 'EXECUTION_PLAN');
			expect(done.status, JSON.stringify(done.error)).toBe('ACCEPTED');
		});

		it('REJECTS a plan declaring two transitions with the same id (the decision is recorded BY id)', () => {
			const dup = { ...gedge(1, 2), id: `${PLAN}-dup` };
			const r = dispatch(
				'ProposeExecutionPlan',
				{
					executionPlanId: PLAN,
					workUnitId: PWU,
					steps: [step(1, 'QUEUED'), step(2, 'QUEUED')],
					transitions: [dup, { ...dup, targetStepId: stepId(2) }],
					retryPolicy: {},
					tacticalChangePolicy: {},
					escalationPolicy: {},
					terminationPolicy: {}
				},
				PLAN,
				'EXECUTION_PLAN'
			);
			expect(r.status).toBe('REJECTED');
			expect(r.error?.message).toContain('declared more than once');
		});
	});
});
