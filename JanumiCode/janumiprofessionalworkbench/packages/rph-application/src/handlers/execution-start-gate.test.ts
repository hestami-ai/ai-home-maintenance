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
		expect(again.error?.message).toContain('retry cap');
		expect(store.readAllEvents().filter((e) => e.eventType === 'ExecutionStepStarted')).toHaveLength(1);
	});

	// DR-004 DWP-02 (Tier 3C-ii) — CONDITIONAL edges: the guard is evaluated against the plan's committed subject.
	it('a CONDITIONAL in-edge with a TRUE guard makes the target startable once the source succeeds', () => {
		activeGraphPlan(['QUEUED', 'QUEUED'], [cedge(1, 2, { op: 'STEP_SUCCEEDED', stepId: stepId(1) })]);
		expect(start(1).status).toBe('ACCEPTED'); // s1 entry
		expect(complete(1).status).toBe('ACCEPTED'); // s1 SUCCEEDED
		const s2 = start(2);
		expect(s2.status, JSON.stringify(s2.error)).toBe('ACCEPTED'); // STEP_SUCCEEDED(s1) is true → SATISFIED
	});

	it('a CONDITIONAL in-edge with a FALSE guard leaves the target non-startable (NEUTRALIZED)', () => {
		activeGraphPlan(['QUEUED', 'QUEUED'], [cedge(1, 2, { op: 'ATTEMPTS', stepId: stepId(1), cmp: '>', value: 99 })]);
		expect(start(1).status).toBe('ACCEPTED');
		expect(complete(1).status).toBe('ACCEPTED'); // s1 SUCCEEDED (attemptsMade = 1)
		expect(start(2).status, 'attempts(s1)=1 is not > 99 → guard false → s2 neutralized').toBe('REJECTED');
	});

	it('REJECTS a malformed conditionExpression at propose (RPH_VALIDATION_SCHEMA_FAILED)', () => {
		const r = proposeGraph(['QUEUED', 'QUEUED'], [cedge(1, 2, { op: 'NONSENSE', stepId: stepId(1) })]);
		expect(r.status, JSON.stringify(r.error)).not.toBe('ACCEPTED');
		expect(r.error?.code).toBe('RPH_VALIDATION_SCHEMA_FAILED');
	});

	it('REJECTS a condition referencing an undeclared step at propose', () => {
		const r = proposeGraph(['QUEUED', 'QUEUED'], [cedge(1, 2, { op: 'STEP_SUCCEEDED', stepId: 'ghost_step' })]);
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
		expect(r.error?.message).toContain('ghost_step');
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
});
