// The DECLARED contract of every ExecutionStep command (JAN-EXECREM WP-8 / SM-2). Pure data; no behaviour.
//
// WHY THIS EXISTS. `advanceStep` had exactly three extension points — `precheck`, `requireFrom`, `eventType`/
// `target` — all OPTIONAL, all supplied per call site, and declared NOWHERE a reader or a test could enumerate.
// Nothing in the system could answer "which rules does StartExecutionStep enforce, and which does
// CompleteExecutionStep not?" without reading nine docblocks and trusting them. That is the shape behind a whole
// family of findings: four `requireFrom` sets with no kill test (F-11/12/13/14/18/19), a plan-ACTIVE precheck
// present on five commands and absent on four with no statement of which absence was intended (F-26), and eight
// of twenty machine arrows with no test at all (F-40). An omission is invisible in a list that does not exist.
//
// So the contract becomes DATA. `Readonly<Record<StepCommandType, StepCommandSpec>>` makes the table TOTAL: adding
// a tenth step command without declaring its row is a compile error, not a discovery. WP-9's kill-test battery and
// WP-16's conformance gates both ITERATE this table rather than restating it, so a site with no kill test fails the
// build instead of waiting for the next adversarial review.
//
// SITED IN rph-domain deliberately: rph-projections may depend on rph-domain (its affordance projection consumes
// this table), and rph-domain may not depend on rph-application. Putting it beside the handlers would have made the
// read-model unable to derive affordances from the same declaration the authority enforces — the exact
// read-model/authority divergence the F-11 discipline exists to prevent.
import type { StepState } from '@janumipwb/rph-contracts';

/** The nine commands that advance an ExecutionStep.stepState. */
export type StepCommandType =
	| 'StartExecutionStep'
	| 'CompleteExecutionStep'
	| 'FailExecutionStep'
	| 'RetryExecutionStep'
	| 'SkipExecutionStep'
	| 'CancelExecutionStep'
	| 'PruneExecutionStep'
	| 'EnterExecutionStepWait'
	| 'ResolveExecutionStepWait';

export interface StepCommandSpec {
	readonly commandType: StepCommandType;
	/** The stepState this command drives the step TO. */
	readonly target: StepState;
	/**
	 * The states this command may be issued FROM — its `drivesFrom`.
	 *
	 * The machine alone is NOT sufficient: it classifies `from === to` as a NOOP (so a re-issue was absorbed while
	 * STILL emitting an event), and it legalises every arrow into the target from ANY source (so Start on a WAITING
	 * step performed a silent RESUME). This set is the per-command narrowing the machine cannot express.
	 */
	readonly sourceStates: readonly StepState[];
	/** The event emitted on success. */
	readonly eventType: string;
	/**
	 * Does this command require an ACTIVE plan (JAN-EXECREM WP-12 / F-26)?
	 *
	 * THE AXIS IS NOT "OPENS NEW WORK" — IT IS "MINTS SUCCESS CREDIT OR A DURABLE DECISION". The codebase already
	 * behaved that way and said otherwise: Skip and Prune open no work whatsoever, yet both carried the plan-ACTIVE
	 * precheck, because both MINT TERMINAL-SUCCESS. Restated canonically: a command that drives a step to terminal
	 * success, or records a durable branch decision, requires an ACTIVE plan (RPH-EXE-002 / §35.1). A command that
	 * terminates or suspends already-open work with an honest NON-success record requires no plan status, and MUST
	 * stay available so a dead plan's live steps are never stranded.
	 *
	 * WP-8 declared this column as DESCRIPTION; WP-12 makes it the ENFORCEMENT POINT, evaluated in `advanceStep`
	 * ahead of every per-command precheck. `CLEANUP_EXEMPT` is therefore a positive claim with its own kill test —
	 * the declaration F-26 observed that Complete never had.
	 */
	readonly planLiveness: PlanLiveness;
	/** Why `planLiveness` is what it is. Prose, so the intent survives the next reader. */
	readonly activePlanRationale: string;
	/**
	 * Does this command require the owning PWU to be OPEN — not in a terminal `workLifecycleState`
	 * (RPH-PWU-010 / §8.3; JAN-EXECREM WP-12 / F-28)?
	 *
	 * RPH-PWU-010 is ratified and was enforced NOWHERE: `canResumeExecutionOnPwu` had exactly two repo-wide
	 * references — its own definition and its own unit test — while the conformance manifest certified it COVERED.
	 * A pure-predicate unit test was accepted as evidence for a rule whose ratified `then` is "the command is
	 * rejected", which is the same substitution the CMDPRE series found elsewhere.
	 *
	 * Cleanup is exempt for the same reason as `planLiveness`: closing a PWU must never strand its live steps.
	 */
	readonly pwuOpenness: PwuOpenness;
	/** Why `pwuOpenness` is what it is. */
	readonly pwuOpennessRationale: string;
	/**
	 * What this command does about a BRANCH decision when it settles a step (JAN-EXECREM WP-10 / CANONICAL RULE B2).
	 *
	 * REQUIRED on every row, which is the whole mechanism. F-15/21/23 were one omission wearing three masks: the
	 * decision was recorded by ONE of the two commands that can drive a step to terminal-success, and the other's
	 * silence was indistinguishable from the bug. Making this a required field turns "Skip forgot" into a compile
	 * error, and makes Prune's silence a DECLARATION with a stated reason rather than an absence.
	 */
	readonly branchDecision: BranchDecisionPolicy;
	/** Why `branchDecision` is what it is — the same discipline as `activePlanRationale`: a silence must be a
	 *  DECLARATION with a reason, or it is indistinguishable from the omission that produced this family. */
	readonly branchDecisionRationale: string;
	/**
	 * Does this command require the step's RUNTIME BINDING to be authorized (RPH-EXE-003 / §8.1)?
	 *
	 * THIS COLUMN EXISTS BECAUSE ITS ABSENCE SHIPPED A BLOCKER. JAN-EXEBIND wired RPH-EXE-003 as a hand-inlined
	 * precheck inside `startExecutionStep` — one call site — and **two arrows drive a step into RUNNING**.
	 * `resolveExecutionStepWait` passes no precheck at all, so a step could be started under an AUTHORIZED
	 * binding, parked in WAITING, have the binding REVOKED, and then RESUME: proved live through
	 * `Engine.dispatch`, with the engine's own refusal message asserting that state is impossible. Revocation was
	 * unenforceable for any waitable step.
	 *
	 * That is precisely the shape this table was built to end. WP-8's header: "an omission is invisible in a list
	 * that does not exist." WP-12b moved `planLiveness` and `pwuOpenness` into it as COLUMNS so no command could
	 * omit an authority — and the next authority was added at a call site anyway. A guard that must be remembered
	 * per site will be forgotten at one of them.
	 *
	 * So the axis is declared once and evaluated once: **does this command drive the step INTO RUNNING** — the
	 * state in which attempts actually execute against the binding? Two commands do. The other seven declare
	 * `NOT_EXECUTING` with a stated reason, so a silence is a declaration rather than an absence.
	 */
	readonly bindingAuthority: BindingAuthority;
	/** Why `bindingAuthority` is what it is. */
	readonly bindingAuthorityRationale: string;
	/**
	 * RPH-EXE-005: does this command CONSUME the step's declared inputs, so that a required input artifact being
	 * absent must leave the step not ready (JAN-CAPBIND WP-3, closing N-3)?
	 *
	 * A FOURTH DECLARED COLUMN rather than a precheck inside one handler, for the reason the third one exists.
	 * `bindingAuthority` was added as a column precisely because siting it in `startExecutionStep` missed
	 * `ResolveExecutionStepWait` — the SECOND arrow into RUNNING — and that omission was a BLOCKER proved live.
	 * The same two arrows consume inputs, so the same shape of omission is available here; being total over the
	 * nine commands means a tenth cannot ship without declaring its disposition.
	 */
	readonly inputReadiness: InputReadiness;
	/** Why `inputReadiness` is what it is. */
	readonly inputReadinessRationale: string;
}

/** REQUIRES_ACTIVE_PLAN: mints terminal-success or a durable decision. CLEANUP_EXEMPT: terminates or suspends
 *  already-open work with an honest non-success record, and must stay available on a dead plan. */
export type PlanLiveness = 'REQUIRES_ACTIVE_PLAN' | 'CLEANUP_EXEMPT';

/** REQUIRES_OPEN_PWU: grants runtime privilege, mints execution credit, or opens an attempt. CLEANUP_EXEMPT: as above. */
export type PwuOpenness = 'REQUIRES_OPEN_PWU' | 'CLEANUP_EXEMPT';

/** REQUIRES_AUTHORIZED_BINDING: drives the step INTO RUNNING, the state in which attempts execute against the
 *  binding. NOT_EXECUTING: does not open or re-open runtime execution, so the binding's status cannot bear on it. */
export type BindingAuthority = 'REQUIRES_AUTHORIZED_BINDING' | 'NOT_EXECUTING';

/** REQUIRES_PRESENT_INPUTS: drives the step into RUNNING, where its declared inputs are actually consumed, so a
 *  required input artifact that does not resolve must leave it not ready (RPH-EXE-005). NOT_CONSUMING: the command
 *  settles, suspends, abandons or waives the step without reading its inputs, so their presence cannot bear on it —
 *  and gating them would STRAND a step whose missing input is precisely why it is being cancelled or skipped. */
export type InputReadiness = 'REQUIRES_PRESENT_INPUTS' | 'NOT_CONSUMING';

/**
 * RECORD_AT_SETTLEMENT   — this command drives a step to TERMINAL_SUCCESS, so if that step is a BRANCH it must take
 *                          and record its decision at that instant, under Rule B1's settlement view.
 * NONE_STRUCTURALLY_DEAD — it reaches TERMINAL_SUCCESS but never on a live branch, so there is no decision to take.
 * NOT_TERMINAL_SUCCESS   — its target is not terminal-success, so no decision arises. Checked against the target.
 */
export type BranchDecisionPolicy =
	'RECORD_AT_SETTLEMENT' | 'NONE_STRUCTURALLY_DEAD' | 'NOT_TERMINAL_SUCCESS';

const spec = (s: StepCommandSpec): StepCommandSpec => s;

/**
 * The table. TOTAL over `StepCommandType` — a new step command cannot be added without declaring its contract.
 *
 * WP-8 declared the authority columns as DESCRIPTION of the shipped prechecks; WP-12 settled the four undeclared
 * omissions (F-26) and made the table the ENFORCEMENT POINT — `advanceStep` reads `planLiveness` and `pwuOpenness`
 * from here and the five hand-inlined `plan.status !== 'ACTIVE'` blocks are gone. Arguing about a table rather than
 * about nine docblocks is what made the settlement possible.
 */
export const STEP_COMMAND_SPECS: Readonly<Record<StepCommandType, StepCommandSpec>> = {
	StartExecutionStep: spec({
		commandType: 'StartExecutionStep',
		target: 'RUNNING',
		sourceStates: ['QUEUED'],
		eventType: 'ExecutionStepStarted',
		planLiveness: 'REQUIRES_ACTIVE_PLAN',
		activePlanRationale:
			'starting OPENS AN ATTEMPT, which is both new work and the first half of an execution episode; a superseded plan opens none (RPH-EXE-002).',
		pwuOpenness: 'REQUIRES_OPEN_PWU',
		pwuOpennessRationale:
			'a closed PWU (BASELINED / ABANDONED / SUPERSEDED) accepts no new attempt in place — RPH-PWU-010 requires a successor revision or successor PWU.',
		branchDecision: 'NOT_TERMINAL_SUCCESS',
		branchDecisionRationale: 'RUNNING is not terminal-success.',
		bindingAuthority: 'REQUIRES_AUTHORIZED_BINDING',
		bindingAuthorityRationale:
			'the FIRST of the two arrows into RUNNING. Starting opens an attempt, and an attempt executes against the binding — RPH-EXE-003 names this case verbatim.',
		inputReadiness: 'REQUIRES_PRESENT_INPUTS',
		inputReadinessRationale:
			'the FIRST consuming arrow. Starting opens an attempt, and an attempt READS the step’s declared inputs — RPH-EXE-005 names this case verbatim: starting a step whose required input artifact is absent must leave it not ready and perform no model/tool invocation.'
	}),
	CompleteExecutionStep: spec({
		commandType: 'CompleteExecutionStep',
		target: 'SUCCEEDED',
		sourceStates: ['RUNNING'],
		eventType: 'ExecutionStepSucceeded',
		planLiveness: 'REQUIRES_ACTIVE_PLAN',
		activePlanRationale:
			'SETTLED by WP-12 (F-26), and the one row that CHANGES behaviour. Complete mints TERMINAL-SUCCESS and a durable BRANCH decision, and SUCCEEDED is the only step state completeExecutionPlan and rejectUnbackedExecutionSuccess accept as backing — so minting it on a plan the sponsor killed manufactures downstream authority on dead state (verified ACCEPTED, with selectedTransitionId written, before this change). Consistency demanded it too: the surface refused the LESSER act (ResolveWait, whose own message says "a superseded/terminal plan opens no new work") while permitting the greater one on the same plan at the same instant. No deadlock is created — Cancel is the deliberately ungated exit, and is exactly what ResolveWait already prescribes.',
		pwuOpenness: 'REQUIRES_OPEN_PWU',
		pwuOpennessRationale:
			'completion is the fact a PWU execution-success claim rests on; a closed PWU may not accrue more of it.',
		branchDecision: 'RECORD_AT_SETTLEMENT',
		branchDecisionRationale:
			'the primary settling command: a BRANCH decides at the moment it succeeds, against a settlement view that INCLUDES its own result (Rule B1).',
		bindingAuthority: 'NOT_EXECUTING',
		bindingAuthorityRationale:
			'completion CLOSES an attempt. Refusing it on a revoked binding would strand a step that has already done the work, with no way to record what it produced.',
		inputReadiness: 'NOT_CONSUMING',
		inputReadinessRationale:
			'the attempt has ALREADY read them. Completion records work that was performed, so gating it on input presence would refuse the record of work already done — and an artifact deleted mid-attempt would make the step uncompletable rather than merely unstartable.'
	}),
	FailExecutionStep: spec({
		commandType: 'FailExecutionStep',
		target: 'FAILED',
		sourceStates: ['RUNNING'],
		eventType: 'ExecutionStepFailed',
		planLiveness: 'CLEANUP_EXEMPT',
		activePlanRationale:
			'SETTLED by WP-12 (F-26) as CORRECT, and now DECLARED with a positive test rather than merely omitted. A FAILED step backs no success claim anywhere, and a system that makes FAILURE HARDER TO REPORT THAN SUCCESS is worse than one that checks neither. Its exemption is the mirror of the Complete gate: the axis is credit, and failure mints none.',
		pwuOpenness: 'CLEANUP_EXEMPT',
		pwuOpennessRationale:
			'recording that work failed must never require the PWU to be open, or a closed PWU strands running steps.',
		branchDecision: 'NOT_TERMINAL_SUCCESS',
		branchDecisionRationale:
			'FAILED is terminal, but not success; the flow does not advance, so no arm is taken.',
		bindingAuthority: 'NOT_EXECUTING',
		bindingAuthorityRationale:
			'recording failure must never require a live authority — the same argument as its planLiveness and pwuOpenness exemptions. A revoked binding makes failure MORE likely to be the truth, not less reportable.',
		inputReadiness: 'NOT_CONSUMING',
		inputReadinessRationale:
			'a missing input is frequently WHY the attempt failed. Refusing the honest non-success record would strand the step in RUNNING and destroy the very account of what went wrong.'
	}),
	RetryExecutionStep: spec({
		commandType: 'RetryExecutionStep',
		target: 'QUEUED',
		sourceStates: ['FAILED'],
		eventType: 'ExecutionStepRetried',
		planLiveness: 'REQUIRES_ACTIVE_PLAN',
		activePlanRationale:
			'a retry RE-OPENS the attempt cycle, so it is new work even though the step already exists (RPH-EXE-002).',
		pwuOpenness: 'REQUIRES_OPEN_PWU',
		pwuOpennessRationale:
			'a retry opens a fresh attempt, which is exactly what RPH-PWU-010 forbids in place.',
		branchDecision: 'NOT_TERMINAL_SUCCESS',
		branchDecisionRationale: 'QUEUED re-opens the step; nothing settles.',
		bindingAuthority: 'NOT_EXECUTING',
		bindingAuthorityRationale:
			'retry drives FAILED -> QUEUED, which opens no attempt: the attempt opens at the NEXT Start, which IS gated. Gating here too would double-guard one act and refuse earlier with a less useful message.',
		inputReadiness: 'NOT_CONSUMING',
		inputReadinessRationale:
			'retry returns the step to QUEUED, not RUNNING — nothing is consumed here. The next Start re-asks the question against the state as it then is, which is the only correct time to ask it.'
	}),
	SkipExecutionStep: spec({
		commandType: 'SkipExecutionStep',
		target: 'SKIPPED',
		sourceStates: ['READY', 'QUEUED'],
		eventType: 'ExecutionStepSkipped',
		planLiveness: 'REQUIRES_ACTIVE_PLAN',
		activePlanRationale:
			'a skip MINTS TERMINAL-SUCCESS under a waiver while opening no work at all — which is precisely why the axis is CREDIT rather than work. Its pre-existing gate is the evidence that the codebase already believed the credit axis.',
		pwuOpenness: 'REQUIRES_OPEN_PWU',
		pwuOpennessRationale:
			'SKIPPED is terminal-success, so a skip advances a plan on a PWU that must not advance.',
		branchDecision: 'RECORD_AT_SETTLEMENT',
		branchDecisionRationale:
			'SKIPPED is terminal-SUCCESS precisely so the flow ADVANCES past the step, so an arm must be taken and somebody must choose it. Recording nothing here is what let a later guard flip re-resolve a settled branch and run BOTH arms (F-15/21/23). Not fabrication: the same act as at Complete, truthfully evaluated against a step that produced no result.',
		bindingAuthority: 'NOT_EXECUTING',
		bindingAuthorityRationale:
			'a skip runs nothing; it retires the step under an authorization. No binding is exercised.',
		inputReadiness: 'NOT_CONSUMING',
		inputReadinessRationale:
			'an absent required input is one of the ordinary REASONS to waive a step. Gating the waiver on the condition that motivates it would make the governed exit unreachable exactly when it is needed.'
	}),
	CancelExecutionStep: spec({
		commandType: 'CancelExecutionStep',
		target: 'CANCELLED',
		sourceStates: ['READY', 'QUEUED', 'RUNNING', 'WAITING', 'FAILED'],
		eventType: 'ExecutionStepCancelled',
		planLiveness: 'CLEANUP_EXEMPT',
		activePlanRationale:
			'INTENTIONAL: cancel is CLEANUP. It must remain available on a plan that has already been superseded or has failed, or live/failed work would be stranded with no exit. FAILED is in the source set since WP-5 (abandoning an arm nobody will retry).',
		pwuOpenness: 'CLEANUP_EXEMPT',
		pwuOpennessRationale:
			'the exit of last resort, and the one every other refusal message points at; closing a PWU must never strand its live steps.',
		branchDecision: 'NOT_TERMINAL_SUCCESS',
		branchDecisionRationale:
			'CANCELLED is terminal-non-success; the downstream is not released, so no arm is taken.',
		bindingAuthority: 'NOT_EXECUTING',
		bindingAuthorityRationale:
			'cancel is the exit of last resort and is exempt from every authority limb. Gating it on the binding would strand exactly the step whose binding was revoked — the case revocation exists to stop.',
		inputReadiness: 'NOT_CONSUMING',
		inputReadinessRationale:
			'the exit of last resort. Cancel must stay available on a step that can never become ready, or an unsatisfiable input permanently strands the arm — the wedge shape RW-0 had to withdraw a limb for.'
	}),
	PruneExecutionStep: spec({
		commandType: 'PruneExecutionStep',
		target: 'SKIPPED',
		sourceStates: ['NOT_READY', 'READY', 'QUEUED'],
		eventType: 'ExecutionStepPruned',
		planLiveness: 'REQUIRES_ACTIVE_PLAN',
		activePlanRationale:
			'a prune MINTS TERMINAL-SUCCESS under branch logic, and is within-execution branch resolution, which only an ACTIVE plan performs. NOT_READY is in the source set so a not-taken arm that never became ready is still clearable (D5 anti-deadlock).',
		pwuOpenness: 'REQUIRES_OPEN_PWU',
		pwuOpennessRationale:
			'pruning drives SKIPPED (terminal-success) and resolves a branch — both execution acts.',
		branchDecision: 'NONE_STRUCTURALLY_DEAD',
		branchDecisionRationale:
			'a prune only ever reaches a step the branch logic ALREADY excluded, so there is no decision left to take. SAFE STRUCTURALLY, not by convention: the disposition ladder tests source liveness before it reaches any branch rung, and the reachability BFS never expands a non-live node. Both are pinned by test rather than assumed.',
		bindingAuthority: 'NOT_EXECUTING',
		bindingAuthorityRationale: 'prune clears a structurally dead arm; it executes nothing.',
		inputReadiness: 'NOT_CONSUMING',
		inputReadinessRationale:
			'a system prune settles a step the plan’s own branch logic already excluded; it never runs, so it never reads. Its inputs are irrelevant by construction.'
	}),
	EnterExecutionStepWait: spec({
		commandType: 'EnterExecutionStepWait',
		target: 'WAITING',
		sourceStates: ['RUNNING'],
		eventType: 'ExecutionStepWaiting',
		planLiveness: 'CLEANUP_EXEMPT',
		activePlanRationale:
			'INTENTIONAL: waiting SUSPENDS work that is already running; it mints nothing and opens nothing. Recorded with a positive test.',
		pwuOpenness: 'CLEANUP_EXEMPT',
		pwuOpennessRationale:
			'a running step must be able to record honestly that it is blocked, whatever the PWU is doing; the alternative strips it of that.',
		branchDecision: 'NOT_TERMINAL_SUCCESS',
		branchDecisionRationale: 'WAITING suspends; nothing settles.',
		bindingAuthority: 'NOT_EXECUTING',
		bindingAuthorityRationale:
			'waiting SUSPENDS execution. A running step must be able to record that it is blocked whatever the binding is doing — and parking a step whose binding was just revoked is the CORRECT response, not one to refuse.',
		inputReadiness: 'NOT_CONSUMING',
		inputReadinessRationale:
			'suspending a RUNNING step reads nothing new — the attempt already consumed its inputs when it started.'
	}),
	ResolveExecutionStepWait: spec({
		commandType: 'ResolveExecutionStepWait',
		target: 'RUNNING',
		sourceStates: ['WAITING'],
		eventType: 'ExecutionStepWaitResolved',
		planLiveness: 'REQUIRES_ACTIVE_PLAN',
		activePlanRationale:
			'resuming returns a step to RUNNING, which IS new work on the plan; the WAITING source set is also what keeps Start from performing a silent resume.',
		pwuOpenness: 'REQUIRES_OPEN_PWU',
		pwuOpennessRationale: 'a resume re-opens RUNNING, the state in which attempts execute.',
		branchDecision: 'NOT_TERMINAL_SUCCESS',
		branchDecisionRationale: 'RUNNING resumes; nothing settles.',
		bindingAuthority: 'REQUIRES_AUTHORIZED_BINDING',
		bindingAuthorityRationale:
			'THE SECOND ARROW INTO RUNNING, and the one whose omission was a BLOCKER. A resume re-enters RUNNING, so it re-opens execution against the binding exactly as Start does — this handler’s own docblock already said "resuming re-opens RUNNING, the state in which attempts execute". Anything else makes REVOCATION UNENFORCEABLE for every step that can be parked in WAITING.',
		inputReadiness: 'REQUIRES_PRESENT_INPUTS',
		inputReadinessRationale:
			'THE SECOND CONSUMING ARROW, and the reason this is a column. A resume re-enters RUNNING and the attempt reads the same declared inputs; siting the check in startExecutionStep alone would miss it exactly as the binding limb was missed, which was a BLOCKER proved live.'
	})
};

/** Every declared step command, for a caller that needs to sweep them all (WP-9, WP-16). */
export const STEP_COMMAND_TYPES = Object.keys(STEP_COMMAND_SPECS) as readonly StepCommandType[];

/** The spec for one command. Total, so this cannot return undefined for a declared type. */
export function stepCommandSpec(commandType: StepCommandType): StepCommandSpec {
	return STEP_COMMAND_SPECS[commandType];
}
