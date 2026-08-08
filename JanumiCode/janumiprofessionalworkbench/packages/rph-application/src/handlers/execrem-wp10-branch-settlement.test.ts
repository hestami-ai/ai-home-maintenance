// JAN-EXECREM WP-10 — the DECIDES-ONCE family: F-02, F-07, F-24 (BLOCKERs) and the WRITE half of F-15/21/23.
//
// THREE MASKS OF ONE DEFECT. A fact that must be decided exactly once was (a) computed against a view that excluded
// the very move being made, (b) recorded by only ONE of the two commands that can make that move, and (c) never
// written to the event stream at all.
//
// (a) THE SETTLEMENT VIEW. `completeExecutionStep` cloned the gate plan with `stepState: 'SUCCEEDED'` — but the
//     evaluator it handed the gate had already folded its subject from the COMMITTED log, and
//     `buildConditionSubject` reads outputArtifactIds/structuredResult ONLY from a committed ExecutionStepSucceeded.
//     So a BRANCH guarded on its OWN result evaluated PRE-completion facts: RESULT_EQUALS and OUTPUT_COUNT over the
//     completing step were ALWAYS false, and the SEQUENTIAL default was always the arm recorded. A branch could not
//     branch on what it produced — which is most of what a branch is for.
// (b) TOTALITY. Skip also drives a step to terminal-success, and recorded nothing, so its branch kept re-deriving.
// (c) THE STREAM. The decision lived only in aggregate state, so replay could not see what the plan decided.
//
// WHAT THE TESTS MUST ASSERT — the PROPERTY, not a literal edge id. A test that only checks "s2 was selected" dies
// under an outcome mutation but survives the MECHANISM mutation (dropping the pending event from the evaluator's
// list, or patching state but not the log). KT-3 and KT-7 below assert the DECISION-REPLAY IDENTITY instead:
// recorded == recomputed-from-the-committed-log == the id on the settling event.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { resolveBranchSelection, buildConditionSubject, evaluateGuardExpression } from '@janumipwb/rph-domain';
import { STEP_COMMAND_SPECS, STEP_COMMAND_TYPES } from '@janumipwb/rph-domain';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';
import { seedRecordedBranchDecision } from './__tests__/plan-fixtures.js';

const TS = '2026-07-12T00:00:00Z';
const actor = { actorId: 'u1', actorType: 'HUMAN' as const, displayName: 'A' };
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69GZ200';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69GZ210';
const PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69GZ220';
const ART = 'art_01ARZ3NDEKTSV4RRFFQ69GZ230';
const sid = (i: number) => `${PLAN}-s${i}`;
const tid = (from: number, to: number) => `${PLAN}-t${from}-${to}`;

const SAYS_NOTHING = {
	reason: 'NO_DOWNSTREAM_CONSUMABLE_RESULT' as const,
	detail: 'A sequencing step; it authors no artifact.'
};

/** The terminal-SUCCESS states — the set that defines which commands must declare a branch-decision position. */
const TERMINAL_SUCCESS = new Set(['SUCCEEDED', 'SKIPPED']);

describe('JAN-EXECREM WP-10 — a BRANCH decides ONCE, against the move it is making', () => {
	let store: SqliteStorageAdapter;
	let engine: AuthedEngine;
	let seq = 0;

	function mk(now = TS) {
		store = new SqliteStorageAdapter({ now: () => now });
		seq = 0;
		engine = new Engine({ authenticate: testAuthenticator(), store, now: () => now, newEventId: () => `e${++seq}` }).as(TEST_CRED.human);
	}

	function dispatch(commandType: string, payload: unknown, id = PLAN, aggType = 'EXECUTION_PLAN') {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: aggType,
			targetAggregateId: id,
			issuedAt: TS,
			correlationId: 'wp10',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	}

	const planState = () =>
		store.loadObject(PLAN)!.state as {
			status: string;
			steps: Array<{ id: string; stepState: string; stepType?: string; selectedTransitionId?: string }>;
			transitions: Array<Record<string, unknown>>;
		};
	const stepOf = (i: number) => planState().steps.find((s) => s.id === sid(i));
	const succeededEvents = () =>
		store.readAllEvents().filter((e) => e.eventType === 'ExecutionStepSucceeded');

	const mkStep = (i: number, stepType = 'TRANSFORMATION') => ({
		id: sid(i),
		executionPlanId: PLAN,
		stepType,
		purpose: `work ${i}`,
		inputBindings: [],
		outputBindings: [],
		preconditions: [],
		postconditions: [],
		stepState: 'QUEUED'
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

	/** Complete a step, with an optional structuredResult / outputs. Always RPH-EXE-006-clean (WP-11). */
	const complete = (i: number, over: Record<string, unknown> = {}) => {
		const hasOutput = Array.isArray(over.outputArtifactIds) && over.outputArtifactIds.length > 0;
		return dispatch('CompleteExecutionStep', {
			executionStepId: sid(i),
			executionAttemptId: `${sid(i)}-a1`,
			resultStatus: 'SUCCEEDED',
			outputArtifactIds: [],
			proposedEvidenceIds: [],
			detectedAssumptionIds: [],
			structuredResult: {},
			...(hasOutput ? {} : { noOutputResult: SAYS_NOTHING }),
			executionProvenance: { executedBy: actor, originType: 'HUMAN_DECISION' },
			...over
		});
	};
	const start = (i: number) => dispatch('StartExecutionStep', { stepId: sid(i) });
	const skip = (i: number) => dispatch('SkipExecutionStep', { stepId: sid(i), mandatory: false });

	function activate(steps: unknown[], transitions: unknown[]) {
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
		const r = dispatch('ProposeExecutionPlan', {
			executionPlanId: PLAN,
			workUnitId: PWU,
			steps,
			transitions,
			retryPolicy: {},
			tacticalChangePolicy: {},
			escalationPolicy: {},
			terminationPolicy: {}
		});
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		dispatch('ApproveExecutionPlan', {});
		dispatch('ActivateExecutionPlan', { authorizedRuntimeBindingIds: [] });
	}

	/** s1 BRANCH guarded on its OWN result; s2 is the guarded arm; s3 the SEQUENTIAL default. */
	const selfReferentialPlan = (condition: unknown) =>
		activate(
			[mkStep(1, 'BRANCH'), mkStep(2), mkStep(3)],
			[cedge(1, 2, condition), gedge(1, 3)]
		);

	/**
	 * THE ANTI-VACUITY INSTRUMENT (KT-3 / KT-7). Recompute the branch decision from the plan's own POST-COMMIT state
	 * and log — nothing simulated, nothing carried over from the write path — and assert it equals BOTH what state
	 * records AND what the settling event carries.
	 *
	 * MUTANTS THIS KILLS that a literal-id assertion does not: dropping `pendingEvent` from the evaluator's event
	 * list (recorded != recomputed); patching stepState but not the events, i.e. the shipped code (same); writing one
	 * plane and not the other (state != event); over-projecting the settlement view by also patching
	 * `selectedTransitionId` into it (recomputed would then differ).
	 */
	function assertDecisionReplayIdentity(branchIndex: number, settlingEventType: string): string {
		const state = planState();
		const recorded = state.steps.find((s) => s.id === sid(branchIndex))!.selectedTransitionId;
		expect(recorded, 'the branch must have RECORDED a decision').toBeDefined();

		// Rebuild strictly from what is committed.
		const gatePlan = {
			status: state.status,
			steps: state.steps.map((s) => ({
				id: s.id,
				stepState: s.stepState,
				...(s.stepType === undefined ? {} : { stepType: s.stepType })
				// `selectedTransitionId` is deliberately NOT carried: `resolveBranchSelection` is the act of deciding,
				// so feeding the recorded answer back in would make this a tautology instead of a recomputation.
			})),
			transitions: state.transitions
		};
		const subject = buildConditionSubject(gatePlan.steps, store.readAllEvents(), PLAN);
		const recomputed = resolveBranchSelection(gatePlan, sid(branchIndex), (edge) =>
			evaluateGuardExpression(edge.conditionExpression, subject)
		);
		expect(recomputed, 'recorded != recomputed-from-the-committed-log').toBe(recorded);

		const settling = store
			.readAllEvents()
			.filter((e) => e.eventType === settlingEventType)
			.at(-1);
		expect(
			(settling?.payload as { selectedTransitionId?: string })?.selectedTransitionId,
			'state and event must carry the SAME decision (KT-8)'
		).toBe(recorded);
		return recorded!;
	}

	beforeEach(() => mk());

	// ── KT-1 / KT-2: the BLOCKER — a BRANCH branching on its OWN result ─────────────────────────────────────────

	it('KT-1 RESULT_EQUALS over the completing step selects the GUARDED arm, not the default', () => {
		// RED before WP-10: the subject was folded from the committed log, which did not yet contain this
		// completion, so `outcome` resolved to undefined and the default arm (s3) was recorded.
		selfReferentialPlan({ op: 'RESULT_EQUALS', stepId: sid(1), path: 'outcome', value: 'PASS' });
		expect(start(1).status).toBe('ACCEPTED');
		expect(complete(1, { structuredResult: { outcome: 'PASS' } }).status).toBe('ACCEPTED');

		expect(stepOf(1)?.selectedTransitionId).toBe(tid(1, 2));
		assertDecisionReplayIdentity(1, 'ExecutionStepSucceeded');
		expect(start(2).status, 'the guarded arm is live').toBe('ACCEPTED');
		expect(start(3).status, 'the default arm is not-taken').toBe('REJECTED');
	});

	it('KT-1b the same guard with a NON-matching result still falls to the default (not always-guarded)', () => {
		// The mirror case. Without it, a mutant that always selects the FIRST conditional arm passes KT-1.
		selfReferentialPlan({ op: 'RESULT_EQUALS', stepId: sid(1), path: 'outcome', value: 'PASS' });
		start(1);
		expect(complete(1, { structuredResult: { outcome: 'FAIL' } }).status).toBe('ACCEPTED');
		expect(stepOf(1)?.selectedTransitionId).toBe(tid(1, 3));
		assertDecisionReplayIdentity(1, 'ExecutionStepSucceeded');
	});

	it('KT-2 OUTPUT_COUNT over the completing step reads its REAL outputs', () => {
		selfReferentialPlan({ op: 'OUTPUT_COUNT', stepId: sid(1), cmp: '>=', value: 1 });
		expect(start(1).status).toBe('ACCEPTED');
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
					producingExecutionAttemptId: `${sid(1)}-a1`,
					securityClassification: 'INTERNAL',
					retentionClass: 'PROJECT_LIFETIME',
					status: 'RECORDED'
				},
				ART,
				'ARTIFACT'
			).status
		).toBe('ACCEPTED');
		expect(complete(1, { outputArtifactIds: [ART] }).status).toBe('ACCEPTED');
		expect(stepOf(1)?.selectedTransitionId).toBe(tid(1, 2));
		assertDecisionReplayIdentity(1, 'ExecutionStepSucceeded');
	});

	// ── KT-4: determinism ──────────────────────────────────────────────────────────────────────────────────────

	it('KT-4 the decision does not depend on the clock', () => {
		const decide = (now: string) => {
			mk(now);
			selfReferentialPlan({ op: 'RESULT_EQUALS', stepId: sid(1), path: 'outcome', value: 'PASS' });
			start(1);
			complete(1, { structuredResult: { outcome: 'PASS' } });
			return stepOf(1)?.selectedTransitionId;
		};
		expect(decide('2026-07-12T00:00:00Z')).toBe(decide('2031-01-01T23:59:59Z'));
	});

	// ── KT-6 / KT-7: SKIP settles a branch too (the totality half) ──────────────────────────────────────────────

	it('KT-6 a BRANCH settled by SKIP records its decision', () => {
		// RED before WP-10: Skip recorded nothing, so the branch re-derived on every read.
		selfReferentialPlan({ op: 'STEP_STATE', stepId: sid(3), state: 'SKIPPED' });
		expect(skip(1).status, 'skipping the BRANCH itself').toBe('ACCEPTED');
		expect(stepOf(1)?.stepState).toBe('SKIPPED');
		expect(stepOf(1)?.selectedTransitionId, 'a settling Skip must decide').toBeDefined();
		assertDecisionReplayIdentity(1, 'ExecutionStepSkipped');
	});

	it('KT-6b the skip-settled decision HOLDS when a later state change would have flipped the guard', () => {
		// The behaviour the recording exists for. s3 is the default arm; the guard on s2 becomes true only once s3
		// is SKIPPED. Under re-derivation the branch would re-resolve to s2 AFTER s3 had already been taken —
		// both arms live, which is F-15/21/23 exactly.
		selfReferentialPlan({ op: 'STEP_STATE', stepId: sid(3), state: 'SKIPPED' });
		expect(skip(1).status).toBe('ACCEPTED');
		const decided = stepOf(1)!.selectedTransitionId;
		expect(decided).toBe(tid(1, 3)); // s3 is QUEUED at settlement, so the guard is false → the default

		expect(skip(3).status, 'now flip the guard TRUE after the fact').toBe('ACCEPTED');
		expect(stepOf(1)?.selectedTransitionId, 'the decision is history, not a computation').toBe(decided);
		expect(start(2).status, 'the losing arm must NOT come alive').toBe('REJECTED');
	});

	// ── KT-9: never re-decide ──────────────────────────────────────────────────────────────────────────────────

	it('KT-9 an already-decided BRANCH is not re-decided by a later settling command', () => {
		// A BRANCH cannot be settled twice through the bus (the source sets refuse the re-issue), so this asserts
		// the guard directly: after the decision is recorded, no subsequent command may overwrite it.
		selfReferentialPlan({ op: 'RESULT_EQUALS', stepId: sid(1), path: 'outcome', value: 'PASS' });
		start(1);
		complete(1, { structuredResult: { outcome: 'PASS' } });
		const decided = stepOf(1)!.selectedTransitionId;
		expect(decided).toBe(tid(1, 2));
		// Re-issue Complete on the now-SUCCEEDED branch: refused by its source set (WP-9), and nothing moves.
		expect(complete(1, { structuredResult: { outcome: 'FAIL' } }).status).toBe('REJECTED');
		expect(stepOf(1)?.selectedTransitionId).toBe(decided);
		expect(succeededEvents()).toHaveLength(1);
	});

	it('KT-9b a settling command does NOT overwrite a decision the step already carries', () => {
		// THE GUARD ABOVE IS UNKILLABLE THROUGH THE BUS, and this is what makes it testable rather than asserted. A
		// BRANCH records its arm at the instant it settles, and every settling command's source set then refuses the
		// re-issue (WP-9) — so no command can reach a step that is both settle-able AND already decided. The
		// arrangement is therefore seeded: a QUEUED branch that already carries a decision.
		//
		// Without the guard, the Skip below would re-run first-match and OVERWRITE the recorded arm — the exact
		// "decides more than once" failure the whole work package is named for.
		selfReferentialPlan({ op: 'RESULT_EQUALS', stepId: sid(1), path: 'outcome', value: 'PASS' });
		seedRecordedBranchDecision(store, PLAN, sid(1), tid(1, 2));
		expect(stepOf(1)?.selectedTransitionId).toBe(tid(1, 2));

		expect(skip(1).status, 'the Skip itself is legitimate').toBe('ACCEPTED');
		expect(stepOf(1)?.stepState).toBe('SKIPPED');
		// First-match over this plan would pick the DEFAULT (the guard is false — no result was recorded), so an
		// overwrite would be visible as t1-3. The recorded arm must survive untouched.
		expect(stepOf(1)?.selectedTransitionId, 'the existing decision must stand').toBe(tid(1, 2));
		const skipped = store.readAllEvents().filter((e) => e.eventType === 'ExecutionStepSkipped');
		expect(
			Object.hasOwn(skipped.at(-1)!.payload as object, 'selectedTransitionId'),
			'and no decision is emitted, because none was taken'
		).toBe(false);
	});

	// ── KT-10: the TOTALITY PIN (the anti-recurrence instrument) ────────────────────────────────────────────────

	describe('KT-10 branch-decision totality — every terminal-success command declares its position', () => {
		it('every command whose target is TERMINAL_SUCCESS declares a decision policy, and no other does', () => {
			// This is the instrument that makes "Skip forgot" impossible to reintroduce: the classification is DATA,
			// derived from the target, so a tenth step command cannot ship without taking a position.
			for (const t of STEP_COMMAND_TYPES) {
				const s = STEP_COMMAND_SPECS[t];
				const settles = TERMINAL_SUCCESS.has(s.target);
				expect(
					s.branchDecision === 'NOT_TERMINAL_SUCCESS',
					`${t} targets ${s.target}; its branchDecision must ${settles ? 'NOT ' : ''}be NOT_TERMINAL_SUCCESS`
				).toBe(!settles);
				expect(s.branchDecisionRationale.length, `${t} rationale`).toBeGreaterThan(15);
			}
		});

		it('exactly Complete and Skip RECORD; exactly Prune declares a reasoned silence', () => {
			const by = (policy: string) =>
				STEP_COMMAND_TYPES.filter((t) => STEP_COMMAND_SPECS[t].branchDecision === policy).sort();
			expect(by('RECORD_AT_SETTLEMENT')).toEqual(['CompleteExecutionStep', 'SkipExecutionStep']);
			expect(by('NONE_STRUCTURALLY_DEAD')).toEqual(['PruneExecutionStep']);
		});

		it("PRUNE's declared silence is SAFE — a prune only ever reaches an ALREADY-excluded step", () => {
			// The declaration is only honest if the structure backs it. s1 decides for s3; s2 is the dead arm. Prune
			// is offered for s2 and NOT for s3, and pruning s2 records no decision because s2 is not a branch — and
			// the BRANCH itself is never prunable, because it is terminal.
			selfReferentialPlan({ op: 'RESULT_EQUALS', stepId: sid(1), path: 'outcome', value: 'PASS' });
			start(1);
			complete(1, { structuredResult: { outcome: 'FAIL' } }); // default arm s3 taken; s2 is dead
			expect(stepOf(1)?.selectedTransitionId).toBe(tid(1, 3));
			const pruned = dispatch('PruneExecutionStep', { stepId: sid(2) });
			expect(pruned.status, JSON.stringify(pruned.error)).toBe('ACCEPTED');
			expect(stepOf(2)?.selectedTransitionId, 'a pruned non-branch decides nothing').toBeUndefined();
			// And the BRANCH cannot be pruned at all — terminal steps are never in the prunable set.
			expect(dispatch('PruneExecutionStep', { stepId: sid(1) }).status).toBe('REJECTED');
		});
	});

	// ── The stream half: the decision is REPLAYABLE ─────────────────────────────────────────────────────────────

	it('the settling event carries the decision, and the emitted payload parses against its ratified schema', () => {
		// Proves WP-1's regeneration actually landed: ExecutionStepSucceeded is the only step event in
		// RATIFIED_EVENT_PAYLOADS, so a payload field the schema did not know would REJECT at dispatch.
		selfReferentialPlan({ op: 'RESULT_EQUALS', stepId: sid(1), path: 'outcome', value: 'PASS' });
		start(1);
		const r = complete(1, { structuredResult: { outcome: 'PASS' } });
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		const payload = succeededEvents()[0]!.payload as { selectedTransitionId?: string };
		expect(payload.selectedTransitionId).toBe(tid(1, 2));
	});

	it('a NON-branch settlement writes no decision anywhere (state or event)', () => {
		// The narrowness guard: a mutant that recorded a decision for every settling step would pass every test
		// above. `branchRequiresDecision` is what keeps this at zero.
		activate([mkStep(1), mkStep(2)], []);
		start(1);
		expect(complete(1).status).toBe('ACCEPTED');
		expect(stepOf(1)?.selectedTransitionId).toBeUndefined();
		expect(Object.hasOwn(succeededEvents()[0]!.payload as object, 'selectedTransitionId')).toBe(false);
	});

	it('a BRANCH with NO guarded out-edge requires no decision — there is nothing to choose between', () => {
		// `branchRequiresDecision` has TWO limbs (stepType AND >= 1 conditional out-edge) and the test above only
		// exercises the first. A BRANCH whose single out-edge is unconditional is the authorable shape that isolates
		// the second: propose-time validation refuses a BRANCH with two unconditional out-edges, so a "plain
		// fan-out off a BRANCH" is not a plan the system can hold.
		activate([mkStep(1, 'BRANCH'), mkStep(2)], [gedge(1, 2)]);
		start(1);
		expect(complete(1).status).toBe('ACCEPTED');
		expect(stepOf(1)?.selectedTransitionId, 'no guarded arm ⇒ no decision to record').toBeUndefined();
		// And the downstream is live: a decision nobody needed cannot leave the arm UNRESOLVED.
		expect(start(2).status).toBe('ACCEPTED');
	});
});
