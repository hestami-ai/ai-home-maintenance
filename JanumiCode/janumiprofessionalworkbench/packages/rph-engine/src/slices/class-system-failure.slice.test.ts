// JAN-SLICE-SWP-03 — the SYSTEM-FAILURE journey: the work RAN, and the machinery under it broke.
//
// The ratified statement this Slice asserts (`m12-conformance.json`, `RPH-EXE-008`, `sourceRef: "§12"`), verbatim:
//   "After a retry policy's third attempt fails, the controller must not issue a fourth retry and must select
//    change tactic, replan, escalate, reject, or abandon."
//
// ── WHY THIS CLASS IS `system-failure path`, ARGUED RATHER THAN ASSIGNED ─────────────────────────────────────
// `SL-5` requires the class to be RATIFIED here, not inherited, and the E2E-002 Slice sets the precedent for what
// that argument has to do: distinguish this journey from its NEIGHBOURS, not merely describe it.
//
//   * NOT `normal path`. The work never produces its expected output. Nothing is baselined, assured or admitted.
//   * NOT `alternate valid path`. E2E-002 ratified that class on the ground that *"every command in this journey
//     is ACCEPTED and the work genuinely succeeds. What differs from the normal path is the professional VERDICT,
//     not an error, a failure or an unavailability."* Here the inverse holds on every limb: the work does not
//     succeed, and no verdict is ever reached. There is nothing valid about this ending — it is a breakdown.
//   * ⚠ NOT `user-error path`, AND THIS IS THE DISTINCTION THE CLASS TURNS ON. Nothing in this journey is
//     malformed. Every payload validates; no command is refused at the schema. The refusals are all
//     `RPH_INVARIANT_VIOLATION` / category `INVARIANT`, and `O-1` ASSERTS that rather than leaving it to the
//     reader — a user-error journey would refuse with `RPH_VALIDATION_SCHEMA_FAILED`, and the two are told apart
//     by the code, which is checked.
//   * NOT `permission-denied path`. One authorized principal (`JOURNEY_ACTOR`) performs every act, and no
//     refusal here carries `status: 'UNAUTHORIZED'` — neither of the two mechanisms that surface it
//     (`RPH_AUTHENTICATION_REQUIRED`, `RPH_AUTHORITY_INSUFFICIENT`) is reached. `O-1` RECORDS this, and its
//     comment states why recording is all it does: with one authorized principal the status assertion cannot
//     fail, so the class is established here by the CODE assertion and by argument, not by that expectation.
//   * NOT `data-unavailable path`, AND THE FAILURE CLASS IS CHOSEN TO MAKE THAT TRUE. `ExecutionFailureClass`
//     carries `DEPENDENCY_UNAVAILABLE`, which IS that neighbouring class wearing an execution-failure hat. This
//     journey uses `SANDBOX_FAILURE` instead — the §36.2 row whose own rationale reads *"The execution
//     environment failed. Nothing about the prompt, model or tool selection is implicated — this is
//     infrastructure, and the honest responses are to wait for it, try again, or tell someone."* Nothing is
//     missing; the machine broke.
//   * NOT `interrupted or resumed path` (nothing is suspended and picked up again) and NOT `cancellation path`
//     (nobody cancels: `CancelExecutionPlan` / `CancelExecutionStep` are never issued — the ENGINE stops the
//     work, which is the opposite of a professional withdrawing it).
//
// ── WHAT IS ASSERTED, AND WHAT IS NAMED AS NOT ASSERTED (`SL-2`) ────────────────────────────────────────────
// `RPH-EXE-008` has two clauses and both are here: (a) the fourth retry is refused (`O-1`), (b) the controller
// must select one of five remedies (`O-3`, NARROWED — read its name and its comment for what the narrowing is).
//
// ⚠ WHICH OF THE RULE'S FIVE ARMS IS ACTUALLY DRIVEN: **`ESCALATE`, AND ONLY `ESCALATE`.** `O-3` asserts that the
// refusal NAMES all five (`CHANGE_TACTIC, REPLAN_EXECUTION, ESCALATE, REJECT, ABANDON`) and then performs exactly
// ONE of them end to end — an `ESCALATION` Decision that reaches the work. `CHANGE_TACTIC`, `REPLAN_EXECUTION`,
// `REJECT` and `ABANDON` ARE NOT DRIVEN, and nothing here asserts anything about them beyond their appearance in
// the refusal text. Their carriers, measured rather than guessed — and a first draft of this paragraph guessed,
// writing `ReplanExecution` as a command, which DOES NOT EXIST (`grep -rniE replan` over production source
// returns enums, kernels and register prose, and no handler): `CHANGE_TACTIC` has its own command
// `ApplyTacticalChange` (`handlers/registry.ts:169`); `REJECT` and `ABANDON` have `RejectPwu` (`:160`) and
// `AbandonPwu` (`:149`); `REPLAN_EXECUTION` has NO command of its own and is carried the same way `ESCALATE` is
// here — a governed `Decision` whose `decisionType` is `REPLAN` (`DecisionTypeSchema`, `enums.ts:353`). That is a
// fact about the registry, recorded rather than asserted, because a carrier EXISTING is not this journey having
// exercised it. The choice of `ESCALATE` is argued at `O-3`; the other four are named here so their absence
// cannot be read as coverage.
//
// TWO CANDIDATE RULES WERE OFFERED FOR THIS CLASS AND ARE **NOT** CITED. Neither is a gap in this Slice; each is
// a fact about the engine, established by looking rather than assumed:
//
//   * `RPH-EXE-009` ("a malformed structured model result … boundary validation fails …") IS NOT DRIVABLE. Three
//     independent things say so and they agree. (1) `CompleteExecutionStepPayloadSchema` declares
//     `structuredResult: z.unknown()` (`packages/rph-contracts/src/messages.ts:180`) — there is no boundary
//     validation on the command path to fail. (2) The kernel that expresses the rule, `assessModelOutput`
//     (`packages/rph-domain/src/execution.ts:651`), has NO production caller: a repository-wide search outside
//     `dist/` returns its definition, its own unit test in the same module, and — this is the part an absence
//     claim must state rather than omit — four DOCUMENTS that already record it as dead (the dead-kernel census
//     text and test, `HARMONIZATION-LOG.md`, and W1's triage roadmap). No caller, in any package or app. (3) That
//     is not merely my search —
//     `verif/dead-kernel-census.test.ts:269` carries it as a gated `DEFERRED` row whose reason is *"JPWB hosts no
//     tool or model invocation … so nothing produces model output to assess."* The enforcement register agrees
//     from a third direction (`NOT_A_COMMAND_REFUSAL`, `enforcement-register.ts:754`). Driving it here would
//     mean calling a pure function, which is a unit test wearing a journey's clothes.
//   * `RPH-ASR-006` ("a validator timeout makes assessment state VALIDATOR_FAILED …") IS NOT EXPRESSIBLE. The
//     brief asked whether a timeout is expressible at all before citing it; it is not. `VALIDATOR_FAILED` is a
//     member of `AssuranceAssessmentStateSchema` (`enums.ts:76`) and is NOT a member of
//     `AssuranceDispositionRecommendationSchema` (`enums.ts:96`), which is the only vocabulary
//     `CompleteAssuranceAssessment` accepts — so no command can put an assessment into that state. Searched for
//     the token across `rph-application`, `rph-engine`, `rph-persistence` and `rph-assurance`: `rph-engine` and
//     `rph-persistence` have no occurrence at all, `rph-application`'s three are every one a COMMENT, and the
//     live ones are all inside `rph-assurance`'s in-process validator boundary (`floor.ts`, `validators.ts`,
//     `assurance-rules.ts`) — a pseudo-disposition its own `recording.ts` folds AWAY before anything recordable,
//     and which no command surface reaches.
//     ⚠ AND WHAT IS PRESENT, so no reader takes the above for "nothing about validator failure exists":
//     `MarkValidatorDegraded` is a real registered command (`registry.ts:209`) and `validator-registry.ts` says
//     in terms that it records *"that a VALIDATOR did"* fail, as distinct from §30's `ASSESSING →
//     VALIDATOR_FAILED` which records that an ASSESSMENT did. The half that exists is the validator's status;
//     the half `RPH-ASR-006` is about is the assessment's, and that half has no door.
//     `O-4(narrowed)` asserts the execution-plane ANALOGUE of `RPH-ASR-006`'s protective clause — "execution
//     failure differs from rejection" — and its name says it is the analogue and not the rule. Read its
//     preamble for what part of it is class-specific and what part is a fact about the state machine.
//
// ── SL-S4: WHAT ALREADY COVERS RPH-EXE-008, AND HOW THIS DIFFERS ────────────────────────────────────────────
// `packages/rph-application/src/handlers/execution-retry-cap.test.ts` drives the cap at the handler, on a bare
// fixture, with UNCLASSIFIED failures (`failureReason: 'boom'`, no `failureClass`). It proves the arithmetic.
// This Slice does not restate the arithmetic; it drives the JOURNEY the arithmetic sits inside — a governed
// policy, an approved intent, a shaped PWU, an approved and activated plan, three CLASSIFIED failures, and the
// controller's answer afterwards — and it asserts three things that file cannot:
//   1. WHICH GUARD SPEAKS (`O-2`). Two refusals live at this exact arrangement, and the retry-cap file never
//      meets the other one; `execution-failure-class-retry.test.ts` meets it only at `maxAttempts: 9`, chosen so
//      *"every refusal below must come from the failure CLASS, never from the attempt count."* Neither file
//      stands where BOTH are live. `O-2` does, and varies the failure class across two runs at the SAME attempt
//      number to tell them apart.
//   2. THE SECOND CLAUSE (`O-3`). Neither file drives the SELECTION the rule requires; both stop at the refusal.
//   3. THE THREE-AXIS SNAPSHOT (`O-4(narrowed)`). At the instant the budget is spent, `workLifecycleState`,
//      `executionState` and `assuranceState` read `EXECUTING` / `FAILED` / `UNASSESSED` simultaneously — INV-5 in
//      the failure direction, and a state only a journey shaped like this one reaches.
//      ⚠ THIS ITEM ONCE READ "THE CLASS ITSELF (`O-4`). That the breakdown produces no professional verdict."
//      It was corrected. `O-4`'s two headline refusals (`UNASSESSED -> REJECTED`, `UNASSESSED -> SATISFIED`) are
//      MATRIX facts that hold in every journey, including one where nothing ran — `O-5(control)` drives that
//      world and gets byte-identical refusals back. They are true, they are worth asserting, and they are not
//      what distinguishes this journey. The snapshot is. See `O-4`'s preamble for the full correction, and for
//      the disclosed fact that the snapshot has no isolating mutant.
//
// ⚠ `it.fails` IS NOT USED, and no assertion was weakened to reach green. Where a claim is narrower than its
// rule, the TEST NAME carries the narrowing — the precedent E2E-002 set for `O-c(partial)` and `O-f(partial)`.
import { describe, expect, it } from 'vitest';

import {
	beginJourney,
	changeState,
	seedIntentAndArchitecture,
	seedJourneyPolicy,
	type Journey
} from './../__tests__/slice-journey.js';

export const SLICE = {
	id: 'CLS-SYSTEM-FAILURE',
	title: 'Execution runs, the sandbox fails it three times, and the retry budget ends the work without a verdict',
	plane: 'ENGINE',
	scenarioClass: 'system-failure path',
	// ONE rule, ASSERTED — and re-checked against the rule's own words rather than against this file's memory of
	// them. `RPH-EXE-008` reads, verbatim from `m12-conformance.json`: *"After a retry policy's third attempt
	// fails, the controller must not issue a fourth retry and must select change tactic, replan, escalate, reject,
	// or abandon."* Clause (a) — "must not issue a fourth retry" — is asserted in `O-1`, on the cap's own
	// interpolated wording, not on a status or a code. Clause (b) — "must select …" — is asserted in
	// `O-3(narrowed)`: the refusal names all five remedies verbatim, and ONE of them, `ESCALATE`, is performed as
	// a governed act that lands on the work. THAT ONE ARM IS THE WHOLE OF WHAT IS DRIVEN of the five; the header
	// says so, and it is stated here too so a reader of `citedRules` alone is not left thinking otherwise.
	//
	// `RPH-EXE-009` and `RPH-ASR-006` were offered and are deliberately absent — see the header for the
	// three-source establishment of why neither is drivable. `citedRules` is documented as "rules this Slice
	// ASSERTS"; listing a rule this Slice only discusses would be the borrowed-authority move the register
	// records at `enforcement-register.ts` for mis-cited ratifications. Nothing was ADDED here either: `O-5`'s
	// matrix fact and `O-4`'s snapshot assert no catalog rule — they are refused before any rule-bearing guard
	// runs — so no citation was minted to make the list look fuller.
	citedRules: ['RPH-EXE-008'],
	dischargesRegisterEntries: [],
	mutants: [
		{
			id: 'CLS-SYSTEM-FAILURE-M1',
			file: 'packages/rph-application/src/handlers/execution.ts',
			find: 'the retry cap (${maxAttempts} total attempts) is reached after ${attemptsMade} attempt(s)',
			replace: 'the attempt budget for this plan has run out',
			expectRed: ['O-1'],
			predictedMessage:
				'the fourth retry must be refused BY THE CAP, naming the budget it reached and the attempts it counted — RPH-EXE-008 clause (a)',
			why: "Proves clause (a) is asserted on the CAP's own words and not on the bare fact of a refusal. Two guards refuse a retry in this handler and both return RPH_INVARIANT_VIOLATION, so a status-only or code-only assertion could not tell them apart — the failure mode `JAN-CSAA` closed 64 findings for. The replacement deliberately shares no substring with the anchor: `O-1` asserts by `toContain`, and a replacement containing the original cannot redden a substring check (the trap E2E-002-M1 records). The anchor is the interpolated count phrase rather than `the controller must not retry again (RPH-EXE-008)`. THE REASON FIRST RECORDED HERE WAS WRONG AND IS CORRECTED, NOT QUIETLY REPLACED: it said mutating that second string 'would redden the register's gate as well and come back TOO_WIDE'. The driver refutes that — `scripts/drive-slice-mutants.ts:126` applies the mutant and then calls `runSlice(rel)` on the DECLARING Slice alone, so the enforcement register's gate never executes during a mutant run and cannot contribute any verdict. Two verified reasons survive, and they are better ones. (1) DISCRIMINATION: `RPH-EXE-008` appears in this message ONLY inside that marker phrase, so mutating it would redden `O-1` through the rule-id expectation — an assertion that both guards in this handler would satisfy equally, and which therefore proves nothing about WHICH guard spoke. The count phrase is unique to the cap and is the half that discriminates. (2) COUPLING OUTSIDE THE INSTRUMENT: the register declares that exact string as its `refusalMarker` for RPH-EXE-008 (`enforcement-register.ts:748`) and classifies a refusal MASKED when the message does not contain it (`:4058`) — a live probe in a file this driver never runs, so the cost would be real and INVISIBLE to the verdict."
		},
		{
			id: 'CLS-SYSTEM-FAILURE-M2',
			file: 'packages/rph-application/src/handlers/execution.ts',
			find: "its last failure was classified ${lastClass}, and DOC-002 §36's control-action mapping does not permit RETRY for that class",
			replace: 'the outcome recorded against the previous attempt bars reopening it',
			expectRed: ['O-2'],
			predictedMessage:
				'at the same attempt number, a RETRY_EXHAUSTION failure must be refused by the §36 class mapping and say so — the guard that speaks depends on the class, not on the count',
			why: 'Proves `O-2` reads the CLASS refusal specifically. `O-2` is the discriminating arrangement: two runs identical except for the failureClass recorded on the third failure, both at attemptsMade=3 where BOTH guards are live. Without this mutant the test would rest on the assumption that the class check runs first; with it, the assumption is a measurement. It cannot redden `O-1`: `O-1` asserts the ABSENCE of this wording in the sandbox run, and removing the wording from the source leaves that absence true.'
		},
		{
			id: 'CLS-SYSTEM-FAILURE-M3',
			file: 'packages/rph-domain/src/execution.ts',
			find: "'REJECT',",
			replace: "'WAIT',",
			expectRed: ['O-3(narrowed)'],
			predictedMessage:
				'the refusal must name all five ratified remedies — change tactic, replan, escalate, reject, abandon — which is clause (b) of RPH-EXE-008 AS THE REFUSAL STATES IT — not the only form the engine states it, since execution-view.ts:653 emits the same set from the same kernel call',
			why: "Proves clause (b)'s first half is asserted on the CONTENT of `RETRY_EXHAUSTION_ACTIONS` and not on the mere presence of a list. `WAIT` is a real `ControlAction` member (`enums.ts:293`), so the mutant TYPE-CHECKS — a mutant that broke compilation would redden everything and prove nothing. `REJECT` is the member whose own docblock records that it was nearly dropped: *\"I first authored this row as four actions and dropped REJECT; the adversarial review found the corpus had said five all along.\"* This mutant is what stops that from happening again silently. It cannot redden `O-1` or `O-2`, neither of which asserts any action name."
		},
		{
			id: 'CLS-SYSTEM-FAILURE-M4',
			file: 'packages/rph-domain/src/transitions.data.ts',
			find: "to: 'EVIDENCE_REQUIRED',",
			replace: "to: 'REJECTED',",
			expectRed: ['O-4(narrowed)', 'O-5(control)'],
			predictedMessage:
				'a system failure must not be convertible into a professional verdict: PWU.assuranceState has no arrow out of UNASSESSED into REJECTED, and the refusal must name that machine and that arrow',
			why: "Proves `O-4(narrowed)` and its control rest on the assuranceState MACHINE and not on some downstream backing check. The mutant redirects the machine's first arrow so UNASSESSED -> REJECTED becomes legal; the command is then refused further downstream by `rejectUnbackedDisposition` with a different code and a different message, and the `toContain` on the illegal-transition wording reddens. IT NAMES TWO CLAUSES DELIBERATELY, AND THAT IS NOT WIDTH: `O-5(control)` asserts the SAME arrow from a world that never executed — that is its entire finding — so a mutant that moved the arrow and reddened only one of the two would mean the other was never reading the arrow at all. THE SECOND-LIMB CLAIM IS NOW DRIVEN RATHER THAN PREDICTED. It leaves the UNASSESSED -> SATISFIED limb of each test green, because the mutated command cannot MOVE the axis: REJECTED is a member of `ASSESSMENT_BACKED_DISPOSITIONS` (`handlers/pwu.ts:1314`), the cited supporting objects are an EXECUTION_PLAN and an empty list rather than an ASSURANCE_ASSESSMENT, so `rejectUnbackedDisposition` refuses with RPH_EVIDENCE_MISSING and the PWU stays on UNASSESSED — leaving the second attempt still reading UNASSESSED -> SATISFIED. A review flagged this as an undriven prediction; the guard and its membership set were then read, and they confirm it."
		},
		{
			id: 'CLS-SYSTEM-FAILURE-M5',
			file: 'packages/rph-domain/src/pwu-lifecycle-command-spec.ts',
			find: "target: 'BLOCKED',",
			replace: "target: 'RESHAPING',",
			expectRed: ['O-3(narrowed)'],
			predictedMessage:
				'the selected remedy must actually land on the work — the PWU must read BLOCKED because BlockPwu moved it there, not because the test asserted a value it never earned',
			why: "Proves clause (b)'s second half — that the selection is CARRIED onto the work — is earned by an accepted command rather than assumed. `RESHAPING` is a legal target from EXECUTING (`ReshapePwu` claims that arrow), so the mutated command is still ACCEPTED and the failure is a clean assertion mismatch rather than a broken arrangement. Both M3 and M5 name `O-3(narrowed)` because that one clause has two halves — the refusal NAMES the remedies, and the chosen remedy REACHES the work — and a clause with two halves and one mutant has half its ground untested."
		}
	]
};

const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69G5W00';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5W10';
const PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69G5W20';
const STEP = 'step_01ARZ3NDEKTSV4RRFFQ69G5W30';
const ESCALATION = 'dec_01ARZ3NDEKTSV4RRFFQ69G5W40';

/** The plan's retry budget. Stated once, and read back in `O-1`'s expected message so the two cannot drift. */
const MAX_ATTEMPTS = 3;

/**
 * Everything up to the first attempt: a governed policy, an approved intent, a shaped PWU, an approved and
 * ACTIVE execution plan carrying a real `RetryPolicy`, and a PWU whose execution axis is RUNNING.
 *
 * ⚠ THIS IS NOT `executeWork` FROM THE SHARED FIXTURE, AND IT CANNOT BE. `executeWork` drives a step to
 * SUCCEEDED and takes the PWU with it — it has no stop-before-completion option and no `retryPolicy` parameter,
 * so it can neither fail a step nor set the budget this rule is about. The shared fixture is not edited to add
 * one: other Slices are being authored against it concurrently, and the acts below are the ones that make THIS
 * journey different from the others, which is precisely what the fixture's own header says belongs in a Slice.
 *
 * ⚠ AND THE PWU'S EXECUTION AXIS IS WALKED QUEUED -> RUNNING BEFORE THE STEP STARTS, BECAUSE THE MATRIX FORCES
 * IT. Driven, not assumed: a hop straight to FAILED from QUEUED is refused with *"Illegal transition on
 * PWU.executionState: QUEUED -> FAILED (ILLEGAL_UNDEFINED: transition QUEUED -> FAILED is not in the
 * PWU.executionState matrix)"*. A first draft did exactly that, and the consequence was worse than a red test:
 * the refusal it caused MASKED the one `O-4` was written to observe, so the Slice would have reported the
 * assurance axis as guarded while the execution axis was what actually refused. That is the two-guards hazard,
 * caught by driving.
 */
function planned(): Journey {
	const j = beginJourney();
	seedJourneyPolicy(j);
	seedIntentAndArchitecture(j, { intentId: INTENT, pwuId: PWU });

	j.send('BeginPwuShaping', 'PROFESSIONAL_WORK_UNIT', PWU, {});
	j.send('MarkPwuReady', 'PROFESSIONAL_WORK_UNIT', PWU, {
		shapeReadinessAssessmentId: 'assess_shape',
		expectedSemanticVersion: 1
	});
	j.send('ProposeExecutionPlan', 'EXECUTION_PLAN', PLAN, {
		executionPlanId: PLAN,
		workUnitId: PWU,
		steps: [
			{
				id: STEP,
				executionPlanId: PLAN,
				// TRANSFORMATION, not MODEL_INVOCATION — the same deliberate narrowing the shared fixture records:
				// `completeExecutionStep` derives `aiProduced` FROM THE STEP TYPE, and a MODEL_INVOCATION step
				// obliges the whole de minimis floor, which this Slice asserts nothing about. The step never
				// completes here anyway; the type is kept honest rather than convenient.
				stepType: 'TRANSFORMATION',
				purpose: 'Produce the architecture definition',
				inputBindings: [],
				outputBindings: [],
				preconditions: [],
				postconditions: [],
				stepState: 'QUEUED'
			}
		],
		transitions: [],
		// ⚠ THE BUDGET IS STATED, NOT LEFT TO THE DEFAULT. `retryCapFrom` coerces an absent or degenerate
		// `maxAttempts` to 3, which is the same number — so a plan with `retryPolicy: {}` would produce an
		// identical refusal for a DIFFERENT reason, and this journey could not tell "the policy said three" from
		// "nobody said anything". The ratified rule is about *a retry policy's* third attempt; the policy is real.
		retryPolicy: { maxAttempts: MAX_ATTEMPTS },
		tacticalChangePolicy: {},
		escalationPolicy: {},
		terminationPolicy: {}
	});
	j.send('ApproveExecutionPlan', 'EXECUTION_PLAN', PLAN, {});
	j.send('ActivateExecutionPlan', 'EXECUTION_PLAN', PLAN, { authorizedRuntimeBindingIds: [] });

	const hop = (previousState: string, newState: string, executionState: string): void =>
		changeState(j, PWU, {
			previousState,
			newState,
			executionState,
			assuranceState: 'UNASSESSED',
			supportingObjectIds: [PLAN]
		});
	hop('READY', 'PLANNED', 'PLANNED');
	hop('PLANNED', 'EXECUTING', 'QUEUED');
	hop('EXECUTING', 'EXECUTING', 'RUNNING');
	return j;
}

/** One attempt: the step starts, and the sandbox under it dies. */
function attemptAndFail(j: Journey, failureClass: string): void {
	j.send('StartExecutionStep', 'EXECUTION_PLAN', PLAN, { stepId: STEP });
	j.send('FailExecutionStep', 'EXECUTION_PLAN', PLAN, {
		stepId: STEP,
		failureReason: 'the execution sandbox terminated before the transformation produced anything',
		failureClass
	});
}

/**
 * Three attempts, two accepted retries, and the fourth retry ATTEMPTED. Returns the fourth retry's result.
 *
 * ⚠ THE COUNTER IS `ExecutionStepStarted`, NOT `ExecutionStepRetried` (§19 L3-3), so the arithmetic is: start(1)
 * fail retry -> permitted (1 < 3); start(2) fail retry -> permitted (2 < 3); start(3) fail retry -> REFUSED
 * (3 < 3 is false). The two permitted retries go through `send`, which THROWS on refusal — so if the cap ever
 * moved, this arrangement would fail loudly at the act that changed rather than quietly producing a refusal at
 * the wrong attempt and letting `O-1` pass for the wrong reason.
 *
 * `thirdFailureClass` is a PARAMETER because `O-2` varies it. Everything else — the act sequence, the counts,
 * the plan, the actor — is held identical across the two runs, and the class is the single thing that differs.
 */
function exhaustRetryBudget(j: Journey, thirdFailureClass: string) {
	attemptAndFail(j, 'SANDBOX_FAILURE');
	j.send('RetryExecutionStep', 'EXECUTION_PLAN', PLAN, { stepId: STEP });
	attemptAndFail(j, 'SANDBOX_FAILURE');
	j.send('RetryExecutionStep', 'EXECUTION_PLAN', PLAN, { stepId: STEP });
	attemptAndFail(j, thirdFailureClass);
	return j.attempt('RetryExecutionStep', 'EXECUTION_PLAN', PLAN, { stepId: STEP });
}

/**
 * The journey to the point where the controller has to answer: the budget is spent, the PWU's execution axis
 * reads FAILED, and the plan itself is FAILED under the §36.2 class that names what happened to it.
 *
 * ⚠ `FailExecutionPlan` CARRIES `RETRY_EXHAUSTION` WHILE THE STEP'S FAILURES CARRY `SANDBOX_FAILURE`, AND THAT
 * IS NOT AN INCONSISTENCY. The step failed because the sandbox died, three times; the PLAN failed because the
 * budget for retrying it ran out. Two different objects failing for two different reasons is exactly what the
 * §36.2 vocabulary is for, and giving both the same class would have thrown away the distinction.
 */
function brokenJourney(): { readonly j: Journey; readonly refusal: ReturnType<Journey['attempt']> } {
	const j = planned();
	const refusal = exhaustRetryBudget(j, 'SANDBOX_FAILURE');
	changeState(j, PWU, {
		previousState: 'EXECUTING',
		newState: 'EXECUTING',
		executionState: 'FAILED',
		assuranceState: 'UNASSESSED',
		supportingObjectIds: [PLAN]
	});
	j.send('FailExecutionPlan', 'EXECUTION_PLAN', PLAN, {
		failureReason: 'the sandbox failed on every permitted attempt and the retry budget is spent',
		failureClass: 'RETRY_EXHAUSTION'
	});
	return { j, refusal };
}

const messageOf = (r: ReturnType<Journey['attempt']>): string => r.error?.message ?? '';

/** The three axes a PWU is holding, which a `ChangePwuState` hop is obliged to restate. */
interface HeldAxes {
	readonly lifecycle: string;
	readonly execution: string;
	readonly shapeIntegrity: string;
}

/**
 * Attempt to move the PWU's assurance axis to `disposition` while HOLDING every other axis where it already is.
 *
 * ⚠ ONE BUILDER, USED BY BOTH `O-4` AND `O-5`, AND THAT IS THE POINT. `O-5` is a control whose entire argument is
 * that two runs differ in ONE respect — the journey — so the command they send must be the same command. This
 * repository has already recorded the alternative as a defect twice: a control that varies two inputs cannot
 * attribute the difference to either, and "a byte-identical payload" maintained by two independent object
 * literals can drift silently. Here there is one literal, and drift is impossible rather than unlikely.
 *
 * `supportingObjectIds` is a PARAMETER because `O-4` cites the failed plan (the honest citation for a hop inside
 * that journey) and `O-5` holds it at `[]` in BOTH of its worlds — the control world has no plan to cite, and
 * citing an id no store holds would be the dangling-governance-fact defect. Holding it empty on both sides keeps
 * the pair's only difference the journey itself.
 */
function attemptVerdict(
	j: Journey,
	held: HeldAxes,
	disposition: string,
	supportingObjectIds: readonly string[]
): ReturnType<Journey['attempt']> {
	return j.attempt('ChangePwuState', 'PROFESSIONAL_WORK_UNIT', PWU, {
		previousState: held.lifecycle,
		newState: held.lifecycle,
		executionState: held.execution,
		assuranceState: disposition,
		shapeIntegrityState: held.shapeIntegrity,
		reasonCode: 'CONTROLLER',
		supportingObjectIds
	});
}

/** The axes a PWU holds once the sandbox has failed it three times and the budget is spent. */
const AFTER_THE_BREAKDOWN: HeldAxes = {
	lifecycle: 'EXECUTING',
	execution: 'FAILED',
	shapeIntegrity: 'PRESERVED'
};

/**
 * The axes a PWU holds when it has only ever been PROPOSED — `ProposePwu`'s seeded values (`handlers/pwu.ts:291`),
 * read back and asserted in `O-5` rather than trusted from the source.
 */
const NEVER_EXECUTED: HeldAxes = {
	lifecycle: 'PROPOSED',
	execution: 'NOT_PLANNED',
	shapeIntegrity: 'UNKNOWN'
};

describe('SLICE CLS-SYSTEM-FAILURE — the sandbox fails the work three times and the retry budget ends it', () => {
	// RPH-EXE-008, clause (a): "the controller must not issue a fourth retry".
	//
	// ⚠ THE REFUSAL IS ASSERTED ON THE CAP'S OWN WORDS, NOT ON `not.toBe('ACCEPTED')`. This exact arrangement has
	// TWO live refusals — the §36 failure-class mapping and the retry cap — and both return
	// `RPH_INVARIANT_VIOLATION`, so status and code are both blind here. `O-2` is where that is measured; this
	// test simply refuses to make the claim on evidence that cannot support it.
	//
	// ⚠ THE LAST TWO EXPECTATIONS ARE NOT EQUALS, AND AN EARLIER DRAFT OF THIS COMMENT CLAIMED THEY WERE. It said
	// both were "what make this Slice's `scenarioClass` earned rather than declared". Only one of them is.
	//
	//   * The CODE assertion MEASURES something. `RPH_INVARIANT_VIOLATION` and `RPH_VALIDATION_SCHEMA_FAILED` are
	//     both reachable on a `RetryExecutionStep` — a malformed payload really would refuse at the schema — so
	//     this expectation excludes the `user-error path` by observation, and it can fail.
	//   * The STATUS assertion CANNOT FAIL IN ANY WORLD THIS FILE BUILDS, and that is a fact about the
	//     arrangement, not about the engine. One authorized principal (`JOURNEY_ACTOR`) drives every act, so
	//     neither `RPH_AUTHENTICATION_REQUIRED` (command-bus) nor `RPH_AUTHORITY_INSUFFICIENT` (handlers) — the
	//     two mechanisms that share `status: 'UNAUTHORIZED'` — is ever live on this path. No declared mutant
	//     reaches it, and none could without breaking every act in `planned()` and reddening the whole file. It is
	//     RETAINED as a record of the construction, and DEMOTED here from evidence to documentation: this
	//     repository's recorded rule is that an assertion which cannot fail certifies by construction rather than
	//     by measurement, and the defect is claiming otherwise, not keeping it.
	it('O-1 — after the third attempt fails, the fourth retry is refused BY THE CAP, as an invariant and not as a malformed or unauthorized act (RPH-EXE-008 clause a)', () => {
		const { refusal } = brokenJourney();

		expect(
			messageOf(refusal),
			'the fourth retry must be refused BY THE CAP, naming the budget it reached and the attempts it counted — RPH-EXE-008 clause (a)'
		).toContain(
			`the retry cap (${MAX_ATTEMPTS} total attempts) is reached after ${MAX_ATTEMPTS} attempt(s)`
		);
		expect(
			messageOf(refusal),
			'and the refusal must name the rule it is enforcing, so a reader of the trace can find it'
		).toContain('RPH-EXE-008');
		// ⚠ THE DISCRIMINATOR. The OTHER guard in this handler refuses with "control-action mapping"; this
		// refusal must not, or the cap is not what spoke and clause (a) is unproved. See `O-2`.
		expect(
			messageOf(refusal),
			'this must be the CAP refusal, not the §36 failure-class refusal — the two are told apart by their messages and by nothing else'
		).not.toContain('control-action mapping');

		// The class of the journey, asserted rather than asserted-about.
		expect(
			refusal.error?.code,
			'a system failure is refused as an INVARIANT violation; a user-error path would refuse at the schema with RPH_VALIDATION_SCHEMA_FAILED'
		).toBe('RPH_INVARIANT_VIOLATION');
		expect(
			refusal.status,
			'and nobody here lacked authority: neither RPH_AUTHENTICATION_REQUIRED nor RPH_AUTHORITY_INSUFFICIENT is reached, so the status is never UNAUTHORIZED'
		).not.toBe('UNAUTHORIZED');
	});

	// ⚠⚠ THE DISCRIMINATING ARRANGEMENT, AND THE REASON IT VARIES WHAT IT VARIES.
	//
	// `retryExecutionStep` runs the §36.2 failure-class -> control-action mapping BEFORE the retry cap.
	// `RETRY_EXHAUSTION` is the one class of the seven that forbids RETRY, so WHICH GUARD SPEAKS depends on the
	// class recorded on the last failure — and at `attemptsMade = 3` both guards are live at once. That is the
	// arrangement this repository warns about: an arrangement that trips two guards proves neither, unless the
	// MESSAGE is what is asserted.
	//
	// ⚠ THAT THE CAP IS LIVE IN THE EXHAUSTION RUN IS SHOWN, NOT SUPPOSED. The sandbox run below reaches the
	// identical attempt count under the identical plan and IS refused by the cap; the cap reads nothing but the
	// `ExecutionStepStarted` count and the plan's `RetryPolicy`, and both are byte-identical across the two runs.
	// So the exhaustion run's refusal is not the cap declining to fire — it is the class check firing FIRST.
	//
	// So the two runs below hold everything constant — the same plan, the same budget, the same three starts and
	// three failures, the same actor, the same attempt number — and vary EXACTLY ONE THING: the class recorded
	// on the third failure. A run pair that held the class fixed and varied labels could not tell the orderings
	// apart, which is the second failure mode this programme has already recorded.
	//
	// ⚠ WHAT A LATER READER MUST NOT CONCLUDE: not that `execution-failure-class-retry.test.ts` is duplicated
	// here. That file deliberately sets `maxAttempts: 9` so *"every refusal below must come from the failure
	// CLASS, never from the attempt count"* — it proves the class check exists by removing the cap from the
	// picture. This test proves the class check WINS when the cap is also reached, which is a fact about
	// PRECEDENCE that no file that excludes one of the two guards can observe.
	it('O-2 — at the same attempt number, which guard refuses depends on the failure class recorded, and only the message tells them apart', () => {
		const sandbox = exhaustRetryBudget(planned(), 'SANDBOX_FAILURE');
		const exhaustion = exhaustRetryBudget(planned(), 'RETRY_EXHAUSTION');

		expect(sandbox.status, 'the sandbox run must be refused — the cap is reached').not.toBe('ACCEPTED');
		expect(exhaustion.status, 'and so must the exhaustion run — both guards are live here').not.toBe(
			'ACCEPTED'
		);

		expect(
			messageOf(exhaustion),
			'at the same attempt number, a RETRY_EXHAUSTION failure must be refused by the §36 class mapping and say so — the guard that speaks depends on the class, not on the count'
		).toContain('its last failure was classified RETRY_EXHAUSTION');
		expect(
			messageOf(exhaustion),
			'and it must name the mapping, which is the half of the message that identifies the guard'
		).toContain("DOC-002 §36's control-action mapping does not permit RETRY");

		// The other half of the discrimination. Without this the test would show that ONE run mentions the class
		// mapping, not that the class is what SELECTS between the guards.
		expect(
			messageOf(sandbox),
			'the sandbox run reaches the identical attempt count and is refused by the OTHER guard — it must not mention the class mapping at all'
		).not.toContain('control-action mapping');
		expect(
			messageOf(sandbox) === messageOf(exhaustion),
			'and the two refusals must not be the same text: if they were, varying the class would have changed nothing and this arrangement would discriminate nothing'
		).toBe(false);
	});

	// RPH-EXE-008, clause (b): "must select change tactic, replan, escalate, reject, or abandon".
	//
	// ⚠⚠ NAMED `(narrowed)` FOR ONE REASON, STATED PLAINLY: **NOTHING IN THE ENGINE COMPELS THE CONTROLLER TO
	// SELECT ANYTHING.** The refusal names the five remedies and then the command is over. No later act is refused
	// on account of the controller's inaction, and no gate fails: a PWU left sitting in EXECUTING with its budget
	// spent is a state nothing in this repository REFUSES, and I looked for a refuser in both directions —
	// `grep -rniE "stalled|stuck|no progress|idle|timed? ?out"` over `packages/rph-*/src`, `apps/rph-demo/src` and
	// `verif/` returns failure-class vocabulary, an assurance-plane note and two projection comments, and no
	// detector of a work unit that stopped moving.
	//
	// ⚠ AN EARLIER DRAFT SAID MORE THAN THAT, AND THE MORE WAS FALSE. It read "no gate, guard **or projection** in
	// this repository would notice", and the assertion message below claimed the refusal states clause (b) "in the
	// only form the engine states it". A PROJECTION NOTICES, AND STATES IT IN A SECOND FORM.
	// `packages/rph-projections/src/execution-view.ts:239` declares
	// `retryExhaustion?: { permittedControlActions: readonly string[] }`; `:626` computes
	// `const exhausted = retry ? retryDecision(retry) : undefined` — THE SAME ratified kernel call the handler's
	// cap makes at `handlers/execution.ts:1557` — and `:653-654` emits the field gated on
	// `exhausted?.mustSelectAlternateAction`, which is exactly the exhaustion condition this clause is about. Its
	// docblock at `:228` reads *"Present when RPH-EXE-008's retry cap is REACHED — the actions the controller must
	// choose among instead."*, and `:618` records that the limb exists precisely because *"the exhaustion actions
	// RPH-EXE-008 prescribes were named ONLY in the engine's rejection message"*. It reaches an operator:
	// `apps/rph-demo/src/routes/undertakings/[id]/+page.svelte:429-431` renders *"RPH-EXE-008: retry cap reached —
	// select {…permittedControlActions}"*. A sibling limb `retryForbiddenByFailureClass` (`:248`, computed
	// `:619-637`) does the same for `O-2`'s guard.
	//
	// So the NARROW claim, which is the one this test makes: the engine STATES the remedy set — in the refusal
	// asserted below, and, independently, in a read-model that surfaces it without any refusal at all — and it
	// COMPELS nothing. Stating and compelling are different, and only the first is true here.
	//
	// What is asserted below is therefore (i) the refusal STATES the ratified remedy set, and (ii) ONE of the five
	// — `ESCALATE` — is PERFORMABLE and lands on the work. ⚠ (ii) IS ONE ARM, NOT FIVE. A previous draft wrote
	// "each of the five is PERFORMABLE"; four of them are not driven anywhere in this file, and the header records
	// their carriers as a registry fact rather than a claim this test earns. The rule's "must" is not enforced,
	// and the test name says so.
	//
	// ⚠ AND A NEAR-MISS RECORDED BECAUSE IT WAS ALMOST WRITTEN AS A FINDING. A draft of this Slice was going to
	// report that `CHANGE_TACTIC` — the FIRST remedy the rule names — has no governed carrier, on the strength of
	// `DecisionTypeSchema`, which carries `ESCALATION`, `REPLAN`, `REJECTION` and `ABANDON` and has no member for
	// a tactical change. That would have been a FALSE ABSENCE. `ApplyTacticalChange` is a real command with a
	// real handler, registered at `registry.ts:169`, emitting `TacticalChangeApplied` against the plan; its
	// payload requires an `authorizingPolicyId`, and every ExecutionPlan — including this journey's — carries a
	// `tacticalChangePolicy` field beside its `retryPolicy`. The absence claim was a claim about a search that
	// had looked in one vocabulary and stopped. All five remedies have a carrier.
	//
	// ⚠ THE SELECTION DRIVEN HERE IS `ESCALATE`, AND THE CHOICE IS PROFESSIONAL RATHER THAN CONVENIENT. The
	// §36.2 mapping permits `['RETRY', 'WAIT', 'ESCALATE']` in response to a SANDBOX_FAILURE, and the exhaustion
	// set is `{CHANGE_TACTIC, REPLAN_EXECUTION, ESCALATE, REJECT, ABANDON}`. Their INTERSECTION is exactly one
	// action — ESCALATE — and it is also the only honest one: the infrastructure is broken, so changing tactic,
	// replanning or rejecting the work would each be a response to a problem the work does not have.
	//
	// ⚠ TWO VOCABULARIES, DELIBERATELY NOT CONFLATED. The control action is `ESCALATE` (`ControlActionSchema`);
	// the governed decision type is `ESCALATION` (`DecisionTypeSchema`). They are different enums and the Slice
	// asserts each under its own name rather than treating one as the other's spelling.
	it('O-3(narrowed) — the refusal names all five ratified remedies, and the selected one reaches the work; nothing obliges the controller to select at all', () => {
		const { j, refusal } = brokenJourney();

		// (i) The five, verbatim and in the ratified order.
		expect(
			messageOf(refusal),
			'the refusal must name all five ratified remedies — change tactic, replan, escalate, reject, abandon — which is clause (b) of RPH-EXE-008 AS THE REFUSAL STATES IT — not the only form the engine states it, since execution-view.ts:653 emits the same set from the same kernel call'
		).toContain('CHANGE_TACTIC, REPLAN_EXECUTION, ESCALATE, REJECT, ABANDON');

		// (ii) The controller selects ESCALATE, and records it as a governed fact naming both the work and the
		// plan that failed. `authority` EQUALS the acting principal because REG-F-014 refuses a Decision whose
		// declared authority is not the authenticated actor — a mismatch would collapse the arrangement here and
		// leave everything below asserting things about a world that was never built.
		j.send('ProposeDecision', 'DECISION', ESCALATION, {
			decisionType: 'ESCALATION',
			subjectObjectIds: [PWU, PLAN],
			selectedOption: 'escalate: the execution environment is failing and no further attempt is permitted',
			rationale:
				'three attempts ended in SANDBOX_FAILURE and the retry budget is spent; the remaining remedies address the work, and the work is not what broke',
			authority: { actorId: 'owner-1', actorType: 'HUMAN', displayName: 'Undertaking Owner' }
		});
		expect(
			(j.state(ESCALATION) ?? {}).decisionType,
			'the selection must be recordable as a governed Decision — clause (b) has a carrier, and ESCALATION is the DecisionType spelling of the ESCALATE control action'
		).toBe('ESCALATION');

		// (iii) And it must REACH THE WORK. A decision that named the PWU and left it running would be a
		// recommendation, not a selection.
		j.send('BlockPwu', 'PROFESSIONAL_WORK_UNIT', PWU, {
			blockReason:
				'the execution environment failed on every permitted attempt; the work is held pending the escalation',
			supportingObjectIds: [PLAN, ESCALATION]
		});
		expect(
			(j.state(PWU) ?? {}).workLifecycleState,
			'the selected remedy must actually land on the work — the PWU must read BLOCKED because BlockPwu moved it there, not because the test asserted a value it never earned'
		).toBe('BLOCKED');
	});

	// ⚠⚠ WHAT SEPARATES A SYSTEM-FAILURE JOURNEY FROM E2E-002's IS THE THREE-AXIS SNAPSHOT BELOW — AND **NOT** THE
	// TWO REFUSALS, WHICH AN EARLIER DRAFT OF THIS COMMENT DESIGNATED "THE CLASS ITSELF". That designation was
	// wrong, and `O-5` is the control that shows it rather than a sentence asking you to believe it.
	//
	// `PWU.assuranceState` has exactly TWO outbound arrows from `UNASSESSED` — `EVIDENCE_REQUIRED`
	// (`transitions.data.ts:778`) and `NOT_REQUIRED` (`:856`); I dumped every `from: 'UNASSESSED'` entry in that
	// machine rather than trusting the two I remembered. So `UNASSESSED -> REJECTED` and `UNASSESSED -> SATISFIED`
	// are refused BY THE MATRIX, unconditionally, in every journey. Nothing about the sandbox dying, the budget
	// being spent, or `executionState` reading `FAILED` conditions either refusal — and `O-5` proves that by
	// driving the identical pair against a PWU that was merely proposed and getting BYTE-IDENTICAL messages back.
	// The claim these two limbs establish is therefore a fact about the MACHINE. It is a true and worthwhile fact:
	// a system failure licenses neither a rejection nor a pass, and the axis is closed in both directions. It is
	// simply not a fact this journey caused, and the test name no longer says it is.
	//
	// WHAT IS CLASS-SPECIFIC, then, is the SNAPSHOT: at the instant the budget is spent the three axes read
	// `EXECUTING` / `FAILED` / `UNASSESSED` at once, which is INV-5 in the failure direction and is a state only a
	// journey like this one reaches. E2E-002 is the journey where the work RAN and the profession said NO; this is
	// the journey where the work never ran to completion and **the profession said nothing** — nothing assessed,
	// no evidence admitted, no observation recorded. `RPH-ASR-006` states the same separation on the assurance
	// plane in the words *"execution failure differs from rejection"*; that rule is not expressible here (see the
	// header), so this is the EXECUTION-PLANE ANALOGUE, asserted under a name that says so and cited to no rule it
	// does not prove.
	//
	// ⚠ AND THE SNAPSHOT HAS NO MUTANT, WHICH IS DISCLOSED RATHER THAN QUIETLY LEFT. Every candidate I could
	// construct mutates something inside `planned()` or `brokenJourney()` — the `PWU.executionState` matrix, the
	// seeded axes in `ProposePwu`, `rejectUnbackedExecutionSuccess`'s guard — and those helpers reach the engine
	// through `send`, which THROWS on refusal. Any such mutant reddens `O-1`, `O-3` and `O-4` together, which is
	// the `SL-3a` shape that proves none of them individually. A mutant that names three clauses is worse than an
	// honest gap, so the gap is recorded here.
	//
	// ⚠ ALSO DISCLOSED: `executionState: 'FAILED'` IS THE CONTROLLER'S DECLARATION, ACCEPTED — NOT THE ENGINE'S
	// OBSERVATION. `brokenJourney()` sets it with `ChangePwuState`; the engine does not derive it from the three
	// `ExecutionStepFailed` events. Measured, not assumed: `rejectUnbackedExecutionSuccess`
	// (`handlers/pwu.ts:1473`) returns early unless `p.executionState === 'SUCCEEDED'`, so SUCCESS must be backed
	// by a plan that evidences it and FAILURE is backed by nothing. E2E-002 discloses the exact analogue for its
	// own verdict-carrying hop; this is the same disclosure, made here so the assertion below is not read as the
	// engine having observed the breakdown when it has only accepted an honest report of it.
	//
	// ⚠ WHAT WAS DRIVEN AND IS **NOT** ASSERTED HERE, so a later reader does not mistake its absence for a gap.
	// A fully authorized route to a rejection was also driven: a REJECTION `Decision` proposed and approved by
	// this same principal, then `RejectPwu` citing it. It is refused — *"none of [nothing] is a BLOCKING or
	// CRITICAL AssuranceObservation whose subjectObjectIds include …"* — which is the same conjunct
	// `packages/rph-application/src/handlers/rejection-authority.test.ts` already drives from a seeded
	// UNDER_ASSURANCE fixture ("REJECTS a decision WITHOUT a finding — authority alone does not reject work").
	// `SL-S4` forbids restating it, so it is recorded here as an observation rather than re-asserted: the finding
	// is that the guard holds from a live EXECUTING journey too, and the existing file is where it is proved.
	//
	// What IS asserted is the arrow that no other file walks from here: the PWU's assurance axis cannot be moved
	// out of UNASSESSED into a verdict at all — in EITHER direction. A system failure licenses neither a
	// rejection nor a pass.
	it('O-4(narrowed) — at the instant the budget is spent the three axes read EXECUTING / FAILED / UNASSESSED, and the assurance axis cannot leave UNASSESSED in either direction — a MATRIX fact, not a consequence of the failure (see O-5), and the execution-plane analogue of RPH-ASR-006, not RPH-ASR-006', () => {
		const { j, refusal } = brokenJourney();
		// ⚠ READ, NOT IGNORED, AND `verif/unread-refusal-guard.ts` IS WHY. A first draft of this test destructured
		// only `j` and left the fourth retry's refusal unexamined; the guard failed the file with *"DISPATCH
		// REFUSED AND NEVER READ … if it was an arrangement, the arrangement did not happen and nothing here
		// could tell"* (REG-F-015). It was right: this test's whole premise is that the budget really was
		// exhausted, and a Slice that assumed it would be asserting about a world it had not built. The status
		// alone is read here — the MESSAGE is `O-1`'s to assert, so no mutant of the cap's wording can reach this
		// test and appear to prove two things at once.
		expect(refusal.status, "the premise of this test: the fourth retry really was refused").toBe('REJECTED');

		// The three axes, each telling its own truth at the same instant. This is INV-5 read in the failure
		// direction: execution FAILED, assurance UNASSESSED, and the work still EXECUTING because nobody has yet
		// selected a remedy (`O-3` is where one is selected).
		const pwu = j.state(PWU) ?? {};
		expect(
			pwu.executionState,
			'execution must read FAILED — the work ran and the machinery broke (a fact the controller DECLARED and the engine accepted; only SUCCEEDED must be backed, see this test\'s preamble)'
		).toBe('FAILED');
		expect(
			pwu.assuranceState,
			'and assurance must still read UNASSESSED: no assessment was requested, no evidence admitted, no observation recorded — the profession has not spoken about this work at all'
		).toBe('UNASSESSED');
		// ⚠ THE THIRD AXIS, ASSERTED RATHER THAN ONLY DESCRIBED. The comment above has always said "the work still
		// EXECUTING because nobody has yet selected a remedy"; until now nothing checked it, so the snapshot that
		// carries this Slice's class was two axes wide while the prose claimed three.
		expect(
			pwu.workLifecycleState,
			'and the work is still EXECUTING — the budget is spent and nothing has moved the PWU off it, which is the state no gate refuses and O-3 narrows itself over'
		).toBe('EXECUTING');

		const rejected = attemptVerdict(j, AFTER_THE_BREAKDOWN, 'REJECTED', [PLAN]);
		expect(
			messageOf(rejected),
			'a system failure must not be convertible into a professional verdict: PWU.assuranceState has no arrow out of UNASSESSED into REJECTED, and the refusal must name that machine and that arrow'
		).toContain('Illegal transition on PWU.assuranceState: UNASSESSED -> REJECTED');

		// ⚠ THE OTHER DIRECTION, AND IT IS NOT DECORATION. A test that only refused the pessimistic verdict would
		// be consistent with an engine that treats "not rejected" as "fine" — the failure mode `RPH-PRJ-002`
		// names ("the UI cannot show an unqualified green completion indicator"). The axis is closed both ways.
		const satisfied = attemptVerdict(j, AFTER_THE_BREAKDOWN, 'SATISFIED', [PLAN]);
		expect(
			messageOf(satisfied),
			'and the failure licenses no PASS either — UNASSESSED -> SATISFIED is equally absent from the machine'
		).toContain('Illegal transition on PWU.assuranceState: UNASSESSED -> SATISFIED');
	});

	// ⚠⚠ THE CONTROL FOR `O-4`, AND THE REASON `O-4` IS NAMED `(narrowed)`.
	//
	// A review put the question that this test answers: if `O-4`'s two load-bearing assertions would hold just as
	// well in a journey where nothing failed, they establish the MATRIX and not the CLASS — and `O-4` was the test
	// the file designated "the class itself". The question is settled by measurement, not by re-reading the
	// matrix: build a world with NO sandbox, NO plan, NO budget and NO failure, send the SAME command through the
	// SAME builder, and compare the refusals byte for byte.
	//
	// They are identical. Which means: `O-4`'s two limbs are TRUE and WORTH ASSERTING — the assurance axis really
	// is closed in both directions, and a reader of that Slice needs to know it — but they are not evidence about
	// this journey, and no reader should take their green as showing that the FAILURE is what closed the axis.
	// That correction is the whole content of this test, and it is why `O-4` now carries `(narrowed)` and a name
	// that says "a MATRIX fact, not a consequence of the failure".
	//
	// ⚠ WHAT VARIES BETWEEN THE TWO RUNS IS THE JOURNEY, AND NOTHING ELSE THE TEST CHOOSES. Same command, same
	// builder, same dispositions, same actor, `supportingObjectIds: []` on BOTH sides. The held axes necessarily
	// differ — a hop must restate the axes it holds, and the two worlds hold different ones; that difference IS
	// the journey, and it is asserted below rather than assumed, so the control cannot silently be comparing two
	// copies of the same world.
	//
	// ⚠ THIS IS A CONTROL WITH A MUTANT, WHICH THIS REPOSITORY REQUIRES AND HAS BEEN BURNED FOR OMITTING.
	// `CLS-SYSTEM-FAILURE-M4` reddens it, through the literal-message limb below, and `M4` therefore names BOTH
	// this clause and `O-4`. That is not the mutant being too wide: the two clauses assert the SAME matrix arrow
	// from two different worlds, which is exactly the finding, so a mutant that moved the arrow and reddened only
	// one of them would mean one of the two was not reading the arrow at all.
	it('O-5(control) — a PWU that never executed is refused both verdicts in BYTE-IDENTICAL words, so O-4 establishes the assuranceState matrix and not the system-failure class', () => {
		const { j, refusal } = brokenJourney();
		expect(
			refusal.status,
			'the premise, again: this side of the comparison really is the exhausted-budget world'
		).toBe('REJECTED');

		// THE TREATMENT WORLD holds the axes only a breakdown produces.
		const broken = j.state(PWU) ?? {};
		expect(
			[broken.workLifecycleState, broken.executionState],
			'the treatment world must be the one whose work ran and broke'
		).toEqual([AFTER_THE_BREAKDOWN.lifecycle, AFTER_THE_BREAKDOWN.execution]);

		// THE CONTROL WORLD: a PWU proposed and then left alone. No plan is proposed, no step is started, no
		// failure is recorded, no budget exists to spend.
		const c = beginJourney();
		seedJourneyPolicy(c);
		seedIntentAndArchitecture(c, { intentId: INTENT, pwuId: PWU });
		const fresh = c.state(PWU) ?? {};
		expect(
			[fresh.workLifecycleState, fresh.executionState, fresh.assuranceState],
			'the control world must genuinely never have executed — PROPOSED, NOT_PLANNED, and on the same UNASSESSED assurance axis, which is what makes it comparable at all'
		).toEqual([NEVER_EXECUTED.lifecycle, NEVER_EXECUTED.execution, 'UNASSESSED']);

		for (const disposition of ['REJECTED', 'SATISFIED']) {
			const inTheControl = attemptVerdict(c, NEVER_EXECUTED, disposition, []);
			const inTheBreakdown = attemptVerdict(j, AFTER_THE_BREAKDOWN, disposition, []);

			// (i) The control is refused by the SAME machine and the SAME arrow O-4 names — with nothing whatever
			// having failed. This is the limb `M4` reddens.
			expect(
				messageOf(inTheControl),
				`a PWU that never ran is refused UNASSESSED -> ${disposition} by the matrix alone — no failure is needed to close this axis`
			).toContain(`Illegal transition on PWU.assuranceState: UNASSESSED -> ${disposition}`);

			// (ii) And byte for byte, the breakdown adds NOTHING to the refusal. If the engine ever made this
			// refusal depend on the journey — naming the failed plan, the spent budget, the FAILED execution axis
			// — this equality would break, and O-4's limbs would become class-specific. Today they are not.
			expect(
				messageOf(inTheBreakdown),
				`the exhausted-budget world must be refused in the SAME WORDS as the untouched one: if the two differed, O-4's ${disposition} limb would be saying something about this journey, and it does not`
			).toBe(messageOf(inTheControl));
		}
	});
});
