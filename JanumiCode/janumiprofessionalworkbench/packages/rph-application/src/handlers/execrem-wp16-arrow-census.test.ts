// JAN-EXECREM WP-16 / SM-6 gate (a) — the ARROW CENSUS over `STEP_COMMAND_SPECS`.
//
// WHAT THIS ADDS TO WP-9. WP-9 reasoned its way to six kill cases, argued each one, and disclosed the one it could
// not isolate. That is the right way to prove a CLASSIFICATION, and this file does not replace it. What it adds is
// TOTALITY: every command, every residual state, every declared source, DERIVED from the table rather than chosen.
// The two are the pair DR-001 §3 prescribes for WP-12 and for the same reason — a matrix generated from the table
// proves only that nothing is missing, because mutating a row moves the generated expectation along with the
// behaviour; hardcoded named cases prove the values are right but cannot notice a row nobody wrote a case for.
//
// THE DENOMINATOR IS DERIVED. `residualSourceStates(spec)` = the states the MACHINE admits into the command's
// target, minus the states the command DECLARES it drives from, plus the self-edge `checkTransition` admits as a
// NOOP. So WIDENING a `sourceStates` array shrinks the residual set, a declared row goes missing, and the totality
// check below goes RED — a one-character widening becomes a reviewable change rather than a quieter guard. That is
// the anti-recurrence property; four of these source sets shipped with no kill test at all (F-11/12/13/14/18/19).
//
// EVERY CELL IS DECLARED, INCLUDING THE MASKED ONES. A residual state that an EARLIER guard refuses cannot prove
// the source set — that is the vacuous negative DS-001 §4 names, and two of the shipped "negatives" were exactly
// it. Rather than dropping those cells (an omission) or asserting them anyway (a lie), each is declared MASKED
// with the masking code and the reason. The gate then holds BOTH directions: a MASKED cell that starts being
// KILLED is just as much a failure as the reverse, because it means the evaluation order moved.
//
// AND THE POSITIVE HALF. One accepted case per declared source state. Without it a source set narrowed to nothing
// would pass every negative in this file — over-refusal wearing the fix's clothes.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import {
	residualSourceStates,
	STEP_COMMAND_SPECS,
	STEP_COMMAND_TYPES,
	type StepCommandType
} from '@janumipwb/rph-domain';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';
import { seedBelowQueuedStepState_LEGACY_ONLY } from './__tests__/plan-fixtures.js';

const TS = '2026-07-12T00:00:00Z';
const actor: ActorReference = { actorId: 'u1', actorType: 'HUMAN', displayName: 'A' };
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69H7100';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69H7110';
const PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69H7120';
const sid = (i: number) => `${PLAN}-s${i}`;
const tid = (a: number, b: number) => `${PLAN}-t${a}-${b}`;

/** The marker only the SOURCE-SET branch of `advanceStep` produces. Any other refusal classifies MASKED. */
const SOURCE_SET_MARKER = 'this command declares drivesFrom';
const SOURCE_SET_CODE = 'RPH_ILLEGAL_STATE_TRANSITION';

/** A residual cell the source set genuinely refuses, or one an earlier guard reaches first. */
type NegativeExpectation =
	'KILLED' | { readonly masked: true; readonly byCode: string; readonly why: string };

interface CommandCensus {
	/** Which fixture the cases run on. Only Prune needs a live branch to be prunable at all. */
	readonly fixture: 'LINEAR' | 'BRANCH';
	/** One entry per residual state. Keys are gated to equal `residualSourceStates(spec)` exactly. */
	readonly negatives: Readonly<Record<string, NegativeExpectation>>;
}

const CENSUS: Readonly<Record<StepCommandType, CommandCensus>> = {
	StartExecutionStep: {
		fixture: 'LINEAR',
		negatives: {
			// F-11's silent RESUME: the machine legalises WAITING->RUNNING, so without the source set a Start would
			// resume a waiting step — burning a retry and skipping the ExecutionStepWaitResolved fact.
			WAITING: 'KILLED',
			// The self-edge the machine admits as a NOOP: a double-dispatched Start on a RUNNING step.
			RUNNING: 'KILLED'
		}
	},
	CompleteExecutionStep: {
		fixture: 'LINEAR',
		// No residual state exists, so the kill is the self-edge re-issue: a second ExecutionStepSucceeded can
		// retroactively flip a resolved BRANCH by last-write-wins.
		negatives: { SUCCEEDED: 'KILLED' }
	},
	FailExecutionStep: {
		fixture: 'LINEAR',
		negatives: { FAILED: 'KILLED' }
	},
	RetryExecutionStep: {
		fixture: 'LINEAR',
		negatives: {
			// The machine legalises READY->QUEUED, and the retry cap does NOT fire (it keys on attempts made, zero
			// here), so the source set is the only thing left that can refuse.
			READY: 'KILLED',
			QUEUED: 'KILLED'
		}
	},
	SkipExecutionStep: {
		fixture: 'LINEAR',
		negatives: {
			// WP-3 added NOT_READY->SKIPPED for prune, so the machine now admits this arrow.
			NOT_READY: 'KILLED',
			SKIPPED: 'KILLED'
		}
	},
	CancelExecutionStep: {
		fixture: 'LINEAR',
		negatives: { CANCELLED: 'KILLED' }
	},
	PruneExecutionStep: {
		fixture: 'BRANCH',
		negatives: {
			// DISCLOSED, and unchanged from WP-9's finding. Prune's declared sources are exactly the machine's
			// in-arrows to SKIPPED, so its only residual is the self-edge — and its own prunability precheck runs
			// FIRST and refuses a terminal step, because a terminal step is never in `prunableStepIds`. The guard is
			// genuinely masked, not unguarded: the same inputs are refused, under a different code. Declaring the
			// mask keeps the fact visible; if the evaluation order ever moves, this cell goes RED and someone has to
			// look at why.
			SKIPPED: {
				masked: true,
				byCode: 'RPH_INVARIANT_VIOLATION',
				why: 'the prunability precheck refuses a terminal step before the source set is consulted'
			}
		}
	},
	EnterExecutionStepWait: {
		fixture: 'LINEAR',
		// F-14/F-19: the shipped negative was VACUOUS (the machine refused that input too). A re-wait is a NOOP the
		// machine ADMITS, so this is the fixture that isolates the guard.
		negatives: { WAITING: 'KILLED' }
	},
	ResolveExecutionStepWait: {
		fixture: 'LINEAR',
		negatives: {
			// F-11/F-18 named exactly this exclusion as untested: the machine legalises QUEUED->RUNNING, so a resume
			// of a step that never waited would otherwise be admitted.
			QUEUED: 'KILLED',
			RUNNING: 'KILLED'
		}
	}
};

describe('JAN-EXECREM WP-16 (a) — the arrow census over STEP_COMMAND_SPECS', () => {
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
			issuedBy: actor,
			correlationId: 'wp16a',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	}

	const ok = (r: { status: string; error?: { message?: string } }, what: string) => {
		expect(r.status, `${what}: ${r.error?.message}`).toBe('ACCEPTED');
		return r;
	};
	const planOf = () => store.loadObject(PLAN)!;
	const stepStateOf = (i: number) =>
		(planOf().state as { steps: { id: string; stepState: string }[] }).steps.find(
			(s) => s.id === sid(i)
		)?.stepState;

	const mkStep = (i: number) => ({
		id: sid(i),
		executionPlanId: PLAN,
		stepType: 'HUMAN_INTERACTION',
		purpose: `work ${i}`,
		inputBindings: [],
		outputBindings: [],
		preconditions: [],
		postconditions: [],
		stepState: 'QUEUED'
	});

	/**
	 * The payload each command needs, arranged so EVERY OTHER CHECK PASSES.
	 *
	 * This is the isolation WP-0's seam exists for, expressed once: Complete carries the explicit no-output result
	 * RPH-EXE-006 now demands (its precheck runs BEFORE the source set, so a bare completion would be refused by the
	 * result rule and the case would assert a refusal it did not isolate); Skip declares `mandatory: false` so the
	 * waiver rule passes; Cancel carries its reason.
	 */
	function payloadFor(commandType: StepCommandType, i: number): Record<string, unknown> {
		if (commandType === 'CompleteExecutionStep')
			return {
				executionStepId: sid(i),
				executionAttemptId: `${sid(i)}-a1`,
				resultStatus: 'SUCCEEDED',
				outputArtifactIds: [],
				proposedEvidenceIds: [],
				detectedAssumptionIds: [],
				structuredResult: {},
				noOutputResult: {
					reason: 'NO_DOWNSTREAM_CONSUMABLE_RESULT',
					detail: 'Census fixture: every other check must PASS so the source set is what refuses.'
				},
				executionProvenance: { executedBy: actor, originType: 'HUMAN_DECISION' }
			};
		const base: Record<string, unknown> = { stepId: sid(i) };
		if (commandType === 'FailExecutionStep') base.failureReason = 'boom';
		if (commandType === 'SkipExecutionStep') base.mandatory = false;
		if (commandType === 'CancelExecutionStep')
			base.reason = 'census fixture: an explicit abandonment';
		return base;
	}

	/** An ACTIVE single-step plan — the arrangement in which only the source set can refuse. */
	function linearPlan() {
		ok(
			dispatch('ProposeExecutionPlan', {
				executionPlanId: PLAN,
				workUnitId: PWU,
				steps: [mkStep(1)],
				transitions: [],
				retryPolicy: { maxAttempts: 5 },
				tacticalChangePolicy: {},
				escalationPolicy: {},
				terminationPolicy: {}
			}),
			'propose linear'
		);
		ok(dispatch('ApproveExecutionPlan', {}), 'approve');
		ok(dispatch('ActivateExecutionPlan', { authorizedRuntimeBindingIds: [] }), 'activate');
	}

	/**
	 * A settled BRANCH whose s2 arm was NOT taken — the only arrangement in which Prune is legal at all.
	 *
	 * s1 branches to s2 (CONDITIONAL, guard FALSE) and s3 (default). Completing s1 with `outcome: 'FAIL'` selects
	 * s3, so s2 and its downstream s4 become structurally dead and prunable.
	 */
	function branchPlan() {
		ok(
			dispatch('ProposeExecutionPlan', {
				executionPlanId: PLAN,
				workUnitId: PWU,
				steps: [{ ...mkStep(1), stepType: 'BRANCH' }, mkStep(2), mkStep(3), mkStep(4)],
				transitions: [
					{
						id: tid(1, 2),
						executionPlanId: PLAN,
						sourceStepId: sid(1),
						targetStepId: sid(2),
						transitionType: 'CONDITIONAL',
						conditionExpression: {
							op: 'RESULT_EQUALS',
							stepId: sid(1),
							path: 'outcome',
							value: 'PASS'
						}
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
				],
				retryPolicy: { maxAttempts: 5 },
				tacticalChangePolicy: {},
				escalationPolicy: {},
				terminationPolicy: {}
			}),
			'propose branch'
		);
		ok(dispatch('ApproveExecutionPlan', {}), 'approve');
		ok(dispatch('ActivateExecutionPlan', { authorizedRuntimeBindingIds: [] }), 'activate');
		ok(dispatch('StartExecutionStep', { stepId: sid(1) }), 'start branch');
		ok(
			dispatch('CompleteExecutionStep', {
				...payloadFor('CompleteExecutionStep', 1),
				structuredResult: { outcome: 'FAIL' } // the guard is FALSE -> the DEFAULT arm (s3) is taken
			}),
			'settle branch'
		);
	}

	/** Arrange the plan and put the CASE STEP into `state`. Returns the case step's index. */
	function arrange(fixture: 'LINEAR' | 'BRANCH', state: string): number {
		if (fixture === 'LINEAR') {
			linearPlan();
			seedBelowQueuedStepState_LEGACY_ONLY(store, PLAN, [state]);
			return 1;
		}
		branchPlan();
		// s1 stays SUCCEEDED (the settled branch), s3 stays on the taken arm; the CASE step is the dead arm s2.
		seedBelowQueuedStepState_LEGACY_ONLY(store, PLAN, ['SUCCEEDED', state, 'QUEUED', 'QUEUED']);
		return 2;
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

	// ── TOTALITY ──────────────────────────────────────────────────────────────────────────────────────────────
	describe('the census is TOTAL over the declared table', () => {
		it('every declared step command has a census entry', () => {
			expect(STEP_COMMAND_TYPES.filter((c) => !CENSUS[c])).toEqual([]);
		});

		it.each(STEP_COMMAND_TYPES)(
			'%s declares an expectation for EVERY residual state the machine admits, and no others',
			(commandType) => {
				// The anti-recurrence property, stated: widen `sourceStates` and the residual set shrinks, so the
				// declared keys stop matching and this goes RED. Narrow it and a NEW residual state appears with no
				// expectation, which goes RED the other way.
				const derived = [...residualSourceStates(STEP_COMMAND_SPECS[commandType])].sort((a, b) =>
					a.localeCompare(b)
				);
				const declared = Object.keys(CENSUS[commandType].negatives).sort((a, b) =>
					a.localeCompare(b)
				);
				expect(
					declared,
					`${commandType}: declared cells vs the machine-derived residual set`
				).toEqual(derived);
			}
		);

		it('the census is not vacuously empty — it covers every command and more cells than WP-9 hand-picked', () => {
			const cells = STEP_COMMAND_TYPES.flatMap((c) => Object.keys(CENSUS[c].negatives));
			expect(cells.length).toBeGreaterThan(6);
			expect(
				new Set(STEP_COMMAND_TYPES.filter((c) => Object.keys(CENSUS[c].negatives).length > 0)).size
			).toBe(STEP_COMMAND_TYPES.length);
		});
	});

	// ── THE NEGATIVE HALF ─────────────────────────────────────────────────────────────────────────────────────
	const negativeCases = STEP_COMMAND_TYPES.flatMap((commandType) =>
		Object.entries(CENSUS[commandType].negatives).map(
			([from, expectation]) => [commandType, from, expectation] as const
		)
	);

	it.each(negativeCases)(
		'%s from %s is refused, and by the DECLARED check',
		(commandType, from, expectation) => {
			const i = arrange(CENSUS[commandType].fixture, from);
			expect(stepStateOf(i), 'the fixture did not arrange the case state').toBe(from);
			const before = {
				revision: planOf().revision,
				events: store.readAllEvents().length,
				stepState: stepStateOf(i)
			};

			const r = dispatch(commandType, payloadFor(commandType, i));
			expect(r.status, `${commandType} from ${from} must be REFUSED`).toBe('REJECTED');

			if (expectation === 'KILLED') {
				// The code AND the marker: the code alone is produced by the machine, by four prechecks and by every
				// other source set, so asserting it alone would prove only that SOMETHING refused.
				expect(
					r.error?.code,
					`${commandType}/${from}: a different check refused — the cell is MASKED`
				).toBe(SOURCE_SET_CODE);
				expect(r.error?.message, `${commandType}/${from}: not the source-set refusal`).toContain(
					SOURCE_SET_MARKER
				);
				// …and the refusal RENDERS the declared contract it enforced.
				for (const src of STEP_COMMAND_SPECS[commandType].sourceStates)
					expect(r.error?.message).toContain(src);
				expect(r.error?.message).toContain(from);
			} else {
				// A declared mask, held in BOTH directions: it must still be the masking guard, and it must still NOT be
				// the source set. If the evaluation order moves, one of these two fails and someone has to look.
				expect(r.error?.code, `${commandType}/${from}: ${expectation.why}`).toBe(
					expectation.byCode
				);
				expect(
					r.error?.message,
					`${commandType}/${from} is declared MASKED but the source set now refuses it — re-declare the cell`
				).not.toContain(SOURCE_SET_MARKER);
			}

			// Refused means refused: nothing appended of ANY type, no silent revision bump, and the step is untouched.
			expect(store.readAllEvents().length, 'appended an event').toBe(before.events);
			expect(planOf().revision, 'bumped the plan revision').toBe(before.revision);
			expect(stepStateOf(i), 'moved the step').toBe(before.stepState);
		}
	);

	// ── THE POSITIVE HALF ─────────────────────────────────────────────────────────────────────────────────────
	const positiveCases = STEP_COMMAND_TYPES.flatMap((commandType) =>
		STEP_COMMAND_SPECS[commandType].sourceStates.map((from) => [commandType, from] as const)
	);

	it.each(positiveCases)(
		'%s from %s is ACCEPTED (the source set did not narrow to nothing)',
		(commandType, from) => {
			// Without this half, a `sourceStates: []` mutant passes every negative above: the census would certify a
			// command that refuses everything as fully guarded. Over-refusal is the failure mode a refusal-only battery
			// cannot see, and this programme has already produced it once (WP-15's PWU limb).
			const i = arrange(CENSUS[commandType].fixture, from);
			const r = dispatch(commandType, payloadFor(commandType, i));
			expect(r.status, `${commandType} from ${from} must be ACCEPTED: ${r.error?.message}`).toBe(
				'ACCEPTED'
			);
			expect(stepStateOf(i), `${commandType} must drive the step to its declared target`).toBe(
				STEP_COMMAND_SPECS[commandType].target
			);
		}
	);
});
