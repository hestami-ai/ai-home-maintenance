// The Execution Plan read-model (JAN-EXECPLAN-DR-001 DWP-01 / DS-001 §5 Tier 1, fork A).
//
// Intent: shape the existing EXECUTION_PLAN aggregate rows into a per-PWU ExecutionPlanView the Undertaking
// Workbench's execution tab renders, and scope those plans to one Undertaking's PWUs (fixing the F-6 global-list
// bug). The aggregate already embeds current step state, so a pure SHAPING is sufficient for Tier 1 — no event-fold
// (a live-progress event-folding projector + attempt history is Tier 3, deferred; DS §7-A divergence).
//
// Boundary (EP-CMT-4 — this crosses WORKFLOW-ENGINE SEMANTICS): the per-step `advanceCommands` set encodes which
// step transitions the domain can actually drive. It is derived ONLY from the FOUR command-backed step transitions
// in the handler registry (StartExecutionStep: QUEUED→RUNNING; CompleteExecutionStep: RUNNING→SUCCEEDED;
// FailExecutionStep: RUNNING→FAILED; RetryExecutionStep: FAILED→QUEUED). The wider StepState machine has ~18 legal
// arrows; the ones that have since GAINED a command handler live in the separate `controlCommands` allowlist below
// (skip/cancel — DR-003 DWP-02/03; wait/resolve — DR-004 DWP-04), and the rest (NOT_READY→READY, →SUPERSEDED …) still
// have NO handler and therefore NO affordance.
//
// Do not change: advanceCommands MUST come from this allowlist, NOT from the machine's legal-transition topology.
//   Deriving affordances from the topology would mint buttons (Supersede-step, NOT_READY→READY …) that dispatch
//   nonexistent commands (JAN-EXECPLAN-DR-001 F-11 / §19 L3-C3). A step below QUEUED (NOT_READY/READY — the domain's
//   own initial state) has NO advance command at all; `belowQueued` surfaces that honestly rather than as an inert
//   row (F-11), parallel to the plan-level no-completion-handler gap (F-9).
//
// Pure + browser-safe (type-only contract imports), like the rest of rph-projections.
import type { StepState } from '@janumipwb/rph-contracts';
import {
	buildConditionSubject,
	ConditionExpressionSchema,
	evaluateGuardExpression,
	getMachine,
	inEdgeDisposition,
	STEP_COMMAND_SPECS,
	type StepCommandSpec,
	type StepCommandType,
	// RW-6: the read-model consults the SAME decision the engine does, rather than re-deriving RPH-EXE-003's four
	// checks and their load-bearing order.
	bindingAuthorityVerdict,
	type BindingAuthorityFacts,
	// JAN-RETRYCAP (N-12): same discipline one limb further on — the ratified kernel decides, and `retryCapFrom`
	// applies the SAME cap convention the engine applies, so neither the default nor the validity rules exist twice.
	isPermittedForFailure,
	permittedControlActionsForFailure,
	retryDecision,
	retryCapFrom,
	type RetryInput,
	// N-21: RPH-EXE-005's ratified kernel, so the read-model's answer and the engine's are one declaration.
	stepMayBecomeReady,
	isTerminalSuccessStepState,
	prunableStepIds as gatePrunableStepIds,
	startableStepIds as gateStartableStepIds,
	type ConditionExpression,
	type ConditionSubjectEvent,
	type EdgeGuardEvaluator,
	type InEdgeDisposition
} from '@janumipwb/rph-domain';
import { layerHandoff, type HandoffOrder } from './handoff-order.js';
import type { PwaGraphExport } from './pwa-graph.js';

/** The command-backed step transitions — the ONLY affordances the domain can drive (registry handlers). */
export type StepAdvanceCommand = 'start' | 'complete' | 'fail' | 'retry';

/** The command-backed CONTROL actions (off-happy-path, JAN-EXECPLAN-DR-003 DWP-02/03 + DR-004 DWP-04): skip
 *  (READY/QUEUED→SKIPPED), cancel (READY/QUEUED/RUNNING/WAITING/FAILED→CANCELLED), wait (RUNNING→WAITING) and resolve
 *  (WAITING→RUNNING). Distinct from advanceCommands (forward progress toward a terminal state) — a control action
 *  WAIVES, ABORTS or SUSPENDS a step rather than progressing it. Kept as its own allowlist so the UI never invents a
 *  button from the machine topology (the F-11 discipline); every member here has a registry handler (DWP-04 added the
 *  last two, which is what made WAITING reachable and its resume replayable at all). */
export type StepControlCommand = 'skip' | 'cancel' | 'wait' | 'resolve';

/** A semantic tone for a stepState — the UI maps tone → colour. Kept here (not in the component) so the
 *  every-stepState-has-a-defined-tone totality is unit-tested in the pure layer (EP-TST-5 state-transition). */
export type StepTone = 'positive' | 'active' | 'negative' | 'pending' | 'muted';

/** Pure input: the subset of an ExecutionStep (ExecutionPlan.steps[]) the view needs. The server maps engine
 *  `.state` bags into this (mirroring buildPwaExport), keeping this module engine-free. */
export interface ExecutionStepInput {
	readonly id: string;
	readonly stepType: string;
	readonly purpose: string;
	readonly stepState: string;
	readonly runtimeBindingId?: string;
	/**
	 * The RESOLVED facts about that binding, when the caller could look them up (JAN-REVREM RW-6 / MAJOR #5).
	 *
	 * Threaded because `stepAuthorityRefusal` grew a THIRD authority limb — `bindingAuthority` — and this read-model
	 * consulted only two, so the UI offered Start on a step whose binding is REQUESTED, DENIED, REVOKED, or
	 * authorized for a DIFFERENT step, and the engine refused the click. That is F-29's "no affordance the engine
	 * would reject" broken for the third time by a new engine limb whose read-model counterpart was not added —
	 * after RPH-PWU-010 (WP-12b) and Prune (RW-0).
	 *
	 * ABSENT MEANS UNGATED, not unauthorized, exactly as `pwuWorkLifecycleState` is (DS §6b R9). Note the asymmetry
	 * that matters: `resolves: false` is a RESOLVED NEGATIVE and gates, while this whole field being absent is NO
	 * INFORMATION and does not. And a step naming no `runtimeBindingId` at all is OUT OF SCOPE — the reference seed
	 * authors no RuntimeBinding whatsoever, so gating that case would make every existing plan unstartable.
	 */
	readonly runtimeBinding?: StepBindingFacts;
	/** For a RESOLVED BRANCH: the out-edge it actually selected, recorded when it succeeded (DWP-09). The flow gate
	 *  honours a recorded decision over a re-derived one, so this MUST reach the read-model or the UI's branch
	 *  verdict can drift from the engine's the moment a guard's inputs change. */
	readonly selectedTransitionId?: string;
	/**
	 * How many attempts this step has already opened — `attemptsMadeFrom` over the event stream (JAN-RETRYCAP,
	 * closing N-12).
	 *
	 * THE FIRST FACT IN THIS INTERFACE THAT IS NOT A PROPERTY OF THE STEP. Every other field is read off the
	 * aggregate; this one is a COUNT OVER HISTORY, and that is exactly why the affordance filter could not see it.
	 * RPH-EXE-008's cap is a command-layer refusal derived from the event log, so a projection driven by declared
	 * state — however complete — is blind to it BY CONSTRUCTION. `retry` was therefore offered on every FAILED step
	 * under an ACTIVE plan, including one already exhausted, and the engine refused the click: F-29's fourth
	 * instance, and the one that proves the pattern is not confined to the spec table's columns.
	 *
	 * ABSENT MEANS UNGATED, the same disclosed fail-OPEN as `runtimeBinding` and `pwuWorkLifecycleState` (DS §6b
	 * R9): a caller that cannot count gets the pre-N-12 behaviour rather than a silently emptied action column. The
	 * engine still refuses, so the cost is a rejected click and not an illegal act.
	 */
	readonly attemptsMade?: number;
	/**
	 * The §36.2 class of this step's most recent failure — `lastFailureClassFrom` over the event stream
	 * (REG-E-025), or absent if it has never failed or the failure was unclassified.
	 *
	 * THE FIFTH AUTHORITY LIMB, AND I CREATED IT (adversarial review, 2026-08-05). Landing the §36 control-action
	 * mapping gave `retryExecutionStep` a new refusal — a step whose last failure class does not permit RETRY —
	 * and did not tell this read-model, so `retry` was offered on a step the engine now rejects. **F-29's "no
	 * affordance the engine would reject", sixth instance, created by the commit that added the refusal**, one
	 * work package after I wrote a register entry about the fifth.
	 *
	 * The same split as `attemptsMade`: this layer supplies the FACT, the kernel's `isPermittedForFailure` makes
	 * the DECISION, and the spec table's `retryBudget` column says which commands the rule governs. Nothing about
	 * §36 is re-derived here.
	 *
	 * ABSENT is the disclosed FAIL-OPEN, identical to the retry cap's: a caller that supplies no class gets the
	 * old behaviour rather than a silent refusal. It never means "unknown, withhold anyway".
	 */
	readonly lastFailureClass?: string;
	/**
	 * The step's REQUIRED input artifacts that do not resolve — RPH-EXE-005 (N-21).
	 *
	 * A LIVE F-29 ON A RATIFIED RULE, AND I CREATED IT. JAN-CAPBIND WP-3 gave the engine a fourth authority column
	 * (`inputReadiness`) and wired it at both arrows into RUNNING, and this read-model was never told — so `start`
	 * and `resolve` were offered on a step whose required input is absent and the engine refused the click. One
	 * work package later I closed the same shape for the retry cap and called it "the fourth instance", without
	 * noticing the fifth was mine and one commit older.
	 *
	 * RESOLVED BY THE CALLER, like every other fact here: this layer has no store and cannot ask whether an
	 * artifact exists. ABSENT means UNGATED (no information); a RESOLVED EMPTY array means "checked, all present"
	 * and permits. Only a non-empty resolved array gates.
	 */
	readonly unresolvedRequiredInputs?: readonly string[];
}

/** What the caller resolved about a step's runtime binding. The step's own `runtimeBindingId` is not repeated here —
 *  the projection already has it, and carrying it twice invites the two copies to disagree. */
export interface StepBindingFacts {
	/** Did `runtimeBindingId` resolve to a RUNTIME_BINDING? `false` gates; the field's ABSENCE does not. */
	readonly resolves: boolean;
	/** The binding's own ratified `executionStepId` — the step it says it authorizes (§8.1). */
	readonly boundStepId?: string;
	/** The binding's `authorizationStatus`, fed to the ratified kernel predicate. */
	readonly authorizationStatus?: string;
	/**
	 * What the binding actually GRANTS (N-18, sponsor ruling 2026-07-26). A binding may sit in an executable status
	 * while conferring nothing; the engine refuses Start on it, so this read-model must withhold Start too or it
	 * offers a click the engine rejects. ABSENT is UNGATED; only a RESOLVED empty set gates.
	 */
	readonly grantedCapabilities?: readonly string[];
}

/** Pure input: an ExecutionPlan transition (edge) the flow gate reads (DR-004 DWP-01). `conditionExpression` is opaque
 *  here — DWP-02's evaluator interprets it. Absent ⇒ the plan is linear (the array-index degenerate). */
export interface ExecutionTransitionInput {
	readonly id?: string;
	readonly sourceStepId?: string;
	readonly targetStepId?: string;
	readonly transitionType?: string;
	readonly conditionExpression?: unknown;
}

/** Pure input: the subset of an ExecutionPlan aggregate the view needs. */
export interface ExecutionPlanInput {
	readonly id: string;
	readonly workUnitId: string;
	readonly status: string;
	readonly planVersion?: number;
	readonly steps: readonly ExecutionStepInput[];
	/** The transition graph (DR-004 DWP-01); absent/empty ⇒ linear. */
	readonly transitions?: readonly ExecutionTransitionInput[];
	/**
	 * The owning PWU's `workLifecycleState` (JAN-EXECREM WP-15).
	 *
	 * Threaded because WP-12b gave the engine a SECOND authority limb — RPH-PWU-010, refusing execution on a
	 * closed PWU — and a plan on a closed PWU keeps status ACTIVE. Without this the read-model would offer Start
	 * on a plan the engine now refuses: F-29's invariant re-broken in a new place by its own remedy, which is
	 * precisely the recurrence this programme is trying to stop.
	 *
	 * OPTIONAL, and ABSENT MEANS UNGATED rather than closed — a caller that cannot supply it gets the
	 * pre-WP-15 behaviour instead of a silently emptied action column. That is a fail-OPEN default and it is
	 * disclosed rather than hidden: the engine still refuses, so the cost is a rejected click, not an illegal
	 * act. `plansForPwus` supplies it for the one production caller.
	 */
	readonly pwuWorkLifecycleState?: string;
	/**
	 * The plan's `RetryPolicy` bag, verbatim (JAN-RETRYCAP / N-12).
	 *
	 * THE BAG, NOT A PRE-EXTRACTED NUMBER, and that is the point. `RetryPolicy` has no ratified field list, so
	 * "what is this plan's cap" is a CONVENTION — a positive integer `maxAttempts`, else a default — and the moment
	 * a caller extracts the number it is free to apply that convention differently from the engine. Passing the bag
	 * means `retryCapFrom` in the kernel answers the question ONCE, for the engine and for this projection.
	 *
	 * `unknown` because this layer must not pretend to know a shape the corpus has not ratified.
	 */
	readonly retryPolicy?: unknown;
}

export interface ExecutionStepView {
	readonly id: string;
	readonly stepType: string;
	readonly purpose: string;
	readonly stepState: string;
	readonly runtimeBindingId?: string;
	/** The out-edge a resolved BRANCH selected — see ExecutionStepInput. */
	readonly selectedTransitionId?: string;
	readonly tone: StepTone;
	/** The command-backed affordances legal from this stepState (empty for the commandless/terminal states). */
	readonly advanceCommands: readonly StepAdvanceCommand[];
	/** The command-backed CONTROL actions legal from this stepState (skip/cancel — DWP-02/03; empty for terminal). */
	readonly controlCommands: readonly StepControlCommand[];
	/** Below the domain's driveable floor (NOT_READY/READY — the initial state, no advance command) — F-11. */
	readonly belowQueued: boolean;
	/**
	 * Present when RPH-EXE-008's retry cap is REACHED — the actions the controller must choose among instead.
	 *
	 * WHY THE VIEW CARRIES THIS AT ALL. N-12's fix stops offering `retry` at the cap, and those actions were named
	 * ONLY inside the engine's rejection message — which an operator now never sees, because the click that
	 * produced it is gone. A button that silently vanishes is a worse answer than one that refuses with a reason.
	 * The actions come from the same `retryDecision` call that withheld the affordance, so the notice and the
	 * withholding can never disagree.
	 *
	 * ABSENT means NOT EXHAUSTED — including "the caller supplied no attempt count", which is the same disclosed
	 * fail-open as the affordance itself. It never means "unknown, render a warning anyway".
	 */
	readonly retryExhaustion?: { readonly permittedControlActions: readonly string[] };
	/**
	 * Present when DOC-002 §36's control-action mapping FORBIDS retrying this step's last failure class
	 * (REG-E-025) — the class, and what the controller may do instead.
	 *
	 * Distinct from `retryExhaustion`: that one means "you have spent your attempts", this means "this kind of
	 * failure is not one retrying fixes". A step can be well inside its budget and still land here.
	 *
	 * ABSENT means retryable-or-unclassified, never "unknown".
	 */
	readonly retryForbiddenByFailureClass?: {
		readonly failureClass: string;
		readonly permittedControlActions: readonly string[];
	};
}

export interface ExecutionPlanView {
	readonly id: string;
	readonly workUnitId: string;
	readonly status: string;
	readonly planVersion?: number;
	readonly steps: readonly ExecutionStepView[];
	/** The transition graph (DR-004 DWP-01); empty ⇒ linear. Carried so the gate + a future graph view can read it. */
	readonly transitions: readonly ExecutionTransitionInput[];
	/**
	 * The owning PWU's `workLifecycleState`, when the caller could supply it (JAN-REVREM RW-1).
	 *
	 * Carried on the VIEW, not just the input, because `prunableStepIds` takes a view and had no way to see it —
	 * which is why Prune escaped the PWU gate entirely while every other affordance was filtered.
	 */
	readonly pwuWorkLifecycleState?: string;
}

// Record<StepState, …> makes the compiler REQUIRE every one of the 10 StepState values — if a value is added to the
// contract this fails to compile until it is classified here (the state-transition-coverage discipline, EP-TST-5).
const ADVANCE_BY_STEP_STATE: Record<StepState, readonly StepAdvanceCommand[]> = {
	NOT_READY: [],
	READY: [],
	QUEUED: ['start'],
	RUNNING: ['complete', 'fail'], // RUNNING affords BOTH — a single optional field would force an arbitrary pick.
	WAITING: [],
	SUCCEEDED: [],
	FAILED: ['retry'],
	SKIPPED: [],
	CANCELLED: [],
	SUPERSEDED: []
};

// The command-backed CONTROL affordances per stepState (DWP-02/03 + DR-004 DWP-04). Derived from the MACHINE's
// skip/cancel/wait/resume arrows now that every one of them has a command: skip is legal READY|QUEUED→SKIPPED; cancel
// is legal READY|QUEUED|RUNNING|WAITING|FAILED→CANCELLED (NOT from NOT_READY — the machine has no such arrow); wait is legal
// RUNNING→WAITING; resolve is legal WAITING→RUNNING. Record<StepState, …> forces every value to be classified.
const CONTROL_BY_STEP_STATE: Record<StepState, readonly StepControlCommand[]> = {
	// ⚠ EMPTY FOR ONE REASON, AND THE NOTE THAT USED TO SIT HERE WAS WRONG ABOUT BOTH HALVES. It read
	// "machine: →CANCELLED only from READY/QUEUED/RUNNING/WAITING; →SKIPPED only from READY/QUEUED". The CANCELLED
	// half dropped FAILED — the block comment above and the FAILED entry below both have it right — and the
	// SKIPPED half is not a fact about the machine at all: NOT_READY→SKIPPED EXISTS, driven by PruneExecutionStep.
	// What keeps the skip CONTROL out of this state is the COMMAND: `SkipExecutionStep` declares
	// `sourceStates: ['READY', 'QUEUED']`. Prune, not skip, is NOT_READY's exit — see `prunableStepIds`.
	NOT_READY: [],
	READY: ['skip', 'cancel'],
	QUEUED: ['skip', 'cancel'],
	RUNNING: ['cancel', 'wait'], // a running step can be cancelled or suspended, but not skipped (machine)
	WAITING: ['cancel', 'resolve'], // resolve is the ONLY way out of WAITING besides cancel (DWP-04)
	SUCCEEDED: [],
	// JAN-EXECREM WP-5: a FAILED step offers CANCEL — the governed way to abandon an arm nobody will retry. This
	// entry read [] and `Record<StepState, …>` totality did NOT catch it (an empty array is a valid value), so the
	// engine capability and the affordance had to be changed together or the UI would silently withhold the only
	// exit WP-4 leaves for a failed arm. Retry remains a PROGRESS affordance, listed elsewhere, not a control.
	FAILED: ['cancel'],
	SKIPPED: [],
	CANCELLED: [],
	SUPERSEDED: []
};

const TONE_BY_STEP_STATE: Record<StepState, StepTone> = {
	NOT_READY: 'muted',
	READY: 'pending',
	QUEUED: 'pending',
	RUNNING: 'active',
	WAITING: 'pending',
	SUCCEEDED: 'positive',
	FAILED: 'negative',
	SKIPPED: 'muted',
	CANCELLED: 'negative',
	SUPERSEDED: 'muted'
};

/** The command-backed affordances legal from a stepState — the F-11 allowlist. Unknown/off-contract states → []
 *  (never fabricate an affordance). */
function advanceCommandsFor(stepState: string): readonly StepAdvanceCommand[] {
	return ADVANCE_BY_STEP_STATE[stepState as StepState] ?? [];
}

/** The command-backed CONTROL actions (skip/cancel/wait/resolve) legal from a stepState — the DWP-02/03 + DWP-04
 *  allowlist. Unknown/off-contract states → [] (never fabricate). Plan-level gating is applied by the caller — this is
 *  the per-stepState machine-legal set only. (Caller-side: skip and resolve need an ACTIVE plan; cancel is cleanup and
 *  wait suspends already-running work, so neither does.) */
function controlCommandsFor(stepState: string): readonly StepControlCommand[] {
	return CONTROL_BY_STEP_STATE[stepState as StepState] ?? [];
}

/**
 * The affordance -> COMMAND map, so plan-status gating is derived from WP-8's declared table rather than being a
 * seventh hand-written copy of the rule (JAN-EXECREM WP-15 / F-29).
 *
 * `Record<..., StepCommandType>` over BOTH affordance unions: a new affordance cannot ship without naming the
 * command it dispatches, which is the same totality mechanism the specs table itself uses.
 */
export type GatedAffordance = StepAdvanceCommand | StepControlCommand | 'prune';

const COMMAND_BY_AFFORDANCE: Record<GatedAffordance, StepCommandType> = {
	start: 'StartExecutionStep',
	complete: 'CompleteExecutionStep',
	fail: 'FailExecutionStep',
	retry: 'RetryExecutionStep',
	skip: 'SkipExecutionStep',
	cancel: 'CancelExecutionStep',
	wait: 'EnterExecutionStepWait',
	resolve: 'ResolveExecutionStepWait',
	// JAN-REVREM RW-1. Prune was ABSENT from this map, and its absence is why nobody noticed it was ungated:
	// `prunableStepIds` is a bare passthrough to a gate that knows only `plan.status`, while `PruneExecutionStep`
	// declares `pwuOpenness: REQUIRES_OPEN_PWU` and the engine refuses it on a closed PWU. The totality type could
	// not catch the omission because prune was not in the union it is total over — the same invisibility WP-8
	// diagnosed, one layer down. Adding the row is what lets `prunableStepIds` be filtered like every other
	// affordance.
	prune: 'PruneExecutionStep'
};

/** The plan statuses under which an affordance requiring a live plan may be offered. */
const PLAN_STATUS_ACTIVE = 'ACTIVE';

/**
 * The PWU workLifecycleStates that open no new execution (RPH-PWU-010).
 *
 * DERIVED, not copied — JAN-REVREM RW-1. This was `new Set(['BASELINED','ABANDONED','SUPERSEDED'])`, a literal
 * whose own comment called it "the machine's own terminal set" while being unbound to it. The AUTHORITY derives
 * the set (`canResumeExecutionOnPwu` → `isTerminalState('PWU.workLifecycleState', …)`) and its comment says so
 * explicitly; `JAN-EXECREM-RESIDUALS.md` §2 then recorded the rule as "derived rather than hardcoded", which was
 * true of one side and false of the other. Ratify a fourth terminal state and the engine refuses while this
 * read-model kept offering Start — F-29's invariant re-broken on the very limb WP-15 added to protect it, with
 * the whole suite green because the one test of this limb retyped the same three literals.
 *
 * `getMachine` is already used for exactly this purpose two files away (`pwu-behavior.ts`), and this module
 * already imports runtime values from rph-domain, so there was never a layering reason for the copy.
 */
const CLOSED_PWU_STATES: ReadonlySet<string> = new Set(
	getMachine('PWU.workLifecycleState').terminalStates
);

/**
 * BOTH refusals the `retryBudget` column governs, read off that ONE column (extracted from `planPermitsAffordance`,
 * whose limbs are otherwise one `if` each). Returns true when the column does not govern this command at all.
 *
 * ── RPH-EXE-008, the FOURTH authority limb (JAN-RETRYCAP / N-12) ────────────────────────────────────────────
 *
 * AND IT IS THE ONE THAT SHOWS THE OTHER THREE WERE NOT ENOUGH. Those three are decided by DECLARED STATE, so
 * R7's remedy — gate on the spec table's columns — could reach them. This refusal is decided by a COUNT OVER
 * THE EVENT STREAM, and no column can hold a number that changes every time the step starts. A column-driven
 * filter is blind to it BY CONSTRUCTION, which is why `retry` was offered on an exhausted step while the engine
 * refused the click: F-29's fourth instance, in a place the fix for the third could not have covered.
 *
 * So the column says WHICH commands the cap governs and the FACTS say WHETHER this one is at it — the same
 * split as `bindingAuthority` + `bindingAuthorityVerdict`, and for the same reason. The DECISION is
 * `retryDecision`, the ratified kernel the engine calls; the cap comes from `retryCapFrom`, the same convention
 * the engine applies. Nothing about RPH-EXE-008 is re-derived here.
 *
 * ── DOC-002 §36, the FIFTH authority limb (REG-E-025) ──────────────────────────────────────────────────────
 *
 * "Each failure class must map to permitted control actions." A step whose LAST failure class does not permit
 * RETRY may not be retried, and the engine refuses it — so this read-model must not offer it. Gated on the
 * same `retryBudget` column as the cap, because that column already names exactly the commands that ARE a
 * RETRY control action; the decision is the kernel's `isPermittedForFailure`, the same call the handler makes.
 *
 * A DIFFERENT REFUSAL FROM THE CAP, not a duplicate of it: the cap counts attempts, this reads what the
 * failure WAS. A step can be inside its budget and still forbidden to retry. The failure-class limb is asked
 * FIRST, exactly as it was inline: a class that forbids RETRY refuses without consulting the cap at all.
 */
function retryBudgetPermits(
	spec: StepCommandSpec,
	retry: RetryInput | undefined,
	lastFailureClass: string | undefined
): boolean {
	if (spec.retryBudget !== 'CONSUMES_RETRY_BUDGET') return true;
	if (lastFailureClass !== undefined && !isPermittedForFailure(lastFailureClass, 'RETRY'))
		return false;
	if (retry !== undefined) {
		const decision = retryDecision(retry);
		if (!decision.mayRetry) return false;
	}
	return true;
}

/**
 * Would the ENGINE accept this affordance under a plan in `planStatus`?
 *
 * Reads `planLiveness` straight off the command's own spec row. That is the whole point: DWP-06 declares "No
 * affordance the engine would reject (F-11)", and the only way that survives is for the read-model and the
 * authority to consult ONE declaration. Four of the five call sites had grown their own inline plan-status
 * condition and the fifth (retry) had none — which is precisely how the invariant was violated.
 */
function planPermitsAffordance(
	planStatus: string,
	affordance: GatedAffordance,
	pwuWorkLifecycleState?: string,
	binding?: StepBindingContext,
	retry?: RetryInput,
	unresolvedRequiredInputs?: readonly string[],
	lastFailureClass?: string
): boolean {
	const spec = STEP_COMMAND_SPECS[COMMAND_BY_AFFORDANCE[affordance]];
	if (spec.planLiveness === 'REQUIRES_ACTIVE_PLAN' && planStatus !== PLAN_STATUS_ACTIVE)
		return false;
	// RPH-PWU-010 (WP-12b's second limb). Only gate when the caller actually TOLD us the PWU's state — see the
	// disclosure on `ExecutionPlanInput.pwuWorkLifecycleState`.
	if (
		spec.pwuOpenness === 'REQUIRES_OPEN_PWU' &&
		pwuWorkLifecycleState !== undefined &&
		CLOSED_PWU_STATES.has(pwuWorkLifecycleState)
	)
		return false;
	// ── RPH-EXE-003, the THIRD authority limb (JAN-REVREM RW-6 / MAJOR #5) ──────────────────────────────────────
	//
	// GATED ON THE COLUMN, and nothing here names `start` or `resolve`. That is the whole point: `bindingAuthority`
	// is total over the nine commands with a compile error for a tenth, so a future command that requires an
	// authorized binding is withheld by this read-model ON THE DAY IT IS DECLARED, with no second edit. Naming the
	// two commands instead would guarantee a fourth row in DS §6b's table of "engine gained a limb, read-model did
	// not hear about it" — which is now three entries long.
	//
	// The DECISION is `bindingAuthorityVerdict` in rph-domain, called by the engine too. Re-deriving the four checks
	// here would duplicate an order that is itself load-bearing, and it is precisely the `CLOSED_PWU_STATES` mistake
	// R3 had to correct one work package ago: a second copy whose comment claims it is derived.
	if (spec.bindingAuthority === 'REQUIRES_AUTHORIZED_BINDING' && binding !== undefined) {
		const verdict = bindingAuthorityVerdict(binding.stepId, binding);
		if (!verdict.ok) return false;
	}
	// ── The `retryBudget` column's TWO refusals — RPH-EXE-008's cap (N-12) and DOC-002 §36's failure-class mapping
	// (REG-E-025) — both live in `retryBudgetPermits`, which reads the column ONCE. Extracted whole rather than
	// split, because they are the two halves of one column's meaning and asking them apart is what let the second
	// one ship without the first noticing. Order inside the helper is the order they had here.
	if (!retryBudgetPermits(spec, retry, lastFailureClass)) return false;
	// ── RPH-EXE-005, the FIFTH limb (N-21) ─────────────────────────────────────────────────────────────────────
	//
	// Gated on the COLUMN, so both arrows into RUNNING are covered by one line and a tenth command declaring
	// REQUIRES_PRESENT_INPUTS is withheld here on the day it is declared. The DECISION is `stepMayBecomeReady`,
	// the ratified kernel the engine calls — this layer re-derives nothing, it only supplies the resolved fact.
	if (
		spec.inputReadiness === 'REQUIRES_PRESENT_INPUTS' &&
		unresolvedRequiredInputs !== undefined &&
		!stepMayBecomeReady(unresolvedRequiredInputs.length === 0).ok
	)
		return false;
	return true;
}

/** Both affordance sets for a step, already filtered by what the plan's status permits. */
export interface StepAffordances {
	readonly advance: readonly StepAdvanceCommand[];
	readonly control: readonly StepControlCommand[];
}

/**
 * A step's binding facts together with the step they belong to — what `bindingAuthorityVerdict` needs.
 *
 * FLAT, and it carries `stepId` because the SCOPE limb compares the binding's declared `executionStepId` against the
 * step actually being afforded. `planAffordancesFor` receives a stepState rather than a step, so the id has to travel
 * with the facts; the alternative was a second positional parameter that callers could silently transpose.
 */
export interface StepBindingContext extends BindingAuthorityFacts {
	readonly stepId: string;
}

/** Assemble the verdict's input from a step. Returns undefined when the caller supplied no facts — which is
 *  UNGATED, not unauthorized (DS §6b R9). */
function bindingContextFor(s: ExecutionStepInput): StepBindingContext | undefined {
	if (s.runtimeBinding === undefined) return undefined;
	return {
		stepId: s.id,
		...(s.runtimeBindingId === undefined ? {} : { bindingId: s.runtimeBindingId }),
		bindingResolves: s.runtimeBinding.resolves,
		...(s.runtimeBinding.boundStepId === undefined
			? {}
			: { boundStepId: s.runtimeBinding.boundStepId }),
		...(s.runtimeBinding.authorizationStatus === undefined
			? {}
			: { authorizationStatus: s.runtimeBinding.authorizationStatus }),
		// N-18: threaded so the NOTHING_GRANTED limb reaches the read-model too. This is the property the ruling was
		// chosen for — the limb lives inside `bindingAuthorityVerdict`, which `planPermitsAffordance` already
		// consults, so mirroring it costs one field rather than a new column.
		...(s.runtimeBinding.grantedCapabilities === undefined
			? {}
			: { grantedCapabilities: s.runtimeBinding.grantedCapabilities })
	};
}

/**
 * THE plan-aware affordance projection (JAN-EXECREM WP-15 / SM-8, F-29).
 *
 * WHAT WAS WRONG. `advanceCommandsFor(stepState)` mirrors a precondition over (planStatus, stepState) but took
 * only stepState, and the UI rendered its result unconditionally — so Retry was offered on a FAILED step under a
 * CANCELLED or SUPERSEDED plan and the engine refused it. The plan status was already sitting unused on
 * `ExecutionPlanInput.status` at the exact construction site. Four sibling affordances had each grown their own
 * inline plan-status condition in the Svelte template; retry had none, and nothing made the omission visible.
 *
 * FAIL-CLOSED on an off-contract status: only the literal 'ACTIVE' opens the gated affordances, so a status this
 * projection has never heard of offers cleanup only — never the full set.
 */
export function planAffordancesFor(
	planStatus: string,
	stepState: string,
	pwuWorkLifecycleState?: string,
	binding?: StepBindingContext,
	retry?: RetryInput,
	unresolvedRequiredInputs?: readonly string[],
	lastFailureClass?: string
): StepAffordances {
	const permits = (a: StepAdvanceCommand | StepControlCommand) =>
		planPermitsAffordance(
			planStatus,
			a,
			pwuWorkLifecycleState,
			binding,
			retry,
			unresolvedRequiredInputs,
			lastFailureClass
		);
	return {
		advance: advanceCommandsFor(stepState).filter(permits),
		control: controlCommandsFor(stepState).filter(permits)
	};
}

/** The semantic tone for a stepState — total over the 10 values; unknown → 'muted'. */
export function stepStateTone(stepState: string): StepTone {
	return TONE_BY_STEP_STATE[stepState as StepState] ?? 'muted';
}

/** A stepState below the domain's driveable floor: NOT_READY/READY, the initial state that has no advance command
 *  (distinct from a terminal state like SUCCEEDED/SKIPPED which is legitimately done, not stuck). */
export function isBelowQueued(stepState: string): boolean {
	return stepState === 'NOT_READY' || stepState === 'READY';
}

/**
 * Assemble `retryDecision`'s input for a step. Returns undefined when the caller supplied no count — UNGATED, not
 * exhausted, matching `bindingContextFor` (DS §6b R9).
 *
 * `lastAttemptFailed` is DERIVED from the step's own state rather than passed as `true`. The affordance list
 * already restricts `retry` to FAILED, so a literal would be correct today — and it would make this limb's answer
 * depend on a caller-side invariant instead of on the step in front of it, which is the substitution that turns a
 * check into a decoration the first time the invariant moves.
 */
function retryContextFor(s: ExecutionStepInput, retryPolicy: unknown): RetryInput | undefined {
	if (s.attemptsMade === undefined) return undefined;
	return {
		attemptsMade: s.attemptsMade,
		maxAttempts: retryCapFrom(retryPolicy),
		lastAttemptFailed: s.stepState === 'FAILED'
	};
}

function stepView(
	s: ExecutionStepInput,
	planStatus: string,
	pwuWorkLifecycleState?: string,
	retryPolicy?: unknown
): ExecutionStepView {
	const retry = retryContextFor(s, retryPolicy);
	const afforded = planAffordancesFor(
		planStatus,
		s.stepState,
		pwuWorkLifecycleState,
		bindingContextFor(s),
		retry,
		s.unresolvedRequiredInputs,
		s.lastFailureClass
	);
	// ── WITHHOLDING THE AFFORDANCE MUST NOT ALSO WITHHOLD THE REASON ───────────────────────────────────────────
	//
	// N-12's fix removes `retry` at the cap — and the exhaustion actions RPH-EXE-008 prescribes were named ONLY in
	// the engine's rejection message, which an operator now never sees, because the click that produced it is gone.
	// A silently vanishing button is a worse answer than a refused one: it tells the operator nothing about what to
	// do instead, and this codebase's standing rule is that a refusal names a remedy the engine can perform.
	//
	// So the view carries what the refusal used to say. Same `retryDecision` call, same permitted actions, sourced
	// from the ratified kernel rather than restated in a template — and available WITHOUT requiring the engine to
	// reject a click the read-model should never have offered.
	const exhausted = retry ? retryDecision(retry) : undefined;
	// THE SAME RULE ONE LIMB FURTHER ON (REG-E-025). The §36 refusal also removes a button, so it also owes the
	// operator a remedy. Present ONLY when the class genuinely forbids RETRY — absent means "retryable" or "no
	// classified failure", never "unknown". The permitted set comes from the same kernel call that withheld the
	// affordance, so the notice and the withholding cannot disagree.
	const failureBlock =
		s.lastFailureClass !== undefined && !isPermittedForFailure(s.lastFailureClass, 'RETRY')
			? {
					failureClass: s.lastFailureClass,
					permittedControlActions: permittedControlActionsForFailure(s.lastFailureClass) ?? []
				}
			: undefined;
	const base: ExecutionStepView = {
		id: s.id,
		stepType: s.stepType,
		purpose: s.purpose,
		stepState: s.stepState,
		...(s.selectedTransitionId === undefined
			? {}
			: { selectedTransitionId: s.selectedTransitionId }),
		tone: stepStateTone(s.stepState),
		advanceCommands: afforded.advance,
		controlCommands: afforded.control,
		belowQueued: isBelowQueued(s.stepState),
		...(failureBlock === undefined ? {} : { retryForbiddenByFailureClass: failureBlock }),
		// Present ONLY when the cap has actually been reached — absent means "not exhausted", never "unknown", so a
		// caller cannot render an exhaustion notice for a step that still has attempts left.
		...(exhausted?.mustSelectAlternateAction
			? { retryExhaustion: { permittedControlActions: exhausted.permittedControlActions } }
			: {})
	};
	// Preserve the optional runtimeBindingId only when present (exactOptionalPropertyTypes-friendly).
	return s.runtimeBindingId === undefined
		? base
		: { ...base, runtimeBindingId: s.runtimeBindingId };
}

/** Shape one ExecutionPlan aggregate row into the view — step order preserved as authored; the transition graph is
 *  carried (DR-004 DWP-01; empty ⇒ linear, the Tier-3C degenerate). */
export function executionPlanView(row: ExecutionPlanInput): ExecutionPlanView {
	const base: ExecutionPlanView = {
		id: row.id,
		workUnitId: row.workUnitId,
		status: row.status,
		// The plan's status was already sitting HERE, unused, while the UI grew five inline conditions to
		// reconstruct what it implies. Threading it is the whole fix (JAN-EXECREM WP-15 / F-29).
		...(row.pwuWorkLifecycleState === undefined
			? {}
			: { pwuWorkLifecycleState: row.pwuWorkLifecycleState }),
		steps: row.steps.map((step) =>
			stepView(step, row.status, row.pwuWorkLifecycleState, row.retryPolicy)
		),
		transitions: row.transitions ?? []
	};
	return row.planVersion === undefined ? base : { ...base, planVersion: row.planVersion };
}

// ── The transition-graph flow gate read-model (JAN-EXECPLAN-DR-004 DWP-01, Tier 3C-ii) ──────────────────────────────
//
// Boundary (EP-CMT-4 — this crosses WORKFLOW-ENGINE SEQUENCING): "which steps may start" is derived by the SINGLE pure
// gate in rph-domain (`startableStepIds`), which BOTH this read-model (the UI Start affordance) AND the engine
// authority (`startExecutionStep`'s precheck) call — so display and authority cannot diverge (DR-004 §19-M2). The graph
// GENERALIZES the shipped linear gate: an EMPTY transitions[] is byte-identical to the Tier-3C single array-index
// frontier; a non-empty graph gates on the in-edge barrier (no PENDING in-edge, ≥1 SATISFIED), covering a diamond
// barrier-join and (later) a PARALLEL_GROUP set-frontier. This is the DISPLAY seam only; the engine gate is authority.

/** Is this step state a satisfied predecessor (terminal-success: SUCCEEDED/SKIPPED)? Delegates to the shared rph-domain
 *  gate so the definition lives in exactly one place. */
export function isTerminalSuccessStep(stepState: string): boolean {
	return isTerminalSuccessStepState(stepState);
}

/**
 * The SET of steps a plan may currently START — the transition-graph flow gate (DR-004 DWP-01), delegating to the pure
 * rph-domain predicate the engine also uses. Empty transitions[] ⇒ the single linear frontier (byte-identical to
 * Tier-3C); a graph ⇒ every step whose in-edge barrier is satisfied (a linear/single-path plan still yields a
 * singleton; a fan-out can yield several). The UI shows Start on a step iff it is in this set AND its advanceCommands
 * include 'start' (so a RUNNING frontier shows Complete/Fail, a READY/NOT_READY one the belowQueued note).
 */
export function startableStepIds(
	plan: ExecutionPlanView,
	evaluateGuard?: EdgeGuardEvaluator
): string[] {
	return gateStartableStepIds(plan, evaluateGuard);
}

/** The set of steps that are now UNREACHABLE and should be pruned to SKIPPED (a resolved BRANCH's not-taken arm + its
 *  transitive downstream) — DWP-03. Delegates to the shared rph-domain fixpoint. The UI surfaces these for a Prune
 *  action; a linear plan yields none. */
export function prunableStepIds(
	plan: ExecutionPlanView,
	evaluateGuard?: EdgeGuardEvaluator
): string[] {
	// JAN-REVREM RW-1 — THE AUTHORITY FILTER PRUNE ESCAPED. This was a bare passthrough. The underlying gate knows
	// only `plan.status`, while `PruneExecutionStep` declares `pwuOpenness: REQUIRES_OPEN_PWU` and the engine refuses
	// it on a closed PWU (WP-12b) — so the read-model offered a Prune the engine would reject, which is F-29's
	// invariant, in the one place WP-15 never looked. The template comment asserting prune was already gated was
	// simply false.
	//
	// Routed through the SAME `planPermitsAffordance` every other affordance uses, reading Prune's own spec row, so
	// this cannot drift from the authority independently.
	if (!planPermitsAffordance(plan.status, 'prune', plan.pwuWorkLifecycleState)) return [];
	return gatePrunableStepIds(plan, evaluateGuard);
}

/**
 * Build the CONDITIONAL-edge guard evaluator for a plan (DWP-02/03) — a closure over the plan's committed subject
 * (folded from its steps + this plan's own event log). Passed to startableStepIds/prunableStepIds so the read-model's
 * BRANCH first-match matches the engine authority exactly. Pure/browser-safe (the subject fold + evaluator are
 * rph-domain; the schema parse is Zod, already in the browser bundle). Reuse for both calls so the fold happens once.
 */
export function conditionEvaluatorFor(
	plan: ExecutionPlanView,
	events: readonly ConditionSubjectEvent[]
): EdgeGuardEvaluator {
	const subject = buildConditionSubject(plan.steps, events, plan.id);
	// WP-7/SM-5: ONE evaluation rule, shared with the authority (rph-application's guardEvaluatorFor).
	return (edge) => evaluateGuardExpression(edge.conditionExpression, subject);
}

/** The single startable step — back-compat with the Tier-3C scalar frontier: the first of `startableStepIds`, or
 *  undefined. A linear plan yields exactly one; `startableStepIds` is the graph-general (set) API the UI consumes. */
export function startableStepId(plan: ExecutionPlanView): string | undefined {
	return startableStepIds(plan)[0];
}

// ── The transitions view (DWP-06). A READ-ONLY rendering of the plan's immutable graph. ──────────────────────────────
//
// Boundary (EP-CMT-4): this is the EDGE plane of the execution view. It renders what the interpreter already decided;
// it is NOT a second source of affordances. Every button on the execution tab still comes from advanceCommands /
// controlCommands / startableStepIds / prunableStepIds (the F-11 discipline) — a transition row drives nothing.
// Transitions are immutable post-propose (DS-004 F-4), so there is deliberately no edit affordance here.

/** One rendered transition (edge) row. `disposition` is the interpreter's own verdict, not a re-derivation. */
export interface TransitionRow {
	/** Stable row key. The persisted edge id when present; else a positional fallback (the projections input type
	 *  makes `id` optional, and a Svelte keyed each-block may not key on undefined). */
	readonly key: string;
	readonly sourceStepId?: string;
	readonly targetStepId?: string;
	/** Human labels — the step's purpose when it resolves, else an honest marker. Never a fabricated name. */
	readonly sourceLabel: string;
	readonly targetLabel: string;
	/** SEQUENTIAL | CONDITIONAL — the authored edge role. Absent in the input type, so it is defaulted honestly. */
	readonly role: string;
	/** A human summary of the guard, or undefined for an unconditional edge. */
	readonly conditionText?: string;
	/** SATISFIED (this edge is live/taken) · NEUTRALIZED (not-taken arm, or a failed source) · PENDING (source unfinished). */
	readonly disposition: InEdgeDisposition;
}

/** A one-line human summary of a condition expression. Exhaustive over the grammar's 8 ops — a new op fails to compile
 *  here rather than silently rendering as blank. An expression that does not PARSE renders as an explicit marker: the
 *  UI must never present an uninterpretable guard as though it were understood, nor as `[object Object]`. */
export function describeCondition(expression: unknown): string {
	const parsed = ConditionExpressionSchema.safeParse(expression);
	if (!parsed.success) return 'unparseable condition';
	return renderCondition(parsed.data);
}

function renderCondition(c: ConditionExpression): string {
	switch (c.op) {
		case 'STEP_STATE':
			return `step ${shortId(c.stepId)} is ${c.state}`;
		case 'STEP_SUCCEEDED':
			return `step ${shortId(c.stepId)} succeeded`;
		case 'OUTPUT_COUNT':
			return `step ${shortId(c.stepId)} outputs ${c.cmp} ${c.value}`;
		case 'ATTEMPTS':
			return `step ${shortId(c.stepId)} attempts ${c.cmp} ${c.value}`;
		case 'RESULT_EQUALS':
			return `step ${shortId(c.stepId)} result.${c.path} = ${String(c.value)}`;
		case 'ALL':
			return c.operands.length
				? `all of (${c.operands.map(renderCondition).join('; ')})`
				: 'all of ()';
		case 'ANY':
			return c.operands.length
				? `any of (${c.operands.map(renderCondition).join('; ')})`
				: 'any of ()';
		case 'NOT':
			return `not (${renderCondition(c.operand)})`;
	}
}

/** Ids are ULIDs; render a readable prefix rather than 30 characters of entropy. */
const shortId = (id: string): string => (id.length > 12 ? `${id.slice(0, 12)}…` : id);

/**
 * The plan's transition graph as renderable rows (DWP-06).
 *
 * CRITICAL — the edge objects are passed to `inEdgeDisposition` BY REFERENCE, straight out of `plan.transitions`.
 * The BRANCH first-match in rph-domain decides "is this the selected arm?" by OBJECT IDENTITY against the elements of
 * that same array (`selectBranchEdge(...) === edge`). Cloning or normalizing an edge before asking would make every
 * CONDITIONAL edge report NEUTRALIZED, with no type error and no test failure outside a branch fixture. Do not map
 * over `plan.transitions` before this call.
 */
export function transitionRows(
	plan: ExecutionPlanView,
	evaluateGuard?: EdgeGuardEvaluator
): TransitionRow[] {
	const labelOf = (stepId: string | undefined, absent: string): string => {
		if (stepId === undefined) return absent;
		const step = plan.steps.find((s) => s.id === stepId);
		return step ? step.purpose : `unknown step ${shortId(stepId)}`;
	};
	return plan.transitions.map((edge, i) => ({
		key: edge.id ?? `${plan.id}-edge-${i}`,
		...(edge.sourceStepId !== undefined ? { sourceStepId: edge.sourceStepId } : {}),
		...(edge.targetStepId !== undefined ? { targetStepId: edge.targetStepId } : {}),
		// An edge may legitimately have no source (a plan-entry edge) — the contract marks both endpoints optional.
		sourceLabel: labelOf(edge.sourceStepId, '(plan entry)'),
		targetLabel: labelOf(edge.targetStepId, '(plan exit)'),
		role:
			edge.transitionType ??
			(edge.conditionExpression !== undefined ? 'CONDITIONAL' : 'SEQUENTIAL'),
		...(edge.conditionExpression !== undefined
			? { conditionText: describeCondition(edge.conditionExpression) }
			: {}),
		disposition: inEdgeDisposition(plan, edge, evaluateGuard)
	}));
}

/**
 * Scope plans to an Undertaking's PWUs and shape them (the F-6 fix). `pwuIds` is derived two-hop by the caller:
 * PWU.undertakingId == the route's Undertaking → the PWU's id → this set. A plan is included IFF its `workUnitId`
 * is in that set — there is no `undertakingId` on a plan (F-1), so this PWU-membership test is the only correct
 * scope. A plan whose PWU lives in a different Undertaking (or whose PWU has no undertakingId, hence never appears
 * in `listPwus(engine, undertakingId)`) has a workUnitId absent from the set and is EXCLUDED — never the global list.
 */
export function plansForPwus(
	rows: readonly ExecutionPlanInput[],
	pwuIds: Iterable<string>,
	/** PWU id -> its `workLifecycleState`, so the affordance filter can apply RPH-PWU-010 (WP-15). Omit and the
	 *  PWU limb simply does not gate — see the disclosure on `ExecutionPlanInput.pwuWorkLifecycleState`. */
	pwuLifecycleById: Readonly<Record<string, string>> = {},
	/**
	 * RUNTIME_BINDING id -> what the caller resolved about it, so the affordance filter can apply RPH-EXE-003
	 * (JAN-REVREM RW-6 / MAJOR #5). Omit and the binding limb does not gate — the same disclosed fail-open as above.
	 *
	 * Keyed by BINDING id rather than by step id: the binding is the object the caller looks up, and keying by step
	 * would silently accept a map built for the wrong plan. A binding id absent from the map means "not resolved",
	 * which is UNGATED — distinct from a present entry carrying `resolves: false`, which gates (DS §6b R9).
	 */
	bindingFactsById: Readonly<Record<string, StepBindingFacts>> = {}
): ExecutionPlanView[] {
	const scope = pwuIds instanceof Set ? pwuIds : new Set(pwuIds);
	return rows
		.filter((r) => scope.has(r.workUnitId))
		.map((r) => executionPlanView(withResolvedAuthority(r, pwuLifecycleById, bindingFactsById)));
}

/**
 * Attach whatever authority facts the caller supplied, WITHOUT overwriting anything the row already carries.
 *
 * Extracted so the two limbs are attached the same way. The PWU limb was inlined as a conditional spread and the
 * binding limb needs a per-STEP rewrite, and writing the second one in the shape of the first would have meant
 * mapping steps inside a ternary inside a `.map` — where the "did the row already say this?" check is easy to lose.
 */
function withResolvedAuthority(
	r: ExecutionPlanInput,
	pwuLifecycleById: Readonly<Record<string, string>>,
	bindingFactsById: Readonly<Record<string, StepBindingFacts>>
): ExecutionPlanInput {
	const lifecycle = pwuLifecycleById[r.workUnitId];
	const withPwu: ExecutionPlanInput =
		r.pwuWorkLifecycleState === undefined && lifecycle !== undefined
			? { ...r, pwuWorkLifecycleState: lifecycle }
			: r;
	// Nothing to attach unless the caller supplied at least one binding fact — so a caller that passes no map gets
	// object-identical steps, not a rebuilt array that merely looks the same.
	if (Object.keys(bindingFactsById).length === 0) return withPwu;
	return {
		...withPwu,
		steps: withPwu.steps.map((s) => {
			if (s.runtimeBinding !== undefined) return s; // the row already knows better than the map
			const facts =
				s.runtimeBindingId === undefined ? undefined : bindingFactsById[s.runtimeBindingId];
			return facts === undefined ? s : { ...s, runtimeBinding: facts };
		})
	};
}

// ── Tier 2: the Undertaking execution SEQUENCE + the layerHandoff advisory constraint-checker (DWP-04, fork C) ──────
//
// Intent: arrange an Undertaking's PWU INSTANCES by their TYPES' hand-off dependency (reuse layerHandoff over the
// bound PWA's PWU-Type graph — F-10 discipline, do NOT re-derive), and raise a coherence ADVISORY when a consumer
// instance has begun before its producer produced the artifact. The simulator's dependency order acting as the
// execution view's constraint-checker.
//
// Boundary (EP-CMT-4 — crosses the PWA≠ExecutionWorkflow cut): this joins the type-level hand-off plane to the
// instance-level execution plane. The join is DELIBERATELY type-level (nothing links a step's bindings to its type's
// hand-off, F-10), so the advisory is a type-level approximation, disclosed as advisory-only.
//
// Do not change: SequenceView / HandoffAdvisory are DISPLAY-ONLY. This value MUST NEVER be an input to a command
//   dispatch or a valid/coherent verdict — it gates NOTHING (fork C, mirroring handoff-order.ts's isolation of
//   analyzePwaGraph.valid). The advisory predicate reads ONLY executionState (single axis) — never
//   workLifecycleState (EXECUTING is a workLifecycleState value, SUCCEEDED an executionState value; mixing them was
//   the JAN-EXECPLAN §19 L3-C1 defect). Crossing the architectural cut is permitted ONLY advisorily.

/** executionState values that mean the instance HAS BEGUN — SINGLE AXIS (executionState), never workLifecycleState. */
const BEGUN_EXECUTION_STATES = new Set<string>([
	'QUEUED',
	'RUNNING',
	'WAITING',
	'RETRYING',
	'SUCCEEDED'
]);

export interface SequenceInstance {
	readonly id: string;
	readonly title: string;
	/** The PWU's executionState axis value (the ONLY axis the advisory reads). */
	readonly executionState: string;
	readonly pwuTypeId?: string;
	readonly typeName?: string;
}

export interface SequenceLayer {
	readonly index: number;
	readonly instances: SequenceInstance[];
}

/** Why an instance is shown but NOT placed in a dependency layer. */
export type UnplacedReason = 'no-type' | 'off-graph' | 'no-dependency-position';

export interface UnplacedInstance extends SequenceInstance {
	readonly reason: UnplacedReason;
}

/** A single-axis coherence advisory — NEVER a gate. */
export interface HandoffAdvisory {
	readonly consumerInstanceId: string;
	readonly consumerTitle: string;
	readonly consumerTypeId: string;
	readonly producerTypeId: string;
	readonly producerTypeName: string;
	readonly artifact: string;
	readonly detail: string;
}

export interface SequenceView {
	/** Instances placed by their TYPE's Kahn dependency layer (shared within a layer — a partial order). */
	readonly layers: SequenceLayer[];
	/** Instances shown but not dependency-placed: no pwuTypeId, an off-graph type (e.g. a stale/other-version type
	 *  filtered out of the bound-version graph), or a type with no definite dependency position (in a hand-off cycle). */
	readonly unplaced: UnplacedInstance[];
	/** Consumer-began-before-producer-produced advisories (single-axis, M+-aware). Advisory-only — gates nothing. */
	readonly advisories: HandoffAdvisory[];
}

/**
 * The Undertaking execution sequence over instances + the single-axis hand-off advisory (DWP-04, fork C).
 *
 * `ex` MUST already be scoped to the instances' bound (pwaId, pwaVersion) — the caller builds it via the version-
 * scoped buildPwaExport, so a type from another version of the same PWA is simply absent from `ex.nodes` and its
 * instances fall to `unplaced` as 'off-graph' (the version-skew safety net, JAN-EXECPLAN §19 L3-C2).
 *
 * The advisory is M+-aware: a producer TYPE with N instances is satisfied by ANY ONE succeeded instance (the
 * hand-off is type-level — nothing binds a specific producer instance to a specific consumer instance, F-10); it
 * fires only when NO producer-type instance has SUCCEEDED and a consumer instance HAS BEGUN. Evaluated per consumer
 * instance (consumer M+). Reads executionState ONLY.
 */
/** The join state of one instance against the version-scoped type graph — placed at a layer, or an unplaced reason. */
function classifyInstance(
	inst: SequenceInstance,
	nodeIds: ReadonlySet<string>,
	layerOf: ReadonlyMap<string, number>
): { layer: number } | { reason: UnplacedReason } {
	if (!inst.pwuTypeId) return { reason: 'no-type' };
	if (!nodeIds.has(inst.pwuTypeId)) return { reason: 'off-graph' };
	const li = layerOf.get(inst.pwuTypeId);
	// In the graph but in a hand-off cycle / downstream of one / unordered — no definite dependency position.
	return li === undefined ? { reason: 'no-dependency-position' } : { layer: li };
}

function placeInstances(
	instances: readonly SequenceInstance[],
	nodeIds: ReadonlySet<string>,
	nameOf: ReadonlyMap<string, string>,
	layerOf: ReadonlyMap<string, number>
): { layers: SequenceLayer[]; unplaced: UnplacedInstance[] } {
	const layerBuckets = new Map<number, SequenceInstance[]>();
	const unplaced: UnplacedInstance[] = [];
	for (const inst of instances) {
		const c = classifyInstance(inst, nodeIds, layerOf);
		if ('reason' in c) {
			unplaced.push({ ...inst, reason: c.reason });
			continue;
		}
		const placed: SequenceInstance = {
			...inst,
			typeName: inst.typeName ?? nameOf.get(inst.pwuTypeId ?? '')
		};
		layerBuckets.set(c.layer, [...(layerBuckets.get(c.layer) ?? []), placed]);
	}
	const layers = [...layerBuckets.keys()]
		.sort((a, b) => a - b)
		.map((index) => ({
			index,
			instances: [...(layerBuckets.get(index) ?? [])].sort((a, b) => a.id.localeCompare(b.id))
		}));
	return { layers, unplaced };
}

/** Group instances by their pwuTypeId (drops instances with no type — they cannot participate in a type hand-off). */
function groupByType(instances: readonly SequenceInstance[]): Map<string, SequenceInstance[]> {
	const byType = new Map<string, SequenceInstance[]>();
	for (const inst of instances)
		if (inst.pwuTypeId) byType.set(inst.pwuTypeId, [...(byType.get(inst.pwuTypeId) ?? []), inst]);
	return byType;
}

function computeAdvisories(
	ex: PwaGraphExport,
	instancesByType: ReadonlyMap<string, SequenceInstance[]>,
	nameOf: ReadonlyMap<string, string>
): HandoffAdvisory[] {
	const producerSucceeded = (typeId: string): boolean =>
		(instancesByType.get(typeId) ?? []).some((i) => i.executionState === 'SUCCEEDED');
	const advisories: HandoffAdvisory[] = [];
	for (const edge of ex.dataFlow) {
		if (producerSucceeded(edge.producer)) continue; // any succeeded producer instance satisfies the hand-off (M+)
		const producerName = nameOf.get(edge.producer) ?? edge.producer;
		for (const consumer of instancesByType.get(edge.consumer) ?? []) {
			if (!BEGUN_EXECUTION_STATES.has(consumer.executionState)) continue; // single-axis: executionState only
			advisories.push({
				consumerInstanceId: consumer.id,
				consumerTitle: consumer.title,
				consumerTypeId: edge.consumer,
				producerTypeId: edge.producer,
				producerTypeName: producerName,
				artifact: edge.artifact,
				detail: `Consumer has begun (executionState=${consumer.executionState}) but no “${producerName}” instance has produced “${edge.artifact}” (executionState=SUCCEEDED).`
			});
		}
	}
	return advisories;
}

export function sequenceView(
	ex: PwaGraphExport,
	instances: readonly SequenceInstance[],
	order: HandoffOrder = layerHandoff(ex)
): SequenceView {
	const nodeIds = new Set(ex.nodes.map((n) => n.id));
	const nameOf = new Map(ex.nodes.map((n) => [n.id, n.name] as const));
	const layerOf = new Map<string, number>();
	order.layers.forEach((layer, i) => layer.forEach((id) => layerOf.set(id, i)));

	const { layers, unplaced } = placeInstances(instances, nodeIds, nameOf, layerOf);
	const advisories = computeAdvisories(ex, groupByType(instances), nameOf);
	return { layers, unplaced, advisories };
}

// Re-export the contract enum types so consumers (the route load(), the panel) can type against the same source.
export type { ExecutionPlanStatus, ExecutionState, StepState } from '@janumipwb/rph-contracts';
