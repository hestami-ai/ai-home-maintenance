// JAN-EXECREM WP-9 — the source-state kill-test battery. Closes F-11, F-12, F-13, F-14, F-18, F-19 and the two
// genuinely-new gaps the derivation surfaced (Retry<-READY, Skip<-NOT_READY).
//
// WHY THESE GUARDS WERE UNKILLED. Every one of them WORKS; what was missing was any test that FAILS when the guard
// is removed. Two of the shipped "negatives" were VACUOUS — they asserted a refusal that a DIFFERENT check (an
// earlier precheck, or the machine itself) produces for the same input, so deleting the guard under test changed
// nothing. A test that cannot fail is not coverage; it is a ratchet that makes the hole look guarded.
//
// THE DENOMINATOR IS DERIVED, NOT GUESSED. For each command, the machine's in-arrows to its target minus its
// declared `sourceStates` gives the RESIDUAL states — inputs the MACHINE would admit and only the source set
// refuses. Those are the non-vacuous cases:
//     StartExecutionStep        <- WAITING    (machine legalises WAITING->RUNNING: the silent-resume case)
//     RetryExecutionStep        <- READY      (machine legalises READY->QUEUED)
//     SkipExecutionStep         <- NOT_READY  (machine legalises NOT_READY->SKIPPED since WP-3)
//     ResolveExecutionStepWait  <- QUEUED     (machine legalises QUEUED->RUNNING) — F-11/F-18's "QUEUED exclusion"
// Where the residual set is EMPTY, the kill is the self-edge re-issue, which `checkTransition` admits as a NOOP:
//     CompleteExecutionStep <- SUCCEEDED, EnterExecutionStepWait <- WAITING (F-14/F-19).
// (Fail<-FAILED and Cancel<-CANCELLED are already killed by execution-step-reissue-guard and WP-5 respectively.)
//
// EACH FIXTURE ISOLATES THE SOURCE SET: the plan is ACTIVE and every precheck is arranged to PASS, so the only
// thing left that can refuse is the guard under test. That isolation is what WP-0's seeding seam exists for.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { STEP_COMMAND_SPECS } from '@janumipwb/rph-domain';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';
import { seedBelowQueuedStepState_LEGACY_ONLY } from './__tests__/plan-fixtures.js';

const TS = '2026-07-12T00:00:00Z';
const actor = { actorId: 'u1', actorType: 'HUMAN' as const, displayName: 'A' };
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69GZ100';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69GZ110';
const PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69GZ120';
const sid = (i: number) => `${PLAN}-s${i}`;

/** One case: drive `command` at a step arranged in `from`, and expect the SOURCE SET to be what refuses. */
interface KillCase {
	readonly commandType: keyof typeof STEP_COMMAND_SPECS;
	readonly from: string;
	readonly why: string;
	readonly payload?: Record<string, unknown>;
}

const CASES: readonly KillCase[] = [
	{
		commandType: 'StartExecutionStep',
		from: 'WAITING',
		why: 'the machine legalises WAITING->RUNNING, so without the source set a Start would perform a silent RESUME — burning a retry (RPH-EXE-008) and skipping the ExecutionStepWaitResolved fact'
	},
	{
		commandType: 'RetryExecutionStep',
		from: 'READY',
		why: 'the machine legalises READY->QUEUED, and the retry cap does NOT fire (it keys on lastAttemptFailed, false here), so the source set is the ONLY thing refusing'
	},
	{
		commandType: 'SkipExecutionStep',
		from: 'NOT_READY',
		why: 'WP-3 added NOT_READY->SKIPPED for prune, so the machine now admits this arrow; the plan declares the step ADVISORY so canSkipStep passes, leaving the source set alone (REG-F-105: it used to say mandatory:false in the payload)',
	},
	{
		commandType: 'ResolveExecutionStepWait',
		from: 'QUEUED',
		why: 'the machine legalises QUEUED->RUNNING, so a resume of a step that never waited would be admitted — F-11/F-18 named exactly this exclusion as untested'
	},
	{
		commandType: 'CompleteExecutionStep',
		from: 'SUCCEEDED',
		why: 'no residual state exists, so the kill is the self-edge re-issue the machine admits as a NOOP; a second ExecutionStepSucceeded can retroactively flip a resolved BRANCH via last-write-wins'
	},
	{
		commandType: 'EnterExecutionStepWait',
		from: 'WAITING',
		why: 'F-14/F-19: the shipped negative was VACUOUS (the machine refused that input too). A re-wait is a NOOP the machine ADMITS, so this is the fixture that actually isolates the guard'
	}
];

describe('JAN-EXECREM WP-9 — the source-state battery', () => {
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
			correlationId: 'wp9',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	}

	const planOf = () => store.loadObject(PLAN)!;
	const stepStateOf = (i: number) =>
		(planOf().state as { steps: { id: string; stepState: string }[] }).steps.find(
			(s) => s.id === sid(i)
		)?.stepState;

	const mkStep = (i: number) => ({
		id: sid(i),
		executionPlanId: PLAN,
		stepType: 'TRANSFORMATION',
		purpose: `work ${i}`,
		inputBindings: [],
		outputBindings: [],
		preconditions: [],
		postconditions: [],
		stepState: 'QUEUED',
		// §21.1 IS NOT ON TRIAL IN THIS FILE (REG-F-105, ruled REG-D-041). Skipping used to be granted by
		// `mandatory: false` inside the SKIP PAYLOAD — the skipper's own word. That field is gone, so the PLAN now
		// declares what the request used to assert. Marking these steps ADVISORY isolates the SOURCE-STATE axis
		// exactly as the boolean did, with the difference that a declaration is a fact of the approved plan.
		strength: 'ADVISORY'
	});

	/** One step per case, so each is arranged independently. Plan is ACTIVE so every plan-ACTIVE precheck PASSES. */
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
		expect(
			dispatch('ProposeExecutionPlan', {
				executionPlanId: PLAN,
				workUnitId: PWU,
				steps: [mkStep(1)],
				transitions: [],
				retryPolicy: { maxAttempts: 5 },
				tacticalChangePolicy: {},
				escalationPolicy: {},
				terminationPolicy: {}
			}).status
		).toBe('ACCEPTED');
		dispatch('ApproveExecutionPlan', {});
		dispatch('ActivateExecutionPlan', { authorizedRuntimeBindingIds: [] });
	});

	it.each(CASES.map((c) => [c.commandType, c.from, c] as const))(
		'%s from %s is REFUSED by its SOURCE SET, appends nothing, and moves nothing',
		(_cmd, _from, c) => {
			// Arrange the single step in the offending state. The seam's _LEGACY_ONLY escape is used because two of
			// these states (NOT_READY, READY) are exactly the population no command can reach.
			seedBelowQueuedStepState_LEGACY_ONLY(store, PLAN, [c.from]);
			expect(stepStateOf(1)).toBe(c.from);

			const before = {
				revision: planOf().revision,
				events: store.readAllEvents().length,
				stepState: stepStateOf(1)
			};

			const spec = STEP_COMMAND_SPECS[c.commandType];
			// CompleteExecutionStep's payload is a strictObject keyed on `executionStepId` and carries no `stepId`,
			// so the two shapes are built separately rather than merged — a merged one fails SCHEMA validation before
			// reaching the guard under test, which would make this case vacuous in a new way.
			//
			// WP-11 added `noOutputResult` for the SAME isolation reason: RPH-EXE-006 runs in `precheck`, which
			// `advanceStep` evaluates BEFORE the source set, so a completion asserting nothing would now be refused by
			// the result rule and this case would assert a refusal it did not isolate. Fixing the fixture is the
			// honest move; weakening either rule to keep it green is the inversion this whole program is about.
			const payload =
				c.commandType === 'CompleteExecutionStep'
					? {
							executionStepId: sid(1),
							executionAttemptId: `${sid(1)}-a1`,
							resultStatus: 'SUCCEEDED',
							outputArtifactIds: [],
							proposedEvidenceIds: [],
							detectedAssumptionIds: [],
							structuredResult: {},
							noOutputResult: {
								reason: 'NO_DOWNSTREAM_CONSUMABLE_RESULT',
								detail:
									'Kill-test fixture: every precheck must PASS so the source set is what refuses.'
							},
							executionProvenance: { executedBy: actor, originType: 'HUMAN_DECISION' }
						}
					: { stepId: sid(1), ...(c.payload ?? {}) };
			const r = dispatch(c.commandType, payload);

			// 1. Refused, 2. with the SOURCE-STATE code — not a precheck's code, which is what proves isolation.
			expect(r.status, c.why).toBe('REJECTED');
			expect(
				r.error?.code,
				`${c.commandType}: a precheck refused instead — the fixture is not isolating`
			).toBe('RPH_ILLEGAL_STATE_TRANSITION');
			// 3. The message renders the DECLARED source set, so the refusal names the contract it enforced.
			for (const src of spec.sourceStates)
				expect(r.error?.message, `${c.commandType} must render its drivesFrom`).toContain(src);
			expect(r.error?.message).toContain(c.from);
			// 4. Nothing appended — of ANY type, not merely of this command's own event.
			expect(store.readAllEvents().length, 'appended an event').toBe(before.events);
			// 5. No silent revision bump, 6. and the step is untouched.
			expect(planOf().revision, 'bumped the plan revision').toBe(before.revision);
			expect(stepStateOf(1), 'moved the step').toBe(before.stepState);
		}
	);

	// PruneExecutionStep is the one command whose source set CANNOT be isolated through the bus, and saying so is
	// better than writing a test that looks like coverage. Its residual set is empty (its sources are exactly the
	// machine's in-arrows to SKIPPED), so the only kill would be a re-issue on SKIPPED — and its own prunability
	// precheck runs first and refuses that, because a terminal step is never in `prunableStepIds`. The guard is
	// therefore genuinely masked. It is not unguarded: the precheck refuses the same inputs, with its own code.
	it('DISCLOSED: PruneExecutionStep re-issued on SKIPPED is refused by its PRECHECK, not its source set', () => {
		seedBelowQueuedStepState_LEGACY_ONLY(store, PLAN, ['SKIPPED']);
		const before = store.readAllEvents().length;
		const r = dispatch('PruneExecutionStep', { stepId: sid(1) });
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code, 'the prunability precheck, not the source set').toBe(
			'RPH_INVARIANT_VIOLATION'
		);
		expect(store.readAllEvents()).toHaveLength(before);
		expect(stepStateOf(1)).toBe('SKIPPED');
	});
});
